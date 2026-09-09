import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  DoorOpen,
  History,
  LayoutGrid,
  LockKeyhole,
  Monitor,
  Pencil,
  QrCode,
  Settings,
  Sprout,
  Tablet,
  Users,
  X,
} from "lucide-react";
import { Community } from "./Community";
import { moveBoardCard } from "./board-order";
import { Teacher } from "./Teacher";
import { createUuid } from "./uuid";
import { WritingPage } from "./Student";
import { HelpButton } from "./HelpRequest";
import { filledSources, participantsFromDocs } from "./learning";
import {
  loadBoard,
  pruneTrash,
  restoreTrash,
  trashGroup,
  type BoardState,
} from "./board-state";
import { TrashPanel } from "./TrashPanel";
import {
  simulationLessons,
  simulationSeed,
  virtualStudents,
  type SimulationLesson,
} from "./simulations";
import { Button, IconButton, Logo, Modal, Toggle } from "./ui";
import {
  initialDocs,
  initialFeedback,
  initialGroups,
  charCount,
  type FeedbackSelection,
  type Screen,
  type StudentDoc,
  type Participant,
  type HelpRequest,
  type Feedback,
} from "./data";

type Route = { role: "teacher" | "student"; screen: Screen; docId?: number };
const readRoute = (): Route => {
  const legacy = window.location.hash.replace("#/", "").split("?")[0];
  if (legacy) {
    if (legacy === "join") return { role: "student", screen: "join" };
    if (legacy === "student") return { role: "student", screen: "board" };
    if (legacy === "write")
      return { role: "student", screen: "write", docId: 0 };
    if (["start", "history", "board", "teacher"].includes(legacy))
      return { role: "teacher", screen: legacy as Screen };
  }
  const [, area, page, id] = window.location.pathname.split("/");
  const role = area === "student" ? "student" : "teacher";
  if (page === "write" && /^\d+$/.test(id ?? ""))
    return { role, screen: "write", docId: Number(id) };
  if (role === "student")
    return { role, screen: page === "join" ? "join" : "board" };
  return {
    role,
    screen:
      page === "board"
        ? "board"
        : page === "start"
          ? "start"
          : page === "history"
            ? "history"
            : "teacher",
  };
};
const routePath = ({ role, screen, docId }: Route, host = false) =>
  `/${host && role === "teacher" ? "host" : role}/${screen === "teacher" ? "overview" : screen === "student" ? "board" : screen === "write" ? `write/${docId}` : screen}${window.location.search}`;
type Dialog = "invite" | "settings" | "prompt" | "end" | "published" | null;
type PreviewPreferences = {
  prompt: string;
  classTitle: string;
  settings: {
    locked: boolean;
    observe: boolean;
    feedback: boolean;
    editing: boolean;
    comments: boolean;
  };
};
const TABLET_PREFERENCES_KEY = "doto.tablet-classroom.ui.v1";

export interface TabletPreviewSession {
  host: boolean;
  title: string;
  studentName: string;
  studentId: number;
  studentCode: string;
  notice: ReactNode;
  onHome?: () => void;
  onInvite: () => void;
  onSettings: () => void;
  onDisconnect: () => void;
  onHostManage: () => void;
}

