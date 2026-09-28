import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getProgressData } from "./db";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

const enabled = process.env.RUN_SUPABASE_LIVE_TESTS === "1";

describe("Supabase FitBuddy persistence", () => {
  it.runIf(enabled)("persists a real profile, plan version, workout completion, feedback, progress input, auth session, logout, reset request, and deletion", async () => {
    expect(url).toBeTruthy(); expect(serviceRoleKey).toBeTruthy(); expect(publishableKey).toBeTruthy();
    const admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const auth = createClient(url!, publishableKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `fitbuddy-persistence-${suffix}@example.com`;
    const password = "PersistenceTestPassword-123!";
    let userId: string | undefined;
    try {
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Persistence Test" } });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? "Could not create persistence test user");
      userId = created.data.user.id;
      const signedIn = await auth.auth.signInWithPassword({ email, password });
      expect(signedIn.error).toBeNull(); expect(signedIn.data.session?.user.id).toBe(userId);
      const sessionCheck = await auth.auth.getSession();
      expect(sessionCheck.data.session?.user.id).toBe(userId);
      const client = createClient(url!, publishableKey!, { global: { headers: { Authorization: `Bearer ${signedIn.data.session!.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
      const profile = await client.from("profiles").update({ name: "Persistence Test", age: 34, weight_kg: 70, height_cm: 175, fitness_goal: "Improve fitness", experience_level: "Some experience", training_location: "Home", equipment: ["None"], available_days: ["Mon", "Wed"], session_duration: 30, activities: ["Walking"], timezone: "UTC", onboarding_completed: true }).eq("id", userId).select("id,name,onboarding_completed").single();
      expect(profile.error).toBeNull(); expect(profile.data?.onboarding_completed).toBe(true);
      const plan = await client.from("workout_plans").insert({ user_id: userId, version: 1, plan_start_date: "2026-09-28", plan_end_date: "2026-10-04", user_timezone: "UTC", summary: "Persisted plan", why_this_plan: "Persistence test", reason: "test", model_id: "test", prompt_version: "test", schema_version: "test", generation_id: `p-${suffix}` }).select("id,version").single();
      expect(plan.error).toBeNull(); expect(plan.data?.version).toBe(1);
      const planVersion = await client.from("plan_versions").insert({ plan_id: plan.data!.id, user_id: userId, version: 1, reason: "test", snapshot: { test: true }, model_id: "test", prompt_version: "test", schema_version: "test" }).select("id").single();
      expect(planVersion.error).toBeNull();
      const workout = await client.from("workouts").insert({ plan_id: plan.data!.id, user_id: userId, scheduled_date: "2026-09-28", day_label: "Mon", title: "Persisted workout", type: "Strength", duration_minutes: 30, intensity: "low", warmup: ["Walk"], exercises: [{ exercise_id: "squat", sets: 2, reps: 8, rest_seconds: 60, instruction: "Control the descent." }], cooldown: ["Breathe"], recovery_note: "Recover well.", status: "upcoming" }).select("id").single();
      expect(workout.error).toBeNull();
      const completion = await client.from("workout_completions").insert({ workout_id: workout.data!.id, plan_id: plan.data!.id, user_id: userId, status: "completed", feel: "Just right", energy: "Normal", completed_minutes: 30 }).select("id").single();
      expect(completion.error).toBeNull();
      const workoutUpdate = await client.from("workouts").update({ status: "completed" }).eq("id", workout.data!.id).eq("user_id", userId).select("status").single();
      expect(workoutUpdate.data?.status).toBe("completed");
      const feedback = await client.from("feedback").insert({ user_id: userId, plan_id: plan.data!.id, workout_id: workout.data!.id, kind: "workout_feel", payload: { feel: "Just right" } }).select("id").single();
      expect(feedback.error).toBeNull();
      const progress = await getProgressData(client, userId);
      expect(progress.workouts).toHaveLength(1); expect(progress.completions).toHaveLength(1); expect(progress.completions[0]?.status).toBe("completed");
      const resetRequest = await auth.auth.resetPasswordForEmail(email, { redirectTo: "https://example.com/reset-password" });
      const recoveryLink = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: "https://example.com/reset-password" } });
      expect(recoveryLink.error).toBeNull(); expect(recoveryLink.data.properties?.action_link).toBeTruthy();
      expect(resetRequest.error === null || resetRequest.error?.message.toLowerCase().includes("rate limit")).toBe(true);
      const logout = await auth.auth.signOut();
      expect(logout.error).toBeNull();
      const afterLogout = await auth.auth.getSession();
      expect(afterLogout.data.session).toBeNull();
    } finally {
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
    const deleted = await admin.auth.admin.getUserById(userId!);
    expect(deleted.data.user).toBeNull();
  }, 45_000);
});
