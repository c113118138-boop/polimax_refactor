import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Filter, Search, Pencil, Trash2 } from "lucide-react";
import {
  api,
  Booking,
  businessDate,
  localDate,
  localInput,
  invalidate,
} from "./api";
import { useUser } from "./App";
import { can, canFillDeparture, bookingDoc } from "./Access";
import { Confirm, ErrorBox, Loading, Modal, PageHead } from "./ui";
import { SourceStageDialog } from "./SourceEditors";
import { StageForm } from "./Stages";
import "./queries.css";

const stageTime = (s: any) =>
  s.content?.start?.submitted_at || s.created_at || "";

export default function StageQueries() {
  const [params] = useSearchParams(),
    kind = params.get("kind") === "C" ? "C" : "B",
    user = useUser();
  const [filter, setFilter] = useState("all"),
    [text, setText] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [editor, setEditor] = useState<{
      id: string;
      editing?: boolean;
    } | null>(null),
    [deleting, setDeleting] = useState<any>(null),
    [adding, setAdding] = useState(false),
    [parentId, setParentId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["stages", kind],
    queryFn: () => api<any[]>("/stages?kind=" + kind),
  });
  const parents = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api<Booking[]>("/bookings"),
    enabled: adding,
  });
  const rows = (q.data || []).filter((s) => {
    const d = s.content?.start || {},
      stamp = stageTime(s);
    if (filter === "date") {
      const date = stamp ? localDate(businessDate(stamp)) : "";
      return (!from || date >= from) && (!to || date <= to);
    }
    if (filter === "plate" || filter === "driver")
      return String(d[filter] || "")
        .toLowerCase()
        .includes(text.trim().toLowerCase());
    return true;
  });
  const action = (s: any, op: string) =>
    s.detail_allowed !== false &&
    can(user, bookingDoc(kind), op) &&
    (kind !== "B" || canFillDeparture(user, { owner: s.applicant_owner }));
  function clear() {
    setFilter("all");
    setText("");
    setFrom("");
    setTo("");
  }
  return (
    <section className={"source-query source-query-stage source-query-" + kind}>
      <PageHead
        eyebrow="WORKFLOW RECORDS"
        title={kind === "B" ? "發車紀錄" : "還車紀錄"}
        description="依父單關聯查詢有效 B／C；舊版本保留在個別紀錄。"
      />
      <div className="query-heading">
        <h2>
          {kind === "B" ? "發車紀錄" : "還車紀錄"}（共 {rows.length} 筆
          {rows.length !== (q.data?.length || 0)
            ? ` / 總共 ${q.data?.length || 0} 筆`
            : ""}
          ）
        </h2>
        {can(user, bookingDoc(kind), "create") && (
          <button className="query-add" onClick={() => setAdding(true)}>
            新增
          </button>
        )}
      </div>
      <div className="query-filters">
        <div className="query-filter-label">
          <Filter size={24} />
          <strong>篩選條件</strong>
        </div>
        <div className="query-filter-controls">
          <select
            aria-label="篩選條件"
            value={filter}
            onChange={(e) => {
              clear();
              setFilter(e.target.value);
            }}
          >
            {[
              ["all", "全部顯示"],
              ["date", "依日期"],
              ["plate", "依車牌"],
              ["driver", "依駕駛人"],
            ].map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
          {filter === "date" ? (
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
          ) : (
            filter !== "all" && (
              <input
                className="query-text-filter"
                aria-label={filter === "plate" ? "依車牌" : "依駕駛人"}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            )
          )}{" "}
          {filter !== "all" && (
            <button className="query-clear" onClick={clear}>
              清除
            </button>
          )}
        </div>
      </div>
      <ErrorBox error={error || q.error} />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <button className="button" onClick={() => q.refetch()}>
          重試
        </button>
      ) : (
        <div
          className="query-table-scroll"
          role="region"
          aria-label="階段查詢結果"
          tabIndex={0}
        >
          <table className="query-table">
            <thead>
              <tr>
                {["表單編號", "日期", "駕駛人", "車牌", "操作"].map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} data-stage-id={s.id}>
                  <td>
                    {s.detail_allowed === false ? (
                      s.id
                    ) : (
                      <Link
                        to={"/stages/" + s.id}
                        onClick={(e) => {
                          if (!e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            setEditor({ id: s.id });
                          }
                        }}
                      >
                        {s.id}
                      </Link>
                    )}
                  </td>
                  <td>
                    {stageTime(s)
                      ? localInput(stageTime(s)).replace("T", " ").slice(0, 16)
                      : "—"}
                  </td>
                  <td>{s.content?.start?.driver}</td>
                  <td>{s.content?.start?.plate}</td>
                  <td>
                    <div className="query-actions">
                      {s.detail_allowed !== false && (
                        <button
                          title="查看"
                          aria-label="查看"
                          onClick={() => setEditor({ id: s.id })}
                        >
                          <Search size={22} />
                        </button>
                      )}
                      {action(s, "write") && (
                        <button
                          className="query-edit"
                          title="編輯"
                          aria-label="編輯"
                          onClick={() => setEditor({ id: s.id, editing: true })}
                        >
                          <Pencil size={22} />
                        </button>
                      )}
                      {action(s, "delete") && (
                        <button
                          className="query-delete"
                          title="刪除"
                          aria-label="刪除"
                          onClick={() => setDeleting(s)}
                        >
                          <Trash2 size={22} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="query-empty">
                    {filter === "all" ? "暫無資料" : "沒有符合篩選條件的資料"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {editor && (
        <SourceStageDialog {...editor} close={() => setEditor(null)} />
      )}
      <Confirm
        open={!!deleting}
        title="刪除階段紀錄？"
        description={`確定要刪除 ${deleting?.id} 嗎？父單會標示資料不完整並停止推進。`}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api("/stages/" + deleting.id, "DELETE");
            await invalidate();
            setDeleting(null);
          } catch (e) {
            setError((e as Error).message);
            setDeleting(null);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Modal
        open={adding && !parentId}
        title={kind === "B" ? "新增發車紀錄" : "新增還車紀錄"}
        onClose={() => setAdding(false)}
      >
        <p>選擇對應的車輛借用申請。</p>
        <ErrorBox error={parents.error} />
        {parents.isPending ? (
          <Loading />
        ) : (
          <div className="source-parent-list">
            {(parents.data || [])
              .filter(
                (b) =>
                  b.kind === "A" &&
                  b.detail_allowed !== false &&
                  b.status ===
                    (kind === "B" ? "PENDING" : "DEPARTURE_ARRIVED") &&
                  (kind !== "B" || canFillDeparture(user, b)),
              )
              .map((b) => (
                <button
                  className="button"
                  key={b.id}
                  onClick={() => setParentId(b.id)}
                >
                  {b.id} · {b.content.reason}
                </button>
              ))}
            {!(parents.data || []).some(
              (b) =>
                b.kind === "A" &&
                b.detail_allowed !== false &&
                b.status === (kind === "B" ? "PENDING" : "DEPARTURE_ARRIVED") &&
                (kind !== "B" || canFillDeparture(user, b)),
            ) && <p>目前沒有可新增此階段的申請。</p>}
          </div>
        )}
      </Modal>
      {parentId && (
        <NewStage
          id={parentId}
          close={() => {
            setParentId("");
            setAdding(false);
          }}
        />
      )}
    </section>
  );
}
function NewStage({ id, close }: { id: string; close: () => void }) {
  const q = useQuery({
    queryKey: ["booking", id],
    queryFn: () => api<Booking>("/bookings/" + id),
    staleTime: 0,
  });
  return q.data ? (
    <StageForm open booking={q.data} close={close} />
  ) : (
    <Modal open title="載入申請" onClose={close}>
      <ErrorBox error={q.error} />
      {q.isPending && <Loading />}
    </Modal>
  );
}
