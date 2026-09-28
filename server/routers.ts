import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import type { AppProfile, CatalogExercise, PlanRow, WorkoutRow } from "./db";
import {
  createPlanChange,
  deleteAccount,
  ensureExerciseCatalog,
  findWorkout,
  getAdminMetrics,
  getAdminUsers,
  getExerciseCatalog,
  getLatestPlan,
  getNutritionForPlan,
  getPlanHistory,
  getProgressData,
  insertPlanBundle,
  recordFeedback,
  recordGenerationLog,
  recordWorkoutCompletion,
  replaceWorkoutExercise,
  updateFitnessProfile,
} from "./db";

const PROMPT_VERSION = "fitbuddy.workout.v2";
const SCHEMA_VERSION = "2.0";

const catalogSeed: CatalogExercise[] = [
  { exerciseId: "squat", name: "Bodyweight Squat", category: "strength", targetMuscles: "quadriceps, glutes", equipment: "bodyweight", difficulty: "beginner", instructions: "Sit hips down and back, keep the chest open, then drive through the whole foot.", substitutions: "reverse-lunge, glute-bridge" },
  { exerciseId: "pushup", name: "Incline Push-up", category: "strength", targetMuscles: "chest, shoulders, triceps", equipment: "bench or wall", difficulty: "beginner", instructions: "Keep a straight line from shoulders to heels and lower with control.", substitutions: "wall-pushup, knee-pushup" },
  { exerciseId: "row", name: "Resistance Band Row", category: "strength", targetMuscles: "upper back, biceps", equipment: "resistance band", difficulty: "beginner", instructions: "Pull elbows toward your ribs while keeping shoulders relaxed.", substitutions: "towel-row, prone-y-raise" },
  { exerciseId: "hinge", name: "Dumbbell Romanian Deadlift", category: "strength", targetMuscles: "hamstrings, glutes", equipment: "dumbbells", difficulty: "intermediate", instructions: "Hinge at the hips with a long spine and stop when the hamstrings feel loaded.", substitutions: "good-morning, single-leg-hinge" },
  { exerciseId: "lunge", name: "Reverse Lunge", category: "strength", targetMuscles: "glutes, quadriceps", equipment: "bodyweight", difficulty: "beginner", instructions: "Step back softly, keep the front knee tracking over the middle toes, then stand tall.", substitutions: "split-squat, step-up" },
  { exerciseId: "plank", name: "Forearm Plank", category: "core", targetMuscles: "core, shoulders", equipment: "bodyweight", difficulty: "beginner", instructions: "Brace gently, keep hips level, and breathe without forcing the hold.", substitutions: "dead-bug, bird-dog" },
  { exerciseId: "deadbug", name: "Dead Bug", category: "core", targetMuscles: "deep core, hip flexors", equipment: "bodyweight", difficulty: "beginner", instructions: "Move opposite arm and leg slowly while keeping the lower back comfortably grounded.", substitutions: "bird-dog, heel-tap" },
  { exerciseId: "walk", name: "Brisk Walk", category: "cardio", targetMuscles: "cardiovascular system, legs", equipment: "none", difficulty: "beginner", instructions: "Walk at a pace where talking is possible but you feel purposefully warm.", substitutions: "march, cycling" },
  { exerciseId: "mobility", name: "Hip and Shoulder Flow", category: "mobility", targetMuscles: "hips, shoulders, spine", equipment: "bodyweight", difficulty: "beginner", instructions: "Move through a comfortable range and breathe evenly; never force a stretch.", substitutions: "cat-cow, 90-90-switch" },
  { exerciseId: "bridge", name: "Glute Bridge", category: "strength", targetMuscles: "glutes, hamstrings", equipment: "bodyweight", difficulty: "beginner", instructions: "Press through the heels and squeeze the glutes at the top without arching the back.", substitutions: "hip-hinge, clam-shell" },
];

const ProfileInput = z.object({
  name: z.string().trim().min(1).max(80), age: z.number().int().min(18).max(90), weightKg: z.number().int().min(35).max(350), heightCm: z.number().int().min(120).max(230).optional(), unit: z.enum(["metric", "imperial"]), goal: z.string().min(2).max(64), experience: z.string().min(2).max(32), location: z.string().min(2).max(32), equipment: z.array(z.string().max(40)).max(12), trainingDays: z.array(z.string().max(12)).min(1).max(7), sessionDuration: z.number().int().min(10).max(120), activities: z.array(z.string().max(40)).max(8), dietaryPreference: z.string().max(64).optional(), foodsToAvoid: z.string().max(500).optional(), limitations: z.string().max(500).optional(), timezone: z.string().max(64).default("UTC"),
});

