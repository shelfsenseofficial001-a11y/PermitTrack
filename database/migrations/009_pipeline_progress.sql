-- 009: Per-application pipeline state.
--
-- 008 added permit_pipeline_steps as a TEMPLATE (what a permit type's route
-- looks like in the abstract). This adds the missing piece: which office a
-- SPECIFIC application is actually waiting on right now. One row per
-- resolved step, in submission order, with a concrete department_id (the
-- BARANGAY sentinel resolved to the applicant's/business's own barangay
-- department, per the routing rule in the spec doc).
--
-- See BREAKING_CHANGES.md #3 before reading/writing this table.
--
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/009_pipeline_progress.sql

USE permittrack;

CREATE TABLE IF NOT EXISTS application_pipeline_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    step_order DECIMAL(5,2) NOT NULL,
    office_code VARCHAR(20) NOT NULL,
    department_id INT NOT NULL,
    step_label VARCHAR(150) NOT NULL,
    status ENUM('pending', 'current', 'approved', 'rejected', 'skipped') NOT NULL DEFAULT 'pending',
    decided_by INT NULL,
    decided_at DATETIME NULL,
    notes VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pipeline_progress_app (application_id, step_order),
    INDEX idx_pipeline_progress_dept_status (department_id, status),
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
