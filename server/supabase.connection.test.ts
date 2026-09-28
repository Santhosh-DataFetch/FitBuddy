import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

function requireConfig() {
  expect(url, "SUPABASE_URL must be configured").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY must be configured").toBeTruthy();
  expect(publishableKey, "SUPABASE_PUBLISHABLE_KEY must be configured").toBeTruthy();
  expect(serviceRoleKey).not.toBe(publishableKey);
}

describe("Supabase server configuration", () => {
  it("authenticates a lightweight server-side request without exposing secrets", async () => {
    requireConfig();
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${serviceRoleKey}` } });
    expect(response.ok, `Supabase settings endpoint returned ${response.status}`).toBe(true);
    expect(await response.json()).toHaveProperty("external");
  }, 15_000);

  it.runIf(process.env.RUN_SUPABASE_RLS_TESTS === "1")("enforces symmetric ownership and prevents cross-user access or mutation", async () => {
    requireConfig();
    const admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const authClient = createClient(url!, publishableKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const emailA = `fitbuddy-rls-a-${suffix}@example.com`;
    const emailB = `fitbuddy-rls-b-${suffix}@example.com`;
    let userA: string | undefined;
    let userB: string | undefined;
    try {
      const createdA = await admin.auth.admin.createUser({ email: emailA, password: "RlsTestPassword-123!", email_confirm: true });
      const createdB = await admin.auth.admin.createUser({ email: emailB, password: "RlsTestPassword-123!", email_confirm: true });
      if (createdA.error || createdB.error || !createdA.data.user || !createdB.data.user) throw new Error("Could not create temporary RLS users");
      userA = createdA.data.user.id; userB = createdB.data.user.id;
      const signedInA = await authClient.auth.signInWithPassword({ email: emailA, password: "RlsTestPassword-123!" });
      const signedInB = await authClient.auth.signInWithPassword({ email: emailB, password: "RlsTestPassword-123!" });
      if (signedInA.error || signedInB.error || !signedInA.data.session || !signedInB.data.session) throw new Error("Could not sign in temporary RLS users");
      const clientA = createClient(url!, publishableKey!, { global: { headers: { Authorization: `Bearer ${signedInA.data.session.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
      const clientB = createClient(url!, publishableKey!, { global: { headers: { Authorization: `Bearer ${signedInB.data.session.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
      const insertedA = await clientA.from("workout_plans").insert({ user_id: userA, version: 1, plan_start_date: "2026-09-28", plan_end_date: "2026-10-04", user_timezone: "UTC", summary: "owner A test", why_this_plan: "RLS verification", reason: "test", model_id: "test", prompt_version: "test", schema_version: "test", generation_id: `rls-a-${suffix}` }).select("id,summary").single();
      const insertedB = await clientB.from("workout_plans").insert({ user_id: userB, version: 1, plan_start_date: "2026-09-28", plan_end_date: "2026-10-04", user_timezone: "UTC", summary: "owner B test", why_this_plan: "RLS verification", reason: "test", model_id: "test", prompt_version: "test", schema_version: "test", generation_id: `rls-b-${suffix}` }).select("id,summary").single();
      if (insertedA.error || !insertedA.data) throw new Error(`RLS owner A insert failed: ${insertedA.error?.message ?? "unknown"}`);
      if (insertedB.error || !insertedB.data) throw new Error(`RLS owner B insert failed: ${insertedB.error?.message ?? "unknown"}`);
      const ownerARead = await clientA.from("workout_plans").select("summary").eq("id", insertedA.data.id).single();
      const ownerBRead = await clientB.from("workout_plans").select("summary").eq("id", insertedB.data.id).single();
      expect(ownerARead.data?.summary).toBe("owner A test");
      expect(ownerBRead.data?.summary).toBe("owner B test");
      const aReadsB = await clientA.from("workout_plans").select("id,summary").eq("id", insertedB.data.id);
      const bReadsA = await clientB.from("workout_plans").select("id,summary").eq("id", insertedA.data.id);
      expect(aReadsB.error).toBeNull(); expect(aReadsB.data ?? []).toHaveLength(0);
      expect(bReadsA.error).toBeNull(); expect(bReadsA.data ?? []).toHaveLength(0);
      const aUpdatesB = await clientA.from("workout_plans").update({ summary: "attacked" }).eq("id", insertedB.data.id).select("id,summary");
      const bUpdatesA = await clientB.from("workout_plans").update({ summary: "attacked" }).eq("id", insertedA.data.id).select("id,summary");
      expect(aUpdatesB.error).toBeNull(); expect(aUpdatesB.data ?? []).toHaveLength(0);
      expect(bUpdatesA.error).toBeNull(); expect(bUpdatesA.data ?? []).toHaveLength(0);
      const privateProfileRead = await clientA.from("profiles").select("id,email,role").eq("id", userB);
      expect(privateProfileRead.error).toBeNull(); expect(privateProfileRead.data ?? []).toHaveLength(0);
    } finally {
      if (userA) await admin.auth.admin.deleteUser(userA);
      if (userB) await admin.auth.admin.deleteUser(userB);
    }
  }, 30_000);
});
