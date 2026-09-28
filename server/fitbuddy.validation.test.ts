import { describe, expect, it } from "vitest";
import { __fitbuddyTesting } from "./routers";

const validDay = (date: string) => ({
  date,
  day: "Mon",
  title: "Strength foundation",
  type: "Strength",
  duration_minutes: 30,
  intensity: "medium" as const,
  warmup: ["Easy movement"],
  exercises: [{ exercise_id: "squat", sets: 2, reps: 8, rest_seconds: 60, instruction: "Move with control." }],
  cooldown: ["Easy breathing"],
  recovery_note: "Leave a little in reserve.",
});

describe("FitBuddy plan validation", () => {
  it("creates consecutive dates for a seven-day plan", () => {
    expect(__fitbuddyTesting.addDays("2026-09-28", 6)).toBe("2026-10-04");
  });

  it("rejects plans with unknown exercise references", () => {
    const weeklyPlan = Array.from({ length: 7 }, (_, index) => validDay(__fitbuddyTesting.addDays("2026-09-28", index)));
    weeklyPlan[3] = { ...weeklyPlan[3], exercises: [{ ...weeklyPlan[3].exercises[0], exercise_id: "invented-movement" }] };
    expect(() => __fitbuddyTesting.validateBusinessPlan({ summary: "A sustainable plan", why_this_plan: "Fits the requested schedule", weekly_plan: weeklyPlan }, "2026-09-28", new Set(["squat"]))).toThrow("Unknown exercise reference");
  });
});