export default function App({
  tabletSession,
}: { tabletSession?: TabletPreviewSession } = {}) {
  const [route, setRoute] = useState<Route>(readRoute);
  const { screen, role } = route;
  const [simulation] = useState(
    () => new URLSearchParams(window.location.search).get("simulation") ?? "",
  );
  const storageKey = `doto.board.v2:${tabletSession ? "tablet-preview" : simulation || "main"}`;
  const [initialBoard] = useState(() =>
    loadBoard(
      storageKey,
      simulationSeed(simulation, {
        title: "우리 반 이야기 모음",
        docs: initialDocs,
        posts: initialDocs
          .filter((d) => d.published)
          .map((d) => ({ ...d, paragraphs: [...d.paragraphs], anchors: [] })),
        groups: initialGroups,
        feedback: initialFeedback,
        sort: "oldest",
        trash: [],
        comments: {
          1: [
            {
              name: "김하늘",
              text: "꽃이 피는 속도가 모두 다르다는 말이 기억에 남아.",
            },
          ],
          2: [{ name: "한소은", text: "나도 계란말이를 만들어 보고 싶어." }],
        },
      }),
    ),
  );
  const [docs, setDocs] = useState(initialBoard.docs);
  const [posts, setPosts] = useState(initialBoard.posts);
  const [feedback, setFeedback] = useState(initialBoard.feedback);
  const [groups, setGroups] = useState(initialBoard.groups);
  const [sort, setSort] = useState(initialBoard.sort);
  const [comments, setComments] = useState(initialBoard.comments);
  const [boardTitle, setBoardTitle] = useState(initialBoard.title);
  const [trash, setTrash] = useState(initialBoard.trash);
  const [participants, setParticipants] = useState<Participant[]>(() => {
    const initial =
      initialBoard.participants ?? participantsFromDocs(initialBoard.docs);
    if (
      !tabletSession ||
      role !== "student" ||
      initial.some((p) => p.id === tabletSession.studentId)
    )
      return initial;
    return [
      ...initial,
      {
        id: tabletSession.studentId,
        name: tabletSession.studentName,
        joinedAt: Date.now(),
        connected: true,
      },
    ];
  });
  const [trashOpen, setTrashOpen] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [savedDocs, setSavedDocs] = useState(initialBoard.docs);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const nextDocId = useRef(
    Math.max(
      -1,
      ...initialBoard.docs.map((d) => d.id),
      ...initialBoard.trash.flatMap((b) => b.docs.map((d) => d.id)),
    ) + 1,
  );
  const nextFeedbackId = useRef(
    Math.max(
      0,
      ...initialBoard.feedback.map((f) => f.id),
      ...initialBoard.trash.flatMap((b) => b.feedback.map((f) => f.id)),
    ) + 1,
  );
  const currentBoard = (): BoardState => ({
    participants,
    title: boardTitle,
    docs,
    posts,
    groups,
    feedback,
    comments,
    sort,
    trash,
  });
  const applyBoard = (next: BoardState) => {
    setBoardTitle(next.title);
    setDocs(next.docs);
    setPosts(next.posts);
    setGroups(next.groups);
    setFeedback(next.feedback);
    setComments(next.comments);
    setSort(next.sort);
    setTrash(next.trash);
    if (next.participants) setParticipants(next.participants);
  };
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          version: 2,
          board: {
            participants,
            title: boardTitle,
            docs,
            posts,
            groups,
            feedback,
            comments,
            sort,
            trash,
          },
        }),
      );
      setStorageError(false);
      setSavedDocs(docs);
      setSavedAt(Date.now());
    } catch {
      setStorageError(true);
    }
  }, [
    storageKey,
    boardTitle,
    docs,
    posts,
    groups,
    feedback,
    comments,
    sort,
    trash,
    participants,
  ]);
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setTrash((current) => {
          const next = pruneTrash(current);
          return next.length === current.length ? current : next;
        }),
      60000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [savedPreferences] = useState<Partial<PreviewPreferences>>(() => {
    if (!tabletSession) return {};
    try {
      return (
        JSON.parse(localStorage.getItem(TABLET_PREFERENCES_KEY) ?? "null") ?? {}
      );
    } catch {
      return {};
    }
  });
  const [prompt, setPrompt] = useState(
    savedPreferences.prompt ??
      simulationLessons[simulation as SimulationLesson]?.prompt ??
      "마음에 오래 남은 하루를 써 보세요.",
  );
  const [promptDraft, setPromptDraft] = useState(prompt);
  const [classTitle, setClassTitle] = useState(
    tabletSession?.title ?? savedPreferences.classTitle ?? "우리 반 글쓰기",
  );
  const [toast, setToast] = useState("");
  const [settings, setSettings] = useState(
    savedPreferences.settings ?? {
      locked: false,
      observe: false,
      feedback: true,
      editing: true,
      comments: true,
    },
  );
  useEffect(() => {
    if (!tabletSession) return;
    try {
      localStorage.setItem(
        TABLET_PREFERENCES_KEY,
        JSON.stringify({ prompt, classTitle, settings }),
      );
    } catch {
      setStorageError(true);
    }
  }, [prompt, classTitle, settings, tabletSession]);
  const [studentName, setStudentName] = useState(
    tabletSession?.studentName ?? "김하늘",
  );
  const [activeStudentId, setActiveStudentId] = useState(
    tabletSession?.studentId ?? 0,
  );
  const currentUserId = role === "teacher" ? -1 : activeStudentId;
  const activeParticipant = participants.find((p) => p.id === activeStudentId);
  const writingDoc = docs.find(
    (d) => d.id === route.docId && d.studentId === currentUserId,
  );
  const student = writingDoc ?? docs[0];
  const go = (next: Route) => {
    window.history.pushState(null, "", routePath(next, tabletSession?.host));
    setRoute(next);
    setDialog(null);
    window.scrollTo(0, 0);
  };
  const navigate = (next: Screen) => {
    const nextRole = ["student", "join"].includes(next)
      ? "student"
      : ["teacher", "start", "history"].includes(next)
        ? "teacher"
        : role;
    go({
      role: nextRole,
      screen: next === "student" ? "board" : next,
      docId: next === "write" ? route.docId : undefined,
    });
  };
  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      routePath(readRoute(), tabletSession?.host),
    );
    const change = () => {
      const next = readRoute();
      setRoute(next);
      setDialog(null);
      if (window.location.hash)
        window.history.replaceState(
          null,
          "",
          routePath(next, tabletSession?.host),
        );
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", change);
    window.addEventListener("hashchange", change);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("popstate", change);
    };
  }, []);
  useEffect(() => {
    if (screen === "write" && !writingDoc) {
      const next: Route = { role, screen: "board" };
      window.history.replaceState(
        null,
        "",
        routePath(next, tabletSession?.host),
      );
      setRoute(next);
    }
  }, [screen, role, writingDoc]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const updateDoc = (id: number, changes: Partial<StudentDoc>) => {
    const patch = changes.groupId
      ? {
          ...changes,
          manualOrder:
            Math.max(
              0,
              ...docs.map((d) => d.manualOrder),
              ...posts.map((p) => p.manualOrder),
            ) + 1,
        }
      : changes;
    setDocs((current) =>
      current.map((d) =>
        d.id === id ? { ...d, ...patch, updated: "방금" } : d,
      ),
    );
    if (patch.groupId)
      setPosts((current) =>
        current.map((p) =>
          p.id === id
            ? { ...p, groupId: patch.groupId!, manualOrder: patch.manualOrder! }
            : p,
        ),
      );
  };
  const setHelp = (request?: HelpRequest) => {
    if (role !== "student") return;
    setParticipants((current) => {
      const exists = current.some((p) => p.id === activeStudentId);
      return exists
        ? current.map((p) =>
            p.id === activeStudentId ? { ...p, help: request } : p,
          )
        : [
            ...current,
            {
              id: activeStudentId,
              name: studentName,
              joinedAt: Date.now(),
              connected: true,
              help: request,
            },
          ];
    });
  };
  const finishHelp = (studentId: number, move = false) => {
    if (role !== "teacher") return;
    const help = participants.find((p) => p.id === studentId)?.help;
    if (move) {
      if (
        !help ||
        help.docId === undefined ||
        !docs.some((d) => d.id === help.docId) ||
        !groups.some((g) => g.id === help.targetGroupId)
      )
        return;
      updateDoc(help.docId, { groupId: help.targetGroupId });
    }
    setParticipants((current) =>
      current.map((p) => (p.id === studentId ? { ...p, help: undefined } : p)),
    );
    setToast(
      move
        ? "요청한 그룹으로 원고와 게시글을 옮겼어요."
        : "도움 요청을 확인했어요.",
    );
  };
  const messageActions = {
    onSendMessage: (docId: number, text: string) => {
      const doc = docs.find((d) => d.id === docId);
      if (!doc) return;
      setParticipants((items) =>
        items.map((p) =>
          p.id === doc.studentId
            ? {
                ...p,
                messages: [
                  ...(p.messages || []),
                  {
                    id: createUuid(),
                    docId,
                    text,
                    sender: role,
                    createdAt: Date.now(),
                  },
                ],
              }
            : p,
        ),
      );
    },
    onReadMessages: (docId: number, ids: string[]) => {
      setParticipants((items) =>
        items.map((p) => ({
          ...p,
          messages: p.messages?.map((m) =>
            m.docId === docId &&
            ids.includes(m.id) &&
            m.sender !== role &&
            !m.readAt
              ? { ...m, readAt: Date.now() }
              : m,
          ),
        })),
      );
    },
  };
  const respondToFeedback = (id: number, response: Feedback["response"]) => {
    setFeedback((current) =>
      current.map((f) => {
        if (f.id !== id) return f;
        if (
          role === "student" &&
          (f.studentId !== currentUserId ||
            response === "confirmed" ||
            f.response === "confirmed")
        )
          return f;
        return { ...f, response };
      }),
    );
  };
  const addFeedback = (
    docId: number,
    message: string,
    selection?: FeedbackSelection,
  ) => {
    const target = docs.find((d) => d.id === docId);
    if (role !== "teacher" || !target || !message.trim()) return;
    const id = nextFeedbackId.current++;
    setFeedback((current) => [
      ...current,
      {
        id,
        docId,
        studentId: target.studentId,
        message: message.trim(),
        quote: selection?.quote,
      },
    ]);
    if (selection)
      setDocs((current) =>
        current.map((d) =>
          d.id === docId
            ? {
                ...d,
                anchors: [
                  ...d.anchors,
                  {
                    feedbackId: id,
                    from: selection.from,
                    to: selection.to,
                    status: "active" as const,
                  },
                ],
              }
            : d,
        ),
      );
    setToast("피드백을 남겼어요.");
  };
  const createDoc = (groupId: string) => {
    if (!groups.some((g) => g.id === groupId)) return;
    const id = nextDocId.current++;
    const next: StudentDoc = {
      id,
      studentId: currentUserId,
      groupId,
      name: role === "teacher" ? "선생님" : studentName,
      title: "",
      paragraphs: [],
      html: "<p></p>",
      anchors: [],
      connected: true,
      updated: "방금",
      published: false,
      createdAt: Date.now(),
      manualOrder: Math.max(0, ...docs.map((d) => d.manualOrder)) + 1,
    };
    setDocs((current) => [...current, next]);
    go({ role, screen: "write", docId: id });
  };
  const movePost = (id: number, groupId: string, beforeId?: number) => {
    if (role !== "teacher" || !groups.some((g) => g.id === groupId)) return;
    const board = { docs, posts, sort };
    const next = moveBoardCard(board, id, groupId, beforeId);
    if (next === board) return;
    setPosts(next.posts);
    setDocs(next.docs);
    setSort(next.sort);
    setToast(
      `‘${groups.find((g) => g.id === groupId)?.title}’에 글을 놓았어요.`,
    );
  };
  const isLobby = ["start", "join", "history"].includes(screen);
  const toggle = (key: keyof typeof settings) =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  const publish = () => {
    if (!writingDoc || !writingDoc.title.trim() || charCount(writingDoc) === 0)
      return;
    const snapshot = {
      ...writingDoc,
      sources: filledSources(writingDoc.sources),
      paragraphs: [...writingDoc.paragraphs],
      anchors: [],
      published: true,
      publishedAt: writingDoc.publishedAt ?? Date.now(),
    };
    setPosts((p) =>
      p.some((d) => d.id === writingDoc.id)
        ? p.map((d) => (d.id === writingDoc.id ? snapshot : d))
        : [...p, snapshot],
    );
    updateDoc(writingDoc.id, {
      published: true,
      publishedAt: snapshot.publishedAt,
    });
    navigate("board");
    setToast("글을 게시했어요.");
  };
  return (
    <div className={`app screen-${screen} role-${role}`}>
      {simulation && (
        <div className="simulation-bar">
          <strong>가상 수업 연습 공간</strong>
          <span>기존 게시판과 별도 보관 · 실제 기기 연결 없음</span>
          <label>
            역할 전환
            <select
              aria-label="가상 수업 역할"
              value={role === "teacher" ? "teacher" : String(activeStudentId)}
              onChange={(e) => {
                if (e.target.value === "teacher")
                  go({ role: "teacher", screen: "board" });
                else {
                  const id = Number(e.target.value);
                  setActiveStudentId(id);
                  setStudentName(virtualStudents[id]);
                  go({ role: "student", screen: "board" });
                }
              }}
            >
              <option value="teacher">교사</option>
              {virtualStudents.map((name, id) => (
                <option key={id} value={id}>
                  {name} 학생
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {storageError && (
        <div className="storage-warning" role="alert">
          이 브라우저에 저장하지 못했어요. 새로고침하기 전에 글을 복사해 주세요.
        </div>
      )}
      <header className="app-header">
        <Logo
          onClick={
            tabletSession?.onHome ??
            (() =>
              navigate(
                role === "teacher"
                  ? "start"
                  : screen === "join"
                    ? "join"
                    : "board",
              ))
          }
        />
        {!isLobby && (
          <>
            <div className="header-divider" />
            <div className="class-title">
              <span>{classTitle}</span>
              <span className="header-role">
                {role === "teacher" ? "선생님" : studentName}
              </span>
            </div>
            <div className="header-actions">
              {role === "teacher" ? (
                <>
                  <Button
                    className="invite-button"
                    onClick={
                      tabletSession?.onInvite ?? (() => setDialog("invite"))
                    }
                  >
                    <span>입장 코드</span>
                    <strong>{tabletSession?.studentCode ?? "482 716"}</strong>
                    <QrCode size={19} />
                  </Button>
                  <span className="header-connected">
                    <span className="status-dot" />
                    참여 {participants.length}명
                  </span>
                  <IconButton
                    label="수업 설정"
                    onClick={
                      tabletSession?.onSettings ?? (() => setDialog("settings"))
                    }
                  >
                    <Settings size={20} />
                  </IconButton>
                  <Button
                    className="end-class"
                    onClick={
                      tabletSession?.onDisconnect ?? (() => setDialog("end"))
                    }
                  >
                    {tabletSession?.host
                      ? "수업 마치기"
                      : tabletSession
                        ? "PC 연결 나가기"
                        : "수업 종료"}
                  </Button>
                </>
              ) : (
                <>
                  <span className="header-connected">
                    <span className="status-dot" />내 글쓰기 공간
                  </span>
                  <span className="user-avatar">{studentName.slice(-2)}</span>
                </>
              )}
            </div>
          </>
        )}
        {isLobby && (
          <div className="header-actions">
            <span className="header-description">
              생각을 쓰고, 마음을 나누는 교실
            </span>
            {role === "teacher" && (
              <Button
                variant="ghost"
                onClick={() =>
                  navigate(screen === "history" ? "start" : "history")
                }
              >
                <History size={17} />
                {screen === "history" ? "시작으로" : "지난 수업"}
              </Button>
            )}
          </div>
        )}
      </header>
      {role === "teacher" && tabletSession?.notice}
      {!isLobby && role === "teacher" && (
        <nav className="product-tabs" aria-label="수업 메뉴">
          {[
            { id: "teacher", name: "전체 글", icon: LayoutGrid },
            { id: "board", name: "게시판", icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.id}
              className={screen === tab.id ? "active" : ""}
              onClick={() => navigate(tab.id as Screen)}
              aria-current={screen === tab.id ? "page" : undefined}
            >
              <tab.icon size={17} />
              {tab.name}
              {tab.id === "board" && <span>{posts.length}</span>}
            </button>
          ))}
          {tabletSession?.host && (
            <button onClick={tabletSession.onHostManage}>
              <Tablet size={17} />
              서버 관리
            </button>
          )}
          <span className="class-date">9월 5일 토요일</span>
        </nav>
      )}
      {!isLobby && screen !== "board" && screen !== "write" && (
        <div className="prompt-banner">
          <span className="prompt-label">
            <Sprout size={17} />
            오늘의 글감
          </span>
          <span className="prompt-text">{prompt}</span>
          {role === "teacher" && (
            <button
              onClick={() => {
                setPromptDraft(prompt);
                setDialog("prompt");
              }}
            >
              <Pencil size={14} />
              <span>안내 수정</span>
            </button>
          )}
        </div>
      )}
      {screen === "teacher" && (
        <Teacher
          {...messageActions}
          docs={docs.filter((d) => d.studentId >= 0)}
          groups={groups}
          feedback={feedback}
          onUpdate={updateDoc}
          onFeedback={addFeedback}
          participants={participants}
          onFinishHelp={finishHelp}
          onFeedbackResponse={respondToFeedback}
        />
      )}
      {screen === "board" && (
        <>
          {role === "student" && (
            <div className="student-board-help page-width">
              <span>주제를 고르고 +를 눌러 글을 시작해요.</span>
              <HelpButton
                participant={activeParticipant}
                groups={groups}
                onRequest={setHelp}
              />
            </div>
          )}
          <Community
            onFeedbackResponse={respondToFeedback}
            boardTitle={boardTitle}
            onTitleChange={setBoardTitle}
            trashCount={trash.reduce(
              (sum, batch) => sum + batch.docs.length,
              0,
            )}
            onOpenTrash={() => setTrashOpen(true)}
            posts={posts}
            docs={
              role === "teacher"
                ? docs
                : docs.filter((d) => d.studentId === currentUserId)
            }
            groups={groups}
            feedback={
              role === "teacher"
                ? feedback
                : feedback.filter((f) => f.studentId === currentUserId)
            }
            role={role}
            studentName={role === "teacher" ? "선생님" : studentName}
            currentUserId={currentUserId}
            sort={sort}
            onSort={setSort}
            comments={comments}
            onComment={(id, text) =>
              setComments((current) => ({
                ...current,
                [id]: [
                  ...(current[id] ?? []),
                  { name: role === "teacher" ? "선생님" : studentName, text },
                ],
              }))
            }
            onCreate={createDoc}
            onWrite={(id) => go({ role, screen: "write", docId: id })}
            onUpdate={updateDoc}
            onFeedback={addFeedback}
            onMovePost={movePost}
            onSaveGroup={(group) => {
              if (role !== "teacher") return;
              setGroups((current) =>
                current.some((g) => g.id === group.id)
                  ? current.map((g) => (g.id === group.id ? group : g))
                  : [...current, group],
              );
            }}
            onDeleteGroup={(id) => {
              if (role !== "teacher") return;
              applyBoard(trashGroup(currentBoard(), id));
              setToast(
                "그룹과 글을 휴지통으로 옮겼어요. 30일 안에 복원할 수 있어요.",
              );
            }}
            onReorderGroup={(id, targetId) => {
              if (role !== "teacher" || id === targetId) return;
              setGroups((current) => {
                const group = current.find((g) => g.id === id);
                const target = current.findIndex((g) => g.id === targetId);
                if (!group || target < 0) return current;
                const next = current.filter((g) => g.id !== id);
                next.splice(target, 0, group);
                return next;
              });
            }}
            commentsEnabled={settings.comments}
            onToggleComments={() => toggle("comments")}
            onRemove={(id) => {
              setPosts((p) => p.filter((d) => d.id !== id));
              updateDoc(id, { published: false });
              setToast("게시글을 내렸어요.");
            }}
          />
        </>
      )}
      {screen === "write" && writingDoc && (
        <WritingPage
          {...messageActions}
          lessonPrompt={prompt}
          key={writingDoc.id}
          doc={writingDoc}
          group={groups.find((g) => g.id === writingDoc.groupId)!}
          feedback={feedback.filter((f) => f.docId === writingDoc.id)}
          onUpdate={(changes) => updateDoc(writingDoc.id, changes)}
          onPublish={publish}
          onBack={() => navigate("board")}
          post={posts.find((p) => p.id === writingDoc.id)}
          saveState={
            storageError
              ? "error"
              : savedDocs.find((d) => d.id === writingDoc.id) === writingDoc
                ? "saved"
                : "saving"
          }
          savedAt={savedAt}
          participant={activeParticipant}
          groups={groups}
          isStudent={role === "student"}
          onRequestHelp={setHelp}
          onFeedbackResponse={respondToFeedback}
        />
      )}
      {screen === "start" && (
        <Start
          navigate={navigate}
          onStart={() => {
            navigate("teacher");
            window.setTimeout(() => setDialog("invite"), 50);
          }}
        />
      )}
      {screen === "join" && (
        <Join
          onJoin={(name) => {
            setStudentName(name);
            setParticipants((current) =>
              current.some((p) => p.id === activeStudentId)
                ? current.map((p) =>
                    p.id === activeStudentId
                      ? { ...p, name, connected: true }
                      : p,
                  )
                : [
                    ...current,
                    {
                      id: activeStudentId,
                      name,
                      joinedAt: Date.now(),
                      connected: true,
                    },
                  ],
            );
            setDocs((current) =>
              current.map((d) =>
                d.studentId === activeStudentId ? { ...d, name } : d,
              ),
            );
            navigate("board");
          }}
        />
      )}
      {screen === "history" && (
        <HistoryPage
          navigate={navigate}
          onExport={() =>
            setToast(
              "결과 내보내기 버튼의 UI 시안이에요. 파일은 생성하지 않아요.",
            )
          }
        />
      )}
      {role === "teacher" && !tabletSession && (
        <div className="preview-dock">
          <span className="preview-label">
            <Monitor size={15} />
            <strong>UI 시안</strong>
            <span>이 브라우저에 저장 · 기기 연결 없음</span>
          </span>
          <nav aria-label="시안 화면 선택">
            {(
              [
                { id: "start", name: "교사 시작" },
                { id: "teacher", name: "전체 글" },
                { id: "board", name: "게시판" },
                { id: "history", name: "지난 수업" },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                className={screen === s.id ? "active" : ""}
                onClick={() => navigate(s.id)}
                aria-current={screen === s.id ? "page" : undefined}
              >
                {s.name}
              </button>
            ))}
            <button onClick={() => go({ role: "student", screen: "board" })}>
              학생 화면 보기 ↗
            </button>
          </nav>
        </div>
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
      {trashOpen && role === "teacher" && (
        <TrashPanel
          trash={trash}
          onClose={() => setTrashOpen(false)}
          onRestore={(id, docId) => {
            applyBoard(restoreTrash(currentBoard(), id, docId));
            setToast("그룹과 원고를 복원했어요.");
          }}
        />
      )}
      {dialog === "invite" && (
        <Modal title="우리 반으로 초대하기" onClose={() => setDialog(null)}>
          <div className="invite-content">
            <p>학생들이 QR을 찍거나 입장 코드를 입력하면 돼요.</p>
            <div className="qr-preview">
              <QrCode size={155} strokeWidth={1.5} />
              <span>입장 QR 표시 예시</span>
            </div>
            <span className="eyebrow">우리 반 입장 코드</span>
            <div className="large-code">482 716</div>
            <Button
              onClick={() => {
                navigator.clipboard
                  ?.writeText("482716")
                  .then(() => setToast("예시 입장 코드를 복사했어요."))
                  .catch(() => setToast("입장 코드: 482716"));
              }}
            >
              <Copy size={16} />
              코드 복사
            </Button>
            <div className="invite-lock">
              <span>
                <LockKeyhole size={17} />새 입장 잠금
              </span>
              <Toggle
                checked={settings.locked}
                onChange={() => toggle("locked")}
                label="새 입장 잠금"
              />
            </div>
            <p className="meta">이미 들어온 학생은 다시 입장할 수 있어요.</p>
            <Button variant="ghost" onClick={() => navigate("join")}>
              학생 입장 화면 열기
              <ArrowRight size={16} />
            </Button>
            <p className="meta">학생 입장 경로: /student/join</p>
          </div>
        </Modal>
      )}
      {dialog === "settings" && (
        <Modal title="수업 설정" onClose={() => setDialog(null)}>
          <div className="settings-content">
            <label className="field">
              수업 이름
              <input
                value={classTitle}
                onChange={(e) => setClassTitle(e.target.value)}
              />
            </label>
            <h3>학생에게 보이는 알림</h3>
            {(
              [
                {
                  key: "observe",
                  label: "선생님이 보고 있어요",
                  description: "학생 글을 열어 보고 있을 때 표시해요.",
                },
                {
                  key: "feedback",
                  label: "새 피드백 알림",
                  description: "피드백이 도착하면 학생에게 알려요.",
                },
                {
                  key: "editing",
                  label: "선생님이 수정 중이에요",
                  description: "글을 직접 고치고 있을 때 표시해요.",
                },
              ] as const
            ).map((s) => (
              <div className="setting-row" key={s.key}>
                <div>
                  <strong>{s.label}</strong>
                  <p>{s.description}</p>
                </div>
                <Toggle
                  checked={settings[s.key]}
                  label={s.label}
                  onChange={() => toggle(s.key)}
                />
              </div>
            ))}
            <h3>수업 참여</h3>
            <div className="setting-row">
              <div>
                <strong>새 입장 잠금</strong>
                <p>새로운 학생의 입장을 잠시 막아요.</p>
              </div>
              <Toggle
                checked={settings.locked}
                label="새 입장 잠금"
                onChange={() => toggle("locked")}
              />
            </div>
            <div className="setting-row">
              <strong>게시판 댓글 허용</strong>
              <Toggle
                checked={settings.comments}
                label="게시판 댓글 허용"
                onChange={() => toggle("comments")}
              />
            </div>
            <Button
              variant="primary"
              className="full-width"
              onClick={() => {
                setDialog(null);
                setToast("설정한 모습을 시안에 적용했어요.");
              }}
            >
              적용하기
            </Button>
          </div>
        </Modal>
      )}
      {dialog === "prompt" && (
        <Modal title="글쓰기 안내" onClose={() => setDialog(null)}>
          <form
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              setPrompt(promptDraft);
              setDialog(null);
            }}
          >
            <label className="field">
              오늘의 글감
              <textarea
                rows={4}
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
              />
            </label>
            <p className="meta">학생들의 글쓰기 화면 위에 표시돼요.</p>
            <Button
              type="submit"
              variant="primary"
              disabled={!promptDraft.trim()}
            >
              안내 적용하기
            </Button>
          </form>
        </Modal>
      )}
      {dialog === "end" && (
        <Modal title="오늘 수업을 마칠까요?" onClose={() => setDialog(null)}>
          <div className="modal-form">
            <p>
              수업이 끝난 뒤에는 지난 수업에서 아이들의 글을 다시 볼 수 있어요.
            </p>
            <div className="end-summary">
              <Users size={20} />
              <strong>
                참여 {participants.length}명 · 원고 {docs.length}개
              </strong>
              <BookOpen size={20} />
              <strong>{posts.length}개의 게시글</strong>
            </div>
            <p className="prototype-note">
              지금은 UI 시안입니다. 실제 수업을 종료하거나 저장하지 않아요.
            </p>
            <div className="modal-footer">
              <Button onClick={() => setDialog(null)}>계속 수업하기</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setDialog(null);
                  navigate("history");
                }}
              >
                수업 마치기
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {dialog === "published" && (
        <Modal
          title="친구들과 나눌 준비가 됐어요"
          onClose={() => setDialog(null)}
        >
          <div className="publish-success">
            <span className="success-icon">
              <Check size={28} />
            </span>
            <h3>{student?.title}</h3>
            <p>
              게시판에 글을 올린 모습을 확인해 보세요.
              <br />
              선생님의 개인 피드백은 함께 보이지 않아요.
            </p>
            <p className="prototype-note">
              시안 안에서만 표시되며 실제로 공유되지 않아요.
            </p>
            <div className="modal-footer">
              <Button onClick={() => setDialog(null)}>계속 쓰기</Button>
              <Button variant="primary" onClick={() => navigate("board")}>
                게시판에서 보기
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Start({
  navigate,
  onStart,
}: {
  navigate: (s: Screen) => void;
  onStart: () => void;
}) {
  return (
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
        <button className="entry-card teacher-entry" onClick={onStart}>
          <span className="entry-icon">
            <LayoutGrid size={28} strokeWidth={1.5} />
          </span>
          <span className="eyebrow">선생님</span>
          <h2>수업 시작</h2>
          <p>
            아이들의 글을 한눈에 살펴보고
            <br />
            따뜻한 한마디를 건네세요.
          </p>
          <span className="entry-action">
            우리 반 글쓰기 열기
            <ArrowRight size={21} />
          </span>
        </button>
        <button
          className="entry-card student-entry"
          onClick={() => navigate("join")}
        >
          <span className="entry-icon">
            <Pencil size={28} strokeWidth={1.5} />
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
            <ArrowRight size={21} />
          </span>
        </button>
      </div>
      <button className="past-class-link" onClick={() => navigate("history")}>
        <History size={17} />
        <span>지난 수업 이어 보기</span>
        <ChevronRight size={16} />
      </button>
      <p className="start-footnote">
        회원가입 없이, 이름만 있으면 시작할 수 있어요.
      </p>
    </main>
  );
}
function Join({ onJoin }: { onJoin: (name: string) => void }) {
  const [code, setCode] = useState("482716");
  const [name, setName] = useState("김하늘");
  return (
    <main className="join-page">
      <div className="join-card">
        <span className="join-icon">
          <DoorOpen size={30} strokeWidth={1.5} />
        </span>
        <div className="eyebrow">우리 반이 기다리고 있어요</div>
        <h1>반가워요!</h1>
        <p>입장 코드와 이름을 적어 주세요.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && code.length === 6) onJoin(name.trim());
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
              maxLength={16}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <Button
            variant="primary"
            type="submit"
            className="full-width"
            disabled={!name.trim() || code.length !== 6}
          >
            들어가기
            <ArrowRight size={17} />
          </Button>
        </form>
        <p className="join-footer">친구와 이름이 같아도 괜찮아요.</p>
      </div>
    </main>
  );
}
function HistoryPage({
  navigate,
  onExport,
}: {
  navigate: (s: Screen) => void;
  onExport: () => void;
}) {
  return (
    <main className="history-page page-width">
      <div className="page-heading">
        <div>
          <span className="eyebrow">다시 꺼내 읽는 이야기</span>
          <h1>지난 수업</h1>
          <p>이 브라우저에 보관됩니다.</p>
        </div>
        <Button variant="primary" onClick={() => navigate("teacher")}>
          새 수업 시작
          <ArrowRight size={17} />
        </Button>
      </div>
      <div className="history-list">
        {[
          ["9월 5일", "마음에 오래 남은 하루", "12", "6"],
          ["9월 3일", "내가 좋아하는 작은 것들", "12", "10"],
          ["9월 1일", "새 학기에 바라는 일", "12", "12"],
        ].map(([date, title, students, posts], index) => (
          <article className="history-card" key={title}>
            <div className="history-date">
              <span>2026년</span>
              <strong>{date}</strong>
            </div>
            <div className="history-info">
              <span className="pill muted">수업 종료</span>
              <h2>{title}</h2>
              <span className="meta">
                학생 {students}명<span className="meta-divider">·</span>게시글{" "}
                {posts}개
              </span>
            </div>
            <div className="history-actions">
              <Button variant="ghost" onClick={onExport}>
                결과 내보내기
                <ArrowUpRight size={15} />
              </Button>
              <Button
                onClick={() => navigate(index === 0 ? "teacher" : "board")}
              >
                수업 보기
                <ChevronRight size={16} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      <div className="history-note">
        <History size={19} />
        <p>
          소중한 글은 파일로도 간직해 주세요.
          <br />
          <span>결과 내보내기로 글과 피드백을 모아 읽을 수 있어요.</span>
        </p>
      </div>
    </main>
  );
}
