"use client";

import {useEffect, useRef, useState, type ReactNode} from "react";
import {isPhone, promptInstall, useInstall, type Platform} from "../lib/install";

// How to get Zeflo on this device as an app, step by step for the browser it's open in, since
// Zeflo isn't in an app store. Opens each time `opens` goes up, like the other windows.

const label = "text-[11px] uppercase tracking-[0.25em] text-white/70";
const strong = "text-white";

// Each browser's buttons, drawn the way it shows them, so the steps can be followed by eye.
const icon = "inline h-3.5 w-3.5 align-[-2px]";
export const MoreIcon = () => (
  <svg viewBox="0 0 16 16" className={icon} fill="currentColor" aria-label="•••">
    <circle cx="3" cy="8" r="1.4" />
    <circle cx="8" cy="8" r="1.4" />
    <circle cx="13" cy="8" r="1.4" />
  </svg>
);
// Safari's page menu in the address bar (iOS 26): lines of different lengths.
const PageMenuIcon = () => (
  <svg viewBox="0 0 16 16" className={icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-label="page menu">
    <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />
  </svg>
);
const MenuIcon = () => (
  <svg viewBox="0 0 16 16" className={icon} fill="currentColor" aria-label="⋮">
    <circle cx="8" cy="3" r="1.4" />
    <circle cx="8" cy="8" r="1.4" />
    <circle cx="8" cy="13" r="1.4" />
  </svg>
);
export const ShareIcon = () => (
  <svg viewBox="0 0 16 16" className={icon} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
    <path d="M8 1.8v8.4M5.2 4.4 8 1.6l2.8 2.8M5.4 6.6H4.2v7.6h7.6V6.6h-1.2" />
  </svg>
);
const InstallIcon = () => (
  <svg viewBox="0 0 16 16" className={icon} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Install">
    <rect x="1.8" y="2.6" width="12.4" height="8.6" rx="1.4" />
    <path d="M5.6 13.6h4.8M8 4.6v4.2M6.2 7.2 8 9l1.8-1.8" />
  </svg>
);

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

const Steps = ({children}: {children: ReactNode}) => <ol className="space-y-3">{children}</ol>;

// The steps alone, also used by Settings → Reminders (an iPhone needs Zeflo installed for them).
export function InstallSteps({platform}: {platform: Platform}) {
  if (platform === "iphone") {
    return (
      <Steps>
        <Step n={1}>
          In Safari, tap <PageMenuIcon /> in the address bar (or <MoreIcon /> beside it), then <span className={strong}>Share</span>. On older
          iPhones, tap <ShareIcon /> at the bottom. In Chrome, tap <ShareIcon /> in the address bar.
        </Step>
        <Step n={2}>
          Scroll down and tap <span className={strong}>Add to Home Screen</span>. If it&apos;s not there, tap View More.
        </Step>
        <Step n={3}>
          Leave <span className={strong}>Open as Web App</span> on, tap <span className={strong}>Add</span>, and open Zeflo from your Home Screen.
        </Step>
      </Steps>
    );
  }
  if (platform === "android") {
    return (
      <Steps>
        <Step n={1}>
          In Chrome, tap <MenuIcon /> at the top right.
        </Step>
        <Step n={2}>
          Tap <span className={strong}>Add to Home screen</span>, then <span className={strong}>Install</span>. (Samsung Internet: the menu, then Add
          page to → Home screen.)
        </Step>
        <Step n={3}>Open Zeflo from your Home Screen.</Step>
      </Steps>
    );
  }
  if (platform === "mac-safari") {
    return (
      <Steps>
        <Step n={1}>
          In the menu bar, choose <span className={strong}>File → Add to Dock</span>. Or click <ShareIcon /> in Safari&apos;s toolbar, then Add to
          Dock.
        </Step>
        <Step n={2}>
          Click <span className={strong}>Add</span>. Zeflo opens from your Dock in its own window.
        </Step>
      </Steps>
    );
  }
  if (platform === "desktop") {
    return (
      <Steps>
        <Step n={1}>
          Click <InstallIcon /> at the right end of the address bar.
          <span className="mt-1 block text-[11px] text-white/55">
            Not there? Chrome: <MenuIcon /> → Cast, save and share → Install page as app. Edge: <MoreIcon /> → Apps → Install this site as an
            app.
          </span>
        </Step>
        <Step n={2}>
          Click <span className={strong}>Install</span>. Zeflo opens in its own window, and you&apos;ll find it with your other apps.
        </Step>
      </Steps>
    );
  }
  if (platform === "firefox") {
    return (
      <p className="text-xs leading-relaxed text-white/80">
        Firefox can&apos;t install websites as apps. Open Zeflo in <span className={strong}>Chrome</span>, <span className={strong}>Edge</span> or{" "}
        <span className={strong}>Safari</span> and install it from there; your account and everything in it come along.
      </p>
    );
  }
  return (
    <p className="text-xs leading-relaxed text-white/80">
      Look in your browser&apos;s menu for <span className={strong}>Add to Home Screen</span> or <span className={strong}>Install app</span>.
    </p>
  );
}

const TITLES: Record<Platform, ReactNode> = {
  iphone: (
    <>
      Zeflo, <em>on your Home Screen.</em>
    </>
  ),
  android: (
    <>
      Zeflo, <em>on your Home Screen.</em>
    </>
  ),
  "mac-safari": (
    <>
      Zeflo, <em>in your Dock.</em>
    </>
  ),
  desktop: (
    <>
      Zeflo, <em>as an app.</em>
    </>
  ),
  firefox: (
    <>
      Zeflo, <em>as an app.</em>
    </>
  ),
  other: (
    <>
      Zeflo, <em>as an app.</em>
    </>
  ),
};

export default function InstallGuide({opens}: {opens: number}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const install = useInstall();
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (opens && d && !d.open) d.showModal();
  }, [opens]);

  const platform = install?.platform ?? "other";
  const phone = isPhone(platform);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="install-title"
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      className="sf-panel sf-pop sf-dialog-fit m-auto w-[min(30rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-0 font-mono text-white [text-shadow:none] backdrop:bg-slate-950/55 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <p className={label}>Get the app</p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="-m-2 flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none text-white/60 transition hover:bg-white/[0.06] hover:text-white"
          >
            ×
          </button>
        </div>
        <h2 id="install-title" className="sf-serif mt-2 text-3xl leading-tight text-balance">
          {TITLES[platform]}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/75 text-pretty">
          {phone
            ? "One tap from your Home Screen, full screen with no browser around it, and reminders before your sessions. No app store, and it always has the latest version."
            : "Its own window and a place in your Dock or taskbar, a click away, with reminders before your sessions. Nothing to download, and it always has the latest version."}
        </p>

        <div className="mt-5 rounded-xl border border-scene/30 bg-scene/[0.07] p-4">
          {install?.installed ? (
            <p className="flex items-center gap-2.5 text-xs text-white/90">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.7)]" aria-hidden />
              You&apos;re using the Zeflo app on this device.
            </p>
          ) : install?.canPrompt && !declined ? (
            // Chrome and Edge can install it in one click, with their own window.
            <div>
              <button
                type="button"
                onClick={async () => {
                  if (!(await promptInstall())) setDeclined(true);
                }}
                className="sf-primary w-full px-5 py-3 text-[11px] uppercase tracking-[0.2em]"
              >
                Install Zeflo
              </button>
              <p className="mt-2 text-center text-[11px] text-white/55">Your browser asks you to confirm.</p>
            </div>
          ) : (
            <InstallSteps platform={platform} />
          )}
        </div>

        {platform === "iphone" && !install?.installed && (
          <p className="mt-4 text-[11px] leading-relaxed text-white/50">On iPhone, being on your Home Screen is also what lets Zeflo send reminders.</p>
        )}
      </div>
    </dialog>
  );
}
