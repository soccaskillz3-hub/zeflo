"use client";

import Link from "next/link";
import {Card, CardHead, cardAction} from "./Card";
import {reminderTime, useRemindersIn} from "../lib/reminderList";
import {useSchedule} from "../lib/schedule";
import {formatTime} from "../lib/time";

// Today's reminders under the calendar's list view, when there are any. Each opens on the
// Reminders page, where it's checked off.
export default function TodayReminders() {
  const {today} = useSchedule();
  if (!today) return null;
  return <Reminders today={today} />;
}

function Reminders({today}: {today: string}) {
  const reminders = useRemindersIn(today, today);
  if (!reminders.length) return null;
  return (
    <Card className="sf-reveal mt-4 sm:p-7">
      <CardHead label="Today's reminders">
        <Link href="/reminders" className={cardAction}>
          All reminders
        </Link>
      </CardHead>
      <ul className="-mx-2 mt-3 divide-y divide-white/10">
        {reminders.map((r) => {
          const done = r.doneAt !== null;
          return (
            <li key={r.id}>
              <Link
                href={`/reminders?r=${r.id}`}
                className="flex items-center gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-white/[0.04]"
              >
                <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${done ? "text-white/40" : "text-scene-soft"}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5.2 13.8V9.2a4.8 4.8 0 0 1 9.6 0v4.6l1.4 1.6H3.8l1.4-1.6Z" />
                  <path d="M8.3 17.4a1.9 1.9 0 0 0 3.4 0" />
                </svg>
                <span className={`min-w-0 flex-1 truncate ${done ? "text-white/45 line-through" : "text-white"}`}>{r.title}</span>
                <span className={`shrink-0 text-sm tabular-nums ${done ? "text-white/40" : "text-white/70"}`}>{formatTime(reminderTime(r))}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
