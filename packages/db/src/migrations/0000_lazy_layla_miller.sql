CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text DEFAULT 'credential' NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_accountId_uidx` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `g1_application_access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`birth_certificate_number` text NOT NULL,
	`applicant_name` text NOT NULL,
	`guardian_name` text DEFAULT '' NOT NULL,
	`contact_email` text NOT NULL,
	`contact_phone` text,
	`request_type` text DEFAULT 'access' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`intake_year` text DEFAULT '2027' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE TABLE `g1_application_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`category_type` text NOT NULL,
	`breakdown` text DEFAULT '[]' NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'admin' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `g1_application_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`opens_at` integer NOT NULL,
	`closes_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `g1_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`session_code` text NOT NULL,
	`access_key_hash` text NOT NULL,
	`access_key_hint` text NOT NULL,
	`birth_certificate_number` text,
	`data` text NOT NULL,
	`intake_year` text DEFAULT '2027' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`submitted_at` integer,
	`admission_status` text DEFAULT 'pending' NOT NULL,
	`interview_notes` text DEFAULT '' NOT NULL,
	`is_banned` integer DEFAULT false NOT NULL,
	`ban_reason` text,
	`admission_updated_at` integer,
	`flags` text DEFAULT '[]' NOT NULL,
	`location_skip_status` integer DEFAULT 0 NOT NULL,
	`birth_certificate_skip_status` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `g1_applications_session_code_unique` ON `g1_applications` (`session_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `g1_applications_access_key_hash_unique` ON `g1_applications` (`access_key_hash`);--> statement-breakpoint
CREATE TABLE `g1_school_coordinate_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
