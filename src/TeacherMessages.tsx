import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import type { Participant, StudentDoc } from "./data";
import { Button, Modal } from "./ui";

export interface MessageActions {
  onSendMessage: (docId: number, text: string) => Promise<unknown> | void;
  onReadMessages: (docId: number, ids: string[]) => Promise<unknown> | void;
}

export function unreadMessages(
  participant: Participant | undefined,
  docId: number,
  role: "teacher" | "student",
) {
  return (participant?.messages || []).filter(
    (m) => m.docId === docId && m.sender !== role && !m.readAt,
  );
}

export function MessageThread({
  participant,
  doc,
  role,
  connected = true,
  onSendMessage,
  onReadMessages,
}: MessageActions & {
  participant?: Participant;
  doc: StudentDoc;
  role: "teacher" | "student";
  connected?: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const marking = useRef("");
  const messages = (participant?.messages || []).filter(
    (m) => m.docId === doc.id,
  );
  const unread = unreadMessages(participant, doc.id, role).map((m) => m.id);
  const unreadKey = unread.join(",");
  useEffect(() => {
    if (!connected || !unreadKey || marking.current === unreadKey) return;
    marking.current = unreadKey;
    Promise.resolve(onReadMessages(doc.id, unreadKey.split(","))).catch(() => {
      marking.current = "";
    });
  }, [connected, doc.id, unreadKey, onReadMessages]);
  useEffect(() => {
    if (end.current) end.current.scrollTop = end.current.scrollHeight;
  }, [messages.length]);
  return (
    <section
      className="teacher-messages"
      aria-label={
        role === "teacher" ? `${doc.name} 학생과 메시지` : "선생님과 메시지"
      }
    >
      <h3>
        <MessageSquare size={17} />
        {role === "teacher" ? "학생과 메시지" : "선생님과 메시지"}
      </h3>
      <p className="meta">이 글에 대한 대화예요. 나와 선생님만 볼 수 있어요.</p>
      <div
        className="message-history"
        role="log"
        aria-label="메시지 기록"
        ref={end}
      >
        {!messages.length && (
          <p className="empty-note">
            막막한 부분이나 궁금한 점을 편하게 적어 보세요.
          </p>
        )}
        {messages.map((m) => (
          <article
            key={m.id}
            className={`private-message ${m.sender === role ? "from-me" : ""}`}
          >
            <strong>{m.sender === "teacher" ? "선생님" : doc.name}</strong>
            <p>{m.text}</p>
            <small>
              {new Date(m.createdAt).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {m.sender === role && (m.readAt ? " · 읽음" : " · 전달됨")}
            </small>
          </article>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim() || busy || !connected) return;
          setBusy(true);
          setError("");
          try {
            await onSendMessage(doc.id, text.trim());
            setText("");
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "메시지를 보내지 못했어요. 다시 눌러 주세요.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          {role === "teacher" ? "학생에게 답장" : "선생님께 보낼 메시지"}
          <textarea
            rows={3}
            maxLength={1000}
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              role === "teacher"
                ? "생각을 이어 갈 수 있도록 답해 주세요."
                : "어떤 이야기로 시작해야 할지 모르겠어요."
            }
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {!connected && (
          <p className="meta">
            연결되면 메시지를 보낼 수 있어요. 적은 말은 이 창에 남아 있어요.
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={!connected || busy || !text.trim()}
        >
          <Send size={16} />
          {busy
            ? "보내는 중…"
            : role === "teacher"
              ? "답장 보내기"
              : "메시지 보내기"}
        </Button>
      </form>
    </section>
  );
}

export function MessageButton(
  props: MessageActions & {
    participant?: Participant;
    doc: StudentDoc;
    connected?: boolean;
  },
) {
  const [open, setOpen] = useState(false);
  const unread = unreadMessages(
    props.participant,
    props.doc.id,
    "student",
  ).length;
  return (
    <>
      <Button
        className={unread ? "help-pending" : ""}
        onClick={() => setOpen(true)}
      >
        <MessageSquare size={17} />
        메시지 보내기
        {unread > 0 && (
          <span className="count-tag" aria-label={`새 답장 ${unread}개`}>
            {unread}
          </span>
        )}
      </Button>
      {open && (
        <Modal title="선생님과 메시지" onClose={() => setOpen(false)}>
          <div className="modal-form">
            <MessageThread {...props} role="student" />
          </div>
        </Modal>
      )}
    </>
  );
}
