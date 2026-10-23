"use client";

import {useEffect, useRef, useState, type CSSProperties} from "react";
import Flame from "../components/Flame";
import {useScene, type ScenePreview} from "../lib/scene";

// How Zeflo works, told as you scroll: a model of the planner floats in 3D, and each chapter
// shows one thing it does that other planners don't. The stage stays pinned while the page
// scrolls past it; scroll position becomes --p and per-chapter progress --c0…--c4 (set here,
// on the stage, each frame), and the CSS in globals.css (.wl-*) turns those into motion.
// Plain CSS 3D rather than WebGL, so text stays sharp and phones stay smooth.
//
// Each chapter is also a resting point (CSS scroll snapping, .wl-snap): wherever a scroll
// ends, the page glides onto the nearest chapter with its animation finished, and a fast flick
// stops at the next one rather than skipping past it.

const CHAPTERS = [
  {
    kicker: "Setup",
    title: "Paste your timetable. That's the setup.",
    body: "Copy your schedule from Quest, York or TMU, or drop in a calendar file. Every class lands on your calendar in its own colour, every week of the term.",
    versus: "an evening of typing it all in.",
  },
  {
    kicker: "Planning",
    title: "Ask your AI to plan the week.",
    body: "Connect Claude or ChatGPT and tell it what's coming up. It sees your classes and your tests, finds the gaps, and puts study sessions straight onto your calendar.",
    versus: "you work out when, on your own.",
  },
  {
    kicker: "Focus",
    title: "Press Start. Everything else goes quiet.",
    body: "Today's sessions each get a Start button. It opens a full-screen timer with breaks built in, so the plan turns into hours you actually studied.",
    versus: "a reminder, then you're on your own.",
  },
  {
    kicker: "Atmosphere",
    title: "It looks like it does outside.",
    body: "Zeflo follows the real time and weather where you are: sunrise, a grey afternoon, rain at dusk, snow at night. Study by the ocean or in the forest.",
    versus: "the same white grid, forever.",
  },
  {
    kicker: "Progress",
    title: "Watch the streak build.",
    body: "Tick off a session and the flame lights. Your week fills in bar by bar, and every day you study shows up on one grid.",
    versus: "a list you quietly stop opening.",
  },
];

// The skies chapter 4 plays through by itself, on the real backdrop behind the page.
const SKIES: (ScenePreview & {label: string; clock: string})[] = [
  {theme: "ocean", time: "sunrise", weather: "clear", label: "Sunrise", clock: "6:40 AM"},
  {theme: "ocean", time: "day", weather: "cloudy", label: "A grey afternoon", clock: "1:15 PM"},
  {theme: "ocean", time: "dusk", weather: "rain", label: "Rain at dusk", clock: "7:05 PM"},
  {theme: "forest", time: "dusk", weather: "clear", label: "Dusk in the forest", clock: "7:20 PM"},
  {theme: "forest", time: "night", weather: "snow", label: "Snow at midnight", clock: "11:50 PM"},
];

// A Wednesday in the model planner, 9 AM to 6 PM, in minutes after midnight.
const DAY_START = 9 * 60;
const DAY_LENGTH = 9 * 60;
const HOURS = ["9 AM", "10", "11", "12 PM", "1", "2", "3", "4", "5", "6 PM"];

const PASTED = [
  "CS 135    LEC 001  MWF 10:30-11:20  MC 2065",
  "MATH 135  LEC 004  MWF 13:00-13:50  DC 1350",
  "ECON 101  TUT 102  W   15:30-16:20  HH 1102",
];
const CLASSES = [
  {name: "CS 135", kind: "Lecture", start: 630, end: 680, at: "10:30"},
  {name: "MATH 135", kind: "Lecture", start: 780, end: 830, at: "1:00"},
  {name: "ECON 101", kind: "Tutorial", start: 930, end: 980, at: "3:30"},
];
const SESSIONS = [
  {name: "CS 135 · midterm review", start: 540, end: 615, at: "9:00"},
  {name: "MATH 135 · problem set", start: 705, end: 765, at: "11:45"},
  {name: "CS 135 · practice exam", start: 855, end: 915, at: "2:15"},
];

const place = (start: number, end: number) => ({
  top: `${((start - DAY_START) / DAY_LENGTH) * 100}%`,
  height: `${((end - start) / DAY_LENGTH) * 100}%`,
});

