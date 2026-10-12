"use client";

import {use, useRef} from "react";
import CalendarNav from "../../components/CalendarNav";
import {Card, CardHead} from "../../components/Card";
import Flame from "../../components/Flame";
import StudyHeatmap from "../../components/StudyHeatmap";
import WeekBars from "../../components/WeekBars";
import {addDays, daysBetween, formatDay, isDayKey, weekStart} from "../../lib/days";
import {streaks, totalOn, useStudyHistory, useWeek, type History} from "../../lib/history";
import {useSchedule} from "../../lib/schedule";
import {formatMinutes} from "../../lib/time";
import {useReveal} from "../../lib/useReveal";

const BAR_PX = 128;

// How you've been doing: your streak, six months of study days, and a closer look at one week
// (this week by default, or any week as /progress?week=2026-10-06).
export default function ProgressPage({searchParams}: PageProps<"/progress">) {
  const {week: requested} = use(searchParams);
  const {today} = useSchedule();
  const {history, error} = useStudyHistory();
  // The history is usually already here (Today read it). When it isn't, the cards stand in place
  // with their contents hidden, so nothing jumps when it arrives; then the contents fade in.
  const reveal = useReveal(history !== null);
  if (!today) return null;
  const start = weekStart(isDayKey(requested) ? requested : today);

  return (
    <div className="mt-6 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5">
      {error ? (
        <Card className="sm:col-span-2">
          <p className="text-sm text-white/75">Couldn&apos;t load your study history. Check your connection and reload the page.</p>
        </Card>
      ) : (
        <>
          <StreakCards history={history ?? {}} today={today} reveal={reveal} />
          <Card className="sm:col-span-2" aria-busy={!history}>
            <CardHead label="Last six months" />
            <div className={`mt-5 ${reveal}`}>
              <StudyHeatmap history={history ?? {}} today={today} />
            </div>
          </Card>
        </>
      )}
      <WeekCard start={start} today={today} />
    </div>
  );
}

function StreakCards({history, today, reveal}: {history: History; today: string; reveal: string}) {
  const {current, best, studiedToday} = streaks(history, today);
  const month = daysBetween(addDays(today, -29), today).map((d) => totalOn(history, d));
  const monthDays = month.filter((t) => t.done > 0).length;
  const monthMinutes = month.reduce((sum, t) => sum + t.done, 0);

  const nudge = studiedToday
    ? "Today counts. See you tomorrow."
    : current
      ? "Finish a session today to keep it going"
      : best
        ? "Finish a session today to start a new one"
        : "Finish a session today to start one";

  return (
    <>
      <Card>
        <CardHead label="Streak" />
        <div className={`mt-5 flex min-h-18 flex-wrap items-end gap-x-4 gap-y-2 ${reveal}`}>
          {current ? (
            <>
              <p className="flex items-center gap-3">
                <Flame lit={studiedToday} className="h-10 w-10 sm:h-12 sm:w-12" />
                <span className="sf-serif text-7xl leading-none tabular-nums">{current}</span>
              </p>
              <p className="pb-1.5 text-sm text-scene-soft tabular-nums">
                {current === 1 ? "day" : "days"} in a row · best {best}
              </p>
            </>
          ) : (
            // No streak running: words rather than a big zero.
            <p className="flex items-center gap-3">
              <Flame lit={false} className="h-9 w-9" />
              <span className="sf-serif text-4xl leading-none">{best ? "Start a new streak" : "No streak yet"}</span>
              {best > 0 && <span className="self-end pb-1 text-sm text-scene-soft">best {best}</span>}
            </p>
          )}
        </div>
        <p className={`mt-4 text-[11px] uppercase tracking-[0.25em] text-white/55 ${reveal}`}>{nudge}</p>
      </Card>

      <Card>
        <CardHead label="Last 30 days" />
        <div className={`mt-5 flex min-h-18 flex-wrap items-baseline gap-x-3 gap-y-1 ${reveal}`}>
          <p className="sf-serif text-7xl leading-none tabular-nums">{monthDays}</p>
          <p className="text-sm text-scene-soft">{monthDays === 1 ? "day" : "days"} studied</p>
        </div>
        <p className={`mt-4 text-[11px] uppercase tracking-[0.25em] text-white/55 ${reveal}`}>
          {monthMinutes > 0 ? `${formatMinutes(monthMinutes)} in all` : "Nothing yet this month"}
        </p>
      </Card>
    </>
  );
}

function WeekCard({start, today}: {start: string; today: string}) {
  const {totals, loaded, planned, done, studiedDays, subjects} = useWeek(start);
  const swipeArea = useRef<HTMLElement>(null);
  const thisWeek = start === weekStart(today);
  const subjectScale = Math.max(...subjects.map((t) => t.planned), 1);
  const reveal = useReveal(loaded);

  return (
    <section ref={swipeArea} className="sf-card sf-in min-w-0 p-5 sm:col-span-2 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[11px] uppercase tracking-[0.3em] text-white/60">
          {thisWeek ? "This week" : `Week of ${formatDay(start, {month: "short", day: "numeric"})}`}
        </h2>
        <CalendarNav
          prev={`/progress?week=${addDays(start, -7)}`}
          next={`/progress?week=${addDays(start, 7)}`}
          home="/progress"
          homeLabel="This week"
          atHome={thisWeek}
          prevLabel="Previous week"
          nextLabel="Next week"
          swipeArea={swipeArea}
        />
      </div>

      <div className={`mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 ${reveal}`}>
        <p className="sf-serif text-6xl leading-none tabular-nums">{loaded ? formatMinutes(done) : " "}</p>
        <p className="text-sm text-scene-soft tabular-nums">
          {loaded &&
            (planned
              ? `of ${formatMinutes(planned)} planned · studied on ${studiedDays} of 7 days`
              : "Nothing planned this week")}
        </p>
      </div>

      <div className={`mt-8 ${reveal}`}>
        <WeekBars totals={totals} today={today} height={BAR_PX} />
      </div>

      {subjects.length > 0 && (
        <div className={`mt-8 border-t border-white/10 pt-6 ${reveal}`}>
          <h3 className="text-[11px] uppercase tracking-[0.3em] text-white/60">By subject</h3>
          <ul className="mt-5 space-y-5">
            {subjects.map((t) => (
              <li key={t.subject}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate text-sm">{t.subject}</span>
                  {/* Fixed-width columns either side of the slash, so the slashes line up row to row. */}
                  <span className="grid shrink-0 grid-cols-[4rem_auto_4rem] gap-2 text-xs tabular-nums">
                    <span className="text-right text-white/85">{formatMinutes(t.done)}</span>
                    <span className="text-white/35">/</span>
                    <span className="text-white/50">{formatMinutes(t.planned)}</span>
                  </span>
                </div>
                <div className="relative mt-2 h-1.5 rounded-full bg-white/10">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white/20"
                    style={{width: `${(t.planned / subjectScale) * 100}%`}}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-scene shadow-[0_0_10px_var(--accent-glow)]"
                    style={{width: `${(t.done / subjectScale) * 100}%`}}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
