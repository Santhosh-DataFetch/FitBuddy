import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("auth.logout", () => {
  it("reports success while browser Supabase Auth owns session revocation", async () => {
    const ctx: TrpcContext = {
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
      user: null,
      profile: null,
      supabase: null,
      accessToken: null,
    };
    const result = await appRouter.createCaller(ctx).auth.logout();
    expect(result).toEqual({ success: true });
  });
});
