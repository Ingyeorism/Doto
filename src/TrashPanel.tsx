import { RotateCcw, Trash2 } from "lucide-react";
import { type TrashBatch, TRASH_DAYS } from "./board-state";
import { Button, Modal } from "./ui";

export function TrashPanel({
  trash,
  onRestore,
  onClose,
}: {
  trash: TrashBatch[];
  onRestore: (id: string, docId?: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="휴지통" wide onClose={onClose}>
      <div className="trash-content">
        <p className="trash-description">
          삭제한 그룹과 글을 {TRASH_DAYS}일 동안 이 브라우저에 보관해요.
          복원하면 댓글과 선생님 피드백도 함께 돌아옵니다.
        </p>
        {!trash.length && (
          <div className="trash-empty">
            <Trash2 size={30} />
            <p>휴지통이 비어 있어요.</p>
          </div>
        )}
        {[...trash].reverse().map((batch) => (
          <section className="trash-batch" key={batch.id}>
            <header>
              <div>
                <h3>{batch.group.title}</h3>
                <p>
                  {new Date(batch.deletedAt).toLocaleDateString("ko-KR")} 삭제 ·{" "}
                  {Math.max(
                    1,
                    TRASH_DAYS -
                      Math.floor((Date.now() - batch.deletedAt) / 86400000),
                  )}
                  일 남음 · 원고 {batch.docs.length}개
                </p>
              </div>
              <Button onClick={() => onRestore(batch.id)}>
                <RotateCcw size={15} />
                그룹 전체 복원
              </Button>
            </header>
            {batch.docs.map((doc) => (
              <div className="trash-document" key={doc.id}>
                <div>
                  <strong>{doc.title || "제목 없는 글"}</strong>
                  <span>
                    {doc.name} ·{" "}
                    {doc.published ? "게시한 글 포함" : "미게시 원고"} · 피드백{" "}
                    {batch.feedback.filter((f) => f.docId === doc.id).length}개
                    · 댓글 {batch.comments[doc.id]?.length ?? 0}개
                  </span>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => onRestore(batch.id, doc.id)}
                >
                  이 글 복원
                </Button>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}
