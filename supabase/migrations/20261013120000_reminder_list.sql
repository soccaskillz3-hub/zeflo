-- Reminders people write themselves ("Email the TA", "Pay residence fee"), separate from study
-- sessions. Each has a moment it's due; at that moment (the cron job checks every minute) it goes
-- out as its own kind of notification, and tapping it opens the Reminders page, where it can be
-- checked off.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run), after
-- 20261012120000_reminders.sql. Nothing to copy into Vercel this time.

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  -- A moment, not a local date and time: the browser that saves it knows the time zone, so the
  -- server never has to guess it.
  due_at timestamptz not null,
  done_at timestamptz, -- null until checked off
  created_at timestamptz not null default now()
);

create index reminders_user_due on public.reminders (user_id, due_at);
-- What the cron job looks at every minute: only the open ones.
create index reminders_open_due on public.reminders (due_at) where done_at is null;

alter table public.reminders enable row level security;

create policy "Read own reminders" on public.reminders
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Add own reminders" on public.reminders
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Change own reminders" on public.reminders
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Remove own reminders" on public.reminders
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.reminders from anon, public;
grant select, insert, update, delete on table public.reminders to authenticated;

-- ---------- What's due ----------
-- Same as before, plus:
--   reminder: from the moment it's due (for up to an hour, so a missed minute still sends it),
--             while it isn't checked off. Moving it to a new time sends it again then.
create or replace function private.due_reminders()
returns table (user_id uuid, key text, kind text, data jsonb)
language sql
stable
set search_path = ''
as $$
  with people as (
    -- One time zone per person: from the device that checked in most recently.
    select distinct on (p.user_id)
      p.user_id,
      (now() at time zone p.time_zone) as local_now,
      coalesce(s.prefs, '{}'::jsonb) as prefs
    from public.push_subscriptions p
    left join public.user_settings s on s.user_id = p.user_id
    order by p.user_id, p.updated_at desc
  ),
  settings as (
    select
      user_id,
      local_now,
      local_now::date as today,
      case when jsonb_typeof(prefs -> 'remindSessions') = 'number'
        then least(greatest((prefs ->> 'remindSessions')::numeric::int, 0), 120) else 10 end as lead,
      case when jsonb_typeof(prefs -> 'remindTests') = 'boolean' then (prefs -> 'remindTests')::boolean else true end as tests,
      case when jsonb_typeof(prefs -> 'remindStreak') = 'boolean' then (prefs -> 'remindStreak')::boolean else true end as streak
    from people
  ),
  due as (
    select
      st.user_id,
      'session:' || s.id || ':' || s.day || 'T' || s.starts_at as key,
      'session' as kind,
      jsonb_build_object(
        'subject', s.subject,
        'start', to_char(s.starts_at, 'HH24:MI'),
        'minutes', ceil(extract(epoch from (s.day + s.starts_at) - st.local_now) / 60)::int
      ) as data
    from settings st
    join public.study_sessions s on s.user_id = st.user_id and s.day between st.today and st.today + 1
    where st.lead > 0
      and not s.is_break
      and s.completed_at is null
      and s.day + s.starts_at > st.local_now
      and s.day + s.starts_at <= st.local_now + make_interval(mins => st.lead)

    union all

    select
      st.user_id,
      'test:' || c.id || ':' || c.starts_on,
      'test',
      jsonb_build_object(
        'code', c.code,
        'component', c.component,
        'start', to_char(c.starts_at, 'HH24:MI'),
        'location', c.location
      )
    from settings st
    join public.class_meetings c on c.user_id = st.user_id
    where st.tests
      and c.starts_on = c.ends_on
      and c.starts_on = st.today + 1
      and st.local_now::time >= time '18:00'

    union all

    select st.user_id, 'streak:' || st.today, 'streak', jsonb_build_object('days', run.days)
    from settings st
    cross join lateral (
      -- Days in a row up to yesterday with something done: yesterday minus the latest day
      -- (within a year) with nothing done.
      select (st.today - 1) - coalesce(max(d), st.today - 367) as days
      from (select st.today - g.n as d from generate_series(1, 366) as g (n)) as past
      where not exists (
        select 1 from public.study_sessions s
        where s.user_id = st.user_id and s.day = past.d and not s.is_break and s.completed_at is not null
      )
    ) as run
    where st.streak
      and st.local_now::time >= time '20:00'
      and run.days > 0
      and not exists (
        select 1 from public.study_sessions s
        where s.user_id = st.user_id and s.day = st.today and not s.is_break and s.completed_at is not null
      )

    union all

    select
      r.user_id,
      'reminder:' || r.id || ':' || extract(epoch from r.due_at)::bigint,
      'reminder',
      jsonb_build_object('id', r.id, 'title', r.title)
    from public.reminders r
    where r.done_at is null
      and r.due_at <= now()
      and r.due_at > now() - interval '1 hour'
      and exists (select 1 from people where people.user_id = r.user_id)
  )
  select due.user_id, due.key, due.kind, due.data
  from due
  where not exists (select 1 from private.reminders_sent r where r.user_id = due.user_id and r.key = due.key);
$$;
