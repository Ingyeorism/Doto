import { useEffect, useState } from "react";

type Battery = EventTarget & { level: number; charging: boolean };
export function useHostDevice(active: boolean) {
  const [keepScreen, setKeepScreen] = useState(true);
  const [wakeState, setWakeState] = useState("대기");
  const [retry, setRetry] = useState(0);
  const [dimmed, setDimmed] = useState(false);
  const [battery, setBattery] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) {
      setDimmed(false);
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    let cancelled = false;
    let sentinel: WakeLockSentinel | undefined;
    let pending = false;
    if (!active || !keepScreen) {
      setWakeState("꺼짐");
      return;
    }
    if (!window.isSecureContext || !("wakeLock" in navigator)) {
      setWakeState("기기에서 설정 필요");
      return;
    }
    const acquire = async () => {
      if (
        cancelled ||
        pending ||
        document.visibilityState !== "visible" ||
        (sentinel && !sentinel.released)
      )
        return;
      pending = true;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled || document.visibilityState !== "visible") {
          await lock.release();
          return;
        }
        sentinel = lock;
        setWakeState(lock.released ? "다시 켜기 필요" : "켜짐");
        lock.addEventListener("release", () => {
          if (!cancelled) setWakeState("다시 켜기 필요");
        });
      } catch {
        if (!cancelled) setWakeState("기기에서 설정 필요");
      } finally {
        pending = false;
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", visible);
      void sentinel?.release();
    };
  }, [active, keepScreen, retry]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let batteryManager: Battery | undefined;
    const update = () => {
      if (!cancelled && batteryManager)
        setBattery(
          `${Math.round(batteryManager.level * 100)}%${batteryManager.charging ? " · 충전 중" : ""}`,
        );
    };
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<Battery>;
    };
    void nav
      .getBattery?.()
      .then((value) => {
        if (cancelled) return;
        batteryManager = value;
        update();
        value.addEventListener("levelchange", update);
        value.addEventListener("chargingchange", update);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      batteryManager?.removeEventListener("levelchange", update);
      batteryManager?.removeEventListener("chargingchange", update);
    };
  }, [active]);
  return {
    keepScreen,
    setKeepScreen,
    wakeState,
    retryWake: () => setRetry((n) => n + 1),
    dimmed,
    setDimmed,
    battery,
    now,
  };
}
