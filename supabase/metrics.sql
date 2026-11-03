-- How Zeflo is doing, from data it already keeps (no analytics or tracking added).
-- Read-only: paste into Supabase → SQL Editor and run. Counts only, no emails or study details.

-- Sign-ups per week, and how many of them confirmed their email.
select date_trunc('week', created_at)::date as week,
       count(*) as signed_up,
       count(email_confirmed_at) as confirmed
from auth.users
group by 1
order by 1 desc;

-- Active people per week: anyone who planned a study session that week.
select date_trunc('week', created_at)::date as week,
       count(distinct user_id) as active
from public.study_sessions
group by 1
order by 1 desc;

-- Did they come back? For each sign-up week: how many planned something in their first week,
-- and how many planned something again a week or more after signing up.
select date_trunc('week', u.created_at)::date as signup_week,
       count(*) as signed_up,
       count(*) filter (where exists (
         select 1 from public.study_sessions s
         where s.user_id = u.id and s.created_at < u.created_at + interval '7 days'
       )) as used_first_week,
       count(*) filter (where exists (
         select 1 from public.study_sessions s
         where s.user_id = u.id and s.created_at >= u.created_at + interval '7 days'
       )) as came_back
from auth.users u
group by 1
order by 1 desc;

-- Size against the free plan's limits (500 MB database).
select pg_size_pretty(pg_database_size(current_database())) as database_size,
       (select count(*) from auth.users) as accounts;
