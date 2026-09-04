-- Before the per-year intake system, `application_settings` held a single global
-- submission window under the literal id "default". Per-year settings now key
-- rows by intake year (e.g. "2027"), so that legacy row is invisible to the admin
-- UI and any previously-configured window silently reads back as "not configured".
--
-- Rename the legacy row to the "2027" intake year it was actually configured for,
-- but only when no "2027" row already exists (avoids clobbering a window an admin
-- has since configured directly under "2027").
UPDATE application_settings SET id = '2027' WHERE id = 'default'
  AND NOT EXISTS (SELECT 1 FROM application_settings WHERE id = '2027');
