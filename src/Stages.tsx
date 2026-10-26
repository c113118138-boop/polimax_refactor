import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  api,
  Booking,
  Resource,
  dateTime,
  localDate,
  nextStates,
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
} from "./ui";
import { can, canFillDeparture, bookingDoc, Scope } from "./Access";
import { useUser } from "./App";
import { useUnsavedChanges } from "./NavigationGuard";
const checksB = [
  "擋風玻璃清潔",
  "照後鏡清潔",
  "油量檢查",
  "輪胎檢查",
  "車輛內部清潔",
  "車體外部檢查",
  "隨車設備檢查",
];
const checksC = [
  "車輛內部清潔",
  "車輛內部物品歸位",
  "車輛鑰匙歸位",
  "油量檢查",
  "車體外部檢查",
  "隨車設備檢查",
];
const photoFields = [
  ["interior_files", "車輛內部照片"],
  ["exterior_files", "車體外部異狀照片"],
  ["equipment_files", "設備異狀照片"],
  ["parking_files", "車輛停放地照片"],
];
const initial = () => ({
  driver: "",
  codriver: "",
  employees: [],
  place: "",
  mileage: "",
  confirmed: false,
  checks: [],
  anomalies: [],
  anomaly_details: {},
  attachments: [],
  notes: "",
  tires: "正常",
  interior: "正常",
  exterior: "正常",
  equipment: "正常",
  interior_files: [],
  exterior_files: [],
  equipment_files: [],
  parking_files: [],
});
import StageQueries from "./StageQueries";
import { PartEditor } from "./StageFields";
export function StageView({ stage }: { stage: any }) {
  const resources = useQuery({
    queryKey: ["resources"],
    queryFn: () => api<Resource[]>("/resources"),
  });
  if (!stage) return null;
  return (
    <Scope doc={bookingDoc(stage.kind)}>
      <span className="mono">
        {stage.id} · 父單 {stage.parent_id}
      </span>
      <fieldset
        disabled
        className="source-readonly-fieldset source-readonly-form"
      >
        {["start", "arrival"].map((part) => (
          <section className="stage-view" key={part}>
            <h3>{part === "start" ? "出發紀錄" : "抵達紀錄"}</h3>
            {stage.content[part] ? (
              <PartEditor
                data={stage.content[part]}
                set={() => {}}
                kind={stage.kind}
                part={part}
                resources={resources.data || []}
                readOnly
              />
            ) : (
              <p>尚未填寫抵達紀錄。</p>
            )}
          </section>
        ))}
      </fieldset>
    </Scope>
  );
}

