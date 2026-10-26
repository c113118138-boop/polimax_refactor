import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  api,
  Booking,
  Resource,
  invalidate,
  localDate,
  localInput,
  dateTime,
} from "./api";
import { useUser } from "./App";
import { can, bookingDoc, Scope } from "./Access";
import { useUnsavedChanges } from "./NavigationGuard";
import { Field, ErrorBox, Loading } from "./ui";
import { FieldGroup, FormPanel, RecordGrid } from "./FormLayout";

const reasonsA = [
  "工案",
  "材料送貨",
  "新開發案",
  "客戶拜訪",
  "成交案回訪",
  "參展",
  "其他",
];
const reasonsE = [
  "開案",
  "成案（施工前量測）",
  "成案（完工量測）",
  "成案（服務回訪）",
  "儀器設備保養／校正",
  "儀器設備維修",
  "其它",
];
const purposes = [
  "廠內",
  "廠外施工",
  "廠外出差",
  "量測",
  "材料送貨",
  "載回工件",
  "送回工件",
  "動平衡（去）",
  "動平衡（回）",
  "加工（去）",
  "加工（回）",
  "五金採買",
  "廠務",
  "工件備品採購",
  "每月消耗品採購",
];
type Detail = {
  name: string;
  city: string;
  district: string;
  leader?: string;
  sales?: string[];
  notes?: string;
  notes2?: string;
};
type Slot = {
  resource_id: number;
  start: string;
  end: string;
  detail_index?: number;
  [key: string]: any;
};
type Content = {
  title: string;
  applicant: string;
  application_date: string;
  total_people: number;
  reason: string;
  details: Detail[];
  slots: Slot[];
  employees: string[];
  purposes: string[];
  notes: string;
  other_purpose: string;
  other_processing: string;
  reason_drafts: Record<string, any>;
  [key: string]: any;
};

function People({
  value,
  change,
  label,
  field = "employees",
}: {
  value: string[];
  change: (v: string[]) => void;
  label: string;
  field?: string;
}) {
  const u = useUser();
  return (
    <Field
      label={label}
      field={field}
      required={field === "employees"}
      hint="第一位帶入登入者；第二位可手動輸入。"
    >
      <div className="source-people">
        <input
          aria-label={"第一位" + label}
          readOnly
          value={value[0] || u.name}
        />
        <input
          aria-label={"第二位" + label}
          value={value.slice(1).join("、")}
          placeholder="第二位姓名（選填）"
          onChange={(e) =>
            change([
              value[0] || u.name,
              ...e.target.value.split(/[、,，]/).filter(Boolean),
            ])
          }
        />
      </div>
    </Field>
  );
}

export function BookingForm() {
  const { kind, id } = useParams();
  return <BorrowingForm key={`${id || "new"}:${kind || "A"}`} />;
}

