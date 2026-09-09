import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  CheckCheck,
  Copy,
  KeyRound,
  Laptop,
  Moon,
  PlugZap,
  QrCode,
  Sprout,
  Sun,
  Tablet,
  Users,
  Wifi,
} from "lucide-react";
import { Button } from "./ui";
import { UsageConsentNotice, UsageTermsLink } from "./UsageConsent";
import type { ClassroomState } from "./classroom";
import type { useHostDevice } from "./use-host-device";
import "./tablet-host-preview.css";

export const formattedCode = (code: string) =>
  `${code.slice(0, code.length / 2)} ${code.slice(code.length / 2)}`;
export function DimScreen({
  title,
  count,
  controllerCount,
  wakeState,
  onClose,
}: {
  title: string;
  count: number;
  controllerCount: number;
  wakeState: string;
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
      aria-labelledby="host-dim-title"
      onCancel={onClose}
    >
      <div className="th-dim-inner">
        <Moon size={35} strokeWidth={1.3} />
        <span className="eyebrow">서버용 태블릿 · 어두운 화면</span>
        <h1 id="host-dim-title">{title}</h1>
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
            교사 PC {controllerCount}대
          </span>
        </div>
        <Button autoFocus onClick={onClose}>
          <Sun size={17} />
          밝은 화면으로 돌아가기
        </Button>
        <small>
          화면 유지: {wakeState}
          <br />
          기기를 잠그거나 도토를 닫지 말아 주세요.
        </small>
      </div>
    </dialog>
  );
}
export function RoomStart({
  active,
  onOpen,
  onJoin,
}: {
  active: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  return (
    <main className="th-start">
      <div className="th-start-heading">
        <span className="eyebrow">
          <Sprout size={16} />
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
        <button className="th-entry th-entry-host" onClick={onOpen}>
          <span className="th-entry-top">
            <span className="th-device-icon">
              <Tablet size={29} strokeWidth={1.5} />
            </span>
          </span>
          <span className="th-step-label">서버용 기기</span>
          <h2>수업 열기</h2>
          <p>학생 와이파이에 연결된 기기로 수업을 시작해요.</p>
          <span className="th-entry-action">
            {active ? "서버 화면 돌아가기" : "이 태블릿으로 방 열기"}
            <ArrowRight size={20} />
          </span>
        </button>
        <button className="th-entry th-entry-student" onClick={onJoin}>
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
      <div className="usage-terms-footer">
        <UsageTermsLink />
      </div>
    </main>
  );
}
export function RoomSetup({
  busy,
  onStart,
  onBack,
}: {
  busy: boolean;
  onStart: (title: string) => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState("우리 반 글쓰기");
  return (
    <main className="th-setup th-page">
      <Button variant="ghost" className="th-back" onClick={onBack}>
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
                수업을 이어 주는 기기
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
            onStart(title);
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
                <small>방을 열면 화면 유지를 요청해요.</small>
              </span>
            </div>
          </div>
          <UsageConsentNotice id="create-usage-consent" action="방 열고 코드 받기" />
          <Button
            variant="primary"
            type="submit"
            className="full-width"
            aria-describedby="create-usage-consent"
            disabled={busy || !title.trim()}
          >
            {busy ? "수업을 여는 중…" : "방 열고 코드 받기"}
            <ArrowRight size={18} />
          </Button>
          <span className="th-form-footnote">
            교사용·학생용 코드로 같은 입장 화면에서 들어갈 수 있어요.
          </span>
        </form>
      </div>
    </main>
  );
}
export function HostRoom({
  state,
  device,
  onInvite,
  onScreen,
  onEnd,
  onCopy,
}: {
  state: ClassroomState;
  device: ReturnType<typeof useHostDevice>;
  onInvite: () => void;
  onScreen: () => void;
  onEnd: () => void;
  onCopy: (text: string) => void;
}) {
  const { lesson, session } = state;
  if (!lesson || !session) return null;
  const connected = state.status === "connected";
  return (
    <main className="th-page th-host">
      <div className="th-page-heading">
        <div>
          <span className="eyebrow">
            <span className={`status-dot ${connected ? "" : "offline"}`} />
            {lesson.ended ? "보관한 수업" : "수업을 열어 두고 있어요"}
          </span>
          <h1>{lesson.title}</h1>
          <p>이 태블릿에서도, 교사용 컴퓨터에서도 수업할 수 있어요.</p>
        </div>
        <Button onClick={onScreen}>
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
            <span>1</span>교사용 컴퓨터에서 이 코드를 입력해 주세요.
          </p>
          <div className="th-room-code">
            {!lesson.ended && session.teacherCode
              ? formattedCode(session.teacherCode)
              : "—"}
          </div>
          <div className="th-room-card-footer">
            <Button
              variant="ghost"
              onClick={() => onCopy(session.teacherCode!)}
              disabled={!connected || !session.teacherCode}
            >
              <Copy size={16} />
              교사용 코드 복사
            </Button>
            <span className="th-room-connection">
              <span
                className={`status-dot ${state.controllerCount ? "" : "offline"}`}
              />
              {state.controllerCount
                ? `PC 연결 ${state.controllerCount}대`
                : "PC 연결 대기"}
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
            <span>2</span>학생들에겐 이 코드를 안내해주세요.
          </p>
          <div className="th-room-code">
            {lesson.ended ? "—" : formattedCode(session.code)}
          </div>
          <div className="th-room-card-footer">
            <Button
              variant="ghost"
              disabled={!connected}
              onClick={() => onCopy(session.code)}
            >
              <Copy size={16} />
              학생용 코드 복사
            </Button>
            <Button variant="ghost" disabled={!connected} onClick={onInvite}>
              <QrCode size={16} />
              학생용 QR
            </Button>
          </div>
          {lesson.settings.locked && (
            <p className="th-room-locked">새 학생 입장이 잠겨 있어요.</p>
          )}
        </section>
      </div>
      <section className="th-host-status" aria-label="수업 상태">
        <div>
          <Users size={20} />
          <span>
            참여 학생
            <strong>
              {lesson.board.participants?.filter((p) => p.connected).length ??
                0}
              <small>명 연결</small>
            </strong>
          </span>
        </div>
        <div>
          <CheckCheck size={20} />
          <span>
            글 저장
            <strong>
              {state.saveState === "saved"
                ? "전달받은 글 저장됨"
                : state.saveState === "saving"
                  ? "저장 중…"
                  : "저장 확인 필요"}
            </strong>
          </span>
        </div>
        <div>
          <BatteryCharging size={22} />
          <span>
            배터리<strong>{device.battery ?? "기기에서 확인"}</strong>
          </span>
        </div>
        <div>
          <Sun size={20} />
          <span>
            화면 유지<strong>{device.wakeState}</strong>
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
            전체 글과 게시판을 보는 동안에도 방은 유지돼요. 잠시 내려놓을 때는
            화면을 어둡게 해 두세요.
          </p>
        </div>
        <Button onClick={() => device.setDimmed(true)} disabled={lesson.ended}>
          <Moon size={16} />
          어둡게 켜 두기
        </Button>
      </section>
      <div className="th-host-footer">
        <span>
          방을 연 지{" "}
          {Math.max(0, Math.floor((device.now - lesson.createdAt) / 60000))}분 ·{" "}
          {lesson.title}
        </span>
        <Button onClick={onEnd} disabled={lesson.ended}>
          수업 마치기
        </Button>
      </div>
    </main>
  );
}
