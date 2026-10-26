import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CarFront, MapPin, RefreshCw, Radio, Telescope } from "lucide-react";
import { api, Resource, dateTime, localDate, localInput } from "./api";
import { Empty, ErrorBox, Field, Loading, PageHead } from "./ui";
import { SourceMap, SourceMapLayout, validPoint } from "./MapLayout";
import "./parity.css";

function rangeFor(value: string) {
  const end = new Date();
  return value === "today"
    ? { from: localDate() + "T00:00:00", to: localDate() + "T23:59:59" }
    : {
        from: localInput(
          new Date(end.getTime() - Number(value) * 86400000).toISOString(),
        ),
        to: localInput(end.toISOString()),
      };
}
function LocationDetails({ fields }: { fields: any[][] }) {
  return (
    <div className="source-location-details">
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Positions() {
  const [params] = useSearchParams(),
    historyMode = params.has("start") || params.get("view") === "history";
  const resources = useQuery({
    queryKey: ["resources"],
    queryFn: () => api<Resource[]>("/resources"),
  });
  const positions = useQuery({
    queryKey: ["positions"],
    queryFn: () => api<any[]>("/positions"),
    enabled: !historyMode,
    staleTime: 0,
    refetchInterval: historyMode ? false : 10000,
  });
  const [selected, setSelected] = useState(Number(params.get("resource")) || 0),
    [search, setSearch] = useState(""),
    [open, setOpen] = useState(false);
  const [range, setRange] = useState(
      params.has("start") || params.has("end") ? "custom" : "today",
    ),
    [initial] = useState(() => rangeFor("today"));
  const [from, setFrom] = useState(
      params.get("start") ? localInput(params.get("start")!) : initial.from,
    ),
    [to, setTo] = useState(
      params.get("end") ? localInput(params.get("end")!) : initial.to,
    );
  const [points, setPoints] = useState<any[]>([]),
    [activePoint, setActivePoint] = useState<any>(),
    [searched, setSearched] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rs = (resources.data || []).filter((r) =>
    historyMode
      ? r.kind === "vehicle"
      : ["vehicle", "equipment"].includes(r.kind),
  );
  const resource = rs.find((r) => r.id === selected),
    position = positions.data?.find((p) => p.resource_id === selected);
  const latestPoints = (positions.data || []).map((p) => ({
    ...p,
    label: rs.find((r) => r.id === p.resource_id)?.label || p.label,
  }));
  function clear() {
    setPoints([]);
    setActivePoint(undefined);
    setSearched(false);
    setError("");
  }
  async function queryHistory() {
    clear();
    setSearched(true);
    if (!selected || resource?.kind !== "vehicle") {
      setError("請先選擇車輛");
      return;
    }
    setBusy(true);
    try {
      const result = await api(
        "/trajectory/" +
          selected +
          "?start=" +
          encodeURIComponent(from) +
          "&end=" +
          encodeURIComponent(to),
      );
      setPoints(result.points || []);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (historyMode && params.get("start") && resources.data) queryHistory();
  }, [resources.data]);
  const side = historyMode ? (
    <>
      <h2>搜尋條件</h2>
      <form
        className="source-map-controls"
        onSubmit={(e) => {
          e.preventDefault();
          queryHistory();
        }}
      >
        <Field label="選擇車輛">
          <select
            aria-label="選擇車輛"
            value={selected || ""}
            disabled={busy}
            onChange={(e) => {
              setSelected(Number(e.target.value));
              clear();
            }}
          >
            <option value="">請選擇車輛...</option>
            {rs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="開始時間">
          <input
            type="datetime-local"
            step="1"
            required
            value={from}
            disabled={busy}
            onChange={(e) => {
              setFrom(e.target.value);
              setRange("custom");
              clear();
            }}
          />
        </Field>
        <Field label="結束時間">
          <input
            type="datetime-local"
            step="1"
            required
            value={to}
            disabled={busy}
            onChange={(e) => {
              setTo(e.target.value);
              setRange("custom");
              clear();
            }}
          />
        </Field>
        <button className="button primary" disabled={busy}>
          {busy ? "查詢中…" : "查詢"}
        </button>
        <details>
          <summary>快捷時間範圍</summary>
          <Field label="時間範圍">
            <select
              aria-label="時間範圍"
              value={range}
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value;
                setRange(v);
                if (v !== "custom") {
                  const dates = rangeFor(v);
                  setFrom(dates.from);
                  setTo(dates.to);
                }
                clear();
              }}
            >
              {[
                ["today", "今日"],
                ["30", "30天"],
                ["60", "60天"],
                ["90", "90天"],
                ["custom", "自訂時間"],
              ].map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </details>
      </form>
      <ErrorBox error={error || resources.error} />
      <h3>位置資訊</h3>
      {busy ? (
        <Loading />
      ) : points.length ? (
        <div className="source-location-list">
          {points.map((p, i) => (
            <button
              key={i}
              className={
                "source-location-card " + (p === activePoint ? "active" : "")
              }
              onClick={() => {
                setActivePoint(p);
                setOpen(false);
              }}
              disabled={!validPoint(p)}
            >
              <strong>
                <MapPin size={20} />
                {i === 0 ? "起點" : i === points.length - 1 ? "終點" : "中繼點"}
              </strong>
              <small>
                座標:{" "}
                {validPoint(p)
                  ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
                  : "無有效座標"}
              </small>
              <small>時間: {dateTime(p.time)}</small>
              {p.speed != null && <small>速度: {p.speed}</small>}
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title={searched ? "查詢無結果" : "沒有資料，請調整搜尋條件後重試"}
          description="請調整搜尋條件後重試。"
        />
      )}
      {points.some((p) => !validPoint(p)) && (
        <p>
          {points.filter((p) => !validPoint(p)).length}{" "}
          筆記錄無座標，未顯示於地圖。
        </p>
      )}
    </>
  ) : (
    <>
      <h2>
        <CarFront size={24} /> 車輛列表{" "}
        <span className="count-pill">
          {rs.filter((r) => r.kind === "vehicle").length}
        </span>
      </h2>
      {selected > 0 && (
        <div className="source-selected-location">
          目前選中: {resource?.label}
        </div>
      )}
      <input
        aria-label="搜尋車牌或設備"
        placeholder="搜尋車牌或設備"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ErrorBox error={resources.error || positions.error} />
      {resources.isPending || positions.isPending ? (
        <Loading />
      ) : (
        <div className="source-location-list">
          {rs
            .filter((r) =>
              [r.label, r.name, r.model]
                .join(" ")
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((r) => {
              const p = positions.data?.find((p) => p.resource_id === r.id);
              return (
                <button
                  key={r.id}
                  className={
                    "source-location-card " +
                    (r.id === selected ? "active" : "")
                  }
                  onClick={() => {
                    setSelected(r.id);
                    setOpen(false);
                  }}
                >
                  <strong>
                    {r.kind === "vehicle" ? (
                      <CarFront size={20} />
                    ) : (
                      <Telescope size={20} />
                    )}
                    {r.label}
                  </strong>
                  <small>最後更新: {p ? dateTime(p.time) : "—"}</small>
                  <small>來源: {p?.source || "N/A"}</small>
                  {!validPoint(p) && <small>無有效座標</small>}
                </button>
              );
            })}
        </div>
      )}
      {selected > 0 && (
        <LocationDetails
          fields={[
            ["目前資源", resource?.label],
            [
              "座標",
              validPoint(position)
                ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
                : "無有效座標資料",
            ],
            ["位置記錄時間", dateTime(position?.time)],
            ["最新接收時間", dateTime(position?.updated_at)],
            ["來源", position?.source || "N/A"],
          ]}
        />
      )}
    </>
  );
  return (
    <>
      <PageHead
        eyebrow="LOCATION & ACTIVITY"
        title="資源在哪裡，一目瞭然。"
        description="查看最新收到的位置與車輛歷史軌跡，掌握資源動態。"
        action={
          !historyMode && (
            <button
              className="button"
              disabled={positions.isFetching}
              onClick={() => positions.refetch()}
            >
              <RefreshCw size={16} />
              刷新位置
            </button>
          )
        }
      />
      <div className="info-note">
        <MapPin size={17} />
        此頁顯示已保存的測試報告；報告時間不會因刷新變動。外部圖資由
        OpenStreetMap 提供。
      </div>
      <SourceMapLayout
        title={historyMode ? "搜尋" : "車輛列表"}
        side={side}
        open={open}
        setOpen={setOpen}
      >
        <SourceMap
          points={historyMode ? points : latestPoints}
          trajectory={historyMode}
          selected={historyMode ? activePoint : position}
          onSelect={(p) =>
            historyMode ? setActivePoint(p) : setSelected(p.resource_id)
          }
        />
      </SourceMapLayout>
    </>
  );
}

export function Scans() {
  const [station, setStation] = useState(""),
    [search, setSearch] = useState(""),
    [open, setOpen] = useState(false);
  const stations = useQuery({
    queryKey: ["stations"],
    queryFn: () => api<string[]>("/stations"),
  });
  const q = useQuery({
    queryKey: ["scans", station],
    queryFn: () => api<any[]>("/scans?station=" + encodeURIComponent(station)),
    enabled: !!station,
    refetchInterval: station ? 10000 : false,
  });
  const rows = q.data || [],
    online = rows.filter((r) => r.status === "online").length;
  const side = (
    <>
      <h2>
        <Radio size={22} /> 掃描站列表{" "}
        <span className="count-pill">{stations.data?.length || 0}</span>
      </h2>
      <input
        aria-label="搜尋掃描站"
        placeholder="搜尋掃描站..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ErrorBox error={stations.error} />
      {stations.isPending ? (
        <Loading />
      ) : (
        <div className="source-location-list">
          {stations.data
            ?.filter((id) => id.toLowerCase().includes(search.toLowerCase()))
            .map((id) => (
              <button
                key={id}
                className={
                  "source-location-card " + (id === station ? "active" : "")
                }
                onClick={() => {
                  setStation(id);
                  setOpen(false);
                }}
              >
                <Radio size={20} /> {id}
              </button>
            ))}
          {!stations.data?.length && <p>暫無掃描站</p>}
        </div>
      )}
    </>
  );
  return (
    <>
      <PageHead
        eyebrow="ON-SITE VISIBILITY"
        title="設備場內資訊"
        description="選擇掃描站，查看場內設備的最新回報與連線狀態。"
        action={
          <span className="pill">
            <Radio size={15} />每 10 秒刷新
          </span>
        }
      />
      <SourceMapLayout
        title="掃描站列表"
        side={side}
        open={open}
        setOpen={setOpen}
      >
        <div className="source-scan-results">
          {!station ? (
            <Empty
              title="先選擇一個掃描站"
              description="這裡會顯示設備名稱、訊號強度與最後回報時間。"
            />
          ) : (
            <>
              <h2>{station}</h2>
              <div className="source-scan-chips">
                <span>總設備數: {rows.length}</span>
                <span className="online">線上: {online}</span>
                <span className="offline">離線: {rows.length - online}</span>
                <span>
                  更新:{" "}
                  {q.dataUpdatedAt
                    ? dateTime(new Date(q.dataUpdatedAt).toISOString())
                    : "—"}
                </span>
                <button
                  className="button compact"
                  disabled={q.isFetching}
                  onClick={() => q.refetch()}
                >
                  <RefreshCw size={15} />
                  刷新
                </button>
              </div>
              <p className="muted">虛構測試資料 · 5 分鐘內有回報為在線</p>
              <ErrorBox error={q.error} />
              {q.isPending ? (
                <Loading />
              ) : q.error ? (
                <button className="button" onClick={() => q.refetch()}>
                  重試
                </button>
              ) : (
                <div className="source-table-scroll">
                  <table className="source-data-table source-scan-table">
                    <thead>
                      <tr>
                        <th>設備名稱</th>
                        <th>更新時間</th>
                        <th>設備狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <strong>{d.name}</strong>
                            <details className="source-scan-extra">
                              <summary>訊號資訊</summary>Major {d.id} · RSSI{" "}
                              {d.rssi} dBm · ChargePower {d.power}
                            </details>
                          </td>
                          <td>{dateTime(d.time)}</td>
                          <td>
                            <span
                              className={
                                "status " +
                                (d.status === "online"
                                  ? "status-PENDING"
                                  : "status-offline")
                              }
                            >
                              <i />
                              {d.status === "online" ? "線上" : "離線"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!rows.length && (
                        <tr>
                          <td colSpan={3}>暫無設備資料</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </SourceMapLayout>
    </>
  );
}

export function FindMy() {
  const beacons = useQuery({
    queryKey: ["beacons"],
    queryFn: () => api<any[]>("/beacons"),
  });
  const [id, setId] = useState(""),
    [search, setSearch] = useState(""),
    [open, setOpen] = useState(false);
  const report = useQuery({
    queryKey: ["findmy", id],
    queryFn: () => api("/findmy/" + encodeURIComponent(id)),
    enabled: !!id,
    staleTime: 0,
    refetchInterval: id ? 10000 : false,
  });
  const points = (report.data?.points || []).filter(validPoint).slice(0, 1),
    point = points[0],
    beacon = report.data?.beacon || beacons.data?.find((b) => b.id === id);
  const side = (
    <>
      <h2>設備搜尋</h2>
      <div className="source-map-controls">
        <input
          placeholder="搜尋 Beacon 名稱或 ID"
          aria-label="搜尋定位設備"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Field label="搜尋設備">
          <select
            aria-label="定位設備"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setOpen(false);
            }}
          >
            <option value="">選擇設備</option>
            {beacons.data
              ?.filter((b) =>
                [b.id, b.owner]
                  .join(" ")
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} - {b.owner}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <h3>設備詳情</h3>
      <ErrorBox error={beacons.error || report.error} />
      {id && report.isPending ? (
        <Loading />
      ) : id ? (
        <>
          <h3>
            設備資訊 <span className="source-polling-status">即時更新</span>
          </h3>
          <LocationDetails
            fields={[
              ["設備ID", id],
              ["擁有者", beacon?.owner],
              ["MAC", beacon?.ble_mac || "N/A"],
              ["最後更新時間", dateTime(point?.time)],
              [
                "座標位置",
                point
                  ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
                  : "N/A",
              ],
              ["建立時間", dateTime(point?.created_at)],
              ["Major", beacon?.major],
            ]}
          />
          {point && (
            <p className="source-precise-coordinates">
              精確座標: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
            </p>
          )}
          {!point && !report.error && <p>此設備沒有有效定位報告</p>}
          <div className="actions">
            <button
              className="button"
              disabled={report.isFetching}
              onClick={() => report.refetch()}
            >
              刷新
            </button>
            <button
              className="button"
              onClick={() => {
                setId("");
                setSearch("");
              }}
            >
              清除選擇
            </button>
          </div>
        </>
      ) : (
        <Empty title="請選擇設備" />
      )}
    </>
  );
  return (
    <>
      <PageHead
        eyebrow="FINDMY REPORTS"
        title="Beacon 設備位置"
        description="依十六進位 Beacon ID 查詢最新保存的定位報告。"
      />
      <SourceMapLayout
        title="搜尋設備"
        mobileStatus={
          id && beacon ? (
            <>
              <strong>
                {id} - {beacon.owner}
              </strong>
              <small>
                更新時間: {dateTime(point?.time)}{" "}
                <span className="source-polling-status">即時更新</span>
              </small>
            </>
          ) : undefined
        }
        side={side}
        open={open}
        setOpen={setOpen}
      >
        <SourceMap points={points} />
      </SourceMapLayout>
    </>
  );
}
