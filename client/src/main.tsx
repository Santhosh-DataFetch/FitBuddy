import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError) || typeof window === "undefined") return;
  if (error.data?.code !== "UNAUTHORIZED") return;
  if (!["/login", "/signup", "/forgot-password", "/reset-password"].includes(window.location.pathname)) window.location.href = "/login";
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.query.state.error);
    console.error("[API Query Error]", event.query.state.error);
  }
});
queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.mutation.state.error);
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>,
);
