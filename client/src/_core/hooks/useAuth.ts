import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

type AuthUser = { id: string; openId: string; name: string | null; email: string | null; role: "user" | "admin"; onboardingCompleted: boolean };

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
      void utils.auth.me.invalidate();
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [utils.auth.me]);

  const meQuery = trpc.auth.me.useQuery(undefined, { enabled: !sessionLoading && Boolean(session), retry: false, refetchOnWindowFocus: false });
  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    await logoutMutation.mutateAsync().catch(() => undefined);
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [logoutMutation, utils]);

  const fallbackUser: AuthUser | null = session?.user ? { id: session.user.id, openId: session.user.id, name: (session.user.user_metadata?.name as string | undefined) ?? null, email: session.user.email ?? null, role: "user", onboardingCompleted: false } : null;
  const user = (meQuery.data as AuthUser | null | undefined) ?? fallbackUser;
  const loading = sessionLoading || (Boolean(session) && meQuery.isLoading) || logoutMutation.isPending;

  useEffect(() => {
    if (!redirectOnUnauthenticated || loading || user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    window.location.href = redirectPath || "/login";
  }, [loading, redirectOnUnauthenticated, redirectPath, user]);

  return useMemo(() => ({ user, loading, error: meQuery.error ?? logoutMutation.error ?? null, isAuthenticated: Boolean(session), refresh: () => meQuery.refetch(), logout }), [user, loading, meQuery.error, meQuery.refetch, logoutMutation.error, session, logout]);
}
