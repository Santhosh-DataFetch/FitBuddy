import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !publishableKey) {
  console.warn("[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.");
}

export const supabase = createClient(url ?? "https://placeholder.supabase.co", publishableKey ?? "placeholder", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
