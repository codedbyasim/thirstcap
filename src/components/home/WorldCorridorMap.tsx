"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { SiteId } from "@/lib/sites";
import { SITES } from "@/lib/sites";
import { SITE_SISTERS, guessSister, wriColor } from "@/lib/sisters";
import type { CustomSiteInput } from "@/lib/types";
import "leaflet/dist/leaflet.css";

type LatLon = [number, number];

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

function pinIcon(color: string, active: boolean, pulse: boolean) {
  return L.divIcon({
    className: "tc-marker-wrap",
    html: `<span class="tc-marker${pulse ? " tc-marker-pulse" : ""}" style="--tc:${color};--tc-size:${active ? 16 : 12}px"></span>`,
    iconSize: [active ? 22 : 16, active ? 22 : 16],
    iconAnchor: [active ? 11 : 8, active ? 11 : 8],
  });
}

const sisterIcon = L.divIcon({
  className: "tc-marker-wrap",
  html: `<span class="tc-sister-dot"></span>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

function MapBehavior({
  flyTo,
  refitToken,
}: {
  flyTo: LatLon | null;
  refitToken: string;
}) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds(SITES.map((site) => [site.lat, site.lon] as LatLon));
    map.fitBounds(bounds, { padding: [42, 42], maxZoom: 3, animate: false });
  }, [map, refitToken]);

  useEffect(() => {
    if (!flyTo) return;
    map.flyTo(flyTo, Math.max(map.getZoom(), 4), { duration: 0.85 });
  }, [flyTo, map]);

  useEffect(() => {
    map.scrollWheelZoom.disable();
    const el = map.getContainer();
    el.setAttribute("tabindex", "0");
    const enable = () => map.scrollWheelZoom.enable();
    const disable = () => map.scrollWheelZoom.disable();
    el.addEventListener("focus", enable);
    el.addEventListener("click", enable);
    el.addEventListener("mouseleave", disable);
    el.addEventListener("blur", disable);
    return () => {
      el.removeEventListener("focus", enable);
      el.removeEventListener("click", enable);
      el.removeEventListener("mouseleave", disable);
      el.removeEventListener("blur", disable);
    };
  }, [map]);

  return null;
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
  const selected = SITES.find((site) => site.id === selectedId) ?? SITES[0];
  const sister = SITE_SISTERS[selected.id];
  const customSister = customCity ? guessSister(customCity.lat, customCity.lon) : null;

  const corridor = useMemo(() => {
    if (customCity && customSister) {
      return arc([customCity.lat, customCity.lon], [customSister.lat, customSister.lon]);
    }
    return arc([selected.lat, selected.lon], [sister.lat, sister.lon]);
  }, [customCity, customSister, selected.lat, selected.lon, sister.lat, sister.lon]);

  const flyTo: LatLon | null = customCity ? [customCity.lat, customCity.lon] : null;
  const refitToken = customCity ? "custom" : "registry";

  return (
    <div className="tc-map relative h-[440px] w-full overflow-hidden rounded-xl sm:h-[480px]">
      <MapContainer
        center={[18, 12]}
        zoom={2}
        minZoom={2}
        maxZoom={8}
        scrollWheelZoom={false}
        worldCopyJump
        className="h-full w-full"
        style={{ background: "#04111D" }}
        aria-label="World map of the ten registry water-stress corridors"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        <MapBehavior flyTo={flyTo} refitToken={refitToken} />
        <Polyline
          positions={corridor}
          pathOptions={{
            color: "#34d399",
            weight: 2.4,
            opacity: 0.95,
            dashArray: "7 9",
            className: reduced ? "tc-arc" : "tc-arc tc-arc-animate",
          }}
        />
        {SITES.map((site) => {
          const active = !customCity && site.id === selectedId;
          const color = wriColor(site.wriScore);
          return (
            <Marker
              key={site.id}
              position={[site.lat, site.lon]}
              icon={pinIcon(color, active, active && !reduced)}
              zIndexOffset={active ? 400 : 0}
              keyboard
              eventHandlers={{ click: () => onSelectSite(site.id) }}
            >
              <Tooltip
                direction="top"
                offset={[0, -10]}
                permanent={active}
                className="tc-tip"
              >
                <span>
                  {site.name} · WRI {site.wriScore}
                </span>
              </Tooltip>
            </Marker>
          );
        })}
        {!customCity ? (
          <Marker position={[sister.lat, sister.lon]} icon={sisterIcon} keyboard={false} interactive={false}>
            <Tooltip direction="top" offset={[0, -6]} className="tc-tip">
              <span>{sister.name}</span>
            </Tooltip>
          </Marker>
        ) : null}
        {customCity && customSister ? (
          <>
            <Marker
              position={[customCity.lat, customCity.lon]}
              icon={pinIcon("#34d399", true, !reduced)}
              zIndexOffset={500}
            >
              <Tooltip direction="top" offset={[0, -10]} permanent className="tc-tip">
                <span>
                  {customCity.name.split(",")[0]}
                  {customWri != null ? ` · WRI ${customWri}` : " · solving"}
                </span>
              </Tooltip>
            </Marker>
            <Marker position={[customSister.lat, customSister.lon]} icon={sisterIcon} keyboard={false} interactive={false}>
              <Tooltip direction="top" offset={[0, -6]} className="tc-tip">
                <span>{customSister.name}</span>
              </Tooltip>
            </Marker>
          </>
        ) : null}
      </MapContainer>
      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg border border-slate-700/80 bg-[#04111D]/90 px-2.5 py-2 text-[10px] text-slate-300 shadow-lg">
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
