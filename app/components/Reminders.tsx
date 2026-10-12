"use client";

import {useEffect, useRef, useState, type ReactNode} from "react";
import {REMIND_LEADS, usePrefs} from "../lib/prefs";
import {sendTestReminder} from "../lib/reminderActions";
import {turnOffReminders, turnOnReminders, useReminders} from "../lib/reminders";

// Settings → Reminders: turning notifications on for this device (or how to, on an iPhone),
// and what to be reminded about. Opens each time `opens` goes up, like the AI window.

const label = "text-[11px] uppercase tracking-[0.25em] text-white/70";
const smallButton =
  "shrink-0 rounded-full bg-white/[0.08] px-3.5 py-2 text-[11px] uppercase tracking-[0.15em] text-white/85 transition hover:bg-white/[0.14] hover:text-white disabled:opacity-60";
const pill = (active: boolean) =>
  `rounded-md px-2.5 py-1.5 text-[11px] uppercase tracking-[0.15em] transition ${
    active ? "sf-panel-active text-white" : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white"
  }`;

function Step({n, children}: {n: number; children: ReactNode}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-scene/60 text-[10px] text-scene-ink" aria-hidden>
        {n}
      </span>
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-white/85">{children}</p>
    </li>
  );
}

function Toggle({checked, onChange, title, hint}: {checked: boolean; onChange: (on: boolean) => void; title: string; hint: string}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white">{title}</p>
        <p className="mt-1 text-xs text-white/55">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-scene/80" : "bg-white/15"}`}
      >
        <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-out ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

// The ••• and Share icons, drawn the way Safari shows them, so the steps can be followed by eye.
const MoreIcon = () => (
  <svg viewBox="0 0 16 16" className="inline h-3.5 w-3.5 align-[-2px]" fill="currentColor" aria-hidden>
    <circle cx="3" cy="8" r="1.4" />
    <circle cx="8" cy="8" r="1.4" />
    <circle cx="13" cy="8" r="1.4" />
  </svg>
);
const ShareIcon = () => (
  <svg viewBox="0 0 16 16" className="inline h-3.5 w-3.5 align-[-2px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 1.8v8.4M5.2 4.4 8 1.6l2.8 2.8M5.4 6.6H4.2v7.6h7.6V6.6h-1.2" />
  </svg>
);

function DeviceSetup() {
  const {status, endpoint} = useReminders();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null | void>) => {
    setBusy(true);
    setMessage(null);
    const error = await action();
    setMessage(error || null);
    setBusy(false);
  };

  if (status === "checking") return <p className="text-xs text-white/55">Checking this device…</p>;

  if (status === "install") {
    return (
      <div className="rounded-xl border border-scene/30 bg-scene/[0.07] p-4">
        <p className="text-xs leading-relaxed text-white/90">On iPhone and iPad, reminders work once Zeflo is on your Home Screen. It takes a few seconds:</p>
        <ol className="mt-3 space-y-3">
          <Step n={1}>
            In Safari, tap <MoreIcon /> next to the address bar, then <span className="text-white">Share</span>. On older iPhones, tap{" "}
            <ShareIcon /> at the bottom.
          </Step>
          <Step n={2}>
            Scroll down and tap <span className="text-white">Add to Home Screen</span>. If it&apos;s not there, tap View More.
          </Step>
          <Step n={3}>Open Zeflo from your Home Screen and turn reminders on here.</Step>
        </ol>
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <p className="rounded-xl bg-white/[0.05] p-4 text-xs leading-relaxed text-white/75">
        This browser can&apos;t show notifications from Zeflo. Chrome, Edge, Firefox and Safari on a Mac can, and so can Zeflo on an iPhone&apos;s
        Home Screen.
      </p>
    );
  }

  if (status === "blocked") {
    return (
      <p className="rounded-xl bg-white/[0.05] p-4 text-xs leading-relaxed text-white/75">
        Notifications are turned off for Zeflo on this device. To allow them, open your phone&apos;s Settings → Notifications → Zeflo, or on a
        computer, the site settings for this page (the icon at the left of the address bar). Then come back here.
      </p>
    );
  }

  if (status === "off") {
    return (
      <div>
        <button type="button" disabled={busy} onClick={() => run(turnOnReminders)} className="sf-primary w-full px-5 py-3 text-[11px] uppercase tracking-[0.2em] disabled:opacity-60">
          {busy ? "Turning on…" : "Turn on reminders"}
        </button>
        <p role="status" className="mt-2 text-center text-[11px] text-white/55">
          {message ?? "Each device you use is set up on its own."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.05] px-4 py-3">
        <p className="flex items-center gap-2.5 text-xs text-white/90">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.7)]" aria-hidden />
          On for this device
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(async () => (endpoint ? (await sendTestReminder(endpoint)).error : null))}
            className={smallButton}
          >
            Send a test
          </button>
          <button type="button" disabled={busy} onClick={() => run(turnOffReminders)} className={smallButton}>
            Turn off
          </button>
        </div>
      </div>
      {message && (
        <p role="status" className="mt-2 text-[11px] text-rose-200">
          {message}
        </p>
      )}
    </div>
  );
}

function Choices() {
  const {prefs, setPrefs} = usePrefs();
  if (!prefs) return null;
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-xs uppercase tracking-[0.2em] text-white">Before study sessions</legend>
        <p className="mt-1 text-xs text-white/55">
          {prefs.remindSessions ? `${prefs.remindSessions} minutes before each one you haven't checked off` : "No session reminders"}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {REMIND_LEADS.map((m) => (
            <button key={m} type="button" aria-pressed={prefs.remindSessions === m} onClick={() => setPrefs({remindSessions: m})} className={pill(prefs.remindSessions === m)}>
              {m ? `${m} min` : "Off"}
            </button>
          ))}
        </div>
      </fieldset>
      <Toggle checked={prefs.remindTests} onChange={(on) => setPrefs({remindTests: on})} title="Tests" hint="At 6 PM the evening before a test or exam" />
      <Toggle checked={prefs.remindStreak} onChange={(on) => setPrefs({remindStreak: on})} title="Streak" hint="At 8 PM, if nothing's done yet and your streak is on the line" />
    </div>
  );
}

export default function Reminders({opens}: {opens: number}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const {status} = useReminders();

  useEffect(() => {
    const d = dialog.current;
    if (opens && d && !d.open) d.showModal();
  }, [opens]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="reminders-title"
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      className="sf-panel sf-pop sf-dialog-fit m-auto w-[min(30rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-0 font-mono text-white [text-shadow:none] backdrop:bg-slate-950/55 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <p className={label}>Reminders</p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="-m-2 flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none text-white/60 transition hover:bg-white/[0.06] hover:text-white"
          >
            ×
          </button>
        </div>
        <h2 id="reminders-title" className="sf-serif mt-2 text-3xl leading-tight text-balance">
          A nudge <em>when it matters.</em>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/75 text-pretty">
          Zeflo can remind you before each study session, the evening before a test, and when your streak needs you, even when it&apos;s closed.
        </p>

        <div className="mt-5">
          <DeviceSetup />
        </div>

        {(status === "on" || status === "off") && (
          <>
            <div className="mt-6 border-t border-dashed border-white/15 pt-5">
              <p className={`${label} mb-4`}>Remind me about</p>
              <Choices />
            </div>
            <p className="mt-6 border-t border-dashed border-white/15 pt-4 text-[11px] leading-relaxed text-white/50">
              Reminders follow your time zone, from the last device you opened Zeflo on. These choices apply to all your devices.
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
