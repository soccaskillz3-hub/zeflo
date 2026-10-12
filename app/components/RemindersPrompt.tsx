"use client";

import {usePathname} from "next/navigation";
import {useState} from "react";
import Reminders from "./Reminders";
import {useClasses} from "../lib/classes";
import {usePrefs} from "../lib/prefs";
import {useReminders} from "../lib/reminders";

const button = "text-xs uppercase tracking-[0.25em] transition";

// On Today, once: offers reminders to people who haven't turned them on here. Waits until the
// class prompt has had its turn, so the two never stack. "Not now" is remembered on the account;
// reminders stay in Settings.
export default function RemindersPrompt() {
  const pathname = usePathname();
  const {status} = useReminders();
  const {prefs, setPrefs} = usePrefs();
  const {classes, loaded, promptDismissed} = useClasses();
  const [opens, setOpens] = useState(0);
  const [justDismissed, setJustDismissed] = useState(false);

  const classesSettled = loaded && (classes.length > 0 || promptDismissed === true);

  if (justDismissed) {
    return (
      <div role="status" className="sf-card mt-6 flex items-center justify-between gap-4 px-5 py-4">
        <p className="text-sm text-white/75">No problem. You can turn on reminders any time from Settings → Reminders.</p>
        <button type="button" onClick={() => setJustDismissed(false)} aria-label="Close" className="px-2 text-lg text-white/50 hover:text-white">
          ×
        </button>
      </div>
    );
  }

  const show = pathname === "/" && classesSettled && prefs && !prefs.remindersHintDismissed && (status === "off" || status === "install");

  return (
    <>
      {show && (
        <div className="sf-card sf-in mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:mt-8">
          <p className="max-w-md text-sm leading-relaxed text-white/85 text-pretty">
            <span className="font-semibold text-scene-ink">Want a nudge before each session?</span>{" "}
            {status === "install"
              ? "Add Zeflo to your Home Screen and it reminds you before sessions and tests, like any other app."
              : "Zeflo can remind you before sessions and tests, even when it's closed."}
          </p>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => {
                setPrefs({remindersHintDismissed: true});
                setJustDismissed(true);
              }}
              className={`${button} text-white/60 hover:text-white`}
            >
              Not now
            </button>
            <button type="button" aria-haspopup="dialog" onClick={() => setOpens((n) => n + 1)} className="sf-primary px-5 py-2 text-[11px] uppercase tracking-[0.2em]">
              {status === "install" ? "Show me how" : "Set up"}
            </button>
          </div>
        </div>
      )}
      <Reminders opens={opens} />
    </>
  );
}
