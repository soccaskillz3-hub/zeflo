import "server-only";

import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import type {McpServer} from "@modelcontextprotocol/server";
import {z} from "zod";
import {CLASS_COLUMNS, classFromRow, classesOn, upcomingTests, type ClassRow} from "../classMeetings";
import {addDays, daysBetween, isDayKey, toDate} from "../days";
import {toMinutes} from "../time";

// What a connected AI (Claude, ChatGPT, ...) can do in Zeflo, over MCP: read the user's classes,
// tests, study sessions, reminders and progress; plan, change or remove study sessions and
// reminders; add tests and exams, and remove classes. Each call runs
// as the signed-in user with their OAuth token, so the database's row level security keeps it to
// their own data, exactly as in the app.

export const INSTRUCTIONS = `Zeflo is a calm study planner for students. It holds the user's class timetable (imported from their school; classes can be removed here but not changed), their tests and exams (which can be added here), the study sessions they plan around them, which they tick off as they finish, and reminders: their own to-dos due at a time ("Email the TA"), separate from study sessions, which notify them right when due.

Dates are the user's own calendar days ("YYYY-MM-DD") and times are their local 24-hour clock ("HH:MM"). Zeflo doesn't know the user's time zone, so use today's date as the user knows it, and pass it as \`today\` to get_schedule.

When planning study time: call get_schedule first, avoid the user's classes and existing sessions, keep sessions between 25 and 120 minutes with short breaks between long stretches, and spread work for a test over the days before it rather than cramming. Name sessions after the course and the task, e.g. "MATH 135 · practice midterm". Briefly confirm the plan with the user before adding many sessions, and always before removing any.

When the user mentions a test, quiz, midterm or exam that isn't in upcomingTests, add it with add_tests so it shows on their calendar. Always confirm with the user before remove_classes, and say which classes (course, kind, times) will go.

Reminders are for one-off things to do at a time, not study blocks: use add_reminders for "remind me to…", and study sessions for time spent studying. Reminder times are local too; Zeflo knows the user's time zone from their device, so pass \`timeZone\` (an IANA name like "America/Toronto") only if the user says they're somewhere else or a tool asks for it.`;

const MAX_DAYS = 62; // per read: about two months
const MAX_ADD = 40;

const day = z
  .string()
  .refine(isDayKey, "Use a calendar day as YYYY-MM-DD.")
  .describe('A calendar day, "YYYY-MM-DD"');
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time as "HH:MM".')
  .describe('Local 24-hour time, "HH:MM"');
const subject = z.string().trim().min(1).max(200).describe('What the session is for, e.g. "CS 135 · assignment 4"');

type SessionRow = {
  id: string;
  day: string;
  subject: string;
  starts_at: string;
  ends_at: string;
  is_break: boolean;
  completed_at: string | null;
};
const SESSION_COLUMNS = "id, day, subject, starts_at, ends_at, is_break, completed_at";

const session = (r: SessionRow) => ({
  id: r.id,
  date: r.day,
  subject: r.subject,
  start: r.starts_at.slice(0, 5),
  end: r.ends_at.slice(0, 5),
  isBreak: r.is_break,
  done: r.completed_at !== null,
});

// A client that acts as the user who connected the AI (their OAuth access token).
export function supabaseFor(token: string): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: {headers: {Authorization: `Bearer ${token}`}},
    auth: {persistSession: false, autoRefreshToken: false},
  });
}

const reply = (data: unknown) => ({
  content: [{type: "text" as const, text: JSON.stringify(data, null, 2)}],
  structuredContent: data as Record<string, unknown>,
});
const fail = (message: string) => ({content: [{type: "text" as const, text: message}], isError: true});

// The token the AI signed in with, checked by withMcpAuth before any tool runs.
type Ctx = {http?: {authInfo?: {token: string}}};
const db = (ctx: Ctx) => {
  const token = ctx.http?.authInfo?.token;
  if (!token) throw new Error("Not signed in.");
  return supabaseFor(token);
};

// How each tool touches the user's data, spelled out in full for assistants (and app directory
// review). None reach beyond the user's own account, so none are open-world.
const READS = {readOnlyHint: true, destructiveHint: false, openWorldHint: false};
const ADDS = {readOnlyHint: false, destructiveHint: false, openWorldHint: false};
const CHANGES = {readOnlyHint: false, destructiveHint: true, openWorldHint: false}; // overwrites what was there
const REMOVES = {readOnlyHint: false, destructiveHint: true, openWorldHint: false};

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);

