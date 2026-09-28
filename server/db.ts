import type { SupabaseAuthUser, SupabaseUserClient } from "./supabase";
import { getSupabaseAdmin } from "./supabase";

export type AppProfile = {
  id: string;
  name: string | null;
  email: string | null;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  unit: "metric" | "imperial";
  goal: string | null;
  experience: string | null;
  workoutIntensity: string | null;
  location: string | null;
  equipment: string[];
  trainingDays: string[];
  sessionDuration: number | null;
  activities: string[];
  dietaryPreference: string | null;
  foodsToAvoid: string | null;
  limitations: string | null;
  timezone: string;
  onboardingCompleted: boolean;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
};

export type CatalogExercise = {
  exerciseId: string;
  name: string;
  category: string;
  targetMuscles: string;
  equipment: string;
  difficulty: string;
  instructions: string;
  substitutions: string;
  createdAt?: string;
};

export type PlanRow = {
  id: string;
  userId: string;
  version: number;
  planStartDate: string;
  planEndDate: string;
  userTimezone: string;
  summary: string;
  whyThisPlan: string;
  reason: string;
  feedback: string | null;
  modelId: string;
  promptVersion: string;
  schemaVersion: string;
  generationId: string;
  createdAt: string;
};

export type WorkoutRow = {
  id: string;
  planId: string;
  userId: string;
  scheduledDate: string;
  dayLabel: string;
  title: string;
  type: string;
  durationMinutes: number;
  intensity: string;
  warmup: string[];
  exercises: Record<string, unknown>[];
  cooldown: string[];
  recoveryNote: string;
  status: string;
  createdAt: string;
};

export type CompletionRow = {
  id: string;
  workoutId: string;
  planId: string;
  userId: string;
  status: string;
  feel: string | null;
  energy: string | null;
  completedMinutes: number | null;
  note: string | null;
  completedAt: string;
};

export type NutritionRow = { id: string; userId: string; planId: string | null; category: string; title: string; content: string; createdAt: string };

type Client = SupabaseUserClient;

type ProfileInput = {
  name: string; age: number; weightKg: number; heightCm?: number; unit: "metric" | "imperial"; goal: string; experience: string; location: string;
  equipment: string[]; trainingDays: string[]; sessionDuration: number; activities: string[]; dietaryPreference?: string; foodsToAvoid?: string; limitations?: string; timezone: string;
};

function logSupabaseError(operation: string, error: { message?: string } | null) {
  if (error) console.error(`[Supabase] ${operation}:`, error.message ?? "unknown error");
}

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === "string") as string[] : [];
}

function mapProfile(row: any): AppProfile {
  return {
    id: row.id, name: row.name ?? null, email: row.email ?? null, age: row.age ?? null, weightKg: row.weight_kg ?? null, heightCm: row.height_cm ?? null,
    unit: row.unit === "imperial" ? "imperial" : "metric", goal: row.fitness_goal ?? null, experience: row.experience_level ?? null,
    workoutIntensity: row.workout_intensity ?? null, location: row.training_location ?? null, equipment: jsonArray(row.equipment), trainingDays: jsonArray(row.available_days),
    sessionDuration: row.session_duration ?? null, activities: jsonArray(row.activities), dietaryPreference: row.dietary_preference ?? null, foodsToAvoid: row.foods_to_avoid ?? null,
    limitations: row.limitations ?? null, timezone: row.timezone ?? "UTC", onboardingCompleted: Boolean(row.onboarding_completed), role: row.role === "admin" ? "admin" : "user",
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapPlan(row: any): PlanRow {
  return { id: row.id, userId: row.user_id, version: row.version, planStartDate: row.plan_start_date, planEndDate: row.plan_end_date, userTimezone: row.user_timezone, summary: row.summary, whyThisPlan: row.why_this_plan, reason: row.reason, feedback: row.feedback ?? null, modelId: row.model_id, promptVersion: row.prompt_version, schemaVersion: row.schema_version, generationId: row.generation_id, createdAt: row.created_at };
}

function mapWorkout(row: any): WorkoutRow {
  return { id: row.id, planId: row.plan_id, userId: row.user_id, scheduledDate: row.scheduled_date, dayLabel: row.day_label, title: row.title, type: row.type, durationMinutes: row.duration_minutes, intensity: row.intensity, warmup: jsonArray(row.warmup), exercises: Array.isArray(row.exercises) ? row.exercises : [], cooldown: jsonArray(row.cooldown), recoveryNote: row.recovery_note, status: row.status, createdAt: row.created_at };
}

function mapCompletion(row: any): CompletionRow {
  return { id: row.id, workoutId: row.workout_id, planId: row.plan_id, userId: row.user_id, status: row.status, feel: row.feel ?? null, energy: row.energy ?? null, completedMinutes: row.completed_minutes ?? null, note: row.note ?? null, completedAt: row.completed_at };
}

function mapNutrition(row: any): NutritionRow {
  return { id: row.id, userId: row.user_id, planId: row.plan_id ?? null, category: row.category, title: row.title, content: row.content, createdAt: row.created_at };
}

export async function ensureProfile(authUser: SupabaseAuthUser) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("profiles").upsert({ id: authUser.id, email: authUser.email ?? null, name: (authUser.user_metadata?.name as string | undefined) ?? null }, { onConflict: "id" }).select().single();
  if (error || !data) { logSupabaseError("ensure profile", error); throw new Error("Unable to initialize your FitBuddy profile."); }
  return mapProfile(data);
}

export async function getProfile(client: Client, userId: string) {
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) { logSupabaseError("load profile", error); throw new Error("Unable to load your FitBuddy profile."); }
  return data ? mapProfile(data) : null;
}

