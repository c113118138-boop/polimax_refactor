import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  FileText,
  Filter,
  MapPin,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  api,
  Booking,
  Resource,
  businessDate,
  invalidate,
  localDate,
  localInput,
  nextStates,
  states,
} from "./api";
import { useUser } from "./App";
import { bookingDoc, can, canFillDeparture } from "./Access";
import { Confirm, ErrorBox, Loading } from "./ui";
import { SourceBookingDialog, SourceStageDialog } from "./SourceEditors";
import { PageHead } from "./ui";
import { StageForm } from "./Stages";

const categories = [
  "工案",
  "材料送貨",
  "新開發案",
  "客戶拜訪",
  "成交案回訪",
  "參展",
  "其他",
];
const queryStates: Record<string, string> = {
  PENDING: "預約單已提交",
  DEPARTURE: "發車單已提交",
  DEPARTURE_ARRIVED: "發車已抵達",
  RETURN: "還車單已提交",
  RETURN_ARRIVED: "已完成",
};
const vehicleColumns = [
  "表單編號",
  "車牌",
  "申請緣由",
  "地點",
  "開始時間",
  "結束時間",
  "業務人員",
  "申請人",
  "狀態",
  "申請時間",
  "操作",
];
const roomColumns = [
  "表單編號",
  "申請原因",
  "使用空間",
  "開始時間",
  "結束時間",
  "申請人",
  "建立時間",
  "操作",
];
const equipmentColumns = [
  "表單編號",
  "借用類別",
  "儀器設備",
  "開始時間",
  "結束時間",
  "使用人員",
  "申請人",
  "狀態",
  "建立時間",
  "操作",
];
const filterOptions = [
  ["all", "全部顯示"],
  ["start", "依開始時間"],
  ["end", "依結束時間"],
  ["created_at", "依申請時間"],
  ["plate", "依車牌"],
  ["reason", "依申請緣由"],
  ["place", "依地點"],
  ["employees", "依業務人員"],
  ["applicant", "依申請人"],
  ["status", "依狀態"],
];
type QueryRow = {
  booking: Booking;
  index: number;
  resourceId?: number;
  plate: string;
  reason: string;
  place: string;
  start: string;
  end: string;
  employees: string;
  applicant: string;
  created_at: string;
};
const text = (value: unknown): string =>
  Array.isArray(value)
    ? value.map(text).filter(Boolean).join(", ")
    : value == null
      ? ""
      : String(value);
const stamp = (value: string) =>
  value && !Number.isNaN(businessDate(value).getTime())
    ? localInput(value).replace("T", " ")
    : "";

function expand(booking: Booking, resources: Resource[]): QueryRow[] {
  const c = booking.content || {};
  // Occupancies retain API order; detail_index belongs to the saved form slots.
  const slots = booking.slots.length ? booking.slots : [undefined];
  return slots.map((slot, index) => {
    const detail =
      c.details?.[
        c.slots?.[index]?.detail_index ??
          Math.min(index, Math.max(0, (c.details?.length || 0) - 1))
      ] || {};
    const resource =
      resources.find((r) => r.id === slot?.resource_id) ||
      c.resource_snapshots?.find((r: Resource) => r.id === slot?.resource_id);
    return {
      booking,
      index,
      resourceId: slot?.resource_id,
      plate: resource?.label || (slot ? `資源 #${slot.resource_id}` : ""),
      reason: text(c.reason),
      place:
        booking.kind === "D"
          ? text(resource?.label || c.place)
          : booking.kind === "E"
            ? text(resource?.name || resource?.label)
            : text(
                [detail.city || c.city, detail.district || c.district]
                  .filter(Boolean)
                  .join("") ||
                  detail.place ||
                  c.place,
              ),
      start: slot?.start || "",
      end: slot?.end || "",
      employees: text(
        booking.kind === "E"
          ? c.employees
          : detail.sales?.length
            ? detail.sales
            : c.employees,
      ),
      applicant: text(c.applicant),
      created_at: booking.created_at,
    };
  });
}

