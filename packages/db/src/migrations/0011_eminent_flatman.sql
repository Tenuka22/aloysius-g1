ALTER TABLE `applications` ADD `admission_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `interview_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `is_banned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `admission_updated_at` integer;