export async function updateFitnessProfile(client: Client, userId: string, input: ProfileInput) {
  const { data, error } = await client.from("profiles").update({ name: input.name, age: input.age, weight_kg: input.weightKg, height_cm: input.heightCm ?? null, unit: input.unit, fitness_goal: input.goal, experience_level: input.experience, training_location: input.location, equipment: input.equipment, available_days: input.trainingDays, session_duration: input.sessionDuration, activities: input.activities, dietary_preference: input.dietaryPreference ?? null, foods_to_avoid: input.foodsToAvoid ?? null, limitations: input.limitations ?? null, timezone: input.timezone, onboarding_completed: true }).eq("id", userId).select().single();
  if (error || !data) { logSupabaseError("update profile", error); throw new Error("We couldn't save your profile. Please try again."); }
  return mapProfile(data);
}

export async function getLatestPlan(client: Client, userId: string) {
  const { data, error } = await client.from("workout_plans").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) { logSupabaseError("load latest plan", error); throw new Error("Unable to load your plan right now."); }
  return data ? mapPlan(data) : null;
}

export async function getPlanById(client: Client, userId: string, planId: string) {
  const { data, error } = await client.from("workout_plans").select("*").eq("user_id", userId).eq("id", planId).maybeSingle();
  if (error) { logSupabaseError("load plan", error); throw new Error("Unable to load that plan."); }
  return data ? mapPlan(data) : null;
}

export async function getWorkoutsForPlan(client: Client, userId: string, planId: string) {
  const { data, error } = await client.from("workouts").select("*").eq("user_id", userId).eq("plan_id", planId).order("scheduled_date");
  if (error) { logSupabaseError("load workouts", error); throw new Error("Unable to load your workouts right now."); }
  return (data ?? []).map(mapWorkout);
}

export async function getPlanHistory(client: Client, userId: string) {
  const { data, error } = await client.from("workout_plans").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) { logSupabaseError("load plan history", error); throw new Error("Unable to load plan history right now."); }
  return (data ?? []).map(mapPlan);
}

export async function getExerciseCatalog(client: Client) {
  const { data, error } = await client.from("exercise_catalog").select("*").order("name");
  if (error) { logSupabaseError("load exercise catalog", error); throw new Error("Unable to load the exercise catalog."); }
  return (data ?? []).map((row: any): CatalogExercise => ({ exerciseId: row.exercise_id, name: row.name, category: row.category, targetMuscles: row.target_muscles, equipment: row.equipment, difficulty: row.difficulty, instructions: row.instructions, substitutions: row.substitutions, createdAt: row.created_at }));
}

