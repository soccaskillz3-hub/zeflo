"use client";

import {use, useEffect, useRef, useState, type FormEvent} from "react";
import {Card, CardHead} from "../../components/Card";
import DatePicker from "../../components/DatePicker";
import RemindersSettings from "../../components/Reminders";
import TimePicker from "../../components/TimePicker";
import {addDays, dayKey, formatDay, toDate} from "../../lib/days";
import {useReminderList, type Reminder} from "../../lib/reminderList";
import {useReminders} from "../../lib/reminders";
import {formatTime, fromMinutes, nowMinutes, toMinutes} from "../../lib/time";

// Your own reminders, apart from study sessions: "Email the TA", due at a time. At that moment a
// notification goes out; tapping it opens this page on that reminder (/reminders?r=<id>), and
// tapping the reminder here checks it off.

const pad = (n: number) => String(n).padStart(2, "0");
const clockOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// "Today, 3:00 PM", "Tomorrow, 9:00 AM", "Mon, Oct 19, 9:00 AM".
function when(date: Date, today: string) {
  const day = dayKey(date);
  const name =
    day === today
      ? "Today"
      : day === addDays(today, 1)
        ? "Tomorrow"
        : day === addDays(today, -1)
          ? "Yesterday"
          : formatDay(day, {weekday: "short", month: "short", day: "numeric"});
  return `${name}, ${formatTime(clockOf(date))}`;
}

