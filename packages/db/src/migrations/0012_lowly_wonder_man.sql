CREATE TABLE `application_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`category_type` text NOT NULL,
	`breakdown` text DEFAULT '[]' NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
