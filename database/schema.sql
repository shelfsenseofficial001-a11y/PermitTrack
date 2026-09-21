-- PermitTrack database schema
-- Import via phpMyAdmin or: mysql -u root < schema.sql

CREATE DATABASE IF NOT EXISTS permittrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE permittrack;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role ENUM('applicant', 'staff') NOT NULL DEFAULT 'applicant',
    account_type ENUM('resident', 'business') NOT NULL DEFAULT 'resident',
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    onboarding_completed TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE business_profiles (
    user_id INT PRIMARY KEY,
    business_name VARCHAR(190) NOT NULL,
    ein VARCHAR(50) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address VARCHAR(255) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    applicant_id INT NOT NULL,
    permit_type ENUM('Food Service','Building/Renovation','Sign','Business License','Special Event') NOT NULL,
    property_address VARCHAR(255) NOT NULL,
    business_name VARCHAR(190) NULL,
    project_description TEXT NULL,
    status ENUM('Submitted','Under Review','Inspection Scheduled','Inspector Notes','Approved','Rejected') NOT NULL DEFAULT 'Submitted',
    priority ENUM('Standard','High Priority','Overdue') NOT NULL DEFAULT 'Standard',
    assigned_reviewer_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_reviewer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE application_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    doc_name VARCHAR(190) NOT NULL,
    file_path VARCHAR(255) NULL,
    original_filename VARCHAR(255) NULL,
    status ENUM('Missing','Pending Review','Verified','Needs Re-upload') NOT NULL DEFAULT 'Missing',
    uploaded_at DATETIME NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE application_activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    sender_id INT NULL,
    type ENUM('status_change','message') NOT NULL DEFAULT 'message',
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Demo staff account: password is "password123"
INSERT INTO users (role, account_type, email, password_hash, full_name, onboarding_completed)
VALUES ('staff', 'resident', 'staff@permittrack.city', '$2y$10$3hyH.ZDYxi3bD7sJypww9.6Vf5l/jlCHeht636P8RiMFPA6JV0/TO', 'Jordan Reyes', 1);
