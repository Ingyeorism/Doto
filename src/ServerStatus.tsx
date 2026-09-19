import { useEffect, useState } from "react";
import { Button } from "./ui";

type Status = {
  connections: number;
  students: number;
  teachers: number;
  rooms: number;
  relayConnections: number;
  sampledAt: number | null;
  status: "measuring" | "normal" | "busy" | "overloaded";
  updateDelayMs: number;
};
const names = {
  measuring: "상태 측정 중",
  normal: "여유",
  busy: "혼잡",
  overloaded: "매우 혼잡",
};
export function ServerStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/status", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(5000),
          ]),
          cache: "no-store",
        });
        if (!response.ok) throw Error();
        const next: Status = await response.json();
        if (
          !(next.status in names) ||
          typeof next.connections !== "number" ||
          (next.sampledAt && Date.now() - next.sampledAt > 20000)
        )
          throw Error();
        if (active) {
          setStatus(next);
          setUnavailable(false);
        }
      } catch {
        if (active) setUnavailable(true);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return (
    <section
      className={`server-status ${unavailable ? "unavailable" : status?.status || "measuring"}`}
      aria-label="접속 전 서버 상태"
    >
      <strong>
        서버 상태 ·{" "}
        {unavailable
          ? "확인할 수 없음"
          : status
            ? names[status.status]
            : "확인 중"}
      </strong>
      {!unavailable && status && (
        <>
          <span>
            접속 {status.connections}대 · 학생 {status.students}명 · 교사{" "}
            {status.teachers}대 · 수업 {status.rooms}개
          </span>
          <small>
            {status.status === "measuring"
              ? "첫 상태를 측정하고 있어요."
              : `글 전달 간격 약 ${(status.updateDelayMs / 1000).toFixed(2)}초 · 10초마다 확인`}
          </small>
        </>
      )}
      {unavailable && (
        <small>
          서버와 인터넷 연결을 확인해 주세요. 이전 접속 수는 표시하지 않아요.
        </small>
      )}
      <small>
        접속 수는 서버 연결 기준이며, 태블릿까지의 글 전달 성공을 뜻하지는
        않아요.
      </small>
    </section>
  );
}

type AdminStatus = Status & {
  tuning: Record<string, number>;
  metrics: Record<string, number> | null;
  configError: string;
};
const fields: [string, string, number, number][] = [
  ["cpuBusyPercent", "CPU 혼잡 기준 (%)", 10, 100],
  ["memoryBusyPercent", "메모리 혼잡 기준 (%)", 10, 100],
  ["loopBusyMs", "서버 처리 지연 기준 (ms)", 20, 2000],
  ["queueBusyKiB", "연결별 전송 대기 기준 (KiB)", 64, 4096],
  ["networkMbps", "사용 가능한 업로드 속도 (Mbps, 0 = 미설정)", 0, 100000],
  ["normalDelayMs", "여유로울 때 글 전달 간격 (ms)", 50, 500],
  ["busyDelayMs", "혼잡할 때 글 전달 간격 (ms)", 100, 2000],
  ["overloadedDelayMs", "매우 혼잡할 때 글 전달 간격 (ms)", 200, 3000],
];
export function ServerAdmin() {
  const [key, setKey] = useState("");
  const [data, setData] = useState<AdminStatus | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const request = async (save: boolean) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/server", {
        method: save ? "PUT" : "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          ...(save ? { "Content-Type": "application/json" } : {}),
        },
        body: save ? JSON.stringify(draft) : undefined,
        signal: AbortSignal.timeout(10000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "상태를 읽지 못했어요.");
      setData(result);
      setDraft(result.tuning);
      setMessage(
        save
          ? "설정을 저장했어요. 연결된 기기에는 5초 안에 반영돼요."
          : result.configError,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "서버 연결을 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="server-admin page-width">
      <a href="/teacher/start">시작 화면으로</a>
      <h1>서버 관리</h1>
      <p>
        CPU·메모리는 실행 환경의 자원을 기준으로 자동 계산합니다. 인터넷 회선
        속도는 자동 추정하지 않으며, 미설정 시 전송 대기량으로 혼잡을
        판단합니다.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void request(false);
        }}
      >
        <label className="field">
          관리 키
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setData(null);
            }}
            required
          />
        </label>
        <Button type="submit" disabled={busy || !key}>
          상태 확인
        </Button>
      </form>
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          <section className="server-admin-metrics" aria-label="서버 측정값">
            <strong>
              {names[data.status]} · {data.connections}대 연결 · 중계{" "}
              {data.relayConnections}대
            </strong>
            {data.metrics ? (
              <p>
                CPU {data.metrics.cpuPercent.toFixed(1)}% · 메모리{" "}
                {data.metrics.memoryPercent.toFixed(1)}% · 처리 지연 p95{" "}
                {data.metrics.loopP95Ms.toFixed(1)}ms
                <br />
                전송 {(data.metrics.outBytesPerSecond / 1024).toFixed(1)} KiB/s
                · 최대 대기 {(data.metrics.queueBytes / 1024).toFixed(1)} KiB ·
                CPU 할당 {data.metrics.cpuCapacity.toFixed(2)}코어
                <br />
                측정 시각{" "}
                {new Date(data.sampledAt!).toLocaleTimeString("ko-KR")}
              </p>
            ) : (
              <p>첫 측정을 기다린 뒤 상태 확인을 눌러 주세요.</p>
            )}
          </section>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void request(true);
            }}
          >
            <div className="server-tuning-fields">
              {fields.map(([id, label, min, max]) => (
                <label className="field" key={id}>
                  {label}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step="any"
                    required
                    value={draft[id] ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [id]:
                          e.target.value === "" ? NaN : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p>
              기준에 도달하면 혼잡, 기준의 1.2배부터 매우 혼잡으로 판단합니다.
              회복 후에는 3회 측정(약 15초)을 확인하고 전달 간격을 줄입니다.
            </p>
            <Button type="submit" variant="primary" disabled={busy}>
              설정 저장
            </Button>
          </form>
        </>
      )}
    </main>
  );
}