// ---------- Reminders ----------
// Saved as moments (due_at), shown and given as the user's local day and time in their time zone:
// the one their Zeflo device last reported (prefs.timeZone, see lib/prefs.tsx), unless given.

type ReminderRow = {id: string; title: string; due_at: string; done_at: string | null};
const REMINDER_COLUMNS = "id, title, due_at, done_at";

const timeZone = z
  .string()
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", {timeZone: tz});
      return true;
    } catch {
      return false;
    }
  }, "Use an IANA time zone, e.g. America/Toronto.")
  .describe('The user\'s IANA time zone, e.g. "America/Toronto". Leave out to use the one Zeflo knows.');
const reminderTitle = z.string().trim().min(1).max(200).describe('What to be reminded of, e.g. "Email the TA about A4"');

async function zoneOf(supabase: SupabaseClient, given?: string) {
  if (given) return given;
  const {data} = await supabase.from("user_settings").select("prefs").maybeSingle();
  const tz = (data?.prefs as {timeZone?: unknown} | null)?.timeZone;
  return typeof tz === "string" && timeZone.safeParse(tz).success ? tz : null;
}
const NO_ZONE = "Zeflo doesn't know the user's time zone yet (they haven't opened Zeflo since reminders arrived). Ask them, and pass it as `timeZone`.";

