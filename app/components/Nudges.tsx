"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useCallback, useEffect, useState} from "react";
import InstallGuide from "./InstallGuide";
import Reminders from "./Reminders";
import {useClasses} from "../lib/classes";
import {dismissInstallOffer, installOfferDismissed, isPhone, promptInstall, useInstall} from "../lib/install";
import {usePrefs} from "../lib/prefs";
import {useReminders} from "../lib/reminders";

// The things Zeflo offers new people, one at a time, in this order: adding their classes, getting
// the app on this device, and turning on reminders. Never two at once, and once one gets a
// "Not now", nothing else is offered until the next visit. Each "Not now" is remembered (classes
// and reminders on the account, the app on this device), and everything stays in Settings.

const textButton = "text-xs uppercase tracking-[0.25em] text-white/60 transition hover:text-white";
const NOTE_MS = 4200;

// "No problem…" after a Not now. Fades away on its own (.sf-note).
// Shown where the offer was: in the page, or floating where the install offer floated.
const FLOATING = "sf-panel fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem-var(--ios-gap,0px))] z-40 rounded-2xl border md:inset-x-auto md:bottom-6 md:right-6 md:w-[23rem]";

function Note({text, floating, onClose}: {text: string; floating: boolean; onClose: () => void}) {
  useEffect(() => {
    const id = setTimeout(onClose, NOTE_MS);
    return () => clearTimeout(id);
  }, [onClose]);
  return (
    <div role="status" className={`sf-note flex items-center justify-between gap-4 px-5 py-4 ${floating ? `${FLOATING} [text-shadow:none]` : "sf-card mt-6"}`}>
      <p className="text-sm text-white/75">{text}</p>
      <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-lg text-white/50 hover:text-white">
        ×
      </button>
    </div>
  );
}

function ClassesCard({onNotNow}: {onNotNow: () => void}) {
  return (
    <div className="sf-card sf-in mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:mt-8">
      <p className="max-w-md text-sm leading-relaxed text-white/85">
        <span className="font-semibold text-class-ink">Add your class schedule?</span> Paste it from your student portal and your lectures,
        tutorials and labs show up on your calendar.
      </p>
      <div className="flex items-center gap-5">
        <button type="button" onClick={onNotNow} className={textButton}>
          Not now
        </button>
        <Link
          href="/classes"
          className="sf-press rounded-full border border-class/80 bg-class/15 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-class-ink transition hover:bg-class/25"
        >
          Add classes
        </Link>
      </div>
    </div>
  );
}

function RemindersCard({onNotNow, onSetUp}: {onNotNow: () => void; onSetUp: () => void}) {
  return (
    <div className="sf-card sf-in mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:mt-8">
      <p className="max-w-md text-sm leading-relaxed text-white/85 text-pretty">
        <span className="font-semibold text-scene-ink">Want a nudge before each session?</span> Zeflo can remind you before sessions and tests,
        even when it&apos;s closed.
      </p>
      <div className="flex items-center gap-5">
        <button type="button" onClick={onNotNow} className={textButton}>
          Not now
        </button>
        <button type="button" aria-haspopup="dialog" onClick={onSetUp} className="sf-primary px-5 py-2 text-[11px] uppercase tracking-[0.2em]">
          Set up
        </button>
      </div>
    </div>
  );
}

// Floats over the page (above the tab bar on phones, in the corner on computers), since it's
// about the device rather than anything on the page.
function InstallPopup({onNotNow, onShowMe, onInstalled}: {onNotNow: () => void; onShowMe: () => void; onInstalled: () => void}) {
  const install = useInstall();
  if (!install) return null;
  const phone = isPhone(install.platform);
  const title = phone ? "Get Zeflo on your Home Screen" : install.platform === "mac-safari" ? "Get Zeflo in your Dock" : "Install Zeflo on this computer";

  return (
    <div
      role="dialog"
      aria-label={title}
      className={`${FLOATING} sf-float p-4 [text-shadow:none]`}
    >
      <div className="flex gap-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 44px icon */}
        <img src="/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-[0.8rem] shadow-lg" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/70 text-pretty">
            {phone
              ? "Opens like any app, full screen, with reminders before your sessions. No App Store needed."
              : "Its own window, one click away, with reminders before your sessions. Nothing to download."}
          </p>
        </div>
      </div>
      <div className="mt-3.5 flex items-center justify-end gap-5">
        <button type="button" onClick={onNotNow} className={textButton}>
          Not now
        </button>
        <button
          type="button"
          aria-haspopup={install.canPrompt ? undefined : "dialog"}
          onClick={async () => {
            if (install.canPrompt) {
              if (await promptInstall()) onInstalled();
            } else onShowMe();
          }}
          className="sf-primary px-5 py-2 text-[11px] uppercase tracking-[0.2em]"
        >
          {install.canPrompt ? "Install" : "Show me how"}
        </button>
      </div>
    </div>
  );
}

type Kind = "classes" | "install" | "reminders";

export default function Nudges() {
  const pathname = usePathname();
  const {classes, loaded, promptDismissed, dismissPrompt} = useClasses();
  const {prefs, setPrefs} = usePrefs();
  const install = useInstall();
  const {status} = useReminders();
  const [done, setDone] = useState(false); // one "Not now" per visit: then nothing else
  const [note, setNote] = useState<{text: string; floating: boolean} | null>(null);
  const [installOpens, setInstallOpens] = useState(0);
  const [remindersOpens, setRemindersOpens] = useState(0);
  // The install offer waits a moment after Today opens, so it isn't the first thing in the way.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(id);
  }, []);

  const today = pathname === "/";
  const canInstall =
    install !== null &&
    !install.installed &&
    // Chrome and Edge on a computer say when Zeflo can be installed (and not when it already is).
    (install.platform === "iphone" || install.platform === "android" || install.platform === "mac-safari" || install.canPrompt) &&
    !installOfferDismissed();

  // The first one that applies, if any. Classes can't wait for Today; the others can.
  let next: Kind | null = null;
  if (loaded && classes.length === 0 && promptDismissed === false) next = pathname === "/classes" ? null : "classes";
  else if (loaded && prefs && today) {
    if (canInstall) next = settled ? "install" : null;
    else if (status === "off" && !prefs.remindersHintDismissed) next = "reminders";
  }
  if (done) next = null;

  const closeNote = useCallback(() => setNote(null), []);
  const notNow = (text: string, remember: () => void, floating = false) => () => {
    remember();
    setDone(true);
    setNote({text, floating});
  };

  return (
    <>
      {note && <Note text={note.text} floating={note.floating} onClose={closeNote} />}
      {next === "classes" && <ClassesCard onNotNow={notNow("No problem. You can add your classes any time from the Classes tab.", dismissPrompt)} />}
      {next === "reminders" && (
        <RemindersCard
          onNotNow={notNow("No problem. Reminders are in Settings → Reminders whenever you want them.", () => setPrefs({remindersHintDismissed: true}))}
          onSetUp={() => setRemindersOpens((n) => n + 1)}
        />
      )}
      {next === "install" && (
        <InstallPopup
          onNotNow={notNow("No problem. You can get the app any time from Settings → Get the app.", dismissInstallOffer, true)}
          // Either way they've seen it: nothing else is offered this visit. Without a "Not now",
          // the offer comes back next time if they didn't get the app.
          onShowMe={() => {
            setDone(true);
            setInstallOpens((n) => n + 1);
          }}
          onInstalled={() => setDone(true)}
        />
      )}
      <InstallGuide opens={installOpens} />
      <Reminders opens={remindersOpens} />
    </>
  );
}
