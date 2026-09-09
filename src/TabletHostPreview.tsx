import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  BookOpen,
  Check,
  CheckCheck,
  CircleHelp,
  Copy,
  KeyRound,
  Laptop,
  LayoutGrid,
  LogOut,
  Moon,
  PlugZap,
  QrCode,
  RotateCcw,
  Sprout,
  Sun,
  Tablet,
  Users,
  Wifi,
} from "lucide-react";
import PreviewApp from "./PreviewApp";
import { Button, Logo, Modal, Toggle } from "./ui";
import { initialDocs } from "./data";
import {
  enterPreviewStudent,
  readPreviewStudent,
  rememberPreviewStudent,
} from "./preview-student";
import "./tablet-host-preview.css";

type View =
  | "start"
  | "setup"
  | "host"
  | "host-work"
  | "host-board"
  | "join"
  | "teacher-work"
  | "student-work";
type Room = {
  active: boolean;
  title: string;
  teacherCode: string;
  teacherConnected: boolean;
  studentCount: number;
  locked: boolean;
  keepScreen: boolean;
  startedAt: number;
};
type Dialog = "invite" | "disconnect" | "end" | "settings" | "help" | null;
const STORAGE_KEY = "doto.tablet-host.ui.v1";
const STUDENT_CODE = "482716";
const EXAMPLE_COUNT = new Set(initialDocs.map((d) => d.studentId)).size;
const freshRoom = (): Room => ({
  active: false,
  title: "우리 반 글쓰기",
  teacherCode: "73918426",
  teacherConnected: false,
  studentCount: 0,
  locked: false,
  keepScreen: true,
  startedAt: Date.now(),
});
const readRoom = (): Room => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      value &&
      typeof value.title === "string" &&
      typeof value.active === "boolean"
    )
      return { ...freshRoom(), ...value };
  } catch {
    /* A fresh preview remains available without browser storage. */
  }
  return freshRoom();
};
const paths: Record<View, string> = {
  start: "/teacher/start",
  setup: "/host/setup",
  host: "/host/room",
  "host-work": "/host/overview",
  "host-board": "/host/board",
  join: "/join",
  "teacher-work": "/teacher/overview",
  "student-work": "/student/board",
};
const viewFromUrl = (): View => {
  const path = location.pathname;
  if (path.startsWith("/host/")) {
    if (path === "/host/setup") return "setup";
    if (path === "/host/overview") return "host-work";
    if (path === "/host/board") return "host-board";
    return "host";
  }
  if (["/join", "/teacher/join", "/student/join"].includes(path)) return "join";
  if (path.startsWith("/student/")) return "student-work";
  if (path.startsWith("/teacher/") && path !== "/teacher/start")
    return "teacher-work";
  return "start";
};
const formattedCode = (code: string) =>
  `${code.slice(0, code.length / 2)} ${code.slice(code.length / 2)}`;

