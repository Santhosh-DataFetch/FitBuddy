import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("admin authorization", () => {
  it("denies admin-only metrics to a normal authenticated user", async () => {
    const ctx: TrpcContext = {
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
      user: { id: "00000000-0000-0000-0000-000000000001", openId: "normal-user", name: "Normal", email: "normal@example.com", role: "user", onboardingCompleted: false },
      profile: null,
      supabase: null,
      accessToken: null,
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.metrics()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
