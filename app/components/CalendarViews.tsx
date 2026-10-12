"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useSlidingPill} from "../lib/useSlidingPill";

// Switches between the calendar's views. The week needs seven columns, so phones don't get it.
const VIEWS = [
  {href: "/calendar", label: "Day"},
  {href: "/calendar/week", label: "Week", wideOnly: true},
  {href: "/calendar/schedule", label: "List"},
];

export default function CalendarViews() {
  const pathname = usePathname();
  const {list, pill} = useSlidingPill(pathname);
  return (
    <nav aria-label="Calendar views">
      <div ref={list} className="sf-card relative inline-flex rounded-full p-1">
        <span ref={pill} className="sf-nav-pill" aria-hidden style={{top: 4, bottom: 4}} />
        {VIEWS.map((v) => {
          const current = pathname === v.href;
          return (
            <Link
              key={v.href}
              href={v.href}
              aria-current={current ? "page" : undefined}
              className={`relative rounded-full px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] transition-colors ${
                current ? "text-scene-ink" : "text-white/65 hover:text-white"
              } ${v.wideOnly ? "max-sm:hidden" : ""}`}
            >
              {v.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
