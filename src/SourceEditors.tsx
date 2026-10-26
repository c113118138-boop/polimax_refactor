import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, Booking, Resource, invalidate } from "./api";
import { useUser } from "./App";
import { bookingDoc, can, canFillDeparture, Scope } from "./Access";
import { BorrowingForm } from "./BorrowingForms";
import { PartEditor } from "./StageFields";
import { ErrorBox, Loading, Modal } from "./ui";
import { useLeaveConfirmation, useUnsavedChanges } from "./NavigationGuard";
import "./parity.css";

export function SourceBookingDialog({
  id,
  editing = false,
  close,
}: {
  id: string;
  editing?: boolean;
  close: () => void;
}) {
  const { confirmLeave } = useLeaveConfirmation();
  return (
    <Modal
      open
      title={editing ? "編輯表單" : "查看表單"}
      wide
      className="source-editor-dialog"
      onClose={() => confirmLeave(close)}
    >
      <BorrowingForm
        key={id}
        bookingId={id}
        readOnly={!editing}
        onSaved={close}
        onCancel={close}
      />
    </Modal>
  );
}
export function SourceStageDialog({
  id,
  editing = false,
  close,
}: {
  id: string;
  editing?: boolean;
  close: () => void;
}) {
  const user = useUser();
  const q = useQuery({
    queryKey: ["stage", id],
    queryFn: () => api<any>("/stages/" + id),
  });
  const resources = useQuery({
    queryKey: ["resources"],
    queryFn: () => api<Resource[]>("/resources"),
  });
  const parent = useQuery({
    queryKey: ["booking", q.data?.parent_id],
    queryFn: () => api<Booking>("/bookings/" + q.data.parent_id),
    enabled: !!q.data?.parent_id && can(user, "Lending_form"),
  });
  const [data, setData] = useState<any>({}),
    [baseline, setBaseline] = useState("{}"),
    [busy, setBusy] = useState(false),
    [uploads, setUploads] = useState<Record<string, boolean>>({}),
    [error, setError] = useState("");
  const uploading = Object.values(uploads).some(Boolean);
  const leave = useUnsavedChanges({
    active: editing,
    dirty: JSON.stringify(data) !== baseline,
    busy: busy || uploading,
  });
  useEffect(() => {
    if (q.data) {
      setData(structuredClone(q.data.content));
      setBaseline(JSON.stringify(q.data.content));
    }
  }, [id, q.data?.revision]);
  const allowed =
    q.data &&
    can(user, bookingDoc(q.data.kind), editing ? "write" : "read") &&
    (!editing ||
      q.data.kind !== "B" ||
      canFillDeparture(user, {
        owner: q.data.applicant_owner || parent.data?.owner,
      }));
  const requestClose = () => leave.requestClose(close);
  return (
    <Modal
      open
      title={editing ? "編輯表單" : "查看表單"}
      wide
      className="source-editor-dialog"
      onClose={requestClose}
    >
      <ErrorBox error={error || q.error || resources.error || parent.error} />
      {q.isPending || resources.isPending ? (
        <Loading />
      ) : !allowed ? (
        <ErrorBox error="沒有此階段的操作權限" />
      ) : (
        <Scope doc={bookingDoc(q.data.kind)}>
          <p className="mono">
            {q.data.id} · 父單 {q.data.parent_id}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editing || uploading || busy) return;
              setBusy(true);
              setError("");
              try {
                await api("/stages/" + id, "PUT", {
                  revision: q.data.revision,
                  content: data,
                });
                leave.release();
                await invalidate();
                close();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset
              disabled={!editing}
              className={
                "source-readonly-fieldset" +
                (!editing ? " source-readonly-form" : "")
              }
            >
              {["start", "arrival"].map((part) => (
                <section className="source-stage-form" key={part}>
                  <h2>
                    {q.data.kind === "B"
                      ? part === "start"
                        ? "發車基本資訊填寫"
                        : "發車到達資訊填寫"
                      : part === "start"
                        ? "回程基本資訊填寫"
                        : "回程到達資訊填寫"}
                  </h2>
                  {data[part] ? (
                    <PartEditor
                      kind={q.data.kind}
                      part={part}
                      booking={parent.data}
                      data={data[part]}
                      resources={resources.data || []}
                      readOnly={!editing}
                      set={(k, v) =>
                        setData((d: any) => ({
                          ...d,
                          [part]: { ...d[part], [k]: v },
                        }))
                      }
                      onUploading={(k, v) =>
                        setUploads((x) => ({ ...x, [k]: v }))
                      }
                    />
                  ) : (
                    <p>尚未填寫抵達紀錄。</p>
                  )}
                </section>
              ))}
            </fieldset>
            <div className="source-actions">
              {editing && (
                <button className="button primary" disabled={busy || uploading}>
                  {busy ? "保存中…" : "儲存修訂"}
                </button>
              )}
              <button
                type="button"
                className="button"
                onClick={requestClose}
                disabled={busy || uploading}
              >
                {editing ? "取消" : "關閉"}
              </button>
            </div>
          </form>
        </Scope>
      )}
    </Modal>
  );
}
