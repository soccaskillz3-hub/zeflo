"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {addDays, dayKey, toDate} from "./days";
import {createClient} from "./supabase/client";

// The user's own reminders (the Reminders page), kept apart from study sessions. Each is due at a
// moment, saved as one (due_at) by the browser, which knows the time zone; the cron job in
// supabase/migrations/20261013120000_reminder_list.sql sends a notification at that moment.
// Changes show straight away and save in the background; a failed save re-reads the list.

export type Reminder = {id: string; title: string; dueAt: Date; doneAt: Date | null};

type Row = {id: string; title: string; due_at: string; done_at: string | null};

const fromRow = (r: Row): Reminder => ({
  id: r.id,
  title: r.title,
  dueAt: new Date(r.due_at),
  doneAt: r.done_at ? new Date(r.done_at) : null,
});

const pad = (n: number) => String(n).padStart(2, "0");

const byDue = (a: Reminder, b: Reminder) => a.dueAt.getTime() - b.dueAt.getTime();

// Checked-off reminders stay listed (to undo, or just to see) for a week.
const KEEP_DONE_MS = 7 * 24 * 60 * 60 * 1000;

export function useReminderList() {
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(0);

  const read = useCallback(async () => {
    const {data, error} = await createClient()
      .from("reminders")
      .select("id, title, due_at, done_at")
      .or(`done_at.is.null,done_at.gte.${new Date(Date.now() - KEEP_DONE_MS).toISOString()}`)
      .order("due_at");
    if (error) return setError("Couldn't load your reminders. Check your connection and reload the page.");
    if (!saving.current) setReminders((data as Row[]).map(fromRow));
  }, []);

  // Read on open, and again when someone comes back to the tab (a reminder checked off on
  // another device, or from a notification that opened a different window).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first read of the list
    read();
    const again = () => document.visibilityState === "visible" && read();
    document.addEventListener("visibilitychange", again);
    return () => document.removeEventListener("visibilitychange", again);
  }, [read]);

  const save = (message: string, request: PromiseLike<{error: unknown}>) => {
    saving.current++;
    Promise.resolve(request).then(
      ({error}) => {
        saving.current--;
        if (error) {
          setError(message);
          read();
        }
      },
      () => {
        saving.current--;
        setError(message);
        read();
      },
    );
  };

  const add = (title: string, dueAt: Date) => {
    const reminder: Reminder = {id: crypto.randomUUID(), title, dueAt, doneAt: null};
    setReminders((prev) => [...(prev ?? []), reminder].sort(byDue));
    save(
      "Couldn't save that reminder. Please try again.",
      createClient().from("reminders").insert({id: reminder.id, title, due_at: dueAt.toISOString()}),
    );
  };

  // Check off on first tap, undo on the second.
  const toggle = (id: string) => {
    const doneAt = reminders?.find((r) => r.id === id)?.doneAt ? null : new Date();
    setReminders((prev) => prev?.map((r) => (r.id === id ? {...r, doneAt} : r)) ?? prev);
    save(
      "Couldn't save that change. Please try again.",
      createClient().from("reminders").update({done_at: doneAt?.toISOString() ?? null}).eq("id", id),
    );
  };

  const remove = (id: string) => {
    setReminders((prev) => prev?.filter((r) => r.id !== id) ?? prev);
    save("Couldn't remove that reminder. Please try again.", createClient().from("reminders").delete().eq("id", id));
  };

  return {reminders, error, dismissError: () => setError(null), add, toggle, remove};
}

// Reminders due on the days from `from` to `to` (local days), done or not, for the calendar.
// Read again when the days change or someone comes back to the tab.
export function useRemindersIn(from: string, to: string) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  useEffect(() => {
    let current = true;
    const read = () =>
      createClient()
        .from("reminders")
        .select("id, title, due_at, done_at")
        .gte("due_at", toDate(from).toISOString())
        .lt("due_at", toDate(addDays(to, 1)).toISOString())
        .order("due_at")
        .then(({data}) => {
          if (current && data) setReminders((data as Row[]).map(fromRow));
        });
    read();
    const again = () => document.visibilityState === "visible" && read();
    document.addEventListener("visibilitychange", again);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", again);
    };
  }, [from, to]);
  return reminders;
}

// "HH:MM" on the local clock, for placing a reminder on a timeline.
export const reminderTime = (r: Reminder) => `${pad(r.dueAt.getHours())}:${pad(r.dueAt.getMinutes())}`;
export const remindersOn = (reminders: Reminder[], day: string) => reminders.filter((r) => dayKey(r.dueAt) === day);
