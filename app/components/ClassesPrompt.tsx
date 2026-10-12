"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import {useClasses} from "../lib/classes";

const button = "text-xs uppercase tracking-[0.25em] transition";

// Asks people who haven't added classes whether they'd like to. "Not now" is remembered on
// their account; the option stays in Settings > Classes.
export default function ClassesPrompt() {
  const {classes, loaded, promptDismissed, dismissPrompt} = useClasses();
  const pathname = usePathname();
  const [justDismissed, setJustDismissed] = useState(false);

  if (justDismissed) {
    return (
      <div role="status" className="sf-card mt-6 flex items-center justify-between gap-4 px-5 py-4">
        <p className="text-sm text-white/75">No problem. You can add your classes any time from Settings → Classes.</p>
        <button type="button" onClick={() => setJustDismissed(false)} aria-label="Close" className="px-2 text-lg text-white/50 hover:text-white">
          ×
        </button>
      </div>
    );
  }

  if (!loaded || classes.length > 0 || promptDismissed !== false || pathname === "/classes") return null;

  return (
    <div className="sf-card mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:mt-8">
      <p className="max-w-md text-sm leading-relaxed text-white/85">
        <span className="font-semibold text-class-ink">Add your class schedule?</span> Paste it from your student portal
        and your lectures, tutorials and labs show up on your calendar.
      </p>
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => {
            dismissPrompt();
            setJustDismissed(true);
          }}
          className={`${button} text-white/60 hover:text-white`}
        >
          Not now
        </button>
        <Link href="/classes" className="sf-press rounded-full border border-class/80 bg-class/15 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-class-ink transition hover:bg-class/25">
          Add classes
        </Link>
      </div>
    </div>
  );
}
