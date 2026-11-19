"use client";

import { useEffect, useMemo, useRef } from "react";
import { setWorkerUrl } from "maplibre-gl";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import type { SiteId } from "@/lib/sites";

if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.js");
}
import { SITES } from "@/lib/sites";
import { SITE_SISTERS, guessSister, wriColor } from "@/lib/sisters";
import type { CustomSiteInput } from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";

type LatLon = [number, number];

const STYLE = "https://tiles.openfreemap.org/styles/dark";

function arc(from: LatLon, to: LatLon): LatLon[] {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;
  const midLat = (lat1 + lat2) / 2;
  const midLon = (lon1 + lon2) / 2;
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const len = Math.hypot(dLat, dLon) || 1;
  const bend = Math.min(14, Math.max(4, len * 0.22));
  const sign = midLat >= 0 ? 1 : -1;
  const ctrlLat = midLat + sign * Math.abs((-dLon / len) * bend);
  const ctrlLon = midLon + (dLat / len) * bend * 0.2;
  const points: LatLon[] = [];
  for (let i = 0; i <= 42; i += 1) {
    const t = i / 42;
    const u = 1 - t;
    points.push([
      u * u * lat1 + 2 * u * t * ctrlLat + t * t * lat2,
      u * u * lon1 + 2 * u * t * ctrlLon + t * t * lon2,
    ]);
  }
  return points;
}

function siteBounds(): [[number, number], [number, number]] {
  let minLon = 180;
  let maxLon = -180;
  let minLat = 90;
  let maxLat = -90;
  for (const site of SITES) {
    minLon = Math.min(minLon, site.lon);
    maxLon = Math.max(maxLon, site.lon);
    minLat = Math.min(minLat, site.lat);
    maxLat = Math.max(maxLat, site.lat);
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

export function WorldCorridorMap({
  selectedId,
  customCity,
  customWri,
  reduced,
  onSelectSite,
}: {
  selectedId: SiteId;
  customCity: CustomSiteInput | null;
  customWri: number | null;
  reduced: boolean;
  onSelectSite: (id: SiteId) => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const selected = SITES.find((site) => site.id === selectedId) ?? SITES[0];
  const sister = SITE_SISTERS[selected.id];
  const customSister = customCity ? guessSister(customCity.lat, customCity.lon) : null;

  const corridor = useMemo(() => {
    if (customCity && customSister) return arc([customCity.lat, customCity.lon], [customSister.lat, customSister.lon]);
    return arc([selected.lat, selected.lon], [sister.lat, sister.lon]);
  }, [customCity, customSister, selected.lat, selected.lon, sister.lat, sister.lon]);

  const line = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: corridor.map(([lat, lon]) => [lon, lat]),
      },
    }),
    [corridor],
  );

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (customCity) {
      map.flyTo({ center: [customCity.lon, customCity.lat], zoom: Math.max(map.getZoom(), 3.6), duration: reduced ? 0 : 900 });
      return;
    }
    map.fitBounds(siteBounds(), { padding: 48, maxZoom: 2.6, duration: reduced ? 0 : 600 });
  }, [customCity, reduced]);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      const map = mapRef.current?.getMap();
      if (!map || !map.getLayer("sister-arc")) return;
      const current = map.getPaintProperty("sister-arc", "line-dasharray") as number[] | undefined;
      const next = current && current[0] < 1 ? [1.6, 1.2] : [0.4, 1.6];
      map.setPaintProperty("sister-arc", "line-dasharray", next);
    }, 260);
    return () => window.clearInterval(timer);
  }, [reduced]);

  function enableWheel() {
    mapRef.current?.getMap().scrollZoom.enable();
  }
  function disableWheel() {
    mapRef.current?.getMap().scrollZoom.disable();
  }

  return (
    <div
      className="tc-map relative h-[440px] w-full overflow-hidden rounded-xl sm:h-[480px]"
      onMouseLeave={disableWheel}
    >
      <Map
        ref={mapRef}
        mapStyle={STYLE}
        initialViewState={{ longitude: 12, latitude: 18, zoom: 1.2 }}
        minZoom={1.1}
        maxZoom={8}
        scrollZoom={false}
        attributionControl={{ compact: false }}
        style={{ width: "100%", height: "100%", background: "#04111D" }}
        onLoad={() => {
          mapRef.current?.getMap().scrollZoom.disable();
          if (!customCity) mapRef.current?.fitBounds(siteBounds(), { padding: 48, maxZoom: 2.6, duration: 0 });
        }}
        onClick={enableWheel}
        cursor="grab"
        aria-label="World map of the ten registry water-stress corridors"
      >
        <Source id="sister-arc-src" type="geojson" data={line}>
          <Layer
            id="sister-arc"
            type="line"
            paint={{ "line-color": "#34d399", "line-width": 2.4, "line-opacity": 0.95, "line-dasharray": [1.2, 1.4] }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </Source>
        {SITES.map((site) => {
          const active = !customCity && site.id === selectedId;
          return (
            <Marker key={site.id} longitude={site.lon} latitude={site.lat} anchor="center" style={{ zIndex: active ? 4 : 1 }}>
              <button
                type="button"
                className="tc-pin"
                aria-label={`${site.name}, WRI ${site.wriScore}`}
                onFocus={enableWheel}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectSite(site.id);
                }}
              >
                <span
                  className={`tc-marker${active && !reduced ? " tc-marker-pulse" : ""}`}
                  style={{ ["--tc" as string]: wriColor(site.wriScore), ["--tc-size" as string]: active ? "16px" : "12px" }}
                />
                {active ? <span className="tc-map-label">{site.name} · WRI {site.wriScore}</span> : null}
              </button>
            </Marker>
          );
        })}
        {!customCity ? (
          <Marker longitude={sister.lon} latitude={sister.lat} anchor="center">
            <span className="tc-sister-dot" title={sister.name} />
          </Marker>
        ) : null}
        {customCity && customSister ? (
          <>
            <Marker longitude={customCity.lon} latitude={customCity.lat} anchor="center" style={{ zIndex: 5 }}>
              <span className="tc-pin" title={customCity.name}>
                <span
                  className={`tc-marker${reduced ? "" : " tc-marker-pulse"}`}
                  style={{ ["--tc" as string]: "#34d399", ["--tc-size" as string]: "16px" }}
                />
                <span className="tc-map-label">
                  {customCity.name.split(",")[0]}
                  {customWri != null ? ` · WRI ${customWri}` : " · solving"}
                </span>
              </span>
            </Marker>
            <Marker longitude={customSister.lon} latitude={customSister.lat} anchor="center">
              <span className="tc-sister-dot" title={customSister.name} />
            </Marker>
          </>
        ) : null}
      </Map>
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-slate-700/80 bg-[#04111D]/90 px-2.5 py-2 text-[10px] text-slate-300 shadow-lg">
        <p className="font-semibold uppercase tracking-wider text-slate-400">WRI stress</p>
        <ul className="mt-1 space-y-1">
          {[
            ["80–100", "#fb7185"],
            ["70–79", "#fb923c"],
            ["55–69", "#fbbf24"],
            ["under 55", "#38bdf8"],
          ].map(([label, color]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
