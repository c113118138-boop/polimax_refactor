import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  MapPin,
  Plus,
  Search,
  Trash2,
  Pencil,
  CarFront,
  Users,
  CalendarDays,
  History,
  ChevronDown,
} from "lucide-react";
import {
  api,
  Booking,
  Resource,
  dateTime,
  localDate,
  localInput,
  states,
  nextStates,
  kindNames,
  invalidate,
} from "./api";
import {
  Confirm,
  Empty,
  ErrorBox,
  Field,
  FileUpload,
  Loading,
  Modal,
  PageHead,
  Status,
} from "./ui";
import { useUser } from "./App";
import { StageForm, StageView } from "./Stages";
import { can, canFillDeparture, bookingDoc, Scope } from "./Access";
import { Guard } from "./Access";
import { BookingQueryPage } from "./BookingQueries";
export { BookingForm } from "./BorrowingForms";
const requirements = [
  "工案",
  "材料送貨",
  "新開發案",
  "客戶拜訪",
  "成交案回訪",
  "參展",
  "其他",
];

export function BookingList({ onCreate }: { onCreate: () => void }) {
  const [params] = useSearchParams();
  const kind = params.get("kind");
  if(params.has("history")) return <Guard doc="Lending_form"><BookingQueryPage key="history" kind="A" history/></Guard>;
  if (!params.has("history") && (kind === "A" || kind === "D" || kind === "E"))
    return (
      <Guard doc={bookingDoc(kind)}>
        <BookingQueryPage key={kind} kind={kind} />
      </Guard>
    );
  return <GenericBookingList onCreate={onCreate} />;
}