export function BorrowingForm({
  bookingId,
  formKind,
  readOnly = false,
  onSaved,
  onCancel,
}: {
  bookingId?: string;
  formKind?: string;
  readOnly?: boolean;
  onSaved?: (booking: Booking) => void;
  onCancel?: () => void;
} = {}) {
  const routeParams = useParams();
  const routeKind = formKind || routeParams.kind,
    id = bookingId || routeParams.id;
  const u = useUser(),
    location = useLocation(),
    navigate = useNavigate();
  const source = useQuery({
    queryKey: ["booking", id],
    queryFn: () => api<Booking>("/bookings/" + id),
    enabled: !!id,
  });
  const resources = useQuery({
    queryKey: ["resources"],
    queryFn: () => api<Resource[]>("/resources"),
  });
  const options = useQuery({
    queryKey: ["options"],
    queryFn: () => api<any>("/options"),
  });
  const kind = source.data?.kind || routeKind || "A",
    room = kind === "D",
    equipment = kind === "E";
  const selected = location.state as {
    start?: string;
    end?: string;
    resource?: number;
  } | null;
  const firstSlot = (): Slot => ({
    resource_id: selected?.resource || 0,
    start: selected?.start
      ? localInput(selected.start)
      : localDate() + "T09:00:00",
    end: selected?.end ? localInput(selected.end) : localDate() + "T17:00:00",
    detail_index: 0,
  });
  const [data, setData] = useState<Content>(() => ({
    title: room ? "作業區租用" : "",
    applicant: u.name,
    application_date: localDate(),
    total_people: 1,
    reason: room ? "作業區租用" : equipment ? "開案" : "工案",
    details: [],
    slots: [],
    employees: [u.name],
    purposes: [],
    notes: "",
    other_purpose: "",
    other_processing: "",
    reason_drafts: {},
  }));
  const [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<Record<string, boolean>>({});
  const leaveGuard = useUnsavedChanges({
    dirty: !readOnly && (dirty || Object.values(pending).some(Boolean)),
    busy,
  });
  const [floorChoices, setFloorChoices] = useState<string[]>([]),
    [areas, setAreas] = useState<string[]>([]);
  const [equipmentId, setEquipmentId] = useState(selected?.resource || 0);
  const [roomPeriod, setRoomPeriod] = useState(() => ({
    start: firstSlot().start,
    end: firstSlot().end,
  }));
  const rs = resources.data || [],
    allowed = rs.filter(
      (r) =>
        r.kind === (room ? "room" : equipment ? "equipment" : "vehicle") &&
        r.state !== "停用",
    );
  const rooms = allowed.filter((r) => r.kind === "room");
  const chosenEquipment = allowed.find((r) => r.id === equipmentId);
  const cities = options.data?.cities || {};
  const blankDetail = (): Detail => ({
    name: "",
    city: "",
    district: "",
    leader: "",
    sales: [u.name],
    notes: "",
    notes2: "",
  });
  const update = (key: string, value: any) => {
    setData((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setError("");
  };
  useEffect(() => {
    if (!source.data) return;
    const c = source.data.content;
    if ((source.data.slots || []).length)
      setRoomPeriod({
        start: localInput(source.data.slots?.[0].start),
        end: localInput(source.data.slots?.[0].end),
      });
    setData((d) => ({
      ...d,
      ...c,
      reason_drafts: c.reason_drafts || {},
      slots: (source.data!.slots || []).map((s: any, i) => ({
        ...s,
        start: localInput(s.start),
        end: localInput(s.end),
        detail_index:
          s.detail_index ??
          c.slots?.[i]?.detail_index ??
          Math.min(i, Math.max(0, (c.details?.length || 0) - 1)),
      })),
    }));
    setEquipmentId(
      c.equipment_id ||
        c.slots?.[0]?.resource_id ||
        source.data.slots?.[0]?.resource_id ||
        0,
    );
    setDirty(false);
  }, [source.data]);
  useEffect(() => {
    if (!room || !rs.length) return;
    if (source.data) {
      const chosen = (source.data.slots || [])
        .map((s) => rs.find((r) => r.id === s.resource_id))
        .filter(Boolean) as Resource[];
      setFloorChoices([...new Set(chosen.map((r) => r.floor || "其他"))]);
      setAreas([
        ...new Set(
          chosen.map((r) => (r.floor || "其他") + "/" + (r.area || r.label)),
        ),
      ]);
    }
  }, [source.data, resources.data, room]);
  function cancel() {
    leaveGuard.requestClose(() =>
      onCancel ? onCancel() : navigate(id ? "/bookings/" + id : "/"),
    );
  }
  function changeReason(reason: string) {
    if (Object.values(pending).some(Boolean)) {
      setError("請先保存或取消正在編輯的資料列，再切換類別。");
      return;
    }
    setData((d) => ({
      ...d,
      reason,
      reason_drafts: {
        ...d.reason_drafts,
        [d.reason]: { details: d.details, slots: d.slots },
      },
      details: d.reason_drafts[reason]?.details || [],
      slots: d.reason_drafts[reason]?.slots || [],
    }));
    setDirty(true);
  }
  function changeDetails(details: Detail[]) {
    setData((d) => {
      const removed =
        details.length < d.details.length
          ? d.details.findIndex((row) => !details.includes(row))
          : -1;
      return {
        ...d,
        details,
        slots:
          removed < 0
            ? d.slots
            : d.slots.map((s) => ({
                ...s,
                detail_index:
                  (s.detail_index ?? 0) === removed
                    ? -1
                    : (s.detail_index ?? 0) > removed
                      ? (s.detail_index ?? 0) - 1
                      : s.detail_index,
              })),
      };
    });
    setDirty(true);
  }
  const detailLabel = equipment
    ? data.reason.includes("保養") || data.reason.includes("維修")
      ? "廠商"
      : data.reason === "其它"
        ? "備註1"
        : "工案編號"
    : (
        {
          工案: "工案編號",
          材料送貨: "業主名稱",
          新開發案: "開發案編號與名稱",
          客戶拜訪: "客戶名稱",
          成交案回訪: "工案編號",
          參展: "展覽名稱",
          其他: "備註",
        } as Record<string, string>
      )[data.reason];
  const vendor =
    equipment && (data.reason.includes("保養") || data.reason.includes("維修"));
  const withLeader = equipment
    ? data.reason.startsWith("成案")
    : ["工案", "成交案回訪"].includes(data.reason);
  const withSales = equipment
    ? data.reason === "開案" || data.reason.startsWith("成案")
    : ["工案", "材料送貨", "新開發案", "成交案回訪"].includes(data.reason);
  const locationFirst =
    (!equipment &&
      ["材料送貨", "客戶拜訪", "參展", "其他"].includes(data.reason)) ||
    (equipment && data.reason === "其它");
  function detailError(d: Detail) {
    if (
      !String(d.name || "").trim() &&
      !(kind === "A" && data.reason === "材料送貨")
    )
      return "請填寫" + detailLabel;
    if (
      (kind === "A" ||
        (equipment &&
          (data.reason.startsWith("成案") || data.reason === "其它"))) &&
      !d.city
    )
      return "請選擇縣市";
    if (d.district && !(cities[d.city] || []).includes(d.district))
      return "行政區不屬於所選縣市";
    return "";
  }
  function slotError(s: Slot) {
    if (!allowed.some((r) => r.id === Number(s.resource_id)))
      return "請選擇有效資源";
    if (
      !s.start ||
      !s.end ||
      !Number.isFinite(Date.parse(s.start)) ||
      !Number.isFinite(Date.parse(s.end))
    )
      return "請填寫開始與結束時間";
    if (s.start > s.end || (kind !== "A" && s.start === s.end))
      return "結束時間必須晚於開始時間";
    if (!room && !data.details[s.detail_index ?? 0])
      return "請選擇對應的需求明細";
    return "";
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (Object.values(pending).some(Boolean)) {
      setError("請先保存或取消正在編輯的資料列，再送出表單。");
      return;
    }
    if (!room && !data.details.length) {
      setError("請至少新增一筆需求明細");
      return;
    }
    if (!data.slots.length) {
      setError(room ? "請選擇樓層、區域及編號" : "請至少新增一筆借用時段");
      return;
    }
    if (equipment && !chosenEquipment) {
      setError("請選擇外借項目名稱");
      return;
    }
    if (
      room &&
      (!floorChoices.length ||
        floorChoices.some((f) => !areas.some((a) => a.startsWith(f + "/"))) ||
        areas.some(
          (a) =>
            !data.slots.some((s) => {
              const r = rooms.find((r) => r.id === s.resource_id);
              return r && (r.floor || "其他") + "/" + (r.area || r.label) === a;
            }),
        ))
    ) {
      setError("請為每個已選樓層選擇區域，並為各區域選擇編號。");
      return;
    }
    if (!room && data.details.some((d) => detailError(d))) {
      setError(
        "請檢查需求明細：" +
          data.details.map(detailError).filter(Boolean).join("；"),
      );
      return;
    }
    const badSlot = data.slots.map(slotError).find(Boolean);
    if (badSlot) {
      setError(badSlot);
      return;
    }
    if (
      kind === "A" &&
      (!Number.isInteger(Number(data.total_people)) ||
        Number(data.total_people) < 1)
    ) {
      setError("總使用人數至少為 1");
      return;
    }
    if (
      kind === "A" &&
      data.details.length !== 1 &&
      (data.details.length !== data.slots.length ||
        new Set(data.slots.map((s) => s.detail_index ?? 0)).size !==
          data.details.length)
    ) {
      setError("明細與時段須一對一，或一筆明細對應多個時段");
      return;
    }
    if (
      (data.purposes.includes("其他") && !data.other_purpose.trim()) ||
      (data.purposes.includes("其他加工") && !data.other_processing.trim())
    ) {
      setError("請填寫其他用途／加工說明");
      return;
    }
    setBusy(true);
    try {
      const content = {
        ...data,
        // Keep the API/list title contract without an extra source-form field.
        title: data.title?.trim() ? data.title : data.reason,
        employees: [
          ...new Set(data.employees.map((n) => n.trim()).filter(Boolean)),
        ],
        details: data.details.map((d) => ({
          ...d,
          sales: [
            ...new Set((d.sales || []).map((n) => n.trim()).filter(Boolean)),
          ],
        })),
      };
      const result = await api<Booking>(
        "/bookings" + (id ? "/" + id : ""),
        id ? "PUT" : "POST",
        { kind, content, revision: source.data?.revision },
      );
      leaveGuard.release();
      setDirty(false);
      await invalidate();
      if (onSaved) onSaved(result);
      else navigate("/bookings/" + result.id, { state: { saved: true } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if ((id && source.isPending) || resources.isPending || options.isPending)
    return <Loading />;
  if (source.error || resources.error || options.error)
    return (
      <ErrorBox error={source.error || resources.error || options.error} />
    );
  if (
    !["A", "D", "E"].includes(kind) ||
    !can(u, bookingDoc(kind), readOnly ? "read" : id ? "write" : "create")
  )
    return <ErrorBox error="沒有此表單的操作權限" />;
  const gridPending = (name: string) => (v: boolean) =>
    setPending((p) => ({ ...p, [name]: v }));
  const detailHeadings = vendor
    ? [detailLabel]
    : [
        ...(locationFirst
          ? ["縣市", "區域", detailLabel]
          : [detailLabel, "縣市", "區域"]),
        ...(withLeader ? ["工程組長"] : []),
        ...(withSales ? ["業務"] : []),
        ...(equipment && data.reason.startsWith("成案") ? ["備註"] : []),
        ...(equipment && data.reason === "其它" ? ["備註2"] : []),
      ];
  const detailEditor = (d: Detail, set: (v: Detail) => void, i: number) => {
    const name = (
      <Field
        label={detailLabel}
        required={!(kind === "A" && data.reason === "材料送貨")}
        field="name"
      >
        <input
          name={`details.${i}.name`}
          value={d.name}
          onChange={(e) => set({ ...d, name: e.target.value })}
        />
      </Field>
    );
    const place = (
      <>
        <Field
          label="縣市"
          required={
            kind === "A" ||
            (equipment &&
              (data.reason.startsWith("成案") || data.reason === "其它"))
          }
          field="city"
        >
          <select
            name={`details.${i}.city`}
            value={d.city}
            onChange={(e) => set({ ...d, city: e.target.value, district: "" })}
          >
            <option value="">選擇縣市</option>
            {Object.keys(cities).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="行政區" field="district">
          <select
            name={`details.${i}.district`}
            disabled={!d.city}
            value={d.district}
            onChange={(e) => set({ ...d, district: e.target.value })}
          >
            <option value="">選擇行政區</option>
            {(cities[d.city] || []).map((v: string) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      </>
    );
    return (
      <>
        {locationFirst && place}
        {name}
        {!vendor && !locationFirst && place}
        {withLeader && (
          <Field label="工程組長" field="leader">
            <input
              name={`details.${i}.leader`}
              value={d.leader || ""}
              placeholder="工程組長姓名"
              onChange={(e) => set({ ...d, leader: e.target.value })}
            />
          </Field>
        )}
        {withSales && (
          <People
            label="業務人員"
            field="sales"
            value={d.sales || [u.name]}
            change={(sales) => set({ ...d, sales })}
          />
        )}
        {equipment && data.reason.startsWith("成案") && (
          <Field label="備註" field="notes">
            <input
              value={d.notes || ""}
              onChange={(e) => set({ ...d, notes: e.target.value })}
            />
          </Field>
        )}
        {equipment && data.reason === "其它" && (
          <Field label="備註2" field="notes2">
            <input
              value={d.notes2 || ""}
              onChange={(e) => set({ ...d, notes2: e.target.value })}
            />
          </Field>
        )}
      </>
    );
  };
  const detailGrid = (
    <FieldGroup field="details">
      <RecordGrid
        key={data.reason}
        name="明細"
        rows={data.details}
        change={changeDetails}
        blank={blankDetail}
        headings={detailHeadings}
        summary={(d) =>
          vendor
            ? [d.name]
            : [
                ...(locationFirst
                  ? [d.city, d.district, d.name]
                  : [d.name, d.city, d.district]),
                ...(withLeader ? [d.leader] : []),
                ...(withSales ? [(d.sales || []).join("、")] : []),
                ...(equipment && data.reason.startsWith("成案")
                  ? [d.notes]
                  : []),
                ...(equipment && data.reason === "其它" ? [d.notes2] : []),
              ]
        }
        editor={detailEditor}
        validate={detailError}
        pendingChange={gridPending("details")}
      />
    </FieldGroup>
  );
  const timeGrid = (
    <FieldGroup field="slots">
      <RecordGrid
        key={data.reason}
        name="時段"
        repeatHeader={kind === "A"}
        rows={data.slots}
        change={(slots) => update("slots", slots)}
        blank={() => ({
          ...firstSlot(),
          resource_id: equipment ? equipmentId : firstSlot().resource_id,
        })}
        headings={[
          "類別",
          equipment ? "設備" : "車輛",
          "借用時段開始",
          "借用時段結束",
        ]}
        widths={[16.667, 16.667, 25, 25, 16.666]}
        summary={(s) => [
          data.details[s.detail_index ?? 0]?.name,
          allowed.find((r) => r.id === s.resource_id)?.name ||
            allowed.find((r) => r.id === s.resource_id)?.label,
          dateTime(s.start),
          dateTime(s.end),
        ]}
        validate={slotError}
        pendingChange={gridPending("slots")}
        editor={(s, set, i) => (
          <>
            <Field label="類別" field="detail_index">
              <select
                name={`slots.${i}.detail_index`}
                value={s.detail_index ?? 0}
                onChange={(e) =>
                  set({ ...s, detail_index: Number(e.target.value) })
                }
              >
                <option value={-1}>選擇對應明細</option>
                {data.details.map((d, j) => (
                  <option key={j} value={j}>
                    {d.name || d.city || `明細 ${j + 1}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={equipment ? "儀器設備" : "公務車牌"}
              required
              field="resource_id"
            >
              <select
                name={`slots.${i}.resource_id`}
                value={s.resource_id}
                onChange={(e) =>
                  set({ ...s, resource_id: Number(e.target.value) })
                }
              >
                <option value={0}>選擇{equipment ? "設備" : "車輛"}</option>
                {allowed.map((r) => (
                  <option key={r.id} value={r.id}>
                    {equipment ? r.name || r.label : r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="借用開始" required field="start">
              <input
                name={`slots.${i}.start`}
                type="datetime-local"
                step="1"
                value={s.start}
                onChange={(e) => set({ ...s, start: e.target.value })}
              />
            </Field>
            <Field label="借用結束" required field="end">
              <input
                name={`slots.${i}.end`}
                type="datetime-local"
                step="1"
                value={s.end}
                onChange={(e) => set({ ...s, end: e.target.value })}
              />
            </Field>
            {equipment && s.resource_id > 0 && (
              <p className="source-equipment-location">
                位置：
                {allowed.find((r) => r.id === s.resource_id)?.location || "—"}
                　保管人：
                {allowed.find((r) => r.id === s.resource_id)?.holder || "—"}
              </p>
            )}
          </>
        )}
      />
    </FieldGroup>
  );
  function roomTime(key: "start" | "end", value: string) {
    setRoomPeriod((period) => ({ ...period, [key]: value }));
    update(
      "slots",
      data.slots.map((s) => ({ ...s, [key]: value })),
    );
  }
  function roomSelection(ids: number[]) {
    update(
      "slots",
      ids.map((rid) => ({
        ...(data.slots.find((s) => s.resource_id === rid) || {
          ...firstSlot(),
          ...roomPeriod,
        }),
        resource_id: rid,
      })),
    );
  }
  function toggleFloor(floor: string, on: boolean) {
    setFloorChoices((f) => (on ? [...f, floor] : f.filter((v) => v !== floor)));
    if (!on) {
      setAreas((a) => a.filter((v) => !v.startsWith(floor + "/")));
      roomSelection(
        data.slots
          .filter(
            (s) =>
              (rooms.find((r) => r.id === s.resource_id)?.floor || "其他") !==
              floor,
          )
          .map((s) => s.resource_id),
      );
    }
  }
  function toggleArea(floor: string, area: string, on: boolean) {
    const key = floor + "/" + area;
    setAreas((a) => (on ? [...a, key] : a.filter((v) => v !== key)));
    const matches = rooms.filter(
      (r) => (r.floor || "其他") === floor && (r.area || r.label) === area,
    );
    const kept = data.slots
      .filter((s) => !matches.some((r) => r.id === s.resource_id))
      .map((s) => s.resource_id)
      .filter(Boolean);
    roomSelection(on && matches.length === 1 ? [...kept, matches[0].id] : kept);
  }
  return (
    <Scope doc={bookingDoc(kind)}>
      <div
        className={
          "source-form-page" + (readOnly ? " source-readonly-form" : "")
        }
      >
        <h1>
          {id && !readOnly ? "編輯 · " : ""}
          {room
            ? "作業區／工具間預約"
            : equipment
              ? "儀器設備外借"
              : "車輛使用需求單"}
        </h1>
        <form
          onSubmit={(e) => {
            if (readOnly) e.preventDefault();
            else submit(e);
          }}
          className="source-form"
        >
          <fieldset disabled={readOnly} className="source-readonly-fieldset">
            {room ? (
              <FormPanel title="申請資料">
                <Field label="申請人" required field="applicant">
                  <input name="applicant" readOnly value={data.applicant} />
                </Field>
                <FieldGroup field="slots">
                  <Field label="開始時間" required field="start">
                    <input
                      name="room.start"
                      type="datetime-local"
                      step="1"
                      value={roomPeriod.start}
                      onChange={(e) => roomTime("start", e.target.value)}
                    />
                  </Field>
                  <Field label="結束時間" required field="end">
                    <input
                      name="room.end"
                      type="datetime-local"
                      step="1"
                      value={roomPeriod.end}
                      onChange={(e) => roomTime("end", e.target.value)}
                    />
                  </Field>
                  <Field label="租用樓層地點" required field="resource_id">
                    <div className="source-checkbox-list">
                      {[...new Set(rooms.map((r) => r.floor || "其他"))]
                        .sort()
                        .map((f) => (
                          <label key={f}>
                            <input
                              type="checkbox"
                              checked={floorChoices.includes(f)}
                              onChange={(e) => toggleFloor(f, e.target.checked)}
                            />
                            {f === "1F"
                              ? "1F施工區域"
                              : f === "2F"
                                ? "2F辦公區"
                                : f}
                          </label>
                        ))}
                    </div>
                  </Field>
                  {[...floorChoices].sort().map((floor) => (
                    <div key={floor}>
                      <Field
                        label={floor === "2F" ? "2F辦公區" : floor + "施工區域"}
                        required
                        field="resource_id"
                      >
                        <div className="source-checkbox-list">
                          {[
                            ...new Set(
                              rooms
                                .filter((r) => (r.floor || "其他") === floor)
                                .map((r) => r.area || r.label),
                            ),
                          ].map((area) => (
                            <label key={area}>
                              <input
                                type="checkbox"
                                checked={areas.includes(floor + "/" + area)}
                                onChange={(e) =>
                                  toggleArea(floor, area, e.target.checked)
                                }
                              />
                              {area}
                            </label>
                          ))}
                        </div>
                      </Field>
                      {[
                        ...new Set(
                          rooms
                            .filter((r) => (r.floor || "其他") === floor)
                            .map((r) => r.area || r.label),
                        ),
                      ]
                        .filter((area) => areas.includes(floor + "/" + area))
                        .sort((a, b) => {
                          const order = [
                            "拆組裝區",
                            "批覆區",
                            "研磨與氣動除鏽區",
                          ];
                          return (
                            (order.includes(a) ? order.indexOf(a) : 99) -
                            (order.includes(b) ? order.indexOf(b) : 99)
                          );
                        })
                        .map((area) => {
                          const matches = rooms.filter(
                            (r) =>
                              (r.floor || "其他") === floor &&
                              (r.area || r.label) === area,
                          );
                          return (
                            matches.length > 1 && (
                              <Field
                                key={area}
                                label={area + "編號"}
                                required
                                field="resource_id"
                              >
                                <div className="source-checkbox-list">
                                  {matches.map((r) => (
                                    <label key={r.id}>
                                      <input
                                        type="checkbox"
                                        checked={data.slots.some(
                                          (s) => s.resource_id === r.id,
                                        )}
                                        onChange={(e) =>
                                          roomSelection(
                                            e.target.checked
                                              ? [
                                                  ...data.slots
                                                    .map((s) => s.resource_id)
                                                    .filter(Boolean),
                                                  r.id,
                                                ]
                                              : data.slots
                                                  .filter(
                                                    (s) =>
                                                      s.resource_id !== r.id,
                                                  )
                                                  .map((s) => s.resource_id),
                                          )
                                        }
                                      />
                                      {r.unit || r.label}
                                    </label>
                                  ))}
                                </div>
                              </Field>
                            )
                          );
                        })}
                    </div>
                  ))}
                  {data.slots.filter((s) => s.resource_id > 0).length > 0 && (
                    <p className="source-selected-rooms">
                      已選區域：
                      {data.slots
                        .map(
                          (s) =>
                            rooms.find((r) => r.id === s.resource_id)?.label,
                        )
                        .filter(Boolean)
                        .join("、")}
                    </p>
                  )}
                </FieldGroup>
              </FormPanel>
            ) : (
              <>
                <FormPanel title={equipment ? "借用人資料" : "預約基本資訊"}>
                  <Field label="申請日期" required field="application_date">
                    <input
                      name="application_date"
                      type="date"
                      readOnly
                      value={data.application_date.slice(0, 10)}
                    />
                  </Field>
                  <Field label="申請人" field="applicant">
                    <input name="applicant" readOnly value={data.applicant} />
                  </Field>
                </FormPanel>
                <FormPanel
                  title={equipment ? "外借需求" : "車輛借用用途及細項"}
                >
                  {equipment ? (
                    <>
                      <Field label="外借項目名稱" required field="equipment_id">
                        <select
                          value={equipmentId}
                          onChange={(e) => {
                            setEquipmentId(Number(e.target.value));
                            update("equipment_id", Number(e.target.value));
                          }}
                        >
                          <option value={0}>選擇儀器設備</option>
                          {allowed.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name || r.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="儀器設備編碼" field="equipment_code">
                        <input readOnly value={chosenEquipment?.label || ""} />
                      </Field>
                      <Field label="位置編碼" field="location">
                        <input
                          readOnly
                          value={chosenEquipment?.location || ""}
                        />
                      </Field>
                    </>
                  ) : (
                    <Field label="總使用人數" required field="total_people">
                      <input
                        name="total_people"
                        type="number"
                        min={1}
                        step={1}
                        value={data.total_people}
                        onChange={(e) =>
                          update("total_people", Number(e.target.value))
                        }
                      />
                    </Field>
                  )}
                  <Field
                    label={equipment ? "類別" : "請輸入使用需求"}
                    required
                    field="reason"
                  >
                    <select
                      name="reason"
                      value={data.reason}
                      onChange={(e) => changeReason(e.target.value)}
                    >
                      {(equipment ? reasonsE : reasonsA).map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </Field>
                  {detailGrid}
                </FormPanel>
                <FormPanel title={equipment ? "使用時段登記" : "車輛借用資訊"}>
                  <People
                    label={equipment ? "使用人員" : "車輛使用人員"}
                    value={data.employees}
                    change={(v) => {
                      update("employees", v);
                      if (!equipment) update("total_people", v.length);
                    }}
                  />
                  {timeGrid}
                </FormPanel>
                {!equipment && (
                  <FormPanel title="需求選項清單">
                    <FieldGroup field="purposes">
                      <div
                        className="source-table-scroll"
                        tabIndex={0}
                        aria-label="需求選項表格"
                      >
                        <table className="source-purpose-table">
                          <tbody>
                            {[0, 1, 2].map((row) => (
                              <tr key={row}>
                                {purposes
                                  .slice(row * 5, row * 5 + 5)
                                  .map((p) => (
                                    <td key={p}>
                                      <label>
                                        <input
                                          type="checkbox"
                                          checked={data.purposes.includes(p)}
                                          onChange={(e) =>
                                            update(
                                              "purposes",
                                              e.target.checked
                                                ? [...data.purposes, p]
                                                : data.purposes.filter(
                                                    (v) => v !== p,
                                                  ),
                                            )
                                          }
                                        />
                                        {p}
                                      </label>
                                    </td>
                                  ))}
                              </tr>
                            ))}
                            <tr>
                              <td>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={data.purposes.includes("其他")}
                                    onChange={(e) =>
                                      update(
                                        "purposes",
                                        e.target.checked
                                          ? [...data.purposes, "其他"]
                                          : data.purposes.filter(
                                              (v) => v !== "其他",
                                            ),
                                      )
                                    }
                                  />
                                  其他
                                </label>
                              </td>
                              <td>
                                {data.purposes.includes("其他") && (
                                  <Field
                                    label="其他用途說明"
                                    field="other_purpose"
                                    required
                                  >
                                    <input
                                      value={data.other_purpose}
                                      onChange={(e) =>
                                        update("other_purpose", e.target.value)
                                      }
                                    />
                                  </Field>
                                )}
                              </td>
                              <td>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={data.purposes.includes("其他加工")}
                                    onChange={(e) =>
                                      update(
                                        "purposes",
                                        e.target.checked
                                          ? [...data.purposes, "其他加工"]
                                          : data.purposes.filter(
                                              (v) => v !== "其他加工",
                                            ),
                                      )
                                    }
                                  />
                                  其他加工
                                </label>
                              </td>
                              <td>
                                {data.purposes.includes("其他加工") && (
                                  <Field
                                    label="其他加工說明"
                                    field="other_processing"
                                    required
                                  >
                                    <input
                                      value={data.other_processing}
                                      onChange={(e) =>
                                        update(
                                          "other_processing",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </Field>
                                )}
                              </td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </FieldGroup>
                  </FormPanel>
                )}
                <Field label={equipment ? "備註" : "補充資訊"} field="notes">
                  <textarea
                    name="notes"
                    rows={3}
                    value={data.notes}
                    onChange={(e) => update("notes", e.target.value)}
                  />
                </Field>
              </>
            )}
            <ErrorBox error={error} />
          </fieldset>
          <div className="source-actions">
            {!readOnly && (
              <button
                className="button primary"
                disabled={
                  busy ||
                  (!id && kind !== "D" && !can(u, bookingDoc(kind), "submit"))
                }
              >
                {busy ? "正在保存…" : id ? "儲存變更" : "確認送出"}
              </button>
            )}
            <button
              type="button"
              className="button"
              onClick={cancel}
              disabled={busy}
            >
              {readOnly ? "關閉" : "取消"}
            </button>
          </div>
        </form>
      </div>
    </Scope>
  );
}