// Months of studying on the progress grid: busier towards the present. Seeded, so the server
// and the browser draw the same pattern.
const WEEKS = 18;
const hash = (n: number) => {
  let h = Math.imul(n + 0x9e37, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const HEAT = Array.from({length: WEEKS * 7}, (_, i) => {
  const recent = Math.floor(i / 7) / (WEEKS - 1);
  if (hash(i) > 0.12 + recent * 0.8) return 0; // 0 = nothing, 1–3 = more and more
  return Math.min(3, 1 + Math.floor(hash(i + 999) * (1.4 + recent * 2)));
});
const WEEK_BARS = [0.55, 0.8, 0.35, 0.95, 0.7, 0.25, 0.6];

const SKY_MS = 2600;
// Where in its stretch each chapter rests: late enough that its animation has finished, early
// enough that its words are still fully shown.
const REST = 0.8;

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (t: number) => t * t * (3 - 2 * t);

function Countdown({running}: {running: boolean}) {
  const [left, setLeft] = useState(25 * 60);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 25 * 60)), 1000);
    return () => clearInterval(id);
  }, [running]);
  const m = String(Math.floor(left / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  return (
    <p className="wl-timer-digits font-display tabular-nums">
      {m}
      <span className="sf-clock-colon">:</span>
      {s}
    </p>
  );
}

export default function Story() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [skyStep, setSkyStep] = useState(0);
  const snaps = useRef<(HTMLSpanElement | null)[]>([]);
  const {previewScene} = useScene();

  useEffect(() => {
    const el = section.current;
    const st = stage.current;
    if (!el || !st) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const n = CHAPTERS.length;
    let target = 0;
    let current = -1;
    // Where the pointer is, from -1 to 1 across the screen: the model leans towards it a little.
    const look = {x: 0, y: 0, tx: 0, ty: 0};
    let raf = 0;

    const apply = (p: number) => {
      const x = p * n;
      st.style.setProperty("--p", p.toFixed(4));
      for (let i = 0; i < n; i++) {
        st.style.setProperty(`--c${i}`, smooth(clamp(x - i)).toFixed(4));
        // How visible chapter i's words are: fully, through the middle of its stretch, fading
        // out at the edges (except before the first and after the last).
        const d = x - (i + 0.5);
        const away = (i === 0 && d < 0) || (i === n - 1 && d > 0) ? 0 : Math.abs(d);
        st.style.setProperty(`--v${i}`, smooth(clamp((0.5 - away) / 0.14)).toFixed(4));
      }
      const at = Math.min(n - 1, Math.floor(x));
      st.dataset.chapter = String(at);
      setChapter(x >= n ? n : at); // n: scrolled past the story
    };

    // Eases towards the scroll position (and the pointer) rather than snapping to it, so the
    // model has a little weight. Stops when it arrives.
    const frame = () => {
      const ease = still.matches ? 1 : 0.14;
      current = current < 0 ? target : current + (target - current) * ease;
      if (Math.abs(target - current) < 0.0005) current = target;
      look.x += (look.tx - look.x) * 0.08;
      look.y += (look.ty - look.y) * 0.08;
      const looking = Math.abs(look.tx - look.x) + Math.abs(look.ty - look.y) > 0.002;
      st.style.setProperty("--mx", look.x.toFixed(4));
      st.style.setProperty("--my", look.y.toFixed(4));
      apply(current);
      raf = current === target && !looking ? 0 : requestAnimationFrame(frame);
    };
    const point = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || still.matches) return;
      look.tx = (e.clientX / window.innerWidth) * 2 - 1;
      look.ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    // Puts each chapter's resting point where the story shows that chapter at REST. The page
    // snaps below the status bar (scroll-padding-top), hence the body's top padding.
    const place = () => {
      const run = el.offsetHeight - window.innerHeight;
      const inset = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
      snaps.current.forEach((s, i) => s && (s.style.top = `${((i + REST) / n) * run + inset}px`));
    };
    const measure = () => {
      const r = el.getBoundingClientRect();
      const run = r.height - window.innerHeight;
      target = run > 0 ? clamp(-r.top / run) : 0;
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      place();
      measure();
    };

    resize();
    window.addEventListener("scroll", measure, {passive: true});
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", point, {passive: true});
    return () => {
      window.removeEventListener("pointermove", point);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  // On the skies chapter, step through them; they go back to the visitor's own when they scroll on.
  const skies = chapter === 3;
  useEffect(() => {
    if (!skies) return;
    const id = setInterval(() => setSkyStep((s) => (s + 1) % SKIES.length), SKY_MS);
    return () => {
      clearInterval(id);
      setSkyStep(0);
    };
  }, [skies]);
  const sky = skies ? skyStep : null;
  useEffect(() => previewScene(sky === null ? null : SKIES[sky]), [sky, previewScene]);
  useEffect(() => () => previewScene(null), [previewScene]);

  const shownSky = SKIES[sky ?? 0];

  return (
    <section ref={section} aria-label="How Zeflo works" className="wl-story">
      {CHAPTERS.map((c, i) => (
        <span
          key={c.kicker}
          ref={(s) => {
            snaps.current[i] = s;
          }}
          className="wl-snap"
          style={{top: `${((i + REST) / CHAPTERS.length) * 100}%`}}
          aria-hidden
        />
      ))}
      <div ref={stage} className="wl-stage">
        <ol className="wl-copy">
          {CHAPTERS.map((c, i) => (
            <li key={c.kicker} className="wl-chapter" style={{"--v": `var(--v${i})`} as CSSProperties}>
              <p className="text-[11px] uppercase tracking-[0.3em] text-scene-ink">
                <span className="tabular-nums text-white/55">0{i + 1}</span>
                <span className="mx-2 text-white/30">/</span>
                {c.kicker}
              </p>
              <h2 className="sf-serif mt-4 text-balance text-[clamp(1.85rem,4.2vw,3.4rem)] leading-[1.02]">{c.title}</h2>
              <p className="mt-5 max-w-md text-pretty text-sm leading-relaxed text-white/80 sm:text-[15px]">{c.body}</p>
              <p className="wl-versus mt-5 max-w-md text-xs leading-relaxed text-white/55">
                <span>Most planners:</span> {c.versus}
              </p>
            </li>
          ))}
        </ol>

        <div className="wl-view" aria-hidden>
          <div className="wl-float">
          <div className="wl-world">
            <div className="wl-shadow" />

            {/* The planner: a day on the calendar, built like the real one. */}
            <div className="wl-planner">
              <div className="wl-underside" />
              <div className="wl-slab sf-panel" />
              <div className="wl-planner-head">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">Wednesday</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-scene-soft">3 sessions · 3h 15m</span>
              </div>
              <div className="wl-grid">
                {HOURS.map((h, i) => (
                  <div key={h} className="wl-hour" style={{top: `${(i / (HOURS.length - 1)) * 100}%`}}>
                    <span>{h}</span>
                  </div>
                ))}
                <div className="wl-blocks" style={{"--c": "var(--c0)"} as CSSProperties}>
                  {CLASSES.map((c, i) => (
                    <div
                      key={c.name}
                      className="wl-drop sf-class-block wl-block rounded-md border border-l-4"
                      style={{...place(c.start, c.end), "--a": 0.12 + i * 0.16} as CSSProperties}
                    >
                      <span className="truncate font-semibold">{c.name}</span>
                      <span className="shrink-0 opacity-75">
                        {c.kind} · {c.at}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="wl-blocks" style={{"--c": "var(--c1)"} as CSSProperties}>
                  {SESSIONS.map((s, i) => (
                    <div
                      key={s.name}
                      className="wl-drop wl-session wl-block rounded-md border"
                      style={{...place(s.start, s.end), "--a": 0.38 + i * 0.09} as CSSProperties}
                    >
                      <span className="truncate text-white">{s.name}</span>
                      <span className="shrink-0 text-scene-soft">{s.at}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 1: the timetable, pasted, on its way in. */}
            <div className="wl-paste sf-panel">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">Paste from your school</p>
              <pre className="mt-3 overflow-hidden text-[9px] leading-[1.9] text-white/85 min-[400px]:text-[10px] sm:text-[11px]">{PASTED.join("\n")}</pre>
              <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-scene-ink">Import 3 classes →</p>
            </div>

            {/* 2: asking your AI. */}
            <div className="wl-chat">
              <p className="wl-bubble wl-bubble-you">CS 135 midterm on Friday. Plan my Wednesday around my classes.</p>
              <p className="wl-bubble wl-bubble-ai sf-panel">
                <span className="block text-[9px] uppercase tracking-[0.3em] text-scene-ink">Claude · Zeflo</span>
                Added 3 study sessions in your free time: 9:00, 11:45 and 2:15.
              </p>
            </div>

            {/* 3: a session, started. */}
            <div className="wl-timer sf-panel">
              <p className="text-[10px] uppercase tracking-[0.3em] text-scene-ink">Focus · CS 135 midterm review</p>
              <Countdown running={chapter === 2} />
              <div className="wl-timer-bar">
                <span />
              </div>
              <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-white/55">Break at 9:25 · then 2 more</p>
            </div>

            {/* 5: progress. */}
            <div className="wl-proof sf-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">Streak</p>
                  <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">
                    <span className="wl-flame">
                      <Flame lit={false} className="h-5 w-5" />
                      <Flame lit className="h-5 w-5" />
                    </span>
                    12 days
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">This week</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">9h 40m</p>
                </div>
              </div>
              <div className="wl-bars">
                {WEEK_BARS.map((h, i) => (
                  <span key={i} style={{"--h": h, "--a": i * 0.05} as CSSProperties} />
                ))}
              </div>
              <div className="wl-heat">
                {HEAT.map((level, i) => (
                  <span key={i} data-level={level} style={{"--a": 0.15 + (Math.floor(i / 7) / WEEKS) * 0.55} as CSSProperties} />
                ))}
              </div>
            </div>
          </div>
          </div>

          {/* 4: no model, just the sky behind the page, running through the day. */}
          <div className="wl-sky">
            <p key={sky ?? 0} className="wl-sky-label">
              <span className="block font-mono text-[11px] uppercase tracking-[0.3em] text-white/70 tabular-nums">
                {shownSky.clock} · {shownSky.theme}
              </span>
              <span className="sf-serif mt-3 block text-[clamp(2.4rem,6vw,4.75rem)] italic leading-none">{shownSky.label}</span>
            </p>
            {/* Which sky of the five, filling as each one plays. */}
            <div className="wl-sky-steps">
              {SKIES.map((s, i) => (
                <span key={s.label} data-state={sky === null || i > sky ? "next" : i === sky ? "now" : "seen"} />
              ))}
            </div>
          </div>
        </div>

        <div className="wl-progress" aria-hidden>
          <span />
        </div>
      </div>
    </section>
  );
}
