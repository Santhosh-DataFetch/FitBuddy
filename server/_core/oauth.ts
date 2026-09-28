import type { Express, Request, Response } from "express";

/**
 * FitBuddy uses Supabase Auth for browser sign-in. Keep this route as a clear
 * migration response for stale links rather than maintaining a second session
 * system beside Supabase.
 */
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.status(410).json({ error: "FitBuddy sign-in moved to Supabase Auth. Start again from the app." });
  });
}
