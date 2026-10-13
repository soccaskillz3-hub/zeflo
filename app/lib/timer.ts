"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {chime} from "./audio/sfx";

// The focus timer is stored as timestamps rather than a ticking counter, so it keeps
// correct time across reloads, background tabs and leaving the page.
type TimerState = {
  sessionId: string;
  focusMs: number; // full length of the focus block, including any time added
  focusLeftMs: number; // focus remaining as of `runningSince` (or now, when not running)
  runningSince: number | null; // when focus last resumed; null while paused or on a break
  onBreak: {totalMs: number; endsAt: number} | null;
};

export type Phase = "focus" | "paused" | "break" | "complete";

const STORAGE_KEY = "studyflow:timer";
// Fired on this page whenever the saved timer changes (other tabs get the "storage" event).
const CHANGED = "zeflo:timer";

function load(): TimerState | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

function save(state: TimerState | null) {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not persisted; the timer still runs for this page view.
  }
  window.dispatchEvent(new Event(CHANGED));
}

const focusLeft = (s: TimerState, now: number) =>
  Math.max(0, s.runningSince === null ? s.focusLeftMs : s.focusLeftMs - (now - s.runningSince));

// Where a timer is at a moment. A break that has run out counts as focus again from when it
// ended, as the timer page would have switched back then.
function statusAt(s: TimerState, now: number): {phase: Phase; focusLeftMs: number; breakLeftMs: number} {
  if (s.onBreak && now < s.onBreak.endsAt) {
    return {phase: "break", focusLeftMs: focusLeft(s, now), breakLeftMs: s.onBreak.endsAt - now};
  }
  const resumed = s.onBreak ? {...s, onBreak: null, runningSince: s.onBreak.endsAt} : s;
  const left = focusLeft(resumed, now);
  return {phase: left <= 0 ? "complete" : resumed.runningSince === null ? "paused" : "focus", focusLeftMs: left, breakLeftMs: 0};
}

// "23:41", or "1:05:00" from an hour up.
export function countdown(ms: number) {
  const total = Math.ceil(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(total % 60)}` : `${pad(m)}:${pad(total % 60)}`;
}

// A session opened with the clock instead: no timer to keep, just which session it was and when
// it's over, so "Continue" can lead back to the clock until then.
type ClockState = {sessionId: string; until: number};
const CLOCK_KEY = "studyflow:clock-session";

function loadClock(): ClockState | null {
  try {
    return JSON.parse(localStorage.getItem(CLOCK_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function rememberClock(sessionId: string, until: number) {
  try {
    localStorage.setItem(CLOCK_KEY, JSON.stringify({sessionId, until}));
  } catch {
    // Not remembered: Start? just shows again.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function forgetClock() {
  try {
    localStorage.removeItem(CLOCK_KEY);
  } catch {
    // Nothing to forget.
  }
  window.dispatchEvent(new Event(CHANGED));
}

// "clock": the session is open in the clock, and focusLeftMs is the time until it ends.
export type SavedTimer = {sessionId: string; phase: Phase | "clock"; focusLeftMs: number; breakLeftMs: number};

// The timer (or clock) left going in this browser (any page), kept up to date each second, or null.
// For "Continue" buttons: it never starts, changes or clears a timer.
export function useSavedTimer(): SavedTimer | null {
  const [state, setState] = useState<TimerState | null>(null);
  const [clock, setClock] = useState<ClockState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const read = () => {
      setState(load());
      setClock(loadClock());
      setNow(Date.now());
    };
    read();
    window.addEventListener(CHANGED, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(CHANGED, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  // Opening the timer forgets the clock, so a clock still remembered is the newer of the two,
  // unless it's the same session (then the timer says more).
  const clockOpen = clock !== null && now < clock.until && clock.sessionId !== state?.sessionId;

  // Tick only while something is counting down; a paused timer doesn't change.
  const status = state ? statusAt(state, now) : null;
  const counting = clockOpen || status?.phase === "focus" || status?.phase === "break";
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting]);

  if (clockOpen) return {sessionId: clock.sessionId, phase: "clock", focusLeftMs: clock.until - now, breakLeftMs: 0};
  return state && status ? {sessionId: state.sessionId, ...status} : null;
}

// Runs the timer for one session of `minutes` length. Resumes a saved timer for the same
// session; otherwise starts a fresh one.
export function useFocusTimer(sessionId: string | null, minutes: number) {
  const [state, setState] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastPhase = useRef<Phase | null>(null);

  // Start or resume once the session is known.
  useEffect(() => {
    if (!sessionId || minutes <= 0) return;
    forgetClock(); // studying with the timer now, so Continue should lead here
    const saved = load();
    const next: TimerState =
      saved?.sessionId === sessionId
        ? saved
        : {sessionId, focusMs: minutes * 60_000, focusLeftMs: minutes * 60_000, runningSince: Date.now(), onBreak: null};
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved timer once on the client
    setState(next);
    setNow(Date.now());
  }, [sessionId, minutes]);

  useEffect(() => {
    if (state) save(state);
  }, [state]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // A break that has run out hands back to focus automatically.
  useEffect(() => {
    if (state?.onBreak && now >= state.onBreak.endsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the break ran out while ticking
      setState({...state, onBreak: null, runningSince: now});
    }
  }, [state, now]);

  const left = state ? focusLeft(state, now) : minutes * 60_000;
  const phase: Phase = !state
    ? "paused"
    : state.onBreak
      ? "break"
      : left <= 0
        ? "complete"
        : state.runningSince === null
          ? "paused"
          : "focus";

  // Chime when focus finishes or a break ends (not on first load).
  useEffect(() => {
    const prev = lastPhase.current;
    lastPhase.current = phase;
    if (prev === null) return;
    if ((phase === "complete" && prev !== "complete") || (prev === "break" && phase === "focus")) chime();
  }, [phase]);

  const update = useCallback((fn: (s: TimerState, now: number) => TimerState) => {
    setState((s) => (s ? fn(s, Date.now()) : s));
  }, []);

  return {
    phase,
    focusLeftMs: left,
    focusMs: state?.focusMs ?? minutes * 60_000,
    breakLeftMs: state?.onBreak ? Math.max(0, state.onBreak.endsAt - now) : 0,
    breakMs: state?.onBreak?.totalMs ?? 0,
    pause: () => update((s, t) => ({...s, focusLeftMs: focusLeft(s, t), runningSince: null})),
    resume: () => update((s, t) => ({...s, runningSince: t})),
    startBreak: (breakMinutes: number) =>
      update((s, t) => ({
        ...s,
        focusLeftMs: focusLeft(s, t),
        runningSince: null,
        onBreak: {totalMs: breakMinutes * 60_000, endsAt: t + breakMinutes * 60_000},
      })),
    endBreak: () => update((s, t) => ({...s, onBreak: null, runningSince: t})),
    addFocus: (extraMinutes: number) =>
      update((s, t) => ({
        ...s,
        focusMs: s.focusMs + extraMinutes * 60_000,
        focusLeftMs: focusLeft(s, t) + extraMinutes * 60_000,
        runningSince: t,
      })),
    clear: () => {
      save(null);
      setState(null);
    },
  };
}
