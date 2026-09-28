import { createClient, type SupabaseClient, type User as SupabaseAuthUser } from "@supabase/supabase-js";
import type { Request } from "express";
import { ENV } from "./_core/env";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
    throw new Error("Supabase server configuration is incomplete.");
  }
  if (!adminClient) {
    adminClient = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

export function createSupabaseUserClient(accessToken: string) {
  if (!ENV.supabaseUrl || !ENV.supabasePublishableKey) {
    throw new Error("Supabase client configuration is incomplete.");
  }
  return createClient(ENV.supabaseUrl, ENV.supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function bearerToken(req: Request) {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
}

export async function authenticateSupabaseRequest(req: Request) {
  const accessToken = bearerToken(req);
  if (!accessToken) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);
  if (error || !data.user) return null;
  return {
    accessToken,
    authUser: data.user as SupabaseAuthUser,
    client: createSupabaseUserClient(accessToken),
  };
}

export type SupabaseUserClient = ReturnType<typeof createSupabaseUserClient>;
export type { SupabaseAuthUser };
