import Link from "next/link";
import {reminderTime, type Reminder} from "../lib/reminderList";
import {formatTime, toMinutes} from "../lib/time";

// A day's reminders on a calendar timeline: a small bell tag at each one's time, on the right of
// the column and above the blocks. Tapping one opens it on the Reminders page. `compact` (the
// week's narrow columns) shows just the bell; the name is in its tooltip and label.
export default function ReminderMarks({reminders, top, compact = false}: {reminders: Reminder[]; top: (minutes: number) => number; compact?: boolean}) {
  return reminders.map((r) => {
    const time = reminderTime(r);
    const done = r.doneAt !== null;
    const label = `Reminder at ${formatTime(time)}: ${r.title}${done ? " (done)" : ""}`;
    return (
      <Link
        key={r.id}
        href={`/reminders?r=${r.id}`}
        data-block
        aria-label={label}
        title={label}
        className={`sf-press absolute right-1 z-[3] flex max-w-[calc(100%-0.5rem)] -translate-y-1/2 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] shadow-[0_2px_8px_-2px_rgb(0_0_0/0.5)] backdrop-blur-sm transition-colors ${
          done
            ? "border-white/20 bg-slate-900/50 text-white/50"
            : "border-scene/60 bg-slate-900/70 text-scene-ink hover:bg-slate-900/85"
        } ${compact ? "px-1.5" : ""}`}
        style={{top: top(toMinutes(time))}}
      >
        <svg viewBox="0 0 20 20" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5.2 13.8V9.2a4.8 4.8 0 0 1 9.6 0v4.6l1.4 1.6H3.8l1.4-1.6Z" />
          <path d="M8.3 17.4a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        {!compact && <span className={`truncate ${done ? "line-through" : ""}`}>{r.title}</span>}
      </Link>
    );
  });
}
