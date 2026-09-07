import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, MessageSquare, Send } from "lucide-react";
import {
  type BoardGroup,
  type Feedback,
  type HelpRequest,
  type Participant,
  type StudentDoc,
  charCount,
} from "./data";
import { Button } from "./ui";
import { WritingEditor } from "./WritingEditor";
import { FeedbackCards } from "./FeedbackSurface";
import { HelpButton } from "./HelpRequest";
import { LessonMaterials, SourceFields } from "./GroupLearning";
import { publicationState } from "./learning";
import { useLive } from "./collaboration";
import { MessageButton, type MessageActions } from "./TeacherMessages";

export function WritingPage({
  doc,
  group,
  feedback,
  onUpdate,
  onPublish,
  onBack,
  post,
  saveState,
  savedAt,
  participant,
  groups,
  isStudent,
  onRequestHelp,
  onFeedbackResponse,
  lessonPrompt,
  connected = true,
  publishBusy = false,
  notifyFeedback = true,
  presenceLabel,
  onSendMessage,
  onReadMessages,
}: {
  doc: StudentDoc;
  group: BoardGroup;
  feedback: Feedback[];
  onUpdate: (changes: Partial<StudentDoc>) => void;
  onPublish: () => void;
  onBack: () => void;
  post?: StudentDoc;
  saveState: "saved" | "saving" | "error";
  savedAt: number | null;
  participant?: Participant;
  groups: BoardGroup[];
  isStudent: boolean;
  onRequestHelp: (request?: HelpRequest) => Promise<unknown> | void;
  onFeedbackResponse: (id: number, response: Feedback["response"]) => void;
  lessonPrompt: string;
  connected?: boolean;
  publishBusy?: boolean;
  notifyFeedback?: boolean;
  presenceLabel?: string;
} & MessageActions) {
  const live = useLive();
  const dock = useRef<HTMLDivElement>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const feedbackWasOpen = useRef(false);
  useEffect(() => {
    if (feedbackOpen)
      document
        .getElementById("writing-feedback-panel")
        ?.scrollIntoView({ block: "center" });
    else if (feedbackWasOpen.current)
      document
        .querySelector(".writing-editor")
        ?.scrollIntoView({ block: "start" });
    feedbackWasOpen.current = feedbackOpen;
  }, [feedbackOpen]);
  const state = publicationState(doc, post);
  const saveLabel =
    saveState === "error"
      ? "저장하지 못했어요"
      : saveState === "saving"
        ? "저장 중…"
        : "이 기기에 저장됨";
  const publishLabel =
    state === "current"
      ? "게시한 글과 같아요"
      : state === "changed"
        ? "수정한 글 게시하기"
        : "게시하기";
  useEffect(() => {
    // Follow the visible viewport when the on-screen keyboard opens.
    const viewport = window.visualViewport;
    const place = () => {
      if (dock.current)
        dock.current.style.bottom = `${(live || isStudent ? 0 : 58) + Math.max(0, window.innerHeight - (viewport ? viewport.height + viewport.offsetTop : window.innerHeight))}px`;
    };
    place();
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    return () => {
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [isStudent, live]);
  return (
    <main className="writing-page page-width">
      <div className="writing-page-header">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={17} />
          게시판으로
        </Button>
        <span className="writing-save" role="status">
          {saveLabel}
          {!connected && " · 선생님께 아직 전달되지 않은 내용이 있을 수 있어요"}
          {saveState === "saved" && savedAt && (
            <small>
              {" "}
              ·{" "}
              {new Date(savedAt).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          )}
        </span>
      </div>
      <div className="writing-group-context">
        <span className="eyebrow">내 글의 주제</span>
        <strong>{group.title}</strong>
        {group.description && <span>{group.description}</span>}
      </div>
      {(lessonPrompt.trim() ||
        !!group.resources?.length ||
        !!group.questions?.length) && (
        <details className="writing-support">
          <summary>
            수업 도움 보기{" "}
            <span>
              {[
                group.resources?.length ? "선생님 자료" : "",
                group.questions?.length ? "생각 질문" : "수업 안내",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </summary>
          {lessonPrompt.trim() && (
            <p className="lesson-prompt-text">{lessonPrompt}</p>
          )}
          <LessonMaterials group={group} />
          {!!group.questions?.filter(Boolean).length && (
            <div className="writing-questions">
              <strong>무슨 말을 쓸지 막막하다면</strong>
              <ol>
                {group.questions.filter(Boolean).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
              <p className="meta">
                모두 답하지 않아도 괜찮아요. 생각나는 이야기부터 써요.
              </p>
            </div>
          )}
        </details>
      )}
      <div className="writing-layout">
        <div className="writing-main-column">
          <WritingEditor
            key={doc.id}
            doc={doc}
            feedback={feedback}
            onUpdate={onUpdate}
            onFeedbackResponse={onFeedbackResponse}
            feedbackRole={isStudent ? "student" : "teacher"}
            saveLabel={saveLabel}
            presenceLabel={presenceLabel}
          />
          {(group.collectSources || !!doc.sources?.length) && (
            <SourceFields doc={doc} onUpdate={onUpdate} />
          )}
        </div>
        <aside
          className={`writing-feedback ${feedbackOpen ? "is-open" : ""}`}
          id="writing-feedback-panel"
        >
          <div className="row gap-10">
            <MessageSquare size={19} />
            <h2>선생님 피드백</h2>
            <span className="count-tag">{feedback.length}</span>
            <Button
              className="feedback-panel-close"
              variant="ghost"
              onClick={() => setFeedbackOpen(false)}
            >
              접기
            </Button>
          </div>
          <p className="aside-description">
            노란 구절을 누르거나, 아래에서 읽어요.
            <br />
            고친 다음 ‘고쳤어요’를 누르면 선생님이 확인해요.
          </p>
          <FeedbackCards
            doc={doc}
            feedback={feedback}
            role={isStudent ? "student" : "teacher"}
            onResponse={onFeedbackResponse}
          />
          <div className="private-note">
            <span className="mini-dot" />
            피드백은 나와 선생님만 볼 수 있어요.
          </div>
        </aside>
      </div>
      <div className={`writing-action-dock publication-${state}`} ref={dock}>
        <div className="publication-status" role="status">
          <span className={saveState === "error" ? "field-error" : ""}>
            {saveLabel}
          </span>
          <strong>
            {state === "private"
              ? "아직 나와 선생님만 보는 글"
              : state === "changed"
                ? "게시판에는 고치기 전 글이 보여요"
                : "친구들도 지금 글을 볼 수 있어요"}
          </strong>
        </div>
        <div className="writing-dock-buttons">
          {isStudent && (
            <HelpButton
              participant={participant}
              groups={groups}
              doc={doc}
              onRequest={onRequestHelp}
              connected={connected}
              label="선생님께 도움 요청"
            />
          )}
          {isStudent && (
            <MessageButton
              participant={participant}
              doc={doc}
              connected={connected}
              onSendMessage={onSendMessage}
              onReadMessages={onReadMessages}
            />
          )}
          {feedback.length > 0 && (
            <Button
              className="feedback-dock-button"
              aria-expanded={feedbackOpen}
              onClick={() => {
                setFeedbackOpen(!feedbackOpen);
              }}
            >
              <MessageSquare size={17} />
              피드백 {notifyFeedback ? feedback.length : ""}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={onPublish}
            disabled={
              !connected ||
              publishBusy ||
              !doc.title.trim() ||
              charCount(doc) === 0 ||
              state === "current" ||
              saveState === "error"
            }
          >
            {state === "current" ? <Check size={17} /> : <Send size={17} />}
            {publishBusy ? "게시하는 중…" : publishLabel}
          </Button>
        </div>
        {(!doc.title.trim() || charCount(doc) === 0) && (
          <span className="publish-hint">
            제목과 본문을 쓰면 올릴 수 있어요.
          </span>
        )}
      </div>
    </main>
  );
}
