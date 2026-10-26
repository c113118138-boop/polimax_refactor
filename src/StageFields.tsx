import { Booking, Resource, dateTime } from "./api";
import { useUser } from "./App";
import { Field, FileUpload } from "./ui";
import { FieldGroup, FormPanel } from "./FormLayout";

export function PartEditor({
  data: d,
  set,
  kind,
  part,
  booking,
  resources,
  onUploading,
  readOnly = false,
}: {
  data: any;
  set: (key: string, v: any) => void;
  kind: string;
  part: string;
  booking?: Booking;
  resources: Resource[];
  onUploading?: (key: string, busy: boolean) => void;
  readOnly?: boolean;
}) {
  const u = useUser(),
    departure = part === "start",
    outbound = kind === "B";
  const cars =
    booking?.slots
      .map(
        (s) =>
          resources.find((r) => r.id === s.resource_id) ||
          booking.content.resource_snapshots?.find(
            (r: any) => r.id === s.resource_id,
          ),
      )
      .filter(
        (r: any, i, a: any[]) => r && a.findIndex((x) => x?.id === r.id) === i,
      ) || [];
  const check = (label: string) => (
    <FieldGroup field="checks">
      <label className="check-label">
        <input
          type="checkbox"
          checked={d.checks?.includes(label) || false}
          onChange={(e) =>
            set(
              "checks",
              e.target.checked
                ? [...(d.checks || []), label]
                : d.checks.filter((v: string) => v !== label),
            )
          }
        />
        {label}
      </label>
    </FieldGroup>
  );
  const status = (key: string, label: string) => (
    <Field label={label + "狀況"} field={key} required>
      <div className="source-radio">
        {["正常", "異狀"].map((v) => (
          <label key={v}>
            <input
              type="radio"
              name={`${kind}-${part}-${key}`}
              checked={d[key] === v}
              onChange={() => set(key, v)}
            />
            {v === "異狀" ? "異狀備註" : "正常"}
          </label>
        ))}
      </div>
    </Field>
  );
  const note = (key: string, label: string) =>
    d[key] === "異狀" && (
      <Field label={label + "異狀說明"} required field={key + "_note"}>
        <textarea
          rows={3}
          required
          value={d[key + "_note"] || ""}
          onChange={(e) => set(key + "_note", e.target.value)}
        />
      </Field>
    );
  const photo = (key: string, label: string) => (
    <Field label={label} field={key}>
      <div className="source-photo-slot">
        <FileUpload
          images
          readOnly={readOnly}
          value={d[key] || []}
          onChange={(v) => set(key, v)}
          onBusyChange={(busy) => onUploading?.(part + key, busy)}
        />
      </div>
    </Field>
  );
  const mileage = (
    <Field
      label={
        departure
          ? outbound
            ? "去程開始里程數"
            : "回程開始里程數"
          : outbound
            ? "去程結束里程數"
            : "回程結束里程數"
      }
      field="mileage"
      required
    >
      <input
        type="number"
        min={0}
        max={999999999}
        step="0.1"
        value={d.mileage ?? ""}
        required
        onChange={(e) => set("mileage", e.target.value)}
      />
    </Field>
  );
  const confirmation = (
    <FieldGroup field="confirmed">
      <label className="check-label">
        <input
          type="checkbox"
          checked={!!d.confirmed}
          onChange={(e) => set("confirmed", e.target.checked)}
          required
        />
        我已確認本階段里程
      </label>
    </FieldGroup>
  );
  const people = (
    <Field label="使用人員" field="employees" required>
      <div className="source-people">
        <input
          aria-label="第一位借用人員"
          readOnly
          value={d.employees?.[0] || u.name}
        />
        <input
          aria-label="第二位借用人員"
          value={d.employees?.slice(1).join("、") || ""}
          placeholder="第二位借用人員姓名（選填）"
          onChange={(e) =>
            set("employees", [
              d.employees?.[0] || u.name,
              ...e.target.value.split(/[、,，]/).filter(Boolean),
            ])
          }
        />
      </div>
    </Field>
  );
  return (
    <div className="source-stage-form">
      {departure ? (
        <>
          <FormPanel title={outbound ? "發車基本資訊填寫" : "回程基本資訊填寫"}>
            <Field label="預約帶入時間" field="reservation_start">
              <input
                readOnly
                value={dateTime(
                  d.reservation_start ||
                    booking?.slots.find((s) => s.resource_id === d.resource_id)
                      ?.start ||
                    "",
                )}
              />
            </Field>
            <Field label="車輛" required field="resource_id">
              {d.submitted_at ? (
                <input readOnly value={d.plate || ""} />
              ) : (
                <select
                  required
                  value={d.resource_id || ""}
                  onChange={(e) => set("resource_id", Number(e.target.value))}
                >
                  <option value="">選擇本次使用車輛</option>
                  {cars.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div
              className="source-table-scroll"
              tabIndex={0}
              aria-label="駕駛與副駕表格"
            >
              <table className="source-driver-table">
                <tbody>
                  <tr>
                    <td>
                      <Field label="駕駛人員" field="driver" required>
                        <input
                          required
                          value={d.driver || ""}
                          placeholder="請填寫駕駛姓名"
                          onChange={(e) => set("driver", e.target.value)}
                        />
                      </Field>
                    </td>
                    <td>
                      <Field label="副駕人員（兩人以上必填）" field="codriver">
                        <input
                          value={d.codriver || ""}
                          placeholder="請填寫副駕姓名"
                          onChange={(e) => set("codriver", e.target.value)}
                        />
                      </Field>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {!outbound && people}
            <Field
              label={outbound ? "去程發車地點" : "回程發車地點"}
              required
              field="place"
            >
              <input
                required
                value={d.place || ""}
                onChange={(e) => set("place", e.target.value)}
              />
            </Field>
            {outbound && people}
          </FormPanel>
          <FormPanel
            title={outbound ? "去程發車（安全）檢查" : "回程發車（安全）檢查"}
          >
            <FormPanel title="發車確認">
              <div
                className="source-table-scroll"
                tabIndex={0}
                aria-label="車輛安全檢查表格"
              >
                <table className="source-check-table">
                  <tbody>
                    {outbound ? (
                      <>
                        <tr>
                          <td>{check("擋風玻璃清潔")}</td>
                          <td>{check("照後鏡清潔")}</td>
                          <td>{check("油量檢查")}</td>
                        </tr>
                        {[
                          ["tires", "輪胎檢查", "輪胎"],
                          ["interior", "車輛內部清潔", "車輛內部"],
                          ["exterior", "車體外部檢查", "車體外部"],
                          ["equipment", "隨車設備檢查", "隨車設備"],
                        ].map(([key, label, title]) => (
                          <tr key={key}>
                            <td>{check(label)}</td>
                            <td>{status(key, title)}</td>
                            <td>{note(key, title)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td>
                            {confirmation}
                            {mileage}
                          </td>
                          <td />
                          <td />
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr>
                          <td>{check("車輛內部清潔")}</td>
                          <td>{photo("interior_files", "車輛內部照片")}</td>
                          <td>
                            <Field label="內部照片預覽" field="interior_files">
                              {d.interior_files?.length ? (
                                d.interior_files.map((f: any) => (
                                  <a
                                    key={f.id}
                                    href={`/api/files/${f.id}?preview=true`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    預覽：{f.name}
                                    <br />
                                  </a>
                                ))
                              ) : (
                                <span className="muted">
                                  上傳後可預覽照片。
                                </span>
                              )}
                            </Field>
                          </td>
                        </tr>
                        <tr>
                          <td>{check("車輛內部物品歸位")}</td>
                          <td>{check("車輛鑰匙歸位")}</td>
                          <td>{check("油量檢查")}</td>
                        </tr>
                        {[
                          ["exterior", "車體外部檢查", "車體外部"],
                          ["equipment", "隨車設備檢查", "隨車設備"],
                        ].map(([key, label, title]) => (
                          <tr key={key}>
                            <td>{check(label)}</td>
                            <td>
                              {status(key, title)}
                              {note(key, title)}
                            </td>
                            <td>
                              {d[key] === "異狀" &&
                                photo(key + "_files", title + "異狀照片")}
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              {!outbound && (
                <>
                  {confirmation}
                  {mileage}
                </>
              )}
            </FormPanel>
            <FormPanel title="補充資訊">
              {!outbound && photo("parking_files", "車輛停放地照片")}
              <Field label="備註" field="notes">
                <textarea
                  rows={3}
                  value={d.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </FormPanel>
          </FormPanel>
        </>
      ) : (
        <FormPanel title="抵達確認">
          {confirmation}
          {mileage}
          <Field label="途中異常" field="anomalies">
            <div className="source-checkbox-list">
              {["維修", "違規", "事故"].map((a) => (
                <label key={a}>
                  <input
                    type="checkbox"
                    checked={d.anomalies?.includes(a) || false}
                    onChange={(e) =>
                      set(
                        "anomalies",
                        e.target.checked
                          ? [...(d.anomalies || []), a]
                          : d.anomalies.filter((v: string) => v !== a),
                      )
                    }
                  />
                  {a}
                </label>
              ))}
            </div>
          </Field>
          {["維修", "違規", "事故"]
            .filter((a) => d.anomalies?.includes(a))
            .map((a) => {
              const fields =
                a === "維修"
                  ? [
                      ["reason", "車輛問題部位"],
                      ["place", "車輛故障地點"],
                      ["repair_shop", "維修地點／維修廠"],
                      ["notes", "備註"],
                    ]
                  : a === "違規"
                    ? [
                        ["place", "違規地點"],
                        ["reason", "違規事由"],
                        ["notes", "備註"],
                      ]
                    : [
                        ["place", "事故地點"],
                        ["reason", "事故原因"],
                        ["internal_injury", "公司內部人員受傷狀況"],
                        ["external_injury", "對方人員受傷狀況"],
                        ["notes", "備註"],
                      ];
              return (
                <FormPanel key={a} title={a + "報備"}>
                  <FieldGroup field="anomaly_details">
                    <div
                      className="source-table-scroll"
                      tabIndex={0}
                      aria-label={a + "報備表格"}
                    >
                      <table className="source-anomaly-table">
                        <tbody>
                          <tr>
                            {fields.map(([key, label]) => (
                              <td key={key}>
                                <Field label={label} field={key}>
                                  {key === "notes" ? (
                                    <textarea
                                      rows={3}
                                      value={
                                        d.anomaly_details?.[a]?.[key] || ""
                                      }
                                      onChange={(e) =>
                                        set("anomaly_details", {
                                          ...d.anomaly_details,
                                          [a]: {
                                            ...d.anomaly_details?.[a],
                                            [key]: e.target.value,
                                          },
                                        })
                                      }
                                    />
                                  ) : (
                                    <input
                                      value={
                                        d.anomaly_details?.[a]?.[key] || ""
                                      }
                                      onChange={(e) =>
                                        set("anomaly_details", {
                                          ...d.anomaly_details,
                                          [a]: {
                                            ...d.anomaly_details?.[a],
                                            [key]: e.target.value,
                                          },
                                        })
                                      }
                                    />
                                  )}
                                </Field>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </FieldGroup>
                </FormPanel>
              );
            })}
          <Field label="附件" field="attachments">
            <FileUpload
              readOnly={readOnly}
              value={d.attachments || []}
              onChange={(v) => set("attachments", v)}
              onBusyChange={(busy) => onUploading?.(part + "attachments", busy)}
            />
          </Field>
          <Field label="備註" field="notes">
            <textarea
              rows={3}
              value={d.notes || ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </FormPanel>
      )}
    </div>
  );
}
