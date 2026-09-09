import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import {
  BookOpen,
  GripVertical,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  type BoardComment,
  type BoardGroup,
  type Feedback,
  type FeedbackSelection,
  type PostSort,
  type StudentDoc,
} from "./data";
import { Button, DocumentBody, Modal, Toggle } from "./ui";
import { WritingEditor } from "./WritingEditor";
import { FeedbackCards } from "./FeedbackSurface";
import { GroupLearningFields, LessonMaterials } from "./GroupLearning";
import { cleanGroup, publicationState } from "./learning";
import { createUuid } from "./uuid";
import { sortBoardCards } from "./board-order";

const sortNames: Record<PostSort, string> = {
  oldest: "새 글 아래",
  newest: "최신 글 위",
  author: "이름순",
  title: "제목순",
  manual: "직접 배치",
};
type DragItem =
  { kind: "group"; id: string } | { kind: "post" | "draft"; id: number };
type DropTarget = { groupId: string; beforeId?: number };
function ExpandablePost({
  doc,
  autoExpand,
  onOpen,
}: {
  doc: StudentDoc;
  autoExpand: boolean;
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = useState(autoExpand);
  const bodyId = useId();
  return (
    <>
      <button className="post-open" onClick={onOpen}>
        <h3>{doc.title}</h3>
      </button>
      <div
        id={bodyId}
        className={`post-body ${expanded ? "is-expanded" : "is-collapsed"}`}
        onClick={(e) => {
          if (
            !(e.target as HTMLElement).closest("a") &&
            !window.getSelection()?.toString()
          )
            onOpen();
        }}
      >
        <DocumentBody doc={doc} />
      </div>
      <Button
        className="post-expand"
        variant="ghost"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "접기" : "펼치기"}
      </Button>
    </>
  );
}
interface Props {
  onFeedbackResponse: (id: number, response: Feedback["response"]) => void;
  boardTitle: string;
  onTitleChange: (title: string) => void;
  trashCount: number;
  onOpenTrash: () => void;
  posts: StudentDoc[];
  docs: StudentDoc[];
  groups: BoardGroup[];
  feedback: Feedback[];
  role: "teacher" | "student";
  studentName: string;
  currentUserId: number;
  sort: PostSort;
  onSort: (sort: PostSort) => void;
  comments: Record<number, BoardComment[]>;
  onComment: (id: number, text: string) => void;
  onDeleteComment?: (id: number, commentId: string) => void;
  commentsEnabled: boolean;
  onToggleComments: () => void;
  onRemove: (id: number) => void;
  onCreate: (groupId: string) => void;
  onWrite: (id: number) => void;
  onSaveGroup: (group: BoardGroup) => void;
  onDeleteGroup: (id: string) => void;
  onReorderGroup: (id: string, targetId: string) => void;
  onMovePost: (id: number, groupId: string, beforeId?: number) => void;
  onUpdate: (id: number, changes: Partial<StudentDoc>) => void;
  onFeedback: (
    id: number,
    message: string,
    selection?: FeedbackSelection,
  ) => void;
}
export function Community({
  onFeedbackResponse,
  boardTitle,
  onTitleChange,
  trashCount,
  onOpenTrash,
  posts,
  docs,
  groups,
  feedback,
  role,
  studentName,
  currentUserId,
  sort,
  onSort,
  comments,
  onComment,
  onDeleteComment,
  commentsEnabled,
  onToggleComments,
  onRemove,
  onCreate,
  onWrite,
  onSaveGroup,
  onDeleteGroup,
  onReorderGroup,
  onMovePost,
  onUpdate,
  onFeedback,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [groupDraft, setGroupDraft] = useState<BoardGroup | null>(null);
  const [learningBusy, setLearningBusy] = useState(false);
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);
  const pointerDrag = useRef<{
    item: DragItem;
    x: number;
    y: number;
    clientX: number;
    clientY: number;
    moved: boolean;
  } | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(boardTitle);
  const [deletingGroup, setDeletingGroup] = useState<BoardGroup | null>(null);
  const teacher = role === "teacher";
  const post = posts.find((p) => p.id === selected);
  const liveDoc = docs.find((d) => d.id === selected);
  const notes = feedback.filter((f) => f.docId === selected);
  const drafts = docs.filter(
    (d) => d.studentId === currentUserId && !d.published,
  );
  const sorted = (groupId: string) =>
    sortBoardCards(
      posts.filter((p) => p.groupId === groupId),
      sort,
      drafts.filter((d) => d.groupId === groupId),
    );
  const beginDrag = (e: PointerEvent<HTMLButtonElement>, item: DragItem) => {
    if (!teacher || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerDrag.current = {
      item,
      x: e.clientX,
      y: e.clientY,
      clientX: e.clientX,
      clientY: e.clientY,
      moved: false,
    };
  };
  const dragTarget = (e: {
    clientX: number;
    clientY: number;
  }): DropTarget | null => {
    const group = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-group-id]");
    if (!group?.dataset.groupId) return null;
    const active = pointerDrag.current?.item;
    const next = Array.from(
      group.querySelectorAll<HTMLElement>("[data-board-card-id]"),
    )
      .filter(
        (card) =>
          active?.kind === "group" ||
          Number(card.dataset.boardCardId) !== active?.id,
      )
      .find((card) => {
        const rect = card.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      });
    return {
      groupId: group.dataset.groupId,
      beforeId: next ? Number(next.dataset.boardCardId) : undefined,
    };
  };
  const updateDropTarget = (target: DropTarget | null) =>
    setOver((previous) =>
      previous?.groupId === target?.groupId &&
      previous?.beforeId === target?.beforeId
        ? previous
        : target,
    );
  useEffect(() => {
    if (!drag) return;
    let frame: number;
    const scroll = () => {
      const pointer = pointerDrag.current;
      if (!pointer?.moved) return;
      const edge = 96;
      const delta =
        pointer.clientY < edge
          ? -Math.min(14, (edge - pointer.clientY) / 4)
          : pointer.clientY > window.innerHeight - edge
            ? Math.min(14, (pointer.clientY - window.innerHeight + edge) / 4)
            : 0;
      if (
        delta &&
        pointer.clientY >= 0 &&
        pointer.clientY <= window.innerHeight
      ) {
        const before = window.scrollY;
        window.scrollBy(0, delta);
        if (window.scrollY !== before) updateDropTarget(dragTarget(pointer));
      }
      frame = window.requestAnimationFrame(scroll);
    };
    frame = window.requestAnimationFrame(scroll);
    return () => window.cancelAnimationFrame(frame);
  }, [drag]);
  const moveDrag = (e: PointerEvent) => {
    const active = pointerDrag.current;
    if (!active) return;
    active.clientX = e.clientX;
    active.clientY = e.clientY;
    if (
      !active.moved &&
      Math.hypot(e.clientX - active.x, e.clientY - active.y) < 8
    )
      return;
    active.moved = true;
    setDrag(active.item);
    updateDropTarget(dragTarget(e));
  };
  const finishDrag = (e: PointerEvent) => {
    const active = pointerDrag.current;
    const target = dragTarget(e);
    if (active?.moved && target) {
      if (active.item.kind === "group")
        onReorderGroup(active.item.id, target.groupId);
      else onMovePost(active.item.id, target.groupId, target.beforeId);
    }
    pointerDrag.current = null;
    setDrag(null);
    setOver(null);
  };
  const openPost = (id: number) => {
    setSelected(id);
    setMessage("");
    setAnnotating(false);
  };
  const dropClass = (item: StudentDoc, cards: StudentDoc[]) => {
    if (
      !drag ||
      drag.kind === "group" ||
      over?.groupId !== item.groupId ||
      drag.id === item.id
    )
      return "";
    if (over.beforeId === item.id) return "drop-before";
    if (
      over.beforeId === undefined &&
      cards.filter((card) => card.id !== drag.id).at(-1)?.id === item.id
    )
      return "drop-after";
    return "";
  };
  return (
    <main className="community-page grouped-board">
      <div className="page-heading board-heading">
        {editingTitle && teacher ? (
          <form
            className="board-title-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!titleDraft.trim()) return;
              onTitleChange(titleDraft.trim());
              setEditingTitle(false);
            }}
          >
            <input
              aria-label="게시판 제목"
              autoFocus
              maxLength={80}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingTitle(false);
              }}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!titleDraft.trim()}
            >
              저장
            </Button>
            <Button onClick={() => setEditingTitle(false)}>취소</Button>
          </form>
        ) : (
          <div className="board-title-row">
            <h1>{boardTitle}</h1>
            {teacher && (
              <button
                className="board-title-edit"
                aria-label="게시판 제목 수정"
                onClick={() => {
                  setTitleDraft(boardTitle);
                  setEditingTitle(true);
                }}
              >
                <Pencil size={17} />
                <span>제목 수정</span>
              </button>
            )}
          </div>
        )}
        <span className="board-total">
          <BookOpen size={18} />
          {posts.length}개의 글
        </span>
      </div>
      {!teacher && drafts.length > 0 && (
        <section className="my-drafts" aria-label="내가 쓰던 글">
          <h2>
            내가 쓰던 글 <span className="count-tag">{drafts.length}</span>
          </h2>
          <p>
            아직 게시하지 않은 글이에요. 나갔다 와도 여기서 이어 쓸 수 있어요.
          </p>
          <div className="my-draft-list">
            {drafts.map((draft) => (
              <button key={draft.id} onClick={() => onWrite(draft.id)}>
                <span>
                  <small>
                    {groups.find((g) => g.id === draft.groupId)?.title}
                  </small>
                  <strong>{draft.title || "아직 제목이 없는 이야기"}</strong>
                </span>
                <span className="text-link">
                  <Pencil size={15} /> 이어 쓰기
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="community-toolbar">
        <div className="row gap-10 group-board-controls">
          {teacher ? (
            <>
              <Button onClick={onOpenTrash}>
                <Trash2 size={16} />
                휴지통
                {trashCount > 0 && (
                  <span className="count-tag">{trashCount}</span>
                )}
              </Button>
              <label className="sort-control">
                정렬{" "}
                <select
                  aria-label="게시글 정렬"
                  value={sort}
                  onChange={(e) => onSort(e.target.value as PostSort)}
                >
                  {Object.entries(sortNames).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="row gap-10">
                댓글
                <Toggle
                  checked={commentsEnabled}
                  onChange={onToggleComments}
                  label="댓글 작성 허용"
                />
              </label>
              <Button
                onClick={() =>
                  setGroupDraft({
                    id: createUuid(),
                    title: "",
                    description: "",
                  })
                }
              >
                <Plus size={16} />
                그룹 만들기
              </Button>
            </>
          ) : (
            <span className="pill muted">{sortNames[sort]}</span>
          )}
        </div>
      </div>
      <div
        className="group-columns"
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={() => {
          pointerDrag.current = null;
          setDrag(null);
          setOver(null);
        }}
      >
        {groups.map((group, index) => {
          const cards = sorted(group.id);
          return (
            <section
              key={group.id}
              className={`board-group group-tone-${index % 3} ${over?.groupId === group.id ? "drag-over" : ""}`}
              aria-label={group.title}
              data-group-id={group.id}
            >
              <header className="group-heading">
                <div className="group-title-row">
                  {teacher && (
                    <button
                      className="drag-handle"
                      onPointerDown={(e) =>
                        beginDrag(e, { kind: "group", id: group.id })
                      }
                      aria-label={`${group.title} 그룹 순서 드래그`}
                      title="그룹 순서 드래그"
                    >
                      <GripVertical size={18} />
                    </button>
                  )}
                  <h2>{group.title}</h2>
                  <span className="count-tag">
                    {posts.filter((p) => p.groupId === group.id).length}
                  </span>
                  <button
                    className="group-add"
                    aria-label={`${group.title}에 새 글 쓰기`}
                    title="이 그룹에 새 글 쓰기"
                    onClick={() => onCreate(group.id)}
                  >
                    <Plus size={22} />
                  </button>
                </div>
                <p>{group.description || "이곳에 이야기를 모아 보세요."}</p>
                <LessonMaterials group={group} />
                {teacher && (
                  <div className="group-management">
                    <button
                      className="text-link"
                      onClick={() => setGroupDraft({ ...group })}
                    >
                      <Settings2 size={14} />
                      그룹 설정
                    </button>
                  </div>
                )}
              </header>
              <div className="group-posts">
                {cards.map((item) =>
                  !item.published ? (
                    <article
                      className={`group-draft ${drag?.kind === "draft" && drag.id === item.id ? "is-dragging" : ""} ${dropClass(item, cards)}`}
                      key={item.id}
                      data-board-card-id={item.id}
                    >
                      <div className="row space-between">
                        <span className="pill muted">작성 중 · 비공개</span>
                        {teacher && (
                          <button
                            className="drag-handle"
                            onPointerDown={(e) =>
                              beginDrag(e, { kind: "draft", id: item.id })
                            }
                            aria-label={`${item.title || "작성 중인 글"} 글 이동 드래그`}
                            title="원하는 위치로 드래그"
                          >
                            <GripVertical size={17} />
                          </button>
                        )}
                      </div>
                      <button onClick={() => onWrite(item.id)}>
                        <h3>{item.title || "아직 제목이 없는 이야기"}</h3>
                        <p>
                          {item.paragraphs.join(" ").slice(0, 90) ||
                            "어떤 이야기로 시작해 볼까요?"}
                        </p>
                        <span className="text-link">
                          <Pencil size={14} />
                          이어서 쓰기
                        </span>
                      </button>
                    </article>
                  ) : (
                    <article
                      key={item.id}
                      className={`group-post ${drag?.kind === "post" && drag.id === item.id ? "is-dragging" : ""} ${dropClass(item, cards)}`}
                      data-post-id={item.id}
                      data-board-card-id={item.id}
                    >
                      <div className="post-author">
                        <span className="initial-avatar">
                          {item.name.slice(-2)}
                        </span>
                        <strong>{item.name}</strong>
                        {teacher && (
                          <button
                            className="drag-handle"
                            onPointerDown={(e) =>
                              beginDrag(e, { kind: "post", id: item.id })
                            }
                            aria-label={`${item.title} 글 이동 드래그`}
                            title="원하는 위치로 드래그"
                          >
                            <GripVertical size={17} />
                          </button>
                        )}
                      </div>
                      <ExpandablePost
                        key={`${item.id}-${group.id}-${!!group.autoExpand}`}
                        doc={item}
                        autoExpand={!!group.autoExpand}
                        onOpen={() => openPost(item.id)}
                      />
                      <footer>
                        {item.studentId === currentUserId &&
                          docs.some(
                            (d) =>
                              d.id === item.id &&
                              publicationState(d, item) === "changed",
                          ) && (
                            <span className="post-update-note">
                              고친 내용은 아직 올리지 않았어요
                            </span>
                          )}
                        <button
                          className="subtle-control"
                          onClick={() => openPost(item.id)}
                        >
                          <MessageCircle size={14} />
                          {comments[item.id]?.length ?? 0}
                        </button>
                        {item.studentId === currentUserId && (
                          <button
                            className="text-link"
                            onClick={() => onWrite(item.id)}
                          >
                            <Pencil size={14} />내 글 수정
                          </button>
                        )}
                      </footer>
                    </article>
                  ),
                )}
                {cards.length === 0 && (
                  <div
                    className={`empty-group ${drag && drag.kind !== "group" && over?.groupId === group.id ? "drop-before" : ""}`}
                  >
                    <BookOpen size={24} />
                    <p>첫 이야기를 기다리고 있어요.</p>
                  </div>
                )}
                <button
                  className="group-new-post"
                  onClick={() => onCreate(group.id)}
                >
                  <Plus size={18} />
                  <span>이 그룹에 글 쓰기</span>
                </button>
              </div>
            </section>
          );
        })}
        {teacher && (
          <button
            className="add-group-tile"
            onClick={() =>
              setGroupDraft({
                id: createUuid(),
                title: "",
                description: "",
              })
            }
          >
            <Plus size={23} />새 주제 그룹
          </button>
        )}
      </div>
      {groupDraft && teacher && (
        <Modal
          title={
            groups.some((g) => g.id === groupDraft.id)
              ? "그룹 설정"
              : "새 주제 그룹"
          }
          onClose={() => setGroupDraft(null)}
        >
          <form
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!groupDraft.title.trim() || learningBusy) return;
              onSaveGroup(
                cleanGroup({
                  ...groupDraft,
                  title: groupDraft.title.trim(),
                  description: groupDraft.description.trim(),
                }),
              );
              setGroupDraft(null);
            }}
          >
            <label className="field">
              그룹 이름
              <input
                autoFocus
                required
                maxLength={40}
                value={groupDraft.title}
                onChange={(e) =>
                  setGroupDraft({ ...groupDraft, title: e.target.value })
                }
                placeholder="예: 내가 꿈꾸는 우리 학교"
              />
            </label>
            <label className="field">
              글쓰기 안내
              <textarea
                rows={3}
                maxLength={200}
                value={groupDraft.description}
                onChange={(e) =>
                  setGroupDraft({ ...groupDraft, description: e.target.value })
                }
                placeholder="이 그룹에서는 어떤 이야기를 쓸까요?"
              />
            </label>
            <label className="optional-check">
              <input
                type="checkbox"
                checked={!!groupDraft.autoExpand}
                onChange={(e) =>
                  setGroupDraft({ ...groupDraft, autoExpand: e.target.checked })
                }
              />
              <span>
                <strong>게시글 자동으로 펼치기</strong>
                <small>
                  이 그룹의 글을 선생님과 학생 게시판에서 처음부터 끝까지 보여
                  줘요.
                </small>
              </span>
            </label>
            <GroupLearningFields
              group={groupDraft}
              onChange={setGroupDraft}
              onBusyChange={setLearningBusy}
            />
            <div className="modal-footer">
              {groups.some((g) => g.id === groupDraft.id) && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setDeletingGroup(
                      groups.find((g) => g.id === groupDraft.id) ?? null,
                    );
                    setGroupDraft(null);
                  }}
                >
                  <Trash2 size={15} />
                  그룹 삭제
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={!groupDraft.title.trim() || learningBusy}
              >
                저장하기
              </Button>
            </div>
            <p className="meta">
              그룹을 삭제하면 안에 있는 글도 휴지통으로 옮겨져요. 삭제 전에 한
              번 더 확인합니다.
            </p>
          </form>
        </Modal>
      )}
      {deletingGroup && teacher && (
        <Modal
          title="정말 삭제하시겠습니까?"
          onClose={() => setDeletingGroup(null)}
        >
          <div className="modal-form">
            <p>
              <strong>‘{deletingGroup.title}’</strong> 그룹을 삭제합니다.
            </p>
            <div className="delete-group-summary">
              <strong>
                원고 {docs.filter((d) => d.groupId === deletingGroup.id).length}
                개
              </strong>
              <span>
                게시한 글{" "}
                {posts.filter((p) => p.groupId === deletingGroup.id).length}개
                포함
              </span>
            </div>
            <p>
              작성 중인 글과 게시글, 댓글, 피드백을 함께 휴지통으로 옮겨요. 30일
              안에 복원할 수 있습니다.
            </p>
            <div className="modal-footer">
              <Button onClick={() => setDeletingGroup(null)}>취소</Button>
              <Button
                variant="danger"
                onClick={() => {
                  onDeleteGroup(deletingGroup.id);
                  setDeletingGroup(null);
                }}
              >
                삭제하기
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {groups.length === 0 && !teacher && (
        <p className="board-empty-message">
          선생님이 글쓰기 그룹을 준비하고 있어요.
        </p>
      )}
      {post && (
        <Modal
          title={annotating ? "현재 원고에 피드백" : "친구의 이야기"}
          wide
          onClose={() => setSelected(null)}
        >
          <div className="board-reading">
            <div className="reading-meta">
              <span className="pill sage">
                {groups.find((g) => g.id === post.groupId)?.title}
              </span>
              <span>{post.name}</span>
              {teacher && (
                <Button onClick={() => setAnnotating(!annotating)}>
                  {annotating ? <BookOpen size={15} /> : <Pencil size={15} />}
                  {annotating ? "게시한 글 보기" : "원고에 피드백"}
                </Button>
              )}
              {post.studentId === currentUserId && (
                <Button onClick={() => onWrite(post.id)}>내 글 수정</Button>
              )}
            </div>
            {annotating && teacher && liveDoc ? (
              <>
                <p className="reader-hint">
                  현재 작성 중인 원고입니다. 구절을 드래그해 피드백을 남겨
                  주세요.
                </p>
                <WritingEditor
                  key={liveDoc.id}
                  compact
                  readOnly
                  doc={liveDoc}
                  feedback={notes}
                  onUpdate={(changes) => onUpdate(liveDoc.id, changes)}
                  onCreateFeedback={(text, range) =>
                    onFeedback(liveDoc.id, text, range)
                  }
                  onFeedbackResponse={onFeedbackResponse}
                  feedbackRole="teacher"
                />
                <FeedbackCards
                  doc={liveDoc}
                  feedback={notes}
                  role="teacher"
                  onResponse={onFeedbackResponse}
                />
              </>
            ) : (
              <>
                <article className="published-document">
                  <h2>{post.title}</h2>
                  <DocumentBody doc={post} />
                </article>
                {(teacher || post.studentId === currentUserId) &&
                  liveDoc &&
                  notes.length > 0 && (
                    <section
                      className="board-private-feedback"
                      aria-label="선생님 피드백"
                    >
                      <h3>
                        선생님 피드백{" "}
                        <span className="count-tag">{notes.length}</span>
                      </h3>
                      <FeedbackCards
                        doc={liveDoc}
                        feedback={notes}
                        role={teacher ? "teacher" : "student"}
                        onResponse={onFeedbackResponse}
                      />
                    </section>
                  )}
                <section className="board-comments">
                  <h3>
                    <MessageCircle size={17} />
                    함께 나누는 한마디{" "}
                    <span>{comments[post.id]?.length ?? 0}</span>
                  </h3>
                  {(comments[post.id] ?? []).map((comment, i) => (
                    <div className="board-comment" key={i}>
                      <strong>{comment.name}</strong>
                      <p>{comment.text}</p>
                      {comment.id &&
                        onDeleteComment &&
                        (teacher || comment.studentId === currentUserId) && (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              onDeleteComment(post.id, comment.id!)
                            }
                          >
                            댓글 삭제
                          </Button>
                        )}
                    </div>
                  ))}
                  {commentsEnabled ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!message.trim()) return;
                        onComment(post.id, message.trim());
                        setMessage("");
                      }}
                    >
                      <label className="sr-only" htmlFor="board-comment">
                        {studentName}의 댓글
                      </label>
                      <textarea
                        id="board-comment"
                        rows={2}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="친구에게 다정한 한마디를 남겨 주세요."
                      />
                      <Button
                        variant="primary"
                        type="submit"
                        disabled={!message.trim()}
                      >
                        <Send size={15} />
                        남기기
                      </Button>
                    </form>
                  ) : (
                    <p className="meta">지금은 댓글을 쉬어 가는 시간이에요.</p>
                  )}
                </section>
              </>
            )}
            {(teacher || post.studentId === currentUserId) && (
              <div className="reading-bottom">
                <Button
                  variant="ghost"
                  onClick={() => {
                    onRemove(post.id);
                    setSelected(null);
                  }}
                >
                  <X size={14} />
                  게시 내리기
                </Button>
                <span className="meta">원고와 피드백은 그대로 남아요.</span>
              </div>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}
