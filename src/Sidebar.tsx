import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  LogOut,
  Package,
  X,
} from "lucide-react";
import { api, Resource, User } from "./api";
import { bookingDoc, can } from "./Access";

function SidebarGroup({
  label,
  children,
  icon = true,
}: {
  label: string;
  children: ReactNode;
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="sidebar-group">
      <button
        className={
          "sidebar-row sidebar-group-toggle" +
          (!icon ? " sidebar-nested-toggle" : "")
        }
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {icon && (
          <span className="sidebar-icon">
            <Activity size={24} aria-hidden="true" />
          </span>
        )}
        <span className="sidebar-row-label">{label}</span>
        {open ? (
          <ChevronUp className="sidebar-arrow" size={24} aria-hidden="true" />
        ) : (
          <ChevronDown className="sidebar-arrow" size={24} aria-hidden="true" />
        )}
      </button>
      {open && (
        <div id={id} className="sidebar-children">
          {children}
        </div>
      )}
    </div>
  );
}

function SidebarLink({
  to,
  children,
  onNavigate,
  depth = 1,
  add = false,
  icon = false,
}: {
  to: string;
  children: ReactNode;
  onNavigate: () => void;
  depth?: number;
  add?: boolean;
  icon?: boolean;
}) {
  const location = useLocation();
  const target = new URL(to, "https://navigation.invalid");
  const active =
    location.pathname === target.pathname && location.search === target.search;
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={
        "sidebar-row sidebar-link sidebar-depth-" +
        depth +
        (active ? " active" : "") +
        (add ? " sidebar-add" : "")
      }
    >
      {icon && (
        <span className="sidebar-icon">
          <CalendarDays size={24} aria-hidden="true" />
        </span>
      )}
      <span className="sidebar-row-label">{children}</span>
    </Link>
  );
}

