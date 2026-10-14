-- PermitTrack database schema
-- Import via phpMyAdmin or: mysql -u root < schema.sql

CREATE DATABASE IF NOT EXISTS permittrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE permittrack;

CREATE TABLE `application_activity` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `application_id` int(11) NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `type` enum('status_change','message') NOT NULL DEFAULT 'message',
  `event` varchar(32) DEFAULT NULL,
  `body` text NOT NULL,
  `reply_to_id` int(11) DEFAULT NULL,
  `edited_at` datetime(3) DEFAULT NULL,
  `original_body` text DEFAULT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  KEY `idx_activity_app_created` (`application_id`,`created_at`),
  KEY `idx_activity_event` (`event`),
  CONSTRAINT `application_activity_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `application_activity_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `application_conditions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `application_id` int(11) NOT NULL,
  `condition_key` varchar(60) NOT NULL,
  `answer` tinyint(1) NOT NULL,
  `declared_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_app_condition` (`application_id`,`condition_key`),
  CONSTRAINT `application_conditions_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `application_document_versions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `document_id` int(11) NOT NULL,
  `version` int(11) NOT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `original_filename` varchar(255) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `reject_reason` varchar(40) DEFAULT NULL,
  `reject_notes` varchar(500) DEFAULT NULL,
  `decision_type` enum('rejected','revision') DEFAULT NULL,
  `decided_by` int(11) DEFAULT NULL,
  `decided_at` datetime DEFAULT NULL,
  `archived_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_doc_versions_document` (`document_id`,`version`),
  KEY `fk_doc_version_decided_by` (`decided_by`),
  CONSTRAINT `fk_doc_version_decided_by` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_doc_version_document` FOREIGN KEY (`document_id`) REFERENCES `application_documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `application_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `version` int(11) NOT NULL DEFAULT 1,
  `application_id` int(11) NOT NULL,
  `doc_name` varchar(190) NOT NULL,
  `office_code` varchar(20) DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `original_filename` varchar(255) DEFAULT NULL,
  `status` enum('Missing','Pending Review','Intake Approved','Verified','Needs Re-upload') NOT NULL DEFAULT 'Missing',
  `reject_reason` varchar(40) DEFAULT NULL,
  `reject_notes` varchar(500) DEFAULT NULL,
  `decision_type` enum('rejected','revision') DEFAULT NULL,
  `rejected_by` int(11) DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `pre_reject_status` varchar(20) DEFAULT NULL,
  `intake_by` int(11) DEFAULT NULL,
  `intake_at` datetime DEFAULT NULL,
  `uploaded_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `application_id` (`application_id`),
  KEY `fk_doc_intake_by` (`intake_by`),
  KEY `fk_doc_rejected_by` (`rejected_by`),
  CONSTRAINT `application_documents_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_doc_intake_by` FOREIGN KEY (`intake_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_doc_rejected_by` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `application_pipeline_progress` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `application_id` int(11) NOT NULL,
  `step_order` decimal(5,2) NOT NULL,
  `office_code` varchar(20) NOT NULL,
  `department_id` int(11) NOT NULL,
  `step_label` varchar(150) NOT NULL,
  `status` enum('pending','current','approved','rejected','skipped') NOT NULL DEFAULT 'pending',
  `decided_by` int(11) DEFAULT NULL,
  `decided_at` datetime DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `frozen_at` datetime DEFAULT NULL,
  `frozen_by` int(11) DEFAULT NULL,
  `freeze_reason` varchar(500) DEFAULT NULL,
  `freeze_kind` enum('freeze','revision') DEFAULT NULL,
  `delivery_method` enum('pickup','delivery','barangay_pickup') DEFAULT NULL,
  `delivery_address` varchar(255) DEFAULT NULL,
  `delivery_status` enum('preparing','out_for_delivery','delivered') DEFAULT NULL,
  `delivery_requested_at` datetime DEFAULT NULL,
  `delivery_updated_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_pipeline_progress_app` (`application_id`,`step_order`),
  KEY `idx_pipeline_progress_dept_status` (`department_id`,`status`),
  KEY `decided_by` (`decided_by`),
  KEY `fk_pipeline_frozen_by` (`frozen_by`),
  CONSTRAINT `application_pipeline_progress_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `application_pipeline_progress_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`),
  CONSTRAINT `application_pipeline_progress_ibfk_3` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pipeline_frozen_by` FOREIGN KEY (`frozen_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `applications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `applicant_id` int(11) NOT NULL,
  `business_id` int(11) DEFAULT NULL,
  `permit_type` enum('Food Service','Building/Renovation','Sign','Business License','Special Event','Building Permit','Occupancy Permit','Fencing Permit','Demolition Permit','Excavation/Road-Cut Permit','Sign Permit','Liquor/Tobacco License','MTOP/TODA Permit','Market Stall/Vending Permit','Barangay Clearance (Personal)','Barangay Employment Clearance','First-Time Jobseeker Certificate','Certificate of Residency','Certificate of Indigency','Certificate of Good Moral Character','Certificate to File Action','Barangay Business Clearance (New)','Barangay Business Clearance (Renewal)','Barangay Clearance for Special Events','Barangay Clearance for Tricycles (TODA)','Barangay Construction Clearance','Barangay Fencing Clearance','Barangay Demolition Clearance','Barangay Excavation/Road-Cut Clearance','Business Permit Renewal','Food Service (Sanitary) Renewal','Liquor/Tobacco License Renewal','Market Stall/Vending Permit Renewal','MTOP/TODA Permit Renewal','Sign Permit Renewal','Barangay Clearance for Tricycles (TODA) Renewal') DEFAULT NULL,
  `permit_type_id` int(11) DEFAULT NULL,
  `property_address` varchar(255) NOT NULL,
  `barangay_id` int(11) DEFAULT NULL,
  `business_name` varchar(190) DEFAULT NULL,
  `project_description` text DEFAULT NULL,
  `status` enum('Payment Pending','Submitted','Under Review','Inspection Scheduled','Inspector Notes','Approved','Rejected','Withdrawn') NOT NULL DEFAULT 'Submitted',
  `delivery_method` enum('pickup','delivery','barangay_pickup') DEFAULT NULL,
  `delivery_address` varchar(255) DEFAULT NULL,
  `delivery_fee` decimal(8,2) DEFAULT NULL,
  `delivery_status` enum('preparing','out_for_delivery','delivered') DEFAULT NULL,
  `delivery_requested_at` datetime DEFAULT NULL,
  `delivery_updated_at` datetime DEFAULT NULL,
  `withdrawn_at` datetime DEFAULT NULL,
  `priority` enum('Standard','High Priority','Overdue') NOT NULL DEFAULT 'Standard',
  `fee_charged` decimal(10,2) DEFAULT NULL,
  `assigned_reviewer_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `applicant_id` (`applicant_id`),
  KEY `assigned_reviewer_id` (`assigned_reviewer_id`),
  KEY `idx_app_business` (`business_id`),
  KEY `fk_app_permit_type` (`permit_type_id`),
  KEY `idx_applications_barangay` (`barangay_id`),
  CONSTRAINT `applications_ibfk_1` FOREIGN KEY (`applicant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `applications_ibfk_2` FOREIGN KEY (`assigned_reviewer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_app_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_app_permit_type` FOREIGN KEY (`permit_type_id`) REFERENCES `permit_types` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `audit_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `actor_id` int(11) DEFAULT NULL,
  `action` varchar(60) NOT NULL,
  `subject_type` varchar(40) NOT NULL,
  `subject_id` int(11) NOT NULL,
  `details` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_subject` (`subject_type`,`subject_id`),
  KEY `actor_id` (`actor_id`),
  CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `barangays` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_barangay_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `business_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `business_id` int(11) NOT NULL,
  `doc_key` varchar(40) NOT NULL,
  `id_type` varchar(40) DEFAULT NULL,
  `file_path` varchar(255) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size` int(11) NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_business_doc` (`business_id`,`doc_key`),
  CONSTRAINT `business_documents_ibfk_1` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `business_profiles` (
  `user_id` int(11) NOT NULL,
  `business_name` varchar(190) NOT NULL,
  `ein` varchar(50) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `address` varchar(255) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `business_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `businesses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `status` enum('draft','pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `business_name` varchar(190) NOT NULL,
  `trade_name` varchar(190) DEFAULT NULL,
  `ownership_type` enum('sole_proprietorship','partnership','corporation','cooperative') DEFAULT NULL,
  `line_of_business` varchar(100) DEFAULT NULL,
  `registration_number` varchar(60) DEFAULT NULL,
  `tin` varchar(20) DEFAULT NULL,
  `address_line` varchar(190) DEFAULT NULL,
  `barangay` varchar(100) DEFAULT NULL,
  `barangay_id` int(11) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `business_email` varchar(190) DEFAULT NULL,
  `business_phone` varchar(20) DEFAULT NULL,
  `floor_area_sqm` decimal(10,2) DEFAULT NULL,
  `employee_count` int(11) DEFAULT NULL,
  `is_registered_owner` tinyint(1) NOT NULL DEFAULT 1,
  `representative_role` varchar(80) DEFAULT NULL,
  `declared_at` datetime DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_business_status` (`status`,`submitted_at`),
  KEY `idx_business_user` (`user_id`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `fk_business_barangay` (`barangay_id`),
  CONSTRAINT `businesses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `businesses_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_business_barangay` FOREIGN KEY (`barangay_id`) REFERENCES `barangays` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `chat_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `message` varchar(500) NOT NULL,
  `matched_faq_id` int(11) DEFAULT NULL,
  `intent` varchar(40) DEFAULT NULL,
  `score` decimal(6,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_chat_unanswered` (`matched_faq_id`,`created_at`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chat_messages_ibfk_2` FOREIGN KEY (`matched_faq_id`) REFERENCES `faq_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `conversation_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `conversation_id` int(11) NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `body` text NOT NULL,
  `reply_to_id` int(11) DEFAULT NULL,
  `edited_at` datetime(3) DEFAULT NULL,
  `original_body` text DEFAULT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `idx_convmsg_thread` (`conversation_id`,`created_at`),
  KEY `sender_id` (`sender_id`),
  CONSTRAINT `conversation_messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversation_messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `conversations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `department_id` int(11) NOT NULL,
  `permit_type_id` int(11) DEFAULT NULL,
  `application_id` int(11) DEFAULT NULL,
  `subject` varchar(150) NOT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `last_message_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `last_sender_id` int(11) DEFAULT NULL,
  `user_read_at` datetime(3) DEFAULT NULL,
  `staff_read_at` datetime(3) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conv_application` (`application_id`),
  KEY `idx_conv_user` (`user_id`,`last_message_at`),
  KEY `idx_conv_department` (`department_id`,`status`,`last_message_at`),
  KEY `permit_type_id` (`permit_type_id`),
  KEY `last_sender_id` (`last_sender_id`),
  CONSTRAINT `conversations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversations_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversations_ibfk_3` FOREIGN KEY (`permit_type_id`) REFERENCES `permit_types` (`id`) ON DELETE SET NULL,
  CONSTRAINT `conversations_ibfk_4` FOREIGN KEY (`last_sender_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_conv_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `departments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `code` varchar(20) NOT NULL,
  `barangay_id` int(11) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `permit_types` varchar(255) NOT NULL DEFAULT '',
  `purpose` enum('review','payment') NOT NULL DEFAULT 'review',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_department_code` (`code`),
  KEY `fk_department_barangay` (`barangay_id`),
  CONSTRAINT `fk_department_barangay` FOREIGN KEY (`barangay_id`) REFERENCES `barangays` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `document_access_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `document_id` int(11) NOT NULL,
  `version` int(11) NOT NULL DEFAULT 1,
  `user_id` int(11) NOT NULL,
  `viewed_at` datetime DEFAULT NULL,
  `downloaded_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_doc_access` (`document_id`,`version`,`user_id`),
  KEY `fk_doc_access_user` (`user_id`),
  CONSTRAINT `fk_doc_access_document` FOREIGN KEY (`document_id`) REFERENCES `application_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_doc_access_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `faq_entries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category` varchar(40) NOT NULL DEFAULT 'General',
  `question` varchar(255) NOT NULL,
  `question_tl` varchar(255) DEFAULT NULL,
  `answer` text NOT NULL,
  `answer_tl` text DEFAULT NULL,
  `keywords` varchar(600) NOT NULL DEFAULT '',
  `link_path` varchar(120) DEFAULT NULL,
  `link_label` varchar(60) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 100,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_faq_question` (`question`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `notification_reads` (
  `user_id` int(11) NOT NULL,
  `activity_id` int(11) NOT NULL,
  `read_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`activity_id`),
  KEY `activity_id` (`activity_id`),
  CONSTRAINT `notification_reads_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notification_reads_ibfk_2` FOREIGN KEY (`activity_id`) REFERENCES `application_activity` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `application_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `method` enum('gcash','maya','bank_transfer') NOT NULL,
  `reference` varchar(100) DEFAULT NULL,
  `status` enum('pending','succeeded','failed') NOT NULL DEFAULT 'pending',
  `recipient_department_id` int(11) NOT NULL,
  `batch_token` varchar(40) DEFAULT NULL,
  `confirmed_by` int(11) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_payments_application` (`application_id`),
  KEY `idx_payments_recipient_status` (`recipient_department_id`,`status`),
  KEY `fk_payment_confirmed_by` (`confirmed_by`),
  CONSTRAINT `fk_payment_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_confirmed_by` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_recipient` FOREIGN KEY (`recipient_department_id`) REFERENCES `departments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `permit_pipeline_steps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `permit_type_id` int(11) NOT NULL,
  `step_order` decimal(5,2) NOT NULL,
  `office_code` varchar(20) NOT NULL,
  `step_label` varchar(150) NOT NULL,
  `condition_key` varchar(60) DEFAULT NULL,
  `condition_label` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_pipeline_permit_type` (`permit_type_id`,`step_order`),
  CONSTRAINT `permit_pipeline_steps_ibfk_1` FOREIGN KEY (`permit_type_id`) REFERENCES `permit_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `permit_type_conditions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `permit_type_id` int(11) NOT NULL,
  `condition_key` varchar(60) NOT NULL,
  `question_label` varchar(255) NOT NULL,
  `yes_label` varchar(60) NOT NULL DEFAULT 'Yes',
  `no_label` varchar(60) NOT NULL DEFAULT 'No',
  `requires_document` varchar(190) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permit_type_condition` (`permit_type_id`,`condition_key`),
  CONSTRAINT `fk_permit_type_condition` FOREIGN KEY (`permit_type_id`) REFERENCES `permit_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `permit_type_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `permit_type_id` int(11) NOT NULL,
  `doc_name` varchar(150) NOT NULL,
  `office_code` varchar(20) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `permit_type_id` (`permit_type_id`),
  CONSTRAINT `permit_type_documents_ibfk_1` FOREIGN KEY (`permit_type_id`) REFERENCES `permit_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `permit_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` varchar(400) DEFAULT NULL,
  `track` enum('construction','business','personal','barangay_standalone') NOT NULL,
  `resident_eligible` tinyint(1) NOT NULL DEFAULT 0,
  `business_eligible` tinyint(1) NOT NULL DEFAULT 0,
  `fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permit_type_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `resident_proofs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `verification_id` int(11) NOT NULL,
  `doc_type` varchar(40) NOT NULL,
  `issued_on` date DEFAULT NULL,
  `file_path` varchar(255) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size` int(11) NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `verification_id` (`verification_id`),
  CONSTRAINT `resident_proofs_ibfk_1` FOREIGN KEY (`verification_id`) REFERENCES `resident_verifications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `resident_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `address_line` varchar(190) NOT NULL,
  `barangay` varchar(100) NOT NULL,
  `city` varchar(100) NOT NULL,
  `barangay_id` int(11) DEFAULT NULL,
  `postal_code` varchar(10) NOT NULL,
  `declared_at` datetime NOT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_resver_status` (`status`,`created_at`),
  KEY `idx_resver_user` (`user_id`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_rv_barangay` (`barangay_id`),
  CONSTRAINT `resident_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `resident_verifications_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `user_reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reported_user_id` int(11) NOT NULL,
  `reported_by` int(11) NOT NULL,
  `category` varchar(60) NOT NULL,
  `description` text NOT NULL,
  `application_id` int(11) DEFAULT NULL,
  `document_id` int(11) DEFAULT NULL,
  `status` enum('open','actioned','dismissed') NOT NULL DEFAULT 'open',
  `resolved_by` int(11) DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_reports_reported_user` (`reported_user_id`),
  KEY `idx_user_reports_status` (`status`),
  KEY `fk_user_report_reported_by` (`reported_by`),
  KEY `fk_user_report_application` (`application_id`),
  KEY `fk_user_report_document` (`document_id`),
  KEY `fk_user_report_resolved_by` (`resolved_by`),
  CONSTRAINT `fk_user_report_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_report_document` FOREIGN KEY (`document_id`) REFERENCES `application_documents` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_report_reported_by` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_report_reported_user` FOREIGN KEY (`reported_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_report_resolved_by` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role` enum('applicant','staff','admin') NOT NULL DEFAULT 'applicant',
  `department_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `account_type` enum('unregistered','resident','business','staff') NOT NULL DEFAULT 'unregistered',
  `email` varchar(190) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `google_sub` varchar(64) DEFAULT NULL,
  `must_change_password` tinyint(1) NOT NULL DEFAULT 0,
  `full_name` varchar(150) NOT NULL,
  `first_name` varchar(80) DEFAULT NULL,
  `middle_name` varchar(80) DEFAULT NULL,
  `last_name` varchar(80) DEFAULT NULL,
  `birthdate` date DEFAULT NULL,
  `address_line` varchar(190) DEFAULT NULL,
  `barangay` varchar(100) DEFAULT NULL,
  `barangay_id` int(11) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `city_code` varchar(12) DEFAULT NULL,
  `province_code` varchar(12) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `phone_verified_at` datetime DEFAULT NULL,
  `privacy_consent_at` datetime DEFAULT NULL,
  `resident_status` enum('none','pending','verified','rejected') NOT NULL DEFAULT 'none',
  `onboarding_completed` tinyint(1) NOT NULL DEFAULT 0,
  `notifications_seen_at` datetime DEFAULT NULL,
  `notifications_read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `last_login_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_users_phone` (`phone`),
  UNIQUE KEY `uq_users_google_sub` (`google_sub`),
  KEY `fk_user_department` (`department_id`),
  KEY `fk_user_barangay` (`barangay_id`),
  CONSTRAINT `fk_user_barangay` FOREIGN KEY (`barangay_id`) REFERENCES `barangays` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `verification_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `channel` enum('email','sms') NOT NULL,
  `destination` varchar(190) NOT NULL,
  `code_hash` varchar(255) NOT NULL,
  `attempts` tinyint(4) NOT NULL DEFAULT 0,
  `expires_at` datetime NOT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_codes_user_channel` (`user_id`,`channel`),
  CONSTRAINT `verification_codes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Demo staff account: password is "Test1234!"
INSERT INTO users (role, account_type, email, password_hash, full_name, onboarding_completed, email_verified_at)
VALUES ('staff', 'resident', 'staff@hotmail.com', '$2y$10$R9ZNpONSujrmY7PQv9makuFpgzBeJkz9aCpqO9h/OjCQ40Ij3.ocy', 'Jordan Reyes', 1, NOW())
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);