export default function TabletHostPreview() {
  const [view, setView] = useState<View>(viewFromUrl);
  const [room, setRoom] = useState<Room>(readRoom);
  const [title, setTitle] = useState(room.title);
  const [codeInput, setCodeInput] = useState(
    () => new URLSearchParams(location.search).get("code") ?? "",
  );
  const [studentName, setStudentName] = useState("");
  const [studentIdentity, setStudentIdentity] = useState(readPreviewStudent);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dimmed, setDimmed] = useState(false);
  const [qr, setQr] = useState("");
  const [now, setNow] = useState(Date.now());
  const inviteUrl = `${location.origin}/join?preview=tablet&code=${STUDENT_CODE}`;
  const studentCodeEntered = codeInput === STUDENT_CODE;
  const hostWorkspace = view === "host-work" || view === "host-board";
  const hostDevice = view === "host" || hostWorkspace;
  const studentView = view === "student-work";
  const studentSurface = studentView || (view === "join" && studentCodeEntered);
  const workspace =
    hostWorkspace || view === "teacher-work" || view === "student-work";
  const workspaceAvailable =
    room.active &&
    (view !== "teacher-work" || room.teacherConnected) &&
    (!studentView || !!studentIdentity);

  const go = (next: View) => {
    history.pushState(null, "", `${paths[next]}?preview=tablet`);
    setView(next);
    setDialog(null);
    setError("");
    window.scrollTo(0, 0);
  };
  const update = (patch: Partial<Room>) =>
    setRoom((current) => ({ ...current, ...patch }));
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [room]);
  useEffect(() => {
    const pop = () => {
      setView(viewFromUrl());
      setDialog(null);
      setError("");
    };
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setRoom(readRoom());
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("storage", sync);
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("storage", sync);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(inviteUrl, {
      width: 248,
      margin: 1,
      color: { dark: "#31513e", light: "#ffffff" },
    })
      .then((value) => {
        if (!cancelled) setQr(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [inviteUrl]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast("복사했어요.");
    } catch {
      setToast("복사하지 못했어요. 화면의 코드를 직접 입력해 주세요.");
    }
  };
  const startRoom = () => {
    setRoom({
      ...freshRoom(),
      title: title.trim() || "우리 반 글쓰기",
      active: true,
    });
    go("host");
  };
  const demo = (next: View) => {
    if (
      [
        "host",
        "host-work",
        "host-board",
        "teacher-work",
        "student-work",
      ].includes(next)
    ) {
      update({
        active: true,
        studentCount: EXAMPLE_COUNT,
        ...(next === "teacher-work" ? { teacherConnected: true } : {}),
      });
    }
    go(next);
  };
  const minutes = Math.max(0, Math.floor((now - room.startedAt) / 60000));
  const connectionNotice = studentView ? null : (
    <div
      className={`th-connection-strip ${!room.active ? "is-disconnected" : ""}`}
    >
      <span>
        <Tablet size={17} />
        <strong>
          {hostWorkspace
            ? "이 태블릿에서 수업을 열고 있어요"
            : room.active
              ? "서버 태블릿에 연결됨"
              : "수업이 종료되었어요"}
        </strong>
        <span>
          {hostWorkspace
            ? "학생 글을 보고, 수정하고, 피드백을 남겨 보세요."
            : "이 PC에서 나가도 학생들은 계속 쓸 수 있어요."}
        </span>
      </span>
      <Button variant="ghost" onClick={() => setDialog("help")}>
        <CircleHelp size={16} />
        연결 안내
      </Button>
    </div>
  );

  return (
    <div
      className={`th-preview ${workspace ? "th-workspace" : ""} ${studentView ? "th-student-view" : ""}`}
    >
      {(!workspace || !workspaceAvailable) && (
        <header className="app-header th-header">
          <Logo onClick={() => go("start")} />
          <span className="th-header-caption">작은 생각이 자라는 우리 반</span>
          <div className="th-header-right">
            {view === "host" && room.active ? (
              <span className="th-role-tag">
                <Tablet size={15} />
                서버용 태블릿
              </span>
            ) : (
              !studentSurface && (
                <Button variant="ghost" onClick={() => setDialog("help")}>
                  <CircleHelp size={17} />
                  사용 안내
                </Button>
              )
            )}
          </div>
        </header>
      )}

      {view === "host" && room.active && (
        <nav className="product-tabs th-host-tabs" aria-label="수업 메뉴">
          <button onClick={() => demo("host-work")}>
            <LayoutGrid size={17} />
            전체 글
          </button>
          <button onClick={() => demo("host-board")}>
            <BookOpen size={17} />
            게시판
          </button>
          <button
            className="active"
            aria-current="page"
            onClick={() => go("host")}
          >
            <Tablet size={17} />
            서버 관리
          </button>
        </nav>
      )}

      {view === "start" && (
        <main className="th-start">
          <div className="th-start-heading">
            <span className="eyebrow">
              <Sprout size={17} />
              우리 반의 작은 글쓰기 시간
            </span>
            <h1>
              작은 생각이
              <br />
              <em>이야기로 자라는 곳.</em>
            </h1>
            <p>함께 쓰고, 읽고, 마음을 나누는 도토입니다.</p>
          </div>
          <div className="th-entry-grid">
            <button
              className="th-entry th-entry-host"
              onClick={() => go(room.active ? "host" : "setup")}
            >
              <span className="th-entry-top">
                <span className="th-device-icon">
                  <Tablet size={29} strokeWidth={1.5} />
                </span>
              </span>
              <span className="th-step-label">서버용 기기</span>
              <h2>수업 열기</h2>
              <p>학생 와이파이에 연결된 기기로 수업을 시작해요.</p>
              <span className="th-entry-action">
                {room.active ? "서버 화면 돌아가기" : "이 태블릿으로 방 열기"}
                <ArrowRight size={20} />
              </span>
            </button>
            <button
              className="th-entry th-entry-student"
              onClick={() => go("join")}
            >
              <span className="th-entry-top">
                <span className="th-device-icon">
                  <KeyRound size={29} strokeWidth={1.5} />
                </span>
              </span>
              <span className="th-step-label">선생님 · 학생</span>
              <h2>방 입장하기</h2>
              <p>입장코드를 입력하고 우리 반 수업에 함께해요.</p>
              <span className="th-entry-action">
                입장코드 입력
                <ArrowRight size={20} />
              </span>
            </button>
          </div>
        </main>
      )}

      {view === "setup" && (
        <main className="th-setup th-page">
          <Button
            variant="ghost"
            className="th-back"
            onClick={() => go("start")}
          >
            <ArrowLeft size={16} />
            시작으로
          </Button>
          <div className="th-setup-grid">
            <section className="th-setup-copy">
              <span className="eyebrow">수업 준비 · 서버용 태블릿</span>
              <h1>
                이 태블릿에
                <br />
                우리 반을 열어 둘게요.
              </h1>
              <p>
                수업이 끝날 때까지 도토를 열어 두세요.
                <br />이 태블릿이나 PC에서 글을 확인하고 수정할 수 있어요.
              </p>
              <div
                className="th-device-scene"
                aria-label="서버 태블릿을 중심으로 선생님 PC와 학생 태블릿이 연결되는 모습"
              >
                <span className="th-scene-leaf">
                  <Sprout size={29} />
                </span>
                <div className="th-scene-tablet">
                  <Tablet size={43} strokeWidth={1.3} />
                  <strong>우리 반 서버</strong>
                  <span>
                    <i className="status-dot" />
                    수업을 이어 주는 중
                  </span>
                </div>
                <div className="th-scene-line" />
                <div className="th-scene-peers">
                  <span>
                    <Laptop size={25} />
                    선생님 PC
                  </span>
                  <span>
                    <Tablet size={23} />
                    학생 태블릿
                  </span>
                </div>
              </div>
            </section>
            <form
              className="th-paper th-setup-form"
              onSubmit={(event) => {
                event.preventDefault();
                startRoom();
              }}
            >
              <h2>방 열기</h2>
              <p>오늘 수업의 이름을 정해 주세요.</p>
              <label className="field">
                수업 이름
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={40}
                  required
                  placeholder="예: 5학년 2반 글쓰기"
                />
              </label>
              <div className="th-preparations">
                <div>
                  <Wifi size={21} />
                  <span>
                    <strong>학생들과 같은 와이파이</strong>
                    <small>학생용 태블릿이 쓰는 망에 연결해 주세요.</small>
                  </span>
                </div>
                <div>
                  <PlugZap size={21} />
                  <span>
                    <strong>충전기를 꽂아 두면 좋아요</strong>
                    <small>수업 내내 켜 둘 태블릿이에요.</small>
                  </span>
                </div>
                <div>
                  <Sun size={21} />
                  <span>
                    <strong>수업 중 화면 켜 두기</strong>
                    <small>방을 열면 화면 유지 모드로 시작해요.</small>
                  </span>
                </div>
              </div>
              <Button
                variant="primary"
                type="submit"
                className="full-width"
                disabled={!title.trim()}
              >
                방 열고 코드 받기
                <ArrowRight size={18} />
              </Button>
              <span className="th-form-footnote">
                교사용·학생용 코드로 같은 입장 화면에서 들어갈 수 있어요.
              </span>
            </form>
          </div>
        </main>
      )}

      {view === "host" && room.active && (
        <main className="th-page th-host">
          <div className="th-page-heading">
            <div>
              <span className="eyebrow">
                <span className="status-dot" />
                수업을 열어 두고 있어요
              </span>
              <h1>{room.title}</h1>
              <p>이 태블릿에서도, 교사용 컴퓨터에서도 수업할 수 있어요.</p>
            </div>
            <Button onClick={() => setDialog("settings")}>
              <Sun size={17} />
              화면 관리
            </Button>
          </div>
          <div className="th-host-grid">
            <section
              className="th-paper th-room-card th-room-teacher"
              aria-label="선생님 PC 연결"
            >
              <div className="th-room-card-heading">
                <Laptop size={23} />
                <h2>교사용 입장코드</h2>
              </div>
              <p className="th-room-instruction">
                <span>1</span> 교사용 컴퓨터에서 이 코드를 입력해 주세요.
              </p>
              <div className="th-room-code">
                {formattedCode(room.teacherCode)}
              </div>
              <div className="th-room-card-footer">
                <Button
                  variant="ghost"
                  onClick={() => void copy(room.teacherCode)}
                >
                  <Copy size={16} />
                  교사용 코드 복사
                </Button>
                <span className="th-room-connection">
                  <span
                    className={`status-dot ${room.teacherConnected ? "" : "offline"}`}
                  />
                  {room.teacherConnected ? "PC 연결됨" : "PC 연결 대기"}
                </span>
              </div>
            </section>
            <section
              className="th-paper th-room-card th-room-student"
              aria-label="학생 입장 안내"
            >
              <div className="th-room-card-heading">
                <Users size={23} />
                <h2>학생용 입장코드</h2>
              </div>
              <p className="th-room-instruction">
                <span>2</span> 학생들에겐 이 코드를 안내해주세요.
              </p>
              <div className="th-room-code">{formattedCode(STUDENT_CODE)}</div>
              <div className="th-room-card-footer">
                <Button variant="ghost" onClick={() => void copy(STUDENT_CODE)}>
                  <Copy size={16} />
                  학생용 코드 복사
                </Button>
                <Button variant="ghost" onClick={() => setDialog("invite")}>
                  <QrCode size={16} />
                  학생용 QR
                </Button>
              </div>
              {room.locked && (
                <p className="th-room-locked">새 학생 입장이 잠겨 있어요.</p>
              )}
            </section>
          </div>
          <section className="th-host-status" aria-label="수업 상태 예시">
            <div>
              <Users size={20} />
              <span>
                참여 학생
                <strong>
                  {room.studentCount}
                  <small>명</small>
                </strong>
              </span>
            </div>
            <div>
              <CheckCheck size={20} />
              <span>
                글 저장 · 예시
                <strong>
                  {room.studentCount ? "전달받은 글 저장됨" : "학생 입장 대기"}
                </strong>
              </span>
            </div>
            <div>
              <BatteryCharging size={22} />
              <span>
                배터리 · 예시
                <strong>
                  86%<small>충전 중</small>
                </strong>
              </span>
            </div>
            <div>
              <Sun size={20} />
              <span>
                화면 유지 · 예시
                <strong>{room.keepScreen ? "켜짐" : "꺼짐"}</strong>
              </span>
            </div>
          </section>
          <section className="th-keep-panel">
            <span className="th-keep-icon">
              <Moon size={24} />
            </span>
            <div>
              <h2>수업 중에는 도토를 열어 두세요.</h2>
              <p>
                전체 글과 게시판을 보는 동안에도 방은 유지돼요. 잠시 내려놓을
                때는 화면을 어둡게 해 두세요.
              </p>
            </div>
            <Button onClick={() => setDimmed(true)}>
              <Moon size={17} />
              어둡게 켜 두기
            </Button>
          </section>
          <footer className="th-host-footer">
            <span>
              방을 연 지 {minutes}분 · {room.title}
            </span>
            <Button variant="ghost" onClick={() => setDialog("end")}>
              수업 마치기
              <LogOut size={15} />
            </Button>
          </footer>
        </main>
      )}

      {view === "host" && !room.active && (
        <main className="th-ended th-page">
          <span className="th-device-icon">
            <Check size={32} />
          </span>
          <span className="eyebrow">수업 종료 화면</span>
          <h1>오늘의 글쓰기 시간을 마쳤어요.</h1>
          <p>다시 방을 열면 새로운 수업을 준비할 수 있어요.</p>
          <Button variant="primary" onClick={() => go("setup")}>
            새 수업 준비
            <ArrowRight size={17} />
          </Button>
        </main>
      )}

      {view === "join" && (
        <main className="th-join-page">
          <Button
            variant="ghost"
            className="th-back"
            onClick={() => go("start")}
          >
            <ArrowLeft size={16} />
            시작으로
          </Button>
          <div className="th-paper th-join-card">
            <span className="th-device-icon">
              <KeyRound size={29} strokeWidth={1.5} />
            </span>
            <span className="eyebrow">우리 반이 기다리고 있어요</span>
            <h1>방 입장하기</h1>
            <p>
              입장코드를 입력해 주세요.
              <br />
              코드에 맞는 화면으로 연결해 드려요.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!room.active) {
                  setError(
                    studentCodeEntered
                      ? "수업이 아직 열리지 않았어요. 선생님께 알려 주세요."
                      : "열려 있는 방이 없어요. 먼저 수업을 열어 주세요.",
                  );
                  return;
                }
                if (codeInput === room.teacherCode) {
                  update({
                    teacherConnected: true,
                    studentCount: Math.max(room.studentCount, EXAMPLE_COUNT),
                  });
                  go("teacher-work");
                  return;
                }
                if (codeInput !== STUDENT_CODE) {
                  setError(
                    "입장코드가 맞지 않아요. 안내받은 코드를 다시 확인해 주세요.",
                  );
                  return;
                }
                if (room.locked) {
                  setError(
                    "지금은 새 학생 입장이 잠겨 있어요. 선생님께 알려 주세요.",
                  );
                  return;
                }
                if (!studentName.trim()) return;
                const identity = enterPreviewStudent(
                  studentName,
                  studentIdentity,
                );
                setStudentIdentity(identity);
                try {
                  rememberPreviewStudent(identity);
                } catch {
                  setToast(
                    "입장 정보를 보관하지 못했어요. 새로고침하면 다시 입장해 주세요.",
                  );
                }
                update({
                  studentCount: Math.max(1, room.studentCount),
                });
                go("student-work");
              }}
            >
              <label className="field">
                입장코드
                <input
                  aria-describedby={error ? "th-join-error" : undefined}
                  aria-invalid={!!error}
                  autoComplete="off"
                  inputMode="numeric"
                  type="text"
                  className="th-code-input"
                  placeholder="입장코드를 입력해 주세요"
                  value={codeInput}
                  maxLength={12}
                  required
                  onChange={(event) => {
                    setCodeInput(
                      event.target.value.replace(/\D/g, "").slice(0, 8),
                    );
                    setError("");
                  }}
                />
              </label>
              {studentCodeEntered && (
                <label className="field">
                  이름 또는 별명
                  <input
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    placeholder="어떤 이름으로 들어갈까요?"
                    maxLength={16}
                    required
                    autoComplete="off"
                  />
                </label>
              )}
              {error && (
                <p id="th-join-error" className="th-error" role="alert">
                  {error}
                </p>
              )}
              <Button
                variant="primary"
                type="submit"
                className="full-width"
                disabled={
                  ![6, 8].includes(codeInput.length) ||
                  (studentCodeEntered && !studentName.trim())
                }
              >
                방 입장하기
                <ArrowRight size={18} />
              </Button>
            </form>
          </div>
        </main>
      )}

      {workspace && !workspaceAvailable && (
        <main className="th-ended th-page">
          <span className="th-device-icon">
            <Tablet size={30} />
          </span>
          <h1>
            {studentView && !studentIdentity
              ? "방에 먼저 입장해 주세요."
              : room.active
                ? "이 PC의 연결이 해제됐어요."
                : "수업이 종료되었어요."}
          </h1>
          <p>
            {studentView && !studentIdentity
              ? "입장코드와 이름을 입력하면 내가 쓰던 글을 볼 수 있어요."
              : room.active
                ? "태블릿의 방은 열려 있어요. 교사용 입장코드로 다시 연결해 주세요."
                : "다음 수업의 입장코드를 받으면 다시 들어올 수 있어요."}
          </p>
          <Button
            variant="primary"
            onClick={() => go(hostDevice ? "setup" : "join")}
          >
            입장 화면으로
            <ArrowRight size={17} />
          </Button>
        </main>
      )}
      {workspace && workspaceAvailable && (
        <PreviewApp
          key={`${view}:${studentView ? studentIdentity?.id : "teacher"}`}
          tabletSession={{
            host: hostWorkspace,
            title: room.title,
            studentName: studentIdentity?.name ?? "",
            studentId: studentIdentity?.id ?? -1,
            studentCode: "482 716",
            notice: connectionNotice,
            onHome: studentView ? undefined : () => go("start"),
            onInvite: () => setDialog("invite"),
            onSettings: () => setDialog("settings"),
            onDisconnect: () => setDialog(hostWorkspace ? "end" : "disconnect"),
            onHostManage: () => go("host"),
          }}
        />
      )}

      {!studentSurface && (
        <aside className="th-review-bar" aria-label="UI 시안 화면 선택">
          <div className="th-review-label">
            <span>UI 시안</span>
            <small>
              {workspace
                ? "예시 학생 글 · 실제 기기 연결 없음"
                : "기기 연결·배터리·화면 유지는 예시"}
            </small>
          </div>
          <nav>
            {(
              [
                { id: "start", label: "시작" },
                { id: "host", label: "서버 태블릿" },
                { id: "join", label: "방 입장" },
                { id: "teacher-work", label: "교사 PC" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                className={
                  view === item.id || (item.id === "host" && hostWorkspace)
                    ? "active"
                    : ""
                }
                aria-current={
                  view === item.id || (item.id === "host" && hostWorkspace)
                    ? "page"
                    : undefined
                }
                onClick={() => demo(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          {view === "join" ? (
            <div className="th-review-code-examples">
              <button
                className="th-review-extra"
                onClick={() => {
                  update({ active: true });
                  setCodeInput(room.teacherCode);
                  setError("");
                }}
              >
                교사 코드 예시
              </button>
              <button
                className="th-review-extra"
                onClick={() => {
                  update({ active: true });
                  setCodeInput(STUDENT_CODE);
                  setStudentName("김하늘");
                  setError("");
                }}
              >
                학생 코드 예시
              </button>
            </div>
          ) : view === "host" && room.active ? (
            <button
              className="th-review-extra"
              onClick={() =>
                update({
                  teacherConnected: !room.teacherConnected,
                  studentCount: EXAMPLE_COUNT,
                })
              }
            >
              {room.teacherConnected ? "PC 끊김 예시" : "PC 연결 예시"}
            </button>
          ) : (
            <button
              className="th-review-extra"
              onClick={() => {
                setRoom(freshRoom());
                setTitle("우리 반 글쓰기");
                setCodeInput("");
                setStudentName("");
                go("start");
              }}
            >
              <RotateCcw size={13} />방 시안 초기화
            </button>
          )}
        </aside>
      )}
      {storageError && (
        <div className="th-storage-error" role="alert">
          {studentView
            ? "입장 정보를 보관하지 못했어요. 선생님께 알려 주세요."
            : "시안 설정을 이 브라우저에 저장하지 못했어요."}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}

      {dialog === "invite" && (
        <Modal title="우리 반으로 들어오세요" onClose={() => setDialog(null)}>
          <div className="th-invite-modal">
            <span className="eyebrow">학생 입장코드</span>
            <div className="th-code">482 716</div>
            {qr && <img src={qr} alt="학생 입장 QR" />}
            <p>QR을 찍거나, 도토에서 학생 코드를 입력해요.</p>
            <Button onClick={() => void copy(inviteUrl)}>
              <Copy size={16} />
              학생 입장 링크 복사
            </Button>
          </div>
        </Modal>
      )}
      {dialog === "disconnect" && (
        <Modal title="이 PC의 연결만 나갈까요?" onClose={() => setDialog(null)}>
          <div className="th-dialog-body">
            <div className="th-dialog-notice">
              <Tablet size={25} />
              <div>
                <strong>태블릿의 방은 계속 열려 있어요.</strong>
                <p>
                  학생들은 글쓰기와 게시를 이어 갈 수 있어요.
                  <br />
                  같은 교사용 입장코드로 다시 들어올 수 있어요.
                </p>
              </div>
            </div>
            <div className="th-dialog-actions">
              <Button onClick={() => setDialog(null)}>계속 보기</Button>
              <Button
                variant="primary"
                onClick={() => {
                  update({ teacherConnected: false });
                  setCodeInput("");
                  go("join");
                  setToast(
                    "PC 연결을 나간 상태예요. 서버 태블릿의 방은 열려 있어요.",
                  );
                }}
              >
                PC 연결 나가기
                <LogOut size={16} />
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {dialog === "end" && (
        <Modal title="우리 반 수업을 마칠까요?" onClose={() => setDialog(null)}>
          <div className="th-dialog-body">
            <p>
              학생들과 선생님 PC의 연결이 모두 종료돼요.
              <br />
              학생들이 글쓰기를 마쳤는지 먼저 확인해 주세요.
            </p>
            <div className="th-dialog-notice">
              <Users size={22} />
              <span>
                현재 참여 학생 <strong>{room.studentCount}명</strong>
              </span>
            </div>
            <div className="th-dialog-actions">
              <Button onClick={() => setDialog(null)}>계속 수업하기</Button>
              <Button
                variant="danger"
                onClick={() => {
                  update({ active: false, teacherConnected: false });
                  go("host");
                }}
              >
                수업 마치기
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {dialog === "settings" && (
        <Modal
          title={hostDevice ? "서버 태블릿 관리" : "수업 연결 관리"}
          onClose={() => setDialog(null)}
        >
          <div className="th-dialog-body">
            <div className="th-setting-row">
              <span>
                <strong>새 학생 입장 잠금</strong>
                <small>이미 들어온 학생은 계속 참여할 수 있어요.</small>
              </span>
              <Toggle
                checked={room.locked}
                onChange={() => update({ locked: !room.locked })}
                label="새 학생 입장 잠금"
              />
            </div>
            {hostDevice && (
              <div className="th-setting-row">
                <span>
                  <strong>화면 켜 두기</strong>
                  <small>수업 중 화면이 꺼지지 않도록 유지해요.</small>
                </span>
                <Toggle
                  checked={room.keepScreen}
                  onChange={() => update({ keepScreen: !room.keepScreen })}
                  label="화면 켜 두기"
                />
              </div>
            )}
            <div className="th-setting-row">
              <span>
                <strong>교사용 입장코드 다시 만들기</strong>
                <small>이전 코드는 만료되고 교사 PC 연결도 해제돼요.</small>
              </span>
              <Button
                onClick={() => {
                  update({
                    teacherCode:
                      room.teacherCode === "73918426" ? "82649317" : "73918426",
                    teacherConnected: false,
                  });
                  setDialog(null);
                  setToast(
                    "교사용 입장코드를 다시 만들었어요. 서버 화면에서 확인할 수 있어요.",
                  );
                }}
              >
                재발급
              </Button>
            </div>
            <div className="th-dialog-actions">
              <Button variant="ghost" onClick={() => setDialog("end")}>
                수업 마치기
              </Button>
              <Button variant="primary" onClick={() => setDialog(null)}>
                완료
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal
          title="태블릿으로 열고, PC에서 함께해요"
          onClose={() => setDialog(null)}
        >
          <div className="th-dialog-body th-help-steps">
            <div>
              <span>1</span>
              <p>
                <strong>태블릿에서 방을 열어요.</strong>학생들과 같은 와이파이에
                연결하고, 수업이 끝날 때까지 켜 두세요.
              </p>
            </div>
            <div>
              <span>2</span>
              <p>
                <strong>선생님은 PC에서 들어와요.</strong>평소 쓰던 도토
                주소에서 교사용 입장코드를 입력해요.
              </p>
            </div>
            <div>
              <span>3</span>
              <p>
                <strong>학생은 학생 코드로 들어와요.</strong>글을 쓰고, 선생님의
                피드백을 받고, 친구의 글을 읽어요.
              </p>
            </div>
            <Button
              variant="primary"
              className="full-width"
              onClick={() => setDialog(null)}
            >
              알겠어요
            </Button>
          </div>
        </Modal>
      )}
      {dimmed && (
        <DimScreen
          title={room.title}
          count={room.studentCount}
          teacherConnected={room.teacherConnected}
          onClose={() => setDimmed(false)}
        />
      )}
    </div>
  );
}

function DimScreen({
  title,
  count,
  teacherConnected,
  onClose,
}: {
  title: string;
  count: number;
  teacherConnected: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="th-dim-screen"
      aria-labelledby="th-dim-title"
      onCancel={onClose}
    >
      <div className="th-dim-inner">
        <Moon size={35} strokeWidth={1.3} />
        <span className="eyebrow">서버용 태블릿 · 어두운 화면</span>
        <h1 id="th-dim-title">{title}</h1>
        <p>
          <span className="status-dot" />
          방을 열어 두고 있어요
        </p>
        <div className="th-dim-stats">
          <span>
            <Users size={18} />
            학생 {count}명
          </span>
          <span>
            <Laptop size={18} />
            {teacherConnected ? "교사 PC 연결됨" : "교사 PC 연결 대기"}
          </span>
        </div>
        <Button autoFocus onClick={onClose}>
          <Sun size={17} />
          밝은 화면으로 돌아가기
        </Button>
        <small>
          화면 유지 상태를 살펴보는 UI 시안이에요.
          <br />
          실제 화면 꺼짐 방지와 기기 연결은 적용되지 않아요.
        </small>
      </div>
    </dialog>
  );
}