export default function Sidebar({
  user: u,
  mobileOpen,
  collapsed,
  onClose,
  onLogout,
}: {
  user: User;
  mobileOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const aside = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [narrow, setNarrow] = useState(
    () => matchMedia("(max-width: 768px)").matches,
  );
  const [assetsOpened, setAssetsOpened] = useState(false);
  const readVehicle = can(u, "VehicleManagement"),
    readEquipment = can(u, "EquipmentManagement");
  const readableKinds = ["A", "D", "E"].filter((kind) =>
    can(u, bookingDoc(kind)),
  );
  const readStages =
    can(u, "Departure_query") &&
    (can(u, "departure_form") || can(u, "back_form"));
  const readPositions = can(u, "CarUpdate");
  const readTrajectory = readPositions && can(u, "carMap");
  const readFindMy = can(u, "FindMy"),
    readScans = can(u, "Latest_Device");
  const readBeacons = can(u, "BeaconList");
  const resources = useQuery({
    queryKey: ["resources"],
    queryFn: () => api<Resource[]>("/resources"),
    enabled: assetsOpened && (readVehicle || readEquipment),
  });
  const hidden = narrow ? !mobileOpen : collapsed;
  useEffect(() => {
    const media = matchMedia("(max-width: 768px)");
    const update = () => {
      setNarrow(media.matches);
      onClose();
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [onClose]);
  useEffect(() => {
    aside.current?.toggleAttribute("inert", hidden);
  }, [hidden]);
  useEffect(() => {
    if (!narrow || !mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const main = document.querySelector(".main-shell");
    const hadInert = main?.hasAttribute("inert");
    const overflow = document.body.style.overflow;
    main?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    close.current?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        aside.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),[tabindex="0"]',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      if (!hadInert) main?.removeAttribute("inert");
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [narrow, mobileOpen, onClose]);
  const link = (to: string, label: string, depth = 1, add = false) => (
    <SidebarLink to={to} onNavigate={onClose} depth={depth} add={add}>
      {label}
    </SidebarLink>
  );
  const available = (resources.data || []).filter(
    (resource) =>
      String(resource.isdelete ?? resource.data?.isdelete ?? 0) !== "1",
  );
  function assetLinks(kind: string) {
    const items = available.filter((resource) => resource.kind === kind);
    return (
      <>
        {resources.isPending && (
          <p className="sidebar-list-status" role="status">
            載入中…
          </p>
        )}
        {resources.isError && (
          <p className="sidebar-list-status" role="alert">
            清單載入失敗
            <button onClick={() => resources.refetch()}>重試</button>
          </p>
        )}
        {resources.isSuccess && items.length === 0 && (
          <p className="sidebar-list-status">
            {kind === "vehicle" ? "無車輛資料" : "無設備資料"}
          </p>
        )}
        {items.map((resource) => (
          <SidebarLink
            key={resource.id}
            depth={0}
            to={
              (kind === "vehicle" ? "/vehicles/" : "/equipment/") + resource.id
            }
            onNavigate={onClose}
          >
            {kind === "vehicle"
              ? resource.label
              : resource.name || resource.label}
          </SidebarLink>
        ))}
      </>
    );
  }
  const createKinds = ["A", "D", "E"].filter((kind) =>
    can(u, bookingDoc(kind), "create"),
  );
  return (
    <>
      <div
        className={"sidebar-shade " + (narrow && mobileOpen ? "visible" : "")}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={aside}
        className={"sidebar " + (mobileOpen ? "is-open" : "")}
        aria-hidden={hidden || undefined}
        aria-label={narrow ? "導覽選單" : "側邊欄"}
        role={narrow && mobileOpen ? "dialog" : undefined}
        aria-modal={narrow && mobileOpen ? true : undefined}
      >
        <div className="sidebar-mobile-heading">
          <button
            ref={close}
            className="icon-button"
            aria-label="關閉選單"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        <div className="sidebar-logo-area">
          <div
            className="sidebar-logo-placeholder"
            data-asset-slot="sidebar-logo"
          >
            <img src="/Logo.jpg" alt="台灣波力梅 TAIWAN POLIMAX" />
          </div>
        </div>
        <div
          className="sidebar-profile"
          title={`${u.name} · ${u.email} · ${u.id}`}
        >
          <div
            className="sidebar-profile-background"
            data-asset-slot="sidebar-profile-background"
          >
            波力梅 — 資產管理系統
          </div>
          <div
            className="sidebar-profile-avatar"
            data-asset-slot="sidebar-avatar"
            aria-label="使用者頭像"
          >
            {u.name.slice(0, 1)}
          </div>
          <strong>{u.name}</strong>
        </div>
        <nav className="sidebar-menu" aria-label="主導覽">
          <SidebarLink to="/" depth={0} icon onNavigate={onClose}>
            日曆
          </SidebarLink>
          {createKinds.length > 0 && (
            <SidebarGroup label="借用申請">
              {createKinds.includes("A") &&
                link("/bookings/new/A", "車輛借用新增")}
              {createKinds.includes("D") &&
                link("/bookings/new/D", "作業區借用新增")}
              {createKinds.includes("E") &&
                link("/bookings/new/E", "儀器借用新增")}
            </SidebarGroup>
          )}
          {(readableKinds.length > 0 || readStages) && (
            <SidebarGroup label="借用中">
              {readableKinds.includes("A") &&
                link("/bookings?kind=A", "車輛使用查詢")}
              {readableKinds.includes("D") &&
                link("/bookings?kind=D", "作業區使用查詢")}
              {readableKinds.includes("E") &&
                link("/bookings?kind=E", "儀器使用查詢")}
              {readStages && can(u,"departure_form") && link("/stages?kind=B","發車紀錄查詢")}
              {readStages && can(u,"back_form") && link("/stages?kind=C","還車紀錄查詢")}
            </SidebarGroup>
          )}
          {(readPositions || readableKinds.includes("A")) && (
            <SidebarGroup label="公務車使用管理">
              {readPositions && link("/positions", "車輛即時資訊查詢")}
              {readableKinds.includes("A") &&
                link("/bookings?history=1", "車輛使用歷史紀錄")}
              {readTrajectory &&
                link("/positions?view=history", "車輛行駛軌跡查詢")}
            </SidebarGroup>
          )}
          {(readFindMy || readScans) && (
            <SidebarGroup label="設備管理">
              {readFindMy && link("/findmy", "設備即時位置")}
              {readScans && link("/scans", "設備場內資訊")}
            </SidebarGroup>
          )}
          {(readBeacons || readVehicle || readEquipment) && (
            <SidebarGroup label="後台資訊管理">
              {readBeacons && link("/beacons", "BeaconList")}
              {readVehicle && link("/vehicles", "CarList")}
              {readEquipment && link("/equipment", "EquipmentList")}
            </SidebarGroup>
          )}
          {(readVehicle || readEquipment) && (
            <div onClick={() => setAssetsOpened(true)}>
              <SidebarGroup label="資產設備資訊|管理">
                {readVehicle && (
                  <SidebarGroup label="公務車" icon={false}>
                    {can(u, "VehicleManagement", "create") &&
                      link("/vehicles?create=1", "新增車輛資料", 2, true)}
                    {readVehicle && assetLinks("vehicle")}
                  </SidebarGroup>
                )}
                {readEquipment && (
                  <SidebarGroup label="儀器設備" icon={false}>
                    {can(u, "EquipmentManagement", "create") &&
                      link("/equipment?create=1", "新增儀器設備資料", 2, true)}
                    {readEquipment && assetLinks("equipment")}
                  </SidebarGroup>
                )}
              </SidebarGroup>
            </div>
          )}
        </nav>
        <div className="sidebar-fixed-actions">
          <a
            className="sidebar-materials"
            href="https://materials.54ucl.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
          >
            <Package size={20} aria-hidden="true" />
            料件管理
          </a>
          <div className="sidebar-logout-row">
            <button className="sidebar-logout" onClick={onLogout}>
              <LogOut size={20} aria-hidden="true" />
              登出
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
