import { useEffect, useRef, useState, type ReactNode } from "react";
import { MessageSquare, X } from "lucide-react";
import { type Feedback, type StudentDoc } from "./data";

type FeedbackActionsProps = {
  role?: "teacher" | "student";
  onResponse?: (id: number, response: Feedback["response"]) => void;
};
export function FeedbackActions({
  feedback,
  role,
  onResponse,
}: FeedbackActionsProps & { feedback: Feedback }) {
  const state = feedback.response;
  return (
    <div className="feedback-progress">
      {state && (
        <span className={`feedback-progress-label ${state}`}>
          {state === "confirmed"
            ? "선생님 확인 완료"
            : state === "revised"
              ? "고쳤어요 · 선생님 확인 기다리는 중"
              : "읽었어요"}
        </span>
      )}
      {role === "student" && onResponse && state !== "confirmed" && (
        <div className="feedback-response-buttons">
          {state !== "revised" && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                aria-pressed={state === "read"}
                onClick={() =>
                  onResponse(feedback.id, state === "read" ? undefined : "read")
                }
              >
                읽었어요
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onResponse(feedback.id, "revised")}
              >
                고쳤어요
              </button>
            </>
          )}
          {state === "revised" && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onResponse(feedback.id, "read")}
            >
              다시 고칠게요
            </button>
          )}
        </div>
      )}
      {role === "teacher" && onResponse && state === "revised" && (
        <div className="feedback-response-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onResponse(feedback.id, "confirmed")}
          >
            확인 완료
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onResponse(feedback.id, "read")}
          >
            다시 살펴봐요
          </button>
        </div>
      )}
    </div>
  );
}

export function FeedbackCards({
  doc,
  feedback,
  role,
  onResponse,
}: {
  doc: StudentDoc;
  feedback: Feedback[];
} & FeedbackActionsProps) {
  return (
    <>
      {feedback.length === 0 && (
        <p className="empty-note">아직 피드백이 없어요.</p>
      )}
      {feedback.map((f) => {
        const deleted =
          !!f.quote &&
          doc.anchors.find((a) => a.feedbackId === f.id)?.status !== "active";
        return (
          <div
            className={`feedback-card ${deleted ? "detached-feedback" : ""}`}
            key={f.id}
          >
            <span className="feedback-label">
              {deleted
                ? "원래 문장이 바뀌었어요"
                : f.quote
                  ? "문장에 남긴 피드백"
                  : "글 전체에 남긴 피드백"}
            </span>
            {f.quote && <blockquote>{f.quote}</blockquote>}
            <p>{f.message}</p>
            {deleted && (
              <span className="meta">
                원래 구절과 선생님의 말을 간직했어요.
              </span>
            )}
            <FeedbackActions feedback={f} role={role} onResponse={onResponse} />
          </div>
        );
      })}
    </>
  );
}

export function FeedbackSurface({
  feedback,
  children,
  role,
  onResponse,
}: {
  feedback: Feedback[];
  children: ReactNode;
} & FeedbackActionsProps) {
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [popup, setPopup] = useState<{
    ids: number[];
    left: number;
    top: number;
    above: boolean;
  } | null>(null);
  const cancelPress = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };
  const keepOpen = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };
  const open = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    if (target.closest(".feedback-popup")) {
      keepOpen();
      return;
    }
    const marks: Element[] = [];
    for (
      let el: Element | null = target;
      el && el !== root.current;
      el = el.parentElement
    ) {
      if (el.hasAttribute("data-feedback-id")) marks.push(el);
    }
    if (!marks.length) return;
    const ids = [
      ...new Set(
        marks.flatMap((el) =>
          (
            el.getAttribute("data-feedback-ids") ??
            el.getAttribute("data-feedback-id") ??
            ""
          )
            .split(" ")
            .map(Number),
        ),
      ),
    ].filter((id) => feedback.some((f) => f.id === id));
    if (!ids.length) return;
    keepOpen();
    const rect = marks[0].getBoundingClientRect();
    const above = rect.bottom > window.innerHeight * 0.62;
    setPopup({
      ids,
      left: Math.max(
        12,
        Math.min(
          rect.left,
          window.innerWidth - Math.min(336, window.innerWidth - 24) - 12,
        ),
      ),
      top: above
        ? Math.max(12, rect.top - 10)
        : Math.min(window.innerHeight - 36, rect.bottom + 10),
      above,
    });
  };
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape")
        return;
      if (
        event.type === "pointerdown" &&
        root.current?.contains(event.target as Node)
      )
        return;
      if (
        event.type === "scroll" &&
        event.target instanceof Element &&
        event.target.closest(".feedback-popup")
      )
        return;
      setPopup(null);
      cancelPress();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      cancelPress();
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);
  return (
    <div
      ref={root}
      className="feedback-surface"
      onInput={() => setPopup(null)}
      onPointerOver={(e) => {
        if (e.pointerType === "mouse") open(e.target);
      }}
      onPointerOut={(e) => {
        if (e.pointerType === "mouse") {
          keepOpen();
          if (
            e.relatedTarget instanceof Element &&
            e.relatedTarget.closest(".feedback-popup, [data-feedback-id]")
          )
            return;
          leaveTimer.current = setTimeout(() => setPopup(null), 220);
        }
      }}
      onFocus={(e) => open(e.target)}
      onPointerDown={(e) => {
        const target = e.target as Element;
        if (target.closest(".feedback-popup")) return;
        if (!target.closest("[data-feedback-id]")) setPopup(null);
        if (e.pointerType === "touch" || e.pointerType === "pen") {
          cancelPress();
          origin.current = { x: e.clientX, y: e.clientY };
          timer.current = setTimeout(() => {
            open(target);
            timer.current = null;
          }, 500);
        }
      }}
      onPointerMove={(e) => {
        if (
          origin.current &&
          Math.hypot(
            e.clientX - origin.current.x,
            e.clientY - origin.current.y,
          ) > 10
        )
          cancelPress();
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onClick={(e) => open(e.target)}
      onKeyDown={(e) => {
        if (
          (e.key === "Enter" || e.key === " ") &&
          (e.target as Element).hasAttribute("data-feedback-id")
        ) {
          e.preventDefault();
          open(e.target);
        }
      }}
      onContextMenu={(e) => {
        if ((e.target as Element).closest("[data-feedback-id]")) {
          e.preventDefault();
          open(e.target);
        }
      }}
    >
      {children}
      {popup && (
        <div
          className="feedback-popup"
          role="dialog"
          aria-label="선생님 피드백"
          style={{
            left: popup.left,
            top: popup.top,
            transform: popup.above ? "translateY(-100%)" : undefined,
          }}
          onPointerEnter={keepOpen}
        >
          <div className="feedback-popup-heading">
            <span>
              <MessageSquare size={16} /> 선생님의 한마디
            </span>
            <button
              aria-label="피드백 팝업 닫기"
              onClick={() => setPopup(null)}
            >
              <X size={16} />
            </button>
          </div>
          {feedback
            .filter((f) => popup.ids.includes(f.id))
            .map((f) => (
              <article key={f.id}>
                {f.quote && <blockquote>{f.quote}</blockquote>}
                <p>{f.message}</p>
                <FeedbackActions
                  feedback={f}
                  role={role}
                  onResponse={onResponse}
                />
              </article>
            ))}
        </div>
      )}
    </div>
  );
}
