ALTER TABLE `application_access_requests` RENAME TO `g1_application_access_requests`;--> statement-breakpoint
ALTER TABLE `application_marks` RENAME TO `g1_application_marks`;--> statement-breakpoint
ALTER TABLE `application_settings` RENAME TO `g1_application_settings`;--> statement-breakpoint
ALTER TABLE `applications` RENAME TO `g1_applications`;--> statement-breakpoint
ALTER TABLE `school_coordinate_overrides` RENAME TO `g1_school_coordinate_overrides`;--> statement-breakpoint
DROP INDEX `applications_session_code_unique`;--> statement-breakpoint
DROP INDEX `applications_access_key_hash_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `g1_applications_session_code_unique` ON `g1_applications` (`session_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `g1_applications_access_key_hash_unique` ON `g1_applications` (`access_key_hash`);