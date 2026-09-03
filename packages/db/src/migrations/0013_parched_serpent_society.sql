CREATE TABLE `school_coordinate_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `applications` ADD `flags` text DEFAULT '[]' NOT NULL;