const ExercisePlanSchema = z.object({ exercise_id: z.string().min(1), sets: z.number().int().min(1).max(8).optional(), reps: z.number().int().min(1).max(50).optional(), duration_minutes: z.number().int().min(1).max(60).optional(), rest_seconds: z.number().int().min(0).max(300), instruction: z.string().min(5).max(300) });
const WorkoutSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), day: z.string().min(1).max(20), title: z.string().min(1).max(120), type: z.string().min(1).max(48), duration_minutes: z.number().int().min(10).max(120), intensity: z.enum(["low", "medium", "high"]), warmup: z.array(z.string().min(1).max(160)).max(8), exercises: z.array(ExercisePlanSchema).max(12), cooldown: z.array(z.string().min(1).max(160)).max(8), recovery_note: z.string().min(1).max(240) });
const GeneratedPlanSchema = z.object({ summary: z.string().min(10).max(600), why_this_plan: z.string().min(10).max(600), weekly_plan: z.array(WorkoutSchema).length(7) });
type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>;

function dateInTimezone(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch { return new Date().toISOString().slice(0, 10); }
}
function addDays(date: string, amount: number) { const result = new Date(`${date}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + amount); return result.toISOString().slice(0, 10); }
function daysBetween(a: string, b: string) { return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000); }
function dayName(date: string) { return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function localDate(iso: string, timezone: string) { try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); } catch { return iso.slice(0, 10); } }
function profileForPrompt(profile: AppProfile) { return { name: profile.name ?? "there", age: profile.age, weightKg: profile.weightKg, heightCm: profile.heightCm, goal: profile.goal, experience: profile.experience, location: profile.location, equipment: profile.equipment, trainingDays: profile.trainingDays, sessionDuration: profile.sessionDuration, activities: profile.activities, dietaryPreference: profile.dietaryPreference, foodsToAvoid: profile.foodsToAvoid, limitations: profile.limitations, timezone: profile.timezone }; }
function validateBusinessPlan(plan: GeneratedPlan, startDate: string, catalogIds: Set<string>) { if (plan.weekly_plan[0]?.date !== startDate) throw new Error("Plan dates are not aligned"); for (let index = 0; index < plan.weekly_plan.length; index += 1) { const day = plan.weekly_plan[index]; if (day.date !== addDays(startDate, index)) throw new Error("Plan must contain consecutive dates"); for (const exercise of day.exercises) if (!catalogIds.has(exercise.exercise_id)) throw new Error("Unknown exercise reference"); } }
export const __fitbuddyTesting = { addDays, dateInTimezone, validateBusinessPlan };

async function generatePlan(profile: AppProfile, startDate: string, catalog: CatalogExercise[]) {
  const modelId = process.env.GEMINI_WORKOUT_MODEL || "platform-default";
  const system = `You are FitBuddy's safe fitness planning engine. Return only the requested JSON schema. Use only exercise_id values from this catalog: ${JSON.stringify(catalog.map(item => ({ exercise_id: item.exerciseId, name: item.name, equipment: item.equipment })))}. Build exactly seven consecutive dates starting ${startDate}. Respect age, goal, experience, location, equipment, schedule, and limitations. Do not diagnose or prescribe around injuries. Prefer moderate, sustainable training.`;
  const prompt = `Create a seven-day plan for this profile: ${JSON.stringify(profileForPrompt(profile))}. Keep each day between 10 and 120 minutes. Use rest or mobility days when appropriate.`;
  const response = await invokeLLM({
    model: process.env.GEMINI_WORKOUT_MODEL || undefined,
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "fitbuddy_weekly_plan",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["summary", "why_this_plan", "weekly_plan"],
          properties: {
            summary: { type: "string" },
            why_this_plan: { type: "string" },
            weekly_plan: {
              type: "array",
              minItems: 7,
              maxItems: 7,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["date", "day", "title", "type", "duration_minutes", "intensity", "warmup", "exercises", "cooldown", "recovery_note"],
                properties: {
                  date: { type: "string" },
                  day: { type: "string" },
                  title: { type: "string" },
                  type: { type: "string" },
                  duration_minutes: { type: "integer" },
                  intensity: { type: "string", enum: ["low", "medium", "high"] },
                  warmup: { type: "array", items: { type: "string" } },
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["exercise_id", "rest_seconds", "instruction"],
                      properties: {
                        exercise_id: { type: "string" },
                        sets: { type: "integer" },
                        reps: { type: "integer" },
                        duration_minutes: { type: "integer" },
                        rest_seconds: { type: "integer" },
                        instruction: { type: "string" },
                      },
                    },
                  },
                  cooldown: { type: "array", items: { type: "string" } },
                  recovery_note: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  });
  const content = response.choices?.[0]?.message?.content;
  const parsed = GeneratedPlanSchema.parse(typeof content === "string" ? JSON.parse(content) : content);
  validateBusinessPlan(parsed, startDate, new Set(catalog.map(item => item.exerciseId)));
  return { plan: parsed, modelId };
}

function toPlanView(plan: PlanRow, workouts: WorkoutRow[], nutrition: any[]) { return { ...plan, workouts, nutrition }; }
function protectedData() { return protectedProcedure.use(async ({ ctx, next }) => { if (!ctx.user || !ctx.profile || !ctx.supabase) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in to continue." }); return next({ ctx: { ...ctx, dbUser: ctx.profile, dbClient: ctx.supabase } }); }); }
const protectedUser = protectedData();

export const appRouter = router({
  system: router({ health: publicProcedure.query(() => ({ ok: true })) }),
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
    deleteAccount: protectedUser.input(z.object({ confirm: z.literal(true) })).mutation(async ({ ctx }) => { try { await deleteAccount(ctx.user.id); return { success: true } as const; } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We couldn't delete your account. Please try again." }); } }),
  }),
  profile: router({
    get: protectedUser.query(({ ctx }) => ctx.dbUser),
    update: protectedUser.input(ProfileInput).mutation(async ({ ctx, input }) => { try { return await updateFitnessProfile(ctx.dbClient, ctx.user.id, input); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We couldn't save your profile. Please try again." }); } }),
  }),
  exercises: router({ catalog: protectedUser.query(async ({ ctx }) => { await ensureExerciseCatalog(catalogSeed); return getExerciseCatalog(ctx.dbClient); }) }),
  plan: router({
    current: protectedUser.query(async ({ ctx }) => { const plan = await getLatestPlan(ctx.dbClient, ctx.user.id); if (!plan) return null; return toPlanView(plan, await import("./db").then(db => db.getWorkoutsForPlan(ctx.dbClient, ctx.user.id, plan.id)), await getNutritionForPlan(ctx.dbClient, ctx.user.id, plan.id)); }),
    history: protectedUser.query(({ ctx }) => getPlanHistory(ctx.dbClient, ctx.user.id)),
    generate: protectedUser.input(z.object({ requestId: z.string().min(8).max(64), reason: z.string().max(120).default("New plan") })).mutation(async ({ ctx, input }) => {
      const existing = await getLatestPlan(ctx.dbClient, ctx.user.id);
      if (existing && Date.now() - new Date(existing.createdAt).getTime() < 15_000) return toPlanView(existing, await import("./db").then(db => db.getWorkoutsForPlan(ctx.dbClient, ctx.user.id, existing.id)), await getNutritionForPlan(ctx.dbClient, ctx.user.id, existing.id));
      if (!ctx.dbUser.onboardingCompleted) throw new TRPCError({ code: "BAD_REQUEST", message: "Complete onboarding before generating a plan." });
      const catalog = await getExerciseCatalog(ctx.dbClient); const generationId = input.requestId; const started = Date.now(); const startDate = dateInTimezone(ctx.dbUser.timezone);
      let generated: Awaited<ReturnType<typeof generatePlan>>;
      try { generated = await generatePlan(ctx.dbUser, startDate, catalog); } catch (error) { console.error("[FitBuddy] plan generation failed", error instanceof Error ? error.message : "unknown"); await recordGenerationLog(ctx.dbClient, { generation_id: generationId, user_id: ctx.user.id, operation: "workout_plan", model_id: process.env.GEMINI_WORKOUT_MODEL || "platform-default", prompt_version: PROMPT_VERSION, schema_version: SCHEMA_VERSION, latency_ms: Date.now() - started, retry_count: 0, status: "error", error_message: error instanceof Error ? error.message.slice(0, 500) : "unknown" }); throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Your plan couldn't be generated right now. Please try again." }); }
      const version = (existing?.version ?? 0) + 1; const planInput = { user_id: ctx.user.id, version, plan_start_date: startDate, plan_end_date: addDays(startDate, 6), user_timezone: ctx.dbUser.timezone, summary: generated.plan.summary, why_this_plan: generated.plan.why_this_plan, reason: input.reason, feedback: null, model_id: generated.modelId, prompt_version: PROMPT_VERSION, schema_version: SCHEMA_VERSION, generation_id: generationId };
      const rows = generated.plan.weekly_plan.map(day => ({ user_id: ctx.user.id, scheduled_date: day.date, day_label: day.day, title: day.title, type: day.type, duration_minutes: day.duration_minutes, intensity: day.intensity, warmup: day.warmup, exercises: day.exercises, cooldown: day.cooldown, recovery_note: day.recovery_note, status: "upcoming" }));
      const nutrition = [{ user_id: ctx.user.id, category: "Recovery", title: "Make recovery part of the plan", content: "Aim for a consistent sleep window, drink water across the day, and choose a protein-rich meal after harder sessions." }, { user_id: ctx.user.id, category: "Nutrition", title: "Keep meals uncomplicated", content: "Build most meals around a protein source, colorful produce, and a satisfying carbohydrate. No extreme restriction needed." }];
      const bundle = await insertPlanBundle(ctx.dbClient, { plan: planInput, version: { user_id: ctx.user.id, version, reason: input.reason, feedback: null, snapshot: generated.plan, model_id: generated.modelId, prompt_version: PROMPT_VERSION, schema_version: SCHEMA_VERSION }, workouts: rows, nutrition });
      await recordGenerationLog(ctx.dbClient, { generation_id: generationId, user_id: ctx.user.id, operation: "workout_plan", model_id: generated.modelId, prompt_version: PROMPT_VERSION, schema_version: SCHEMA_VERSION, latency_ms: Date.now() - started, retry_count: 0, status: "success", error_message: null });
      return toPlanView(bundle.plan, bundle.workouts, bundle.nutrition);
    }),
    adjust: protectedUser.input(z.object({ request: z.string().trim().min(2).max(500) })).mutation(async ({ ctx, input }) => {
      const current = await getLatestPlan(ctx.dbClient, ctx.user.id); if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Create a plan before adjusting it." });
      const db = await import("./db"); const currentRows = await db.getWorkoutsForPlan(ctx.dbClient, ctx.user.id, current.id); const normalized = input.request.toLowerCase(); const changes: string[] = [];
      const rows = currentRows.map(row => { const isFuture = row.status !== "completed" && row.scheduledDate >= dateInTimezone(ctx.dbUser.timezone); let duration = row.durationMinutes; let intensity = row.intensity; let type = row.type; let exercises = row.exercises; if (isFuture && /15|30|short|brief|less time/.test(normalized) && duration > 15) { const target = /15/.test(normalized) ? 15 : 30; duration = Math.min(duration, target); changes.push(`Reduced ${row.dayLabel} from ${row.durationMinutes} → ${target} minutes`); } if (isFuture && /less intense|easier|gentle/.test(normalized) && intensity !== "low") { intensity = "low"; changes.push(`Lowered intensity for ${row.dayLabel}`); } if (isFuture && /no equipment|bodyweight/.test(normalized)) { exercises = exercises.map(item => ({ ...item, exercise_id: ["squat", "pushup", "lunge", "plank"][Math.floor(Math.random() * 4)] })); changes.push(`Swapped ${row.dayLabel} to bodyweight options`); } if (isFuture && /rest day|recovery/.test(normalized) && row.type !== "Recovery") { type = "Recovery"; duration = Math.min(duration, 20); exercises = [{ exercise_id: "mobility", duration_minutes: 8, rest_seconds: 30, instruction: "Keep the movement gentle and comfortable." }]; changes.push(`Added a recovery day on ${row.dayLabel}`); } return { ...row, durationMinutes: duration, intensity, type, exercises }; });
      if (changes.length === 0) changes.push("Kept the plan structure and noted your request for the next check-in."); const version = current.version + 1; const planInput = { user_id: ctx.user.id, version, plan_start_date: current.planStartDate, plan_end_date: current.planEndDate, user_timezone: current.userTimezone, summary: current.summary, why_this_plan: current.whyThisPlan, reason: "Plan adjustment", feedback: input.request, model_id: "deterministic-update", prompt_version: PROMPT_VERSION, schema_version: SCHEMA_VERSION, generation_id: nanoid(18) };
      const bundle = await insertPlanBundle(ctx.dbClient, { plan: planInput, version: { user_id: ctx.user.id, version, reason: "Plan adjustment", feedback: input.request, snapshot: { changes, request: input.request }, model_id: "deterministic-update", prompt_version: PROMPT_VERSION, schema_version: SCHEMA_VERSION }, workouts: rows.map(row => ({ user_id: ctx.user.id, scheduled_date: row.scheduledDate, day_label: row.dayLabel, title: row.title, type: row.type, duration_minutes: row.durationMinutes, intensity: row.intensity, warmup: row.warmup, exercises: row.exercises, cooldown: row.cooldown, recovery_note: row.recoveryNote, status: row.status })), nutrition: [] });
      await createPlanChange(ctx.dbClient, { userId: ctx.user.id, planId: bundle.plan.id, fromVersion: current.version, toVersion: version, reason: input.request, changedSections: changes }); return { plan: toPlanView(bundle.plan, bundle.workouts, bundle.nutrition), changes };
    }),
  }),
  workout: router({
    complete: protectedUser.input(z.object({ id: z.string().uuid(), feel: z.string().max(32).optional(), energy: z.string().max(20).optional(), completedMinutes: z.number().int().min(1).max(180).optional(), note: z.string().max(300).optional(), status: z.enum(["completed", "modified"]).default("completed") })).mutation(async ({ ctx, input }) => { const row = await findWorkout(ctx.dbClient, ctx.user.id, input.id); if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Workout not found." }); await recordWorkoutCompletion(ctx.dbClient, { workoutId: row.id, planId: row.planId, userId: ctx.user.id, status: input.status, feel: input.feel, energy: input.energy, completedMinutes: input.completedMinutes ?? row.durationMinutes, note: input.note }); return { success: true, status: input.status }; }),
    skip: protectedUser.input(z.object({ id: z.string().uuid(), note: z.string().max(300).optional() })).mutation(async ({ ctx, input }) => { const row = await findWorkout(ctx.dbClient, ctx.user.id, input.id); if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Workout not found." }); await recordWorkoutCompletion(ctx.dbClient, { workoutId: row.id, planId: row.planId, userId: ctx.user.id, status: "skipped", note: input.note }); return { success: true }; }),
    replace: protectedUser.input(z.object({ id: z.string().uuid(), index: z.number().int().min(0).max(11), replacementId: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => { const catalog = await getExerciseCatalog(ctx.dbClient); const replacement = catalog.find(item => item.exerciseId === input.replacementId); if (!replacement) throw new TRPCError({ code: "NOT_FOUND", message: "That exercise is not available." }); const updated = await replaceWorkoutExercise(ctx.dbClient, ctx.user.id, input.id, input.index, replacement); if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "That exercise could not be replaced." }); return { success: true }; }),
  }),
  feedback: router({ submit: protectedUser.input(z.object({ planId: z.string().uuid().optional(), workoutId: z.string().uuid().optional(), kind: z.string().min(1).max(32), payload: z.record(z.string(), z.string()).default({}) })).mutation(async ({ ctx, input }) => { await recordFeedback(ctx.dbClient, { userId: ctx.user.id, planId: input.planId, workoutId: input.workoutId, kind: input.kind, payload: input.payload }); return { success: true }; }) }),
  progress: router({ get: protectedUser.query(async ({ ctx }) => { const data = await getProgressData(ctx.dbClient, ctx.user.id); const planned = data.workouts.filter(item => item.type !== "Recovery"); const completed = data.completions.filter(item => item.status === "completed" || item.status === "modified"); const minutes = completed.reduce((sum, item) => sum + (item.completedMinutes ?? 0), 0); const consistency = planned.length ? Math.min(100, Math.round((completed.length / planned.length) * 100)) : 0; const sorted = [...completed].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()); const dates = Array.from(new Set(sorted.map(item => localDate(item.completedAt, ctx.dbUser.timezone)))); let streak = 0; let cursor: string | null = null; for (const date of dates) { if (!cursor) { cursor = date; streak = 1; } else if (daysBetween(date, cursor) === 1) { streak += 1; cursor = date; } else break; } return { completedCount: completed.length, minutes, consistency, streak, plannedCount: planned.length, recent: data.completions.slice(0, 12) }; }) }),
  nutrition: router({ current: protectedUser.query(async ({ ctx }) => { const plan = await getLatestPlan(ctx.dbClient, ctx.user.id); return plan ? getNutritionForPlan(ctx.dbClient, ctx.user.id, plan.id) : []; }) }),
  admin: router({ metrics: adminProcedure.query(() => getAdminMetrics()), users: adminProcedure.query(() => getAdminUsers()) }),
  ai: router({ chat: protectedUser.input(z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string().max(4000) })).max(40) })).mutation(async ({ input }) => { const response = await invokeLLM({ messages: [{ role: "system", content: "You are FitBuddy's supportive fitness assistant. Give practical, non-diagnostic guidance and encourage sustainable habits." }, ...input.messages] }); return { content: response.choices?.[0]?.message?.content ?? "I couldn't answer that right now." }; }) }),
});

export type AppRouter = typeof appRouter;