export async function ensureExerciseCatalog(items: CatalogExercise[]) {
  const admin = getSupabaseAdmin();
  const rows = items.map(item => ({ exercise_id: item.exerciseId, name: item.name, category: item.category, target_muscles: item.targetMuscles, equipment: item.equipment, difficulty: item.difficulty, instructions: item.instructions, substitutions: item.substitutions }));
  const { error } = await admin.from("exercise_catalog").upsert(rows, { onConflict: "exercise_id" });
  if (error) { logSupabaseError("seed exercise catalog", error); throw new Error("Unable to prepare the exercise catalog."); }
}

export type PlanBundleInput = {
  plan: { user_id: string; version: number; plan_start_date: string; plan_end_date: string; user_timezone: string; summary: string; why_this_plan: string; reason: string; feedback: string | null; model_id: string; prompt_version: string; schema_version: string; generation_id: string };
  version: { user_id: string; version: number; reason: string; feedback: string | null; snapshot: GeneratedSnapshot; model_id: string; prompt_version: string; schema_version: string };
  workouts: Array<{ user_id: string; scheduled_date: string; day_label: string; title: string; type: string; duration_minutes: number; intensity: string; warmup: string[]; exercises: Record<string, unknown>[]; cooldown: string[]; recovery_note: string; status: string }>;
  nutrition: Array<{ user_id: string; category: string; title: string; content: string }>;
};

type GeneratedSnapshot = Record<string, unknown>;

export async function insertPlanBundle(client: Client, input: PlanBundleInput) {
  const { data: plan, error: planError } = await client.from("workout_plans").insert(input.plan).select().single();
  if (planError || !plan) { logSupabaseError("insert plan", planError); throw new Error("We couldn't save your plan. Please try again."); }
  const planId = plan.id as string;
  const version = { ...input.version, plan_id: planId };
  const workouts = input.workouts.map(row => ({ ...row, plan_id: planId }));
  const nutrition = input.nutrition.map(row => ({ ...row, plan_id: planId }));
  const { error: versionError } = await client.from("plan_versions").insert(version);
  if (versionError) { await client.from("workout_plans").delete().eq("id", planId); logSupabaseError("insert plan version", versionError); throw new Error("We couldn't save your plan version. Please try again."); }
  const { error: workoutError } = await client.from("workouts").insert(workouts);
  if (workoutError) { await client.from("workout_plans").delete().eq("id", planId); logSupabaseError("insert workouts", workoutError); throw new Error("We couldn't save your workouts. Please try again."); }
  if (nutrition.length) {
    const { error: nutritionError } = await client.from("nutrition_tips").insert(nutrition);
    if (nutritionError) { await client.from("workout_plans").delete().eq("id", planId); logSupabaseError("insert nutrition", nutritionError); throw new Error("We couldn't save your recovery notes. Please try again."); }
  }
  const savedWorkouts = await getWorkoutsForPlan(client, input.plan.user_id, planId);
  const savedNutrition = await getNutritionForPlan(client, input.plan.user_id, planId);
  return { plan: mapPlan(plan), workouts: savedWorkouts, nutrition: savedNutrition };
}

export async function recordGenerationLog(client: Client, log: { generation_id: string; user_id: string; operation: string; model_id: string; prompt_version: string; schema_version: string; latency_ms: number; retry_count: number; status: string; error_message: string | null }) {
  const { error } = await client.from("generation_logs").insert(log);
  if (error) logSupabaseError("record generation log", error);
}

export async function findWorkout(client: Client, userId: string, workoutId: string) {
  const { data, error } = await client.from("workouts").select("*").eq("id", workoutId).eq("user_id", userId).maybeSingle();
  if (error) { logSupabaseError("load workout", error); throw new Error("Unable to load that workout."); }
  return data ? mapWorkout(data) : null;
}

export async function updateWorkoutStatus(client: Client, userId: string, workoutId: string, status: string) {
  const { data, error } = await client.from("workouts").update({ status }).eq("id", workoutId).eq("user_id", userId).select().single();
  if (error || !data) { logSupabaseError("update workout status", error); throw new Error("We couldn't update that workout."); }
  return mapWorkout(data);
}

export async function recordWorkoutCompletion(client: Client, input: { workoutId: string; planId: string; userId: string; status: string; feel?: string | null; energy?: string | null; completedMinutes?: number | null; note?: string | null }) {
  const { error } = await client.from("workout_completions").insert({ workout_id: input.workoutId, plan_id: input.planId, user_id: input.userId, status: input.status, feel: input.feel ?? null, energy: input.energy ?? null, completed_minutes: input.completedMinutes ?? null, note: input.note ?? null });
  if (error) { logSupabaseError("record workout completion", error); throw new Error("We couldn't save this workout yet. Please try again."); }
  return updateWorkoutStatus(client, input.userId, input.workoutId, input.status);
}

