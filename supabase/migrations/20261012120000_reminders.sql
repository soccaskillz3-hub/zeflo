-- Reminders: notifications before study sessions, the evening before a test, and when a streak
-- is about to end. Sent as web push to the devices where someone turned them on.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run). Then copy the
-- secret it creates into Vercel (see the end of this file).
--
-- How it fits together:
--   1. A device that turns on reminders saves its push address here (save_push_subscription).
--   2. Every minute, pg_cron checks whether anything is due. Only when something is, it calls
--      Zeflo on Vercel (/api/reminders) through pg_net, with a shared secret.
--   3. Zeflo claims what's due (claim_reminders, which also records it as sent so nothing goes
--      out twice), sends each one through the push service, and forgets addresses that the push
--      service says are gone (forget_push_endpoints).
-- The secret lives in Supabase Vault and in Vercel's environment, never in this repo. Zeflo
-- itself still has no secret key: claiming and forgetting only work with that shared secret.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Out of reach of the API: only the functions below (and the cron job) use what's in here.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- Devices ----------

-- Accepts names like "America/Toronto". Times in Zeflo are the user's local times, so reminders
-- need to know what "now" is where they are.
create function private.is_time_zone(name text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  perform timestamptz '2000-01-01 00:00:00+00' at time zone name;
  return true;
exception when others then
  return false;
end;
$$;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  time_zone text not null check (char_length(time_zone) <= 64 and private.is_time_zone(time_zone)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user on public.push_subscriptions (user_id, updated_at desc);

alter table public.push_subscriptions enable row level security;

-- People can see and remove their own devices (to send a test, or turn reminders off here).
-- Saving one goes through save_push_subscription. Connected AI assistants get neither.
create policy "Read own devices" on public.push_subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null);

create policy "Remove own devices" on public.push_subscriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null);

revoke all on table public.push_subscriptions from anon, public;
grant select, delete on table public.push_subscriptions to authenticated;

-- Saves this device's push address for the logged-in user, or refreshes it (the push keys and
-- time zone can change). A device belongs to whoever turned reminders on last, so when someone
-- else logs in on a shared computer and turns them on, the previous account's address goes.
create function public.save_push_subscription(sub_endpoint text, sub_p256dh text, sub_auth text, sub_time_zone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not logged in.';
  end if;
  if (select auth.jwt() ->> 'client_id') is not null then
    raise exception 'Connected apps can''t turn on reminders.';
  end if;

  delete from public.push_subscriptions where endpoint = sub_endpoint and user_id <> auth.uid();

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, time_zone)
  values (auth.uid(), sub_endpoint, sub_p256dh, sub_auth, sub_time_zone)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, time_zone = excluded.time_zone, updated_at = now();

  -- Ten devices is plenty; old browsers that never said goodbye drop off the end.
  delete from public.push_subscriptions
  where user_id = auth.uid()
    and id not in (select id from public.push_subscriptions where user_id = auth.uid() order by updated_at desc limit 10);
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- ---------- What's due ----------

-- Reminders already sent, so each goes out once. Kept for a month.
create table private.reminders_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Every reminder due right now that hasn't been sent, for everyone with reminders on. Each
-- person's choices are in user_settings.prefs (missing ones mean the defaults: 10 minutes before
-- sessions, tests on, streak on). The words are written by Zeflo; this only says what and when.
--   session: N minutes before a study session (not a break) that isn't checked off yet
--   test:    from 6 PM the evening before a test or exam (a class meeting on a single day)
--   streak:  from 8 PM, when yesterday kept the streak going and nothing's done today yet
create function private.due_reminders()
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
  )
  select due.user_id, due.key, due.kind, due.data
  from due
  where not exists (select 1 from private.reminders_sent r where r.user_id = due.user_id and r.key = due.key);
$$;

-- ---------- For Zeflo's sender (/api/reminders) ----------

create function private.check_reminders_secret(secret text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if secret is null or secret is distinct from (select decrypted_secret from vault.decrypted_secrets where name = 'zeflo_reminders') then
    raise exception 'Not allowed.';
  end if;
end;
$$;

-- What's due, one row per device, marked as sent in the same step so two runs that overlap
-- can't both send it.
create function public.claim_reminders(secret text)
returns table (endpoint text, p256dh text, auth_key text, kind text, tag text, data jsonb)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.check_reminders_secret(secret);
  delete from private.reminders_sent where sent_at < now() - interval '30 days';

  return query
    with due as (
      select * from private.due_reminders()
    ),
    claimed as (
      insert into private.reminders_sent (user_id, key)
      select due.user_id, due.key from due
      on conflict do nothing
      returning reminders_sent.user_id, reminders_sent.key
    )
    select p.endpoint, p.p256dh, p.auth, due.kind, due.key, due.data
    from claimed
    join due on due.user_id = claimed.user_id and due.key = claimed.key
    join public.push_subscriptions p on p.user_id = claimed.user_id;
end;
$$;

-- Push addresses the push service says no longer exist (the app was removed, or notifications
-- were turned off in the phone's settings).
create function public.forget_push_endpoints(secret text, endpoints text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_reminders_secret(secret);
  delete from public.push_subscriptions where endpoint = any (endpoints);
end;
$$;

-- Zeflo's server calls these without anyone logged in; the secret is what lets it through.
revoke all on function public.claim_reminders(text), public.forget_push_endpoints(text, text[]) from public, authenticated;
grant execute on function public.claim_reminders(text), public.forget_push_endpoints(text, text[]) to anon;

-- ---------- The clock ----------

-- A long random secret, made here so it never appears anywhere else.
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'zeflo_reminders',
  'Shared by the reminders cron job and Zeflo on Vercel (REMINDERS_SECRET)'
);

-- Every minute: if anything is due, ask Zeflo to send it. If Zeflo moves to its own domain,
-- change the address here (cron.alter_job) as well.
select cron.schedule(
  'zeflo-reminders',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://zeflo.vercel.app/api/reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zeflo_reminders')
      ),
      timeout_milliseconds := 10000
    )
    where exists (select 1 from private.due_reminders());
  $job$
);

-- ---------- After running this ----------
-- Copy the secret into Vercel as REMINDERS_SECRET (Project > Settings > Environment Variables):
--   select decrypted_secret from vault.decrypted_secrets where name = 'zeflo_reminders';
