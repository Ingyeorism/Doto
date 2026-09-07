import * as Y from "yjs";
import * as sync from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { get, set, entries } from "idb-keyval";
import { DOMSerializer } from "@tiptap/pm/model";
import { initProseMirrorDoc } from "@tiptap/y-tiptap";
import { writingSchema } from "./editor-schema";
import { fromBase64, resolveAnchors, toBase64 } from "./collaboration";
import {
  pruneTrash,
  restoreTrash,
  trashGroup,
  type BoardState,
} from "./board-state";
import type {
  FeedbackSelection,
  StudentDoc,
  HelpRequest,
  BoardGroup,
  PostSort,
} from "./data";
import { filledSources, cleanGroup } from "./learning";
import { safeHtml } from "./safe-html";
import { createUuid } from "./uuid";
import { diagnostic, diagnosticClientId, errorFields } from "./diagnostics";

export type Role = "teacher" | "student";
export type Settings = {
  locked: boolean;
  observe: boolean;
  feedback: boolean;
  editing: boolean;
  comments: boolean;
};
export interface Member {
  id: number;
  name: string;
  token: string;
}
export interface Lesson {
  id: string;
  title: string;
  prompt: string;
  createdAt: number;
  ended: boolean;
  settings: Settings;
  board: BoardState;
  members: Member[];
}
export interface Session {
  role: Role;
  lessonId: string;
  code: string;
  token: string;
  id: number;
  name: string;
}
type AnchorRebase = {
  feedbackId: number;
  oldFrom: string;
  oldTo: string;
  relativeFrom: string;
  relativeTo: string;
};
export interface SavedLesson {
  lesson: Lesson;
  session: Session;
  documents: [number, Uint8Array][];
  anchorRebases?: [number, AnchorRebase[]][];
}
export interface ClassroomState {
  lesson: Lesson | null;
  session: Session | null;
  status: "idle" | "connecting" | "connected" | "offline" | "ended";
  message: string;
  error: string;
  saveState: "saved" | "saving" | "error";
  savedAt: number | null;
  presence: {
    docId: number;
    editing: boolean;
    selection?: FeedbackSelection;
  } | null;
}
type Peer = {
  id: number;
  diagnosticId: string;
  attemptId: string;
  startedAt: number;
  localCandidates: number;
  remoteCandidates: number;
  lastStatsAt: number;
  statsTimer?: ReturnType<typeof setInterval>;
  pc: RTCPeerConnection;
  channel?: RTCDataChannel;
  candidates: RTCIceCandidateInit[];
  queue: string[];
  timer?: ReturnType<typeof setTimeout>;
  chunks: Map<string, { parts: string[]; size: number; at: number }>;
  ready: boolean;
};
const defaultSettings = (): Settings => {
  try {
    return {
      locked: false,
      observe: false,
      feedback: true,
      editing: true,
      comments: true,
      ...JSON.parse(localStorage.getItem("doto.settings") || "{}"),
    };
  } catch {
    return {
      locked: false,
      observe: false,
      feedback: true,
      editing: true,
      comments: true,
    };
  }
};
const emptyBoard = (): BoardState => ({
  title: "우리 반 이야기",
  docs: [],
  posts: [],
  groups: [{ id: createUuid(), title: "우리 반 이야기", description: "" }],
  feedback: [],
  comments: {},
  participants: [],
  sort: "oldest",
  trash: [],
});
const id = () => {
  const n = new Uint32Array(2);
  crypto.getRandomValues(n);
  return n[0] * 2 ** 20 + (n[1] % 2 ** 20);
};
const sessionKey = (role: Role) => `doto.session.${role}`;
const savedKey = (s: Session) =>
  `doto.lesson.${s.role}.${s.lessonId}${s.role === "student" ? "." + s.id : ""}`;
export async function lessonHistory(): Promise<SavedLesson[]> {
  return (await entries())
    .filter(([k]) => String(k).startsWith("doto.lesson.teacher."))
    .map(([, v]) => v as SavedLesson)
    .sort((a, b) => b.lesson.createdAt - a.lesson.createdAt);
}

