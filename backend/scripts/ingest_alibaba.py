"""Ingest the public Alibaba PAI 2020 GPU cluster trace into hourly job classes.

Downloads pai_job_table.tar.gz from Alibaba's clusterdata OSS mirror, parses real
GPU job start/end timestamps, classifies jobs by duration into:
  - fixed (< 15 min)
  - deferrable (15 min to 2 h)
  - pausable (> 2 h)
and writes a normalized 168-hour weekly workload profile JSON for the optimizer.
"""

from __future__ import annotations

import json
from pathlib import Path
import tarfile
import httpx
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "data" / "raw"
OUT_DIR = BASE_DIR / "data" / "alibaba"

ALIBABA_URL = "https://aliopentrace.oss-cn-beijing.aliyuncs.com/v2020GPUTraces/pai_job_table.tar.gz"


def download_and_extract() -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    tgz_path = RAW_DIR / "pai_job_table.tar.gz"
    if not (tgz_path.exists() and tgz_path.stat().st_size > 10_000_000):
        print(f"[alibaba] Downloading {ALIBABA_URL} ...")
        with httpx.Client(timeout=180.0, follow_redirects=True) as client:
            with client.stream("GET", ALIBABA_URL) as resp:
                resp.raise_for_status()
                with tgz_path.open("wb") as f:
                    for chunk in resp.iter_bytes(chunk_size=1024 * 256):
                        f.write(chunk)
        print(f"[alibaba] Saved {tgz_path.name} ({tgz_path.stat().st_size / 1e6:.1f} MB)")
    else:
        print(f"[alibaba] Using cached {tgz_path.name} ({tgz_path.stat().st_size / 1e6:.1f} MB)")

    csv_path = RAW_DIR / "pai_job_table.csv"
    if not (csv_path.exists() and csv_path.stat().st_size > 10_000_000):
        with tarfile.open(tgz_path, "r:gz") as tf:
            members = [m for m in tf.getmembers() if m.isfile() and m.name.endswith(".csv")]
            if not members:
                members = [m for m in tf.getmembers() if m.isfile()]
            member = members[0]
            print(f"[alibaba] Extracting {member.name} ...")
            src = tf.extractfile(member)
            assert src is not None
            with csv_path.open("wb") as out:
                while chunk := src.read(1024 * 512):
                    out.write(chunk)
    return csv_path


def aggregate_trace(csv_path: Path) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with csv_path.open("r", encoding="utf-8", errors="replace") as f:
        sample_lines = [f.readline().strip() for _ in range(3)]
    print(f"[alibaba] First 3 lines: {sample_lines}")

    first_tokens = sample_lines[0].split(",")
    has_header = False
    try:
        float(first_tokens[4])
    except (IndexError, ValueError):
        has_header = True

    names = ["job_name", "inst_id", "user", "status", "start_time", "end_time"]
    if has_header:
        df = pd.read_csv(csv_path, low_memory=False)
        cols = list(df.columns)
        start_col = next(c for c in cols if "start" in c.lower())
        end_col = next(c for c in cols if "end" in c.lower())
        status_col = next((c for c in cols if "status" in c.lower()), None)
    else:
        df = pd.read_csv(csv_path, header=None, names=names, low_memory=False)
        start_col, end_col, status_col = "start_time", "end_time", "status"

    df["start_s"] = pd.to_numeric(df[start_col], errors="coerce")
    df["end_s"] = pd.to_numeric(df[end_col], errors="coerce")
    valid = df.dropna(subset=["start_s", "end_s"]).copy()
    valid["dur_s"] = valid["end_s"] - valid["start_s"]
    if status_col is not None:
        terminated = valid[valid[status_col].astype(str).str.lower().isin(["terminated", "running", "failed", "succeeded", "completed"])]
        if len(terminated) > 1000:
            valid = terminated
    valid = valid[(valid["dur_s"] > 0) & (valid["dur_s"] <= 30 * 86400)].copy()

    # Cap single-job duration weight at 24h so multi-week daemon runs don't spike one hour
    valid["energy_h"] = valid["dur_s"].clip(upper=86400.0) / 3600.0
    valid["how"] = ((valid["start_s"].astype("int64") // 3600) % 168).astype(int)

    valid["job_class"] = "pausable"
    valid.loc[valid["dur_s"] <= 7200.0, "job_class"] = "deferrable"
    valid.loc[valid["dur_s"] < 900.0, "job_class"] = "fixed"

    counts = valid["job_class"].value_counts().to_dict()
    energy_totals = valid.groupby("job_class")["energy_h"].sum().to_dict()
    total_e = sum(energy_totals.values())
    raw_shares = {k: round(float(v / total_e), 4) for k, v in energy_totals.items()}

    pivot = (
        valid.pivot_table(index="how", columns="job_class", values="energy_h", aggfunc="sum", fill_value=0.0)
        .reindex(range(168), fill_value=0.0)
    )
    for col in ("fixed", "deferrable", "pausable"):
        if col not in pivot.columns:
            pivot[col] = 0.0
    pivot = pivot[["fixed", "deferrable", "pausable"]]

    # Normalize so mean total hourly intensity is 1.0 across the 168-hour week
    row_sum = pivot.sum(axis=1)
    mean_sum = float(row_sum.mean())
    norm = pivot / mean_sum

    hours = [
        {
            "hour_of_week": int(h),
            "fixed": round(float(norm.loc[h, "fixed"]), 6),
            "deferrable": round(float(norm.loc[h, "deferrable"]), 6),
            "pausable": round(float(norm.loc[h, "pausable"]), 6),
        }
        for h in range(168)
    ]

    payload = {
        "source": "Alibaba PAI 2020 GPU Cluster Trace (github.com/alibaba/clusterdata/tree/master/cluster-trace-gpu-v2020)",
        "duration_cuts": {
            "fixed": "< 900s (< 15 min, interactive inference / short tasks)",
            "deferrable": "900s to 7200s (15 min to 2 h, batch jobs)",
            "pausable": "> 7200s (> 2 h, checkpointed training jobs)",
        },
        "total_jobs_parsed": int(len(valid)),
        "job_counts_by_class": {k: int(v) for k, v in counts.items()},
        "raw_energy_shares": raw_shares,
        "peak_to_mean_arrival_ratio": round(float(norm.sum(axis=1).max()), 4),
        "min_to_mean_arrival_ratio": round(float(norm.sum(axis=1).min()), 4),
        "hours": hours,
    }
    out_path = OUT_DIR / "gpu_2020_weekly_profile.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        f"[alibaba] Wrote {out_path} ({len(valid):,} jobs, raw shares={raw_shares}, "
        f"peak/mean={payload['peak_to_mean_arrival_ratio']})"
    )


def main() -> None:
    csv_path = download_and_extract()
    aggregate_trace(csv_path)


if __name__ == "__main__":
    main()