// The local day and time of a moment in a time zone.
function localParts(at: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"})
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`};
}

// The moment a local day and time happen in a time zone (checked twice, for days the clocks change).
function momentOf(date: string, time: string, tz: string) {
  const wanted = Date.parse(`${date}T${time}:00Z`);
  let at = wanted;
  for (let i = 0; i < 2; i++) {
    const seen = localParts(new Date(at), tz);
    at += wanted - Date.parse(`${seen.date}T${seen.time}:00Z`);
  }
  return new Date(at);
}

const reminder = (r: ReminderRow, tz: string) => ({id: r.id, title: r.title, ...localParts(new Date(r.due_at), tz), done: r.done_at !== null});

export function registerTools(server: McpServer) {
  server.registerTool(
    "get_schedule",
    {
      title: "Get schedule",
      description:
        "The user's classes, study sessions and reminders for each day from `from` to `to` (inclusive, at most two months), plus their tests and exams from `today` on. Call this before planning.",
      inputSchema: z.object({
        from: day,
        to: day,
        today: day.optional().describe("The user's date today, so upcomingTests starts there (defaults to `from`)"),
      }),
      annotations: READS,
    },
    async ({from, to, today}, ctx) => {
      if (to < from) return fail("`to` must be on or after `from`.");
      const days = daysBetween(from, to);
      if (days.length > MAX_DAYS) return fail(`Ask for at most ${MAX_DAYS} days at a time.`);
      const supabase = db(ctx);
      const [classes, sessions, tz] = await Promise.all([
        supabase.from("class_meetings").select(CLASS_COLUMNS),
        supabase.from("study_sessions").select(SESSION_COLUMNS).gte("day", from).lte("day", to).order("day").order("starts_at"),
        zoneOf(supabase),
      ]);
      if (classes.error || sessions.error) return fail("Couldn't read the schedule. Try again.");
      const meetings = (classes.data as ClassRow[]).map(classFromRow);
      const rows = (sessions.data as SessionRow[]).map(session);
      // Reminders, a day either side of the range in UTC, then kept to the user's local days.
      const due = tz
        ? await supabase
            .from("reminders")
            .select(REMINDER_COLUMNS)
            .gte("due_at", `${addDays(from, -1)}T00:00:00Z`)
            .lt("due_at", `${addDays(to, 2)}T00:00:00Z`)
            .order("due_at")
        : null;
      const reminders = tz ? ((due?.data ?? []) as ReminderRow[]).map((r) => reminder(r, tz)) : [];

      return reply({
        days: days.map((d) => ({
          date: d,
          weekday: new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {weekday: "long"}),
          classes: classesOn(meetings, d).map((c) => ({
            id: c.id,
            course: c.code,
            title: c.title || undefined,
            kind: c.component || undefined,
            start: c.start,
            end: c.end,
            location: c.location || undefined,
            isTestOrExam: c.startsOn !== null && c.startsOn === c.endsOn,
          })),
          sessions: rows.filter((s) => s.date === d).map((s) => ({id: s.id, subject: s.subject, start: s.start, end: s.end, isBreak: s.isBreak, done: s.done})),
          reminders: reminders.filter((r) => r.date === d).map((r) => ({id: r.id, title: r.title, time: r.time, done: r.done})),
        })),
        upcomingTests: upcomingTests(meetings, today ?? from, 0).map((t) => ({
          id: t.id,
          course: t.code,
          title: t.title || t.component || "Test",
          date: t.startsOn,
          start: t.start,
          end: t.end,
          location: t.location || undefined,
        })),
      });
    },
  );

  server.registerTool(
    "add_study_sessions",
    {
      title: "Add study sessions",
      description: `Add up to ${MAX_ADD} study sessions (or breaks) to the user's calendar. Returns the new sessions with their ids, and notes any that overlap a class or another session.`,
      inputSchema: z.object({
        sessions: z
          .array(z.object({date: day, start: time, end: time, subject, isBreak: z.boolean().optional()}))
          .min(1)
          .max(MAX_ADD),
      }),
      annotations: ADDS,
    },
    async ({sessions}, ctx) => {
      const bad = sessions.find((s) => toMinutes(s.end) <= toMinutes(s.start));
      if (bad) return fail(`"${bad.subject}" on ${bad.date} ends before it starts.`);
      const supabase = db(ctx);

      const first = sessions.reduce((a, s) => (s.date < a ? s.date : a), sessions[0].date);
      const last = sessions.reduce((a, s) => (s.date > a ? s.date : a), sessions[0].date);
      const [classes, existing] = await Promise.all([
        supabase.from("class_meetings").select(CLASS_COLUMNS),
        supabase.from("study_sessions").select(SESSION_COLUMNS).gte("day", first).lte("day", last),
      ]);
      const meetings = classes.error ? [] : (classes.data as ClassRow[]).map(classFromRow);
      const others = existing.error ? [] : (existing.data as SessionRow[]).map(session);

      const {data, error} = await supabase
        .from("study_sessions")
        .insert(
          sessions.map((s) => ({day: s.date, subject: s.subject, starts_at: s.start, ends_at: s.end, is_break: s.isBreak ?? false})),
        )
        .select(SESSION_COLUMNS);
      if (error) return fail("Couldn't add those sessions. Nothing was added.");

      const added = (data as SessionRow[]).map(session);
      const warnings = added.flatMap((s, i) => {
        const clash = [
          ...classesOn(meetings, s.date).filter((c) => overlaps(s.start, s.end, c.start, c.end)).map((c) => `${c.code} ${c.component}`.trim()),
          // Sessions already there, and the ones added before it in this same batch.
          ...[...others, ...added.slice(0, i)].filter((o) => o.date === s.date && overlaps(s.start, s.end, o.start, o.end)).map((o) => o.subject),
        ];
        return clash.length ? [`"${s.subject}" on ${s.date} overlaps ${clash.join(", ")}`] : [];
      });
      return reply({added, warnings});
    },
  );

  server.registerTool(
    "update_study_session",
    {
      title: "Update a study session",
      description: "Change a study session's day, times, name or break flag, or mark it done or not done. Only the fields given change.",
      inputSchema: z.object({
        id: z.string().uuid(),
        date: day.optional(),
        start: time.optional(),
        end: time.optional(),
        subject: subject.optional(),
        isBreak: z.boolean().optional(),
        done: z.boolean().optional(),
      }),
      annotations: CHANGES,
    },
    async ({id, date, start, end, subject: name, isBreak, done}, ctx) => {
      const supabase = db(ctx);
      const current = await supabase.from("study_sessions").select(SESSION_COLUMNS).eq("id", id).maybeSingle();
      if (current.error || !current.data) return fail("No study session with that id.");
      const was = session(current.data as SessionRow);
      if (toMinutes(end ?? was.end) <= toMinutes(start ?? was.start)) return fail("The session would end before it starts.");

      const changes = {
        ...(date && {day: date}),
        ...(start && {starts_at: start}),
        ...(end && {ends_at: end}),
        ...(name && {subject: name}),
        ...(isBreak !== undefined && {is_break: isBreak}),
        ...(done !== undefined && {completed_at: done ? (was.done ? current.data.completed_at : new Date().toISOString()) : null}),
      };
      const {data, error} = await supabase.from("study_sessions").update(changes).eq("id", id).select(SESSION_COLUMNS).single();
      if (error) return fail("Couldn't save that change.");
      return reply({updated: session(data as SessionRow)});
    },
  );

  server.registerTool(
    "remove_study_sessions",
    {
      title: "Remove study sessions",
      description: "Delete study sessions by id. Confirm with the user first. For classes, tests and exams, use remove_classes.",
      inputSchema: z.object({ids: z.array(z.string().uuid()).min(1).max(MAX_ADD)}),
      annotations: REMOVES,
    },
    async ({ids}, ctx) => {
      const {data, error} = await db(ctx).from("study_sessions").delete().in("id", ids).select("id");
      if (error) return fail("Couldn't remove those sessions.");
      return reply({removed: (data as {id: string}[]).map((r) => r.id)});
    },
  );

  server.registerTool(
    "add_tests",
    {
      title: "Add tests",
      description:
        "Add tests, quizzes, midterms or exams to the user's calendar, each on one day. They show with their classes and in upcomingTests, so study sessions can be planned around them. Returns them with their ids.",
      inputSchema: z.object({
        tests: z
          .array(
            z.object({
              course: z.string().trim().min(1).max(20).describe('The course code, e.g. "MATH 135"'),
              title: z.string().trim().max(200).optional().describe('What it is, e.g. "Quiz 3" or "Final exam"'),
              date: day,
              start: time,
              end: time,
              location: z.string().trim().max(100).optional(),
            }),
          )
          .min(1)
          .max(MAX_ADD),
      }),
      annotations: ADDS,
    },
    async ({tests}, ctx) => {
      const bad = tests.find((t) => toMinutes(t.end) <= toMinutes(t.start));
      if (bad) return fail(`${bad.course} on ${bad.date} ends before it starts.`);
      const {data, error} = await db(ctx)
        .from("class_meetings")
        .insert(
          tests.map((t) => ({
            code: t.course,
            title: t.title ?? "",
            component: "TST",
            days: [toDate(t.date).getDay()],
            starts_at: t.start,
            ends_at: t.end,
            location: t.location ?? "",
            starts_on: t.date,
            ends_on: t.date,
          })),
        )
        .select(CLASS_COLUMNS);
      if (error) return fail("Couldn't add those tests. Nothing was added.");
      return reply({
        added: (data as ClassRow[]).map(classFromRow).map((t) => ({
          id: t.id,
          course: t.code,
          title: t.title || undefined,
          date: t.startsOn,
          start: t.start,
          end: t.end,
          location: t.location || undefined,
        })),
      });
    },
  );

  server.registerTool(
    "remove_classes",
    {
      title: "Remove classes",
      description:
        "Delete classes, tests or exams by id (from get_schedule). Removing a weekly class removes every meeting of it, not just one day. Confirm with the user first.",
      inputSchema: z.object({ids: z.array(z.string().uuid()).min(1).max(MAX_ADD)}),
      annotations: REMOVES,
    },
    async ({ids}, ctx) => {
      const {data, error} = await db(ctx).from("class_meetings").delete().in("id", ids).select("id, code, component");
      if (error) return fail("Couldn't remove those classes.");
      return reply({removed: (data as {id: string; code: string; component: string}[]).map((r) => ({id: r.id, course: `${r.code} ${r.component}`.trim()}))});
    },
  );

  server.registerTool(
    "get_reminders",
    {
      title: "Get reminders",
      description:
        "The user's reminders that aren't done yet (overdue ones included), plus those checked off in the last week, with each one's local date and time. For reminders on particular days, get_schedule has them too.",
      inputSchema: z.object({timeZone: timeZone.optional()}),
      annotations: READS,
    },
    async ({timeZone: given}, ctx) => {
      const supabase = db(ctx);
      const tz = await zoneOf(supabase, given);
      if (!tz) return fail(NO_ZONE);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const {data, error} = await supabase.from("reminders").select(REMINDER_COLUMNS).or(`done_at.is.null,done_at.gte.${weekAgo}`).order("due_at");
      if (error) return fail("Couldn't read reminders.");
      const all = (data as ReminderRow[]).map((r) => reminder(r, tz));
      return reply({timeZone: tz, open: all.filter((r) => !r.done), recentlyDone: all.filter((r) => r.done)});
    },
  );

  server.registerTool(
    "add_reminders",
    {
      title: "Add reminders",
      description:
        "Add reminders: one-off things to do, each notifying the user on their devices right at its local date and time. Not for study time (use add_study_sessions).",
      inputSchema: z.object({
        reminders: z.array(z.object({title: reminderTitle, date: day, time})).min(1).max(MAX_ADD),
        timeZone: timeZone.optional(),
      }),
      annotations: ADDS,
    },
    async ({reminders: wanted, timeZone: given}, ctx) => {
      const supabase = db(ctx);
      const tz = await zoneOf(supabase, given);
      if (!tz) return fail(NO_ZONE);
      const rows = wanted.map((r) => ({title: r.title, due_at: momentOf(r.date, r.time, tz).toISOString()}));
      const {data, error} = await supabase.from("reminders").insert(rows).select(REMINDER_COLUMNS);
      if (error) return fail("Couldn't add those reminders.");
      const past = rows.some((r) => Date.parse(r.due_at) < Date.now() - 60_000);
      return reply({
        added: (data as ReminderRow[]).map((r) => reminder(r, tz)),
        timeZone: tz,
        ...(past && {note: "Some of these are already past, so they won't send a notification; they show as overdue."}),
      });
    },
  );

  server.registerTool(
    "update_reminder",
    {
      title: "Update a reminder",
      description: "Change a reminder's title, date or time (a new time notifies again then), or mark it done or not done. Only the fields given change.",
      inputSchema: z.object({
        id: z.string().uuid(),
        title: reminderTitle.optional(),
        date: day.optional(),
        time: time.optional(),
        done: z.boolean().optional(),
        timeZone: timeZone.optional(),
      }),
      annotations: CHANGES,
    },
    async ({id, title, date, time: at, done, timeZone: given}, ctx) => {
      const supabase = db(ctx);
      const tz = await zoneOf(supabase, given);
      if (!tz) return fail(NO_ZONE);
      const current = await supabase.from("reminders").select(REMINDER_COLUMNS).eq("id", id).maybeSingle();
      if (current.error || !current.data) return fail("No reminder with that id.");
      const was = current.data as ReminderRow;
      const local = localParts(new Date(was.due_at), tz);
      const changes = {
        ...(title && {title}),
        ...((date || at) && {due_at: momentOf(date ?? local.date, at ?? local.time, tz).toISOString()}),
        ...(done !== undefined && {done_at: done ? (was.done_at ?? new Date().toISOString()) : null}),
      };
      const {data, error} = await supabase.from("reminders").update(changes).eq("id", id).select(REMINDER_COLUMNS).single();
      if (error) return fail("Couldn't save that change.");
      return reply({updated: reminder(data as ReminderRow, tz)});
    },
  );

  server.registerTool(
    "remove_reminders",
    {
      title: "Remove reminders",
      description: "Delete reminders by id. Confirm with the user first; to just check one off, use update_reminder with done: true.",
      inputSchema: z.object({ids: z.array(z.string().uuid()).min(1).max(MAX_ADD)}),
      annotations: REMOVES,
    },
    async ({ids}, ctx) => {
      const {data, error} = await db(ctx).from("reminders").delete().in("id", ids).select("id");
      if (error) return fail("Couldn't remove those reminders.");
      return reply({removed: (data as {id: string}[]).map((r) => r.id)});
    },
  );

  server.registerTool(
    "get_progress",
    {
      title: "Get study progress",
      description:
        "The user's study streak and totals: minutes planned and done per day for the 30 days up to `today`, and the current streak (days in a row with at least one finished session, counting from today or yesterday).",
      inputSchema: z.object({today: day}),
      annotations: READS,
    },
    async ({today}, ctx) => {
      const from = addDays(today, -365);
      const {data, error} = await db(ctx)
        .from("study_days")
        .select("day, sessions, sessions_done, planned_minutes, done_minutes")
        .gte("day", from)
        .lte("day", today)
        .order("day");
      if (error) return fail("Couldn't read progress.");
      const rows = data as {day: string; sessions: number; sessions_done: number; planned_minutes: number; done_minutes: number}[];
      const studied = new Set(rows.filter((r) => r.sessions_done > 0).map((r) => r.day));

      let streak = 0;
      let d = studied.has(today) ? today : addDays(today, -1);
      while (studied.has(d)) {
        streak++;
        d = addDays(d, -1);
      }
      const recent = rows.filter((r) => r.day > addDays(today, -30));
      return reply({
        streakDays: streak,
        last30Days: {
          daysStudied: recent.filter((r) => r.sessions_done > 0).length,
          minutesPlanned: recent.reduce((a, r) => a + r.planned_minutes, 0),
          minutesDone: recent.reduce((a, r) => a + r.done_minutes, 0),
        },
        days: recent.map((r) => ({date: r.day, minutesPlanned: r.planned_minutes, minutesDone: r.done_minutes})),
      });
    },
  );
}
