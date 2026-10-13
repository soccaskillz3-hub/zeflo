"use client";

import Link from "next/link";
import {continueHref, continueLabel} from "./StartButton";
import {useSchedule} from "../lib/schedule";
import {useSavedTimer} from "../lib/timer";

// Under the header on every page while a study timer (or a session's clock) is going in this
// browser: what's being studied and the time left, one tap from it. So popping out to check the
// calendar (or anything else) never loses the way back.
export default function StudyingNow() {
  const saved = useSavedTimer();
  const {sessions, completed} = useSchedule();
  const session = saved ? sessions.find((s) => s.id === saved.sessionId) : undefined;
  // Only a session still on today's schedule and not yet done (it may have been removed or ticked off).
  if (!saved || !session || completed.includes(session.id)) return null;

  const counting = saved.phase === "focus" || saved.phase === "break" || saved.phase === "clock";
  return (
    <Link
      href={continueHref(saved)}
      className="sf-card sf-press mt-5 flex items-center gap-3 rounded-full py-2 pl-4 pr-2 transition hover:brightness-110"
    >
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 rounded-full ${saved.phase === "break" ? "bg-amber-200" : "bg-scene"} ${
          counting ? "sf-live-dot" : "opacity-50"
        }`}
      />
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="text-white/60">{saved.phase === "break" ? "On a break from " : "Studying "}</span>
        <span className="text-white">{session.subject}</span>
      </span>
      <span className="shrink-0 rounded-full bg-white/[0.08] px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-scene-ink tabular-nums">
        {continueLabel(saved)}
      </span>
    </Link>
  );
}
