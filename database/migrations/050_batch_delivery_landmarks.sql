-- Migration 050: add delivery_landmarks to application_pipeline_progress
-- Stores optional landmarks / additional directions submitted with a batch delivery request.
ALTER TABLE application_pipeline_progress
    ADD COLUMN IF NOT EXISTS delivery_landmarks TEXT NULL AFTER delivery_address;

