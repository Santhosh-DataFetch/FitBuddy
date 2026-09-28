-- FitBuddy Supabase foundation
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  age integer check (age is null or age between 18 and 90),
  weight_kg numeric check (weight_kg is null or weight_kg between 35 and 350),
  height_cm numeric check (height_cm is null or height_cm between 120 and 230),
  unit text not null default 'metric' check (unit in ('metric', 'imperial')),
  fitness_goal text,
  experience_level text,
  workout_intensity text,
  training_location text,
  available_days text[] not null default '{}',
  session_duration integer check (session_duration is null or session_duration between 10 and 120),
  equipment text[] not null default '{}',
  activities text[] not null default '{}',
  dietary_preference text,
  foods_to_avoid text,
  limitations text,
  timezone text not null default 'UTC',
  onboarding_completed boolean not null default false,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_catalog (
  exercise_id text primary key,
  name text not null,
  category text not null,
  target_muscles text not null,
  equipment text not null,
  difficulty text not null,
  instructions text not null,
  substitutions text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  plan_start_date date not null,
  plan_end_date date not null,
  user_timezone text not null default 'UTC',
  summary text not null,
  why_this_plan text not null,
  reason text not null,
  feedback text,
  model_id text not null,
  prompt_version text not null,
  schema_version text not null,
  generation_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, version),
  unique (user_id, generation_id)
);

create table if not exists public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  reason text not null,
  feedback text,
  snapshot jsonb not null,
  model_id text not null,
  prompt_version text not null,
  schema_version text not null,
  created_at timestamptz not null default now(),
  unique (user_id, version)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  day_label text not null,
  title text not null,
  type text not null,
  duration_minutes integer not null check (duration_minutes between 1 and 180),
  intensity text not null,
  warmup jsonb not null default '[]'::jsonb,
  exercises jsonb not null default '[]'::jsonb,
  cooldown jsonb not null default '[]'::jsonb,
  recovery_note text not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'completed', 'modified', 'skipped')),
  created_at timestamptz not null default now(),
  unique (plan_id, scheduled_date)
);

create table if not exists public.workout_completions (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('completed', 'modified', 'skipped')),
  feel text,
  energy text,
  completed_minutes integer,
  note text,
  completed_at timestamptz not null default now()
);

create table if not exists public.exercise_completions (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.workout_completions(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.exercise_catalog(exercise_id),
  set_number integer,
  reps integer,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  plan_id uuid references public.workout_plans(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  from_version integer,
  to_version integer not null,
  reason text not null,
  feedback_reference uuid references public.feedback(id) on delete set null,
  changed_sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete cascade,
  category text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  energy text,
  sleep text,
  stress text,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.user_exercise_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.exercise_catalog(exercise_id),
  preference text not null check (preference in ('preferred', 'avoid', 'replacement')),
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create table if not exists public.generation_logs (
  generation_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  model_id text not null,
  prompt_version text not null,
  schema_version text not null,
  latency_ms integer,
  retry_count integer not null default 0,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists workout_plans_user_created_idx on public.workout_plans(user_id, created_at desc);
create index if not exists workouts_user_date_idx on public.workouts(user_id, scheduled_date);
create index if not exists workouts_plan_date_idx on public.workouts(plan_id, scheduled_date);
create index if not exists completions_user_date_idx on public.workout_completions(user_id, completed_at desc);
create index if not exists feedback_user_date_idx on public.feedback(user_id, created_at desc);
create index if not exists checkins_user_date_idx on public.weekly_checkins(user_id, week_start desc);

create or replace function public.set_updated_at() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_profile_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role is distinct from new.role and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'profile role can only be changed by a trusted server';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();
drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change before update on public.profiles
for each row execute procedure public.prevent_profile_role_change();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, new.raw_user_meta_data ->> 'name', new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.exercise_catalog enable row level security;
alter table public.workout_plans enable row level security;
alter table public.plan_versions enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_completions enable row level security;
alter table public.exercise_completions enable row level security;
alter table public.feedback enable row level security;
alter table public.plan_changes enable row level security;
alter table public.nutrition_tips enable row level security;
alter table public.weekly_checkins enable row level security;
alter table public.user_exercise_preferences enable row level security;
alter table public.generation_logs enable row level security;

-- Re-runnable policy setup. The server uses the service role only for trusted admin operations;
-- normal user reads/writes use a session-bound client and are enforced by auth.uid().
drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_owner_delete on public.profiles;
create policy profiles_owner_delete on public.profiles for delete to authenticated using (id = auth.uid());

drop policy if exists exercise_catalog_authenticated_select on public.exercise_catalog;
create policy exercise_catalog_authenticated_select on public.exercise_catalog for select to authenticated using (true);

-- All tables below use the same ownership rule. The database, not the browser, decides ownership.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['workout_plans','plan_versions','workouts','workout_completions','exercise_completions','feedback','plan_changes','nutrition_tips','weekly_checkins','user_exercise_preferences','generation_logs'] LOOP
    EXECUTE format('drop policy if exists %I on public.%I', table_name || '_owner_select', table_name);
    EXECUTE format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', table_name || '_owner_select', table_name);
    EXECUTE format('drop policy if exists %I on public.%I', table_name || '_owner_insert', table_name);
    EXECUTE format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', table_name || '_owner_insert', table_name);
    EXECUTE format('drop policy if exists %I on public.%I', table_name || '_owner_update', table_name);
    EXECUTE format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', table_name || '_owner_update', table_name);
    EXECUTE format('drop policy if exists %I on public.%I', table_name || '_owner_delete', table_name);
    EXECUTE format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())', table_name || '_owner_delete', table_name);
  END LOOP;
END $$;

grant usage on schema public to anon, authenticated;
grant select on public.exercise_catalog to authenticated;
grant select, insert, update, delete on public.profiles, public.workout_plans, public.plan_versions, public.workouts, public.workout_completions, public.exercise_completions, public.feedback, public.plan_changes, public.nutrition_tips, public.weekly_checkins, public.user_exercise_preferences, public.generation_logs to authenticated;
