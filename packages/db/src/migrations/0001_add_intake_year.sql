-- Add intake_year to applications
ALTER TABLE applications ADD COLUMN intake_year TEXT NOT NULL DEFAULT '2027';

-- Add intake_year to application_access_requests
ALTER TABLE application_access_requests ADD COLUMN intake_year TEXT NOT NULL DEFAULT '2027';
