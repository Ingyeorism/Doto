import { useState } from "react";
import { Hand } from "lucide-react";
import type { BoardGroup, HelpRequest, Participant, StudentDoc } from "./data";
import { Button, Modal } from "./ui";

export function HelpButton({
  participant,
  groups,
  doc,
  onRequest,
  connected = true,
  label = "도움 요청",
}: {
  participant?: Participant;
  groups: BoardGroup[];
  doc?: StudentDoc;
  onRequest: (request?: HelpRequest) => Promise<unknown> | void;
  connected?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"writing" | "move">("writing");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (request?: HelpRequest) => {
    if (busy || !connected) return;
    setBusy(true);
    setError("");
    try {
      await onRequest(request);
      setOpen(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "요청을 보내지 못했어요. 다시 눌러 주세요.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        className={participant?.help ? "help-pending" : ""}
        onClick={() => {
          setKind("writing");
          setNote("");
          setTarget("");
          setError("");
          setOpen(true);
        }}
      >
        <Hand size={17} />
        {participant?.help ? "도움 요청 중" : label}
      </Button>
      {open && (
        <Modal
          title={
            participant?.help
              ? "선생님께 도움을 요청했어요"
              : "어떤 도움이 필요한가요?"
          }
          onClose={() => setOpen(false)}
        >
          <div className="modal-form">
            {!connected && (
              <p className="meta">선생님과 연결되면 요청을 보낼 수 있어요.</p>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            {participant?.help ? (
              <>
                <p>
                  {participant.help.kind === "move"
                    ? `‘${groups.find((g) => g.id === participant.help?.targetGroupId)?.title ?? "다른 그룹"}’으로 글을 옮겨 달라고 했어요.`
                    : "선생님이 도와줄 때까지 할 수 있는 부분을 써 봐요."}
                </p>
                {participant.help.note && (
                  <blockquote>{participant.help.note}</blockquote>
                )}
                <Button
                  disabled={!connected || busy}
                  onClick={() => void submit()}
                >
                  이제 괜찮아요 · 요청 취소
                </Button>
                <Button variant="primary" onClick={() => setOpen(false)}>
                  계속 쓰기
                </Button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit({
                    kind,
                    docId: doc?.id,
                    targetGroupId: kind === "move" ? target : undefined,
                    note: note.trim(),
                    createdAt: Date.now(),
                  });
                }}
              >
                <label className="field">
                  도움 종류
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as typeof kind)}
                  >
                    <option value="writing">글쓰기가 어려워요</option>
                    {doc && groups.some((g) => g.id !== doc.groupId) && (
                      <option value="move">다른 그룹으로 옮겨 주세요</option>
                    )}
                  </select>
                </label>
                {kind === "move" && (
                  <label className="field">
                    옮기고 싶은 그룹
                    <select
                      required
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      <option value="">그룹을 골라 주세요</option>
                      {groups
                        .filter((g) => g.id !== doc?.groupId)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  덧붙일 말 · 선택
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="아무 말도 적지 않고 요청해도 돼요."
                  />
                </label>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!connected || busy || (kind === "move" && !target)}
                >
                  <Hand size={16} />
                  선생님께 요청하기
                </Button>
              </form>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
