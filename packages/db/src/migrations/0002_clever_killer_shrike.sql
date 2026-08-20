CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`access_key_hash` text NOT NULL,
	`access_key_hint` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_access_key_hash_unique` ON `applications` (`access_key_hash`);