import { humanizeDuration } from "@universe/core";
import { create } from "zustand";
import { showToast } from "../app/toasts";

type TimerState = {
  endsAt: number | null;
  total: number;
  label: string;
  remaining: number;
  windowId: string | null;
};

let tickHandle: ReturnType<typeof setInterval> | null = null;

const useTimer = create<TimerState>()(() => ({ endsAt: null, total: 0, label: "", remaining: 0, windowId: null }));

function stopTick() {
  if (tickHandle !== null) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function tick() {
  const s = useTimer.getState();
  if (s.endsAt === null) return;
  const remaining = Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000));
  if (remaining <= 0) {
    stopTick();
    const { label, windowId } = useTimer.getState();
    useTimer.setState({ endsAt: null, total: 0, label: "", remaining: 0, windowId: null });
    if (windowId) showToast(windowId, "Timer done", label);
    return;
  }
  useTimer.setState({ remaining });
}

export function startTimer(seconds: number, label: string, windowId: string) {
  stopTick();
  useTimer.setState({ endsAt: Date.now() + seconds * 1000, total: seconds, label, remaining: seconds, windowId });
  tickHandle = setInterval(tick, 250);
}

export function cancelTimer() {
  stopTick();
  useTimer.setState({ endsAt: null, total: 0, label: "", remaining: 0, windowId: null });
}

export function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes >= 60) return humanizeDuration(total);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export const useTimerState = useTimer;
