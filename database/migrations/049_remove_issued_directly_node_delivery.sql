-- Migration 049: Remove duplicate node delivery for 'Issued directly by the barangay'
--
-- Permits issued directly by the barangay are single-step permits whose delivery is
-- handled entirely at the permit level (applications.delivery_method).
-- Per-node delivery ('Files from Issued directly by the barangay' / 'Delivery — Issued directly by the barangay')
-- was creating a duplicate delivery card on both the applicant and staff sides.

UPDATE application_pipeline_progress
SET delivery_method = NULL,
    delivery_address = NULL,
    delivery_status = NULL,
    delivery_requested_at = NULL,
    delivery_updated_at = NULL
WHERE step_label = 'Issued directly by the barangay';

DELETE FROM application_activity
WHERE body LIKE '%Applicant chose how to receive Issued directly by the barangay\'s files%';

