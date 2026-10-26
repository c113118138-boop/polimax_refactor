import {
  CarFront,
  Telescope,
  Pencil,
  Trash2,
  Plus,
  ShieldCheck,
  Receipt,
  Wrench,
  Users,
} from "lucide-react";
import { Resource, localDate } from "./api";
import { SourceFiles } from "./SourceFiles";
import { can } from "./Access";
import "./parity.css";

export const assetFiles = (vehicle: boolean) =>
  vehicle
    ? [
        ["license_files", "行照"],
        ["vehicle_files", "車籍資料"],
        ["contract_files", "合約"],
      ]
    : [
        ["manual_files", "使用手冊"],
        ["warranty_files", "保固書"],
        ["purchase_files", "採購文件"],
      ];
const amount = (v: any) =>
  v == null || v === "" ? "—" : "NT$ " + Number(v).toLocaleString("zh-TW");
function InfoCard({ title, fields }: { title: string; fields: any[][] }) {
  return (
    <section className="source-info-card">
      <h3>{title}</h3>
      <dl>
        {fields.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function AssetBasic({
  resource: r,
  edit,
  editable,
}: {
  resource: Resource;
  edit: () => void;
  editable: boolean;
}) {
  const vehicle = r.kind === "vehicle";
  return (
    <div className="source-asset-basic">
      <header className="source-profile-banner">
        {vehicle ? <CarFront size={48} /> : <Telescope size={48} />}
        <div>
          <span className="eyebrow">
            {vehicle ? "VEHICLE" : "EQUIPMENT"} /{" "}
            {String(r.id).padStart(3, "0")}
          </span>
          <h2>{vehicle ? r.label : r.name}</h2>
          <p>{vehicle ? r.model : r.location}</p>
        </div>
        {editable && (
          <button
            className="icon-button"
            aria-label="編輯基本資料"
            onClick={edit}
          >
            <Pencil />
          </button>
        )}
      </header>
      <div className="source-info-grid">
        <InfoCard
          title="基本資訊"
          fields={
            vehicle
              ? [
                  ["車牌號碼", r.label],
                  ["廠牌型號", r.model],
                  ["車主", r.owner],
                  ["購買日期", r.purchase_date],
                  ["金額", amount(r.amount)],
                  ["乘客數", r.passengers],
                ]
              : [
                  ["設備編碼", r.label],
                  ["位置編號", r.location],
                  ["品牌廠商", r.brand],
                  ["購買廠商", r.purchase_manufacturer],
                  ["維修廠商", r.fix_manufacturer],
                  ["數量", r.quantity],
                  ["用途", r.purpose],
                ]
          }
        />
        <InfoCard
          title={vehicle ? "聯絡資訊" : "管理資訊"}
          fields={
            vehicle
              ? [
                  ["聯絡人", r.contact_person],
                  ["電話號碼", r.phone],
                  ["管理人", r.manager],
                ]
              : [
                  ["保管人", r.holder],
                  ["列管建議", r.state],
                  ["預估價值", amount(r.estimated_amount)],
                  ["委外校正日期", r.fix_date],
                  ["有效期限", r.valid_period],
                ]
          }
        />
        <section className="source-info-card source-full">
          <h3>{vehicle ? "設備資訊" : "設備配件"}</h3>
          <div className="tags">
            {((vehicle ? r.equipment : r.accessories) || []).map(
              (x: any, i: number) => (
                <span className="resource-tag" key={i}>
                  {typeof x === "string" ? x : x.name + " × " + x.quantity}
                </span>
              ),
            )}
          </div>
          {vehicle && !r.equipment?.length && <p>尚未配置任何設備</p>}
        </section>
        {"notes" in r && (
          <section className="source-info-card source-full">
            <h3>備註</h3>
            <p className="preserve-lines">{r.notes || "—"}</p>
          </section>
        )}
        <section className="source-info-card source-full">
          <h3>相關檔案</h3>
          <div className="source-file-grid">
            {assetFiles(vehicle).map(([key, label]) => (
              <section key={key}>
                <h4>{label}</h4>
                <SourceFiles files={r[key] || []} />
              </section>
            ))}
          </div>
        </section>
        {vehicle && (
          <details className="source-full source-asset-extra">
            <summary>資產管理資訊</summary>
            <p>
              保管人：{r.holder || "—"} · 追蹤器識別：{r.client_id || "—"}
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
const recordColumns: Record<string, string[][]> = {
  insurance: [
    ["company", "保險公司名稱"],
    ["phone", "公司電話"],
    ["expiry", "有效期限"],
    ["employee", "業務人員"],
    ["employee_phone", "業務人員電話"],
    ["roadside", "道路救援"],
    ["policy_files", "保單檔案"],
    ["claim_files", "出險資料"],
  ],
  cost: [
    ["type", "類型"],
    ["reason", "緣由"],
    ["amount", "金額"],
    ["notes", "備註"],
    ["attachments", "附件"],
  ],
  maintenance: [
    ["type", "記錄類型"],
    ["date", "記錄日期"],
    ["notes", "備註"],
    ["attachments", "附件"],
  ],
};
const names: Record<string, string> = {
  insurance: "車輛保險紀錄",
  cost: "車輛使用成本",
  maintenance: "保養維護記錄",
  garage: "保養廠檔案",
  manager: "車輛管理人員",
};
export function recordDoc(category: string) {
  return category === "insurance" ? "Insurance" : "Cost";
}
function Files({ files }: { files: any[] }) {
  return files?.length ? <SourceFiles files={files} /> : <span>無附件</span>;
}
export function RecordSections({
  tab,
  records,
  user,
  edit,
  remove,
}: {
  tab: string;
  records: any[];
  user: any;
  edit: (r: any) => void;
  remove: (r: any) => void;
}) {
  const categories =
    tab === "maintenance" ? ["maintenance", "garage", "manager"] : [tab];
  return (
    <div className="source-record-sections">
      {categories.map((category) => {
        const rows = records.filter((r) => r.category === category),
          doc = recordDoc(category);
        const editable =
          can(user, doc, "write") || can(user, "VehicleManagement", "write");
        const deletable = can(user, doc, "delete");
        const columns = recordColumns[category];
        const actions = (r: any) => (
          <div className="source-row-actions">
            {editable && (
              <button
                className="icon-button"
                aria-label={"編輯紀錄 " + r.id}
                onClick={() => edit({ id: r.id, category, data: r })}
              >
                <Pencil size={19} />
              </button>
            )}
            {deletable && (
              <button
                className="icon-button danger"
                aria-label={"刪除紀錄 " + r.id}
                onClick={() => remove(r)}
              >
                <Trash2 size={19} />
              </button>
            )}
          </div>
        );
        return (
          <section className="source-record-section" key={category}>
            <header>
              <h2>
                {category === "insurance" ? (
                  <ShieldCheck />
                ) : category === "cost" ? (
                  <Receipt />
                ) : category === "manager" ? (
                  <Users />
                ) : (
                  <Wrench />
                )}
                {names[category]}
              </h2>
              {editable && (
                <button
                  className="button"
                  onClick={() => edit({ category, data: { attachments: [] } })}
                >
                  <Plus size={17} />
                  {category === "garage"
                    ? "上傳檔案"
                    : category === "manager"
                      ? "新增管理人員"
                      : "新增紀錄"}
                </button>
              )}
            </header>
            {columns ? (
              <div className="source-table-scroll">
                <table className="source-data-table">
                  <thead>
                    <tr>
                      {columns.map(([key, label]) => (
                        <th key={key}>{label}</th>
                      ))}
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        {columns.map(([key]) => (
                          <td key={key}>
                            {key.endsWith("_files") || key === "attachments" ? (
                              <Files files={r[key]} />
                            ) : key === "amount" ? (
                              amount(r[key])
                            ) : key === "expiry" ? (
                              <>
                                {r.expiry}
                                <Expiry date={r.expiry} />
                              </>
                            ) : (
                              (key === "type"
                                ? (
                                    {
                                      insurance: "保費",
                                      maintenance:
                                        category === "cost"
                                          ? "保養"
                                          : "定期保養",
                                      repair: "維修",
                                      inspection: "驗車",
                                    } as any
                                  )[r[key]]
                                : undefined) ||
                              r[key] ||
                              "—"
                            )}
                          </td>
                        ))}
                        <td>{actions(r)}</td>
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr>
                        <td colSpan={columns.length + 1}>暫無紀錄</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="source-management-cards">
                {rows.map((r) => (
                  <article key={r.id}>
                    <h3>
                      {category === "manager"
                        ? r.name
                        : "備註: " + (r.notes || "無備註")}
                    </h3>
                    {category === "manager" && (
                      <p className="preserve-lines">{r.notes || "無備註"}</p>
                    )}
                    <small>建立日期: {r.created_at?.slice(0, 10) || "—"}</small>
                    {category === "garage" && <Files files={r.attachments} />}
                    <footer>{actions(r)}</footer>
                  </article>
                ))}
                {!rows.length && (
                  <p>暫無{category === "garage" ? "保養廠檔案" : "管理人員"}</p>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
function Expiry({ date }: { date: string }) {
  if (!date) return null;
  const days = Math.round(
    (new Date(date + "T00:00:00+08:00").getTime() -
      new Date(localDate() + "T00:00:00+08:00").getTime()) /
      86400000,
  );
  return (
    <small className={days <= 30 ? "source-expiry due" : "source-expiry"}>
      {days < 0 ? "已過期" : `剩 ${days} 天`}
      <span>預覽環境不發送外部通知</span>
    </small>
  );
}
