ALTER TABLE `applications` ADD `session_code` text;--> statement-breakpoint
UPDATE `applications` SET `session_code` = '26OLD' || printf('%03d', rowid) WHERE `session_code` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `applications_session_code_unique` ON `applications` (`session_code`);