function permitted(
  user: any,
  booking: Booking,
  doc: string,
  operation: string,
) {
  return (
    booking.detail_allowed !== false &&
    can(user, doc, operation) &&
    (!user.permissions?.owner_only?.[doc]?.[operation] ||
      canFillDeparture({ ...user, permissions: { roles: [] } }, booking))
  );
}
function stagePermission(user: any, booking: Booking) {
  const doc = (
    {
      PENDING: "departure_form",
      DEPARTURE: "departure_arrive",
      DEPARTURE_ARRIVED: "back_form",
      RETURN: "back_arrive",
    } as Record<string, string>
  )[booking.status];
  const operation = ["DEPARTURE", "RETURN"].includes(booking.status)
    ? "write"
    : "create";
  return (
    !!doc &&
    permitted(user, booking, doc, operation) &&
    (!["PENDING", "DEPARTURE"].includes(booking.status) ||
      canFillDeparture(user, booking))
  );
}

// Fetch a current revision before opening the existing B/C editor.
function QueryStage({ id, close }: { id: string; close: () => void }) {
  const user = useUser();
  const query = useQuery({
    queryKey: ["booking", id],
    queryFn: () => api<Booking>("/bookings/" + id),
    staleTime: 0,
  });
  if (query.isPending || query.isFetching)
    return (
      <div className="query-stage-loading">
        <Loading />
      </div>
    );
  if (query.error || !query.data || !stagePermission(user, query.data))
    return (
      <div className="query-stage-error" role="alert">
        <ErrorBox
          error={query.error || "此筆紀錄目前無可操作的下一階段，請重新整理。"}
        />
        <button className="button" onClick={close}>
          關閉
        </button>
      </div>
    );
  return <StageForm open booking={query.data} close={close} />;
}