function GenericBookingList({ onCreate }: { onCreate: () => void }) {
  const u = useUser(),
    navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const historyMode = searchParams.has("history");
  const requestedKind = searchParams.get("kind") || "all";
  const [reasonFilter, setReasonFilter] = useState(""),
    [placeFilter, setPlaceFilter] = useState(""),
    [personFilter, setPersonFilter] = useState(""),
    [plateFilter, setPlateFilter] = useState("");
  useEffect(() => {
    setStatus(historyMode ? "RETURN_ARRIVED" : "all");
    setKind(
      historyMode
        ? "A"
        : ["A", "D", "E"].includes(requestedKind)
          ? requestedKind
          : "all",
    );
  }, [historyMode, requestedKind]);
  const [search, setSearch] = useState(""),
    [kind, setKind] = useState("all"),
    [status, setStatus] = useState(
      searchParams.get("history") ? "RETURN_ARRIVED" : "all",
    ),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [dateField, setDateField] = useState("start");
  const bookings = useQuery({
      queryKey: ["bookings"],
      queryFn: () => api<Booking[]>("/bookings"),
    }),
    resources = useQuery({
      queryKey: ["resources"],
      queryFn: () => api<Resource[]>("/resources"),
    });
  const rs = resources.data || [];
  const results = (bookings.data || []).filter((b) => {
    if (historyMode && (b.kind !== "A" || b.status !== "RETURN_ARRIVED"))
      return false;
    if (
      reasonFilter &&
      (reasonFilter === "其他"
        ? requirements.slice(0, 6).includes(b.content.reason)
        : b.content.reason !== reasonFilter)
    )
      return false;
    if (
      placeFilter &&
      !(b.content.details || []).some((d: any) =>
        [d.city, d.district]
          .join("")
          .toLowerCase()
          .includes(placeFilter.toLowerCase()),
      )
    )
      return false;
    if (
      personFilter &&
      ![
        b.content.applicant,
        ...(b.content.employees || []),
        ...(b.content.details || []).flatMap((d: any) => d.sales || []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(personFilter.toLowerCase())
    )
      return false;
    if (
      plateFilter &&
      !b.slots.some((s) => String(s.resource_id) === plateFilter)
    )
      return false;
    if (
      (kind !== "all" && b.kind !== kind) ||
      (status !== "all" && b.status !== status)
    )
      return false;
    if (
      searchParams.get("resource") &&
      !b.slots.some(
        (s) => s.resource_id === Number(searchParams.get("resource")),
      )
    )
      return false;
    const dates =
      dateField === "created"
        ? [b.created_at]
        : b.slots.map((s) => (dateField === "end" ? s.end : s.start));
    if (
      (from || to) &&
      !dates.some(
        (d) =>
          (!from || localDate(new Date(d)) >= from) &&
          (!to || localDate(new Date(d)) <= to),
      )
    )
      return false;
    return [
      b.id,
      b.content.title,
      b.content.applicant,
      b.content.reason,
      ...(b.content.employees || []),
      ...(b.content.details || []).map(
        (d: any) => d.name + " " + d.city + " " + d.district,
      ),
      ...b.slots.map((s) => rs.find((r) => r.id === s.resource_id)?.label),
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());
  });
  return (
    <>
      <PageHead
        eyebrow="RESERVATIONS & RECORDS"
        title={historyMode ? "車輛使用歷史" : "借用紀錄"}
        description="每一次預約與使用，都有清楚的來龍去脈。"
        action={
          (can(u, "Lending_form", "create") ||
            can(u, "Room_form", "create") ||
            can(u, "Equipment_form", "create")) && (
            <button className="button primary" onClick={onCreate}>
              <Plus size={17} />
              新增預約
            </button>
          )
        }
      />
      <section className="panel">
        <div className="list-tabs">
          {[
            ["all", "全部預約"],
            ["A", "車輛借用"],
            ["D", "作業區"],
            ["E", "儀器借用"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={kind === v ? "active" : ""}
              onClick={() => setKind(v)}
            >
              {label}
              {v === "all" && (
                <span className="count-pill">{bookings.data?.length || 0}</span>
              )}
            </button>
          ))}
        </div>
        <div className="list-filters">
          <select
            aria-label="緣由篩選"
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
          >
            <option value="">全部緣由</option>
            {requirements.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            aria-label="車牌篩選"
            value={plateFilter}
            onChange={(e) => setPlateFilter(e.target.value)}
          >
            <option value="">全部車牌</option>
            {rs
              .filter((r) => r.kind === "vehicle")
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
          </select>
          <input
            aria-label="地點篩選"
            placeholder="縣市／行政區"
            value={placeFilter}
            onChange={(e) => setPlaceFilter(e.target.value)}
          />
          <input
            aria-label="人員篩選"
            placeholder="申請人／使用人員／業務"
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
          />
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="搜尋借用紀錄"
              placeholder="搜尋編號、車牌、申請人或緣由"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="流程狀態"
            disabled={historyMode}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">所有狀態</option>
            {Object.entries(states).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label="日期篩選欄位"
            value={dateField}
            onChange={(e) => setDateField(e.target.value)}
          >
            <option value="start">開始時間</option>
            <option value="end">結束時間</option>
            <option value="created">申請時間</option>
          </select>
          <input
            aria-label="篩選起日"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span>—</span>
          <input
            aria-label="篩選迄日"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          {(search ||
            status !== "all" ||
            from ||
            to ||
            reasonFilter ||
            placeFilter ||
            personFilter ||
            plateFilter) && (
            <button
              className="text-link"
              onClick={() => {
                setSearch("");
                setStatus(historyMode ? "RETURN_ARRIVED" : "all");
                setReasonFilter("");
                setPlaceFilter("");
                setPersonFilter("");
                setPlateFilter("");
                setFrom("");
                setTo("");
              }}
            >
              清除
            </button>
          )}
        </div>
        <ErrorBox error={bookings.error || resources.error} />
        {bookings.isPending ? (
          <Loading />
        ) : results.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>申請 / 緣由</th>
                  <th>使用資源</th>
                  <th>預約時間</th>
                  <th>申請人</th>
                  <th>狀態</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {results.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.detail_allowed === false ? (
                        <span className="table-title">借用紀錄</span>
                      ) : (
                        <Link className="table-title" to={"/bookings/" + b.id}>
                          {b.content.title}
                        </Link>
                      )}
                      <small className="mono">
                        {b.id} · {kindNames[b.kind]}
                      </small>
                    </td>
                    <td>
                      {b.slots.map((s, i) => (
                        <span className="resource-tag" key={i}>
                          {rs.find((r) => r.id === s.resource_id)?.label ||
                            b.content.resource_snapshots?.find(
                              (r: any) => r.id === s.resource_id,
                            )?.label ||
                            "歷史資源 #" + s.resource_id}
                        </span>
                      ))}
                    </td>
                    <td>
                      {b.slots.map((s, i) => (
                        <div className="time-range" key={i}>
                          <span>{dateTime(s.start)}</span>
                          <small>至 {dateTime(s.end)}</small>
                        </div>
                      ))}
                    </td>
                    <td>
                      <div className="person-cell">
                        <span className="avatar tiny">
                          {b.content.applicant?.slice(0, 1)}
                        </span>
                        {b.content.applicant}
                      </div>
                    </td>
                    <td>
                      <Status status={b.status} />
                    </td>
                    <td>
                      {b.detail_allowed === false ? (
                        <span
                          title="無法修改他人借用紀錄"
                          style={{
                            display: "inline-flex",
                            cursor: "not-allowed",
                          }}
                        >
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="無法修改他人借用紀錄"
                            aria-disabled="true"
                            style={{ cursor: "not-allowed", opacity: 0.45 }}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </span>
                      ) : (
                        <Link
                          className="icon-button"
                          aria-label={"查看 " + b.id}
                          to={"/bookings/" + b.id}
                        >
                          <ChevronRight size={18} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="沒有符合條件的預約"
            description="調整搜尋條件，或建立一筆新的預約。"
          />
        )}
        <div className="table-footer">
          顯示 {results.length} 張申請，共 {bookings.data?.length || 0} 張
          <span>同一申請的多個資源合併顯示</span>
        </div>
      </section>
    </>
  );
}

export function BookingDetail() {
  const { id } = useParams(),
    navigate = useNavigate(),
    location = useLocation(),
    u = useUser();
  const query = useQuery({
      queryKey: ["booking", id],
      queryFn: () => api<Booking>("/bookings/" + id),
    }),
    resources = useQuery({
      queryKey: ["resources"],
      queryFn: () => api<Resource[]>("/resources"),
    });
  const [stage, setStage] = useState(false),
    [deleting, setDeleting] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState("main");
  if (query.isPending) return <Loading />;
  if (query.error || !query.data) return <ErrorBox error={query.error} />;
  const b = query.data,
    c = b.content,
    rs = resources.data || [],
    canEdit =
      can(u, bookingDoc(b.kind), "write") &&
      (b.kind !== "A" || b.status === "PENDING");
  const stages = b.stages || [],
    startMileage = stages.find((s) => s.kind === "B")?.content.start?.mileage,
    endMileage = stages.find((s) => s.kind === "C")?.content.arrival?.mileage,
    mileage =
      startMileage != null && endMileage != null
        ? (Number(endMileage) - Number(startMileage)).toFixed(1)
        : null;
  async function remove() {
    setBusy(true);
    try {
      await api("/bookings/" + id, "DELETE");
      await invalidate();
      navigate("/bookings");
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to="/bookings">
        <ArrowLeft size={16} />
        返回借用紀錄
      </Link>
      <PageHead
        eyebrow={b.id}
        title={c.title}
        description={`${kindNames[b.kind]} · 建立於 ${dateTime(b.created_at)} · 最近更新 ${dateTime(b.updated_at)}`}
        action={
          <div className="heading-actions">
            {canEdit && (
              <button
                className="button"
                onClick={() => navigate("/bookings/" + id + "/edit")}
              >
                <Pencil size={16} />
                編輯
              </button>
            )}
            {can(u, bookingDoc(b.kind), "delete") && (
              <button className="button" onClick={() => setDeleting(true)}>
                <Trash2 size={16} />
                刪除
              </button>
            )}
            {!(b as any).incomplete &&
              can(
                u,
                (
                  {
                    PENDING: "departure_form",
                    DEPARTURE: "departure_arrive",
                    DEPARTURE_ARRIVED: "back_form",
                    RETURN: "back_arrive",
                  } as Record<string, string>
                )[b.status],
                ["DEPARTURE", "RETURN"].includes(b.status) ? "write" : "create",
              ) &&
              b.kind === "A" &&
              nextStates[b.status] && (
                <button
                  className="button primary"
                  onClick={() => setStage(true)}
                  disabled={
                    ["PENDING", "DEPARTURE"].includes(b.status) &&
                    !canFillDeparture(u, b)
                  }
                  title={
                    ["PENDING", "DEPARTURE"].includes(b.status) &&
                    !canFillDeparture(u, b)
                      ? "只能填寫自己的發車表單；代填需要最高管理權限"
                      : undefined
                  }
                >
                  {nextStates[b.status]}
                  <ArrowRight size={16} />
                </button>
              )}
          </div>
        }
      />
      {location.state?.saved && (
        <div className="success">
          <CheckCircle2 size={18} />
          申請已成功保存，編號 {b.id}。
        </div>
      )}
      <ErrorBox
        error={
          error ||
          ((b as any).incomplete
            ? "流程資料不完整：缺少必要 B／C 紀錄，已停止推進。"
            : null)
        }
      />
      {b.kind === "A" && (
        <div className="panel workflow">
          {Object.entries(states).map(([s, label], i) => {
            const current = Object.keys(states).indexOf(b.status);
            return (
              <div key={s} className={i <= current ? "reached" : ""}>
                <span>{i < current ? <Check size={16} /> : i + 1}</span>
                <strong>{label}</strong>
                {i < 4 && <i />}
              </div>
            );
          })}
        </div>
      )}
      <div className="detail-layout">
        <section className="panel">
          <div className="list-tabs">
            <button
              className={tab === "main" ? "active" : ""}
              onClick={() => setTab("main")}
            >
              申請內容
            </button>
            {stages.map((s) => (
              <button
                key={s.id}
                className={tab === s.id ? "active" : ""}
                onClick={() => setTab(s.id)}
              >
                {s.kind === "B" ? "發車與抵達" : "還車與抵達"}
              </button>
            ))}
            <button
              className={tab === "versions" ? "active" : ""}
              onClick={() => setTab("versions")}
            >
              修訂版本
            </button>
          </div>
          <div className="detail-content">
            {tab === "main" ? (
              <>
                <div className="detail-top">
                  <h2>基本資訊</h2>
                  <Status status={b.status} />
                </div>
                <div className="summary-grid three">
                  <div>
                    <small>申請人</small>
                    <strong>{c.applicant}</strong>
                  </div>
                  <div>
                    <small>使用需求</small>
                    <strong>{c.reason}</strong>
                  </div>
                  <div>
                    <small>總使用人數</small>
                    <strong>
                      {b.kind === "D" ? "—" : c.total_people + " 人"}
                    </strong>
                  </div>
                  <div>
                    <small>使用人員</small>
                    <strong>{c.employees?.join("、") || "—"}</strong>
                  </div>
                  <div>
                    <small>申請日期</small>
                    <strong>{c.application_date}</strong>
                  </div>
                  <div>
                    <small>總借用里程</small>
                    <strong>
                      {mileage === null
                        ? "N/A"
                        : Number(mileage) < 0
                          ? "資料異常"
                          : mileage + " km"}
                    </strong>
                  </div>
                </div>
                <h3 className="detail-section-title">使用需求明細</h3>
                {c.details?.map((d: any, i: number) => (
                  <div className="review-detail" key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{d.name || "—"}</strong>
                      <small>
                        {d.city} {d.district}
                        {d.leader ? " · 組長 " + d.leader : ""}
                        {d.sales?.length ? " · 業務 " + d.sales.join("、") : ""}
                      </small>
                      {d.notes && <p>{d.notes}</p>}
                      {d.notes2 && <p>{d.notes2}</p>}
                    </div>
                  </div>
                ))}
                <h3 className="detail-section-title">資源與預約時段</h3>
                {b.slots.map((s, i) => (
                  <div className="slot-summary" key={i}>
                    <strong>
                      {rs.find((r) => r.id === s.resource_id)?.label ||
                        b.content.resource_snapshots?.find(
                          (r: any) => r.id === s.resource_id,
                        )?.label ||
                        "歷史資源 #" + s.resource_id}
                    </strong>
                    <span>
                      {dateTime(s.start)} → {dateTime(s.end)}
                    </span>
                    {b.kind === "A" && (
                      <Link
                        className="text-link"
                        to={
                          "/positions?resource=" +
                          s.resource_id +
                          "&start=" +
                          encodeURIComponent(s.start) +
                          "&end=" +
                          encodeURIComponent(s.end)
                        }
                      >
                        查看軌跡
                        <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                ))}
                <h3 className="detail-section-title">用途與補充資訊</h3>
                <div className="tags">
                  {c.purposes?.map((p: string) => (
                    <span key={p} className="resource-tag">
                      {p}
                    </span>
                  ))}
                </div>
                {c.other_purpose && <p>其他用途：{c.other_purpose}</p>}
                {c.other_processing && <p>其他加工：{c.other_processing}</p>}
                {"notes" in c && (
                  <p className="preserve-lines muted">
                    {c.notes || "未填寫補充資訊"}
                  </p>
                )}
                {b.previous_id && (
                  <details>
                    <summary>此申請取代 {b.previous_id}，查看舊版</summary>
                    <pre>
                      {JSON.stringify(
                        (b as any).previous_version?.content,
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                )}
              </>
            ) : tab === "versions" ? (
              <>
                {b.versions?.length ? (
                  b.versions.map((v) => (
                    <details className="version" key={v.id}>
                      <summary>
                        {dateTime(v.time)} · {v.actor}
                        <ChevronDown size={16} />
                      </summary>
                      <pre>{JSON.stringify(v.data, null, 2)}</pre>
                    </details>
                  ))
                ) : (
                  <Empty
                    title="尚無修訂版本"
                    description="表單修改或流程更新前會保存原始內容。"
                  />
                )}
              </>
            ) : (
              <>
                <Link className="button" to={"/stages/" + tab}>
                  查看／修正此階段
                </Link>
                <StageView stage={stages.find((s) => s.id === tab)} />
              </>
            )}
          </div>
        </section>
        <aside>
          <div className="panel timeline-panel">
            <div className="section-title">
              <h3>操作歷程</h3>
              <History size={18} />
            </div>
            <div className="timeline">
              {b.history?.map((h, i) => (
                <div key={i}>
                  <i />
                  <strong>{h.action}</strong>
                  <span>{h.actor}</span>
                  <small>{dateTime(h.time)}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="tip-card">
            <h3>資料持續保留</h3>
            <p>
              此預覽版本的申請、流程與附件會保存至伺服器，重新整理後仍可查看。
            </p>
          </div>
        </aside>
      </div>
      <StageForm open={stage} close={() => setStage(false)} booking={b} />
      <Confirm
        open={deleting}
        title="刪除這張預約？"
        description={`將取消 ${b.id}「${c.title}」並釋放全部資源時段。歷史資料會保留。`}
        onClose={() => setDeleting(false)}
        onConfirm={remove}
        busy={busy}
      />
    </>
  );
}
