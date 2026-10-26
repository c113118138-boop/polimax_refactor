import { ReactNode, useEffect, useState } from "react";
import { Drawer, useMediaQuery } from "@mui/material";
import { Search, X } from "lucide-react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import { dateTime } from "./api";
import "leaflet/dist/leaflet.css";
import "./maps.css";

export const validPoint = (p: any) =>
  Number.isFinite(p?.lat) &&
  Number.isFinite(p?.lng) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lng) <= 180;

export function SourceMapLayout({
  title,
  side,
  children,
  mobileStatus,
  open,
  setOpen,
}: {
  title: string;
  side: ReactNode;
  children: ReactNode;
  mobileStatus?: ReactNode;
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  const mobile = useMediaQuery("(max-width:768px)");
  useEffect(() => {
    if (!mobile) setOpen(false);
  }, [mobile]);
  return (
    <div className="source-map-layout">
      <aside className="source-map-sidebar">{!mobile && side}</aside>
      <section className="source-map-main">
        {children}
        {mobileStatus && (
          <div className="source-map-mobile-status">{mobileStatus}</div>
        )}
        {mobile && (
          <button
            className="source-map-menu"
            aria-label={title}
            onClick={() => setOpen(true)}
          >
            <Search size={24} />
          </button>
        )}
      </section>
      <Drawer
        anchor="right"
        open={mobile && open}
        onClose={() => setOpen(false)}
        className="source-map-drawer"
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="關閉查詢面板"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </header>
        <div className="source-map-drawer-content">{side}</div>
      </Drawer>
    </div>
  );
}

function Focus({ points, selected }: { points: any[]; selected?: any }) {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    if (validPoint(selected)) map.setView([selected.lat, selected.lng], 15);
    else if (points.length === 1)
      map.setView([points[0].lat, points[0].lng], 14);
    else if (points.length > 1)
      map.fitBounds(
        points.map((p) => [p.lat, p.lng]),
        { padding: [40, 40], maxZoom: 15 },
      );
  }, [points, selected, map]);
  return null;
}

export function SourceMap({
  points,
  trajectory = false,
  selected,
  onSelect,
}: {
  points: any[];
  trajectory?: boolean;
  selected?: any;
  onSelect?: (point: any) => void;
}) {
  const shown = points.filter(validPoint),
    [tilesFailed, setTilesFailed] = useState(false);
  return (
    <div className="source-map-canvas">
      <MapContainer
        center={[24.81, 120.98]}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTilesFailed(true) }}
        />
        {shown.map((p, i) => (
          <CircleMarker
            key={`${p.resource_id || "point"}:${i}`}
            center={[p.lat, p.lng]}
            radius={p === selected ? 10 : 7}
            pathOptions={{
              color: trajectory
                ? i === 0
                  ? "#4caf50"
                  : i === shown.length - 1
                    ? "#f44336"
                    : "#2196f3"
                : "#1976d2",
              fillOpacity: 0.9,
            }}
            eventHandlers={{ click: () => onSelect?.(p) }}
          >
            <Popup>
              <strong>
                {p.label ||
                  (trajectory
                    ? i === 0
                      ? "起點"
                      : i === shown.length - 1
                        ? "終點"
                        : "中繼點"
                    : "最新位置")}
              </strong>
              <br />
              {dateTime(p.time)}
              <br />
              {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
              {p.speed != null && (
                <>
                  <br />
                  速度：{p.speed}
                </>
              )}
            </Popup>
          </CircleMarker>
        ))}
        {trajectory &&
          points
            .reduce<any[][]>(
              (segments, p) => {
                if (!validPoint(p)) segments.push([]);
                else segments.at(-1)!.push(p);
                return segments;
              },
              [[]],
            )
            .filter((s) => s.length > 1)
            .map((segment, i) => (
              <Polyline
                key={i}
                positions={segment.map((p) => [p.lat, p.lng])}
                pathOptions={{ color: "#1976d2", weight: 3 }}
              />
            ))}
        <Focus points={shown} selected={selected} />
      </MapContainer>
      {tilesFailed && (
        <small className="source-map-tile-note">
          底圖載入失敗；位置資料與查詢仍可使用。
        </small>
      )}
    </div>
  );
}
