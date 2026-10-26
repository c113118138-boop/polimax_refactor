import { Fragment, ReactNode, useState } from "react";
import { useFieldAccess } from "./Access";
import { ErrorBox } from "./ui";

export function FormPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="source-panel">
      <h2>{title}</h2>
      <div className="source-panel-body">{children}</div>
    </section>
  );
}

export function FieldGroup({
  field,
  children,
}: {
  field: string;
  children: ReactNode;
}) {
  const access = useFieldAccess(field);
  if (!access.read) return null;
  return (
    <fieldset className="source-field-group" disabled={!access.write}>
      {children}
    </fieldset>
  );
}

// Explicit React editors supply the fields. This component only manages row transactions.
export function RecordGrid<T>({
  name,
  rows,
  change,
  blank,
  headings,
  summary,
  editor,
  validate,
  pendingChange,
  widths,
  repeatHeader = false,
}: {
  name: string;
  rows: T[];
  change: (rows: T[]) => void;
  blank: () => T;
  headings: string[];
  summary: (row: T, index: number) => ReactNode[];
  editor: (row: T, update: (row: T) => void, index: number) => ReactNode;
  validate: (row: T) => string;
  pendingChange: (pending: boolean) => void;
  widths?: number[];
  repeatHeader?: boolean;
}) {
  const [draft, setDraft] = useState<{ index: number; value: T } | null>(null);
  const [error, setError] = useState("");
  function open(index: number) {
    setDraft({
      index,
      value: structuredClone(index < rows.length ? rows[index] : blank()),
    });
    setError("");
    pendingChange(true);
  }
  function close() {
    setDraft(null);
    setError("");
    pendingChange(false);
  }
  function save() {
    if (!draft) return;
    const message = validate(draft.value);
    if (message) {
      setError(message);
      return;
    }
    change(
      draft.index === rows.length
        ? [...rows, draft.value]
        : rows.map((r, i) => (i === draft.index ? draft.value : r)),
    );
    close();
  }
  return (
    <div className="source-grid" data-grid={name}>
      {rows.length > 0 && (
        <div
          className="source-table-scroll"
          tabIndex={0}
          aria-label={name + "表格"}
        >
          <table className="source-summary-table">
            {widths && (
              <colgroup>
                {widths.map((width, i) => (
                  <col key={i} style={{ width: width + "%" }} />
                ))}
              </colgroup>
            )}
            <thead>
              <tr>
                {headings.map((h, i) => (
                  <th key={i} scope="col">
                    {h}
                  </th>
                ))}
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <Fragment key={i}>
                  {repeatHeader && i > 0 && (
                    <tr className="source-repeat-header">
                      {headings.map((h, j) => (
                        <th key={j} scope="col">
                          {h}
                        </th>
                      ))}
                      <th scope="col">操作</th>
                    </tr>
                  )}
                  <tr data-row={i}>
                    {summary(r, i).map((cell, j) => (
                      <td key={j}>{cell || "—"}</td>
                    ))}
                    <td className="source-row-actions">
                      <button
                        type="button"
                        disabled={!!draft}
                        onClick={() => open(i)}
                        aria-label={`編輯${name} ${i + 1}`}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        disabled={!!draft}
                        className="source-danger"
                        onClick={() => change(rows.filter((_, j) => j !== i))}
                        aria-label={`移除${name} ${i + 1}`}
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!rows.length && !draft && (
        <p className="source-grid-empty">尚無資料，請新增一筆。</p>
      )}
      {draft && (
        <div className="source-row-editor" data-editor={name}>
          <h3>
            {draft.index === rows.length ? "新增" : "編輯"}
            {name} {draft.index + 1}
          </h3>
          {editor(
            draft.value,
            (value) => setDraft({ ...draft, value }),
            draft.index,
          )}
          <ErrorBox error={error} />
          <div className="source-actions">
            <button type="button" className="button primary" onClick={save}>
              保存{name}
            </button>
            <button type="button" className="button" onClick={close}>
              取消{name}
            </button>
          </div>
        </div>
      )}
      {!draft && (
        <button
          type="button"
          className="button primary source-add"
          onClick={() => open(rows.length)}
        >
          新增{name}
        </button>
      )}
    </div>
  );
}