export function StageForm({
  open,
  close,
  booking: b,
}: {
  open: boolean;
  close: () => void;
  booking: Booking;
}) {
  const u = useUser();
  const kind = ["PENDING", "DEPARTURE"].includes(b.status) ? "B" : "C",
    part = ["PENDING", "DEPARTURE_ARRIVED"].includes(b.status)
      ? "start"
      : "arrival";
  const [data, setData] = useState<any>(initial()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [uploads, setUploads] = useState<Record<string, boolean>>({}),
    [draftMessage, setDraftMessage] = useState(""),
    [baseline, setBaseline] = useState("");
  const uploading = Object.values(uploads).some(Boolean);
  const leaveGuard = useUnsavedChanges({
    active: open,
    dirty: JSON.stringify(data) !== baseline,
    busy: busy || uploading,
  });
  const requestClose = () => leaveGuard.requestClose(close);
  const draftKey = `polimax-stage-draft:${u.id}:${b.id}:${b.status}:${b.revision}`;
  const resources = useQuery({
    queryKey: ["resources"],
    queryFn: () => api<Resource[]>("/resources"),
  });
  useEffect(() => {
    if (open) {
      const preferred = Number(
        new URLSearchParams(location.search).get("resource"),
      );
      const ids = Array.from(new Set(b.slots.map((s) => s.resource_id)));
      let startingData: any = {
        ...initial(),
        driver: u.name,
        codriver:
          b.content.employees?.find((name: string) => name !== u.name) || "",
        employees: [
          u.name,
          ...(b.content.employees || [])
            .filter((name: string) => name !== u.name)
            .slice(0, 1),
        ],
        resource_id: ids.includes(preferred)
          ? preferred
          : ids.length === 1
            ? ids[0]
            : undefined,
      };
      setError("");
      setDraftMessage("");
      try {
        const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null");
        if (draft?.content && Date.now() - draft.saved < 24 * 60 * 60 * 1000) {
          startingData = draft.content;
          setDraftMessage("已載入此分頁的草稿，尚未提交。");
        }
      } catch {
        /* Storage is optional; it never blocks the form. */
      }
      setData(startingData);
      setBaseline(JSON.stringify(startingData));
    }
  }, [open, b.id, b.status, b.revision]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) {
      setError("請等候檔案上傳完成後再提交。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/bookings/" + b.id + "/advance", "POST", {
        expected_status: b.status,
        revision: b.revision,
        content: data,
      });
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        /* Optional local draft. */
      }
      leaveGuard.release();
      await invalidate();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      title={nextStates[b.status] || "車輛使用紀錄"}
      onClose={requestClose}
      wide
    >
      <Scope
        doc={
          part === "arrival"
            ? kind === "B"
              ? "departure_arrive"
              : "back_arrive"
            : bookingDoc(kind)
        }
      >
        <p className="info-note">
          {b.id} · 多車主單共用一條流程；每次出發須確認使用車輛。
        </p>
        {part === "arrival" && (
          <details>
            <summary>查看原出發紀錄</summary>
            <StageView stage={b.stages?.find((s) => s.kind === kind)} />
          </details>
        )}
        <form onSubmit={submit} className="source-stage-form">
          <PartEditor
            data={data}
            set={(k, v) => setData((d: any) => ({ ...d, [k]: v }))}
            kind={kind}
            part={part}
            booking={b}
            resources={resources.data || []}
            onUploading={(key, value) =>
              setUploads((v) => ({ ...v, [key]: value }))
            }
          />
          <ErrorBox error={error || resources.error} />
          {draftMessage && <p role="status">{draftMessage}</p>}
          <div className="source-actions">
            <button
              type="button"
              className="button"
              disabled={busy || uploading}
              onClick={requestClose}
            >
              取消
            </button>
            <button
              type="button"
              className="button"
              disabled={busy || uploading}
              onClick={() => {
                try {
                  sessionStorage.setItem(
                    draftKey,
                    JSON.stringify({ saved: Date.now(), content: data }),
                  );
                  setBaseline(JSON.stringify(data));
                  setDraftMessage("草稿已保存在此瀏覽器分頁，尚未提交。");
                } catch {
                  setError(
                    "此瀏覽器無法保存分頁草稿，請保持表單開啟或直接提交。",
                  );
                }
              }}
            >
              儲存草稿
            </button>
            <button
              className="button primary"
              disabled={
                busy || uploading || (kind === "B" && !canFillDeparture(u, b))
              }
            >
              {busy ? "保存中…" : "確認提交本階段"}
            </button>
          </div>
        </form>
      </Scope>
    </Modal>
  );
}
export function StagePage() {
  const { id } = useParams(),
    u = useUser();
  const query = useQuery({
    queryKey: ["stage", id],
    queryFn: () => api<any>("/stages/" + id),
  });
  const resources = useQuery({
    queryKey: ["resources"],
    queryFn: () => api<Resource[]>("/resources"),
  });
  const [editing, setEditing] = useState(false),
    [remove, setRemove] = useState(false),
    [data, setData] = useState<any>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Record<string, boolean>>({});
  const uploading = Object.values(uploads).some(Boolean);
  const [baseline, setBaseline] = useState("");
  const leaveGuard = useUnsavedChanges({
    active: editing,
    dirty: JSON.stringify(data) !== baseline,
    busy: busy || uploading,
  });
  const requestClose = () => leaveGuard.requestClose(() => setEditing(false));
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorBox error={query.error} />;
  const s = query.data;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) {
      setError("請等候檔案上傳完成後再保存。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/stages/" + id, "PUT", {
        revision: s.revision,
        content: data,
      });
      leaveGuard.release();
      await invalidate();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Scope doc={bookingDoc(s.kind)}>
      <Link to={"/bookings/" + s.parent_id}>返回父申請 {s.parent_id}</Link>
      <PageHead
        eyebrow={s.id}
        title={s.kind === "B" ? "發車與抵達紀錄" : "回程與抵達紀錄"}
        description="修正保留編號及舊版本，父單流程不倒退。"
        action={
          <div className="actions">
            {can(u, bookingDoc(s.kind), "write") &&
              (s.kind !== "B" ||
                canFillDeparture(u, { owner: s.applicant_owner })) && (
                <button
                  className="button"
                  onClick={() => {
                    setData(structuredClone(s.content));
                    setBaseline(JSON.stringify(s.content));
                    setEditing(true);
                  }}
                >
                  修正階段內容
                </button>
              )}
            {can(u, bookingDoc(s.kind), "delete") &&
              (s.kind !== "B" ||
                canFillDeparture(u, { owner: s.applicant_owner })) && (
                <button
                  className="button danger"
                  onClick={() => setRemove(true)}
                >
                  刪除階段
                </button>
              )}
          </div>
        }
      />
      <ErrorBox error={error} />
      <section className="panel detail-content">
        <StageView stage={s} />
        <h3>歷史版本</h3>
        {s.versions?.map((v: any) => (
          <details key={v.id}>
            <summary>
              {dateTime(v.time)} · {v.actor}
            </summary>
            <StageView stage={v.data} />
          </details>
        ))}
      </section>
      <Modal open={editing} title="修正階段內容" wide onClose={requestClose}>
        <form onSubmit={save} className="source-stage-form">
          {["start", "arrival"]
            .filter((p) => data[p])
            .map((part) => (
              <section key={part}>
                <h3>{part === "start" ? "出發" : "抵達"}</h3>
                <PartEditor
                  data={data[part]}
                  set={(k, v) =>
                    setData((d: any) => ({
                      ...d,
                      [part]: { ...d[part], [k]: v },
                    }))
                  }
                  kind={s.kind}
                  part={part}
                  resources={resources.data || []}
                  onUploading={(key, value) =>
                    setUploads((v) => ({ ...v, [key]: value }))
                  }
                />
              </section>
            ))}
          <ErrorBox error={error} />
          <div className="actions">
            <button
              type="button"
              className="button"
              onClick={requestClose}
              disabled={busy || uploading}
            >
              取消
            </button>
            <button className="button primary" disabled={busy || uploading}>
              {busy ? "保存中…" : "儲存修訂"}
            </button>
          </div>
        </form>
      </Modal>
      <Confirm
        open={remove}
        title="刪除階段紀錄？"
        description={`${s.id} 將軟刪除；父單會標示資料不完整並停止推進。`}
        onClose={() => setRemove(false)}
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api("/stages/" + id, "DELETE");
            await invalidate();
            location.href = "/bookings/" + s.parent_id;
          } catch (e) {
            setError((e as Error).message);
            setRemove(false);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Scope>
  );
}
export function StageList() {
  return <StageQueries />;
}
function PreviousStageList() {
  const [params, setParams] = useSearchParams(),
    kind = params.get("kind") === "C" ? "C" : "B";
  const [search, setSearch] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const q = useQuery({
    queryKey: ["stages", kind],
    queryFn: () => api<any[]>("/stages?kind=" + kind),
  });
  const rows = (q.data || []).filter((s) => {
    const d = localDate(new Date(s.created_at));
    return (
      (!from || d >= from) &&
      (!to || d <= to) &&
      [s.id, s.parent_id, s.content.start?.plate, s.content.start?.driver]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  return (
    <>
      <PageHead
        eyebrow="WORKFLOW RECORDS"
        title="出回程紀錄"
        description="依父單關聯查詢有效 B／C；舊版本保留在個別紀錄。"
      />
      <section className="panel detail-content">
        <div className="list-tabs">
          <button
            onClick={() => setParams({ kind: "B" })}
            className={kind === "B" ? "active" : ""}
          >
            發車 B
          </button>
          <button
            onClick={() => setParams({ kind: "C" })}
            className={kind === "C" ? "active" : ""}
          >
            回程 C
          </button>
        </div>
        <div className="list-filters">
          <input
            aria-label="搜尋階段"
            placeholder="編號、車牌或駕駛"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            aria-label="階段起日"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            aria-label="階段迄日"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button
            className="button"
            onClick={() => {
              setSearch("");
              setFrom("");
              setTo("");
            }}
          >
            清除
          </button>
        </div>
        <ErrorBox error={q.error} />
        {q.isPending ? (
          <Loading />
        ) : rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>編號</th>
                  <th>父單</th>
                  <th>建立時間</th>
                  <th>車牌</th>
                  <th>駕駛</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={"/stages/" + s.id}>{s.id}</Link>
                    </td>
                    <td>
                      <Link to={"/bookings/" + s.parent_id}>{s.parent_id}</Link>
                    </td>
                    <td>{dateTime(s.created_at)}</td>
                    <td>{s.content.start?.plate}</td>
                    <td>{s.content.start?.driver}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </section>
    </>
  );
}
