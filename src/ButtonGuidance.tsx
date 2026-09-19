import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLive } from "./collaboration";

export type GuideCue = { scope: string; target: string; expiresAt: number };
export type Guidance = {
  subscribe: (fn: (cue: GuideCue) => void) => () => void;
  highlight: (scope: string, target: string) => void;
};
export function ButtonGuidance({
  role,
  scope,
  children,
}: {
  role: "teacher" | "student";
  scope: string;
  children: ReactNode;
}) {
  const guidance = useLive()?.guidance;
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{
    target: string;
    left: number;
    top: number;
    container: HTMLElement;
  } | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setMenu(null);
    if (role !== "student" || !guidance) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let highlighted: HTMLElement | undefined;
    const clear = () => {
      clearTimeout(timer);
      highlighted?.classList.remove("teacher-button-highlight");
      highlighted = undefined;
      setNotice("");
    };
    const unsubscribe = guidance.subscribe((cue) => {
      if (
        cue.scope !== scope ||
        document.hidden ||
        cue.expiresAt <= Date.now() ||
        cue.expiresAt > Date.now() + 10000
      )
        return;
      // Match explicit semantic IDs, never labels, DOM order, or arbitrary selectors.
      const target = Array.from(
        root.current?.querySelectorAll<HTMLElement>("[data-guide-target]") ??
          [],
      ).find((el) => el.dataset.guideTarget === cue.target);
      if (!target || !target.getClientRects().length) return;
      const rect = target.getBoundingClientRect();
      if (
        rect.bottom <= 0 ||
        rect.top >= innerHeight ||
        rect.right <= 0 ||
        rect.left >= innerWidth
      )
        return;
      const hit = document.elementFromPoint(
        Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2)),
        Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2)),
      );
      if (!hit || !target.contains(hit)) return; // Covered by a different dialog.
      clear();
      highlighted = target;
      target.classList.add("teacher-button-highlight");
      setNotice("선생님이 이 버튼을 알려 주셨어요.");
      timer = setTimeout(clear, Math.min(3000, cue.expiresAt - Date.now()));
    });
    document.addEventListener("visibilitychange", clear);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", clear);
      clear();
    };
  }, [guidance, role, scope]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("click", close);
    document.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);
  return (
    <div
      ref={root}
      className="button-guidance"
      onContextMenu={(e) => {
        if (role !== "teacher" || !guidance || scope === "private") return;
        const target = (e.target as Element).closest<HTMLElement>(
          "[data-guide-target]",
        );
        if (!target || !root.current?.contains(target)) return;
        e.preventDefault();
        setMenu({
          target: target.dataset.guideTarget!,
          left: Math.max(8, Math.min(e.clientX, innerWidth - 200)),
          top: Math.max(8, Math.min(e.clientY, innerHeight - 60)),
          container: target.closest("dialog") ?? root.current!,
        });
      }}
    >
      {children}
      {menu &&
        createPortal(
          <div
            className="button-guide-menu"
            role="menu"
            style={{ left: menu.left, top: menu.top }}
          >
            <button
              role="menuitem"
              autoFocus
              onClick={() => {
                guidance?.highlight(scope, menu.target);
                setMenu(null);
              }}
            >
              이 버튼 강조
            </button>
          </div>,
          menu.container,
        )}
      <span className="sr-only" role="status">
        {notice}
      </span>
    </div>
  );
}
