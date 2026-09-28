CREATE TABLE `exercise_catalog` (
	`exerciseId` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`category` varchar(48) NOT NULL,
	`targetMuscles` text NOT NULL,
	`equipment` text NOT NULL,
	`difficulty` varchar(24) NOT NULL,
	`instructions` text NOT NULL,
	`substitutions` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exercise_catalog_exerciseId` PRIMARY KEY(`exerciseId`)
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`planId` varchar(32),
	`kind` varchar(32) NOT NULL,
	`payload` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generation_logs` (
	`generationId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`operation` varchar(48) NOT NULL,
	`modelId` varchar(120) NOT NULL,
	`promptVersion` varchar(32) NOT NULL,
	`schemaVersion` varchar(32) NOT NULL,
	`latencyMs` int,
	`retryCount` int NOT NULL DEFAULT 0,
	`status` varchar(24) NOT NULL,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generation_logs_generationId` PRIMARY KEY(`generationId`)
);
--> statement-breakpoint
CREATE TABLE `nutrition_tips` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`planId` varchar(32),
	`category` varchar(32) NOT NULL,
	`title` varchar(120) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nutrition_tips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plan_versions` (
	`id` varchar(32) NOT NULL,
	`planId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`version` int NOT NULL,
	`reason` varchar(120) NOT NULL,
	`feedback` text,
	`snapshot` text NOT NULL,
	`modelId` varchar(120) NOT NULL,
	`promptVersion` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plan_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_completions` (
	`id` varchar(32) NOT NULL,
	`workoutId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`status` varchar(20) NOT NULL,
	`feel` varchar(32),
	`energy` varchar(20),
	`completedMinutes` int,
	`note` text,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workout_completions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_plans` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`version` int NOT NULL,
	`planStartDate` date NOT NULL,
	`planEndDate` date NOT NULL,
	`userTimezone` varchar(64) NOT NULL,
	`summary` text NOT NULL,
	`whyThisPlan` text NOT NULL,
	`reason` varchar(120) NOT NULL,
	`feedback` text,
	`modelId` varchar(120) NOT NULL,
	`promptVersion` varchar(32) NOT NULL,
	`schemaVersion` varchar(32) NOT NULL,
	`generationId` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workout_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` varchar(32) NOT NULL,
	`planId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`scheduledDate` date NOT NULL,
	`dayLabel` varchar(32) NOT NULL,
	`title` varchar(120) NOT NULL,
	`type` varchar(48) NOT NULL,
	`durationMinutes` int NOT NULL,
	`intensity` varchar(16) NOT NULL,
	`warmup` text NOT NULL,
	`exercises` text NOT NULL,
	`cooldown` text NOT NULL,
	`recoveryNote` text NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'upcoming',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` varchar(24) NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `age` int;--> statement-breakpoint
ALTER TABLE `users` ADD `weightKg` int;--> statement-breakpoint
ALTER TABLE `users` ADD `heightCm` int;--> statement-breakpoint
ALTER TABLE `users` ADD `unit` varchar(16) DEFAULT 'metric';--> statement-breakpoint
ALTER TABLE `users` ADD `goal` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `experience` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `location` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `equipment` text;--> statement-breakpoint
ALTER TABLE `users` ADD `trainingDays` text;--> statement-breakpoint
ALTER TABLE `users` ADD `sessionDuration` int;--> statement-breakpoint
ALTER TABLE `users` ADD `activities` text;--> statement-breakpoint
ALTER TABLE `users` ADD `dietaryPreference` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `foodsToAvoid` text;--> statement-breakpoint
ALTER TABLE `users` ADD `limitations` text;--> statement-breakpoint
ALTER TABLE `users` ADD `timezone` varchar(64) DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingCompleted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `plan_versions_user_version_idx` ON `plan_versions` (`userId`,`version`);--> statement-breakpoint
CREATE INDEX `workout_completions_user_completed_idx` ON `workout_completions` (`userId`,`completedAt`);--> statement-breakpoint
CREATE INDEX `workout_plans_user_created_idx` ON `workout_plans` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `workouts_user_date_idx` ON `workouts` (`userId`,`scheduledDate`);--> statement-breakpoint
CREATE INDEX `workouts_plan_date_idx` ON `workouts` (`planId`,`scheduledDate`);