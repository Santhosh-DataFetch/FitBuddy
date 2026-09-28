-- FitBuddy security and query-plan hardening
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.prevent_profile_role_change() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;

-- Cover foreign keys used by cascading deletes and ownership queries.
create index if not exists exercise_completions_completion_id_idx on public.exercise_completions(completion_id);
create index if not exists exercise_completions_exercise_id_idx on public.exercise_completions(exercise_id);
create index if not exists exercise_completions_user_id_idx on public.exercise_completions(user_id);
create index if not exists exercise_completions_workout_id_idx on public.exercise_completions(workout_id);
create index if not exists feedback_plan_id_idx on public.feedback(plan_id);
create index if not exists feedback_workout_id_idx on public.feedback(workout_id);
create index if not exists generation_logs_user_id_idx on public.generation_logs(user_id);
create index if not exists nutrition_tips_plan_id_idx on public.nutrition_tips(plan_id);
create index if not exists nutrition_tips_user_id_idx on public.nutrition_tips(user_id);
create index if not exists plan_changes_feedback_reference_idx on public.plan_changes(feedback_reference);
create index if not exists plan_changes_plan_id_idx on public.plan_changes(plan_id);
create index if not exists plan_changes_user_id_idx on public.plan_changes(user_id);
create index if not exists plan_versions_plan_id_idx on public.plan_versions(plan_id);
create index if not exists user_exercise_preferences_exercise_id_idx on public.user_exercise_preferences(exercise_id);
create index if not exists workout_completions_plan_id_idx on public.workout_completions(plan_id);
create index if not exists workout_completions_workout_id_idx on public.workout_completions(workout_id);
create index if not exists workout_completions_user_id_idx on public.workout_completions(user_id);

-- Cache auth.uid() once per statement rather than once per row.
drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists profiles_owner_delete on public.profiles;
create policy profiles_owner_delete on public.profiles for delete to authenticated using (id = (select auth.uid()));

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['workout_plans','plan_versions','workouts','workout_completions','exercise_completions','feedback','plan_changes','nutrition_tips','weekly_checkins','user_exercise_preferences','generation_logs'] LOOP
    EXECUTE format('drop policy if exists %I on public.%I', table_name || '_owner_select', table_name);
    EXECUTE format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', table_name || '_owner_select', table_name);
    EXECUTE format('drop policy if exists %I on public.%I', table_name || '_owner_insert', table_name);
    EXECUTE format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', table_name || '_owner_insert', table_name);
    EXECUTE format('drop policy if exists %I on public.%I', table_name || '_owner_update', table_name);
    EXECUTE format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', table_name || '_owner_update', table_name);
    EXECUTE format('drop policy if exists %I on public.%I', table_name || '_owner_delete', table_name);
    EXECUTE format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', table_name || '_owner_delete', table_name);
  END LOOP;
END $$;