// The time now, again every 30 seconds, so reminders move to "Due" as their moment passes.
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function RemindersPage({searchParams}: PageProps<"/reminders">) {
  const {r: opened} = use(searchParams);
  const list = useReminderList();
  const now = useNow();
  const today = dayKey(now);

  // Just checked off: stays where it was for a moment, with its tick, before moving to Done,
  // so it doesn't vanish from under the finger.
  const [settling, setSettling] = useState<string[]>([]);
  const toggle = (r: Reminder) => {
    if (!r.doneAt) {
      setSettling((ids) => [...ids, r.id]);
      setTimeout(() => setSettling((ids) => ids.filter((id) => id !== r.id)), 650);
    }
    list.toggle(r.id);
  };

  const all = list.reminders ?? [];
  const open = all.filter((r) => !r.doneAt || settling.includes(r.id));
  const due = open.filter((r) => r.dueAt <= now);
  const upcoming = open.filter((r) => r.dueAt > now);
  const done = all.filter((r) => r.doneAt && !settling.includes(r.id)).sort((a, b) => b.doneAt!.getTime() - a.doneAt!.getTime());
  const rows = {today, highlight: typeof opened === "string" ? opened : null, onToggle: toggle, onRemove: list.remove};

  return (
    <div className="mt-6 grid gap-4 sm:mt-10 sm:gap-5">
      <Card>
        <CardHead label="New reminder" />
        <AddForm onAdd={list.add} />
        <NotificationsNote />
      </Card>

      {list.error && (
        <Card>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-rose-200">{list.error}</p>
            <button type="button" onClick={list.dismissError} className="text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white">
              OK
            </button>
          </div>
        </Card>
      )}

      {list.reminders && (
        <Card className="sf-reveal">
          {open.length === 0 && done.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/60">No reminders yet. Add one above and Zeflo will ping you right on time.</p>
          ) : (
            <div className="grid gap-6">
              {due.length > 0 && <Group label="Due" reminders={due} {...rows} due />}
              {upcoming.length > 0 && <Group label="Upcoming" reminders={upcoming} {...rows} />}
              {open.length === 0 && <p className="text-sm text-white/60">All done. Nothing waiting on you.</p>}
              {done.length > 0 && <Group label="Done" reminders={done} {...rows} />}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function AddForm({onAdd}: {onAdd: (title: string, dueAt: Date) => void}) {
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(() => dayKey());
  const [time, setTime] = useState("");
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name) return setError("What should Zeflo remind you about?");
    if (!time) return setError("Pick a time.");
    const dueAt = toDate(day);
    dueAt.setHours(Math.floor(toMinutes(time) / 60), toMinutes(time) % 60);
    // Within this minute still counts: it goes out straight away.
    if (dueAt.getTime() < Date.now() - 60_000) return setError("That time has already passed.");
    onAdd(name, dueAt);
    setTitle("");
    setTime("");
    setError("");
  };

  // The pickers start on the next five minutes, today.
  const suggestion = fromMinutes(Math.ceil((nowMinutes() + 1) / 5) * 5);
  const input =
    "border-b border-white/30 bg-transparent px-1 py-2 text-white placeholder:text-white/45 outline-none transition focus:border-scene [color-scheme:dark]";

  return (
    <form onSubmit={submit} className="mt-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Remind me to…"
          aria-label="Reminder"
          className={`${input} md:min-w-0 md:flex-1`}
        />
        <div className="flex items-end gap-3">
          <DatePicker value={day} onChange={setDay} label="Day" min={dayKey()} />
          <TimePicker value={time} onChange={setTime} label="Time" placeholder="Time" suggestion={suggestion} align="right" />
        </div>
        <button type="submit" className="sf-primary self-end px-5 py-2 text-[11px] uppercase tracking-[0.2em]">
          Add
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
    </form>
  );
}

// Reminders only reach a device that has notifications on; says so when this one doesn't.
function NotificationsNote() {
  const {status} = useReminders();
  const [opens, setOpens] = useState(0);
  if (status === "on" || status === "checking") return null;
  return (
    <>
      <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
        <span>{status === "unsupported" ? "This browser can't show notifications, so reminders only show here." : "Notifications are off on this device, so reminders won't ping you."}</span>
        {status !== "unsupported" && (
          <button type="button" onClick={() => setOpens((n) => n + 1)} className="uppercase tracking-[0.2em] text-scene-soft hover:text-scene-ink">
            Turn on
          </button>
        )}
      </p>
      <RemindersSettings opens={opens} />
    </>
  );
}

type Rows = {today: string; highlight: string | null; onToggle: (r: Reminder) => void; onRemove: (id: string) => void};

function Group({label, reminders, due = false, ...rows}: Rows & {label: string; reminders: Reminder[]; due?: boolean}) {
  return (
    <div>
      <h2 className={`text-[11px] uppercase tracking-[0.3em] ${due ? "text-scene-soft" : "text-white/60"}`}>{label}</h2>
      <ul className="-mx-2 mt-2 divide-y divide-white/10">
        {reminders.map((r) => (
          <Row key={r.id} reminder={r} due={due} {...rows} />
        ))}
      </ul>
    </div>
  );
}

function Row({reminder: r, due, today, highlight, onToggle, onRemove}: Rows & {reminder: Reminder; due: boolean}) {
  const done = r.doneAt !== null;
  const item = useRef<HTMLLIElement>(null);
  const flash = highlight === r.id;

  // Opened from this reminder's notification: bring it into view.
  useEffect(() => {
    if (flash) item.current?.scrollIntoView({block: "center", behavior: "smooth"});
  }, [flash]);

  return (
    <li ref={item} className={`group relative flex items-stretch rounded-xl transition-colors hover:bg-white/[0.04] ${flash ? "sf-flash" : ""}`}>
      <button
        type="button"
        onClick={() => onToggle(r)}
        aria-pressed={done}
        className="flex min-w-0 flex-1 items-center gap-4 py-3.5 pl-2 text-left sm:gap-5"
      >
        <span
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition ${
            done ? "border-scene bg-scene text-slate-900" : due ? "border-scene group-hover:bg-scene/20" : "border-white/60 group-hover:border-scene"
          }`}
        >
          {done && (
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path className="sf-check-draw" d="M2.5 6.5l2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate transition-colors ${done ? "text-white/45 line-through" : "text-white"}`}>{r.title}</span>
          <span className={`mt-0.5 block text-xs tabular-nums ${done ? "text-white/35" : due ? "text-scene-soft" : "text-white/60"}`}>
            {when(r.dueAt, today)}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onRemove(r.id)}
        aria-label={`Remove ${r.title}`}
        className="px-4 text-lg text-white/40 transition hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        ×
      </button>
    </li>
  );
}
