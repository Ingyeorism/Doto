import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Nut, ArrowUpRight, Check, X } from "lucide-react";
import type { StudentDoc } from "./data";
import { filledSources, httpUrl } from "./learning";
import { documentHtml } from "./safe-html";

export function Button({
  children,
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="도토 시작 화면">
      <span className="brand-icon">
        <Nut strokeWidth={1.65} />
      </span>
      <span>
        도토<span className="brand-en">doto</span>
      </span>
    </button>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`switch ${checked ? "is-on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span>{checked && <Check size={11} />}</span>
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <IconButton label="닫기" onClick={onClose}>
          <X size={21} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="empty-note">{children}</p>;
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={16} />
    </button>
  );
}
export function DocumentBody({ doc }: { doc: StudentDoc }) {
  // Only schema-generated Tiptap HTML reaches this view. Feedback decorations
  // and messages are stored separately and are never part of public HTML.
  return (
    <>
      <div className="document-body">
        {doc.html ? (
          <div
            dangerouslySetInnerHTML={{
              __html: documentHtml(doc.html),
            }}
          />
        ) : (
          doc.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)
        )}
      </div>
      <SourceList doc={doc} />
    </>
  );
}

export function SourceList({ doc }: { doc: StudentDoc }) {
  const sources = filledSources(doc.sources);
  if (!sources.length) return null;
  return (
    <section className="source-list" aria-label="이 글의 출처">
      <strong>읽은 자료</strong>
      <ul>
        {sources.map((s, i) => (
          <li key={i}>
            {[s.institution, s.title, s.date && `읽은 날 ${s.date}`]
              .filter(Boolean)
              .join(" · ")}
            {s.url && (
              <>
                {" "}
                {httpUrl(s.url) ? (
                  <a
                    href={httpUrl(s.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    자료 열기<span className="sr-only"> · 새 탭</span>
                  </a>
                ) : (
                  <span>{s.url}</span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
