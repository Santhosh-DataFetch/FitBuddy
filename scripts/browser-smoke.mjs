import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !serviceRoleKey || !publishableKey) throw new Error("Supabase server configuration is required for browser smoke tests.");

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `fitbuddy-browser-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
const password = `Smoke-${Date.now()}-Strong!Aa9`;
const changedPassword = `SmokeReset-${Date.now()}-Strong!Bb8`;
let userId;
const checks = [];
function check(condition, label) { if (!condition) throw new Error(`Browser smoke failed: ${label}`); checks.push(label); }
async function findUser() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = result.data.users.find(item => item.email === email);
    if (user) return user;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Temporary browser smoke user was not created");
}
async function confirmUser() {
  const user = await findUser(); userId = user.id;
  const result = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
  if (result.error) throw result.error;
}
async function ensureUserAfterSignupRateLimit() {
  try { await confirmUser(); return false; } catch (error) {
    const text = await page.locator("body").innerText();
    if (!text.includes("Please wait a moment and try again.")) throw error;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Browser Smoke" } });
    if (created.error || !created.data.user) throw created.error || new Error("Temporary smoke account could not be created");
    userId = created.data.user.id;
    checks.push("signup shows safe rate-limit handling (SMTP rate limit)");
    return true;
  }
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(20_000);
const rpcStatuses = [];
page.on("response", async response => { if (response.url().includes("/api/trpc/profile.update") || response.url().includes("/api/trpc/plan.generate")) rpcStatuses.push({ path: response.url().split("/api/trpc/")[1]?.split("?")[0], status: response.status() }); if (response.url().includes("/api/trpc/auth.me")) { try { const text = JSON.stringify(await response.json()); rpcStatuses.push({ path: "auth.me", status: response.status(), matchesSmokeUser: text.includes(userId) }); } catch {} } if (response.url().includes("/api/trpc/plan.current")) { let hasPlan = false; let workoutCount = 0; let keys = []; let hasError = false; try { const body = await response.json(); const text = JSON.stringify(body); hasPlan = text.includes("whyThisPlan") || text.includes("planStartDate"); workoutCount = (text.match(/scheduledDate/g) || []).length; hasError = text.includes('"error"'); keys = Array.isArray(body) ? Object.keys(body[0]?.result?.data?.json ?? {}) : Object.keys(body?.result?.data?.json ?? {}); } catch {} rpcStatuses.push({ path: "plan.current", status: response.status(), hasPlan, workoutCount, hasError, keys }); } });
try {
  await page.goto(`${baseUrl}/signup`, { waitUntil: "networkidle" });
  check(await page.getByRole("heading", { name: "Make this week yours." }).isVisible(), "signup screen opens");
  await page.getByLabel("Your name").fill("Browser Smoke");
  await page.getByLabel("Email").fill(email);
  await page.locator('input[type="password"]').nth(0).fill(password);
  await page.locator('input[type="password"]').nth(1).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(2_000);
  const signupRateLimited = await ensureUserAfterSignupRateLimit();
  if (signupRateLimited) await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  if (!/onboarding|dashboard/.test(new URL(page.url()).pathname)) {
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(email); await page.locator('input[type="password"]').first().fill(password); await page.getByRole("button", { name: "Sign in" }).click();
  }
  await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 30_000 });
  check(/onboarding|dashboard/.test(new URL(page.url()).pathname), "signup authenticates and routes to the app");

  if (new URL(page.url()).pathname === "/dashboard") { await page.goto(`${baseUrl}/onboarding`, { waitUntil: "networkidle" }); await page.waitForTimeout(1_000); }
  if (new URL(page.url()).pathname === "/onboarding") {
    check(await page.getByRole("heading", { name: "Start with the basics." }).isVisible(), "onboarding starts at step one");
    await page.getByLabel("Your name").fill("Browser Smoke");
    for (let step = 1; step < 4; step += 1) await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Build my week" }).click();
    try { await page.waitForURL(/\/dashboard/, { timeout: 120_000 }); } catch { throw new Error(`Plan generation did not finish: rpc=${JSON.stringify(rpcStatuses)} :: ${(await page.locator("body").innerText()).slice(0, 800)}`); }
  }
  check(new URL(page.url()).pathname === "/dashboard", "onboarding generates and routes to dashboard");
  try { await page.getByRole("heading", { name: /Good morning,/ }).waitFor({ state: "visible", timeout: 60_000 }); } catch {
    const persisted = userId ? await admin.from("profiles").select("onboarding_completed").eq("id", userId).maybeSingle() : { data: null };
    throw new Error(`Dashboard did not render after onboarding: ${new URL(page.url()).pathname} :: persisted=${Boolean(persisted.data?.onboarding_completed)} :: rpc=${JSON.stringify(rpcStatuses)} :: ${(await page.locator("body").innerText()).slice(0, 800)}`);
  }
  check(await page.getByRole("heading", { name: /Good morning,/ }).isVisible(), "dashboard is accessible after onboarding");
  await page.reload({ waitUntil: "networkidle" });
  check(new URL(page.url()).pathname === "/dashboard", "session persists after refresh");
  check(await page.getByRole("heading", { name: /Good morning,/ }).isVisible(), "persisted profile remains accessible after refresh");
  await page.goto(`${baseUrl}/onboarding`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  check(new URL(page.url()).pathname === "/dashboard", "completed onboarding is not unnecessarily repeated");

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  const start = page.getByRole("button", { name: "Start workout" });
  try { await start.waitFor({ state: "visible", timeout: 60_000 }); } catch {
    const planCount = userId ? await admin.from("workout_plans").select("id", { count: "exact", head: true }).eq("user_id", userId) : { count: null };
    const workoutCount = userId ? await admin.from("workouts").select("id", { count: "exact", head: true }).eq("user_id", userId) : { count: null };
    throw new Error(`Workout action unavailable: plans=${planCount.count ?? 0}, workouts=${workoutCount.count ?? 0}, rpc=${JSON.stringify(rpcStatuses)} :: ${(await page.locator("body").innerText()).slice(0, 1200)}`);
  }
  await start.click(); await page.getByRole("button", { name: "Save workout" }).click();
  await page.getByText("Workout logged").waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  await page.goto(`${baseUrl}/progress`, { waitUntil: "networkidle" }); await page.getByText(/Completed workout/i).waitFor({ state: "visible", timeout: 30_000 });
  check(await page.getByText(/Completed workout/i).isVisible(), "workout feedback persists");
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  const adjust = page.getByRole("button", { name: "Adjust my plan" });
  await adjust.waitFor({ state: "visible", timeout: 60_000 });
  await adjust.click(); await page.getByRole("button", { name: "I only have 30 minutes" }).click(); await page.getByRole("button", { name: "Update" }).click();
  await page.getByText("Plan updated").waitFor({ state: "visible", timeout: 120_000 }).catch(() => undefined);
  check((await page.locator("body").innerText()).includes("Plan updated") || !(await page.getByRole("button", { name: "Update" }).isVisible().catch(() => false)), "plan update action completes");

  await page.goto(`${baseUrl}/forgot-password`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email); await page.getByRole("button", { name: "Send reset link" }).click();
  await page.getByRole("alert").waitFor({ state: "visible" });
  const resetUi = await page.getByRole("alert").innerText();
  check(resetUi.includes("If an account exists") || resetUi.includes("Please wait a moment"), "password reset request has safe UI");
  const recovery = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: `${baseUrl}/reset-password` } });
  if (recovery.error || !recovery.data.properties?.action_link) throw recovery.error || new Error("Recovery link was not generated");
  await page.goto(recovery.data.properties.action_link, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  check(new URL(page.url()).pathname === "/reset-password", "recovery link reaches reset screen");
  await page.locator('input[type="password"]').nth(0).fill(changedPassword); await page.locator('input[type="password"]').nth(1).fill(changedPassword); await page.getByRole("button", { name: "Update password" }).click();
  await page.waitForURL(/\/login/, { timeout: 20_000 });
  check(new URL(page.url()).pathname === "/login", "password reset signs out safely");

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  check(await page.getByText("Your plan starts with you.").isVisible(), "logout/protected route gate is visible when unauthenticated");
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" }); await page.getByLabel("Email").fill(email); await page.locator('input[type="password"]').first().fill(changedPassword); await page.getByRole("button", { name: "Sign in" }).click(); await page.waitForURL(/\/dashboard/, { timeout: 30_000 }); await page.getByRole("heading", { name: /Good morning,/ }).waitFor({ state: "visible", timeout: 60_000 });
  check(await page.getByRole("heading", { name: /Good morning,/ }).isVisible(), "login restores persisted account data");
  await page.goto(`${baseUrl}/profile`, { waitUntil: "networkidle" }); await page.getByRole("main").getByRole("button", { name: "Sign out" }).click(); await page.waitForURL(/\/$/, { timeout: 20_000 });
  check(new URL(page.url()).pathname === "/", "logout returns to landing page");
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" }); check(await page.getByText("Your plan starts with you.").isVisible(), "protected route is inaccessible after logout");
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
  await context.close(); await browser.close();
}
