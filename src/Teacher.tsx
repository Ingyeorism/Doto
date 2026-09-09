import { useState } from "react";
import {
  ArrowDownAZ,
  Check,
  ChevronRight,
  Columns2,
  MessageSquare,
  PenLine,
  Send,
  X,
} from "lucide-react";
import {
  type BoardGroup,
  type Feedback,
  type FeedbackSelection,
  type StudentDoc,
  type Participant,
  charCount,
} from "./data";
import { FeedbackCards } from "./FeedbackSurface";
import {
  Button,
  DocumentBody,
  IconButton,
  Modal,
  Toggle,
  SourceList,
} from "./ui";
import { WritingEditor } from "./WritingEditor";
import {
  MessageThread,
  unreadMessages,
  type MessageActions,
} from "./TeacherMessages";

interface Props extends MessageActions {
  selectedDocId?: number | null;
  onSelectDoc?: (id: number | null) => void;
  participants: Participant[];
  onFinishHelp: (studentId: number, move?: boolean) => void;
  onFeedbackResponse: (id: number, response: Feedback["response"]) => void;
  docs: StudentDoc[];
  feedback: Feedback[];
  groups: BoardGroup[];
  onUpdate: (id: number, changes: Partial<StudentDoc>) => void;
  onFeedback: (
    docId: number,
    message: string,
    selection?: FeedbackSelection,
  ) => void;
}
export function Teacher({
  selectedDocId,
  onSelectDoc,
  docs,
  feedback,
  groups,
  onUpdate,
  onFeedback,
  participants,
  onFinishHelp,
  onFeedbackResponse,
  onSendMessage,
  onReadMessages,
}: Props) {
  const [localSelected, setLocalSelected] = useState<number | null>(null);
  const selected = selectedDocId === undefined ? localSelected : selectedDocId;
  const setSelected = onSelectDoc ?? setLocalSelected;
  const [size, setSize] = useState("normal");
  const [sort, setSort] = useState(false);
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [comparing, setComparing] = useState(false);
  const selectedDoc = docs.find((d) => d.id === selected);
  const scopedDocs = docs.filter(
    (d) => groupFilter === "all" || d.groupId === groupFilter,
  );
  const helpCount = participants.filter(
    (p) =>
      p.help &&
      (groupFilter === "all" ||
        scopedDocs.some((d) => d.studentId === p.id && p.help?.docId === d.id)),
  ).length;
  const visible = docs.filter(
    (d) =>
      (groupFilter === "all" || d.groupId === groupFilter) &&
      (statusFilter === "all" ||
        (statusFilter === "draft" && !d.published) ||
        (statusFilter === "published" && d.published) ||
        (statusFilter === "message" &&
          participants.some(
            (p) =>
              p.id === d.studentId &&
              unreadMessages(p, d.id, "teacher").length > 0,
          )) ||
        (statusFilter === "revised" &&
          feedback.some((f) => f.docId === d.id && f.response === "revised")) ||
        (statusFilter === "help" &&
          participants.some(
            (p) => p.id === d.studentId && p.help && p.help.docId === d.id,
          ))),
  );
  const unstarted = participants.filter(
    (p) => !docs.some((d) => d.studentId === p.id),
  );
  const waiting =
    groupFilter === "all" && ["all", "unstarted", "help"].includes(statusFilter)
      ? participants.filter(
          (p) =>
            (!docs.some((d) => d.studentId === p.id) ||
              (statusFilter !== "unstarted" &&
                p.help &&
                p.help.docId === undefined)) &&
            (statusFilter !== "help" || p.help),
        )
      : [];
  const ordered = sort
    ? [...visible].sort((a, b) => a.name.localeCompare(b.name, "ko"))
    : visible;
  return (
    <div
      className={`teacher-layout ${selectedDoc && !compareMode ? "has-detail" : ""}`}
    >
      <section className="class-board" aria-label="학생 전체 글">
        <div className="class-participants">
          <details>
            <summary>
              참여 학생 {participants.length}명 <span>명단 보기</span>
            </summary>
            <ul>
              {participants.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong>
                  <span>
                    {docs.some((d) => d.studentId === p.id)
                      ? `원고 ${docs.filter((d) => d.studentId === p.id).length}개`
                      : "원고 없음"}
                    {p.help && " · 도움 요청"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <span>
            원고 {docs.length}개 · 게시 {docs.filter((d) => d.published).length}
            개
          </span>
        </div>
        <div className="board-toolbar">
          <div className="row gap-10">
            <h2>학생 글</h2>
            <span className="count-tag">{docs.length}</span>
          </div>
          <div className="row board-controls">
            <select
              className="board-select"
              aria-label="주제 그룹별 원고 보기"
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                if (statusFilter === "unstarted") setStatusFilter("all");
                setSelected(null);
              }}
            >
              <option value="all">모든 그룹</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
            <button
              aria-label="나란히 보기"
              title="나란히 보기"
              className={`subtle-control ${compareMode ? "active" : ""}`}
              onClick={() => {
                setCompareMode(!compareMode);
                setCompareIds([]);
              }}
            >
              <Columns2 size={16} />
              <span>나란히 보기</span>
            </button>
            <button
              aria-label={sort ? "이름순 정렬" : "입장순 정렬"}
              title="정렬 변경"
              className="subtle-control"
              onClick={() => setSort(!sort)}
            >
              <ArrowDownAZ size={16} />
              <span>{sort ? "이름순" : "입장순"}</span>
            </button>
            <div className="segmented" aria-label="카드 크기">
              {[
                ["small", "작게"],
                ["normal", "보통"],
                ["large", "크게"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={size === value ? "active" : ""}
                  aria-pressed={size === value}
                  onClick={() => setSize(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="teacher-status-filters" aria-label="작성 상태별 보기">
          {[
            ["all", "모두", scopedDocs.length],
            ["unstarted", "원고 없음", unstarted.length],
            ["draft", "초안", scopedDocs.filter((d) => !d.published).length],
            [
              "published",
              "게시됨",
              scopedDocs.filter((d) => d.published).length,
            ],
            ["help", "도움 요청", helpCount],
            [
              "message",
              "새 메시지",
              scopedDocs.filter(
                (d) =>
                  unreadMessages(
                    participants.find((p) => p.id === d.studentId),
                    d.id,
                    "teacher",
                  ).length > 0,
              ).length,
            ],
            [
              "revised",
              "고친 글 확인",
              new Set(
                feedback
                  .filter(
                    (f) =>
                      f.response === "revised" &&
                      scopedDocs.some((d) => d.id === f.docId),
                  )
                  .map((f) => f.docId),
              ).size,
            ],
          ].map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={statusFilter === value}
              className={statusFilter === value ? "active" : ""}
              onClick={() => {
                setStatusFilter(String(value));
                setSelected(null);
                if (value === "unstarted") setGroupFilter("all");
              }}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
        {compareMode && (
          <div className="compare-banner">
            <span>나란히 읽을 글을 2~3개 골라 주세요.</span>
            <Button
              variant="primary"
              disabled={compareIds.length < 2}
              onClick={() => setComparing(true)}
            >
              선택한 {compareIds.length}개 보기
            </Button>
          </div>
        )}
        <div className={`student-grid size-${size}`}>
          {waiting.map((p) => (
            <article
              className="student-card unstarted-card"
              key={`participant-${p.id}`}
            >
              <h3>{p.name}</h3>
              {docs.some((d) => d.studentId === p.id) ? (
                <p>게시판에서 도움을 요청했어요.</p>
              ) : (
                <>
                  <p>현재 원고가 없어요.</p>
                  <span className="meta">
                    생각을 정리하거나 첫 글을 준비하는 중이에요.
                  </span>
                </>
              )}
              {p.help && (
                <TeacherHelp
                  participant={p}
                  groups={groups}
                  docs={docs}
                  onFinish={onFinishHelp}
                />
              )}
            </article>
          ))}
          {ordered.map((doc, index) => (
            <article
              className={`student-card ${!compareMode && selected === doc.id ? "selected" : ""} ${compareIds.includes(doc.id) ? "compare-selected" : ""}`}
              key={doc.id}
            >
              <button
                className="card-heading"
                aria-label={`${doc.name} 글 ${compareMode ? "선택" : "크게 보기"}`}
                onClick={() =>
                  compareMode
                    ? setCompareIds((ids) =>
                        ids.includes(doc.id)
                          ? ids.filter((id) => id !== doc.id)
                          : ids.length < 3
                            ? [...ids, doc.id]
                            : ids,
                      )
                    : setSelected(doc.id)
                }
              >
                <span className="row gap-10">
                  <span className="student-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{doc.name}</strong>
                  {participants.find((p) => p.id === doc.studentId)?.help
                    ?.docId === doc.id && (
                    <span className="help-badge">도움 요청</span>
                  )}
                  {unreadMessages(
                    participants.find((p) => p.id === doc.studentId),
                    doc.id,
                    "teacher",
                  ).length > 0 && <span className="help-badge">새 메시지</span>}
                  {feedback.some(
                    (f) => f.docId === doc.id && f.response === "revised",
                  ) && <span className="revised-badge">고쳤어요</span>}
                  <span
                    className={`status-dot ${doc.connected ? "" : "offline"}`}
                    title={doc.connected ? "연결됨" : "연결 끊김"}
                  />
                </span>
                {compareMode ? (
                  <span
                    className={`check-circle ${compareIds.includes(doc.id) ? "checked" : ""}`}
                  >
                    {compareIds.includes(doc.id) && <Check size={13} />}
                  </span>
                ) : (
                  <ChevronRight size={16} className="card-arrow" />
                )}
              </button>
              <div
                className="card-prose"
                onClick={() => {
                  if (!compareMode) setSelected(doc.id);
                }}
              >
                <span className="card-group-label">
                  {groups.find((g) => g.id === doc.groupId)?.title}
                </span>
                <h3>{doc.title || "제목 없는 글"}</h3>
                <DocumentBody doc={doc} />
              </div>
              <footer>
                <span>
                  {doc.connected ? (
                    <>
                      <span className="mini-dot" />
                      {doc.updated} 수정
                    </>
                  ) : (
                    "연결 끊김"
                  )}
                </span>
                <span>
                  {charCount(doc)}자
                  {doc.published && (
                    <span className="published-dot" title="게시한 글 있음" />
                  )}
                </span>
              </footer>
            </article>
          ))}
        </div>
        {!ordered.length && !waiting.length && (
          <p className="empty-note">이 조건에 맞는 원고나 학생이 없어요.</p>
        )}
        <p className="board-end">
          학생 카드 안에서 긴 글을 이어 읽을 수 있어요.
        </p>
      </section>
      {selectedDoc && !compareMode && (
        <Detail
          key={selectedDoc.id}
          doc={selectedDoc}
          groups={groups}
          feedback={feedback.filter((f) => f.docId === selectedDoc.id)}
          onClose={() => setSelected(null)}
          onUpdate={(changes) => onUpdate(selectedDoc.id, changes)}
          onFeedback={(message, quote) =>
            onFeedback(selectedDoc.id, message, quote)
          }
          participant={participants.find((p) => p.id === selectedDoc.studentId)}
          docs={docs}
          onFinishHelp={onFinishHelp}
          onFeedbackResponse={onFeedbackResponse}
          onSendMessage={onSendMessage}
          onReadMessages={onReadMessages}
        />
      )}
      {comparing && (
        <Modal title="나란히 읽기" wide onClose={() => setComparing(false)}>
          <div className="comparison-grid">
            {docs
              .filter((d) => compareIds.includes(d.id))
              .map((d) => (
                <article key={d.id}>
                  <span className="eyebrow">{d.name}</span>
                  <h3>{d.title}</h3>
                  <DocumentBody doc={d} />
                </article>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Detail({
  doc,
  groups,
  feedback,
  onClose,
  onUpdate,
  onFeedback,
  participant,
  docs,
  onFinishHelp,
  onFeedbackResponse,
  onSendMessage,
  onReadMessages,
}: {
  doc: StudentDoc;
  groups: BoardGroup[];
  feedback: Feedback[];
  onClose: () => void;
  onUpdate: (changes: Partial<StudentDoc>) => void;
  onFeedback: (message: string, selection?: FeedbackSelection) => void;
  participant?: Participant;
  docs: StudentDoc[];
  onFinishHelp: (studentId: number, move?: boolean) => void;
  onFeedbackResponse: (id: number, response: Feedback["response"]) => void;
} & MessageActions) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <aside className="detail-panel" aria-label={`${doc.name} 글 상세`}>
      <div className="detail-top">
        <div className="row gap-10">
          <div className="initial-avatar">{doc.name.slice(1)}</div>
          <div>
            <h2>{doc.name}</h2>
            <span className="connection">
              <span
                className={`status-dot ${doc.connected ? "" : "offline"}`}
              />
              {doc.connected ? "연결됨" : "연결 끊김"}
            </span>
          </div>
        </div>
        <IconButton label="상세 패널 닫기" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <div className="detail-actions">
        <label className="detail-group-select">
          그룹
          <select
            className="board-select"
            aria-label={`${doc.title || "원고"} 그룹 이동`}
            value={doc.groupId}
            onChange={(e) => onUpdate({ groupId: e.target.value })}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <label className="row gap-10">
          <PenLine size={15} />
          직접 수정
          <Toggle
            checked={editing}
            onChange={() => setEditing(!editing)}
            label="직접 수정"
          />
        </label>
        <span className="meta">구절을 드래그하면 피드백 메뉴가 열려요.</span>
      </div>
      <div className="detail-scroll">
        {!!participant?.messages?.some((m) => m.docId === doc.id) && (
          <MessageThread
            participant={participant}
            doc={doc}
            role="teacher"
            connected={doc.connected}
            onSendMessage={onSendMessage}
            onReadMessages={onReadMessages}
          />
        )}
        {participant?.help?.docId === doc.id && (
          <TeacherHelp
            participant={participant}
            groups={groups}
            docs={docs}
            onFinish={onFinishHelp}
          />
        )}
        <WritingEditor
          compact
          doc={doc}
          onUpdate={onUpdate}
          readOnly={!editing}
          feedback={feedback}
          onCreateFeedback={onFeedback}
          onFeedbackResponse={onFeedbackResponse}
          feedbackRole="teacher"
        />
        <SourceList doc={doc} />
        <div className="feedback-section">
          <div className="row gap-8">
            <MessageSquare size={17} />
            <h3>피드백</h3>
            <span className="count-tag">{feedback.length}</span>
          </div>
          <FeedbackCards
            doc={doc}
            feedback={feedback}
            role="teacher"
            onResponse={onFeedbackResponse}
          />
        </div>
      </div>
      <form
        className="feedback-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (message.trim()) {
            onFeedback(message.trim());
            setMessage("");
          }
        }}
      >
        <label className="sr-only" htmlFor="teacher-message">
          피드백 메시지
        </label>
        <textarea
          id="teacher-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`${doc.name}의 글 전체에 따뜻한 한마디`}
          rows={2}
        />
        <div className="composer-footer">
          <span>이 학생에게만 보여요</span>
          <Button type="submit" variant="primary" disabled={!message.trim()}>
            <Send size={15} />
            보내기
          </Button>
        </div>
      </form>
    </aside>
  );
}

function TeacherHelp({
  participant,
  groups,
  docs,
  onFinish,
}: {
  participant: Participant;
  groups: BoardGroup[];
  docs: StudentDoc[];
  onFinish: (id: number, move?: boolean) => void;
}) {
  const help = participant.help;
  if (!help) return null;
  const target = groups.find((g) => g.id === help.targetGroupId);
  const doc = docs.find((d) => d.id === help.docId);
  return (
    <div className="teacher-help-request">
      <strong>
        {participant.name} ·{" "}
        {help.kind === "move" ? "그룹 이동 요청" : "글쓰기 도움 요청"}
      </strong>
      {help.kind === "move" && (
        <p>
          {doc?.title || "원고"} → {target?.title || "지금은 없는 그룹"}
        </p>
      )}
      {help.docId !== undefined && !doc && (
        <p>요청한 원고가 현재 게시판에 없어요. 휴지통을 확인해 주세요.</p>
      )}
      {help.note && <p>{help.note}</p>}
      <div className="row gap-8">
        {help.kind === "move" && (
          <Button
            disabled={!target || !doc}
            onClick={() => onFinish(participant.id, true)}
          >
            이 그룹으로 옮기기
          </Button>
        )}
        <Button variant="ghost" onClick={() => onFinish(participant.id)}>
          요청 확인 완료
        </Button>
      </div>
    </div>
  );
}
