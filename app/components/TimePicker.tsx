"use client";

import {useEffect, useId, useLayoutEffect, useRef, useState} from "react";
import {formatTime, fromParts, toParts} from "../lib/time";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_STEP = 15;
const ROW = 36; // px per row; the column shows five, with the picked one in the middle
const COPIES = 9; // looping columns repeat their values, and quietly re-center when you stop

// One wheel of choices, like a phone's: it snaps a row at a time, and the hours and minutes loop
// forever. The row in the middle is the pick; click a row to bring it there. Arrow keys step.
function Wheel({label, labels, index, onIndex, loop = false, className = ""}: {label: string; labels: string[]; index: number; onIndex: (i: number) => void; loop?: boolean; className?: string}) {
  const n = labels.length;
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const placed = useRef(false);
  const [live, setLive] = useState(index);
  const copies = loop ? COPIES : 1;
  const mid = loop ? Math.floor(COPIES / 2) : 0;

  // Put the pick in the middle on open, and again if it's changed from outside.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!placed.current || (Math.round(el.scrollTop / ROW) % n + n) % n !== index) {
      el.scrollTop = (mid * n + index) * ROW;
      placed.current = true;
    }
    setLive(index);
  }, [index, n, mid]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / ROW);
    const v = ((i % n) + n) % n;
    setLive(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // Stopped: step back to the middle copy (same row, so nothing visibly moves).
      if (loop && (i < n * 2 || i >= n * copies - n * 2)) el.scrollTop = (mid * n + v) * ROW;
      if (v !== index) onIndex(v);
    }, 90);
  };

  const step = (by: number) => {
    const el = ref.current;
    if (el) el.scrollTo({top: (Math.round(el.scrollTop / ROW) + by) * ROW, behavior: "smooth"});
  };

  return (
    <div className={`relative ${className}`}>
      <div className="sf-panel-active pointer-events-none absolute inset-x-0 rounded-md" style={{top: ROW * 2, height: ROW}} aria-hidden />
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          e.preventDefault();
          step(e.key === "ArrowDown" ? 1 : -1);
        }}
        className="sf-picker-col relative overflow-y-auto overscroll-contain rounded-md outline-none focus-visible:ring-1 focus-visible:ring-white/50"
        style={{height: ROW * 5, paddingBlock: ROW * 2, scrollSnapType: "y mandatory", touchAction: "pan-y"}}
      >
        {Array.from({length: n * copies}, (_, i) => {
          const v = i % n;
          return (
            <div
              key={i}
              role="option"
              aria-selected={v === live}
              onClick={() => step(i - Math.round((ref.current?.scrollTop ?? 0) / ROW))}
              className={`flex cursor-pointer items-center justify-center text-sm tabular-nums transition-colors ${v === live ? "text-white" : "text-white/50 hover:text-white/80"}`}
              style={{height: ROW, scrollSnapAlign: "center"}}
            >
              {labels[v]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  value: string; // "HH:MM" or "" when unset
  onChange: (value: string) => void;
  label: string;
  placeholder?: string; // shown before a time is picked
  // Time to start from when nothing is picked yet.
  suggestion: string;
  align?: "left" | "right";
  inline?: boolean; // just the time as text, e.g. inside a calendar block
};

export default function TimePicker({value, onChange, label, placeholder = "Pick a time", suggestion, align = "left", inline = false}: Props) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const {hour12, minute, pm} = toParts(value || suggestion);
  const minutes = Array.from({length: 60 / MINUTE_STEP}, (_, i) => i * MINUTE_STEP);
  // Keep an off-step minute (e.g. 10:43 saved earlier) selectable.
  if (!minutes.includes(minute)) {
    minutes.push(minute);
    minutes.sort((a, b) => a - b);
  }

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const panel = root.current;
    panel?.querySelector<HTMLElement>("[role=listbox]")?.focus({preventScroll: true});

    const onPointerDown = (e: PointerEvent) => {
      if (!panel?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    // Wide enough for "10:00 AM" even where the form is tight on space.
    <div ref={root} className={inline ? "relative inline-block" : "relative min-w-[7rem] flex-1"}>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          // Open upward when there isn't room for the panel below the field.
          const rect = trigger.current?.getBoundingClientRect();
          if (rect) setOpenUp(window.innerHeight - rect.bottom < 300 && rect.top > 300);
          setOpen((o) => !o);
        }}
        className={
          inline
            ? `rounded-sm tabular-nums underline decoration-dotted underline-offset-[3px] outline-none transition hover:text-white focus-visible:ring-1 focus-visible:ring-scene ${
                open ? "text-white decoration-scene" : "decoration-white/35"
              }`
            : `flex w-full items-center justify-between gap-2 border-b px-1 py-2 text-left tabular-nums outline-none transition focus-visible:border-scene ${
                open ? "border-scene" : "border-white/30 hover:border-white/60"
              }`
        }
      >
        {inline ? (
          value ? formatTime(value) : placeholder
        ) : (
          <>
            <span className={`truncate whitespace-nowrap ${value ? "text-white" : "text-white/45"}`}>{value ? formatTime(value) : placeholder}</span>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-white/50" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="8" cy="8" r="6.25" />
              <path d="M8 4.5V8l2.3 1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
          className={`sf-pop absolute z-30 w-56 ${openUp ? "bottom-full mb-2 [--pop-y:4px]" : "top-full mt-2"} sf-panel rounded-xl border p-2 [text-shadow:none] ${
            align === "right" ? "right-0" : "left-0"
          } ${openUp ? (align === "right" ? "origin-bottom-right" : "origin-bottom-left") : align === "right" ? "origin-top-right" : "origin-top-left"}`}
        >
          <div className="flex gap-1">
            <Wheel
              label="Hour"
              className="flex-1"
              loop
              labels={HOURS.map(String)}
              index={HOURS.indexOf(hour12)}
              onIndex={(i) => onChange(fromParts(HOURS[i], minute, pm))}
            />
            <Wheel
              label="Minute"
              className="flex-1"
              loop
              labels={minutes.map((m) => String(m).padStart(2, "0"))}
              index={minutes.indexOf(minute)}
              onIndex={(i) => onChange(fromParts(hour12, minutes[i], pm))}
            />
            <Wheel
              label="AM or PM"
              className="w-14 shrink-0"
              labels={["AM", "PM"]}
              index={pm ? 1 : 0}
              onIndex={(i) => onChange(fromParts(hour12, minute, i === 1))}
            />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-dashed border-white/15 px-1 pt-2">
            <span className="text-xs text-scene-soft tabular-nums">{formatTime(fromParts(hour12, minute, pm))}</span>
            <button
              type="button"
              onClick={() => {
                onChange(fromParts(hour12, minute, pm));
                close();
              }}
              className="border border-scene/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-scene-ink transition hover:bg-scene/15"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
