CREATE TABLE `application_access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`birth_certificate_number` text NOT NULL,
	`applicant_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
