"use client";

import Link from "next/link";
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {Card, CardHead, cardAction} from "../components/Card";
import SessionList from "../components/SessionList";
import StartButton from "../components/StartButton";
import Flame from "../components/Flame";
import WeekBars from "../components/WeekBars";
import {takeCelebration, type Celebration} from "../lib/celebrate";
import {classesOn, upcomingTests, useClasses} from "../lib/classes";
import {COMPONENTS} from "../lib/classSchedule";
import {addDays, daysBetween, formatDay, toDate, weekStart} from "../lib/days";
import {streaks, totalOn, useStudyHistory, useWeek} from "../lib/history";
import {sessionMinutes, useSchedule} from "../lib/schedule";
import {formatMinutes, formatTime, nowMinutes, toMinutes} from "../lib/time";

// Hour ticks along the progress line: every hour, or every two for long days.
function hourTicks(planned: number) {
  if (planned === 0) return [0];
  const step = planned <= 300 ? 60 : 120;
  const ticks: number[] = [];
  for (let t = 0; t < planned; t += step) ticks.push(t);
  // Keep the end label from colliding with the last hour tick (which matters most on narrow screens).
  if (ticks.length > 1 && (planned - ticks[ticks.length - 1]) / planned < 0.18) ticks.pop();
  return [...ticks, planned];
}

