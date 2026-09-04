-- application_marks previously had no way to distinguish an admin's authoritative,
-- verified score from the indicative preview an applicant's own form submits for
-- itself. Both wrote into the same (application_id, category_type) row, so an
-- applicant could forge inflated marks that then pre-filled the admin's editable
-- score. Add a source discriminator so the two write paths never collide.
ALTER TABLE application_marks ADD COLUMN source TEXT NOT NULL DEFAULT 'admin';
