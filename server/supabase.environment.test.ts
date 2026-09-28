import { describe, expect, it } from "vitest";

describe("Supabase environment contract", () => {
  it("accepts server-only credentials without exposing their values", async () => {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    expect(url).toBeTruthy(); expect(serviceRoleKey).toBeTruthy(); expect(publishableKey).toBeTruthy();
    expect(serviceRoleKey).not.toBe(publishableKey);
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${serviceRoleKey}` } });
    expect(response.ok).toBe(true);
    expect(await response.json()).toHaveProperty("external");
  }, 15_000);
});
