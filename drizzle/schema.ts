import { boolean, date, int, mysqlTable, text, timestamp, varchar, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 24 }).default("user").notNull(),
  age: int("age"),
  weightKg: int("weightKg"),
  heightCm: int("heightCm"),
  unit: varchar("unit", { length: 16 }).default("metric"),
  goal: varchar("goal", { length: 64 }),
  experience: varchar("experience", { length: 32 }),
  location: varchar("location", { length: 32 }),
  equipment: text("equipment"),
  trainingDays: text("trainingDays"),
  sessionDuration: int("sessionDuration"),
  activities: text("activities"),
  dietaryPreference: varchar("dietaryPreference", { length: 64 }),
  foodsToAvoid: text("foodsToAvoid"),
  limitations: text("limitations"),
  timezone: varchar("timezone", { length: 64 }).default("UTC"),
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const exerciseCatalog = mysqlTable("exercise_catalog", {
  exerciseId: varchar("exerciseId", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  category: varchar("category", { length: 48 }).notNull(),
  targetMuscles: text("targetMuscles").notNull(),
  equipment: text("equipment").notNull(),
  difficulty: varchar("difficulty", { length: 24 }).notNull(),
  instructions: text("instructions").notNull(),
  substitutions: text("substitutions").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const workoutPlans = mysqlTable("workout_plans", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: int("userId").notNull(),
  version: int("version").notNull(),
  planStartDate: date("planStartDate").notNull(),
  planEndDate: date("planEndDate").notNull(),
  userTimezone: varchar("userTimezone", { length: 64 }).notNull(),
  summary: text("summary").notNull(),
  whyThisPlan: text("whyThisPlan").notNull(),
  reason: varchar("reason", { length: 120 }).notNull(),
  feedback: text("feedback"),
  modelId: varchar("modelId", { length: 120 }).notNull(),
  promptVersion: varchar("promptVersion", { length: 32 }).notNull(),
  schemaVersion: varchar("schemaVersion", { length: 32 }).notNull(),
  generationId: varchar("generationId", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userCreatedIdx: index("workout_plans_user_created_idx").on(table.userId, table.createdAt),
}));

export const planVersions = mysqlTable("plan_versions", {
  id: varchar("id", { length: 32 }).primaryKey(),
  planId: varchar("planId", { length: 32 }).notNull(),
  userId: int("userId").notNull(),
  version: int("version").notNull(),
  reason: varchar("reason", { length: 120 }).notNull(),
  feedback: text("feedback"),
  snapshot: text("snapshot").notNull(),
  modelId: varchar("modelId", { length: 120 }).notNull(),
  promptVersion: varchar("promptVersion", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userVersionIdx: index("plan_versions_user_version_idx").on(table.userId, table.version),
}));

export const workouts = mysqlTable("workouts", {
  id: varchar("id", { length: 32 }).primaryKey(),
  planId: varchar("planId", { length: 32 }).notNull(),
  userId: int("userId").notNull(),
  scheduledDate: date("scheduledDate").notNull(),
  dayLabel: varchar("dayLabel", { length: 32 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  type: varchar("type", { length: 48 }).notNull(),
  durationMinutes: int("durationMinutes").notNull(),
  intensity: varchar("intensity", { length: 16 }).notNull(),
  warmup: text("warmup").notNull(),
  exercises: text("exercises").notNull(),
  cooldown: text("cooldown").notNull(),
  recoveryNote: text("recoveryNote").notNull(),
  status: varchar("status", { length: 20 }).default("upcoming").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userDateIdx: index("workouts_user_date_idx").on(table.userId, table.scheduledDate),
  planDateIdx: index("workouts_plan_date_idx").on(table.planId, table.scheduledDate),
}));

export const workoutCompletions = mysqlTable("workout_completions", {
  id: varchar("id", { length: 32 }).primaryKey(),
  workoutId: varchar("workoutId", { length: 32 }).notNull(),
  userId: int("userId").notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  feel: varchar("feel", { length: 32 }),
  energy: varchar("energy", { length: 20 }),
  completedMinutes: int("completedMinutes"),
  note: text("note"),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
}, (table) => ({
  userCompletedIdx: index("workout_completions_user_completed_idx").on(table.userId, table.completedAt),
}));

export const feedback = mysqlTable("feedback", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: int("userId").notNull(),
  planId: varchar("planId", { length: 32 }),
  kind: varchar("kind", { length: 32 }).notNull(),
  payload: text("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const nutritionTips = mysqlTable("nutrition_tips", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: int("userId").notNull(),
  planId: varchar("planId", { length: 32 }),
  category: varchar("category", { length: 32 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const generationLogs = mysqlTable("generation_logs", {
  generationId: varchar("generationId", { length: 32 }).primaryKey(),
  userId: int("userId").notNull(),
  operation: varchar("operation", { length: 48 }).notNull(),
  modelId: varchar("modelId", { length: 120 }).notNull(),
  promptVersion: varchar("promptVersion", { length: 32 }).notNull(),
  schemaVersion: varchar("schemaVersion", { length: 32 }).notNull(),
  latencyMs: int("latencyMs"),
  retryCount: int("retryCount").default(0).notNull(),
  status: varchar("status", { length: 24 }).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type WorkoutPlan = typeof workoutPlans.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type Exercise = typeof exerciseCatalog.$inferSelect;
