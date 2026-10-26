import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog } from "@mui/material";
import { BlockerFunction, useBlocker } from "react-router-dom";

type Entry = { dirty: boolean; busy: boolean };
type LeaveAction = { run: () => void; id?: string };
type GuardContext = {
  register: (id: string, entry: Entry) => void;
  unregister: (id: string) => void;
  confirmLeave: (run: () => void, id?: string) => void;
  releaseAll: () => void;
};
const NavigationContext = createContext<GuardContext | null>(null);

// One router blocker handles all active editors, including nested dialogs.
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, Entry>());
  const [, refresh] = useState(0);
  const [action, setAction] = useState<LeaveAction | null>(null);
  const titleId = useId();
  const blocker = useBlocker(
    useCallback<BlockerFunction>(
      ({ currentLocation, nextLocation }) =>
        (currentLocation.pathname !== nextLocation.pathname ||
          currentLocation.search !== nextLocation.search) &&
        entries.current.size > 0,
      [],
    ),
  );
  const currentBlocker = useRef(blocker);
  currentBlocker.current = blocker;
  const register = useCallback((id: string, entry: Entry) => {
    const old = entries.current.get(id);
    if (old?.dirty === entry.dirty && old?.busy === entry.busy) return;
    entries.current.set(id, entry);
    refresh((value) => value + 1);
  }, []);
  const unregister = useCallback((id: string) => {
    if (!entries.current.delete(id)) return;
    refresh((value) => value + 1);
    if (!entries.current.size && currentBlocker.current.state === "blocked")
      currentBlocker.current.reset();
  }, []);
  const releaseAll = useCallback(() => {
    entries.current.clear();
    refresh((value) => value + 1);
    setAction(null);
    if (currentBlocker.current.state === "blocked")
      currentBlocker.current.reset();
  }, []);
  const confirmLeave = useCallback((run: () => void, id?: string) => {
    if (id ? entries.current.has(id) : entries.current.size > 0)
      setAction({ run, id });
    else run();
  }, []);
  const context = useMemo(
    () => ({ register, unregister, confirmLeave, releaseAll }),
    [register, unregister, confirmLeave, releaseAll],
  );
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!entries.current.size) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, []);
  useEffect(() => {
    if (
      action &&
      !(action.id ? entries.current.has(action.id) : entries.current.size > 0)
    )
      setAction(null);
  });
  const active = action?.id
    ? ([entries.current.get(action.id)].filter(Boolean) as Entry[])
    : [...entries.current.values()];
  const busy = active.some((entry) => entry.busy);
  function stay() {
    setAction(null);
    if (blocker.state === "blocked") blocker.reset();
  }
  function leave() {
    if (busy) return;
    if (action) {
      setAction(null);
      action.run();
    } else if (blocker.state === "blocked") {
      entries.current.clear();
      refresh((value) => value + 1);
      blocker.proceed();
    }
  }
  return (
    <NavigationContext.Provider value={context}>
      {children}
      <Dialog
        open={!!action || blocker.state === "blocked"}
        onClose={stay}
        aria-labelledby={titleId}
        maxWidth="sm"
        fullWidth
        PaperProps={{ className: "modal-paper" }}
      >
        <div className="modal-head">
          <h2 id={titleId}>尚未保存的內容</h2>
        </div>
        <div className="modal-content">
          <p>
            {busy
              ? "正在保存或上傳檔案，請等候完成後再離開。"
              : "離開將放棄尚未保存的變更。已儲存的分頁草稿會保留。"}
          </p>
          <div className="actions">
            <button className="button" onClick={stay} autoFocus>
              繼續編輯
            </button>
            <button className="button danger" onClick={leave} disabled={busy}>
              放棄變更並離開
            </button>
          </div>
        </div>
      </Dialog>
    </NavigationContext.Provider>
  );
}

export function useLeaveConfirmation() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("NavigationGuardProvider is required");
  return context;
}

export function useUnsavedChanges({
  dirty,
  busy = false,
  active = true,
}: Entry & { active?: boolean }) {
  const { register, unregister, confirmLeave } = useLeaveConfirmation();
  const id = useId();
  const released = useRef(false);
  useLayoutEffect(() => {
    if (!active) {
      released.current = false;
      unregister(id);
      return;
    }
    if (!released.current && (dirty || busy)) register(id, { dirty, busy });
    else unregister(id);
  }, [active, dirty, busy, id, register, unregister]);
  useLayoutEffect(() => () => unregister(id), [id, unregister]);
  const release = useCallback(() => {
    released.current = true;
    unregister(id);
  }, [id, unregister]);
  const requestClose = (close: () => void) =>
    confirmLeave(() => {
      release();
      close();
    }, id);
  return { release, requestClose };
}