export function BookingQueryPage({
  kind,
  history = false,
}: {
  kind: "A" | "D" | "E";
  history?: boolean;
}) {
  const user = useUser();
  const [params] = useSearchParams();
  const resourceId = Number(params.get("resource")) || 0;
  const [filterType, setFilterType] = useState("all"),
    [value, setValue] = useState("");
  const [status, setStatus] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [deleting, setDeleting] = useState<Booking | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [stageId, setStageId] = useState("");
  const [editor, setEditor] = useState<{
    id: string;
    stage?: boolean;
    editing?: boolean;
  } | null>(null);
  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api<Booking[]>("/bookings"),
  });
  const resources = useQuery({
    queryKey: ["resources"],
    queryFn: () => api<Resource[]>("/resources"),
  });
  const allRows = (bookings.data || [])
    .filter(
      (b) => b.kind === kind && (!history || b.status === "RETURN_ARRIVED"),
    )
    .flatMap((b) => expand(b, resources.data || []));
  const dateFilter = ["start", "end", "created_at"].includes(filterType);
  const activeFilter = filterType !== "all" || status !== "all";
  const rows = allRows.filter((row) => {
    if (resourceId && row.resourceId !== resourceId) return false;
    if (kind !== "A") return true;
    if (status !== "all" && row.booking.status !== status) return false;
    if (dateFilter && (from || to)) {
      const date = businessDate(
        row[filterType as "start" | "end" | "created_at"],
      );
      if (Number.isNaN(date.getTime())) return false;
      const day = localDate(date);
      if ((from && day < from) || (to && day > to)) return false;
    }
    if (filterType === "reason" && value === "其他")
      return !categories.slice(0, 6).some((c) => row.reason.includes(c));
    if (
      ["plate", "reason", "place", "employees", "applicant"].includes(
        filterType,
      ) &&
      value.trim()
    )
      return row[
        filterType as "plate" | "reason" | "place" | "employees" | "applicant"
      ]
        .toLowerCase()
        .includes(value.trim().toLowerCase());
    return true;
  });
  const groups = new Map<string, QueryRow[]>();
  rows.forEach((row) =>
    groups.set(row.booking.id, [...(groups.get(row.booking.id) || []), row]),
  );
  const total =
    kind === "A"
      ? new Set(allRows.map((row) => row.booking.id)).size
      : allRows.length;
  const count = kind === "A" ? groups.size : rows.length;
  const resourceLabel =
    resources.data?.find((r) => r.id === resourceId)?.label ||
    allRows.find((row) => row.resourceId === resourceId)?.plate ||
    `資源 #${resourceId}`;
  const columns = history
    ? [
        ...vehicleColumns.filter((c) => c !== "狀態" && c !== "操作"),
        "總里程數",
        "操作",
      ]
    : kind === "A"
      ? vehicleColumns
      : kind === "D"
        ? roomColumns
        : equipmentColumns;
  function clear() {
    setFilterType("all");
    setValue("");
    setStatus("all");
    setFrom("");
    setTo("");
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/bookings/" + deleting.id, "DELETE");
      await invalidate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }
  function actions(booking: Booking, first: QueryRow) {
    if (booking.detail_allowed === false)
      return <span className="query-restricted">無法查看他人借用紀錄</span>;
    if (history)
      return <HistoryActions booking={booking} row={first} open={setEditor} />;
    const doc = bookingDoc(kind);
    return (
      <div className="query-actions">
        {kind !== "A" && (
          <Link
            to={"/bookings/" + booking.id}
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                setEditor({ id: booking.id });
              }
            }}
            title="查看"
            aria-label="查看"
          >
            <Search size={22} />
          </Link>
        )}
        {permitted(user, booking, doc, "write") &&
          (kind !== "A" || booking.status === "PENDING") && (
            <Link
              className="query-edit"
              to={"/bookings/" + booking.id + "/edit"}
              onClick={(e) => {
                if (!e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  setEditor({ id: booking.id, editing: true });
                }
              }}
              title="編輯"
              aria-label="編輯"
            >
              <Pencil size={22} />
            </Link>
          )}
        {permitted(user, booking, doc, "delete") && (
          <button
            className="query-delete"
            title="刪除"
            aria-label="刪除"
            onClick={() => {
              setError("");
              setDeleting(booking);
            }}
          >
            <Trash2 size={22} />
          </button>
        )}
        {kind === "A" &&
          nextStates[booking.status] &&
          stagePermission(user, booking) && (
            <button
              className="query-next"
              title={nextStates[booking.status]}
              aria-label={nextStates[booking.status]}
              onClick={() => setStageId(booking.id)}
            >
              <ArrowRight size={22} />
            </button>
          )}
        {kind === "A" &&
          can(user, "CarUpdate", "read") &&
          can(user, "carMap", "read") && (
            <Link
              className="query-map"
              to={
                "/positions?view=history&resource=" +
                (first.resourceId || "") +
                "&start=" +
                encodeURIComponent(first.start) +
                "&end=" +
                encodeURIComponent(first.end)
              }
              title="查看行駛軌跡"
              aria-label="查看行駛軌跡"
            >
              <MapPin size={22} />
            </Link>
          )}
      </div>
    );
  }
  return (
    <section
      className={`source-query source-query-${history ? "history" : kind}`}
      aria-label={
        history
          ? "車輛使用歷史"
          : kind === "A"
            ? "車輛使用查詢"
            : kind === "D"
              ? "作業區使用查詢"
              : "儀器使用查詢"
      }
    >
      {history && (
        <PageHead
          eyebrow="RESERVATIONS & RECORDS"
          title="車輛使用歷史"
          description="每一次預約與使用，都有清楚的來龍去脈。"
        />
      )}
      <div className="query-heading">
        {kind === "A" &&
          resourceId > 0 &&
          can(user, "VehicleManagement", "read") && (
            <Link className="query-back" to={"/vehicles/" + resourceId}>
              <ArrowLeft size={16} />
              返回車輛管理
            </Link>
          )}
        <h2>
          {history
            ? `歷史紀錄（共 ${count} 筆`
            : kind === "A"
              ? resourceId
                ? `車輛使用紀錄 - ${resourceLabel} （共 ${count} 筆`
                : `借用紀錄表（共 ${count} 筆`
              : kind === "D"
                ? `作業區預約紀錄（共 ${count} 筆`
                : `儀器借用紀錄（共 ${count} 筆`}
          {count !== total ? ` / 總共 ${total} 筆` : ""}）
        </h2>
        {kind !== "A" && can(user, bookingDoc(kind), "create") && (
          <Link className="query-add" to={"/bookings/new/" + kind}>
            新增
          </Link>
        )}
      </div>
      {kind === "A" && resourceId > 0 && (
        <div className="query-source-hint">
          <CarFront size={24} />
          <span>正在顯示車牌「{resourceLabel}」的使用紀錄</span>
        </div>
      )}
      {kind === "A" && (
        <div className="query-filters">
          <div className="query-filter-label">
            <Filter size={24} />
            <strong>篩選條件</strong>
          </div>
          <div className="query-filter-controls">
            <select
              aria-label="篩選條件"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setValue("");
                setFrom("");
                setTo("");
                if (e.target.value === "status") setStatus("all");
              }}
            >
              {filterOptions
                .filter(([v]) => !history || v !== "status")
                .map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
            </select>
            {!history && filterType !== "status" && (
              <div className="query-status-filters" aria-label="狀態快速篩選">
                {Object.entries(queryStates).map(([v, label]) => (
                  <button
                    key={v}
                    className={`query-chip query-state-${v} ${status === v ? "selected" : ""}`}
                    aria-pressed={status === v}
                    onClick={() => {
                      setStatus(v);
                      setFilterType("all");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {filterType === "status" && (
              <select
                aria-label="狀態篩選"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">全部狀態</option>
                {Object.entries(queryStates).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            {dateFilter && (
              <div className="query-date-range">
                <input
                  aria-label="開始日期"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
                <span>至</span>
                <input
                  aria-label="結束日期"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            )}
            {filterType === "reason" && (
              <select
                aria-label="緣由篩選"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              >
                <option value="">全部類型</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
            {["plate", "place", "employees", "applicant"].includes(
              filterType,
            ) && (
              <input
                className="query-text-filter"
                aria-label={filterOptions.find(([v]) => v === filterType)?.[1]}
                placeholder="搜尋..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
            {activeFilter && (
              <button className="query-clear" onClick={clear}>
                <X size={16} />
                清除
              </button>
            )}
          </div>
          {activeFilter && (
            <div
              className={`query-filter-result ${!count ? "no-match" : ""}`}
              role="status"
            >
              {count
                ? `找到 ${count} 筆符合條件的記錄${status !== "all" ? ` (狀態: ${queryStates[status]})` : ""}`
                : "沒有符合條件的記錄"}
            </div>
          )}
        </div>
      )}
      <ErrorBox error={error || bookings.error || resources.error} />
      {(bookings.error || resources.error) && (
        <button
          className="button"
          onClick={() => {
            if (bookings.error) void bookings.refetch();
            if (resources.error) void resources.refetch();
          }}
        >
          重試
        </button>
      )}
      {bookings.isPending ? (
        <Loading />
      ) : (
        !bookings.error && (
          <div
            className="query-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="查詢結果表格"
          >
            <table className="query-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...groups.values()].flatMap((group) =>
                  group.map((row, i) => (
                    <tr
                      key={row.booking.id + ":" + row.index}
                      data-booking-id={row.booking.id}
                    >
                      {i === 0 && (
                        <td rowSpan={group.length} className="query-id">
                          {row.booking.detail_allowed === false ? (
                            row.booking.id
                          ) : (
                            <Link
                              to={"/bookings/" + row.booking.id}
                              onClick={(e) => {
                                if (!e.ctrlKey && !e.metaKey) {
                                  e.preventDefault();
                                  setEditor({ id: row.booking.id });
                                }
                              }}
                            >
                              {row.booking.id}
                            </Link>
                          )}
                        </td>
                      )}
                      {kind === "A" && <td>{row.plate}</td>}
                      <td>{row.reason}</td>
                      <td>
                        {row.place || (kind === "E" ? row.plate : "")}
                        {kind === "E" &&
                          row.place &&
                          row.place !== row.plate && (
                            <small className="query-equipment-code">
                              {row.plate}
                            </small>
                          )}
                      </td>
                      <td>{stamp(row.start)}</td>
                      <td>{stamp(row.end)}</td>
                      {kind !== "D" && <td>{row.employees}</td>}
                      <td>{row.applicant}</td>
                      {kind === "A" && !history && i === 0 && (
                        <td rowSpan={group.length}>
                          <span
                            className={`query-status query-state-${row.booking.status}`}
                          >
                            {queryStates[row.booking.status] ||
                              row.booking.status}
                          </span>
                        </td>
                      )}
                      {kind === "E" && i === 0 && (
                        <td rowSpan={group.length}>
                          <span
                            className={`query-status query-state-${row.booking.status}`}
                          >
                            {states[row.booking.status] || row.booking.status}
                          </span>
                        </td>
                      )}
                      <td>{stamp(row.created_at)}</td>
                      {history && i === 0 && (
                        <td rowSpan={group.length}>
                          <HistoryMileage booking={row.booking} />
                        </td>
                      )}
                      {i === 0 && (
                        <td
                          rowSpan={group.length}
                          className="query-action-cell"
                        >
                          {actions(row.booking, group[0])}
                        </td>
                      )}
                    </tr>
                  )),
                )}
                {!rows.length && (
                  <tr>
                    <td className="query-empty" colSpan={columns.length}>
                      {activeFilter || resourceId
                        ? "沒有符合篩選條件的資料"
                        : "暫無資料"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}
      <Confirm
        open={!!deleting}
        title={
          kind === "A"
            ? "刪除借用紀錄"
            : kind === "D"
              ? "刪除作業區預約"
              : "刪除儀器借用紀錄"
        }
        description={`確定要刪除 ${deleting?.id || ""} 嗎？相關預約與流程紀錄將一併移除。`}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
      />
      {editor &&
        (editor.stage ? (
          <SourceStageDialog
            id={editor.id}
            editing={editor.editing}
            close={() => setEditor(null)}
          />
        ) : (
          <SourceBookingDialog
            id={editor.id}
            editing={editor.editing}
            close={() => setEditor(null)}
          />
        ))}
      {stageId && <QueryStage id={stageId} close={() => setStageId("")} />}
    </section>
  );
}

function useHistoryBooking(booking: Booking) {
  return useQuery({
    queryKey: ["booking", booking.id],
    queryFn: () => api<Booking>("/bookings/" + booking.id),
    enabled: booking.detail_allowed !== false,
  });
}
function HistoryMileage({ booking }: { booking: Booking }) {
  const q = useHistoryBooking(booking);
  if (booking.detail_allowed === false) return <>—</>;
  if (q.isPending) return <>計算中…</>;
  if (q.error)
    return (
      <span title={String(q.error)}>
        無法取得里程{" "}
        <button className="button compact" onClick={() => q.refetch()}>
          重試
        </button>
      </span>
    );
  const stages = q.data?.stages || [],
    first = stages.find((s) => s.kind === "B")?.content.start?.mileage,
    last = stages.find((s) => s.kind === "C")?.content.arrival?.mileage;
  const valid =
    first != null &&
    first !== "" &&
    last != null &&
    last !== "" &&
    Number.isFinite(Number(first)) &&
    Number.isFinite(Number(last)) &&
    Number(last) >= Number(first);
  return (
    <>
      {valid
        ? `${Math.round((Number(last) - Number(first)) * 10) / 10} km`
        : "紀錄不完整"}
    </>
  );
}
function HistoryActions({
  booking,
  row,
  open,
}: {
  booking: Booking;
  row: QueryRow;
  open: (e: { id: string; stage?: boolean }) => void;
}) {
  const user = useUser(),
    q = useHistoryBooking(booking);
  const stages = q.data?.stages || [];
  return (
    <div className="query-actions">
      <button
        className="query-view"
        aria-label="查看主表單"
        title="查看主表單"
        onClick={() => open({ id: booking.id })}
      >
        <FileText size={22} />
      </button>
      {(
        [
          ["B", "查看發車記錄", "query-departure"],
          ["C", "查看還車記錄", "query-return"],
        ] as const
      ).map(
        ([kind, label, cls]) =>
          can(user, bookingDoc(kind)) && (
            <button
              key={kind}
              className={cls}
              aria-label={label}
              title={label}
              disabled={!stages.some((s) => s.kind === kind)}
              onClick={() =>
                open({
                  id: stages.find((s) => s.kind === kind).id,
                  stage: true,
                })
              }
            >
              {kind === "B" ? <CarFront size={22} /> : <ArrowLeft size={22} />}
            </button>
          ),
      )}
      {can(user, "carMap") && can(user, "CarUpdate") && (
        <Link
          className="query-history-map"
          title="查看地圖軌跡"
          aria-label="查看地圖軌跡"
          to={
            "/positions?view=history&resource=" +
            (row.resourceId || "") +
            "&start=" +
            encodeURIComponent(row.start) +
            "&end=" +
            encodeURIComponent(row.end)
          }
        >
          <MapPin size={22} />
        </Link>
      )}
    </div>
  );
}