export class Classroom {
  state: ClassroomState = {
    lesson: null,
    session: null,
    status: "idle",
    message: "",
    error: "",
    saveState: "saved",
    savedAt: null,
    presence: null,
  };
  documents = new Map<number, Y.Doc>();
  private anchorRebases = new Map<number, AnchorRebase[]>();
  private rebasesSending = new Set<number>();
  private listeners = new Set<() => void>();
  private socket?: WebSocket;
  private peers = new Map<number, Peer>();
  private pending = new Map<
    string,
    {
      resolve: (v: any) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private saveTimer?: ReturnType<typeof setTimeout>;
  private broadcastTimer?: ReturnType<typeof setTimeout>;
  private joinTimer?: ReturnType<typeof setTimeout>;
  private serialSave = Promise.resolve();
  private revision = 0;
  private closed = false;
  private reconnectAttempt = false;
  private stun: string[] = [];
  private attemptId = createUuid();
  private signalQueue = Promise.resolve();
  private waitingSignals: any[] = [];
  private trace(event: string, fields: Record<string, unknown> = {}) {
    diagnostic(event, {
      attemptId: this.attemptId,
      role: this.state.session?.role,
      lessonId: this.state.session?.lessonId,
      ...fields,
    });
  }
  private tracePeer(
    event: string,
    peer: Peer,
    fields: Record<string, unknown> = {},
  ) {
    this.trace(event, {
      attemptId: peer.attemptId,
      peerId: peer.id,
      peerConnectionId: peer.diagnosticId,
      durationMs: Math.round(performance.now() - peer.startedAt),
      connectionState: peer.pc.connectionState,
      iceState: peer.pc.iceConnectionState,
      gatheringState: peer.pc.iceGatheringState,
      signalingState: peer.pc.signalingState,
      channelState: peer.channel?.readyState,
      ready: peer.ready,
      localCandidates: peer.localCandidates,
      remoteCandidates: peer.remoteCandidates,
      queuedCandidates: peer.candidates.length,
      queuedMessages: peer.queue.length,
      bufferedAmount: peer.channel?.bufferedAmount,
      ...fields,
    });
  }
  private async traceStats(peer: Peer) {
    peer.lastStatsAt = performance.now();
    const sampledState = {
      connectionState: peer.pc.connectionState,
      iceState: peer.pc.iceConnectionState,
      gatheringState: peer.pc.iceGatheringState,
      signalingState: peer.pc.signalingState,
    };
    try {
      const report = await peer.pc.getStats();
      if (peer.pc.connectionState === "closed") {
        this.tracePeer("peer.stats_failed", peer, { reason: "closed" });
        return;
      }
      let candidatePairs = 0,
        failedPairs = 0,
        succeededPairs = 0;
      let selected: any;
      report.forEach((s) => {
        if (s.type === "transport" && s.selectedCandidatePairId)
          selected = report.get(s.selectedCandidatePairId);
      });
      report.forEach((s) => {
        if (s.type !== "candidate-pair") return;
        candidatePairs++;
        if (s.state === "failed") failedPairs++;
        if (s.state === "succeeded") succeededPairs++;
        if (!selected && s.nominated) selected = s;
      });
      const local = selected && report.get(selected.localCandidateId);
      const remote = selected && report.get(selected.remoteCandidateId);
      this.tracePeer("peer.stats", peer, {
        ...sampledState,
        candidatePairs,
        failedPairs,
        succeededPairs,
        pairState: selected?.state,
        nominated: selected?.nominated,
        bytesSent: selected?.bytesSent,
        bytesReceived: selected?.bytesReceived,
        rttMs: selected?.currentRoundTripTime * 1000,
        localCandidateType: local?.candidateType,
        remoteCandidateType: remote?.candidateType,
        protocol: local?.protocol,
      });
    } catch (error) {
      this.tracePeer("peer.stats_failed", peer, errorFields(error));
    }
  }
  private traceRemoteCandidate(peer: Peer, candidate: RTCIceCandidateInit) {
    peer.remoteCandidates++;
    try {
      const info = new RTCIceCandidate(candidate);
      this.tracePeer("ice.candidate", peer, {
        remoteCandidateType: info.type,
        protocol: info.protocol,
      });
    } catch (error) {
      this.tracePeer("signal.failed", peer, {
        reason: "parse",
        ...errorFields(error),
      });
    }
  }
  publicUrl = location.origin;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = () => this.state;
  private emit(patch: Partial<ClassroomState> = {}) {
    if (patch.status && patch.status !== this.state.status)
      this.trace("classroom.status", {
        previousStatus: this.state.status,
        status: patch.status,
      });
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((f) => f());
  }
  private get lesson() {
    if (!this.state.lesson) throw Error("먼저 수업을 열어 주세요.");
    return this.state.lesson;
  }
  private get session() {
    if (!this.state.session) throw Error("먼저 수업에 입장해 주세요.");
    return this.state.session;
  }
  private remember() {
    try {
      localStorage.setItem(
        sessionKey(this.session.role),
        JSON.stringify(this.session),
      );
      if (this.session.role === "student")
        localStorage.setItem(
          `doto.student.${this.session.lessonId}`,
          JSON.stringify(this.session),
        );
    } catch (error) {
      this.trace("storage.failed", errorFields(error));
      this.emit({
        error:
          "재입장 정보를 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.",
      });
    }
  }
  private changed(broadcast = true) {
    this.revision++;
    this.emit({ lesson: { ...this.lesson }, saveState: "saving" });
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), 120);
    if (broadcast && this.session.role === "teacher" && !this.broadcastTimer)
      this.broadcastTimer = setTimeout(() => {
        this.broadcastTimer = undefined;
        for (const peer of this.peers.values())
          if (peer.ready) this.sendSnapshot(peer);
      }, 120);
  }
  async flush() {
    clearTimeout(this.saveTimer);
    if (!this.state.lesson || !this.state.session) return;
    const rev = this.revision;
    const retained = pruneTrash(this.lesson.board.trash);
    if (retained.length !== this.lesson.board.trash.length) {
      this.lesson.board.trash = retained;
      this.emit({ lesson: { ...this.lesson } });
    }
    const activeIds = new Set(
      [
        ...this.lesson.board.docs,
        ...this.lesson.board.trash.flatMap((t) => t.docs),
      ].map((d) => d.id),
    );
    for (const [i, y] of this.documents)
      if (!activeIds.has(i)) {
        y.destroy();
        this.documents.delete(i);
      }
    const record: SavedLesson = structuredClone({
      lesson: this.lesson,
      session: this.session,
      anchorRebases: [...this.anchorRebases],
      documents: [...this.documents]
        .filter(([i]) => activeIds.has(i))
        .map(([i, y]) => [i, Y.encodeStateAsUpdate(y)]),
    });
    const key = savedKey(this.session);
    this.serialSave = this.serialSave.then(async () => {
      try {
        await set(key, record);
        if (this.state.saveState === "error")
          this.trace("storage.saved", {
            revision: rev,
            documentCount: record.documents.length,
          });
        if (rev === this.revision)
          this.emit({ saveState: "saved", savedAt: Date.now() });
      } catch (error) {
        this.trace("storage.failed", errorFields(error));
        this.emit({
          saveState: "error",
          error:
            "이 기기에 저장하지 못했어요. 결과를 내보내거나 글을 복사해 주세요.",
        });
      }
    });
    await this.serialSave;
  }
  private load(record: SavedLesson) {
    this.anchorRebases = new Map(record.anchorRebases || []);
    this.rebasesSending.clear();
    for (const y of this.documents.values()) y.destroy();
    this.documents.clear();
    record.lesson.board.trash = pruneTrash(record.lesson.board.trash);
    record.lesson.board.participants = (
      record.lesson.board.participants || []
    ).map((p) => ({ ...p, connected: false }));
    record.lesson.board.docs = record.lesson.board.docs.map((d) => ({
      ...d,
      connected: d.studentId === -1,
    }));
    this.emit({
      lesson: record.lesson,
      session: record.session,
      status: record.lesson.ended ? "ended" : "offline",
      presence: null,
      error: "",
    });
    for (const [i, bytes] of record.documents) this.registerDoc(i, bytes);
    for (const message of this.waitingSignals.splice(0))
      this.queueSignal(message);
  }
  async restore(role: Role) {
    const raw = localStorage.getItem(sessionKey(role));
    if (!raw) return false;
    try {
      const session = JSON.parse(raw) as Session;
      const record = await get<SavedLesson>(savedKey(session));
      if (!record) return false;
      record.session = session;
      this.load(record);
      if (!record.lesson.ended) await this.reconnect();
      return true;
    } catch (e) {
      this.fail(e);
      return !!this.state.lesson;
    }
  }
  async start(record?: SavedLesson) {
    await this.disconnect();
    const lesson = record?.lesson ?? {
      id: createUuid(),
      title: "우리 반 글쓰기",
      prompt: "",
      createdAt: Date.now(),
      ended: false,
      settings: defaultSettings(),
      board: emptyBoard(),
      members: [],
    };
    lesson.ended = false;
    const session: Session = record?.session ?? {
      role: "teacher",
      lessonId: lesson.id,
      code: "",
      token: "",
      id: -1,
      name: "선생님",
    };
    this.load(
      record
        ? { ...record, lesson, session }
        : { lesson, session, documents: [] },
    );
    await this.reconnect();
    await this.flush();
  }
  async view(record: SavedLesson) {
    await this.disconnect();
    this.load(record);
    this.emit({ status: "ended" });
  }
  async join(code: string, name: string, fresh = false) {
    await this.disconnect();
    this.attemptId = createUuid();
    this.trace("join.start", { role: "student" });
    this.emit({
      lesson: null,
      session: null,
      status: "connecting",
      error: "",
      message: "수업에 들어가는 중이에요…",
    });
    await this.openSocket();
    // The code resolves a lesson first. Saved credentials are selected by code or supplied lesson link.
    const requestedLesson = (await this.rpcSignal({ type: "lookup", code }))
      .lessonId as string;
    let previous: Session | undefined;
    if (!fresh) {
      if (requestedLesson)
        previous =
          JSON.parse(
            localStorage.getItem(`doto.student.${requestedLesson}`) || "null",
          ) || undefined;
      if (!previous)
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)!;
          if (k.startsWith("doto.student.")) {
            const s = JSON.parse(localStorage.getItem(k)!);
            if (s.code === code) previous = s;
          }
        }
    }
    // Discovering a reopened class by code can retry with its saved credential before creating a new participant.
    const reply = await this.rpcSignal({
      type: "join",
      code,
      name,
      token: previous?.token,
    });
    const session: Session = {
      role: "student",
      lessonId: reply.lessonId,
      code,
      token: reply.token,
      id: reply.id,
      name: reply.name,
    };
    const saved = await get<SavedLesson>(savedKey(session));
    this.load(
      saved
        ? { ...saved, session }
        : {
            session,
            lesson: {
              id: reply.lessonId,
              title: "우리 반 글쓰기",
              prompt: "",
              createdAt: Date.now(),
              ended: false,
              settings: defaultSettings(),
              board: { ...emptyBoard(), groups: [] },
              members: [],
            },
            documents: [],
          },
    );
    this.remember();
    this.emit({ status: "connecting", message: "선생님과 연결하는 중이에요…" });
    this.startJoinTimeout();
    if (reply.teacherOnline === false)
      this.emit({
        message:
          "선생님 화면이 연결되어 있지 않아요. 선생님이 수업 화면을 다시 열면 연결할 수 있어요.",
      });
  }
  private startJoinTimeout() {
    clearTimeout(this.joinTimer);
    this.joinTimer = setTimeout(() => {
      if (this.state.status === "connecting") {
        this.trace("join.timeout", { durationMs: 20000 });
        for (const peer of this.peers.values()) void this.traceStats(peer);
        this.emit({
          status: "offline",
          message:
            "선생님과 연결하지 못했어요. 선생님 화면과 네트워크를 확인하고 다시 시도해 주세요.",
        });
      }
    }, 20000);
  }
  private async openSocket() {
    this.closed = false;
    this.trace("config.start");
    const config = await fetch("/api/config", {
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => {
        if (!r.ok) throw Error("수업 안내소에 연결하지 못했어요.");
        return r.json();
      })
      .catch((error) => {
        this.trace("config.failed", errorFields(error));
        throw error;
      });
    this.stun = config.stun.filter((s: string) => s.startsWith("stun:"));
    this.publicUrl = config.publicUrl || location.origin;
    this.trace("config.ok", { stunServers: this.stun.length });
    if (this.socket?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/signal`,
    );
    this.socket = ws;
    this.trace("socket.opening");
    ws.onmessage = (e) => {
      if (this.socket !== ws || this.closed) return;
      try {
        const m = JSON.parse(e.data);
        this.trace("signal.receive", {
          messageType: m.type,
          requestId: m.requestId,
          descriptionType: m.description?.type,
          hasCandidate: !!m.candidate,
        });
        // Responses must resolve immediately; SDP and ICE operations run in order.
        if (m.type === "result") this.result(m);
        else this.queueSignal(m);
      } catch (error) {
        this.fail(error);
      }
    };
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.trace("socket.timeout", { durationMs: 10000 });
        ws.close();
        reject(Error("수업 안내소에 연결하지 못했어요. 다시 시도해 주세요."));
      }, 10000);
      ws.onopen = () => {
        this.trace("socket.open");
        clearTimeout(timer);
        resolve();
      };
      ws.onerror = () => {
        this.trace("socket.error");
        clearTimeout(timer);
        reject(Error("수업 안내소에 연결하지 못했어요."));
      };
      ws.onclose = (event) => {
        clearTimeout(timer);
        this.trace("socket.close", { code: event.code, clean: event.wasClean });
        reject(Error("수업 안내소와 연결이 끊겼어요. 다시 시도해 주세요."));
      };
    });
    ws.onclose = (event) => {
      this.trace("socket.close", {
        code: event.code,
        clean: event.wasClean,
        intentional: this.socket !== ws || this.closed,
      });
      if (this.socket !== ws || this.closed) return;
      this.signalJoined = false;
      if (!this.reconnectAttempt && this.state.lesson && !this.lesson.ended) {
        this.reconnectAttempt = true;
        setTimeout(() => {
          if (!this.closed)
            void this.reconnect(false).catch((e) => this.fail(e));
        }, 1000);
      } else
        this.emit({
          message:
            "새 입장 연결이 끊겼어요. 이미 연결된 글쓰기는 계속할 수 있어요.",
        });
    };
  }
  async reconnect(reset = true) {
    if (!this.state.session) return;
    this.attemptId = createUuid();
    this.trace("reconnect.start", { reset });
    if (reset) {
      this.reconnectAttempt = false;
      for (const p of [...this.peers.values()]) this.closePeer(p);
      const old = this.socket;
      this.socket = undefined;
      old?.close();
      this.signalJoined = false;
    }
    this.emit({
      status: "connecting",
      error: "",
      message: "수업에 다시 연결하는 중이에요…",
    });
    await this.openSocket();
    if (this.session.role === "teacher") {
      const r = await this.rpcSignal({
        type: "create",
        lessonId: this.lesson.id,
        token: this.session.token,
        locked: this.lesson.settings.locked,
        members: this.lesson.members,
      });
      this.emit({
        session: { ...this.session, code: r.code, token: r.token },
        status: "connected",
        message: "",
      });
      this.lesson.ended = false;
      this.remember();
      this.changed();
    } else {
      // A live signaling socket already belongs to this participant.
      if (
        reset &&
        this.socket?.readyState === WebSocket.OPEN &&
        this.peers.size === 0 &&
        this.signalJoined
      )
        this.sendSignal({ type: "retry" });
      else {
        const r = await this.rpcSignal({
          type: "join",
          code: this.session.code,
          token: this.session.token,
          name: this.session.name,
        });
        this.emit({
          session: { ...this.session, token: r.token, id: r.id, name: r.name },
        });
        this.remember();
      }
      this.startJoinTimeout();
    }
  }
  private signalJoined = false;
  private sendSignal(m: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.trace("signal.send", {
        messageType: m.type,
        requestId: m.requestId,
        descriptionType: m.description?.type,
        hasCandidate: !!m.candidate,
      });
      this.socket.send(
        JSON.stringify({
          ...m,
          clientId: diagnosticClientId,
          attemptId: this.attemptId,
        }),
      );
    } else
      this.trace("signal.dropped", {
        messageType: m.type,
        reason: "socket-close",
      });
  }
  private rpcSignal(m: any): Promise<any> {
    const startedAt = performance.now();
    this.trace("rpc.start", { messageType: m.type });
    return this.request((requestId) => this.sendSignal({ ...m, requestId }))
      .then((r) => {
        this.trace("rpc.ok", {
          messageType: m.type,
          requestId: r.requestId,
          roomId: r.roomId,
          durationMs: Math.round(performance.now() - startedAt),
        });
        if (m.type === "join" || m.type === "create") this.signalJoined = true;
        return r;
      })
      .catch((error) => {
        this.trace("rpc.failed", {
          messageType: m.type,
          durationMs: Math.round(performance.now() - startedAt),
          ...errorFields(error),
        });
        throw error;
      });
  }
  private request(send: (requestId: string) => void): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = createUuid();
      const timer = setTimeout(() => {
        this.trace("rpc.timeout", { requestId, durationMs: 20000 });
        this.pending.delete(requestId);
        reject(Error("응답이 없어요. 연결 후 다시 시도해 주세요."));
      }, 20000);
      this.pending.set(requestId, { resolve, reject, timer });
      try {
        send(requestId);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(error);
      }
    });
  }
  private result(m: any) {
    const p = this.pending.get(m.requestId);
    if (p) {
      clearTimeout(p.timer);
      this.pending.delete(m.requestId);
      m.error ? p.reject(Error(m.error)) : p.resolve(m);
    }
  }
  private queueSignal(m: any) {
    if (this.closed) return;
    if (!this.state.session) {
      if (this.waitingSignals.length < 500) this.waitingSignals.push(m);
      return;
    }
    const socket = this.socket;
    this.signalQueue = this.signalQueue
      .then(async () => {
        if (this.socket !== socket || this.closed) return;
        await this.signal(m);
      })
      .catch((error) => {
        this.trace("signal.failed", {
          messageType: m.type,
          descriptionType: m.description?.type,
          ...errorFields(error),
        });
        if (this.socket === socket && !this.closed) this.fail(error);
      });
  }
  private async signal(m: any) {
    if (m.type === "result") return this.result(m);
    if (m.type === "ended") return this.receiveEnd();
    if (m.type === "replaced") {
      this.closed = true;
      for (const p of [...this.peers.values()]) this.closePeer(p);
      return this.emit({
        status: "offline",
        message:
          "다른 탭에서 같은 수업을 열었어요. 이 탭에서는 다시 연결을 눌러 이어갈 수 있어요.",
      });
    }
    if (m.type === "peer" && this.session.role === "teacher") {
      const member: Member = { id: m.id, name: m.name, token: m.token };
      if (!this.lesson.members.some((p) => p.id === member.id))
        this.lesson.members.push(member);
      if (!this.lesson.board.participants!.some((p) => p.id === m.id))
        this.lesson.board.participants!.push({
          id: m.id,
          name: m.name,
          connected: false,
          joinedAt: Date.now(),
        });
      this.changed();
      const peer = this.makePeer(m.id);
      this.attachChannel(peer, peer.pc.createDataChannel("doto"));
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      this.tracePeer("rtc.description", peer, { descriptionType: "offer" });
      this.sendSignal({
        type: "signal",
        to: m.id,
        description: peer.pc.localDescription,
      });
    }
    if (m.type === "teacher-ready" && this.session.role === "student") {
      this.emit({
        status: "connecting",
        message: "선생님과 다시 연결하는 중이에요…",
      });
      this.startJoinTimeout();
    }
    if (m.type === "signal") {
      const peerId = this.session.role === "student" ? -1 : m.from;
      let peer = this.peers.get(peerId);
      // Trickle ICE can arrive before the offer. Keep those candidates on the same peer.
      if (
        m.description?.type === "offer" &&
        (!peer || peer.pc.remoteDescription)
      )
        peer = this.makePeer(peerId);
      if (!peer) {
        if (m.candidate) {
          peer = this.makePeer(peerId);
          peer.candidates.push(m.candidate);
          this.traceRemoteCandidate(peer, m.candidate);
        }
        return;
      }
      if (m.description) {
        await peer.pc.setRemoteDescription(m.description);
        this.tracePeer("rtc.description", peer, {
          descriptionType: m.description.type,
        });
        for (const candidate of peer.candidates.splice(0))
          await peer.pc.addIceCandidate(candidate);
        if (m.description.type === "offer") {
          await peer.pc.setLocalDescription(await peer.pc.createAnswer());
          this.sendSignal({
            type: "signal",
            to: peerId,
            description: peer.pc.localDescription,
          });
        }
      } else if (m.candidate) {
        this.traceRemoteCandidate(peer, m.candidate);
        if (peer.pc.remoteDescription)
          await peer.pc.addIceCandidate(m.candidate);
        else peer.candidates.push(m.candidate);
      }
    }
  }
  private makePeer(peerId: number): Peer {
    const old = this.peers.get(peerId);
    if (old) this.closePeer(old, "replaced");
    const pc = new RTCPeerConnection({
      iceServers: this.stun.length ? [{ urls: this.stun }] : [],
    });
    const peer: Peer = {
      id: peerId,
      diagnosticId: createUuid(),
      attemptId: this.attemptId,
      startedAt: performance.now(),
      localCandidates: 0,
      remoteCandidates: 0,
      lastStatsAt: 0,
      pc,
      candidates: [],
      queue: [],
      chunks: new Map(),
      ready: false,
    };
    this.peers.set(peerId, peer);
    this.tracePeer("peer.created", peer);
    // Failed attempts often end before 20 seconds. Capture evidence while ICE is alive.
    peer.statsTimer = setInterval(() => {
      if (!peer.ready || performance.now() - peer.lastStatsAt >= 30000)
        void this.traceStats(peer);
    }, 5000);
    peer.timer = setTimeout(() => {
      if (!peer.ready) {
        this.tracePeer("peer.timeout", peer);
        this.closePeer(peer, "timeout");
        if (this.session.role === "student")
          this.emit({
            status: "offline",
            message:
              "선생님과 연결하지 못했어요. 선생님 화면과 네트워크를 확인하고 다시 시도해 주세요.",
          });
      }
    }, 20000);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        peer.localCandidates++;
        this.tracePeer("ice.candidate", peer, {
          candidateType: e.candidate.type,
          protocol: e.candidate.protocol,
        });
        this.sendSignal({
          type: "signal",
          to: peerId,
          candidate: e.candidate.toJSON(),
        });
      }
    };
    pc.onicecandidateerror = (e) =>
      this.tracePeer("ice.error", peer, { code: e.errorCode });
    pc.oniceconnectionstatechange = () => {
      this.tracePeer("ice.state", peer);
      if (["failed", "disconnected"].includes(pc.iceConnectionState))
        void this.traceStats(peer);
    };
    pc.onicegatheringstatechange = () => this.tracePeer("ice.gathering", peer);
    pc.onsignalingstatechange = () => this.tracePeer("rtc.signaling", peer);
    pc.ondatachannel = (e) => this.attachChannel(peer, e.channel);
    pc.onconnectionstatechange = () => {
      this.tracePeer("rtc.state", peer);
      if (["failed", "closed"].includes(pc.connectionState))
        this.closePeer(peer, pc.connectionState);
      else if (pc.connectionState === "disconnected") {
        clearTimeout(peer.timer);
        peer.timer = setTimeout(() => {
          if (pc.connectionState === "disconnected")
            this.closePeer(peer, "disconnected");
        }, 5000);
      } else if (pc.connectionState === "connected" && peer.ready)
        clearTimeout(peer.timer);
    };
    return peer;
  }
  private closePeer(peer: Peer, reason = "manual") {
    if (this.peers.get(peer.id) !== peer) return;
    this.tracePeer("peer.closed", peer, { reason });
    void this.traceStats(peer);
    this.peers.delete(peer.id);
    clearTimeout(peer.timer);
    clearInterval(peer.statsTimer);
    peer.pc.close();
    if (!this.state.lesson || this.closed) return;
    if (this.session.role === "teacher") {
      this.connection(peer.id, false);
    } else {
      this.emit({
        status: this.lesson.ended ? "ended" : "offline",
        presence: null,
        message: this.lesson.ended
          ? "수업이 끝났어요. 내 글은 이 기기에 남아 있어요."
          : "선생님과 연결이 끊겼어요. 글은 계속 쓰고, 다시 연결할 수 있어요.",
      });
    }
  }
  private connection(studentId: number, connected: boolean) {
    this.lesson.board.participants = this.lesson.board.participants!.map((p) =>
      p.id === studentId ? { ...p, connected } : p,
    );
    this.lesson.board.docs = this.lesson.board.docs.map((d) =>
      d.studentId === studentId ? { ...d, connected } : d,
    );
    this.changed();
  }
  private attachChannel(peer: Peer, channel: RTCDataChannel) {
    peer.channel = channel;
    channel.bufferedAmountLowThreshold = 128 * 1024;
    channel.onbufferedamountlow = () => this.drain(peer);
    channel.onclose = () => {
      this.tracePeer("channel.close", peer);
      this.closePeer(peer, "channel-close");
    };
    channel.onerror = () => {
      this.tracePeer("channel.error", peer);
      this.closePeer(peer, "channel-error");
    };
    channel.onopen = () => {
      this.tracePeer("channel.open", peer);
      void this.traceStats(peer);
      peer.ready = true;
      clearTimeout(peer.timer);
      clearTimeout(this.joinTimer);
      if (this.session.role === "teacher") {
        this.connection(peer.id, true);
        this.sendSnapshot(peer);
        for (const d of this.lesson.board.docs.filter(
          (d) => d.studentId === peer.id,
        ))
          this.syncDoc(peer, d.id);
      } else {
        this.emit({ status: "connected", message: "" });
        // Exchange both state vectors on reconnection, including open editors.
        for (const d of this.lesson.board.docs) this.syncDoc(peer, d.id);
      }
      this.drain(peer);
    };
    channel.onmessage = (e) => {
      try {
        const packet = JSON.parse(e.data);
        if (packet.type === "chunk") {
          if (typeof packet.text !== "string" || packet.text.length > 14000)
            return;
          const chunk = peer.chunks.get(packet.id) ?? {
            parts: [],
            size: 0,
            at: Date.now(),
          };
          chunk.parts.push(packet.text);
          chunk.size += packet.text.length;
          if (chunk.size > 16 * 1024 * 1024) {
            peer.chunks.delete(packet.id);
            return;
          }
          peer.chunks.set(packet.id, chunk);
          for (const [key, value] of peer.chunks)
            if (Date.now() - value.at > 30000) peer.chunks.delete(key);
          if (packet.last) {
            peer.chunks.delete(packet.id);
            this.receive(peer, JSON.parse(chunk.parts.join("")));
          }
        } else this.receive(peer, packet);
      } catch (error) {
        this.tracePeer("channel.receive_failed", peer, errorFields(error));
        this.emit({ error: "받은 자료를 읽지 못했어요. 다시 연결해 주세요." });
      }
    };
  }
  private send(peer: Peer, message: any) {
    if (!peer.ready) return;
    const raw = JSON.stringify(message);
    if (raw.length <= 12000) peer.queue.push(raw);
    else {
      const key = createUuid();
      for (let i = 0; i < raw.length; i += 12000)
        peer.queue.push(
          JSON.stringify({
            type: "chunk",
            id: key,
            text: raw.slice(i, i + 12000),
            last: i + 12000 >= raw.length,
          }),
        );
    }
    this.drain(peer);
  }
  private drain(peer: Peer) {
    const c = peer.channel;
    if (!c || c.readyState !== "open") return;
    while (peer.queue.length && c.bufferedAmount < 256 * 1024)
      c.send(peer.queue.shift()!);
  }
  private sendSnapshot(peer: Peer) {
    const b = this.lesson.board;
    this.send(peer, {
      type: "board",
      lesson: {
        ...this.lesson,
        members: [],
        board: {
          ...b,
          trash: [],
          participants: b.participants!.filter((p) => p.id === peer.id),
          docs: b.docs
            .filter((d) => d.studentId === peer.id)
            .map((d) => ({
              ...d,
              html: undefined,
              paragraphs: [],
              title: "",
              sources: [],
            })),
          feedback: b.feedback.filter((f) => f.studentId === peer.id),
        },
      },
    });
  }
  private syncDoc(peer: Peer, docId: number) {
    const y = this.documents.get(docId);
    if (!y) return;
    const encoder = encoding.createEncoder();
    sync.writeSyncStep1(encoder, y);
    this.send(peer, {
      type: "sync",
      docId,
      data: toBase64(encoding.toUint8Array(encoder)),
    });
  }
  private receive(peer: Peer, m: any) {
    if (m.type === "result") {
      if (this.session.role === "student") this.result(m);
      return;
    }
    if (m.type === "sync") {
      const doc = this.lesson.board.docs.find((d) => d.id === m.docId);
      if (
        !doc ||
        (this.session.role === "teacher"
          ? doc.studentId !== peer.id
          : doc.studentId !== this.session.id)
      )
        return;
      const y = this.documents.get(doc.id) ?? this.registerDoc(doc.id);
      const encoder = encoding.createEncoder();
      sync.readSyncMessage(
        decoding.createDecoder(fromBase64(m.data)),
        encoder,
        y,
        peer,
      );
      if (encoding.length(encoder))
        this.send(peer, {
          type: "sync",
          docId: doc.id,
          data: toBase64(encoding.toUint8Array(encoder)),
        });
      if (this.session.role === "student") this.sendRebases(peer, doc.id);
    } else if (this.session.role === "teacher" && m.type === "action") {
      try {
        const value = this.applyAction(peer.id, m.action);
        this.sendSnapshot(peer);
        this.send(peer, { type: "result", requestId: m.requestId, value });
      } catch (e) {
        this.send(peer, {
          type: "result",
          requestId: m.requestId,
          error: e instanceof Error ? e.message : "요청을 처리하지 못했어요.",
        });
      }
    } else if (this.session.role === "student" && m.type === "board") {
      const next = m.lesson as Lesson;
      if (next.id !== this.lesson.id) return;
      const oldFeedback = this.lesson.board.feedback.length;
      this.state = { ...this.state, lesson: next };
      for (const [docId, changes] of this.anchorRebases)
        this.rebaseLocal(docId, changes);
      for (const d of next.board.docs) {
        const existed = this.documents.has(d.id);
        if (!existed) this.registerDoc(d.id);
        this.project(d.id);
        if (!existed) this.syncDoc(peer, d.id);
      }
      if (next.settings.feedback && next.board.feedback.length > oldFeedback)
        this.emit({ message: "선생님이 새 피드백을 남겼어요." });
      if (
        !next.settings.feedback &&
        this.state.message === "선생님이 새 피드백을 남겼어요."
      )
        this.emit({ message: "" });
      this.changed(false);
    } else if (this.session.role === "student" && m.type === "presence")
      this.emit({ presence: m.presence });
    else if (this.session.role === "student" && m.type === "ended")
      this.receiveEnd();
  }
  private registerDoc(docId: number, bytes?: Uint8Array) {
    const y = new Y.Doc({ gc: false });
    if (bytes) Y.applyUpdate(y, bytes);
    this.documents.set(docId, y);
    y.on("update", (update: Uint8Array, origin: any) => {
      this.project(docId);
      this.changed(false);
      const owner = this.lesson.board.docs.find(
        (d) => d.id === docId,
      )?.studentId;
      const peer = this.peers.get(
        this.session.role === "teacher" ? owner! : -1,
      );
      if (peer && peer !== origin) {
        const encoder = encoding.createEncoder();
        sync.writeUpdate(encoder, update);
        this.send(peer, {
          type: "sync",
          docId,
          data: toBase64(encoding.toUint8Array(encoder)),
        });
      }
    });
    this.project(docId);
    return y;
  }
  private project(docId: number) {
    const y = this.documents.get(docId);
    if (!y || !this.state.lesson) return;
    const meta = y.getMap("meta");
    const { doc, mapping } = initProseMirrorDoc(
      y.getXmlFragment("body"),
      writingSchema,
    );
    const container = document.createElement("div");
    container.append(
      DOMSerializer.fromSchema(writingSchema).serializeFragment(doc.content),
    );
    const patch = (d: StudentDoc) => ({
      ...d,
      title: String(meta.get("title") || "").slice(0, 300),
      sources: Array.isArray(meta.get("sources"))
        ? (meta.get("sources") as StudentDoc["sources"])
        : [],
      html: safeHtml(container.innerHTML || "<p></p>"),
      paragraphs: doc.textBetween(0, doc.content.size, "\n", "\n").split("\n"),
      anchors: resolveAnchors(y, d.anchors, mapping),
      updated: new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
    this.lesson.board.docs = this.lesson.board.docs.map((d) =>
      d.id === docId ? patch(d) : d,
    );
  }
  updateDoc(docId: number, changes: Partial<StudentDoc>) {
    const d = this.lesson.board.docs.find((d) => d.id === docId);
    if (
      !d ||
      (this.session.role === "student" && d.studentId !== this.session.id)
    )
      return;
    if (changes.groupId && this.session.role === "teacher") {
      this.applyAction(-1, { type: "move", docId, groupId: changes.groupId });
    }
    const y = this.documents.get(docId);
    if (!y) return;
    y.transact(() => {
      if (
        changes.title !== undefined &&
        changes.title !== y.getMap("meta").get("title")
      )
        y.getMap("meta").set("title", changes.title.slice(0, 300));
      if (changes.sources !== undefined)
        y.getMap("meta").set(
          "sources",
          changes.sources.slice(0, 20).map((s) => ({
            institution: String(s.institution || ""),
            title: String(s.title || ""),
            date: String(s.date || ""),
            url: String(s.url || ""),
          })),
        );
    });
    // Body is updated only by the Yjs editor binding, never by HTML replacement.
  }
  private rebaseLocal(docId: number, changes: AnchorRebase[]) {
    const doc = this.lesson.board.docs.find((d) => d.id === docId);
    if (!doc) return;
    doc.anchors = doc.anchors.map((a) => {
      const next = changes.find((n) => n.feedbackId === a.feedbackId);
      return next
        ? { ...a, relativeFrom: next.relativeFrom, relativeTo: next.relativeTo }
        : a;
    });
  }
  rebaseAnchors = (docId: number, anchors: AnchorRebase[]) => {
    if (this.session.role === "teacher") {
      this.applyAction(-1, { type: "rebase-anchors", docId, anchors });
      return;
    }
    const current = this.anchorRebases.get(docId) || [];
    const merged = anchors.map((a) => {
      const old = current.find((x) => x.feedbackId === a.feedbackId);
      return old ? { ...a, oldFrom: old.oldFrom, oldTo: old.oldTo } : a;
    });
    const all = [
      ...current.filter(
        (a) => !merged.some((b) => a.feedbackId === b.feedbackId),
      ),
      ...merged,
    ];
    this.anchorRebases.set(docId, all);
    this.rebaseLocal(docId, all);
    this.project(docId);
    this.changed(false);
    const peer = this.peers.get(-1);
    if (peer?.ready) this.sendRebases(peer, docId);
  };
  private sendRebases(peer: Peer, docId: number) {
    const anchors = this.anchorRebases.get(docId);
    if (!anchors?.length || this.rebasesSending.has(docId)) return;
    this.rebasesSending.add(docId);
    void this.request((requestId) =>
      this.send(peer, {
        type: "action",
        requestId,
        action: { type: "rebase-anchors", docId, anchors },
      }),
    )
      .then(() => {
        if (this.anchorRebases.get(docId) === anchors)
          this.anchorRebases.delete(docId);
        else
          this.anchorRebases.set(
            docId,
            (this.anchorRebases.get(docId) || []).map((a) => {
              const sent = anchors.find((s) => s.feedbackId === a.feedbackId);
              return sent
                ? { ...a, oldFrom: sent.relativeFrom, oldTo: sent.relativeTo }
                : a;
            }),
          );
        this.changed(false);
      })
      .catch(() => {})
      .finally(() => this.rebasesSending.delete(docId));
  }
  action = async (action: any): Promise<any> => {
    if (this.session.role === "teacher") return this.applyAction(-1, action);
    const peer = this.peers.get(-1);
    if (!peer?.ready || this.lesson.ended)
      throw Error(
        "선생님과 연결한 뒤 다시 눌러 주세요. 내 글은 계속 쓸 수 있어요.",
      );
    return (
      await this.request((requestId) =>
        this.send(peer, { type: "action", action, requestId }),
      )
    ).value;
  };
  private applyAction(actor: number, a: any): any {
    const b = this.lesson.board;
    const teacher = actor === -1;
    const ownDoc = () => {
      const d = b.docs.find((d) => d.id === a.docId);
      if (!d || (!teacher && d.studentId !== actor))
        throw Error("내 원고에서만 할 수 있어요.");
      return d;
    };
    const requireTeacher = () => {
      if (!teacher) throw Error("선생님만 바꿀 수 있어요.");
    };
    let result: any;
    if (a.type === "create") {
      if (!b.groups.some((g) => g.id === a.groupId))
        throw Error("이 그룹은 사용할 수 없어요.");
      const docId = id();
      const name = teacher
        ? "선생님"
        : this.lesson.members.find((p) => p.id === actor)!.name;
      b.docs.push({
        id: docId,
        studentId: actor,
        groupId: a.groupId,
        name,
        title: "",
        html: "<p></p>",
        paragraphs: [],
        anchors: [],
        connected: true,
        published: false,
        createdAt: Date.now(),
        manualOrder: Date.now(),
        updated: "방금",
      });
      this.registerDoc(docId);
      result = docId;
    } else if (a.type === "publish") {
      const d = ownDoc();
      this.project(d.id);
      const current = b.docs.find((x) => x.id === d.id)!;
      if (!current.title.trim() || !current.paragraphs.join("").trim())
        throw Error("제목과 글을 적어 주세요.");
      const publishedAt = d.publishedAt || Date.now();
      const copy: StudentDoc = {
        ...current,
        sources: filledSources(current.sources),
        anchors: [],
        published: true,
        publishedAt,
      };
      b.posts = b.posts.some((p) => p.id === d.id)
        ? b.posts.map((p) => (p.id === d.id ? copy : p))
        : [...b.posts, copy];
      b.docs = b.docs.map((d) =>
        d.id === current.id ? { ...d, published: true, publishedAt } : d,
      );
    } else if (a.type === "unpublish") {
      const d = ownDoc();
      b.posts = b.posts.filter((p) => p.id !== d.id);
      b.docs = b.docs.map((p) =>
        p.id === d.id ? { ...p, published: false } : p,
      );
    } else if (a.type === "comment") {
      if (
        !b.posts.some((p) => p.id === a.docId) ||
        !this.lesson.settings.comments
      )
        throw Error("지금은 댓글을 쓸 수 없어요.");
      const text = String(a.text || "")
        .trim()
        .slice(0, 3000);
      if (!text) return;
      const name = teacher
        ? "선생님"
        : this.lesson.members.find((p) => p.id === actor)!.name;
      b.comments[a.docId] = [
        ...(b.comments[a.docId] || []),
        { id: createUuid(), studentId: actor, name, text },
      ];
    } else if (a.type === "delete-comment") {
      b.comments[a.docId] = (b.comments[a.docId] || []).filter(
        (c) => !(c.id === a.commentId && (teacher || c.studentId === actor)),
      );
    } else if (a.type === "message" || a.type === "read-messages") {
      const d = ownDoc();
      const participant = b.participants!.find((p) => p.id === d.studentId);
      if (!participant) throw Error("학생의 원고에서 메시지를 보내 주세요.");
      const sender = teacher ? "teacher" : "student";
      if (a.type === "message") {
        const text = String(a.text || "")
          .trim()
          .slice(0, 1000);
        if (!text) throw Error("메시지를 적어 주세요.");
        participant.messages = [
          ...(participant.messages || []),
          {
            id: createUuid(),
            docId: d.id,
            sender,
            text,
            createdAt: Date.now(),
          },
        ];
      } else {
        const ids = new Set(Array.isArray(a.ids) ? a.ids : []);
        participant.messages = (participant.messages || []).map((m) =>
          m.docId === d.id && m.sender !== sender && !m.readAt && ids.has(m.id)
            ? { ...m, readAt: Date.now() }
            : m,
        );
      }
    } else if (a.type === "help") {
      if (teacher) return;
      const h = a.help as HelpRequest | undefined;
      if (
        h?.docId !== undefined &&
        !b.docs.some((d) => d.id === h.docId && d.studentId === actor)
      )
        throw Error("내 원고에서 요청해 주세요.");
      b.participants = b.participants!.map((p) =>
        p.id === actor
          ? {
              ...p,
              help: h
                ? {
                    kind: h.kind === "move" ? "move" : "writing",
                    docId: h.docId,
                    targetGroupId: h.targetGroupId,
                    note: String(h.note || "").slice(0, 1000),
                    createdAt: Date.now(),
                  }
                : undefined,
            }
          : p,
      );
    } else if (a.type === "finish-help") {
      requireTeacher();
      const p = b.participants!.find((p) => p.id === a.studentId);
      if (p?.help && a.move && p.help.docId !== undefined)
        this.applyAction(-1, {
          type: "move",
          docId: p.help.docId,
          groupId: p.help.targetGroupId,
        });
      if (p) p.help = undefined;
    } else if (a.type === "feedback") {
      requireTeacher();
      const d = ownDoc();
      const fid = id();
      const selection = a.selection as FeedbackSelection | undefined;
      if (!String(a.message || "").trim()) return;
      b.feedback.push({
        id: fid,
        docId: d.id,
        studentId: d.studentId,
        message: String(a.message).trim().slice(0, 5000),
        quote: selection?.quote,
      });
      if (selection?.relativeFrom && selection.relativeTo)
        d.anchors = [
          ...d.anchors,
          { feedbackId: fid, ...selection, status: "active" },
        ];
      this.project(d.id);
    } else if (a.type === "rebase-anchors") {
      // Undo creates new CRDT item identities; its redone links are local to
      // the editor performing undo. Carry those identities to the teacher,
      // retaining the teacher's message and requiring the previous anchor.
      const d = ownDoc();
      const y = this.documents.get(d.id)!;
      for (const next of (a.anchors || []).slice(0, d.anchors.length)) {
        const old = d.anchors.find(
          (x) =>
            x.feedbackId === next.feedbackId &&
            x.relativeFrom === next.oldFrom &&
            x.relativeTo === next.oldTo,
        );
        if (
          !old ||
          typeof next.relativeFrom !== "string" ||
          typeof next.relativeTo !== "string"
        )
          continue;
        const resolved = resolveAnchors(y, [
          {
            ...old,
            relativeFrom: next.relativeFrom,
            relativeTo: next.relativeTo,
          },
        ])[0];
        if (resolved.status === "active") Object.assign(old, resolved);
      }
      this.project(d.id);
    } else if (a.type === "feedback-response") {
      const f = b.feedback.find((f) => f.id === a.id);
      if (
        !f ||
        (!teacher &&
          (f.studentId !== actor ||
            f.response === "confirmed" ||
            !["read", "revised", undefined].includes(a.response)))
      )
        throw Error("내 피드백에서 확인해 주세요.");
      f.response = a.response;
    } else {
      requireTeacher();
      if (a.type === "title")
        b.title = String(a.title).trim().slice(0, 150) || "우리 반 이야기";
      else if (a.type === "lesson") {
        this.lesson.title = String(a.title ?? this.lesson.title).slice(0, 150);
        this.lesson.prompt = String(a.prompt ?? this.lesson.prompt).slice(
          0,
          10000,
        );
      } else if (a.type === "settings") {
        this.lesson.settings = { ...this.lesson.settings, ...a.settings };
        localStorage.setItem(
          "doto.settings",
          JSON.stringify(this.lesson.settings),
        );
        this.sendSignal({ type: "lock", locked: this.lesson.settings.locked });
      } else if (a.type === "group") {
        const g = cleanGroup(a.group as BoardGroup);
        b.groups = b.groups.some((x) => x.id === g.id)
          ? b.groups.map((x) => (x.id === g.id ? g : x))
          : [...b.groups, g];
      } else if (a.type === "delete-group")
        this.lesson.board = trashGroup(b, a.groupId);
      else if (a.type === "restore")
        this.lesson.board = restoreTrash(b, a.id, a.docId);
      else if (a.type === "sort") b.sort = a.sort as PostSort;
      else if (a.type === "reorder-group") {
        const g = b.groups.find((g) => g.id === a.id);
        const index = b.groups.findIndex((g) => g.id === a.targetId);
        if (g && index >= 0) {
          b.groups = b.groups.filter((g) => g.id !== a.id);
          b.groups.splice(index, 0, g);
        }
      } else if (a.type === "move") {
        const d = ownDoc();
        if (!b.groups.some((g) => g.id === a.groupId))
          throw Error("그룹을 다시 골라 주세요.");
        const order = b.posts
          .filter((p) => p.id !== d.id && p.groupId === a.groupId)
          .sort((x, y) => x.manualOrder - y.manualOrder)
          .map((p) => p.id);
        const index = order.indexOf(a.beforeId);
        order.splice(index < 0 ? order.length : index, 0, d.id);
        const move = (items: StudentDoc[]) =>
          items.map((p) =>
            order.includes(p.id)
              ? { ...p, groupId: a.groupId, manualOrder: order.indexOf(p.id) }
              : p,
          );
        b.docs = move(b.docs);
        b.posts = move(b.posts);
      } else throw Error("알 수 없는 요청이에요.");
    }
    this.changed();
    return result;
  }
  presence = (
    docId: number,
    editing: boolean,
    selection?: FeedbackSelection,
  ) => {
    if (this.state.session?.role !== "teacher") return;
    const owner = this.lesson.board.docs.find((d) => d.id === docId)?.studentId;
    const peer = this.peers.get(owner!);
    if (peer)
      this.send(peer, {
        type: "presence",
        presence: { docId, editing, selection },
      });
  };
  clearPresence = (docId: number) => {
    const owner = this.state.lesson?.board.docs.find(
      (d) => d.id === docId,
    )?.studentId;
    const peer = this.peers.get(owner!);
    if (peer) this.send(peer, { type: "presence", presence: null });
  };
  async end() {
    if (this.session.role !== "teacher") return;
    this.lesson.ended = true;
    this.changed();
    await this.flush();
    for (const peer of this.peers.values()) this.send(peer, { type: "ended" });
    if (this.socket?.readyState === WebSocket.OPEN)
      await this.rpcSignal({ type: "end" });
    await this.disconnect();
    this.emit({ status: "ended" });
  }
  private receiveEnd() {
    this.lesson.ended = true;
    this.changed(false);
    clearTimeout(this.joinTimer);
    this.closed = true;
    for (const p of [...this.peers.values()]) this.closePeer(p);
    this.socket?.close();
    this.emit({
      status: "ended",
      presence: null,
      message: "수업이 끝났어요. 내 글은 이 기기에 남아 있어요.",
    });
  }
  async disconnect() {
    await this.flush();
    this.closed = true;
    this.signalJoined = false;
    this.waitingSignals = [];
    clearTimeout(this.joinTimer);
    for (const p of [...this.peers.values()]) this.closePeer(p);
    this.socket?.close();
    this.socket = undefined;
  }
  fail(e: unknown) {
    this.trace("classroom.error", errorFields(e));
    this.emit({
      error: e instanceof Error ? e.message : "요청을 처리하지 못했어요.",
      ...(this.state.status === "connecting"
        ? { status: "offline" as const }
        : {}),
    });
  }
  clearError = () => this.emit({ error: "" });
}
