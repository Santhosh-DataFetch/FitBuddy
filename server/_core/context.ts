import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { ensureProfile } from "../db";
import { authenticateSupabaseRequest, type SupabaseUserClient } from "../supabase";
import type { AppProfile } from "../db";

export type CurrentUser = {
  id: string;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  onboardingCompleted: boolean;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: CurrentUser | null;
  profile: AppProfile | null;
  supabase: SupabaseUserClient | null;
  accessToken: string | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const session = await authenticateSupabaseRequest(opts.req);
  if (!session) return { req: opts.req, res: opts.res, user: null, profile: null, supabase: null, accessToken: null };
  const profile = await ensureProfile(session.authUser);
  return {
    req: opts.req,
    res: opts.res,
    supabase: session.client,
    accessToken: session.accessToken,
    profile,
    user: { id: session.authUser.id, openId: session.authUser.id, name: profile.name, email: session.authUser.email ?? profile.email, role: profile.role, onboardingCompleted: profile.onboardingCompleted },
  };
}
