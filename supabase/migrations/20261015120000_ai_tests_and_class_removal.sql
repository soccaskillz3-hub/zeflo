-- AI connector: lets a connected AI assistant add tests and exams, and remove classes.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run), after
-- 20261010120000_ai_connector.sql.
--
-- Connected apps (tokens carrying a client_id) could only read classes until now. They may now
-- add one-off meetings (tests and exams: they start and end on the same day) and remove any of
-- the user's classes. Changing a class, and adding a weekly one, stays with Zeflo itself.

drop policy "Connected apps can't add classes" on public.class_meetings;
create policy "Connected apps can only add tests" on public.class_meetings
  as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null or (starts_on is not null and starts_on = ends_on));

drop policy "Connected apps can't remove classes" on public.class_meetings;
