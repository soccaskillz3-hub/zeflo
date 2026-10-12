import type {CSSProperties} from "react";
import Link from "next/link";
import DevLogin from "../components/DevLogin";
import AccountDeleted from "./AccountDeleted";
import LiveSky from "./LiveSky";
import Story from "./Story";

// The front door for people who aren't logged in. The proxy shows it at "/" (and sends
// logged-in visitors straight to the dashboard instead). The hero, then how Zeflo works as a
// scroll story over the live scene (Story), then the way in.

const HEADLINE = "Plan your study day. Then actually do it.".split(" ");

function SignUpLinks() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <Link
        href="/signup"
        className="border border-scene/70 bg-slate-950/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-scene-ink transition hover:bg-scene/15 sf-press"
      >
        Create an account
      </Link>
      <Link
        href="/login"
        className="sf-press text-xs uppercase tracking-[0.25em] text-scene-soft underline decoration-scene/40 underline-offset-4 transition hover:text-scene-ink"
      >
        I already have one
      </Link>
    </div>
  );
}

export default async function WelcomePage({searchParams}: PageProps<"/welcome">) {
  const {deleted} = await searchParams;
  return (
    <main className="sf-lift flex flex-1 flex-col font-mono text-white">
      <div className="wl-hero mx-auto flex w-full max-w-6xl flex-col px-5 pt-10 sm:px-10 sm:pt-12">
        <header className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold tracking-[0.4em]">ZEFLO</span>
          <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-white/75 transition hover:text-white">
            Log in
          </Link>
        </header>

        <section className="mt-auto pb-10 pt-16 sm:pb-14">
          {deleted === "1" && <AccountDeleted />}
          <div className="min-h-4">
            <LiveSky />
          </div>
          <h1 className="sf-serif mt-6 max-w-4xl text-balance text-[clamp(2.9rem,8.4vw,7rem)] leading-[0.94]">
            {HEADLINE.map((word, i) => (
              <span key={i}>
                <span className="wl-word" style={{"--i": i} as CSSProperties}>
                  {word === "actually" ? <em>{word}</em> : word}
                </span>{" "}
              </span>
            ))}
          </h1>
          <p className="mt-7 max-w-xl text-pretty text-sm leading-relaxed text-white/80 sm:text-base">
            Zeflo turns your class schedule into a study plan, then gets you through it: a focus timer, a streak to keep, and a sky that
            matches yours.
          </p>
          <div className="mt-9">
            <SignUpLinks />
          </div>
          <p className="wl-cue mt-14 flex items-center gap-3 text-[10px] uppercase tracking-[0.35em] text-white/60" aria-hidden>
            <span className="wl-cue-line" />
            Scroll to see a week come together
          </p>
        </section>
      </div>

      <Story />

      <section className="wl-end mx-auto w-full max-w-6xl px-5 pb-28 pt-24 sm:px-10 sm:pt-32">
        <p className="text-[11px] uppercase tracking-[0.3em] text-scene-ink">About a minute, start to finish</p>
        <h2 className="sf-serif mt-5 max-w-3xl text-balance text-[clamp(2.3rem,6vw,4.75rem)] leading-[0.98]">
          One paste. One question. <em>Your week&apos;s planned.</em>
        </h2>
        <p className="mt-6 max-w-lg text-pretty text-sm leading-relaxed text-white/80">
          Paste your classes, ask your AI to plan around them, press Start. Imports from Waterloo, TMU and York, or any school&apos;s
          calendar file. Your schedule and progress are private to your account.
        </p>
        <div className="mt-9">
          <SignUpLinks />
        </div>
        <DevLogin />
        <nav className="mt-20 flex gap-5 text-[11px] uppercase tracking-[0.25em] text-white/55">
          <Link href="/privacy" className="transition hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-white">
            Terms
          </Link>
          <Link href="/support" className="transition hover:text-white">
            Support
          </Link>
        </nav>
      </section>
    </main>
  );
}
