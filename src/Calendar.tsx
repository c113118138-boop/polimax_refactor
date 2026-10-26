import { useRef, useState, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import zhTwLocale from "@fullcalendar/core/locales/zh-tw";
import { can, hasWorkspaceAccess, bookingDoc } from "./Access";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  api,
  Booking,
  Resource,
  businessDate,
  dateTime,
  localDate,
  kindNames,
} from "./api";
import { ErrorBox, Loading, Modal, Status } from "./ui";
import { useUser } from "./App";

const vehicleColors = [
  "#90caf9",
  "#a5d6a7",
  "#ffcc02",
  "#ce93d8",
  "#ffab91",
  "#cceeff",
  "#ffcccc",
  "#d7ccc8",
];
const addDays = (day: string, amount: number) =>
  localDate(
    new Date(businessDate(day + "T12:00").getTime() + amount * 86400000),
  );
const slotTime = (day: string, half: number) =>
  half === 48
    ? `${addDays(day, 1)}T00:00`
    : `${day}T${String(Math.floor(half / 2)).padStart(2, "0")}:${half % 2 ? "30" : "00"}`;
type Selection = { start: string; end: string; resource?: number };
type ResourceColumn = {
  id: number;
  label: string;
  color: string;
  kind: string;
};
type CalendarBooking = Booking & { eventResource?: number };
function calendarTitle(day: string, view: string) {
  const [year, month, date] = day.split("-").map(Number);
  if (view === "dayGridMonth") return `${year}年${month}月`;
  if (view === "resourceDay") return `${year}年${month}月${date}日`;
  const weekday = new Date(day + "T12:00:00Z").getUTCDay();
  const start = addDays(day, -((weekday + 6) % 7)),
    end = addDays(start, 6);
  return `${start.replaceAll("-", "/")} – ${end.slice(5).replace("-", "/")}`;
}
export default function CalendarPage() {
  const navigate = useNavigate(),
    u = useUser(),
    ref = useRef<FullCalendar>(null);
  const hasAccess = hasWorkspaceAccess(u);
  const [accessError, setAccessError] = useState("");
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 768px)").matches);
  const resources = useQuery({
    queryKey: ["resources"],
    queryFn: () => api<Resource[]>("/resources"),
    enabled: hasAccess,
  });
  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api<Booking[]>("/bookings"),
    enabled: hasAccess,
  });
  const holidays = useQuery({
    queryKey: ["holidays"],
    queryFn: () => api<{ title: string; date: string }[]>("/holidays"),
    enabled: hasAccess,
  });
  const [selectedIds, setSelected] = useState<number[] | null>(null);
  const [room, setRoom] = useState(true),
    [equipment, setEquipment] = useState(true),
    [holiday, setHoliday] = useState(true);
  const [view, setView] = useState("dayGridMonth"),
    [day, setDay] = useState(localDate());
  const [expanded, setExpanded] = useState(false),
    [drawer, setDrawer] = useState(false);
  const [detail, setDetail] = useState<CalendarBooking | null>(null),
    [selection, setSelection] = useState<Selection | null>(null);
  const showHoliday = ["Enabled", "Visible"].includes(
    u.permissions.ui["calendar.options.holidayToggle"],
  );
  const createKinds = Object.keys(kindNames).filter((kind) =>
    can(u, bookingDoc(kind), "create"),
  );
  const rs = hasAccess ? resources.data || [] : [],
    bs = hasAccess ? bookings.data || [] : [];
  const cars = rs.filter((r) => r.kind === "vehicle");
  const selected = (selectedIds ?? cars.map((r) => r.id)).filter((id) =>
    cars.some((r) => r.id === id),
  );
  const carColor = (id: number) =>
    vehicleColors[
      Math.max(
        0,
        cars.findIndex((r) => r.id === id),
      ) % vehicleColors.length
    ];
  const columns: ResourceColumn[] = [
    ...cars
      .filter((r) => selected.includes(r.id))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((r) => ({
        id: r.id,
        label: r.label,
        kind: "A",
        color: carColor(r.id),
      })),
    ...(room ? [{ id: -1, label: "作業區", kind: "D", color: "#FF9800" }] : []),
    ...(equipment
      ? [{ id: -2, label: "儀器設備", kind: "E", color: "#ce93d8" }]
      : []),
  ];
  useEffect(() => {
    if (!hasAccess) return;
    const timer = setTimeout(() => {
      api("/notifications/check", "POST").catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [hasAccess]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const close = () => {
      setMobile(media.matches);
      if (!media.matches) setDrawer(false);
      ref.current?.getApi().updateSize();
    };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  function moveTo(nextDay: string, nextView = view) {
    setDay(nextDay);
    setView(nextView);
    if (nextView !== "resourceDay")
      ref.current?.getApi().changeView(nextView, nextDay);
    setDrawer(false);
    requestAnimationFrame(() => ref.current?.getApi().updateSize());
  }
  function shift(direction: number) {
    if (view === "resourceDay") setDay(addDays(day, direction));
    else if (direction < 0) ref.current?.getApi().prev();
    else ref.current?.getApi().next();
  }
  function toggleCar(id: number) {
    setSelected(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
  }
  const events = bs.flatMap((b) =>
    b.slots.flatMap((s, i) => {
      if (
        !(b.kind === "A"
          ? selected.includes(s.resource_id)
          : b.kind === "D"
            ? room
            : equipment)
      )
        return [];
      const resource = rs.find((r) => r.id === s.resource_id);
      const color =
        b.kind === "D"
          ? "#FF9800"
          : b.kind === "E"
            ? "#ce93d8"
            : carColor(s.resource_id);
      const place =
        b.kind === "D"
          ? resource?.label
          : (b.content.details || [])
              .map((d: any) => [d.city, d.district].filter(Boolean).join(""))
              .join("、");
      return [
        {
          id: `${b.id}-${i}`,
          title: [b.content.applicant, b.content.title, place]
            .filter(Boolean)
            .join(" "),
          start: businessDate(s.start).toISOString(),
          end: businessDate(s.end).toISOString(),
          backgroundColor: color,
          borderColor: color,
          textColor: "#000",
          extendedProps: {
            booking: b,
            resource_id: s.resource_id,
            label: resource?.label,
          },
        },
      ];
    }),
  );
  const filterContent = (scope: string) => (
    <>
      <h2 className="filter-heading">日期</h2>
      <MiniCalendar
        value={day}
        onChange={(value) => moveTo(value, "resourceDay")}
      />
      <div className="vehicle-filter">
        <button
          className="vehicle-toggle"
          aria-expanded={expanded}
          aria-controls={`vehicle-filter-options-${scope}`}
          onClick={() => setExpanded(!expanded)}
        >
          <span>車牌：</span>
          <ChevronDown size={22} className={expanded ? "expanded" : ""} />
        </button>
        {expanded && (
          <div
            className="vehicle-options"
            id={`vehicle-filter-options-${scope}`}
          >
            {selected.length > 0 && (
              <div className="selected-vehicles" aria-label="已選車牌">
                {cars
                  .filter((r) => selected.includes(r.id))
                  .map((car) => (
                    <span
                      className="vehicle-chip"
                      style={{ background: carColor(car.id) }}
                      key={car.id}
                    >
                      {car.label}
                      <button
                        aria-label={`移除 ${car.label}`}
                        onClick={() => toggleCar(car.id)}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
              </div>
            )}
            <label className="calendar-check select-all">
              <input
                type="checkbox"
                checked={cars.length > 0 && selected.length === cars.length}
                ref={(input) => {
                  if (input)
                    input.indeterminate =
                      selected.length > 0 && selected.length < cars.length;
                }}
                disabled={!cars.length}
                onChange={(event) =>
                  setSelected(event.target.checked ? cars.map((r) => r.id) : [])
                }
              />
              <span>全選</span>
            </label>
            <div className="vehicle-list">
              {cars.map((car) => (
                <label className="calendar-check" key={car.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(car.id)}
                    onChange={() => toggleCar(car.id)}
                  />
                  <i
                    className="calendar-color-dot"
                    style={{ background: carColor(car.id) }}
                  />
                  <span>{car.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      <h2 className="filter-heading workspace-filter-title">作業區</h2>
      <label className="calendar-check">
        <input
          type="checkbox"
          checked={room}
          onChange={(event) => setRoom(event.target.checked)}
        />
        <i className="calendar-color-dot" style={{ background: "#FF9800" }} />
        <span>作業區預約</span>
      </label>
      <label className="calendar-check">
        <input
          type="checkbox"
          checked={equipment}
          onChange={(event) => setEquipment(event.target.checked)}
        />
        <i className="calendar-color-dot" style={{ background: "#ce93d8" }} />
        <span>儀器設備</span>
      </label>
    </>
  );
  return (
    <div className="calendar-page" data-view={view} data-date={day}>
      <div className="calendar-layout">
        <section className="calendar-panel" aria-label="預約日曆">
          <div className="calendar-controls">
            <div className="calendar-navigation">
              <div className="calendar-button-group">
                <button aria-label="上一期" onClick={() => shift(-1)}>
                  <ChevronLeft size={20} />
                </button>
                <button aria-label="下一期" onClick={() => shift(1)}>
                  <ChevronRight size={20} />
                </button>
              </div>
              <button onClick={() => moveTo(localDate())}>今天</button>
            </div>
            <h1 className="calendar-title" aria-live="polite">
              {calendarTitle(day, view)}
            </h1>
            <div className="calendar-view-controls">
              <div className="calendar-button-group" aria-label="日曆視圖">
                {[
                  ["dayGridMonth", "月"],
                  ["timeGridWeek", "週"],
                  ["resourceDay", "天"],
                  ["listWeek", "活動列表"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={view === value}
                    className={view === value ? "active" : ""}
                    onClick={() => moveTo(day, value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {showHoliday && (
                <button
                  className="holiday-toggle"
                  disabled={holidays.isPending || !hasAccess}
                  onClick={() => setHoliday(!holiday)}
                >
                  {holidays.isPending
                    ? "節日載入中…"
                    : holiday
                      ? "隱藏節日"
                      : "顯示節日"}
                </button>
              )}
            </div>
          </div>
          <ErrorBox
            error={accessError || bookings.error || resources.error || holidays.error}
          />
          {!hasAccess && (
            <p className="calendar-access-note">
              此帳號尚未取得 AMS 功能權限。
            </p>
          )}
          <div className="calendar-body">
            {hasAccess && (bookings.isPending || resources.isPending) ? (
              <Loading />
            ) : (
              <>
                <div
                  className="fullcalendar-host"
                  hidden={view === "resourceDay"}
                >
                  <FullCalendar
                    ref={ref}
                    plugins={[
                      dayGridPlugin,
                      timeGridPlugin,
                      listPlugin,
                      interactionPlugin,
                      luxonPlugin,
                    ]}
                    initialView="dayGridMonth"
                    initialDate={day}
                    locale={zhTwLocale}
                    timeZone="Asia/Taipei"
                    headerToolbar={false}
                    height={mobile ? "auto" : "100%"}
                    aspectRatio={mobile ? 1.35 : 1.8}
                    firstDay={1}
                    dayMaxEvents={3}
                    fixedWeekCount={false}
                    allDaySlot={false}
                    nowIndicator
                    businessHours={{
                      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                      startTime: "08:00",
                      endTime: "18:00",
                    }}
                    displayEventTime={false}
                    eventDisplay="block"
                    noEventsContent="此週沒有符合篩選的預約"
                    events={[
                      ...events,
                      ...(hasAccess && holiday
                        ? (holidays.data || []).map((h, i) => ({
                            id: `holiday-${i}`,
                            title: h.title,
                            start: h.date,
                            allDay: true,
                            backgroundColor: "#C8E6C9",
                            borderColor: "#C8E6C9",
                            textColor: "#000",
                          }))
                        : []),
                    ]}
                    selectable={createKinds.length > 0}
                    selectMirror
                    datesSet={(arg) => {
                      if (view !== "resourceDay")
                        setDay(localDate(arg.view.calendar.getDate()));
                    }}
                    dateClick={(arg) => {
                      if (!hasAccess) { setAccessError("沒有權限"); return; }
                      if (view === "dayGridMonth")
                        moveTo(arg.dateStr, "resourceDay");
                      else if (
                        createKinds.length &&
                        window.matchMedia("(max-width: 768px)").matches
                      )
                        setSelection({
                          start: arg.dateStr,
                          end: new Date(
                            arg.date.getTime() + 3600000,
                          ).toISOString(),
                        });
                    }}
                    select={(arg) => {
                      if (view === "dayGridMonth") return;
                      setSelection({ start: arg.startStr, end: arg.endStr });
                      ref.current?.getApi().unselect();
                    }}
                    eventClick={(arg) => {
                      if (arg.event.extendedProps.booking)
                        setDetail({
                          ...arg.event.extendedProps.booking,
                          eventResource: arg.event.extendedProps.resource_id,
                        });
                    }}
                    eventContent={(arg) => (
                      <div className="calendar-event" title={arg.event.title}>
                        {arg.event.title}
                      </div>
                    )}
                  />
                </div>
                {view === "resourceDay" && (
                  <ResourceDay
                    day={day}
                    columns={columns}
                    bookings={bs}
                    canCreate={createKinds.length > 0}
                    holidays={
                      holiday
                        ? (holidays.data || []).filter((h) => h.date === day)
                        : []
                    }
                    onEvent={setDetail}
                    onSelect={setSelection}
                  />
                )}
              </>
            )}
          </div>
        </section>
        <aside className="calendar-filter-desktop" aria-label="日曆篩選">
          {filterContent("desktop")}
        </aside>
      </div>
      <button
        className="calendar-filter-fab"
        aria-label="開啟日曆篩選"
        onClick={() => setDrawer(true)}
      >
        <SlidersHorizontal size={24} />
      </button>
      <FilterDrawer open={drawer} onClose={() => setDrawer(false)}>
        {filterContent("drawer")}
      </FilterDrawer>
      <Modal open={!!detail} title="預約詳情" onClose={() => setDetail(null)}>
        {detail && (
          <>
            <div className="detail-top">
              <span className="mono">{detail.id}</span>
              <Status status={detail.status} />
            </div>
            <h2>{detail.content.title}</h2>
            <div className="summary-grid">
              <div>
                <small>申請人</small>
                <strong>{detail.content.applicant}</strong>
              </div>
              <div>
                <small>預約類型</small>
                <strong>{kindNames[detail.kind]}</strong>
              </div>
            </div>
            {detail.slots.map((s, i) => (
              <div className="slot-summary" key={i}>
                <strong>
                  {rs.find((r) => r.id === s.resource_id)?.label || "歷史資源"}
                </strong>
                <span>
                  {dateTime(s.start)} → {dateTime(s.end)}
                </span>
              </div>
            ))}
            <div className="actions">
              <button className="button" onClick={() => setDetail(null)}>
                關閉
              </button>
              <button
                className="button primary"
                disabled={detail.detail_allowed === false}
                title={
                  detail.detail_allowed === false
                    ? "無法修改他人借用紀錄"
                    : undefined
                }
                onClick={() =>
                  navigate(
                    `/bookings/${detail.id}${detail.eventResource ? `?resource=${detail.eventResource}` : ""}`,
                  )
                }
              >
                查看完整申請
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={!!selection}
        title="預約所選時段"
        onClose={() => setSelection(null)}
      >
        <p className="muted">
          {selection &&
            `${dateTime(selection.start)} → ${dateTime(selection.end)}`}
        </p>
        <div className="create-options">
          {createKinds.map((kind) => (
            <button
              key={kind}
              onClick={() =>
                navigate(`/bookings/new/${kind}`, {
                  state: {
                    ...selection,
                    resource: kind === "A" ? selection?.resource : undefined,
                  },
                })
              }
            >
              <strong>{kindNames[kind]}</strong>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
function MiniCalendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (day: string) => void;
}) {
  const [month, setMonth] = useState(value.slice(0, 7));
  useEffect(() => setMonth(value.slice(0, 7)), [value]);
  const [year, monthNumber] = month.split("-").map(Number),
    first = `${month}-01`;
  const offset = (new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7,
    length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dates = Array.from(
    { length: Math.ceil((offset + length) / 7) * 7 },
    (_, i) => addDays(first, i - offset),
  );
  function shift(amount: number) {
    const next = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
    setMonth(
      `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  return (
    <div className="mini-calendar" aria-label="小日曆">
      <div className="mini-calendar-header">
        <button aria-label="小日曆上個月" onClick={() => shift(-1)}>
          <ChevronLeft size={16} />
        </button>
        <strong>
          {year}年{monthNumber}月
        </strong>
        <button aria-label="小日曆下個月" onClick={() => shift(1)}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="mini-calendar-weekdays">
        {["一", "二", "三", "四", "五", "六", "日"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mini-calendar-days">
        {dates.map((date) => (
          <button
            key={date}
            aria-label={`選擇 ${date}`}
            aria-pressed={date === value}
            className={[
              date === value ? "selected" : "",
              date === localDate() ? "today" : "",
              date.slice(0, 7) !== month ? "outside" : "",
            ].join(" ")}
            onClick={() => onChange(date)}
          >
            {Number(date.slice(8))}
          </button>
        ))}
      </div>
    </div>
  );
}
function FilterDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
          ) || [],
        ),
        first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="calendar-drawer-backdrop" onClick={() => close.current()}>
      <div
        ref={dialog}
        className="calendar-filter-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-filter-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="calendar-drawer-heading">
          <h2 id="calendar-filter-title">篩選選項</h2>
          <button aria-label="關閉日曆篩選" onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
function ResourceDay({
  day,
  columns,
  bookings,
  canCreate,
  holidays,
  onEvent,
  onSelect,
}: {
  day: string;
  columns: ResourceColumn[];
  bookings: Booking[];
  canCreate: boolean;
  holidays: { title: string }[];
  onEvent: (booking: CalendarBooking) => void;
  onSelect: (selection: Selection) => void;
}) {
  const [drag, setDrag] = useState<{
      id: number;
      from: number;
      to: number;
    } | null>(null),
    dragging = useRef<typeof drag>(null);
  const touching = useRef(false);
  const dayStart = businessDate(day).getTime(),
    dayEnd = dayStart + 86400000,
    now = (Date.now() - dayStart) / 60000;
  function position(element: HTMLElement, y: number) {
    return Math.max(
      0,
      Math.min(47, Math.floor((y - element.getBoundingClientRect().top) / 30)),
    );
  }
  if (!columns.length)
    return (
      <div className="resource-empty" role="status">
        請勾選車牌、作業區或儀器設備以顯示資源。
      </div>
    );
  return (
    <>
      {holidays.length > 0 && (
        <div className="resource-holiday">
          {holidays.map((h) => h.title).join("、")}
        </div>
      )}
      <div
        className="resource-grid-wrap"
        tabIndex={0}
        aria-label="資源日時段表"
      >
        <div
          className="resource-day-grid"
          style={{
            gridTemplateColumns: `58px repeat(${columns.length}, minmax(120px, 1fr))`,
          }}
        >
          <div className="resource-head">時間</div>
          {columns.map((r) => (
            <div className="resource-head" data-resource-id={r.id} key={r.id}>
              <i
                className="calendar-color-dot"
                style={{ background: r.color }}
              />
              {r.label}
            </div>
          ))}
          <div className="resource-time-lane">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour}>{String(hour).padStart(2, "0")}:00</div>
            ))}
          </div>
          {columns.map((r) => {
            const items = bookings
              .flatMap((b) =>
                b.slots.flatMap((s, i) => {
                  if (
                    !(r.id > 0
                      ? b.kind === "A" && s.resource_id === r.id
                      : b.kind === r.kind)
                  )
                    return [];
                  const start = businessDate(s.start).getTime(),
                    end = businessDate(s.end).getTime();
                  if (start >= dayEnd || end <= dayStart) return [];
                  return [
                    {
                      key: `${b.id}-${i}`,
                      booking: b,
                      resource: s.resource_id,
                      start: Math.max(start, dayStart),
                      end: Math.min(end, dayEnd),
                      lane: 0,
                      count: 1,
                    },
                  ];
                }),
              )
              .sort((a, b) => a.start - b.start || b.end - a.end);
            let cluster: typeof items = [],
              clusterEnd = 0;
            const assign = () => {
              const ends: number[] = [];
              for (const item of cluster) {
                let lane = ends.findIndex((end) => end <= item.start);
                if (lane < 0) lane = ends.length;
                ends[lane] = item.end;
                item.lane = lane;
              }
              for (const item of cluster) item.count = ends.length;
            };
            for (const item of items) {
              if (item.start >= clusterEnd && cluster.length) {
                assign();
                cluster = [];
              }
              cluster.push(item);
              clusterEnd = Math.max(...cluster.map((event) => event.end));
            }
            assign();
            return (
              <div
                className="resource-day-lane"
                key={r.id}
                data-resource-id={r.id}
                onPointerDown={(event) => {
                  if (
                    !canCreate ||
                    event.button !== 0 ||
                    (event.target as HTMLElement).closest(".resource-event")
                  )
                    return;
                  // Touch opens on click, after the synthetic click has landed.
                  // Opening on pointerup lets that click close the new backdrop.
                  if (event.pointerType === "touch") { touching.current = true; return; }
                  touching.current = false;
                  const from = position(event.currentTarget, event.clientY),
                    current = { id: r.id, from, to: from };
                  dragging.current = current;
                  setDrag(current);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (dragging.current?.id !== r.id) return;
                  const current = {
                    ...dragging.current,
                    to: position(event.currentTarget, event.clientY),
                  };
                  dragging.current = current;
                  setDrag(current);
                }}
                onPointerUp={(event) => {
                  const current = dragging.current;
                  if (!current) return;
                  dragging.current = null;
                  setDrag(null);
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  onSelect({
                    start: slotTime(day, Math.min(current.from, current.to)),
                    end: slotTime(day, Math.max(current.from, current.to) + 1),
                    resource: r.id > 0 ? r.id : undefined,
                  });
                }}
                onPointerCancel={() => {
                  touching.current = false;
                  dragging.current = null;
                  setDrag(null);
                }}
              >
                {Array.from({ length: 48 }, (_, half) => (
                  <button
                    className={`resource-slot ${half >= 16 && half < 36 ? "business-hour" : ""}`}
                    key={half}
                    disabled={!canCreate}
                    aria-label={`預約 ${r.label} ${slotTime(day, half).slice(11)}`}
                    onClick={(event) => {
                      if ((event.detail === 0 || touching.current) && canCreate) {
                        touching.current = false;
                        onSelect({
                          start: slotTime(day, half),
                          end: slotTime(day, half + 1),
                          resource: r.id > 0 ? r.id : undefined,
                        });
                      }
                    }}
                  />
                ))}
                {drag?.id === r.id && (
                  <div
                    className="resource-selection"
                    style={{
                      top: Math.min(drag.from, drag.to) * 30,
                      height: (Math.abs(drag.to - drag.from) + 1) * 30,
                    }}
                  />
                )}
                {items.map((item) => (
                  <button
                    className="resource-event"
                    key={item.key}
                    data-booking-id={item.booking.id}
                    title={`${item.booking.content.applicant} ${item.booking.content.title}`}
                    style={{
                      top: (item.start - dayStart) / 60000,
                      height: Math.max(18, (item.end - item.start) / 60000),
                      background: r.color,
                      left: `calc(${(item.lane / item.count) * 100}% + 2px)`,
                      width: `calc(${100 / item.count}% - 4px)`,
                    }}
                    onClick={() =>
                      onEvent({ ...item.booking, eventResource: item.resource })
                    }
                  >
                    {item.booking.content.applicant}{" "}
                    {item.booking.content.title}
                  </button>
                ))}
                {now >= 0 && now < 1440 && (
                  <div
                    className="resource-now"
                    style={{ top: now }}
                    aria-label="現在時間"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
