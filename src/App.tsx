import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  DoorOpen,
  History,
  LayoutGrid,
  Pencil,
  QrCode,
  Settings as SettingsIcon,
  Sprout,
  X,
} from "lucide-react";
import { Teacher } from "./Teacher";
import { Community } from "./Community";
import { WritingPage } from "./Student";
import { TrashPanel } from "./TrashPanel";
import { HelpButton } from "./HelpRequest";
import { Button, IconButton, Logo, Modal, Toggle } from "./ui";
import {
  Classroom,
  lessonHistory,
  type Role,
  type SavedLesson,
} from "./classroom";
import { LiveContext, RemoteCursorContext } from "./collaboration";
import { exportLesson } from "./export-lesson";
import { downloadDiagnostics } from "./diagnostics";
import type { Feedback, FeedbackSelection, HelpRequest } from "./data";

const classroom = new Classroom();
const routeFromUrl = () => {
  const [, area, page, docId] = location.pathname.split("/");
  return {
    role: (area === "student" ? "student" : "teacher") as Role,
    page: page || "start",
    docId: Number(docId),
  };
};
let boot: Promise<unknown> | undefined;
export default function App() {
  const state = useSyncExternalStore(classroom.subscribe, classroom.snapshot);
  const [route, setRoute] = useState(routeFromUrl);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [records, setRecords] = useState<SavedLesson[]>([]);
  const [qr, setQr] = useState("");
  const [promptDraft, setPromptDraft] = useState("");
  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    classroom.clearError();
    try {
      await fn();
      if (success) setToast(success);
    } catch (e) {
      classroom.fail(e);
    } finally {
      setBusy(false);
    }
  };
  const go = (page: string, role = route.role, docId?: number) => {
    const path = `/${role}/${page}${docId !== undefined ? "/" + docId : ""}`;
    history.pushState(null, "", path);
    setRoute({ role, page, docId: docId ?? NaN });
    setDialog(null);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const initial = routeFromUrl();
    if (!boot)
      boot = ["start", "join", "history"].includes(initial.page)
        ? Promise.resolve()
        : classroom.restore(initial.role);
    void boot.finally(() => setLoading(false));
    const change = () => {
      setRoute(routeFromUrl());
      setDialog(null);
    };
    const flush = () => {
      void classroom.flush();
    };
    const online = () => {
      if (classroom.state.lesson && !classroom.state.lesson.ended)
        void classroom.reconnect().catch((e) => classroom.fail(e));
    };
    window.addEventListener("popstate", change);
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", online);
    const prune = setInterval(() => {
      void classroom.flush();
    }, 60000);
    return () => {
      window.removeEventListener("popstate", change);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", online);
      clearInterval(prune);
    };
  }, []);
  useEffect(() => {
    if (route.page === "history")
      void lessonHistory()
        .then(setRecords)
        .catch((e) => classroom.fail(e));
  }, [route.page, state.savedAt]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const lesson = state.lesson;
  const session = state.session;
  const teacher = session?.role === "teacher" && route.role === "teacher";
  const validSession = !!lesson && session?.role === route.role;
  const b = lesson?.board;
  const page =
    !validSession && !["start", "join", "history"].includes(route.page)
      ? route.role === "student"
        ? "join"
        : "start"
      : route.page;
  const lobby = ["start", "join", "history"].includes(page);
  const inviteUrl = session
    ? `${classroom.publicUrl}/student/join?code=${session.code}&lesson=${session.lessonId}`
    : "";
  useEffect(() => {
    if (dialog === "invite" && inviteUrl)
      void QRCode.toDataURL(inviteUrl, {
        width: 256,
        margin: 2,
        color: { dark: "#315b45", light: "#ffffff" },
      }).then(setQr);
  }, [dialog, inviteUrl]);
  const act = (action: unknown, success?: string) =>
    run(() => classroom.action(action), success);
  const start = (record?: SavedLesson) =>
    run(async () => {
      await classroom.start(record);
      go("overview", "teacher");
      setDialog("invite");
    });
  const live = useMemo(
    () => ({
      getDoc: (id: number) => classroom.documents.get(id),
      presence: classroom.presence,
      clearPresence: classroom.clearPresence,
      rebaseAnchors: classroom.rebaseAnchors,
    }),
    [],
  );
  const writingDoc = b?.docs.find(
    (d) => d.id === route.docId && d.studentId === session?.id,
  );
  const feedback = (
    docId: number,
    message: string,
    selection?: FeedbackSelection,
  ) => {
    void act(
      { type: "feedback", docId, message, selection },
      "피드백을 남겼어요.",
    );
  };
  const response = (id: number, value: Feedback["response"]) => {
    void act({ type: "feedback-response", id, response: value });
  };
  const help = (request?: HelpRequest) =>
    classroom.action({ type: "help", help: request });
  const messageActions = {
    onSendMessage: (docId: number, text: string) =>
      classroom.action({ type: "message", docId, text }),
    onReadMessages: (docId: number, ids: string[]) =>
      classroom.action({ type: "read-messages", docId, ids }),
  };
  const create = (groupId: string) => {
    void run(async () => {
      const id = await classroom.action({ type: "create", groupId });
      go("write", route.role, id);
    });
  };
  if (loading)
    return (
      <main className="join-page">
        <p role="status">보관한 수업을 불러오는 중이에요…</p>
      </main>
    );
  return (
    <LiveContext.Provider value={live}>
      <RemoteCursorContext.Provider
        value={
          state.presence?.editing && lesson?.settings.editing
            ? state.presence
            : null
        }
      >
        <div className={`app live-app screen-${page} role-${route.role}`}>
          <header className="app-header">
            <Logo
              onClick={() =>
                go(
                  route.role === "teacher"
                    ? "start"
                    : validSession
                      ? "board"
                      : "join",
                )
              }
            />
            {!lobby && validSession ? (
              <>
                <div className="header-divider" />
                <div className="class-title">
                  <span>{lesson.title}</span>
                  <span className="header-role">{session.name}</span>
                </div>
                <div className="header-actions">
                  {teacher ? (
                    <>
                      <Button
                        className="invite-button"
                        onClick={() => setDialog("invite")}
                        disabled={state.status !== "connected"}
                      >
                        <span>입장 코드</span>
                        <strong>{session.code}</strong>
                        <QrCode size={19} />
                      </Button>
                      <span className="header-connected">
                        <span className="status-dot" />
                        연결{" "}
                        {b!.participants!.filter((p) => p.connected).length}명
                      </span>
                      <IconButton
                        label="수업 설정"
                        onClick={() => setDialog("settings")}
                      >
                        <SettingsIcon size={20} />
                      </IconButton>
                      {state.status === "ended" ? (
                        <Button
                          onClick={() =>
                            void run(async () => {
                              await classroom.flush();
                              const all = await lessonHistory();
                              await classroom.start(
                                all.find((r) => r.lesson.id === lesson.id),
                              );
                              setDialog("invite");
                            })
                          }
                        >
                          다시 수업 열기
                        </Button>
                      ) : (
                        <Button
                          className="end-class"
                          onClick={() => setDialog("end")}
                        >
                          수업 종료
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="header-connected">
                        <span
                          className={`status-dot ${state.status === "connected" ? "" : "offline"}`}
                        />
                        {state.status === "connected"
                          ? "선생님과 연결됨"
                          : state.status === "ended"
                            ? "수업 종료"
                            : "연결 기다리는 중"}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => go("join", "student")}
                      >
                        다른 이름으로 입장
                      </Button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="header-actions">
                <span className="header-description">
                  생각을 쓰고, 마음을 나누는 교실
                </span>
                {route.role === "teacher" && (
                  <Button
                    variant="ghost"
                    onClick={() => go(page === "history" ? "start" : "history")}
                  >
                    <History size={17} />
                    {page === "history" ? "시작으로" : "지난 수업"}
                  </Button>
                )}
              </div>
            )}
          </header>
          {state.error && (
            <div className="storage-warning" role="alert">
              {state.error}
              <Button variant="ghost" onClick={downloadDiagnostics}>
                진단 로그 저장
              </Button>
              <IconButton label="오류 닫기" onClick={classroom.clearError}>
                <X size={16} />
              </IconButton>
            </div>
          )}
          {!lobby &&
            validSession &&
            (state.status !== "connected" || state.message) && (
              <div className="connection-banner" role="status">
                <span>
                  {state.message ||
                    (state.status === "ended"
                      ? "보관한 수업을 보고 있어요. 다시 열면 학생들과 이어서 쓸 수 있어요."
                      : "연결하는 중이에요…")}
                </span>
                {state.status === "offline" && (
                  <>
                    <Button
                      onClick={() => void run(() => classroom.reconnect())}
                      disabled={busy}
                    >
                      다시 연결
                    </Button>
                    <Button variant="ghost" onClick={downloadDiagnostics}>
                      진단 로그 저장
                    </Button>
                  </>
                )}
              </div>
            )}
          {!lobby && teacher && (
            <nav className="product-tabs" aria-label="수업 메뉴">
              <button
                className={page === "overview" ? "active" : ""}
                onClick={() => go("overview")}
              >
                <LayoutGrid size={17} />
                전체 글
              </button>
              <button
                className={page === "board" ? "active" : ""}
                onClick={() => go("board")}
              >
                <BookOpen size={17} />
                게시판 <span>{b!.posts.length}</span>
              </button>
              <span className="class-date">
                {new Date(lesson!.createdAt).toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </span>
            </nav>
          )}
          {!lobby && teacher && page === "overview" && (
            <div className="prompt-banner">
              <span className="prompt-label">
                <Sprout size={17} />
                오늘의 글감
              </span>
              <span className="prompt-text">
                {lesson!.prompt ||
                  "아이들에게 들려줄 글쓰기 안내를 적어 주세요."}
              </span>
              <button
                onClick={() => {
                  setPromptDraft(lesson!.prompt);
                  setDialog("prompt");
                }}
              >
                <Pencil size={14} />
                안내 수정
              </button>
            </div>
          )}
          {page === "start" && (
            <main className="start-page">
              <div className="start-heading">
                <div className="eyebrow">
                  <Sprout size={16} />
                  우리 반의 작은 글쓰기 시간
                </div>
                <h1>
                  작은 생각이
                  <br />
                  <span>이야기로 자라는 곳.</span>
                </h1>
                <p>함께 쓰고, 읽고, 마음을 나누는 도토입니다.</p>
              </div>
              <div className="entry-options">
                <button
                  disabled={busy}
                  className="entry-card teacher-entry"
                  onClick={() => void start()}
                >
                  <span className="entry-icon">
                    <LayoutGrid size={28} />
                  </span>
                  <span className="eyebrow">선생님</span>
                  <h2>수업 시작</h2>
                  <p>
                    아이들의 글을 한눈에 살펴보고
                    <br />
                    따뜻한 한마디를 건네세요.
                  </p>
                  <span className="entry-action">
                    {busy ? "수업을 여는 중…" : "우리 반 글쓰기 열기"}
                    <ArrowRight />
                  </span>
                </button>
                <button
                  className="entry-card student-entry"
                  onClick={() => go("join", "student")}
                >
                  <span className="entry-icon">
                    <Pencil size={28} />
                  </span>
                  <span className="eyebrow">학생</span>
                  <h2>코드로 입장</h2>
                  <p>
                    선생님에게 받은 코드로 들어와
                    <br />
                    나만의 이야기를 써 보세요.
                  </p>
                  <span className="entry-action">
                    글쓰러 가기
                    <ArrowRight />
                  </span>
                </button>
              </div>
              {validSession && (
                <Button onClick={() => go("overview", "teacher")}>
                  지금 수업으로 돌아가기
                </Button>
              )}
              <button
                className="past-class-link"
                onClick={() => go("history", "teacher")}
              >
                <History size={17} />
                지난 수업 이어 보기
                <ArrowRight size={16} />
              </button>
              <p className="start-footnote">
                회원가입 없이, 이름만 있으면 시작할 수 있어요.
              </p>
            </main>
          )}
          {page === "join" && (
            <Join
              busy={busy}
              current={session?.role === "student" ? session.name : undefined}
              onJoin={(code, name, fresh) =>
                void run(async () => {
                  await classroom.join(code, name, fresh);
                  go("board", "student");
                })
              }
            />
          )}
          {page === "history" && route.role === "teacher" && (
            <main className="history-page page-width">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">다시 꺼내 읽는 이야기</span>
                  <h1>지난 수업</h1>
                  <p>이 브라우저에 보관됩니다.</p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => void start()}
                  disabled={busy}
                >
                  새 수업 시작
                  <ArrowRight size={17} />
                </Button>
              </div>
              <div className="history-list">
                {records.map((r) => (
                  <article className="history-card" key={r.lesson.id}>
                    <div className="history-date">
                      <span>
                        {new Date(r.lesson.createdAt).getFullYear()}년
                      </span>
                      <strong>
                        {new Date(r.lesson.createdAt).toLocaleDateString(
                          "ko-KR",
                          { month: "long", day: "numeric" },
                        )}
                      </strong>
                    </div>
                    <div className="history-info">
                      <span className="pill muted">
                        {r.lesson.ended ? "수업 종료" : "보관 중"}
                      </span>
                      <h2>{r.lesson.title}</h2>
                      <span className="meta">
                        학생 {r.lesson.board.participants?.length || 0}명 · 원고{" "}
                        {r.lesson.board.docs.length}개 · 게시글{" "}
                        {r.lesson.board.posts.length}개
                      </span>
                    </div>
                    <div className="history-actions">
                      <Button
                        variant="ghost"
                        onClick={() => exportLesson(r.lesson)}
                      >
                        결과 내보내기
                      </Button>
                      <Button
                        onClick={() =>
                          void run(async () => {
                            await classroom.view(r);
                            go("overview", "teacher");
                          })
                        }
                      >
                        수업 보기
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => void start(r)}
                        disabled={busy}
                      >
                        다시 수업 열기
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              {!records.length && (
                <p className="empty-note">
                  아직 보관한 수업이 없어요. 첫 글쓰기 수업을 열어 보세요.
                </p>
              )}
              <div className="history-note">
                <History size={19} />
                <p>
                  소중한 글은 파일로도 간직해 주세요.
                  <br />
                  <span>
                    브라우저 데이터를 지우면 보관한 수업도 지워집니다.
                  </span>
                </p>
              </div>
            </main>
          )}
          {page === "overview" && teacher && b && (
            <Teacher
              {...messageActions}
              docs={b.docs.filter((d) => d.studentId !== -1)}
              groups={b.groups}
              feedback={b.feedback}
              participants={b.participants!}
              onUpdate={(id, patch) => classroom.updateDoc(id, patch)}
              onFeedback={feedback}
              onFeedbackResponse={response}
              onFinishHelp={(studentId, move) =>
                void act({ type: "finish-help", studentId, move })
              }
            />
          )}
          {page === "board" && validSession && b && (
            <>
              {!teacher && (
                <div className="student-board-help page-width">
                  <span>주제를 고르고 +를 눌러 글을 시작해요.</span>
                  <HelpButton
                    participant={b.participants?.find(
                      (p) => p.id === session.id,
                    )}
                    groups={b.groups}
                    onRequest={help}
                    connected={state.status === "connected"}
                  />
                </div>
              )}
              <Community
                boardTitle={b.title}
                onTitleChange={(title) => void act({ type: "title", title })}
                trashCount={b.trash.reduce((n, t) => n + t.docs.length, 0)}
                onOpenTrash={() => setDialog("trash")}
                posts={b.posts}
                docs={b.docs}
                groups={b.groups}
                feedback={b.feedback}
                role={session.role}
                studentName={session.name}
                currentUserId={session.id}
                sort={b.sort}
                onSort={(sort) => void act({ type: "sort", sort })}
                comments={b.comments}
                onComment={(docId, text) =>
                  void act({ type: "comment", docId, text })
                }
                onDeleteComment={(docId, commentId) =>
                  void act({ type: "delete-comment", docId, commentId })
                }
                commentsEnabled={lesson.settings.comments}
                onToggleComments={() =>
                  void act({
                    type: "settings",
                    settings: { comments: !lesson.settings.comments },
                  })
                }
                onRemove={(docId) => void act({ type: "unpublish", docId })}
                onCreate={create}
                onWrite={(id) => go("write", session.role, id)}
                onSaveGroup={(group) => void act({ type: "group", group })}
                onDeleteGroup={(groupId) =>
                  void act(
                    { type: "delete-group", groupId },
                    "그룹과 글을 휴지통에 보관했어요.",
                  )
                }
                onReorderGroup={(id, targetId) =>
                  void act({ type: "reorder-group", id, targetId })
                }
                onMovePost={(docId, groupId, beforeId) =>
                  void act({ type: "move", docId, groupId, beforeId })
                }
                onUpdate={(id, patch) => classroom.updateDoc(id, patch)}
                onFeedback={feedback}
                onFeedbackResponse={response}
              />
            </>
          )}
          {page === "write" &&
            validSession &&
            b &&
            (writingDoc ? (
              <>
                <WritingPage
                  {...messageActions}
                  key={writingDoc.id}
                  presenceLabel={
                    !teacher &&
                    state.presence?.docId === writingDoc.id &&
                    ((lesson.settings.observe && !state.presence.editing) ||
                      (lesson.settings.editing && state.presence.editing))
                      ? state.presence.editing
                        ? "선생님이 수정 중이에요"
                        : "선생님이 보고 있어요"
                      : undefined
                  }
                  doc={writingDoc}
                  group={b.groups.find((g) => g.id === writingDoc.groupId)!}
                  feedback={b.feedback.filter((f) => f.docId === writingDoc.id)}
                  onUpdate={(patch) =>
                    classroom.updateDoc(writingDoc.id, patch)
                  }
                  onPublish={() =>
                    void run(async () => {
                      await classroom.action({
                        type: "publish",
                        docId: writingDoc.id,
                      });
                      go("board");
                    }, "글을 게시했어요.")
                  }
                  onBack={() => go("board")}
                  post={b.posts.find((p) => p.id === writingDoc.id)}
                  saveState={state.saveState}
                  savedAt={state.savedAt}
                  participant={b.participants?.find((p) => p.id === session.id)}
                  groups={b.groups}
                  isStudent={!teacher}
                  onRequestHelp={help}
                  onFeedbackResponse={response}
                  lessonPrompt={lesson.prompt}
                  connected={state.status === "connected"}
                  publishBusy={busy}
                  notifyFeedback={lesson.settings.feedback}
                />
              </>
            ) : (
              <main className="join-page">
                <div>
                  <p>
                    이 원고를 열 수 없어요. 그룹이 삭제되었거나 내 원고가 아닐
                    수 있어요.
                  </p>
                  <Button onClick={() => go("board")}>게시판으로</Button>
                </div>
              </main>
            ))}
          {dialog === "invite" && teacher && (
            <Modal title="우리 반으로 초대하기" onClose={() => setDialog(null)}>
              <div className="invite-content">
                <p>학생들이 QR을 찍거나 입장 코드를 입력하면 돼요.</p>
                {qr && (
                  <img
                    width="256"
                    height="256"
                    src={qr}
                    alt="학생 입장 QR 코드"
                  />
                )}
                <span className="eyebrow">우리 반 입장 코드</span>
                <div className="large-code">{session!.code}</div>
                <div className="row gap-10">
                  <Button
                    onClick={() =>
                      void run(async () => {
                        await navigator.clipboard.writeText(session!.code);
                      }, "입장 코드를 복사했어요.")
                    }
                  >
                    <Copy size={16} />
                    코드 복사
                  </Button>
                  <Button
                    onClick={() =>
                      void run(async () => {
                        await navigator.clipboard.writeText(inviteUrl);
                      }, "초대 링크를 복사했어요.")
                    }
                  >
                    <Copy size={16} />
                    초대 링크 복사
                  </Button>
                </div>
                <a
                  className="invite-url"
                  href={inviteUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {inviteUrl}
                </a>
                <div className="invite-lock">
                  <span>새 입장 잠금</span>
                  <Toggle
                    checked={lesson!.settings.locked}
                    label="새 입장 잠금"
                    onChange={() =>
                      void act({
                        type: "settings",
                        settings: { locked: !lesson!.settings.locked },
                      })
                    }
                  />
                </div>
                <p className="meta">
                  이미 들어온 학생은 다시 입장할 수 있어요.
                </p>
              </div>
            </Modal>
          )}
          {dialog === "settings" && teacher && (
            <Modal title="수업 설정" onClose={() => setDialog(null)}>
              <div className="settings-content">
                <label className="field">
                  수업 이름
                  <input
                    value={lesson!.title}
                    maxLength={150}
                    onChange={(e) =>
                      void act({ type: "lesson", title: e.target.value })
                    }
                  />
                </label>
                <h3>학생에게 보이는 알림</h3>
                {(
                  [
                    ["observe", "선생님이 보고 있어요"],
                    ["feedback", "새 피드백 알림"],
                    ["editing", "선생님이 수정 중이에요"],
                    ["locked", "새 입장 잠금"],
                    ["comments", "게시판 댓글 허용"],
                  ] as const
                ).map(([key, label]) => (
                  <div className="setting-row" key={key}>
                    <strong>{label}</strong>
                    <Toggle
                      label={label}
                      checked={lesson!.settings[key]}
                      onChange={() =>
                        void act({
                          type: "settings",
                          settings: { [key]: !lesson!.settings[key] },
                        })
                      }
                    />
                  </div>
                ))}
                <Button variant="ghost" onClick={downloadDiagnostics}>
                  진단 로그 저장
                </Button>
                <Button
                  variant="primary"
                  className="full-width"
                  onClick={() => setDialog(null)}
                >
                  닫기
                </Button>
              </div>
            </Modal>
          )}
          {dialog === "prompt" && teacher && (
            <Modal title="글쓰기 안내" onClose={() => setDialog(null)}>
              <form
                className="modal-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act({ type: "lesson", prompt: promptDraft });
                  setDialog(null);
                }}
              >
                <label className="field">
                  오늘의 글감
                  <textarea
                    rows={5}
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                  />
                </label>
                <p className="meta">
                  비워 두어도 괜찮아요. 학생 글쓰기 화면의 수업 도움에 표시돼요.
                </p>
                <Button type="submit" variant="primary">
                  안내 적용하기
                </Button>
              </form>
            </Modal>
          )}
          {dialog === "end" && teacher && (
            <Modal
              title="오늘 수업을 마칠까요?"
              onClose={() => setDialog(null)}
            >
              <div className="modal-form">
                <p>학생 연결을 마치고, 글과 피드백을 이 브라우저에 보관해요.</p>
                <p>
                  참여 {b!.participants!.length}명 · 원고 {b!.docs.length}개 ·
                  게시글 {b!.posts.length}개
                </p>
                <div className="modal-footer">
                  <Button onClick={() => setDialog(null)}>계속 수업하기</Button>
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await classroom.end();
                        go("history", "teacher");
                      })
                    }
                  >
                    수업 마치기
                  </Button>
                </div>
              </div>
            </Modal>
          )}
          {dialog === "trash" && teacher && (
            <TrashPanel
              trash={b!.trash}
              onClose={() => setDialog(null)}
              onRestore={(id, docId) =>
                void act(
                  { type: "restore", id, docId },
                  "그룹과 원고를 복원했어요.",
                )
              }
            />
          )}
          {toast && (
            <div className="toast" role="status">
              <Check size={18} />
              {toast}
              <IconButton label="알림 닫기" onClick={() => setToast("")}>
                <X size={16} />
              </IconButton>
            </div>
          )}
        </div>
      </RemoteCursorContext.Provider>
    </LiveContext.Provider>
  );
}
function Join({
  busy,
  current,
  onJoin,
}: {
  busy: boolean;
  current?: string;
  onJoin: (code: string, name: string, fresh: boolean) => void;
}) {
  const [code, setCode] = useState(
    new URLSearchParams(location.search).get("code") || "",
  );
  const [name, setName] = useState(current || "");
  const [fresh, setFresh] = useState(false);
  return (
    <main className="join-page">
      <div className="join-card">
        <span className="join-icon">
          <DoorOpen size={30} />
        </span>
        <div className="eyebrow">우리 반이 기다리고 있어요</div>
        <h1>반가워요!</h1>
        <p>입장 코드와 이름을 적어 주세요.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onJoin(code, name.trim(), fresh);
          }}
        >
          <label className="field">
            입장 코드
            <input
              className="code-input"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoComplete="off"
            />
          </label>
          <label className="field">
            이름 또는 별명
            <input
              placeholder="어떤 이름으로 들어갈까요?"
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <label className="fresh-join">
            <input
              type="checkbox"
              checked={fresh}
              onChange={(e) => setFresh(e.target.checked)}
            />
            다른 이름으로 새로 입장
          </label>
          <Button
            variant="primary"
            type="submit"
            className="full-width"
            disabled={busy || code.length !== 6 || !name.trim()}
          >
            {busy ? "연결하는 중…" : "들어가기"}
            <ArrowRight size={17} />
          </Button>
        </form>
        <p className="join-footer">
          같은 기기로 다시 들어오면 쓰던 글을 이어 써요.
          <br />
          기기를 다른 친구가 쓰면 새로 입장을 골라 주세요.
        </p>
      </div>
    </main>
  );
}
