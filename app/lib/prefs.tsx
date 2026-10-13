"use client";

import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from "react";
import {createClient} from "./supabase/client";

export const START_MODES = ["ask", "timer", "clock"] as const;
export type StartMode = (typeof START_MODES)[number];

export const CLOCK_STYLES = [
  {id: "classic", label: "Classic", hint: "Big, quiet numbers"},
  {id: "analog", label: "Analog", hint: "A dial with a sweeping hand"},
  {id: "words", label: "Words", hint: "The time, written out"},
  {id: "orbit", label: "Orbit", hint: "Rings for hours, minutes and seconds"},
  {id: "sun", label: "Sun path", hint: "Where the sun or moon is in its arc"},
] as const;
export type ClockStyle = (typeof CLOCK_STYLES)[number]["id"];

export const REMIND_LEADS = [0, 5, 10, 15, 30] as const;
export type RemindLead = (typeof REMIND_LEADS)[number];

// Small per-account choices, kept in user_settings.prefs (a JSON object, so adding one needs
// no migration). Read from the database, so each is checked before it's trusted.
export type Prefs = {
  classPromptDismissed: boolean; // said "Not now" to adding a class schedule
  startMode: StartMode; // what "Start?" opens
  startDefaultAsked: boolean; // asked once whether their first choice should be the default
  clockStyle: ClockStyle;
  clockSeconds: boolean; // the classic clock shows seconds as numbers, not a line filling each minute (toggled on the clock)
  // Reminders (sent to the devices where they're turned on; see reminders.ts). The database reads
  // these too, with the same defaults: supabase/migrations/20261012120000_reminders.sql.
  remindSessions: RemindLead; // minutes before each study session, 0 = off
  remindTests: boolean; // the evening before a test
  remindStreak: boolean; // at 8 PM, when the streak needs a session
  remindersHintDismissed: boolean; // said "Not now" to the reminders card on Today
};

const DEFAULTS: Prefs = {
  classPromptDismissed: false,
  startMode: "ask",
  startDefaultAsked: false,
  clockStyle: "classic",
  clockSeconds: false,
  remindSessions: 10,
  remindTests: true,
  remindStreak: true,
  remindersHintDismissed: false,
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) =>
  allowed.includes(value as T) ? (value as T) : fallback;

function parse(raw: Record<string, unknown>): Prefs {
  return {
    classPromptDismissed: raw.classPromptDismissed === true,
    startMode: oneOf(raw.startMode, START_MODES, DEFAULTS.startMode),
    startDefaultAsked: raw.startDefaultAsked === true,
    clockStyle: oneOf(
      raw.clockStyle,
      CLOCK_STYLES.map((s) => s.id),
      DEFAULTS.clockStyle,
    ),
    clockSeconds: raw.clockSeconds === true,
    remindSessions: REMIND_LEADS.includes(raw.remindSessions as RemindLead) ? (raw.remindSessions as RemindLead) : DEFAULTS.remindSessions,
    remindTests: raw.remindTests !== false,
    remindStreak: raw.remindStreak !== false,
    remindersHintDismissed: raw.remindersHintDismissed === true,
  };
}

type PrefsContext = {
  prefs: Prefs | null; // null until read from the account
  setPrefs: (changes: Partial<Prefs>) => void;
};

const Context = createContext<PrefsContext | null>(null);

// The one place prefs are read and written, so two features changing different prefs can't
// overwrite each other's with an old copy. Changes apply at once and save in the background.
export function PrefsProvider({userId, children}: {userId: string | null; children: ReactNode}) {
  const [prefs, setState] = useState<Prefs | null>(null);
  // Anything else in the JSON (e.g. prefs from a newer version of the app), kept when saving.
  const raw = useRef<Record<string, unknown>>({});

  useEffect(() => {
    if (!userId) return;
    let current = true;
    createClient()
      .from("user_settings")
      .select("prefs")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({data}) => {
        if (!current) return;
        // No settings yet, or offline: start from the defaults.
        const saved = data?.prefs;
        raw.current = saved && typeof saved === "object" && !Array.isArray(saved) ? (saved as Record<string, unknown>) : {};
        setState(parse(raw.current));
        // The time zone this device is in, for a connected AI, which only knows local days and
        // times: it turns "9 AM tomorrow" into the moment a reminder is due (lib/mcp/tools.ts).
        // Not a choice, so not in Prefs; saved only when it changes.
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timeZone && raw.current.timeZone !== timeZone) {
          raw.current = {...raw.current, timeZone};
          createClient().from("user_settings").upsert({user_id: userId, prefs: raw.current}).then(() => {});
        }
      });
    return () => {
      current = false;
    };
  }, [userId]);

  const setPrefs = useCallback(
    (changes: Partial<Prefs>) => {
      if (!userId) return;
      raw.current = {...raw.current, ...changes};
      setState(parse(raw.current));
      createClient()
        .from("user_settings")
        .upsert({user_id: userId, prefs: raw.current})
        .then(() => {
          // If this fails the choice still applies until the page reloads; nothing to undo.
        });
    },
    [userId],
  );

  return <Context value={{prefs, setPrefs}}>{children}</Context>;
}

export function usePrefs() {
  const context = useContext(Context);
  if (!context) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return context;
}
