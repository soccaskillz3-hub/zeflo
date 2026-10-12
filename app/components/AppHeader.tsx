"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import type {ReactNode} from "react";
import MuteButton from "./MuteButton";
import SettingsMenu from "./SettingsMenu";
import {formatDay} from "../lib/days";
import {useSchedule} from "../lib/schedule";
import {useSlidingPill} from "../lib/useSlidingPill";

// The app's sections. Wide screens open the calendar on the week; phones (in the tab bar) on the
// day, since the week needs seven columns. The calendar pages switch between views themselves.
type Section = {label: string; href: string; phoneHref?: string; icon: ReactNode; current: (path: string) => boolean};

const stroke = {fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round"} as const;

const SECTIONS: Section[] = [
  {
    label: "Today",
    href: "/",
    current: (p) => p === "/",
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke}>
        <circle cx="10" cy="10" r="3.4" />
        <path d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1" />
      </svg>
    ),
  },
  {
    label: "Calendar",
    href: "/calendar/week",
    phoneHref: "/calendar",
    current: (p) => p.startsWith("/calendar"),
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke}>
        <rect x="3" y="4.2" width="14" height="12.8" rx="2.4" />
        <path d="M3 8.2h14M7 2.8v2.6M13 2.8v2.6" />
        <path d="M6.6 11.4h2.2M11.2 11.4h2.2M6.6 14h2.2" />
      </svg>
    ),
  },
  {
    label: "Progress",
    href: "/progress",
    current: (p) => p === "/progress",
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke}>
        <path d="M3.5 16.5h13" />
        <rect x="4.6" y="10.5" width="2.6" height="6" rx="0.8" />
        <rect x="8.7" y="6.5" width="2.6" height="10" rx="0.8" />
        <rect x="12.8" y="3.5" width="2.6" height="13" rx="0.8" />
      </svg>
    ),
  },
  {
    label: "Classes",
    href: "/classes",
    current: (p) => p === "/classes",
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5" {...stroke}>
        <path d="M10 5.2C8.4 4 6 3.5 3.5 3.8v11.4c2.5-.3 4.9.2 6.5 1.4 1.6-1.2 4-1.7 6.5-1.4V3.8C14 3.5 11.6 4 10 5.2Z" />
        <path d="M10 5.2v11.4" />
      </svg>
    ),
  },
];

function SectionLinks({path}: {path: string}) {
  const {list, pill} = useSlidingPill(path);
  return (
    <nav aria-label="Sections" className="max-sm:hidden">
      <div ref={list} className="sf-card relative flex rounded-full p-1">
        <span ref={pill} className="sf-nav-pill" aria-hidden style={{top: 4, bottom: 4}} />
        {SECTIONS.map((s) => {
          const current = s.current(path);
          return (
            <Link
              key={s.label}
              href={s.href}
              aria-current={current ? "page" : undefined}
              className={`relative rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.22em] transition-colors lg:px-5 ${
                current ? "text-scene-ink" : "text-white/65 hover:text-white"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Phones: the sections as a bar at the bottom of the screen, in reach of a thumb.
function TabBar({path}: {path: string}) {
  const {list, pill} = useSlidingPill(path);
  return (
    <nav aria-label="Sections" className="sf-tabbar sm:hidden">
      <div ref={list} className="sf-card relative mx-auto grid max-w-md grid-cols-4 rounded-[1.4rem] p-1.5">
        <span ref={pill} className="sf-nav-pill rounded-2xl" aria-hidden style={{top: 6, bottom: 6, borderRadius: "1rem"}} />
        {SECTIONS.map((s) => {
          const current = s.current(path);
          return (
            <Link
              key={s.label}
              href={s.phoneHref ?? s.href}
              aria-current={current ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 rounded-2xl py-2 transition-colors ${
                current ? "text-scene-ink" : "text-white/60"
              }`}
            >
              {s.icon}
              <span className="text-[9px] uppercase tracking-[0.18em]">{s.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  // The visitor's own day, known only once mounted: the server runs on UTC, which can already be
  // tomorrow (or still yesterday). It also turns over at midnight while the page is open.
  const {today: day} = useSchedule();
  const today = day ? formatDay(day, {weekday: "long", month: "short", day: "numeric"}) : "";
  // Phones don't have room for the full weekday next to the buttons.
  const todayShort = day ? formatDay(day, {weekday: "short", month: "short", day: "numeric"}) : "";

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm font-semibold tracking-[0.3em] text-white sm:tracking-[0.4em]">
          ZEFLO
        </Link>
        <SectionLinks path={pathname} />
        <div className="flex items-center gap-4 sm:gap-5">
          {/* The date: short on phones, full on wide screens, and left out where the section links
              need the room (and on the narrowest phones). */}
          <p className="whitespace-nowrap text-[11px] uppercase tracking-[0.2em] text-white/75 max-[359px]:hidden sm:max-lg:hidden lg:tracking-[0.3em]">
            <span className="hidden lg:inline">{today}</span>
            <span className="lg:hidden">{todayShort}</span>
          </p>
          <Link
            href="/clock"
            aria-label="Open the clock"
            title="Clock"
            className="-m-2 flex h-9 w-9 items-center justify-center rounded-md text-white/75 transition hover:bg-white/[0.06] hover:text-white"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <circle cx="8" cy="8" r="5.8" />
              <path d="M8 4.8V8l2.2 1.4" />
            </svg>
          </Link>
          <MuteButton />
          <SettingsMenu />
        </div>
      </header>
      <TabBar path={pathname} />
    </>
  );
}