// Eases a number toward `target` whenever it changes, so totals count up instead of jumping.
// With `instant`, it jumps there instead (e.g. resetting to a starting point).
function useAnimatedNumber(target: number, duration: number, instant = false) {
  const [value, setValue] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = from.current;
    if (instant || start === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      setValue(target);
      return;
    }
    const began = performance.now();
    let frame = requestAnimationFrame(function step(t) {
      const k = Math.min(1, (t - began) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const next = start + (target - start) * eased;
      from.current = next;
      setValue(next);
      if (k < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration, instant]);

  return value;
}

function ProgressLine({
  done,
  planned,
  gain,
  instant,
}: {
  done: number;
  planned: number;
  gain: number | null;
  instant: boolean; // jump without animating
}) {
  const pct = planned === 0 ? 0 : (done / planned) * 100;
  const speed = instant ? "duration-0" : gain ? "duration-[1400ms]" : "duration-700";
  return (
    <div className="relative mt-9 h-14">
      <div className="absolute inset-x-0 top-5 h-px bg-white/20" />
      <div
        className={`absolute left-0 top-[19px] h-[3px] rounded-full bg-scene shadow-[0_0_14px_var(--accent-glow)] transition-[width] ${speed} ease-out ${
          gain ? "sf-bar-boost" : ""
        }`}
        style={{width: `${pct}%`}}
      />
      <div
        className={`absolute top-0 flex -translate-x-1/2 flex-col items-center transition-[left] ${speed} ease-out`}
        style={{left: `${pct}%`}}
      >
        {gain !== null && (
          <span className="sf-gain absolute -top-7 left-1/2 whitespace-nowrap rounded-full border border-scene/60 bg-scene/15 px-2 py-0.5 text-[11px] text-scene-ink tabular-nums">
            +{formatMinutes(gain)}
          </span>
        )}
        <span className="text-[10px] tracking-[0.2em] text-scene-soft">{Math.round(pct)}%</span>
        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-scene-soft shadow-[0_0_10px_var(--accent-glow)]" />
      </div>
      {hourTicks(planned).map((t, i, all) => {
        const left = planned === 0 ? 0 : (t / planned) * 100;
        // First and last labels align inward so they never spill past the line's ends.
        const align =
          i === 0
            ? "items-start"
            : i === all.length - 1
              ? "-translate-x-full items-end"
              : "-translate-x-1/2 items-center";
        return (
          <div
            key={t}
            className={`absolute top-[17px] flex flex-col whitespace-nowrap ${align}`}
            style={{left: `${left}%`}}
          >
            <span className="h-[7px] w-px bg-white/40" />
            <span className="mt-2 text-[11px] text-white/60 tabular-nums">{formatMinutes(t)}</span>
          </div>
        );
      })}
    </div>
  );
}

const linkClass = "text-scene-soft underline decoration-scene/40 underline-offset-4 transition hover:text-scene-ink";
const primaryButton = "sf-primary px-5 py-2.5 text-[11px] uppercase tracking-[0.2em]";
const secondaryButton =
  "sf-press inline-flex items-center rounded-full border border-white/25 px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] text-white/80 transition hover:border-white/50 hover:text-white";

// The streak: days in a row with something finished, what keeps it going, and the last two weeks
// as a row of days (lit where something got done), which sits level with the week's bars beside it.
function StreakCard({today}: {today: string}) {
  const {history} = useStudyHistory();
  const streak = history && streaks(history, today);
  const fortnight = daysBetween(addDays(today, -13), today);

  return (
    <Card className="flex flex-col">
      <CardHead label="Streak">
        {streak?.best ? <span className="text-[11px] uppercase tracking-[0.25em] text-white/50 tabular-nums">Best {streak.best}</span> : null}
      </CardHead>
      {/* Kept the same size while it loads, so nothing jumps. */}
      <div className={`mt-5 flex items-center gap-4 ${streak ? "" : "invisible"}`}>
        <Flame lit={streak?.studiedToday ?? false} className="h-10 w-10 shrink-0" />
        {streak?.current ? (
          <p className="flex items-baseline gap-3">
            <span className="sf-serif text-6xl leading-none tabular-nums">{streak.current}</span>
            <span className="text-sm text-scene-soft">{streak.current === 1 ? "day" : "days"} in a row</span>
          </p>
        ) : (
          <p className="sf-serif text-3xl leading-tight text-white/90">{streak?.best ? "Start a new streak" : "No streak yet"}</p>
        )}
      </div>
      <p className="mt-3 text-xs text-white/65">
        {!streak
          ? " "
          : streak.studiedToday
            ? "Today counts. Nice work."
            : streak.current
              ? "Finish a session today to keep it."
              : "One finished session starts it."}
      </p>

      <div className="mt-auto pt-6">
        <ol
          className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1.5"
          aria-label={history ? `Studied on ${fortnight.filter((d) => totalOn(history, d).done > 0).length} of the last 14 days` : undefined}
        >
          {fortnight.map((d) => {
            const studied = history ? totalOn(history, d).done > 0 : false;
            return (
              <li
                key={d}
                title={formatDay(d, {weekday: "short", month: "short", day: "numeric"})}
                className={`aspect-square rounded-[5px] transition-colors duration-300 ${
                  studied ? "bg-scene shadow-[0_0_10px_var(--accent-glow)]" : "bg-white/10"
                } ${d === today ? "ring-1 ring-white/70 ring-offset-2 ring-offset-transparent" : ""}`}
              />
            );
          })}
        </ol>
        <div className="mt-2.5 flex justify-between text-[10px] uppercase tracking-[0.2em] text-white/50">
          <span>2 weeks ago</span>
          <span>Today</span>
        </div>
      </div>
    </Card>
  );
}

// The week at a glance: time studied against planned, and a bar for each day.
function WeekCard({
  today,
  shownDone,
  planned,
  studiedDays,
  totals,
  loaded,
}: {
  today: string;
  shownDone: number;
  planned: number;
  studiedDays: number;
  totals: ReturnType<typeof useWeek>["totals"];
  loaded: boolean;
}) {
  return (
    <Card className="flex flex-col">
      <CardHead label="This week">
        <Link href="/progress" className={cardAction}>
          All progress
        </Link>
      </CardHead>

      {loaded && !planned ? (
        <div className="mt-5">
          <p className="sf-serif text-4xl leading-none">A fresh week</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
            Plan a few study sessions and your week fills in here, day by day.
          </p>
          {/* The week view on wider screens; phones plan day by day. */}
          <Link href="/calendar/week" className={`mt-5 hidden sm:inline-flex ${primaryButton}`}>
            Plan your week
          </Link>
          <Link href="/calendar" className={`mt-5 inline-flex sm:hidden ${primaryButton}`}>
            Plan your week
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="sf-serif text-5xl leading-none tabular-nums">{loaded ? formatMinutes(Math.round(shownDone)) : " "}</p>
            {loaded && <p className="text-sm text-scene-soft tabular-nums">of {formatMinutes(planned)}</p>}
          </div>
          <p className="mt-2 text-[11px] uppercase tracking-[0.25em] text-white/55">
            {loaded ? `Studied on ${studiedDays} of 7 days` : " "}
          </p>
          <div className="mt-auto pt-5">
            <WeekBars totals={totals} today={today} height={56} labels={false} />
          </div>
        </>
      )}
    </Card>
  );
}

// Today's classes in a line, in their own colour; the ones already over are dimmed.
function ClassesToday({today, clock}: {today: string; clock: number}) {
  const {classes} = useClasses();
  const list = classesOn(classes, today);
  if (!list.length) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
      {list.map((c) => (
        <span
          key={c.id}
          className={`flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 ${
            toMinutes(c.end) <= clock ? "text-white/40" : "text-white/85"
          }`}
        >
          <span className="sf-class-block h-2 w-2 shrink-0 rounded-full border" aria-hidden />
          {c.code} {c.component}
          <span className="text-white/50 tabular-nums">{formatTime(c.start)}</span>
        </span>
      ))}
    </div>
  );
}

const TESTS_SHOWN = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// Countdowns to the next tests and exams, straight from the imported class schedule: nothing to
// type in. Within a week, the count takes the scene's accent.
function UpcomingTests({today, clock, className = ""}: {today: string; clock: number; className?: string}) {
  const {classes} = useClasses();
  const tests = upcomingTests(classes, today, clock).slice(0, TESTS_SHOWN);
  if (!tests.length) return null;

  return (
    <Card className={className}>
      <CardHead label="Upcoming tests" />
      <ul className="mt-4 divide-y divide-white/10">
        {tests.map((t) => {
          const days = Math.round((toDate(t.startsOn!).getTime() - toDate(today).getTime()) / DAY_MS);
          const soon = days <= 7;
          return (
            <li key={t.id} className="flex items-center gap-5 py-3.5 first:pt-1 last:pb-0">
              <p className={`w-20 shrink-0 tabular-nums ${soon ? "text-scene-ink" : "text-white/85"}`}>
                {days === 0 ? (
                  <span className="sf-serif text-2xl">Today</span>
                ) : days === 1 ? (
                  <span className="sf-serif text-2xl">Tomorrow</span>
                ) : (
                  <>
                    <span className="sf-serif text-4xl leading-none">{days}</span>
                    <span className="ml-1.5 text-xs text-white/55">days</span>
                  </>
                )}
              </p>
              <div className="min-w-0">
                <p className="truncate">
                  <span className="font-semibold text-class-ink">{t.code}</span>{" "}
                  <span className="text-white/85">{(COMPONENTS[t.component] ?? t.component) || "Test"}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-white/55 tabular-nums">
                  {formatDay(t.startsOn!, {weekday: "short", month: "short", day: "numeric"})} · {formatTime(t.start)}
                  {t.location && t.location !== "TBA" && ` · ${t.location}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// The time of day in minutes, kept current.
function useClock() {
  const [clock, setClock] = useState(nowMinutes);
  useEffect(() => {
    const id = setInterval(() => setClock(nowMinutes()), 30 * 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

// Today: the day first (progress, what's next, today's classes), then the streak and the week,
// today's sessions, and upcoming tests.
export default function Dashboard() {
  const {today} = useSchedule();
  if (!today) return null;
  return <DashboardView today={today} />;
}

function DashboardView({today}: {today: string}) {
  const {sessions, completed, loaded} = useSchedule();
  // Coming back from a finished focus session: start at the old total, then animate up.
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [settled, setSettled] = useState(false);

  // A layout effect runs before the first paint, so the new total never flashes before the animation.
  // Only ever set, never cleared: React's dev-mode double effects would otherwise read it, then wipe it.
  useLayoutEffect(() => {
    const handoff = takeCelebration();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pick up the hand-off from the focus page once
    if (handoff) setCelebration(handoff);
  }, []);

  useEffect(() => {
    if (!celebration) return;
    const id = setTimeout(() => setSettled(true), 450);
    return () => clearTimeout(id);
  }, [celebration]);

  const studySessions = sessions.filter((s) => !s.isBreak);
  const plannedMinutes = studySessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const doneMinutes = studySessions
    .filter((s) => completed.includes(s.id))
    .reduce((sum, s) => sum + sessionMinutes(s), 0);
  // Before settling, snap back to the total from before the session; then animate up to the new one.
  const resetting = celebration !== null && !settled;
  const targetDone = resetting ? Math.max(0, doneMinutes - celebration.minutes) : doneMinutes;
  const shownDone = useAnimatedNumber(targetDone, celebration ? 1400 : 700, resetting);
  const percent = plannedMinutes === 0 ? 0 : Math.round((shownDone / plannedMinutes) * 100);
  const week = useWeek(weekStart(today));
  const weekTarget = resetting ? Math.max(0, week.done - celebration.minutes) : week.done;
  const shownWeek = useAnimatedNumber(weekTarget, celebration ? 1400 : 700, resetting);
  const clock = useClock();
  const {classes} = useClasses();
  const hasClasses = classesOn(classes, today).length > 0;
  const hasTests = upcomingTests(classes, today, clock).length > 0;
  // What to do next: the session on now, or the next one coming up; failing those, one that was
  // missed earlier today.
  const undone = studySessions.filter((s) => !completed.includes(s.id));
  const nextSession = undone.find((s) => toMinutes(s.end) > clock) ?? undone[0];
  const nextState = !nextSession
    ? null
    : toMinutes(nextSession.end) <= clock
      ? "missed"
      : toMinutes(nextSession.start) <= clock
        ? "now"
        : "next";
  const doneCount = studySessions.filter((s) => completed.includes(s.id)).length;
  const date = formatDay(today, {weekday: "long", month: "long", day: "numeric"});

  return (
    <div className="mt-6 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5">
      <Card className="sm:col-span-2 sm:p-8">
        <CardHead label={`Today · ${date}`} />

        {!loaded ? (
          // Today's schedule is still loading: hold the space rather than flash "nothing planned".
          <div className="h-56" aria-busy />
        ) : sessions.length === 0 ? (
          <div className="mt-6">
            <p className="sf-serif text-balance text-4xl leading-tight sm:text-5xl">
              {hasClasses ? "No study planned today." : "Nothing planned today."}
            </p>
            <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-white/65">
              Add a study session when you&apos;re ready, or just open the clock and enjoy the view.
            </p>
            <ClassesToday today={today} clock={clock} />
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/calendar" className={primaryButton}>
                Add a session
              </Link>
              <Link href="/clock" className={secondaryButton}>
                Open the clock
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="sf-serif text-7xl leading-none tabular-nums sm:text-8xl">{formatMinutes(Math.round(shownDone))}</p>
              <p className="text-sm text-scene-soft tabular-nums">of {formatMinutes(plannedMinutes)} planned</p>
            </div>
            <ProgressLine
              done={targetDone}
              planned={plannedMinutes}
              gain={celebration && settled ? celebration.minutes : null}
              instant={resetting}
            />
            <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-white/55">
              {studySessions.length === 0
                ? "No study sessions yet"
                : `${doneCount} of ${studySessions.length} sessions done · ${percent}%`}
            </p>

            <div className="mt-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-5 border-t border-white/10 pt-6">
              {nextSession ? (
                <>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-scene-soft">
                      {nextState === "now" ? "Now" : nextState === "missed" ? "Still to do" : "Next up"}
                    </p>
                    <p className="sf-serif mt-2 break-words text-3xl leading-tight sm:text-4xl">{nextSession.subject}</p>
                    <p className="mt-1.5 text-sm text-white/65 tabular-nums">
                      {formatTime(nextSession.start)} – {formatTime(nextSession.end)}
                      {nextState === "now" && <span> · {formatMinutes(toMinutes(nextSession.end) - clock)} left</span>}
                    </p>
                  </div>
                  <StartButton session={nextSession} className={`${primaryButton} px-7 py-3`} />
                </>
              ) : studySessions.length > 0 ? (
                <div>
                  <p className="sf-serif text-4xl leading-tight">
                    All done<em>.</em>
                  </p>
                  <p className="mt-1.5 text-sm text-white/65">Nothing left today. Rest well.</p>
                </div>
              ) : (
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                  <p className="sf-serif text-3xl text-white/85">Nothing planned</p>
                  <Link href="/calendar" className={`text-sm ${linkClass}`}>
                    Plan your day
                  </Link>
                </div>
              )}
            </div>
            <ClassesToday today={today} clock={clock} />
          </>
        )}
      </Card>

      <StreakCard today={today} />
      <WeekCard
        today={today}
        shownDone={shownWeek}
        planned={week.planned}
        studiedDays={week.studiedDays}
        totals={week.totals}
        loaded={week.loaded}
      />

      {loaded && sessions.length > 0 && (
        <Card className={hasTests ? "" : "sm:col-span-2"}>
          <CardHead label="Today's sessions">
            <Link href="/calendar/schedule" className={cardAction}>
              Edit
            </Link>
          </CardHead>
          <div className="mt-3">
            <SessionList
              empty={
                <>
                  Nothing scheduled yet.{" "}
                  <Link href="/calendar" className={linkClass}>
                    Add sessions
                  </Link>
                </>
              }
            />
          </div>
        </Card>
      )}

      <UpcomingTests today={today} clock={clock} className={loaded && sessions.length > 0 ? "" : "sm:col-span-2"} />
    </div>
  );
}
