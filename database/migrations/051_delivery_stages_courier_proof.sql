-- Migration 051: add courier tracking fields and photos for delivery stages
-- Stage 1 (Preparing -> Out for Delivery / Send for delivery):
--   courier_name, courier_phone, courier_license_photo, courier_plate_number
-- Stage 2 (Out for Delivery -> Ready to deliver):
--   delivery_proof_photo (proof of withheld documents / files)
-- Stage 3 (Delivered):
--   delivered_photo (image of delivered document at location)

ALTER TABLE application_pipeline_progress
    ADD COLUMN IF NOT EXISTS courier_name VARCHAR(150) NULL AFTER delivery_landmarks,
    ADD COLUMN IF NOT EXISTS courier_phone VARCHAR(50) NULL AFTER courier_name,
    ADD COLUMN IF NOT EXISTS courier_license_photo VARCHAR(255) NULL AFTER courier_phone,
    ADD COLUMN IF NOT EXISTS courier_plate_number VARCHAR(50) NULL AFTER courier_license_photo,
    ADD COLUMN IF NOT EXISTS delivery_proof_photo VARCHAR(255) NULL AFTER courier_plate_number,
    ADD COLUMN IF NOT EXISTS delivered_photo VARCHAR(255) NULL AFTER delivery_proof_photo;

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS courier_name VARCHAR(150) NULL AFTER delivery_status,
    ADD COLUMN IF NOT EXISTS courier_phone VARCHAR(50) NULL AFTER courier_name,
    ADD COLUMN IF NOT EXISTS courier_license_photo VARCHAR(255) NULL AFTER courier_phone,
    ADD COLUMN IF NOT EXISTS courier_plate_number VARCHAR(50) NULL AFTER courier_license_photo,
    ADD COLUMN IF NOT EXISTS delivery_proof_photo VARCHAR(255) NULL AFTER courier_plate_number,
    ADD COLUMN IF NOT EXISTS delivered_photo VARCHAR(255) NULL AFTER delivery_proof_photo;

