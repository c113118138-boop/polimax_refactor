import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  Telescope,
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  MapPin,
  ShieldCheck,
  Wrench,
  FileText,
  Receipt,
  CalendarDays,
  ChevronRight,
  Package,
  Check,
} from "lucide-react";
import { api, Resource, invalidate, localDate } from "./api";
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
import { useUser } from "./App";
import { can, Scope } from "./Access";
import { useUnsavedChanges } from "./NavigationGuard";
import { AssetBasic, RecordSections, assetFiles } from "./AssetPresentation";
const money = (v: any) =>
  v == null || v === ""
    ? "—"
    : new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(
        Number(v),
      );
const accessories = [
  "主機",
  "20V鋰電電池",
  "10.8V鋰電電池",
  "電池",
  "固定件",
  "充電座",
  "充電器",
  "防護罩",
  "校正模具",
  "電源線",
  "感測線",
  "磁性座",
  "鍊條",
  "螺絲攻",
  "鋼刷",
  "轉接頭",
  "輔助固定架",
  "壓接頭",
  "鉤錶",
];
export function Assets({ kind }: { kind: string }) {
  const u = useUser(),
    vehicle = kind === "vehicle";
  const query = useQuery({
    queryKey: ["resources"],
    queryFn: () => api<Resource[]>("/resources"),
    refetchInterval: 5000,
  });
  const [search, setSearch] = useState(""),
    [open, setOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<
      Resource | undefined
    >(),
    [deletingResource, setDeletingResource] = useState<Resource | null>(null),
    [listError, setListError] = useState(""),
    [listBusy, setListBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const createRequested = params.get("create") === "1";
  const canCreate = can(
    u,
    vehicle ? "VehicleManagement" : "EquipmentManagement",
    "create",
  );
  useEffect(() => {
    if (createRequested && canCreate) setOpen(true);
  }, [createRequested, canCreate]);
  function closeEditor() {
    setOpen(false);
    setEditingResource(undefined);
    if (params.has("create")) {
      const next = new URLSearchParams(params);
      next.delete("create");
      setParams(next, { replace: true });
    }
  }
  const list = (query.data || []).filter(
    (r) =>
      r.kind === kind &&
      [r.label, r.name, r.model, r.holder, r.location]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        eyebrow={vehicle ? "FLEET MANAGEMENT" : "EQUIPMENT MANAGEMENT"}
        title={vehicle ? "公務車輛" : "儀器設備"}
        description={
          vehicle
            ? "從基本資料到保險與維護，集中照顧每一輛車。"
            : "整理設備資訊與保管狀態，讓每項工具都找得到。"
        }
        action={
          can(
            u,
            vehicle ? "VehicleManagement" : "EquipmentManagement",
            "create",
          ) && (
            <button
              className="button primary"
              onClick={() => {
                setEditingResource(undefined);
                setOpen(true);
              }}
            >
              <Plus size={18} />
              新增{vehicle ? "車輛" : "設備"}
            </button>
          )
        }
      />
      <div className="asset-toolbar">
        <div>
          <strong>{vehicle ? "車輛總覽" : "設備總覽"}</strong>
          <span className="count-pill">
            {list.length} {vehicle ? "輛" : "項"}
          </span>
        </div>
        <div className="search-input">
          <Search size={18} />
          <input
            placeholder={
              vehicle ? "搜尋車牌、型號或保管人" : "搜尋設備、位置或保管人"
            }
            aria-label="搜尋資產"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ErrorBox error={query.error} />
      {query.isPending ? (
        <Loading />
      ) : list.length ? (
        <div className="source-table-scroll">
          <table
            className="source-data-table"
            aria-label={vehicle ? "CarList" : "EquipmentList"}
          >
            <thead>
              <tr>
                {(vehicle
                  ? ["編號", "車牌號碼", "車輛類型", "持有人", "備註"]
                  : ["編號", "工具位置編號", "工具名稱", "保管人"]
                ).map((t) => (
                  <th key={t}>{t}</th>
                ))}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{r.source_id ?? r.id}</td>
                  {vehicle ? (
                    <>
                      <td>
                        <Link to={"/vehicles/" + r.id}>
                          <CarFront size={18} /> {r.label}
                        </Link>
                      </td>
                      <td>{r.model || "NULL"}</td>
                      <td>{r.holder || "NULL"}</td>
                      <td>{r.notes || "NULL"}</td>
                    </>
                  ) : (
                    <>
                      <td>{r.location || "NULL"}</td>
                      <td>
                        <Link to={"/equipment/" + r.id}>
                          <Telescope size={18} /> {r.name}
                        </Link>
                      </td>
                      <td>{r.holder || "NULL"}</td>
                    </>
                  )}
                  <td>
                    <div className="source-row-actions">
                      {can(
                        u,
                        vehicle ? "VehicleManagement" : "EquipmentManagement",
                        "write",
                      ) && (
                        <button
                          className="icon-button"
                          aria-label={"編輯資產 " + r.id}
                          onClick={() => {
                            setEditingResource(r);
                            setOpen(true);
                          }}
                        >
                          <Pencil size={19} />
                        </button>
                      )}
                      {can(
                        u,
                        vehicle ? "VehicleManagement" : "EquipmentManagement",
                        "delete",
                      ) && (
                        <button
                          className="icon-button danger"
                          aria-label={"刪除資產 " + r.id}
                          onClick={() => setDeletingResource(r)}
                        >
                          <Trash2 size={19} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="找不到符合的資產"
          description="調整搜尋條件，或新增一筆資產資料。"
        />
      )}
      <ErrorBox error={listError} />
      <AssetEditor
        open={open}
        close={closeEditor}
        kind={kind}
        resource={editingResource}
        quick={!!editingResource}
      />
      <Confirm
        open={!!deletingResource}
        title="刪除資產？"
        description={`將停用 ${deletingResource?.label}，歷史申請與附件仍保留。`}
        onClose={() => setDeletingResource(null)}
        busy={listBusy}
        onConfirm={async () => {
          setListBusy(true);
          try {
            await api("/resources/" + deletingResource!.id, "DELETE");
            await invalidate();
            setDeletingResource(null);
          } catch (e) {
            setListError((e as Error).message);
            setDeletingResource(null);
          } finally {
            setListBusy(false);
          }
        }}
      />
    </>
  );
}
export function AssetDetail() {
  const { id } = useParams(),
    u = useUser(),
    navigate = useNavigate();
  const query = useQuery({
      queryKey: ["resources"],
      queryFn: () => api<Resource[]>("/resources"),
      refetchInterval: 5000,
    }),
    records = useQuery({
      queryKey: ["records", id],
      queryFn: () => api<any[]>("/resources/" + id + "/records"),
    });
  const [tab, setTab] = useState("basic"),
    [edit, setEdit] = useState(false),
    [remove, setRemove] = useState(false),
    [record, setRecord] = useState<any>(null),
    [deleteRecord, setDeleteRecord] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorBox error={query.error} />;
  const r = query.data?.find((r) => r.id === Number(id));
  if (!r)
    return (
      <Empty
        title="找不到這項資產"
        description="資產可能已刪除，請返回清單查看。"
      />
    );
  const vehicle = r.kind === "vehicle";
  const tabs = vehicle
    ? [
        ["basic", "車輛基本資料"],
        ["insurance", "車輛保險紀錄"],
        ["cost", "車輛使用成本"],
        ["maintenance", "保養維護記錄"],
        ["usage", "車輛使用紀錄"],
      ]
    : [
        ["basic", "基本資料"],
        ["usage", "預約紀錄"],
      ];
  async function del() {
    setBusy(true);
    try {
      await api("/resources/" + id, "DELETE");
      await invalidate();
      navigate(vehicle ? "/vehicles" : "/equipment");
    } catch (e) {
      setError((e as Error).message);
      setRemove(false);
    } finally {
      setBusy(false);
    }
  }
  const fields = vehicle
    ? [
        ["車牌", r.label],
        ["廠牌型號", r.model],
        ["車主", r.owner],
        ["保管人", r.holder],
        ["購買日期", r.purchase_date],
        ["購買金額", "NT$ " + money(r.amount)],
        ["乘客數", r.passengers + " 人"],
        ["追蹤器識別", r.client_id || "尚無定位映射"],
        ["聯絡人", r.contact_person],
        ["聯絡電話", r.phone],
        ["管理人", r.manager],
      ]
    : [
        ["設備編碼", r.label],
        ["設備名稱", r.name],
        ["工具位置編號", r.location],
        ["品牌廠商", r.brand],
        ["購買廠商", r.purchase_manufacturer],
        ["維修廠商", r.fix_manufacturer],
        ["保管人", r.holder],
        ["數量", r.quantity],
        ["用途", r.purpose],
        ["列管狀態", r.state],
        ["預估價值", "NT$ " + money(r.estimated_amount)],
        ["委外校正日期", r.fix_date],
        ["有效期限", r.valid_period],
      ];
  return (
    <>
      <Link className="back-link" to={vehicle ? "/vehicles" : "/equipment"}>
        <ArrowLeft size={16} />
        返回{vehicle ? "車輛" : "設備"}清單
      </Link>
      <PageHead
        eyebrow={vehicle ? "VEHICLE PROFILE" : "EQUIPMENT PROFILE"}
        title={vehicle ? r.label : r.name}
        description={vehicle ? r.model : r.label + " · " + r.location}
        action={
          can(
            u,
            vehicle ? "VehicleManagement" : "EquipmentManagement",
            "write",
          ) && (
            <div className="heading-actions">
              {can(
                u,
                vehicle ? "VehicleManagement" : "EquipmentManagement",
                "delete",
              ) && (
                <button className="button" onClick={() => setRemove(true)}>
                  <Trash2 size={16} />
                  刪除
                </button>
              )}
              <button className="button primary" onClick={() => setEdit(true)}>
                <Pencil size={16} />
                編輯資料
              </button>
            </div>
          )
        }
      />
      <ErrorBox error={error} />
      <section className="panel">
        {vehicle && (
          <div className="source-asset-tabs">
            {tabs.map(([v, l]) => (
              <button
                key={v}
                className={tab === v ? "active" : ""}
                onClick={() =>
                  v === "usage"
                    ? navigate("/bookings?kind=A&resource=" + id)
                    : setTab(v)
                }
              >
                {l}
              </button>
            ))}
          </div>
        )}
        {tab === "basic" ? (
          <AssetBasic
            resource={r}
            edit={() => setEdit(true)}
            editable={can(
              u,
              vehicle ? "VehicleManagement" : "EquipmentManagement",
              "write",
            )}
          />
        ) : (
          <>
            <ErrorBox error={records.error} />
            {records.isPending ? (
              <Loading />
            ) : (
              <RecordSections
                tab={tab}
                records={records.data || []}
                user={u}
                edit={setRecord}
                remove={setDeleteRecord}
              />
            )}
          </>
        )}
        {!vehicle && (
          <Link className="button" to={"/bookings?kind=E&resource=" + id}>
            預約紀錄
          </Link>
        )}
      </section>
      <AssetEditor
        open={edit}
        close={() => setEdit(false)}
        kind={r.kind}
        resource={r}
      />
      <RecordEditor
        resourceId={r.id}
        record={record}
        close={() => setRecord(null)}
      />
      <Confirm
        open={remove}
        title="刪除資產？"
        description={`將停用 ${r.label}，新預約將無法選取此資產。歷史申請與附件仍保留。`}
        onClose={() => setRemove(false)}
        onConfirm={del}
        busy={busy}
      />
      <Confirm
        open={!!deleteRecord}
        title="刪除這筆紀錄？"
        description={`將刪除記錄 #${deleteRecord?.id}「${deleteRecord?.company || deleteRecord?.reason || deleteRecord?.name || deleteRecord?.type || "保養廠資料"}」。`}
        onClose={() => setDeleteRecord(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api("/records/" + deleteRecord.id, "DELETE");
            await invalidate();
            setDeleteRecord(null);
          } catch (e) {
            setError((e as Error).message);
            setDeleteRecord(null);
          } finally {
            setBusy(false);
          }
        }}
        busy={busy}
      />
    </>
  );
}
function InsuranceStatus({ date }: { date: string }) {
  const days = Math.round(
    (new Date(date + "T00:00:00+08:00").getTime() -
      new Date(localDate() + "T00:00:00+08:00").getTime()) /
      86400000,
  );
  return (
    <div className={"insurance-status " + (days <= 30 ? "due" : "")}>
      {days < 0
        ? "保險已過期 " + -days + " 天"
        : days === 0
          ? "保險今日到期"
          : days <= 7
            ? "保險即將到期 · 剩 " + days + " 天"
            : days <= 30
              ? "到期提醒 · 剩 " + days + " 天"
              : "保險有效 · 剩 " + days + " 天"}
      <small>預覽環境不發送外部通知</small>
    </div>
  );
}
function AssetEditor({
  open,
  close,
  kind,
  resource,
  quick = false,
}: {
  open: boolean;
  close: () => void;
  kind: string;
  resource?: Resource;
  quick?: boolean;
}) {
  const navigate = useNavigate(),
    vehicle = kind === "vehicle";
  const [data, setData] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accessory, setAccessory] = useState(""),
    [customEquipment, setCustomEquipment] = useState("");
  const [uploads, setUploads] = useState<Record<string, boolean>>({}),
    [baseline, setBaseline] = useState("{}");
  const uploading = Object.values(uploads).some(Boolean);
  const leave = useUnsavedChanges({
    active: open,
    dirty: JSON.stringify(data) !== baseline,
    busy: busy || uploading,
  });
  const requestClose = () => leave.requestClose(close);
  useEffect(() => {
    if (open) {
      const initialData = resource
        ? { ...resource }
        : {
            label: "",
            model: "",
            owner: "",
            purchase_date: localDate(),
            amount: "",
            passengers: 5,
            quantity: 1,
            state: "列管",
            equipment: [],
            accessories: [],
            license_files: [],
            vehicle_files: [],
            contract_files: [],
          };
      setData(initialData);
      setBaseline(JSON.stringify(initialData));
      setUploads({});
      setError("");
    }
  }, [open, resource?.id]);
  function set(k: string, v: any) {
    setData((d: any) => ({ ...d, [k]: v }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<Resource>(
        "/resources" + (resource ? "/" + resource.id : ""),
        resource ? "PUT" : "POST",
        { kind, label: data.label, data },
      );
      leave.release();
      await invalidate();
      close();
      if (!resource) navigate((vehicle ? "/vehicles/" : "/equipment/") + r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const fields = vehicle
    ? [
        ["label", "車牌號碼", "text", true],
        ["model", "廠牌型號", "text", true],
        ["owner", "車主", "text", true],
        ["purchase_date", "購買日期", "date", true],
        ["amount", "金額", "number", true],
        ["passengers", "乘客數", "number", true],
        ["contact_person", "聯絡人", "text", false],
        ["phone", "電話號碼", "text", false],
        ["manager", "管理人", "text", false],
      ]
    : [
        ["location", "工具位置編號", "text", true],
        ["name", "工具名稱", "text", true],
        ["label", "儀器設備編碼", "text", false],
        ["brand", "品牌廠商", "text", false],
        ["purchase_manufacturer", "購買廠商", "text", false],
        ["fix_manufacturer", "維修廠商", "text", false],
        ["quantity", "數量", "number", false],
        ["purpose", "用途", "text", false],
        ["holder", "保管人", "text", false],
        ["estimated_amount", "預估價值", "number", false],
        ["fix_date", "委外校正日期", "date", false],
        ["valid_period", "有效期限", "date", false],
      ];
  function addAccessory() {
    const name =
      accessory === "其他"
        ? customEquipment.trim()
          ? "其他:" + customEquipment.trim()
          : ""
        : accessory.trim();
    if (!name) return;
    const list = [...(data.accessories || [])];
    const index = list.findIndex((a: any) => a.name === name);
    if (index >= 0)
      list[index] = {
        ...list[index],
        quantity: Number(list[index].quantity) + 1,
      };
    else list.push({ name, quantity: 1 });
    set("accessories", list);
    setAccessory("");
    setCustomEquipment("");
  }
  return (
    <Modal
      open={open}
      title={(resource ? "編輯" : "新增") + (vehicle ? "車輛" : "設備")}
      className={!resource ? "source-new-asset-dialog" : undefined}
      onClose={requestClose}
      wide
    >
      <form onSubmit={submit} className="source-asset-editor">
        <datalist id="source-manufacturers">
          {[
            "德偉 DEWALT",
            "美沃奇 Milwaukee",
            "MONTI",
            "QNIX",
            "東訊 TECOM",
            "HIKOKI",
            "SIEMENS",
            "MICRONICS",
            "其他",
          ].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </datalist>
        <div className="fields-grid">
          {fields
            .filter(
              ([key]) =>
                !quick ||
                (vehicle
                  ? ["label", "model", "holder", "notes"]
                  : ["location", "name", "holder"]
                ).includes(String(key)),
            )
            .map(([key, label, type, required]: any) => (
              <Field
                key={key}
                field={key}
                label={quick && key === "model" ? "車輛類型" : label}
                required={required}
              >
                <input
                  type={type}
                  min={type === "number" ? 0 : undefined}
                  step={
                    ["amount", "estimated_amount"].includes(key)
                      ? "0.01"
                      : undefined
                  }
                  required={required}
                  value={data[key] ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                />
              </Field>
            ))}
          {vehicle && (
            <div className="span-2">
              <details open={quick}>
                <summary>資產管理資訊</summary>
                <div className="fields-grid">
                  <Field field="holder" label={quick ? "持有人" : "保管人"}>
                    <input
                      value={data.holder || ""}
                      onChange={(e) => set("holder", e.target.value)}
                    />
                  </Field>
                  {!quick && (
                    <Field field="client_id" label="追蹤器 client_id">
                      <input
                        value={data.client_id || ""}
                        onChange={(e) => set("client_id", e.target.value)}
                      />
                    </Field>
                  )}
                </div>
              </details>
            </div>
          )}
          {!vehicle && !quick && (
            <Field label="列管建議">
              <select
                value={data.state || "列管"}
                onChange={(e) => set("state", e.target.value)}
              >
                <option>列管</option>
                <option>不列管</option>
                <option>停用</option>
              </select>
            </Field>
          )}
          {!quick && (
            <div className="span-2">
              {vehicle ? (
                <>
                  <Field label="隨車設備">
                    <div className="purpose-grid">
                      {Array.from(
                        new Set([
                          "跨接電纜",
                          "汽車行動電源",
                          "電子設備",
                          "備胎",
                          ...(data.equipment || []),
                        ]),
                      ).map((name: any) => (
                        <label key={name}>
                          <input
                            type="checkbox"
                            checked={data.equipment?.includes(name) || false}
                            onChange={(e) =>
                              set(
                                "equipment",
                                e.target.checked
                                  ? [...(data.equipment || []), name]
                                  : data.equipment.filter(
                                      (x: string) => x !== name,
                                    ),
                              )
                            }
                          />
                          {name}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <div className="inline-input">
                    <input
                      placeholder="自訂隨車設備"
                      value={customEquipment}
                      onChange={(e) => setCustomEquipment(e.target.value)}
                    />
                    <button
                      className="button compact"
                      type="button"
                      onClick={() => {
                        if (customEquipment.trim())
                          set(
                            "equipment",
                            Array.from(
                              new Set([
                                ...(data.equipment || []),
                                customEquipment.trim(),
                              ]),
                            ),
                          );
                        setCustomEquipment("");
                      }}
                    >
                      加入
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Field label="設備配件">
                    <div className="inline-input">
                      <input
                        list="accessories"
                        value={accessory}
                        onChange={(e) => setAccessory(e.target.value)}
                        placeholder="選擇或輸入配件名稱"
                      />
                      <datalist id="accessories">
                        {[...accessories, "其他"].map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </datalist>
                      <button
                        className="button compact"
                        type="button"
                        onClick={addAccessory}
                      >
                        <Plus size={16} />
                        加入
                      </button>
                    </div>
                  </Field>
                  {accessory === "其他" && (
                    <Field label="自訂配件名稱">
                      <input
                        value={customEquipment}
                        onChange={(e) => setCustomEquipment(e.target.value)}
                      />
                    </Field>
                  )}
                  <div className="source-equipment-accessories">
                    {data.accessories?.map((a: any, i: number) => (
                      <div className="accessory-row" key={i}>
                        <Package size={17} />
                        <strong>{a.name}</strong>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={"減少 " + a.name}
                          disabled={Number(a.quantity) <= 1}
                          onClick={() =>
                            set(
                              "accessories",
                              a.quantity <= 1
                                ? data.accessories.filter(
                                    (_: any, j: number) => j !== i,
                                  )
                                : data.accessories.map((x: any, j: number) =>
                                    j === i
                                      ? {
                                          ...x,
                                          quantity: Number(x.quantity) - 1,
                                        }
                                      : x,
                                  ),
                            )
                          }
                        >
                          −
                        </button>
                        <input
                          aria-label={a.name + "數量"}
                          type="number"
                          min={0}
                          value={a.quantity}
                          onChange={(e) => {
                            const count = Number(e.target.value);
                            set(
                              "accessories",
                              count <= 0
                                ? data.accessories.filter(
                                    (_: any, j: number) => j !== i,
                                  )
                                : data.accessories.map((x: any, j: number) =>
                                    i === j ? { ...x, quantity: count } : x,
                                  ),
                            );
                          }}
                        />
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={"增加 " + a.name}
                          onClick={() =>
                            set(
                              "accessories",
                              data.accessories.map((x: any, j: number) =>
                                j === i
                                  ? { ...x, quantity: Number(x.quantity) + 1 }
                                  : x,
                              ),
                            )
                          }
                        >
                          +
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={"移除配件 " + a.name}
                          onClick={() =>
                            set(
                              "accessories",
                              data.accessories.filter(
                                (_: any, j: number) => j !== i,
                              ),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {!!data.accessories?.length && (
                    <p className="source-accessory-total">
                      總計：
                      {data.accessories.reduce(
                        (sum: number, a: any) => sum + Number(a.quantity),
                        0,
                      )}{" "}
                      個配件
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <div className="span-2">
            <Field label="備註">
              <textarea
                rows={3}
                value={data.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
          {!quick &&
            assetFiles(vehicle).map(([key, label]) => (
              <div className="span-2" key={key}>
                <Field label={label}>
                  <FileUpload
                    value={data[key] || []}
                    onBusyChange={(v) =>
                      setUploads((x) => ({ ...x, [key]: v }))
                    }
                    onChange={(v) => set(key, v)}
                  />
                </Field>
              </div>
            ))}
        </div>
        <ErrorBox error={error} />
        <div className="actions">
          <button
            type="button"
            className="button"
            disabled={busy || uploading}
            onClick={requestClose}
          >
            取消
          </button>
          <button className="button primary" disabled={busy || uploading}>
            {busy ? "保存中…" : "儲存資料"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function RecordEditor({
  resourceId,
  record,
  close,
}: {
  resourceId: number;
  record: any;
  close: () => void;
}) {
  const [data, setData] = useState<any>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Record<string, boolean>>({}),
    [baseline, setBaseline] = useState("{}");
  const uploading = Object.values(uploads).some(Boolean);
  const leave = useUnsavedChanges({
    active: !!record,
    dirty: JSON.stringify(data) !== baseline,
    busy: busy || uploading,
  });
  const requestClose = () => leave.requestClose(close);
  useEffect(() => {
    if (record) {
      setData({ ...record.data });
      setBaseline(JSON.stringify(record.data));
      setUploads({});
      setError("");
    }
  }, [record]);
  const category = record?.category;
  const fields: any =
    category === "insurance"
      ? [
          ["company", "保險公司名稱", "text", true],
          ["phone", "公司電話", "text"],
          ["expiry", "有效期限", "date", true],
          ["employee", "業務人員", "text"],
          ["employee_phone", "業務人員電話", "text"],
          ["roadside", "道路救援", "text"],
        ]
      : category === "cost"
        ? [
            ["amount", "金額", "number", true],
            ["reason", "緣由", "text", true],
          ]
        : category === "maintenance"
          ? [["date", "記錄日期", "date", true]]
          : category === "manager"
            ? [["name", "管理人員姓名", "text", true]]
            : [];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading || busy) return;
    setBusy(true);
    try {
      await api(
        record.id
          ? "/records/" + record.id
          : "/resources/" + resourceId + "/records",
        record.id ? "PUT" : "POST",
        { category, data },
      );
      leave.release();
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
      open={!!record}
      title={
        (record?.id ? "編輯" : "新增") +
        ({
          insurance: "保險資料",
          cost: "成本記錄",
          maintenance: "維護記錄",
          garage: "保養廠檔案",
          manager: "車輛管理人員",
        }[category as string] || "資產紀錄")
      }
      onClose={requestClose}
    >
      <Scope doc={category === "insurance" ? "Insurance" : "Cost"}>
        <form onSubmit={submit}>
          <div className="fields-grid">
            {["cost", "maintenance"].includes(category) && (
              <div className="span-2">
                <Field
                  label={category === "maintenance" ? "記錄類型" : "類型"}
                  required
                >
                  <select
                    required
                    value={data.type || ""}
                    onChange={(e) => setData({ ...data, type: e.target.value })}
                  >
                    <option value="">請選擇</option>
                    {(category === "cost"
                      ? ["保費", "保養", "維修"]
                      : ["驗車", "定期保養", "維修"]
                    ).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            {fields.map(([key, label, type, required]: any) => (
              <Field key={key} field={key} label={label} required={required}>
                <input
                  type={type}
                  min={type === "number" ? 0 : undefined}
                  step={type === "number" ? "0.01" : undefined}
                  required={required}
                  value={data[key] ?? ""}
                  onChange={(e) => setData({ ...data, [key]: e.target.value })}
                />
              </Field>
            ))}
            <div className="span-2">
              <Field label="備註">
                <textarea
                  rows={3}
                  value={data.notes || ""}
                  onChange={(e) => setData({ ...data, notes: e.target.value })}
                />
              </Field>
            </div>
            {category === "insurance" ? (
              <>
                {[
                  ["policy_files", "保單檔案"],
                  ["claim_files", "出險資料"],
                ].map(([key, label]) => (
                  <div className="span-2" key={key}>
                    <Field label={label}>
                      <FileUpload
                        onBusyChange={(v) =>
                          setUploads((x) => ({ ...x, [key]: v }))
                        }
                        value={data[key] || []}
                        onChange={(v) => setData({ ...data, [key]: v })}
                      />
                    </Field>
                  </div>
                ))}
                {data.attachments?.length > 0 && (
                  <div className="span-2">
                    <Field label="舊版未分類附件">
                      <FileUpload
                        onBusyChange={(v) =>
                          setUploads((x) => ({ ...x, attachments: v }))
                        }
                        value={data.attachments}
                        onChange={(v) => setData({ ...data, attachments: v })}
                      />
                    </Field>
                  </div>
                )}
              </>
            ) : (
              <div className="span-2">
                <Field label="附件">
                  <FileUpload
                    onBusyChange={(v) =>
                      setUploads((x) => ({ ...x, attachments: v }))
                    }
                    value={data.attachments || []}
                    onChange={(v) => setData({ ...data, attachments: v })}
                  />
                </Field>
              </div>
            )}
          </div>
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
              {busy ? "儲存中…" : "儲存紀錄"}
            </button>
          </div>
        </form>
      </Scope>
    </Modal>
  );
}
