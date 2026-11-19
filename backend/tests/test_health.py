"""Health endpoint and CORS tests."""

from __future__ import annotations


def test_health_endpoint(client):
    resp = client.get("/v1/health", headers={"Origin": "http://localhost:3000"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "thirstcap"
    assert body["sample"] is False
    assert body["solver"] == "PuLP-CBC"
    assert body["datasets"]["eia930_miso"] is True
    assert body["datasets"]["eia930_azps"] is True
    assert body["datasets"]["eia930_pjm"] is True
    assert body["datasets"]["alibaba_gpu_2020"] is True
    assert body["datasets"]["calibration_loaded"] is True
    assert body["datasets"]["sites_count"] == 10
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"