export async function replaceWorkoutExercise(client: Client, userId: string, workoutId: string, index: number, replacement: CatalogExercise) {
  const workout = await findWorkout(client, userId, workoutId);
  if (!workout || !workout.exercises[index]) return null;
  const exercises = [...workout.exercises];
  exercises[index] = { ...exercises[index], exercise_id: replacement.exerciseId, instruction: replacement.instructions };
  const { data, error } = await client.from("workouts").update({ exercises, status: "modified" }).eq("id", workoutId).eq("user_id", userId).select().single();
  if (error || !data) { logSupabaseError("replace workout exercise", error); throw new Error("We couldn't replace that exercise. Please try again."); }
  return mapWorkout(data);
}

export async function recordFeedback(client: Client, input: { userId: string; planId?: string | null; workoutId?: string | null; kind: string; payload: Record<string, string> }) {
  const { data, error } = await client.from("feedback").insert({ user_id: input.userId, plan_id: input.planId ?? null, workout_id: input.workoutId ?? null, kind: input.kind, payload: input.payload }).select().single();
  if (error || !data) { logSupabaseError("record feedback", error); throw new Error("We couldn't save your feedback. Please try again."); }
  return data;
}

export async function getProgressData(client: Client, userId: string) {
  const [workoutsResult, completionsResult] = await Promise.all([
    client.from("workouts").select("*").eq("user_id", userId).order("scheduled_date", { ascending: false }).limit(100),
    client.from("workout_completions").select("*").eq("user_id", userId).order("completed_at", { ascending: false }).limit(200),
  ]);
  if (workoutsResult.error || completionsResult.error) { logSupabaseError("load progress", workoutsResult.error ?? completionsResult.error); throw new Error("Unable to load your progress right now."); }
  return { workouts: (workoutsResult.data ?? []).map(mapWorkout), completions: (completionsResult.data ?? []).map(mapCompletion) };
}

export async function getNutritionForPlan(client: Client, userId: string, planId: string) {
  const { data, error } = await client.from("nutrition_tips").select("*").eq("user_id", userId).eq("plan_id", planId).order("created_at");
  if (error) { logSupabaseError("load nutrition", error); throw new Error("Unable to load recovery notes right now."); }
  return (data ?? []).map(mapNutrition);
}

export async function createPlanChange(client: Client, input: { userId: string; planId: string; fromVersion: number; toVersion: number; reason: string; changedSections: string[] }) {
  const { error } = await client.from("plan_changes").insert({ user_id: input.userId, plan_id: input.planId, from_version: input.fromVersion, to_version: input.toVersion, reason: input.reason, changed_sections: input.changedSections });
  if (error) logSupabaseError("record plan change", error);
}

export async function getAdminMetrics() {
  const admin = getSupabaseAdmin();
  const [users, plans, completions, feedback] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("workout_plans").select("id", { count: "exact", head: true }),
    admin.from("workout_completions").select("id", { count: "exact", head: true }),
    admin.from("feedback").select("id", { count: "exact", head: true }),
  ]);
  const error = users.error ?? plans.error ?? completions.error ?? feedback.error;
  if (error) { logSupabaseError("load admin metrics", error); throw new Error("Unable to load administrative metrics."); }
  return { users: users.count ?? 0, plans: plans.count ?? 0, completions: completions.count ?? 0, feedback: feedback.count ?? 0 };
}

export async function getAdminUsers() {
  const { data, error } = await getSupabaseAdmin().from("profiles").select("id,name,email,role,onboarding_completed,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) { logSupabaseError("load admin users", error); throw new Error("Unable to load administrative users."); }
  return (data ?? []).map((row: any) => ({ id: row.id, name: row.name, email: row.email, role: row.role, onboardingCompleted: Boolean(row.onboarding_completed), createdAt: row.created_at }));
}

export async function deleteAccount(userId: string) {
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
  if (error) { logSupabaseError("delete account", error); throw new Error("We couldn't delete your account. Please try again."); }
}
