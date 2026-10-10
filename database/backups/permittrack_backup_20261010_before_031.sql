/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.14-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: pt_orig
-- ------------------------------------------------------
-- Server version	10.11.14-MariaDB-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `permittrack`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `permittrack` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `permittrack`;

--
-- Table structure for table `application_activity`
--

DROP TABLE IF EXISTS `application_activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `application_activity` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `application_id` int(11) NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `type` enum('status_change','message') NOT NULL DEFAULT 'message',
  `event` varchar(32) DEFAULT NULL,
  `body` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  KEY `idx_activity_app_created` (`application_id`,`created_at`),
  KEY `idx_activity_event` (`event`),
  CONSTRAINT `application_activity_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `application_activity_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=209 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `application_activity`
--

LOCK TABLES `application_activity` WRITE;
/*!40000 ALTER TABLE `application_activity` DISABLE KEYS */;
INSERT INTO `application_activity` VALUES
(1,3,131,'status_change','submitted','Application submitted.','2026-09-30 23:53:26'),
(2,4,131,'status_change','submitted','Application submitted.','2026-09-30 23:53:37'),
(3,5,131,'status_change','submitted','Application submitted.','2026-10-01 08:08:56'),
(6,5,131,'status_change','status','Applicant updated the application details.','2026-10-01 08:21:08'),
(7,5,131,'message','message','hi !','2026-10-01 08:26:49'),
(10,6,134,'status_change','submitted','Application submitted.','2026-10-01 08:42:40'),
(11,6,134,'status_change','status','Applicant withdrew this application.','2026-10-01 08:43:04'),
(12,7,134,'status_change','submitted','Application submitted.','2026-10-01 08:43:21'),
(13,7,134,'status_change','status','Applicant updated the application details.','2026-10-01 08:46:33'),
(14,8,134,'status_change','submitted','Application submitted.','2026-10-01 08:49:39'),
(15,4,131,'status_change','status','Applicant updated the application details.','2026-10-01 08:52:35'),
(16,8,4,'status_change','approved','Barangay Excavation/Road-Cut Clearance — Approved by Barangay Secretary — Burol I.','2026-10-01 09:34:59'),
(17,9,131,'status_change','submitted','Application submitted.','2026-10-01 09:35:58'),
(18,9,4,'status_change','doc_verified','Valid Government ID marked as Verified.','2026-10-01 09:36:38'),
(19,9,4,'status_change','doc_verified','Valid Government ID marked as Verified.','2026-10-01 09:36:42'),
(20,9,4,'status_change','approved','Issued directly by the barangay — Approved by Barangay Secretary — Burol I.','2026-10-01 09:38:48'),
(21,6,4,'status_change','doc_verified','Demolition Plan marked as Verified.','2026-10-01 09:40:59'),
(22,6,4,'status_change','doc_verified','Proof of Ownership marked as Verified.','2026-10-01 09:41:01'),
(23,10,134,'status_change','submitted','Application submitted.','2026-10-01 10:37:04'),
(24,10,4,'status_change','doc_verified','Valid Government ID marked as Verified.','2026-10-01 10:39:22'),
(25,10,4,'status_change','approved','Issued directly by the barangay — Approved by Barangay Secretary — Burol I.','2026-10-01 10:41:03'),
(26,19,137,'status_change','submitted','Application submitted.','2026-10-02 23:14:05'),
(32,23,163,'status_change','submitted','Application submitted.','2026-10-02 23:55:59'),
(33,23,75,'status_change','doc_verified','Valid Government ID marked as Verified.','2026-10-02 23:56:43'),
(34,23,75,'status_change','doc_verified','Vehicle OR/CR marked as Verified.','2026-10-02 23:56:44'),
(35,23,75,'status_change','approved','Issued directly by the barangay — Approved by Barangay Secretary — Zone II.','2026-10-02 23:56:48'),
(40,28,163,'status_change','submitted','Application submitted.','2026-10-03 17:00:03'),
(41,29,169,'status_change','submitted','Application submitted.','2026-10-03 18:06:35'),
(42,29,169,'status_change','status','Applicant updated the application details.','2026-10-03 18:07:19'),
(127,19,75,'status_change','doc_rejected','Site Plan sent back: File won\'t open.','2026-10-05 14:53:17'),
(128,19,75,'status_change','status','Site Plan marked as Pending Review.','2026-10-05 14:53:20'),
(129,19,75,'status_change','doc_rejected','Site Plan sent back: Expired or out of date.','2026-10-05 14:53:25'),
(130,19,75,'status_change','status','Site Plan marked as Pending Review.','2026-10-05 14:53:57'),
(144,19,75,'status_change','doc_rejected','Site Plan sent back: Blurry or hard to read.','2026-10-05 14:57:21'),
(206,54,137,'status_change','submitted','Application submitted.','2026-10-08 10:37:26'),
(207,10,134,'message','message','yo permit ko','2026-10-08 10:53:39'),
(208,8,134,'message','message','yo permit ko asan na','2026-10-08 10:53:55');
/*!40000 ALTER TABLE `application_activity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `application_conditions`
--

DROP TABLE IF EXISTS `application_conditions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `application_conditions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `application_id` int(11) NOT NULL,
  `condition_key` varchar(60) NOT NULL,
  `answer` tinyint(1) NOT NULL,
  `declared_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_app_condition` (`application_id`,`condition_key`),
  CONSTRAINT `application_conditions_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `application_conditions`
--

LOCK TABLES `application_conditions` WRITE;
/*!40000 ALTER TABLE `application_conditions` DISABLE KEYS */;
INSERT INTO `application_conditions` VALUES
(2,6,'has_hazmat',0,'2026-10-01 08:42:40'),
(3,7,'has_hazmat',0,'2026-10-01 08:43:20'),
(10,19,'inside_subdivision',1,'2026-10-02 23:14:05'),
(11,19,'has_mechanical',0,'2026-10-02 23:14:05'),
(12,19,'has_electronics',0,'2026-10-02 23:14:05'),
(19,28,'inside_subdivision',0,'2026-10-03 17:00:03'),
(20,28,'has_mechanical',1,'2026-10-03 17:00:03'),
(21,28,'has_electronics',0,'2026-10-03 17:00:03'),
(22,29,'inside_subdivision',0,'2026-10-03 18:06:35'),
(23,29,'has_mechanical',1,'2026-10-03 18:06:35'),
(24,29,'has_electronics',1,'2026-10-03 18:06:35'),
(25,54,'inside_subdivision',1,'2026-10-08 10:37:26'),
(26,54,'has_mechanical',1,'2026-10-08 10:37:26'),
(27,54,'has_electronics',1,'2026-10-08 10:37:26');
/*!40000 ALTER TABLE `application_conditions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `application_documents`
--

DROP TABLE IF EXISTS `application_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `application_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `application_id` int(11) NOT NULL,
  `doc_name` varchar(190) NOT NULL,
  `office_code` varchar(20) DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `original_filename` varchar(255) DEFAULT NULL,
  `status` enum('Missing','Pending Review','Intake Approved','Verified','Needs Re-upload') NOT NULL DEFAULT 'Missing',
  `reject_reason` varchar(40) DEFAULT NULL,
  `reject_notes` varchar(500) DEFAULT NULL,
  `rejected_by` int(11) DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=102 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `application_documents`
--

LOCK TABLES `application_documents` WRITE;
/*!40000 ALTER TABLE `application_documents` DISABLE KEYS */;
INSERT INTO `application_documents` VALUES
(1,3,'Valid Government ID','BARANGAY',NULL,NULL,'Missing',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(2,4,'Valid Government ID','BARANGAY',NULL,NULL,'Missing',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(3,4,'Previous Barangay Clearance','BARANGAY',NULL,NULL,'Missing',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(4,5,'Valid Government ID','BARANGAY',NULL,NULL,'Missing',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(5,5,'Mediation Records (Lupon)','BARANGAY',NULL,NULL,'Missing',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
(6,6,'Demolition Plan','OBO','uploads/6/doc_6abdac8074aa79.56374819_Screenshot_2025-08-15_201152__1_.png','Screenshot 2025-08-15 201152 (1).png','Verified',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-01 08:42:40'),
(7,6,'Proof of Ownership','OBO','uploads/6/doc_6abdac80755345.59990642_PermitTrackIcon.png','PermitTrackIcon.png','Verified',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-01 08:42:40'),
(8,7,'Demolition Plan','OBO','uploads/7/doc_6abdaca8f40d66.89919981_Gemini_Generated_Image_6kwpkm6kwpkm6kwp.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp.jpg','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-01 08:43:21'),
(9,7,'Proof of Ownership','OBO','uploads/7/doc_6abdaca90080f5.69369767_skin-wwtw.png','skin-wwtw.png','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-01 08:43:21'),
(10,8,'Excavation Plan','ENGINEER','uploads/8/doc_6abdae23eb7a73.38080422_pixil-frame-0.png','pixil-frame-0.png','Intake Approved',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-01 08:49:39'),
(11,8,'Utility Company Authorization (if applicable)','ENGINEER','uploads/8/doc_6abdae23ec7ea1.40581497_skin-wwtw.png','skin-wwtw.png','Intake Approved',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-01 08:49:39'),
(12,9,'Valid Government ID','BARANGAY','uploads/9/doc_6abdb8fe891f38.69550959_Gemini_Generated_Image_6kwpkm6kwpkm6kwp__1_.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp (1).jpg','Verified',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-01 09:35:58'),
(13,10,'Valid Government ID','BARANGAY','uploads/10/doc_6abdc7501b7b62.80517799_Gemini_Generated_Image_6kwpkm6kwpkm6kwp__1_.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp (1).jpg','Verified',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-01 10:37:04'),
(14,19,'Site Plan','OBO','uploads/19/doc_6abfca3d9e0c27.42665768_Screenshot_2025-08-15_201152__1___1_.png','Screenshot 2025-08-15 201152 (1) (1).png','Needs Re-upload','unreadable',NULL,75,'2026-10-05 14:57:21',75,'2026-10-05 14:57:21','2026-10-02 23:14:05'),
(15,19,'Structural Drawings','OBO','uploads/19/doc_6abfca3da1b526.57215123_Gemini_Generated_Image_6kwpkm6kwpkm6kwp__1___1_.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp (1) (1).jpg','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 23:14:05'),
(16,19,'Lot Title or Tax Declaration','ASSESSOR','uploads/19/doc_6abfca3da33029.22558751_Screenshot_2025-08-15_201152__1___1_.png','Screenshot 2025-08-15 201152 (1) (1).png','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 23:14:05'),
(17,19,'Contractor License','OBO','uploads/19/doc_6abfca3da54df9.34954664_Gemini_Generated_Image_6kwpkm6kwpkm6kwp__1_.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp (1).jpg','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 23:14:05'),
(22,23,'Valid Government ID','BARANGAY','uploads/23/doc_6abfd40f709f87.04119279_Gemini_Generated_Image_6kwpkm6kwpkm6kwp__1___1_.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp (1) (1).jpg','Verified',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 23:55:59'),
(23,23,'Vehicle OR/CR','BARANGAY','uploads/23/doc_6abfd40f731291.83857614_Gemini_Generated_Image_6kwpkm6kwpkm6kwp__1_.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp (1).jpg','Verified',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 23:55:59'),
(32,28,'Site Plan','OBO','uploads/28/doc_6ac0c413b038d5.69760683_pixil-frame-0.png','pixil-frame-0.png','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-03 17:00:03'),
(33,28,'Structural Drawings','OBO','uploads/28/doc_6ac0c413b1c949.30347101_Case_Study_Proposal_Data_Privacy_and_Fairness_in_Digital_Scholarship_Processing.pdf','Case Study Proposal Data Privacy and Fairness in Digital Scholarship Processing.pdf','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-03 17:00:03'),
(34,28,'Lot Title or Tax Declaration','ASSESSOR','uploads/28/doc_6ac0c413b35dd9.59390139_skin-ett4.png','skin-ett4.png','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-03 17:00:03'),
(35,28,'Contractor License','OBO','uploads/28/doc_6ac0c413b4eaf8.38118952_SIPP_Case_Study_Proposal_Free_Drinking_Fountains_at_NCST.pdf','SIPP Case Study Proposal Free Drinking Fountains at NCST.pdf','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-03 17:00:03'),
(36,29,'Site Plan','OBO','uploads/29/doc_6ac0d3ab4f85c1.53412755_Case_Study_Proposal_Data_Privacy_and_Fairness_in_Digital_Scholarship_Processing.pdf','Case Study Proposal Data Privacy and Fairness in Digital Scholarship Processing.pdf','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-03 18:06:35'),
(37,29,'Structural Drawings','OBO','uploads/29/doc_6ac0d3ab509ac2.58417878_pixil-frame-0.png','pixil-frame-0.png','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-03 18:06:35'),
(38,29,'Lot Title or Tax Declaration','ASSESSOR','uploads/29/doc_6ac0d3ab528924.79595044_Screenshot_2025-08-15_201152__1___1_.png','Screenshot 2025-08-15 201152 (1) (1).png','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-03 18:06:35'),
(39,29,'Contractor License','OBO','uploads/29/doc_6ac0d3ab54b480.54062392_Case_Study_Proposal_Data_Privacy_and_Fairness_in_Digital_Scholarship_Processing.pdf','Case Study Proposal Data Privacy and Fairness in Digital Scholarship Processing.pdf','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-03 18:06:35'),
(98,54,'Site Plan','OBO','uploads/54/doc_6ac701e686de75.18337237_d6ae7cd7-d8b0-4aed-88cd-5e08eb3ba221.jpg','d6ae7cd7-d8b0-4aed-88cd-5e08eb3ba221.jpg','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-08 10:37:26'),
(99,54,'Structural Drawings','OBO','uploads/54/doc_6ac701e6882ab3.07950958_Screenshot_2025-08-15_201152__1___1___2_.png','Screenshot 2025-08-15 201152 (1) (1) (2).png','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-08 10:37:26'),
(100,54,'Lot Title or Tax Declaration','ASSESSOR','uploads/54/doc_6ac701e6893eb6.78559562_833573074_29049754831379753_1572527304040742178_n.jpg','833573074_29049754831379753_1572527304040742178_n.jpg','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-08 10:37:26'),
(101,54,'Contractor License','OBO','uploads/54/doc_6ac701e68aaa62.56123597_814050175_1077897945036728_471859734673432359_n.jpg','814050175_1077897945036728_471859734673432359_n.jpg','Pending Review',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-08 10:37:26');
/*!40000 ALTER TABLE `application_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `application_pipeline_progress`
--

DROP TABLE IF EXISTS `application_pipeline_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_pipeline_progress_app` (`application_id`,`step_order`),
  KEY `idx_pipeline_progress_dept_status` (`department_id`,`status`),
  KEY `decided_by` (`decided_by`),
  CONSTRAINT `application_pipeline_progress_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `application_pipeline_progress_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`),
  CONSTRAINT `application_pipeline_progress_ibfk_3` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=159 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `application_pipeline_progress`
--

LOCK TABLES `application_pipeline_progress` WRITE;
/*!40000 ALTER TABLE `application_pipeline_progress` DISABLE KEYS */;
INSERT INTO `application_pipeline_progress` VALUES
(4,3,1.00,'BARANGAY',14,'Issued directly by the barangay','current',NULL,NULL,NULL,'2026-09-30 23:53:26'),
(5,4,1.00,'BARANGAY',14,'Issued directly by the barangay','current',NULL,NULL,NULL,'2026-09-30 23:53:37'),
(6,5,1.00,'BARANGAY',14,'Issued directly by the barangay','current',NULL,NULL,NULL,'2026-10-01 08:08:56'),
(7,6,1.00,'BARANGAY',14,'Barangay Demolition Clearance','current',NULL,NULL,NULL,'2026-10-01 08:42:40'),
(8,6,2.00,'OBO',1,'Engineer review','pending',NULL,NULL,NULL,'2026-10-01 08:42:40'),
(9,6,3.00,'OBO',1,'Demolition Permit issued','pending',NULL,NULL,NULL,'2026-10-01 08:42:40'),
(10,7,1.00,'BARANGAY',14,'Barangay Demolition Clearance','current',NULL,NULL,NULL,'2026-10-01 08:43:20'),
(11,7,2.00,'OBO',1,'Engineer review','pending',NULL,NULL,NULL,'2026-10-01 08:43:20'),
(12,7,3.00,'OBO',1,'Demolition Permit issued','pending',NULL,NULL,NULL,'2026-10-01 08:43:20'),
(13,8,1.00,'BARANGAY',14,'Barangay Excavation/Road-Cut Clearance','approved',4,'2026-10-01 09:34:59',NULL,'2026-10-01 08:49:39'),
(14,8,2.00,'ENGINEER',9,'Public Works review','current',NULL,NULL,NULL,'2026-10-01 08:49:39'),
(15,8,3.00,'CENRO',6,'Environmental/drainage clearance','pending',NULL,NULL,NULL,'2026-10-01 08:49:39'),
(16,8,4.00,'ENGINEER',9,'Excavation/Road-Cut Permit issued','pending',NULL,NULL,NULL,'2026-10-01 08:49:39'),
(17,9,1.00,'BARANGAY',14,'Issued directly by the barangay','approved',4,'2026-10-01 09:38:48',NULL,'2026-10-01 09:35:58'),
(18,10,1.00,'BARANGAY',14,'Issued directly by the barangay','approved',4,'2026-10-01 10:41:03',NULL,'2026-10-01 10:37:04'),
(54,19,1.00,'BARANGAY',85,'Barangay Construction Clearance','current',NULL,NULL,NULL,'2026-10-02 23:14:05'),
(55,19,1.50,'ENGINEER',9,'HOA/Developer Clearance','pending',NULL,NULL,NULL,'2026-10-02 23:14:05'),
(56,19,2.00,'CPDO',4,'Zoning Clearance','pending',NULL,NULL,NULL,'2026-10-02 23:14:05'),
(57,19,3.00,'OBO',1,'Technical plan review','pending',NULL,NULL,NULL,'2026-10-02 23:14:05'),
(58,19,4.00,'CENRO',6,'Environmental clearance','pending',NULL,NULL,NULL,'2026-10-02 23:14:05'),
(59,19,5.00,'ASSESSOR',7,'RPT clearance','pending',NULL,NULL,NULL,'2026-10-02 23:14:05'),
(60,19,6.00,'OBO',1,'Building Permit issued','pending',NULL,NULL,NULL,'2026-10-02 23:14:05'),
(74,23,1.00,'BARANGAY',85,'Issued directly by the barangay','approved',75,'2026-10-02 23:56:48',NULL,'2026-10-02 23:55:59'),
(84,28,1.00,'BARANGAY',85,'Barangay Construction Clearance','current',NULL,NULL,NULL,'2026-10-03 17:00:03'),
(85,28,2.00,'CPDO',4,'Zoning Clearance','pending',NULL,NULL,NULL,'2026-10-03 17:00:03'),
(86,28,3.00,'OBO',1,'Technical plan review','pending',NULL,NULL,NULL,'2026-10-03 17:00:03'),
(87,28,3.30,'OBO',1,'Mechanical systems review','pending',NULL,NULL,NULL,'2026-10-03 17:00:03'),
(88,28,4.00,'CENRO',6,'Environmental clearance','pending',NULL,NULL,NULL,'2026-10-03 17:00:03'),
(89,28,5.00,'ASSESSOR',7,'RPT clearance','pending',NULL,NULL,NULL,'2026-10-03 17:00:03'),
(90,28,6.00,'OBO',1,'Building Permit issued','pending',NULL,NULL,NULL,'2026-10-03 17:00:03'),
(91,29,1.00,'BARANGAY',42,'Barangay Construction Clearance','current',NULL,NULL,NULL,'2026-10-03 18:06:35'),
(92,29,2.00,'CPDO',4,'Zoning Clearance','pending',NULL,NULL,NULL,'2026-10-03 18:06:35'),
(93,29,3.00,'OBO',1,'Technical plan review','pending',NULL,NULL,NULL,'2026-10-03 18:06:35'),
(94,29,3.30,'OBO',1,'Mechanical systems review','pending',NULL,NULL,NULL,'2026-10-03 18:06:35'),
(95,29,3.60,'OBO',1,'Electronics/telecom systems review','pending',NULL,NULL,NULL,'2026-10-03 18:06:35'),
(96,29,4.00,'CENRO',6,'Environmental clearance','pending',NULL,NULL,NULL,'2026-10-03 18:06:35'),
(97,29,5.00,'ASSESSOR',7,'RPT clearance','pending',NULL,NULL,NULL,'2026-10-03 18:06:35'),
(98,29,6.00,'OBO',1,'Building Permit issued','pending',NULL,NULL,NULL,'2026-10-03 18:06:35'),
(150,54,1.00,'BARANGAY',85,'Barangay Construction Clearance','current',NULL,NULL,NULL,'2026-10-08 10:37:26'),
(151,54,1.50,'ENGINEER',9,'HOA/Developer Clearance','pending',NULL,NULL,NULL,'2026-10-08 10:37:26'),
(152,54,2.00,'CPDO',4,'Zoning Clearance','pending',NULL,NULL,NULL,'2026-10-08 10:37:26'),
(153,54,3.00,'OBO',1,'Technical plan review','pending',NULL,NULL,NULL,'2026-10-08 10:37:26'),
(154,54,3.30,'OBO',1,'Mechanical systems review','pending',NULL,NULL,NULL,'2026-10-08 10:37:26'),
(155,54,3.60,'OBO',1,'Electronics/telecom systems review','pending',NULL,NULL,NULL,'2026-10-08 10:37:26'),
(156,54,4.00,'CENRO',6,'Environmental clearance','pending',NULL,NULL,NULL,'2026-10-08 10:37:26'),
(157,54,5.00,'ASSESSOR',7,'RPT clearance','pending',NULL,NULL,NULL,'2026-10-08 10:37:26'),
(158,54,6.00,'OBO',1,'Building Permit issued','pending',NULL,NULL,NULL,'2026-10-08 10:37:26');
/*!40000 ALTER TABLE `application_pipeline_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `applications`
--

DROP TABLE IF EXISTS `applications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `applications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `applicant_id` int(11) NOT NULL,
  `business_id` int(11) DEFAULT NULL,
  `permit_type` enum('Food Service','Building/Renovation','Sign','Business License','Special Event') DEFAULT NULL,
  `permit_type_id` int(11) DEFAULT NULL,
  `property_address` varchar(255) NOT NULL,
  `barangay_id` int(11) DEFAULT NULL,
  `business_name` varchar(190) DEFAULT NULL,
  `project_description` text DEFAULT NULL,
  `status` enum('Submitted','Under Review','Inspection Scheduled','Inspector Notes','Approved','Rejected','Withdrawn') NOT NULL DEFAULT 'Submitted',
  `withdrawn_at` datetime DEFAULT NULL,
  `priority` enum('Standard','High Priority','Overdue') NOT NULL DEFAULT 'Standard',
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
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `applications`
--

LOCK TABLES `applications` WRITE;
/*!40000 ALTER TABLE `applications` DISABLE KEYS */;
INSERT INTO `applications` VALUES
(3,131,NULL,NULL,13,'N/A',2,NULL,NULL,'Submitted',NULL,'Standard',NULL,'2026-09-30 23:53:26','2026-10-03 11:31:54'),
(4,131,NULL,NULL,21,'N/A',2,NULL,NULL,'Submitted',NULL,'Standard',NULL,'2026-09-30 23:53:37','2026-10-03 11:31:54'),
(5,131,NULL,NULL,19,'N/A',2,NULL,'h i!','Submitted',NULL,'Standard',NULL,'2026-10-01 08:08:56','2026-10-03 11:31:54'),
(6,134,NULL,NULL,4,'dsdsdsdsd',2,NULL,NULL,'Withdrawn','2026-10-01 08:43:04','Standard',NULL,'2026-10-01 08:42:40','2026-10-03 11:31:54'),
(7,134,NULL,NULL,4,'dsdsdsdsd',2,NULL,NULL,'Submitted',NULL,'Standard',NULL,'2026-10-01 08:43:20','2026-10-03 11:31:54'),
(8,134,NULL,NULL,5,'wetwetwetgwet',2,NULL,NULL,'Under Review',NULL,'Standard',4,'2026-10-01 08:49:39','2026-10-03 11:31:54'),
(9,131,NULL,NULL,13,'N/A',2,NULL,NULL,'Approved',NULL,'Standard',4,'2026-10-01 09:35:58','2026-10-03 11:31:54'),
(10,134,NULL,NULL,13,'34 Test Street, Brgy. Burol I, Dasmariñas 4114',2,NULL,NULL,'Approved',NULL,'Standard',4,'2026-10-01 10:37:04','2026-10-03 11:31:54'),
(19,137,4,NULL,1,'Sample Street',73,'PenieLuto',NULL,'Submitted',NULL,'Standard',NULL,'2026-10-02 23:14:05','2026-10-10 00:46:21'),
(23,163,NULL,NULL,23,'Sample Street',73,NULL,NULL,'Approved',NULL,'Standard',75,'2026-10-02 23:55:59','2026-10-10 00:46:21'),
(28,163,NULL,NULL,1,'Sample Street',73,NULL,NULL,'Submitted',NULL,'Standard',NULL,'2026-10-03 17:00:03','2026-10-10 00:46:21'),
(29,169,NULL,NULL,1,'Sample Street',30,NULL,'Kailangan ko na kasi mag luto','Submitted',NULL,'Standard',NULL,'2026-10-03 18:06:35','2026-10-10 00:46:21'),
(54,137,4,NULL,1,'Sample Street',73,'PenieLuto',NULL,'Submitted',NULL,'Standard',NULL,'2026-10-08 10:37:26','2026-10-10 00:46:21');
/*!40000 ALTER TABLE `applications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` VALUES
(1,130,'residency.submitted','resident_verification',1,NULL,'2026-10-01 09:29:35'),
(2,161,'residency.submitted','resident_verification',2,NULL,'2026-10-02 19:48:59'),
(3,3,'residency.approved','resident_verification',2,NULL,'2026-10-02 22:22:55'),
(4,137,'business.submitted','business',4,NULL,'2026-10-02 22:31:38'),
(5,3,'business.approved','business',4,NULL,'2026-10-02 22:39:10'),
(6,137,'business.resubmitted','business',4,NULL,'2026-10-02 22:46:25'),
(7,163,'residency.submitted','resident_verification',3,NULL,'2026-10-02 23:53:28'),
(8,75,'residency.approved','resident_verification',3,NULL,'2026-10-02 23:54:45'),
(11,169,'residency.submitted','resident_verification',4,NULL,'2026-10-03 17:45:56'),
(12,169,'business.submitted','business',5,NULL,'2026-10-03 17:48:33'),
(13,75,'residency.approved','resident_verification',4,NULL,'2026-10-03 17:56:47'),
(14,32,'business.approved','business',5,NULL,'2026-10-03 18:01:21');
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `barangays`
--

DROP TABLE IF EXISTS `barangays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `barangays` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_barangay_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=229 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `barangays`
--

LOCK TABLES `barangays` WRITE;
/*!40000 ALTER TABLE `barangays` DISABLE KEYS */;
INSERT INTO `barangays` VALUES
(1,'Burol Main','2026-09-30 23:16:25'),
(2,'Burol I','2026-09-30 23:16:25'),
(3,'Burol II','2026-09-30 23:16:25'),
(4,'Burol III','2026-09-30 23:16:25'),
(5,'Datu Esmael','2026-09-30 23:16:25'),
(6,'Emmanuel Bergado I','2026-09-30 23:16:25'),
(7,'Emmanuel Bergado II','2026-09-30 23:16:25'),
(8,'Fatima I','2026-09-30 23:16:25'),
(9,'Fatima II','2026-09-30 23:16:25'),
(10,'Fatima III','2026-09-30 23:16:25'),
(11,'H-2','2026-09-30 23:16:25'),
(12,'Langkaan I','2026-09-30 23:16:25'),
(13,'Langkaan II','2026-09-30 23:16:25'),
(14,'Luzviminda I','2026-09-30 23:16:25'),
(15,'Luzviminda II','2026-09-30 23:16:25'),
(16,'Paliparan I','2026-09-30 23:16:25'),
(17,'Paliparan II','2026-09-30 23:16:25'),
(18,'Paliparan III','2026-09-30 23:16:25'),
(19,'Sabang','2026-09-30 23:16:25'),
(20,'Saint Peter I','2026-09-30 23:16:25'),
(21,'Saint Peter II','2026-09-30 23:16:25'),
(22,'Salawag','2026-09-30 23:16:25'),
(23,'Salitran I','2026-09-30 23:16:25'),
(24,'Salitran II','2026-09-30 23:16:25'),
(25,'Salitran III','2026-09-30 23:16:25'),
(26,'Salitran IV','2026-09-30 23:16:25'),
(27,'Sampaloc I','2026-09-30 23:16:25'),
(28,'Sampaloc II','2026-09-30 23:16:25'),
(29,'Sampaloc III','2026-09-30 23:16:25'),
(30,'Sampaloc IV','2026-09-30 23:16:25'),
(31,'Sampaloc V','2026-09-30 23:16:25'),
(32,'San Agustin I','2026-09-30 23:16:25'),
(33,'San Agustin II','2026-09-30 23:16:25'),
(34,'San Agustin III','2026-09-30 23:16:25'),
(35,'San Andres I','2026-09-30 23:16:25'),
(36,'San Andres II','2026-09-30 23:16:25'),
(37,'San Antonio de Padua I','2026-09-30 23:16:25'),
(38,'San Antonio de Padua II','2026-09-30 23:16:25'),
(39,'San Dionisio','2026-09-30 23:16:25'),
(40,'San Esteban','2026-09-30 23:16:25'),
(41,'San Francisco I','2026-09-30 23:16:25'),
(42,'San Francisco II','2026-09-30 23:16:25'),
(43,'San Isidro Labrador I','2026-09-30 23:16:25'),
(44,'San Isidro Labrador II','2026-09-30 23:16:25'),
(45,'San Jose','2026-09-30 23:16:25'),
(46,'San Juan','2026-09-30 23:16:25'),
(47,'San Lorenzo Ruiz I','2026-09-30 23:16:25'),
(48,'San Lorenzo Ruiz II','2026-09-30 23:16:25'),
(49,'San Luis I','2026-09-30 23:16:25'),
(50,'San Luis II','2026-09-30 23:16:25'),
(51,'San Manuel I','2026-09-30 23:16:25'),
(52,'San Manuel II','2026-09-30 23:16:25'),
(53,'San Mateo','2026-09-30 23:16:25'),
(54,'San Miguel','2026-09-30 23:16:25'),
(55,'San Miguel II','2026-09-30 23:16:25'),
(56,'San Nicolas I','2026-09-30 23:16:25'),
(57,'San Nicolas II','2026-09-30 23:16:25'),
(58,'San Roque','2026-09-30 23:16:25'),
(59,'San Simon','2026-09-30 23:16:25'),
(60,'Santa Cristina I','2026-09-30 23:16:25'),
(61,'Santa Cristina II','2026-09-30 23:16:25'),
(62,'Santa Cruz I','2026-09-30 23:16:25'),
(63,'Santa Cruz II','2026-09-30 23:16:25'),
(64,'Santa Fe','2026-09-30 23:16:25'),
(65,'Santa Lucia','2026-09-30 23:16:25'),
(66,'Santa Maria','2026-09-30 23:16:25'),
(67,'Santo Cristo','2026-09-30 23:16:25'),
(68,'Santo Niño I','2026-09-30 23:16:25'),
(69,'Santo Niño II','2026-09-30 23:16:25'),
(70,'Victoria Reyes','2026-09-30 23:16:25'),
(71,'Zone I','2026-09-30 23:16:25'),
(72,'Zone I-B','2026-09-30 23:16:25'),
(73,'Zone II','2026-09-30 23:16:25'),
(74,'Zone III','2026-09-30 23:16:25'),
(75,'Zone IV','2026-09-30 23:16:25');
/*!40000 ALTER TABLE `barangays` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `business_documents`
--

DROP TABLE IF EXISTS `business_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `business_documents`
--

LOCK TABLES `business_documents` WRITE;
/*!40000 ALTER TABLE `business_documents` DISABLE KEYS */;
INSERT INTO `business_documents` VALUES
(1,4,'registration',NULL,'business/137/1acfe57d306ef132b33c9b119a2f1426.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp (1) (1).jpg','image/jpeg',1469275,'2026-10-02 22:31:38'),
(2,4,'representative_id','philsys','business/137/7a62fb06bf7cbe57e72173f2ca8813f2.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp (1) (1).jpg','image/jpeg',1469275,'2026-10-02 22:31:38'),
(3,4,'barangay_clearance',NULL,'business/137/93dbbb1f5b558ea81036f595149b3abe.png','Screenshot 2025-08-15 201152 (1) (1).png','image/png',32068,'2026-10-02 22:31:38'),
(4,4,'location_proof',NULL,'business/137/3d49ef8b1d8c2edf5a707445af8ce27b.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp (1).jpg','image/jpeg',1469275,'2026-10-02 22:31:38'),
(5,5,'registration',NULL,'business/169/226c56767b9cc6adc6f51563305539e7.pdf','SIPP Case Study Proposal Free Drinking Fountains at NCST.pdf','application/pdf',232848,'2026-10-03 17:48:33'),
(6,5,'representative_id','drivers_license','business/169/aba93ecc8485638ed751fa988d6e68f5.pdf','Case Study Proposal Data Privacy and Fairness in Digital Scholarship Processing.pdf','application/pdf',217859,'2026-10-03 17:48:33'),
(7,5,'barangay_clearance',NULL,'business/169/b1146dc7105872cfdeef58c184262f8b.png','Screenshot 2025-08-15 201152 (1) (1).png','image/png',32068,'2026-10-03 17:48:33'),
(8,5,'location_proof',NULL,'business/169/06bbf9c2474baa5b2a31b4eb1421ab3c.png','pixil-frame-0.png','image/png',7889,'2026-10-03 17:48:33');
/*!40000 ALTER TABLE `business_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `business_profiles`
--

DROP TABLE IF EXISTS `business_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `business_profiles` (
  `user_id` int(11) NOT NULL,
  `business_name` varchar(190) NOT NULL,
  `ein` varchar(50) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `address` varchar(255) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `business_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `business_profiles`
--

LOCK TABLES `business_profiles` WRITE;
/*!40000 ALTER TABLE `business_profiles` DISABLE KEYS */;
/*!40000 ALTER TABLE `business_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `businesses`
--

DROP TABLE IF EXISTS `businesses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `businesses`
--

LOCK TABLES `businesses` WRITE;
/*!40000 ALTER TABLE `businesses` DISABLE KEYS */;
INSERT INTO `businesses` VALUES
(1,132,'approved','Business Test Sari-Sari Store',NULL,'sole_proprietorship','Retail store / sari-sari store','DTI-TEST-0001','000-111-222-000','12 Test Street','Burol I',2,'Dasmariñas','4114','business.test@permittrack.demo','+639170000001',NULL,NULL,1,NULL,'2026-09-30 23:16:50','2026-09-30 23:16:50',NULL,'2026-09-30 23:16:50',NULL,'2026-09-30 23:16:50','2026-10-01 08:11:23'),
(2,134,'approved','Both Test Trading Co.',NULL,'sole_proprietorship','Retail store / sari-sari store','DTI-TEST-0002','000-111-222-001','34 Test Street','Burol I',2,'Dasmariñas','4114','both.test@permittrack.demo','+639170000002',NULL,NULL,1,NULL,'2026-09-30 23:16:50','2026-09-30 23:16:50',NULL,'2026-09-30 23:16:50',NULL,'2026-09-30 23:16:50','2026-10-01 08:11:23'),
(3,133,'pending','Pending Test Bakery',NULL,'sole_proprietorship','Food & beverage (restaurant, carinderia, cafe)','DTI-TEST-0003','000-111-222-002','56 Test Street','Burol I',2,'Dasmariñas','4114','business.pending.test@permittrack.demo','+639170000003',NULL,NULL,1,NULL,'2026-09-30 23:16:50','2026-09-30 23:16:50',NULL,NULL,NULL,'2026-09-30 23:16:50','2026-10-01 08:11:23'),
(4,137,'approved','Sample Business 4',NULL,'sole_proprietorship','Retail store / sari-sari store','DTI-123456','123456789000','Sample Street','Zone II',73,'Dasmariñas',NULL,NULL,NULL,NULL,NULL,1,NULL,'2026-10-02 22:46:25','2026-10-02 22:31:38',3,'2026-10-02 22:39:10',NULL,'2026-10-02 22:31:38','2026-10-10 00:46:50'),
(5,169,'approved','Sample Business 5',NULL,'sole_proprietorship','Food & beverage (restaurant, carinderia, cafe)','605960459045','123456789000','Sample Street','Sampaloc IV',30,'Dasmariñas',NULL,NULL,NULL,3000.00,15,1,NULL,'2026-10-03 17:48:33','2026-10-03 17:48:33',32,'2026-10-03 18:01:21',NULL,'2026-10-03 17:48:33','2026-10-10 00:46:50');
/*!40000 ALTER TABLE `businesses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_messages`
--

DROP TABLE IF EXISTS `chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_messages`
--

LOCK TABLES `chat_messages` WRITE;
/*!40000 ALTER TABLE `chat_messages` DISABLE KEYS */;
INSERT INTO `chat_messages` VALUES
(1,131,'what documents do I need for a fencing permit',NULL,'permit_requirements',10.00,'2026-09-30 23:22:17'),
(2,NULL,'Ano ang mga barangay clearance?',19,'faq',4.50,'2026-09-30 23:31:51'),
(3,NULL,'bakit mahalaga ang aking barangay',20,'faq',6.50,'2026-09-30 23:36:44'),
(4,NULL,'what are the blocks needed to construct a netehr portal in minecraft',NULL,'off_topic',0.00,'2026-09-30 23:40:36'),
(5,NULL,'what are the needed papers for the national id',NULL,'off_topic',0.00,'2026-09-30 23:40:54'),
(6,NULL,'how about in barranggay id',NULL,'off_topic',0.00,'2026-09-30 23:41:12'),
(7,NULL,'uhm',NULL,'off_topic',0.00,'2026-09-30 23:41:17'),
(8,NULL,'hi ?',NULL,'greeting',0.00,'2026-09-30 23:41:20'),
(9,NULL,'what are the papers needed for building permit ?',NULL,'permit_requirements',10.00,'2026-09-30 23:41:46'),
(10,NULL,'uhm',NULL,'off_topic',0.00,'2026-09-30 23:43:10'),
(11,NULL,'English',NULL,'off_topic',0.00,'2026-09-30 23:47:19'),
(12,NULL,'what is the weather today',NULL,'off_topic',0.00,'2026-09-30 23:47:19'),
(13,NULL,'tell me a joke',NULL,'off_topic',0.00,'2026-09-30 23:47:19'),
(14,NULL,'who is the president',NULL,'off_topic',0.00,'2026-09-30 23:47:19'),
(15,NULL,'do you like pizza',NULL,'off_topic',0.00,'2026-09-30 23:47:19'),
(16,NULL,'What can I do as a Normal User?',1,'faq',10.00,'2026-09-30 23:47:31'),
(17,NULL,'hi !',NULL,'greeting',0.00,'2026-09-30 23:47:34'),
(18,NULL,'d',NULL,'off_topic',0.00,'2026-09-30 23:47:41'),
(19,NULL,'am i logged in ?',NULL,'off_topic',0.00,'2026-09-30 23:48:05'),
(20,NULL,'what is the weather today',NULL,'off_topic',0.00,'2026-09-30 23:48:23'),
(21,NULL,'hello',NULL,'greeting',10.00,'2026-09-30 23:48:23'),
(22,NULL,'Ano ang mga barangay clearance?',19,'faq',4.50,'2026-10-01 00:41:55'),
(23,NULL,'hello !',NULL,'greeting',10.00,'2026-10-01 00:41:59'),
(24,NULL,'ano ang mga barangay clearance',19,'faq',4.50,'2026-10-01 00:45:54'),
(25,NULL,'hi !',NULL,'greeting',10.00,'2026-10-01 00:50:01'),
(26,NULL,'Anong mga permit ang maaari kong i-apply?',NULL,'fallback',1.50,'2026-10-01 01:02:52'),
(27,NULL,'What can I do as a Normal User?',1,'faq',100.00,'2026-10-01 01:10:31'),
(28,NULL,'hi!',NULL,'greeting',10.00,'2026-10-01 01:13:08'),
(29,NULL,'Which permits can I apply for?',8,'faq',100.00,'2026-10-01 01:13:12'),
(30,NULL,'How do I become a verified Resident?',2,'faq',100.00,'2026-10-01 01:13:14'),
(31,NULL,'What documents count as proof of residence?',3,'faq',100.00,'2026-10-01 01:13:16'),
(32,NULL,'What documents do I need to register a business?',7,'faq',100.00,'2026-10-01 01:13:17'),
(33,NULL,'What are barangay clearances?',19,'faq',100.00,'2026-10-01 01:13:18'),
(34,NULL,'Ano ang mga barangay clearance?',19,'faq',100.00,'2026-10-01 01:13:30'),
(35,NULL,'uhm',NULL,'off_topic',0.00,'2026-10-01 01:13:56'),
(36,NULL,'what are the blocks needed to make a nether portal in minecraft',NULL,'off_topic',0.50,'2026-10-01 01:14:15'),
(37,NULL,'sino ang pinakamagaling na basketball player',NULL,'off_topic',0.00,'2026-10-01 01:14:42'),
(38,NULL,'hi !',NULL,'greeting',10.00,'2026-10-01 01:15:56'),
(39,NULL,'what permits can I apply for',8,'faq',8.50,'2026-10-01 01:25:39'),
(40,NULL,'sino ang pinakamagaling na basketball player',NULL,'off_topic',0.00,'2026-10-01 01:25:39'),
(41,NULL,'What can I do as a Normal User?',1,'faq',100.00,'2026-10-01 01:25:39'),
(42,NULL,'paano mag apply ng business permit',6,'faq',2.50,'2026-10-01 01:25:40'),
(43,NULL,'hi',NULL,'greeting',10.00,'2026-10-01 01:25:40'),
(44,NULL,'How does the permit review process work?',17,'faq',100.00,'2026-10-01 01:25:40'),
(45,NULL,'Which permits can I apply for?',8,'faq',100.00,'2026-10-01 01:25:42'),
(46,NULL,'What can I do as a Normal User?',1,'faq',100.00,'2026-10-01 01:25:45'),
(47,NULL,'how do I track my application',9,'faq',100.00,'2026-10-01 01:27:46'),
(48,NULL,'what documents do I need for a fencing permit',NULL,'permit_requirements',10.00,'2026-10-01 01:27:54'),
(49,NULL,'what is the best pizza in town',NULL,'off_topic',0.00,'2026-10-01 01:27:58'),
(50,NULL,'1+1 nga',NULL,'off_topic',0.00,'2026-10-01 01:37:35'),
(51,145,'What can I do as a Normal User?',1,'faq',100.00,'2026-10-01 02:39:58'),
(52,134,'hi 1',NULL,'greeting',10.00,'2026-10-01 08:55:00'),
(53,134,'GAGU',NULL,'off_topic',0.00,'2026-10-01 08:55:03'),
(54,134,'hello',NULL,'greeting',10.00,'2026-10-01 08:55:13'),
(55,NULL,'What can I do as a Normal User?',1,'faq',100.00,'2026-10-01 10:32:12'),
(56,NULL,'why am i alone?',NULL,'off_topic',0.50,'2026-10-01 10:32:54'),
(57,NULL,'can you open an account',NULL,'fallback',0.50,'2026-10-01 10:33:19'),
(58,NULL,'How do I register a business?',6,'faq',100.00,'2026-10-01 10:33:37'),
(59,NULL,'What can I do as a Normal User?',1,'faq',100.00,'2026-10-02 19:43:16'),
(60,137,'Anong mga permit ang maaari kong i-apply?',8,'faq',100.00,'2026-10-02 22:26:12'),
(61,163,'Which permits can I apply for?',8,'faq',100.00,'2026-10-04 09:37:59'),
(62,163,'What can I do as a Normal User?',1,'faq',100.00,'2026-10-04 09:38:00');
/*!40000 ALTER TABLE `chat_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `code` varchar(20) NOT NULL,
  `barangay_id` int(11) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `permit_types` varchar(255) NOT NULL DEFAULT '',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_department_code` (`code`),
  KEY `fk_department_barangay` (`barangay_id`),
  CONSTRAINT `fk_department_barangay` FOREIGN KEY (`barangay_id`) REFERENCES `barangays` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=142 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES
(1,'Office of the Building Official','OBO',NULL,'Building, renovation and signage permits','__unassigned__',1,'2026-09-30 23:16:24'),
(2,'Business Permits and Licensing Office','BPLO',NULL,'Business licenses and special events','__unassigned__',1,'2026-09-30 23:16:24'),
(3,'City Health Office','CHO',NULL,'Food service and sanitary permits','__unassigned__',1,'2026-09-30 23:16:24'),
(4,'City Planning and Development Office','CPDO',NULL,'Zoning / Locational Clearance','__unassigned__',1,'2026-09-30 23:16:25'),
(5,'Bureau of Fire Protection — Dasmariñas Station','BFP',NULL,'Fire Safety Inspection Certificate','__unassigned__',1,'2026-09-30 23:16:25'),
(6,'City Environment and Natural Resources Office','CENRO',NULL,'Environmental and waste clearances','__unassigned__',1,'2026-09-30 23:16:25'),
(7,'City Assessor\'s Office','ASSESSOR',NULL,'Tax declaration, RPT-related clearances','__unassigned__',1,'2026-09-30 23:16:25'),
(8,'City Treasurer\'s Office','TREASURER',NULL,'Fee assessment, RPT clearance, permit issuance','__unassigned__',1,'2026-09-30 23:16:25'),
(9,'City Engineer — Public Works','ENGINEER',NULL,'Excavation / road-cut / right-of-way review','__unassigned__',1,'2026-09-30 23:16:25'),
(10,'Philippine National Police — Dasmariñas','PNP',NULL,'Police clearance, event safety coordination','__unassigned__',1,'2026-09-30 23:16:25'),
(11,'City Traffic Management Office / TODA Section','TRAFFIC',NULL,'Tricycle operator franchise (MTOP)','__unassigned__',1,'2026-09-30 23:16:25'),
(12,'Food and Drug Administration (national, co-routed)','FDA',NULL,'LTO/CPR for food manufacturing — no PermitTrack staff account; external agency','__unassigned__',1,'2026-09-30 23:16:25'),
(13,'Barangay Burol Main Secretariat','BRGY-1',1,'Barangay-level clearances for Burol','__unassigned__',1,'2026-09-30 23:16:25'),
(14,'Barangay Burol I Secretariat','BRGY-2',2,'Barangay-level clearances for Burol I','__unassigned__',1,'2026-09-30 23:16:25'),
(15,'Barangay Burol II Secretariat','BRGY-3',3,'Barangay-level clearances for Burol II','__unassigned__',1,'2026-09-30 23:16:25'),
(16,'Barangay Burol III Secretariat','BRGY-4',4,'Barangay-level clearances for Burol III','__unassigned__',1,'2026-09-30 23:16:25'),
(17,'Barangay Datu Esmael Secretariat','BRGY-5',5,'Barangay-level clearances for Datu Esmael','__unassigned__',1,'2026-09-30 23:16:25'),
(18,'Barangay Emmanuel Bergado I Secretariat','BRGY-6',6,'Barangay-level clearances for Emmanuel Bergado I','__unassigned__',1,'2026-09-30 23:16:25'),
(19,'Barangay Emmanuel Bergado II Secretariat','BRGY-7',7,'Barangay-level clearances for Emmanuel Bergado II','__unassigned__',1,'2026-09-30 23:16:25'),
(20,'Barangay Fatima I Secretariat','BRGY-8',8,'Barangay-level clearances for Fatima I','__unassigned__',1,'2026-09-30 23:16:25'),
(21,'Barangay Fatima II Secretariat','BRGY-9',9,'Barangay-level clearances for Fatima II','__unassigned__',1,'2026-09-30 23:16:25'),
(22,'Barangay Fatima III Secretariat','BRGY-10',10,'Barangay-level clearances for Fatima III','__unassigned__',1,'2026-09-30 23:16:25'),
(23,'Barangay H-2 Secretariat','BRGY-11',11,'Barangay-level clearances for H-2','__unassigned__',1,'2026-09-30 23:16:25'),
(24,'Barangay Langkaan I Secretariat','BRGY-12',12,'Barangay-level clearances for Langkaan I','__unassigned__',1,'2026-09-30 23:16:25'),
(25,'Barangay Langkaan II Secretariat','BRGY-13',13,'Barangay-level clearances for Langkaan II','__unassigned__',1,'2026-09-30 23:16:25'),
(26,'Barangay Luzviminda I Secretariat','BRGY-14',14,'Barangay-level clearances for Luzviminda I','__unassigned__',1,'2026-09-30 23:16:25'),
(27,'Barangay Luzviminda II Secretariat','BRGY-15',15,'Barangay-level clearances for Luzviminda II','__unassigned__',1,'2026-09-30 23:16:25'),
(28,'Barangay Paliparan I Secretariat','BRGY-16',16,'Barangay-level clearances for Paliparan I','__unassigned__',1,'2026-09-30 23:16:25'),
(29,'Barangay Paliparan II Secretariat','BRGY-17',17,'Barangay-level clearances for Paliparan II','__unassigned__',1,'2026-09-30 23:16:25'),
(30,'Barangay Paliparan III Secretariat','BRGY-18',18,'Barangay-level clearances for Paliparan III','__unassigned__',1,'2026-09-30 23:16:25'),
(31,'Barangay Sabang Secretariat','BRGY-19',19,'Barangay-level clearances for Sabang','__unassigned__',1,'2026-09-30 23:16:25'),
(32,'Barangay Saint Peter I Secretariat','BRGY-20',20,'Barangay-level clearances for Saint Peter I','__unassigned__',1,'2026-09-30 23:16:25'),
(33,'Barangay Saint Peter II Secretariat','BRGY-21',21,'Barangay-level clearances for Saint Peter II','__unassigned__',1,'2026-09-30 23:16:25'),
(34,'Barangay Salawag Secretariat','BRGY-22',22,'Barangay-level clearances for Salawag','__unassigned__',1,'2026-09-30 23:16:25'),
(35,'Barangay Salitran I Secretariat','BRGY-23',23,'Barangay-level clearances for Salitran I','__unassigned__',1,'2026-09-30 23:16:25'),
(36,'Barangay Salitran II Secretariat','BRGY-24',24,'Barangay-level clearances for Salitran II','__unassigned__',1,'2026-09-30 23:16:25'),
(37,'Barangay Salitran III Secretariat','BRGY-25',25,'Barangay-level clearances for Salitran III','__unassigned__',1,'2026-09-30 23:16:25'),
(38,'Barangay Salitran IV Secretariat','BRGY-26',26,'Barangay-level clearances for Salitran IV','__unassigned__',1,'2026-09-30 23:16:25'),
(39,'Barangay Sampaloc I Secretariat','BRGY-27',27,'Barangay-level clearances for Sampaloc I','__unassigned__',1,'2026-09-30 23:16:25'),
(40,'Barangay Sampaloc II Secretariat','BRGY-28',28,'Barangay-level clearances for Sampaloc II','__unassigned__',1,'2026-09-30 23:16:25'),
(41,'Barangay Sampaloc III Secretariat','BRGY-29',29,'Barangay-level clearances for Sampaloc III','__unassigned__',1,'2026-09-30 23:16:25'),
(42,'Barangay Sampaloc IV Secretariat','BRGY-30',30,'Barangay-level clearances for Sampaloc IV','__unassigned__',1,'2026-09-30 23:16:25'),
(43,'Barangay Sampaloc V Secretariat','BRGY-31',31,'Barangay-level clearances for Sampaloc V','__unassigned__',1,'2026-09-30 23:16:25'),
(44,'Barangay San Agustin I Secretariat','BRGY-32',32,'Barangay-level clearances for San Agustin I','__unassigned__',1,'2026-09-30 23:16:25'),
(45,'Barangay San Agustin II Secretariat','BRGY-33',33,'Barangay-level clearances for San Agustin II','__unassigned__',1,'2026-09-30 23:16:25'),
(46,'Barangay San Agustin III Secretariat','BRGY-34',34,'Barangay-level clearances for San Agustin III','__unassigned__',1,'2026-09-30 23:16:25'),
(47,'Barangay San Andres I Secretariat','BRGY-35',35,'Barangay-level clearances for San Andres I','__unassigned__',1,'2026-09-30 23:16:25'),
(48,'Barangay San Andres II Secretariat','BRGY-36',36,'Barangay-level clearances for San Andres II','__unassigned__',1,'2026-09-30 23:16:25'),
(49,'Barangay San Antonio de Padua I Secretariat','BRGY-37',37,'Barangay-level clearances for San Antonio de Padua I','__unassigned__',1,'2026-09-30 23:16:25'),
(50,'Barangay San Antonio de Padua II Secretariat','BRGY-38',38,'Barangay-level clearances for San Antonio de Padua II','__unassigned__',1,'2026-09-30 23:16:25'),
(51,'Barangay San Dionisio Secretariat','BRGY-39',39,'Barangay-level clearances for San Dionisio','__unassigned__',1,'2026-09-30 23:16:25'),
(52,'Barangay San Esteban Secretariat','BRGY-40',40,'Barangay-level clearances for San Esteban','__unassigned__',1,'2026-09-30 23:16:25'),
(53,'Barangay San Francisco I Secretariat','BRGY-41',41,'Barangay-level clearances for San Francisco I','__unassigned__',1,'2026-09-30 23:16:25'),
(54,'Barangay San Francisco II Secretariat','BRGY-42',42,'Barangay-level clearances for San Francisco II','__unassigned__',1,'2026-09-30 23:16:25'),
(55,'Barangay San Isidro Labrador I Secretariat','BRGY-43',43,'Barangay-level clearances for San Isidro Labrador I','__unassigned__',1,'2026-09-30 23:16:25'),
(56,'Barangay San Isidro Labrador II Secretariat','BRGY-44',44,'Barangay-level clearances for San Isidro Labrador II','__unassigned__',1,'2026-09-30 23:16:25'),
(57,'Barangay San Jose Secretariat','BRGY-45',45,'Barangay-level clearances for San Jose','__unassigned__',1,'2026-09-30 23:16:25'),
(58,'Barangay San Juan Secretariat','BRGY-46',46,'Barangay-level clearances for San Juan','__unassigned__',1,'2026-09-30 23:16:25'),
(59,'Barangay San Lorenzo Ruiz I Secretariat','BRGY-47',47,'Barangay-level clearances for San Lorenzo Ruiz I','__unassigned__',1,'2026-09-30 23:16:25'),
(60,'Barangay San Lorenzo Ruiz II Secretariat','BRGY-48',48,'Barangay-level clearances for San Lorenzo Ruiz II','__unassigned__',1,'2026-09-30 23:16:25'),
(61,'Barangay San Luis I Secretariat','BRGY-49',49,'Barangay-level clearances for San Luis I','__unassigned__',1,'2026-09-30 23:16:25'),
(62,'Barangay San Luis II Secretariat','BRGY-50',50,'Barangay-level clearances for San Luis II','__unassigned__',1,'2026-09-30 23:16:25'),
(63,'Barangay San Manuel I Secretariat','BRGY-51',51,'Barangay-level clearances for San Manuel I','__unassigned__',1,'2026-09-30 23:16:25'),
(64,'Barangay San Manuel II Secretariat','BRGY-52',52,'Barangay-level clearances for San Manuel II','__unassigned__',1,'2026-09-30 23:16:25'),
(65,'Barangay San Mateo Secretariat','BRGY-53',53,'Barangay-level clearances for San Mateo','__unassigned__',1,'2026-09-30 23:16:25'),
(66,'Barangay San Miguel Secretariat','BRGY-54',54,'Barangay-level clearances for San Miguel','__unassigned__',1,'2026-09-30 23:16:25'),
(67,'Barangay San Miguel II Secretariat','BRGY-55',55,'Barangay-level clearances for San Miguel II','__unassigned__',1,'2026-09-30 23:16:25'),
(68,'Barangay San Nicolas I Secretariat','BRGY-56',56,'Barangay-level clearances for San Nicolas I','__unassigned__',1,'2026-09-30 23:16:25'),
(69,'Barangay San Nicolas II Secretariat','BRGY-57',57,'Barangay-level clearances for San Nicolas II','__unassigned__',1,'2026-09-30 23:16:25'),
(70,'Barangay San Roque Secretariat','BRGY-58',58,'Barangay-level clearances for San Roque','__unassigned__',1,'2026-09-30 23:16:25'),
(71,'Barangay San Simon Secretariat','BRGY-59',59,'Barangay-level clearances for San Simon','__unassigned__',1,'2026-09-30 23:16:25'),
(72,'Barangay Santa Cristina I Secretariat','BRGY-60',60,'Barangay-level clearances for Santa Cristina I','__unassigned__',1,'2026-09-30 23:16:25'),
(73,'Barangay Santa Cristina II Secretariat','BRGY-61',61,'Barangay-level clearances for Santa Cristina II','__unassigned__',1,'2026-09-30 23:16:25'),
(74,'Barangay Santa Cruz I Secretariat','BRGY-62',62,'Barangay-level clearances for Santa Cruz I','__unassigned__',1,'2026-09-30 23:16:25'),
(75,'Barangay Santa Cruz II Secretariat','BRGY-63',63,'Barangay-level clearances for Santa Cruz II','__unassigned__',1,'2026-09-30 23:16:25'),
(76,'Barangay Santa Fe Secretariat','BRGY-64',64,'Barangay-level clearances for Santa Fe','__unassigned__',1,'2026-09-30 23:16:25'),
(77,'Barangay Santa Lucia Secretariat','BRGY-65',65,'Barangay-level clearances for Santa Lucia','__unassigned__',1,'2026-09-30 23:16:25'),
(78,'Barangay Santa Maria Secretariat','BRGY-66',66,'Barangay-level clearances for Santa Maria','__unassigned__',1,'2026-09-30 23:16:25'),
(79,'Barangay Santo Cristo Secretariat','BRGY-67',67,'Barangay-level clearances for Santo Cristo','__unassigned__',1,'2026-09-30 23:16:25'),
(80,'Barangay Santo Niño I Secretariat','BRGY-68',68,'Barangay-level clearances for Santo Niño I','__unassigned__',1,'2026-09-30 23:16:25'),
(81,'Barangay Santo Niño II Secretariat','BRGY-69',69,'Barangay-level clearances for Santo Niño II','__unassigned__',1,'2026-09-30 23:16:25'),
(82,'Barangay Victoria Reyes Secretariat','BRGY-70',70,'Barangay-level clearances for Victoria Reyes','__unassigned__',1,'2026-09-30 23:16:25'),
(83,'Barangay Zone I Secretariat','BRGY-71',71,'Barangay-level clearances for Zone I','__unassigned__',1,'2026-09-30 23:16:25'),
(84,'Barangay Zone I-B Secretariat','BRGY-72',72,'Barangay-level clearances for Zone I-B','__unassigned__',1,'2026-09-30 23:16:25'),
(85,'Barangay Zone II Secretariat','BRGY-73',73,'Barangay-level clearances for Zone II','__unassigned__',1,'2026-09-30 23:16:25'),
(86,'Barangay Zone III Secretariat','BRGY-74',74,'Barangay-level clearances for Zone III','__unassigned__',1,'2026-09-30 23:16:25'),
(87,'Barangay Zone IV Secretariat','BRGY-75',75,'Barangay-level clearances for Zone IV','__unassigned__',1,'2026-09-30 23:16:25'),
(141,'Land Transportation Office — Dasmariñas District','LTO',NULL,'Driver licensing and motor vehicle registration (national, co-routed)','__unassigned__',1,'2026-10-02 23:38:02');
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `faq_entries`
--

DROP TABLE IF EXISTS `faq_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=80 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `faq_entries`
--

LOCK TABLES `faq_entries` WRITE;
/*!40000 ALTER TABLE `faq_entries` DISABLE KEYS */;
INSERT INTO `faq_entries` VALUES
(1,'Account','What can I do as a Normal User?','Ano ang magagawa ko bilang Normal User?','As a Normal User you can browse every permit type and see the documents each one requires.\nTo apply for a permit, verify your account:\n- as a Resident, for permits open to individuals (Building Permit, Fencing, Demolition, Excavation/Road-Cut, Special Event, and every barangay-only document), or\n- as a Business Owner, for business permits (Business License, Food Service, Sign, Liquor/Tobacco, MTOP/TODA, Market Stall/Vending).\nYou can be both.','Bilang isang Normal User, maaari mong tingnan ang lahat ng uri ng permit at makita ang mga dokumentong kailangan ng bawat isa.\nUpang makapag-apply ng permit, i-verify muna ang iyong account:\n- bilang Resident, para sa mga permit na maaaring i-file ng indibidwal (Building Permit, Fencing, Demolition, Excavation/Road-Cut, Special Event, at lahat ng barangay-only na dokumento), o\n- bilang Business Owner, para sa mga business permit (Business License, Food Service, Sign, Liquor/Tobacco, MTOP/TODA, Market Stall/Vending).\nPwede kang maging pareho.','normal user,what can i do,browse,cannot apply,can\'t apply,cant apply,why can\'t i apply,apply button,locked,level,account level,label','/dashboard','Go to my dashboard',10,1,'2026-09-30 23:16:24','2026-09-30 23:26:00'),
(2,'Resident','How do I become a verified Resident?','Paano ako maging verified Resident?','Open \"Become a Resident\" on your dashboard, then:\n- verify both your email and mobile number,\n- confirm your address,\n- upload two proofs of residence of different types,\n- tick the declaration and submit.\nCity Staff checks your documents and you\'ll be notified by email or SMS.','Buksan ang \"Become a Resident\" sa iyong dashboard, pagkatapos:\n- i-verify ang iyong email at mobile number,\n- kumpirmahin ang iyong address,\n- mag-upload ng dalawang magkaibang uri ng proof of residence,\n- lagyan ng check ang deklarasyon at i-submit.\nSusuriin ito ng City Staff at maaabisuhan ka sa pamamagitan ng email o SMS.','resident,residency,become resident,verify resident,verified resident,proof of residence,residente,paano maging residente,how to apply resident','/residency','Start resident verification',20,1,'2026-09-30 23:16:24','2026-09-30 23:26:00'),
(3,'Resident','What documents count as proof of residence?','Anong mga dokumento ang tinatanggap bilang proof of residence?','Upload two different documents that show your name and address:\n- Barangay Certificate of Residency (issued within 180 days)\n- Utility bill — electricity, water or internet (within 90 days)\n- Bank or credit card statement (within 90 days)\n- Lease or rental contract\n- Land title or tax declaration\n- Voter\'s ID or Voter\'s Certification\n- Driver\'s license, National ID (PhilSys) or Postal ID with your address\nFiles can be PDF, JPG, PNG or WEBP, up to 5 MB each.','Mag-upload ng dalawang magkaibang dokumentong nagpapakita ng iyong pangalan at address:\n- Barangay Certificate of Residency (ibinigay sa loob ng 180 araw)\n- Utility bill — kuryente, tubig, o internet (sa loob ng 90 araw)\n- Bank o credit card statement (sa loob ng 90 araw)\n- Lease o rental contract\n- Land title o tax declaration\n- Voter\'s ID o Voter\'s Certification\n- Driver\'s license, National ID (PhilSys), o Postal ID na may address mo\nPwedeng PDF, JPG, PNG, o WEBP ang file, hanggang 5 MB bawat isa.','proof,proofs,proof of residence,accepted documents,what documents resident,utility bill,barangay certificate,billing,bill,lease,voter,cedula,patunay,katibayan','/residency','Upload my proofs',30,1,'2026-09-30 23:16:24','2026-10-01 00:44:10'),
(4,'Verification','How long does verification take?','Gaano katagal ang verification?','City Staff usually reviews resident and business verifications within a few working days. You\'ll get an email or SMS as soon as a decision is made, and your dashboard shows the current status.','Karaniwang sinusuri ng City Staff ang resident at business verification sa loob ng ilang araw ng trabaho. Makakatanggap ka ng email o SMS kapag may desisyon na, at makikita rin sa iyong dashboard ang kasalukuyang status.','how long,how many days,waiting,pending,still pending,under review,review time,gaano katagal,matagal,when will,approved yet',NULL,NULL,40,1,'2026-09-30 23:16:24','2026-09-30 23:26:00'),
(5,'Verification','My verification was rejected. What now?','Na-reject ang aking verification. Ano ang gagawin ko?','Open the item on your dashboard — the reason from City Staff is shown at the top. Fix the issue (for example, upload a newer bill or a document in your name) and submit again. For businesses you only need to re-upload the documents that changed.','Buksan ang item sa iyong dashboard — makikita sa itaas ang dahilan mula sa City Staff. Ayusin ang isyu (halimbawa, mag-upload ng mas bagong bill o dokumentong nasa pangalan mo) at i-submit muli. Para sa business, kailangan mo lang i-upload ulit ang mga dokumentong binago.','rejected,denied,not approved,declined,failed,resubmit,try again,why rejected,na-reject,hindi naaprubahan','/dashboard','Go to my dashboard',50,1,'2026-09-30 23:16:24','2026-10-01 00:44:10'),
(6,'Business','How do I add my business to PermitTrack?','Paano ko maidadagdag ang negosyo ko sa PermitTrack?','PermitTrack does not create businesses. Forming one happens at the DTI (sole proprietorship), SEC (partnership or corporation) or CDA (cooperative). What you do here is put a business you already run on record, so the city can check it is real and you can file its permits.\nChoose \"Add your business\" on your dashboard and fill in:\n- business details (registered name, ownership type, line of business, DTI/SEC/CDA number, TIN),\n- the business location — the barangay it operates in, chosen from the list,\n- your role and government ID,\n- the required documents.\nOnce City Staff verify it against your registration certificate, you can apply for and renew business permits for it. You can add more than one business.','Hindi gumagawa ng negosyo ang PermitTrack. Ang pagbuo nito ay sa DTI (sole proprietorship), SEC (partnership o corporation), o CDA (cooperative). Ang ginagawa mo rito ay itala ang negosyong pinapatakbo mo na, para makumpirma ng lungsod na totoo ito at makapag-file ka ng mga permit nito.\nPiliin ang \"Add your business\" sa iyong dashboard at punan ang:\n- detalye ng negosyo (rehistradong pangalan, ownership type, linya ng negosyo, DTI/SEC/CDA number, TIN),\n- lokasyon ng negosyo — ang barangay kung saan ito nag-ooperate, piliin mula sa listahan,\n- iyong role at government ID,\n- kinakailangang dokumento.\nKapag na-verify na ng City Staff laban sa iyong registration certificate, maaari ka nang mag-apply at mag-renew ng business permits para rito. Maaari kang magdagdag ng higit sa isang negosyo.','register business,business,negosyo,add business,new business,business owner,company,store,shop,how to register business,business account','/businesses/new','Register a business',60,1,'2026-09-30 23:16:24','2026-10-04 09:51:45'),
(7,'Business','What documents do I need to register a business?','Anong mga dokumento ang kailangan ko para maitala ang negosyo ko?','These prove the business already exists and that you are the one who runs it:\n- its registration certificate — DTI (sole proprietorship), SEC (partnership or corporation) or CDA (cooperative)\n- your primary government ID (the name must match the registration)\n- a Barangay Business Clearance\n- proof of the business location (lease contract, land title or tax declaration)\nPartnerships, corporations and cooperatives also need a Secretary\'s Certificate or Board Resolution naming you. If you\'re not the owner of a sole proprietorship, add an SPA or authorization letter.\nPermitTrack only records these — it does not issue any of them.','Ito ang patunay na umiiral na ang negosyo at ikaw ang nagpapatakbo nito:\n- rehistrasyon certificate — DTI (sole proprietorship), SEC (partnership o corporation), o CDA (cooperative)\n- pangunahing government ID mo (dapat magkatugma ang pangalan sa rehistrasyon)\n- Barangay Business Clearance\n- patunay ng lokasyon ng negosyo (lease contract, land title, o tax declaration)\nAng partnership, corporation, at cooperative ay kailangan din ng Secretary\'s Certificate o Board Resolution na nagpapangalan sa iyo. Kung ikaw ay hindi ang may-ari ng sole proprietorship, magdagdag ng SPA o authorization letter.\nItinatala lang ng PermitTrack ang mga ito — hindi ito ang nag-iisyu ng alinman sa kanila.','business documents,business requirements,dti,sec,cda,tin,secretary\'s certificate,board resolution,spa,requirements business,dokumento ng negosyo','/businesses/new','Register a business',70,1,'2026-09-30 23:16:24','2026-10-04 09:51:45'),
(8,'Permits','Which permits can I apply for?','Anong mga permit ang maaari kong i-apply?','It depends on your account:\n- Verified Residents can file Building Permit, Fencing, Demolition, Excavation/Road-Cut and Special Event permits as individuals, plus every barangay-only document (personal clearances, certificates, and standalone barangay clearances).\n- Business Owners can file Business License, Food Service, Sign, Liquor/Tobacco License, MTOP/TODA and Market Stall/Vending permits for a verified business, plus Building Permit and Special Event.\nNormal Users can browse all of these but need to verify first.','Depende ito sa iyong account:\n- Ang verified Residents ay maaaring mag-file ng Building Permit, Fencing, Demolition, Excavation/Road-Cut, at Special Event permits bilang indibidwal, pati na rin ang lahat ng barangay-only na dokumento (personal clearances, certificates, at standalone barangay clearances).\n- Ang Business Owners ay maaaring mag-file ng Business License, Food Service, Sign, Liquor/Tobacco License, MTOP/TODA, at Market Stall/Vending permits para sa verified na negosyo, pati na rin ang Building Permit at Special Event.\nMaaaring tingnan ng Normal Users ang lahat ng ito ngunit kailangan munang mag-verify.','which permits,what permits,permit types,kinds of permits,list of permits,available permits,can i apply,eligible,eligibility,anong permit,occupancy,fencing,demolition,excavation,liquor,tricycle,toda,market stall,barangay clearance','/applications/new','See permits',80,1,'2026-09-30 23:16:24','2026-09-30 23:26:01'),
(9,'Permits','How do I track my application?','Paano ko masusubaybayan ang aking aplikasyon?','Open the application from your dashboard. Recent applications show a step-by-step view of which city office currently has it — starting with your Barangay, then whichever city departments that permit type needs, in order. Older applications show the original 5-step tracker (Submitted → Under Review → Inspection Scheduled → Inspector Notes → Approved) instead.','Buksan ang aplikasyon mula sa iyong dashboard. Ang mas bagong aplikasyon ay nagpapakita ng step-by-step na view kung saang opisina kasalukuyang nakatalaga ito — mula sa iyong Barangay, tapos sa mga opisina ng lungsod na kailangan ng permit na iyon, ayon sa pagkakasunod-sunod. Ang mas lumang aplikasyon ay nagpapakita pa rin ng orihinal na 5-step tracker (Submitted → Under Review → Inspection Scheduled → Inspector Notes → Approved).','track,tracking,status,application status,where is my application,progress,update on my permit,follow up,nasaan,estado','/dashboard','Go to my dashboard',90,1,'2026-09-30 23:16:24','2026-10-01 00:44:10'),
(10,'Permits','What do the application statuses mean?','Ano ang ibig sabihin ng mga status ng aplikasyon?','For newer applications, the detail page lists every office in order (starting with your Barangay) and shows which one currently has your application. For older applications, the 5-step tracker still applies:\n- Submitted: received, waiting for a reviewer\n- Under Review: a reviewer is checking your documents\n- Inspection Scheduled: an on-site inspection is planned\n- Inspector Notes: the inspector left notes — check the activity log\n- Approved: your permit is issued\nIf a document is marked \"Needs Re-upload\", upload a new copy from the application page.','Para sa mas bagong aplikasyon, ang detail page ay naglilista ng bawat opisina ayon sa pagkakasunod-sunod (simula sa iyong Barangay) at ipinapakita kung sino ang may hawak ngayon ng iyong aplikasyon. Para sa mas lumang aplikasyon, ganito pa rin ang 5-step tracker:\n- Submitted: natanggap na, naghihintay ng reviewer\n- Under Review: sinusuri ng reviewer ang iyong mga dokumento\n- Inspection Scheduled: may naka-iskedyul na on-site inspection\n- Inspector Notes: may naiwang notes ang inspector — tingnan ang activity log\n- Approved: naibigay na ang iyong permit\nKung may dokumentong naka-mark na \"Needs Re-upload\", mag-upload ng bago mula sa application page.','statuses,status meaning,what does submitted mean,under review mean,inspection scheduled,inspector notes,needs re-upload,reupload,re-upload',NULL,NULL,100,1,'2026-09-30 23:16:24','2026-10-01 00:44:10'),
(11,'Account','I didn\'t receive my verification code','Hindi ko natanggap ang aking verification code','Codes are sent to the email or mobile number you entered and expire after 10 minutes.\n- Check your spam or promotions folder.\n- Make sure the number or email is correct.\n- Wait a minute, then tap \"Resend code\".\nYou can request up to 8 codes per hour.','Ipinapadala ang code sa email o mobile number na inilagay mo at mag-e-expire ito pagkalipas ng 10 minuto.\n- Tingnan ang iyong spam o promotions folder.\n- Siguraduhing tama ang number o email.\n- Maghintay ng isang minuto, pagkatapos i-tap ang \"Resend code\".\nMaaari kang humiling ng hanggang 8 code kada oras.','code,otp,verification code,didn\'t receive,did not receive,no code,no sms,no email,resend,one time,walang code,hindi dumating',NULL,NULL,110,1,'2026-09-30 23:16:24','2026-09-30 23:26:01'),
(12,'Account','How do I change my password?','Paano ko babaguhin ang aking password?','Use the \"Password\" link at the top of any page after you sign in. If you forgot your password, contact the city office — an Admin can give you a temporary password that you\'ll change when you next sign in.','Gamitin ang \"Password\" na link sa itaas ng anumang page pagkatapos mong mag-sign in. Kung nakalimutan mo ang iyong password, makipag-ugnayan sa city office — maaaring magbigay ang Admin ng temporary password na babaguhin mo sa susunod mong pag-sign in.','password,change password,forgot password,reset password,forgot,nakalimutan,can\'t log in,cannot login,login problem','/account/password','Change my password',120,1,'2026-09-30 23:16:24','2026-10-01 00:44:10'),
(13,'Account','How do I add or change my email or mobile number?','Paano ko idadagdag o babaguhin ang aking email o mobile number?','If your account is missing an email or a mobile number, add it on the \"Become a Resident\" page — we\'ll send a code to confirm it. To change a contact that\'s already verified, please contact the city office.','Kung walang email o mobile number ang iyong account, idagdag ito sa \"Become a Resident\" page — magpapadala kami ng code para kumpirmahin ito. Para baguhin ang contact na verified na, mangyaring makipag-ugnayan sa city office.','change email,change number,change mobile,update email,update phone,add email,add mobile,phone number,cellphone,cp number,contact details','/residency','Open my contacts',130,1,'2026-09-30 23:16:24','2026-10-01 00:44:10'),
(14,'General','Is my personal information safe?','Ligtas ba ang aking personal na impormasyon?','Your documents are stored privately and can only be viewed by you and City Staff. We collect your information only to process your account and permits, in line with the Data Privacy Act of 2012 (RA 10173).','Ang iyong mga dokumento ay iniimbak nang pribado at maaari lamang makita ng ikaw at ng City Staff. Kinokolekta namin ang iyong impormasyon para lamang iproseso ang iyong account at mga permit, alinsunod sa Data Privacy Act of 2012 (RA 10173).','privacy,data privacy,safe,secure,security,who can see,personal information,my data,ra 10173,datos',NULL,NULL,140,1,'2026-09-30 23:16:24','2026-09-30 23:26:01'),
(15,'General','Are there fees, and how do I pay?','May mga bayarin ba, at paano ako magbabayad?','Permit fees are assessed by the office handling your application once it\'s reviewed. Online payment isn\'t available yet — the office will tell you how and where to pay.','Ang mga bayarin sa permit ay tinatasa ng opisinang humahawak sa iyong aplikasyon kapag naisuri na ito. Wala pang online payment — sasabihin sa iyo ng opisina kung paano at saan magbabayad.','fee,fees,cost,how much,payment,pay,price,bayad,magkano,charges',NULL,NULL,150,1,'2026-09-30 23:16:24','2026-10-01 00:44:10'),
(16,'General','How do I contact the city office?','Paano ako makikipag-ugnayan sa city office?','For questions the assistant can\'t answer, please visit or call the city hall during office hours (Monday to Friday, 8:00 AM – 5:00 PM). You can also message the reviewer from your application page.','Para sa mga tanong na hindi masagot ng assistant, mangyaring bisitahin o tawagan ang city hall sa oras ng opisina (Lunes hanggang Biyernes, 8:00 AM – 5:00 PM). Maaari mo ring i-message ang reviewer mula sa iyong application page.','contact,office,phone,call,hotline,email the office,office hours,city hall,visit,talk to a person,human,agent,staff',NULL,NULL,160,1,'2026-09-30 23:16:24','2026-10-01 00:44:10'),
(17,'Permits','How does the permit review process work?','Paano gumagana ang proseso ng pagsusuri ng permit?','Most permits pass through more than one city office, in order — usually starting with your Barangay, then whichever offices that permit type needs (for example Zoning, then the Building Official, then the Treasurer). Each office has to clear its stage before the next one can act. Your application\'s detail page shows exactly which office has it right now.','Karamihan sa mga permit ay dumadaan sa higit sa isang opisina ng lungsod, ayon sa pagkakasunod-sunod — kadalasan magsisimula sa iyong Barangay, pagkatapos sa mga opisinang kailangan ng permit na iyon (halimbawa Zoning, tapos ang Building Official, tapos ang Treasurer). Kailangang tapusin muna ng bawat opisina ang kanilang stage bago makagalaw ang susunod. Makikita sa detail page ng iyong aplikasyon kung sinong opisina ang may hawak ngayon.','how does review work,pipeline,multiple offices,which office,barangay first,review process,stages,steps in review,how long does each office take,paano gumagana ang pagsusuri,proseso ng pagsusuri,mga hakbang,ilang opisina,anong opisina',NULL,NULL,95,1,'2026-09-30 23:21:04','2026-10-01 00:44:10'),
(18,'Permits','Why do I need to answer extra questions when applying?','Bakit kailangan kong sagutin ang mga karagdagang tanong kapag nag-a-apply?','Some permits ask a couple of yes/no questions at submission — for example whether your project is inside a subdivision, or whether food will be manufactured for resale. Answering \"yes\" routes your application through an extra office that needs to review that specific condition. Answer honestly: if a condition you didn\'t declare turns out to apply, your permit can be voided.','May ilang permit na nagtatanong ng ilang yes/no na tanong sa oras ng pag-submit — halimbawa kung ang proyekto mo ay nasa loob ng subdivision, o kung gagawa ng pagkain para ibenta pa. Ang pagsagot ng \"yes\" ay magpapadaan sa iyong aplikasyon sa karagdagang opisina na kailangang suriin ang kondisyong iyon. Sagutin nang tapat: kung may kondisyong hindi mo idineklara na lumabas na totoo pala, maaaring ma-void ang iyong permit.','extra questions,qualifying questions,yes no questions,why asking,branch question,condition,void,voided,undeclared,subdivision,manufactured,alcohol served,karagdagang tanong,bakit magtatanong,kondisyon,huwag idedeklara',NULL,NULL,96,1,'2026-09-30 23:21:04','2026-10-01 00:44:10'),
(19,'Permits','What are barangay clearances?','Ano ang mga barangay clearance?','Some documents are issued directly by your Barangay and never reach City Hall — for example a Certificate of Residency, Certificate of Indigency, a personal Barangay Clearance, or a First-Time Jobseeker Certificate. These are only available to verified Residents, and they\'re separate from the barangay step that\'s automatically included as stage one of a bigger permit like a Building Permit.','May ilang dokumento na direktang inilalabas ng iyong Barangay at hindi na umaabot sa City Hall — halimbawa ang Certificate of Residency, Certificate of Indigency, personal na Barangay Clearance, o First-Time Jobseeker Certificate. Ito ay para lamang sa verified Residents, at hiwalay ito sa barangay step na awtomatikong kasama bilang unang hakbang ng mas malaking permit tulad ng Building Permit.','barangay clearance,barangay document,barangay certificate,standalone barangay,certificate of residency,certificate of indigency,first time jobseeker,good moral character,barangay only,ano ang barangay clearance,dokumento ng barangay,katibayan ng barangay','/applications/new','See barangay documents',97,1,'2026-09-30 23:21:04','2026-10-01 00:44:10'),
(20,'Resident','Why does my barangay matter?','Bakit mahalaga ang aking barangay?','Your barangay is selected when you verify your residency (or, for a business, its registered address). It determines which Barangay office reviews the barangay stage of your permits and any barangay-only documents you request — Dasmariñas has 75 barangays, each with its own office.','Pinipili ang iyong barangay kapag ni-verify mo ang iyong residency (o, para sa negosyo, ang rehistradong address nito). Ito ang magtatakda kung aling opisina ng Barangay ang susuri sa barangay stage ng iyong mga permit at anumang barangay-only na dokumento na hihilingin mo — may 75 barangay ang Dasmariñas, bawat isa ay may sariling opisina.','barangay,which barangay,my barangay,barangay matter,why barangay,select barangay,75 barangays,bakit mahalaga ang barangay,aking barangay,piniling barangay',NULL,NULL,25,1,'2026-09-30 23:21:04','2026-09-30 23:38:23'),
(22,'Business','When do I renew my business permit?','Kailan ko dapat i-renew ang business permit ko?','Business permits lapse on 31 December. Renewal runs from 1 to 20 January every year — renewing after that adds a 25% surcharge plus 2% interest per month on the local business tax.\nFile it here as \"Business Permit Renewal\". It goes to the barangay first, then BPLO assesses your gross receipts, the Health Office renews the Sanitary Permit and staff health cards, the Bureau of Fire Protection re-inspects, you pay at the Treasurer, and BPLO re-issues the Mayor\'s Permit.\nHave ready: last year\'s Mayor\'s Permit and its official receipt, your previous Barangay Business Clearance, and a certified summary of last year\'s gross sales.\nYour DTI or SEC registration is not part of this — DTI runs five years and SEC does not expire.','Nag-e-expire ang business permit tuwing Disyembre 31. Ang renewal ay mula Enero 1 hanggang 20 bawat taon — kapag lumagpas ka roon, may 25% surcharge at 2% interes kada buwan sa local business tax.\nI-file ito rito bilang \"Business Permit Renewal\". Dadaan ito sa barangay muna, susuriin ng BPLO ang iyong gross receipts, bibigyan ng Health Office ng bagong Sanitary Permit at health cards ng mga tauhan, iinspeksyunin muli ng Bureau of Fire Protection, magbabayad ka sa Treasurer, at muling i-iisyu ng BPLO ang Mayor\'s Permit.\nIhanda: ang Mayor\'s Permit noong nakaraang taon at ang opisyal na resibo nito, ang dati mong Barangay Business Clearance, at sertipikadong buod ng gross sales noong nakaraang taon.\nHindi kasama rito ang DTI o SEC registration mo — limang taon ang DTI at hindi nag-e-expire ang SEC.','renew, renewal, business permit, mayor permit, january, expire, surcharge, deadline','/applications/new','File a renewal',61,1,'2026-10-02 22:51:49','2026-10-02 22:52:31');
/*!40000 ALTER TABLE `faq_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_reads`
--

DROP TABLE IF EXISTS `notification_reads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_reads` (
  `user_id` int(11) NOT NULL,
  `activity_id` int(11) NOT NULL,
  `read_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`activity_id`),
  KEY `activity_id` (`activity_id`),
  CONSTRAINT `notification_reads_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notification_reads_ibfk_2` FOREIGN KEY (`activity_id`) REFERENCES `application_activity` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_reads`
--

LOCK TABLES `notification_reads` WRITE;
/*!40000 ALTER TABLE `notification_reads` DISABLE KEYS */;
INSERT INTO `notification_reads` VALUES
(131,1,'2026-10-01 08:51:52'),
(131,2,'2026-10-01 08:51:49'),
(131,3,'2026-10-01 08:51:51'),
(131,6,'2026-10-01 08:51:50'),
(131,19,'2026-10-01 09:38:12'),
(131,20,'2026-10-05 10:47:55'),
(134,10,'2026-10-01 08:43:01'),
(134,12,'2026-10-01 08:46:12'),
(134,25,'2026-10-08 09:24:14'),
(137,129,'2026-10-05 14:53:32'),
(163,32,'2026-10-03 00:01:31'),
(163,33,'2026-10-03 00:01:34'),
(163,34,'2026-10-03 00:01:33'),
(163,40,'2026-10-03 17:01:17');
/*!40000 ALTER TABLE `notification_reads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permit_pipeline_steps`
--

DROP TABLE IF EXISTS `permit_pipeline_steps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=204 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permit_pipeline_steps`
--

LOCK TABLES `permit_pipeline_steps` WRITE;
/*!40000 ALTER TABLE `permit_pipeline_steps` DISABLE KEYS */;
INSERT INTO `permit_pipeline_steps` VALUES
(1,1,1.00,'BARANGAY','Barangay Construction Clearance',NULL,NULL,'2026-09-30 23:16:25'),
(2,1,1.50,'ENGINEER','HOA/Developer Clearance','inside_subdivision','Is this inside a private subdivision?','2026-09-30 23:16:25'),
(3,1,2.00,'CPDO','Zoning Clearance',NULL,NULL,'2026-09-30 23:16:25'),
(4,1,3.00,'OBO','Technical plan review',NULL,NULL,'2026-09-30 23:16:25'),
(5,1,3.30,'OBO','Mechanical systems review','has_mechanical','Does this include mechanical systems (elevator, HVAC, generator)?','2026-09-30 23:16:25'),
(6,1,3.60,'OBO','Electronics/telecom systems review','has_electronics','Does this include electronics/telecom/security systems?','2026-09-30 23:16:25'),
(7,1,4.00,'CENRO','Environmental clearance',NULL,NULL,'2026-09-30 23:16:25'),
(8,1,5.00,'ASSESSOR','RPT clearance',NULL,NULL,'2026-09-30 23:16:25'),
(9,1,6.00,'OBO','Building Permit issued',NULL,NULL,'2026-09-30 23:16:25'),
(16,2,1.00,'OBO','Final inspection',NULL,NULL,'2026-09-30 23:16:25'),
(17,2,2.00,'BFP','Fire Safety Inspection Certificate',NULL,NULL,'2026-09-30 23:16:25'),
(18,2,3.00,'OBO','Certificate of Occupancy issued',NULL,NULL,'2026-09-30 23:16:25'),
(19,3,1.00,'BARANGAY','Barangay Fencing Clearance',NULL,NULL,'2026-09-30 23:16:25'),
(20,3,2.00,'OBO','Engineer review',NULL,NULL,'2026-09-30 23:16:25'),
(21,3,2.50,'CENRO','Waterway/drainage easement review','affects_waterway','Does the fence line affect a waterway or drainage easement?','2026-09-30 23:16:25'),
(22,3,3.00,'OBO','Fencing Permit issued',NULL,NULL,'2026-09-30 23:16:25'),
(26,4,1.00,'BARANGAY','Barangay Demolition Clearance',NULL,NULL,'2026-09-30 23:16:25'),
(27,4,2.00,'OBO','Engineer review',NULL,NULL,'2026-09-30 23:16:25'),
(28,4,2.50,'CENRO','Hazardous materials review','has_hazmat','Are hazardous materials present (e.g. asbestos)?','2026-09-30 23:16:25'),
(29,4,3.00,'OBO','Demolition Permit issued',NULL,NULL,'2026-09-30 23:16:25'),
(33,5,1.00,'BARANGAY','Barangay Excavation/Road-Cut Clearance',NULL,NULL,'2026-09-30 23:16:25'),
(34,5,2.00,'ENGINEER','Public Works review',NULL,NULL,'2026-09-30 23:16:25'),
(35,5,3.00,'CENRO','Environmental/drainage clearance',NULL,NULL,'2026-09-30 23:16:25'),
(36,5,4.00,'ENGINEER','Excavation/Road-Cut Permit issued',NULL,NULL,'2026-09-30 23:16:25'),
(40,6,1.00,'BARANGAY','Barangay Business Clearance',NULL,NULL,'2026-09-30 23:16:25'),
(41,6,2.00,'CPDO','Zoning Clearance',NULL,NULL,'2026-09-30 23:16:25'),
(42,6,3.00,'BPLO','Business tax and fee assessment',NULL,NULL,'2026-09-30 23:16:25'),
(43,6,4.00,'TREASURER','Payment and Mayor\'s Permit issued',NULL,NULL,'2026-09-30 23:16:25'),
(47,7,1.00,'BARANGAY','Barangay Business Clearance',NULL,NULL,'2026-09-30 23:16:25'),
(48,7,2.00,'CHO','Sanitary Permit, water potability, staff health cards',NULL,NULL,'2026-09-30 23:16:25'),
(49,7,3.00,'BFP','Fire Safety Inspection Certificate',NULL,NULL,'2026-09-30 23:16:25'),
(50,7,3.50,'FDA','FDA License to Operate / Certificate of Product Registration','is_manufacturing','Will products be manufactured, repacked, or bottled for retail or export?','2026-09-30 23:16:25'),
(51,7,4.00,'BPLO','Mayor\'s Permit issued',NULL,NULL,'2026-09-30 23:16:25'),
(54,8,1.00,'BARANGAY','Barangay Business Clearance',NULL,NULL,'2026-09-30 23:16:25'),
(55,8,2.00,'CPDO','Placement/zoning check',NULL,NULL,'2026-09-30 23:16:25'),
(56,8,2.50,'OBO','Structural review','is_structural_sign','Is this a large/structural billboard (vs. storefront signage)?','2026-09-30 23:16:25'),
(57,8,3.00,'BPLO','Sign Permit issued',NULL,NULL,'2026-09-30 23:16:25'),
(61,9,1.00,'BARANGAY','Barangay Clearance for Special Events',NULL,NULL,'2026-09-30 23:16:25'),
(62,9,2.00,'PNP','Police coordination',NULL,NULL,'2026-09-30 23:16:25'),
(63,9,3.00,'BFP','Crowd safety check',NULL,NULL,'2026-09-30 23:16:25'),
(64,9,3.50,'BPLO','Liquor License','serves_alcohol','Will alcohol be sold or served at the event?','2026-09-30 23:16:25'),
(65,9,4.00,'BPLO','Special Event Permit issued',NULL,NULL,'2026-09-30 23:16:25'),
(68,10,1.00,'BPLO','Application review',NULL,NULL,'2026-09-30 23:16:25'),
(69,10,2.00,'PNP','Police clearance',NULL,NULL,'2026-09-30 23:16:25'),
(70,10,3.00,'BPLO','License issued',NULL,NULL,'2026-09-30 23:16:25'),
(71,11,1.00,'BARANGAY','Barangay Clearance for Tricycles (TODA)',NULL,NULL,'2026-09-30 23:16:25'),
(72,11,2.00,'TRAFFIC','City Traffic Management Office review',NULL,NULL,'2026-09-30 23:16:25'),
(73,11,3.00,'BPLO','MTOP issued',NULL,NULL,'2026-09-30 23:16:25'),
(74,12,1.00,'BARANGAY','Barangay Business Clearance',NULL,NULL,'2026-09-30 23:16:25'),
(75,12,2.00,'BPLO','Market Section review',NULL,NULL,'2026-09-30 23:16:25'),
(76,12,3.00,'TREASURER','Stall fee assessed, permit issued',NULL,NULL,'2026-09-30 23:16:25'),
(77,13,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(78,14,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(79,15,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(80,16,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(81,17,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(82,18,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(83,19,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(84,20,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(85,21,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(86,22,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(87,23,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(88,24,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(89,25,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(90,26,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(91,27,1.00,'BARANGAY','Issued directly by the barangay',NULL,NULL,'2026-09-30 23:16:25'),
(128,11,1.50,'LTO','Driver\'s licence and vehicle registration check',NULL,NULL,'2026-10-02 23:38:02'),
(185,29,1.00,'BARANGAY','Barangay Business Clearance (Renewal)',NULL,NULL,'2026-10-04 09:51:44'),
(186,29,2.00,'BPLO','Renewal assessment: gross receipts and local business tax',NULL,NULL,'2026-10-04 09:51:44'),
(187,29,3.00,'CHO','Sanitary Permit and staff health cards',NULL,NULL,'2026-10-04 09:51:44'),
(188,29,4.00,'BFP','Fire Safety Inspection Certificate',NULL,NULL,'2026-10-04 09:51:44'),
(189,29,5.00,'TREASURER','Community Tax Certificate (Cedula) and payment',NULL,NULL,'2026-10-04 09:51:44'),
(190,29,6.00,'BPLO','Mayor\'s Permit re-issued',NULL,NULL,'2026-10-04 09:51:44');
/*!40000 ALTER TABLE `permit_pipeline_steps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permit_type_documents`
--

DROP TABLE IF EXISTS `permit_type_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `permit_type_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `permit_type_id` int(11) NOT NULL,
  `doc_name` varchar(150) NOT NULL,
  `office_code` varchar(20) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `permit_type_id` (`permit_type_id`),
  CONSTRAINT `permit_type_documents_ibfk_1` FOREIGN KEY (`permit_type_id`) REFERENCES `permit_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=194 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permit_type_documents`
--

LOCK TABLES `permit_type_documents` WRITE;
/*!40000 ALTER TABLE `permit_type_documents` DISABLE KEYS */;
INSERT INTO `permit_type_documents` VALUES
(1,1,'Site Plan','OBO',1),
(2,1,'Structural Drawings','OBO',2),
(3,1,'Lot Title or Tax Declaration','ASSESSOR',3),
(4,1,'Contractor License','OBO',4),
(8,2,'As-Built Plans','OBO',1),
(9,2,'Certificate of Completion','OBO',2),
(11,3,'Fencing Plan / Sketch','OBO',1),
(12,3,'Lot Title or Tax Declaration','OBO',2),
(14,4,'Demolition Plan','OBO',1),
(15,4,'Proof of Ownership','OBO',2),
(17,5,'Excavation Plan','ENGINEER',1),
(18,5,'Utility Company Authorization (if applicable)','ENGINEER',2),
(20,6,'Business Formation Document (DTI / SEC / CDA)','BPLO',1),
(21,6,'BIR Certificate of Registration (Form 2303)','BPLO',2),
(22,6,'Zoning Compliance Letter','CPDO',3),
(23,7,'Health Permit Application','CHO',1),
(24,7,'Food Handler Certificate','CHO',2),
(25,7,'Floor Plan','CHO',3),
(26,7,'Proof of Insurance','BFP',4),
(30,8,'Sign Drawing / Rendering','CPDO',1),
(31,8,'Property Owner Authorization','CPDO',2),
(33,9,'Event Layout Map','BFP',1),
(34,9,'Proof of Insurance','BFP',2),
(35,9,'Security/Safety Plan','PNP',3),
(36,10,'Copy of Business/Mayor\'s Permit','BPLO',1),
(37,11,'Driver\'s License','LTO',1),
(38,11,'Vehicle OR/CR','LTO',2),
(40,12,'Community Tax Certificate (Cedula)','TREASURER',1),
(41,12,'Health Card','BARANGAY',2),
(43,13,'Valid Government ID','BARANGAY',1),
(44,14,'Valid Government ID','BARANGAY',1),
(45,14,'Job Offer Letter','BARANGAY',2),
(47,18,'Valid Government ID','BARANGAY',1),
(48,17,'Valid Government ID','BARANGAY',1),
(49,16,'Valid Government ID','BARANGAY',1),
(50,16,'Proof of Address','BARANGAY',2),
(52,19,'Valid Government ID','BARANGAY',1),
(53,19,'Mediation Records (Lupon)','BARANGAY',2),
(55,15,'Valid Government ID','BARANGAY',1),
(56,15,'Certificate of Residency','BARANGAY',2),
(58,20,'Valid Government ID','BARANGAY',1),
(59,20,'Lease Contract or Land Title','BARANGAY',2),
(60,20,'DTI/SEC/CDA Registration','BARANGAY',3),
(61,21,'Valid Government ID','BARANGAY',1),
(62,21,'Previous Barangay Clearance','BARANGAY',2),
(64,22,'Valid Government ID','BARANGAY',1),
(65,22,'Event Details / Program','BARANGAY',2),
(67,23,'Valid Government ID','BARANGAY',1),
(68,23,'Vehicle OR/CR','BARANGAY',2),
(70,24,'Valid Government ID','BARANGAY',1),
(71,24,'Lot Title or Tax Declaration','BARANGAY',2),
(72,24,'Building Plan Sketch','BARANGAY',3),
(73,26,'Valid Government ID','BARANGAY',1),
(74,26,'Proof of Ownership','BARANGAY',2),
(76,27,'Valid Government ID','BARANGAY',1),
(77,27,'Site Sketch','BARANGAY',2),
(79,25,'Valid Government ID','BARANGAY',1),
(80,25,'Lot Title or Tax Declaration','BARANGAY',2),
(174,29,'Previous Mayor\'s / Business Permit','BPLO',1),
(175,29,'Official Receipt of last year\'s permit payment','TREASURER',2),
(176,29,'Previous Barangay Business Clearance','BARANGAY',3),
(177,29,'Certified gross sales / receipts summary (previous year)','BPLO',4);
/*!40000 ALTER TABLE `permit_type_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permit_types`
--

DROP TABLE IF EXISTS `permit_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `permit_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` varchar(400) DEFAULT NULL,
  `track` enum('construction','business','personal','barangay_standalone') NOT NULL,
  `resident_eligible` tinyint(1) NOT NULL DEFAULT 0,
  `business_eligible` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permit_type_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permit_types`
--

LOCK TABLES `permit_types` WRITE;
/*!40000 ALTER TABLE `permit_types` DISABLE KEYS */;
INSERT INTO `permit_types` VALUES
(1,'Building Permit','Required before you build, add to, or structurally alter a building. Covers the plans, the lot, environmental impact and unpaid property tax, so it is the longest route in the system — expect several offices and a site inspection.','construction',1,1,1,'2026-09-30 23:16:25'),
(2,'Occupancy Permit','The last step after construction finishes: proof the building was finished to the approved plans and is safe to use. A building cannot legally be occupied without it, and it starts at the Building Official rather than your barangay.','construction',1,1,1,'2026-09-30 23:16:25'),
(3,'Fencing Permit','Required before putting up a perimeter fence or wall. Lighter than a Building Permit, but still checks the boundary, the height and any drainage or waterway it might affect.','construction',1,1,1,'2026-09-30 23:16:25'),
(4,'Demolition Permit','Required before taking down a structure, in whole or in part. The city checks who owns it, how it will come down safely, and what happens to the debris.','construction',1,1,1,'2026-09-30 23:16:25'),
(5,'Excavation/Road-Cut Permit','Required before digging in or cutting into a public road, sidewalk or easement — usually for a water, power or drainage connection. Covers how the road gets restored afterwards.','construction',1,1,1,'2026-09-30 23:16:25'),
(6,'Business License','The first-time Mayor\'s Permit for a business that has never been licensed by the city. Checks that what you do is allowed where you are, then assesses your local business tax. Renewing an existing permit is a different application.','business',0,1,1,'2026-09-30 23:16:25'),
(7,'Food Service','For any business that prepares, serves or sells food. Adds a sanitary permit, water potability and staff health cards on top of the usual licensing, and a fire inspection. Food manufacturers are also routed to the FDA.','business',0,1,1,'2026-09-30 23:16:25'),
(8,'Sign Permit','Required before installing signage, billboards or any outdoor advertising. Checks placement against zoning rules, and anything structural is reviewed by the Building Official.','business',0,1,1,'2026-09-30 23:16:25'),
(9,'Special Event','For concerts, fiestas, fun runs, bazaars and other gatherings. Covers police coordination and crowd safety; add the liquor question if drink will be served.','business',1,1,1,'2026-09-30 23:16:25'),
(10,'Liquor/Tobacco License','Permission to sell liquor or tobacco, on top of your business permit. Includes a police clearance, and is tied to the premises named on the application.','business',0,1,1,'2026-09-30 23:16:25'),
(11,'MTOP/TODA Permit','The Motorized Tricycle Operator\'s Permit — the city\'s authority to operate a tricycle for hire on a given route. Your driver\'s licence and the vehicle\'s OR/CR are checked by the LTO; the franchise itself is the city\'s to grant.','business',0,1,1,'2026-09-30 23:16:25'),
(12,'Market Stall/Vending Permit','For selling from a stall in a public market or as an ambulant vendor. Lighter than a full business licence, and the stall fee is assessed and paid at the Treasurer.','business',0,1,1,'2026-09-30 23:16:25'),
(13,'Barangay Clearance (Personal)','General-purpose clearance from your barangay certifying you are a resident in good standing. Commonly asked for by employers, banks and other agencies.','personal',1,0,1,'2026-09-30 23:16:25'),
(14,'Barangay Employment Clearance','A clearance specifically for job applications, stating you live in the barangay and have no pending complaints. Often requested alongside an NBI or police clearance.','personal',1,0,1,'2026-09-30 23:16:25'),
(15,'First-Time Jobseeker Certificate','For first-time jobseekers under the First Time Jobseekers Assistance Act, which waives the fees on documents you need for your first job. Issued once.','personal',1,0,1,'2026-09-30 23:16:25'),
(16,'Certificate of Residency','Certifies how long you have lived at your address in this barangay. Required for voter registration, school enrolment and many government transactions.','personal',1,0,1,'2026-09-30 23:16:25'),
(17,'Certificate of Indigency','Certifies that you cannot afford a fee or service. Used for free medical assistance, legal aid, scholarships and discounted hospital bills.','personal',1,0,1,'2026-09-30 23:16:25'),
(18,'Certificate of Good Moral Character','Certifies that the barangay has no record of wrongdoing against you. Usually required for school admission, licensure exams or employment.','personal',1,0,1,'2026-09-30 23:16:25'),
(19,'Certificate to File Action','Issued when a dispute brought before the barangay could not be settled, and it releases the case to go to court. Your Lupon mediation records are part of the application.','personal',1,0,1,'2026-09-30 23:16:25'),
(20,'Barangay Business Clearance (New)','The barangay\'s clearance for a new business at an address in its area. A prerequisite for the city Business License — file this first if you do not have one yet.','barangay_standalone',1,0,1,'2026-09-30 23:16:25'),
(21,'Barangay Business Clearance (Renewal)','The yearly barangay clearance for a business already operating in its area. Renew this before your Business Permit Renewal; the city asks for it.','barangay_standalone',1,0,1,'2026-09-30 23:16:25'),
(22,'Barangay Clearance for Special Events','The barangay\'s consent to hold an event in its area. Needed before the city Special Event permit, and on its own for anything small enough to stay within the barangay.','barangay_standalone',1,0,1,'2026-09-30 23:16:25'),
(23,'Barangay Clearance for Tricycles (TODA)','The barangay\'s endorsement for operating a tricycle on its roads. A prerequisite for the city MTOP/TODA permit.','barangay_standalone',1,0,1,'2026-09-30 23:16:25'),
(24,'Barangay Construction Clearance','The barangay\'s consent to build at an address in its area. A prerequisite for the city Building Permit — file this first if you do not have one yet.','barangay_standalone',1,0,1,'2026-09-30 23:16:25'),
(25,'Barangay Fencing Clearance','The barangay\'s consent to fence a lot in its area. A prerequisite for the city Fencing Permit.','barangay_standalone',1,0,1,'2026-09-30 23:16:25'),
(26,'Barangay Demolition Clearance','The barangay\'s consent to demolish a structure in its area. A prerequisite for the city Demolition Permit.','barangay_standalone',1,0,1,'2026-09-30 23:16:25'),
(27,'Barangay Excavation/Road-Cut Clearance','The barangay\'s consent to dig in or cut into a road in its area. A prerequisite for the city Excavation/Road-Cut Permit.','barangay_standalone',1,0,1,'2026-09-30 23:16:25'),
(29,'Business Permit Renewal','The yearly renewal of an existing Mayor\'s Permit. Permits lapse on 31 December and renewal runs 1–20 January; renewing later adds a 25% surcharge plus 2% interest a month. Zoning is not re-checked, but health, fire and your gross receipts are.','business',0,1,1,'2026-10-02 22:49:30');
/*!40000 ALTER TABLE `permit_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resident_proofs`
--

DROP TABLE IF EXISTS `resident_proofs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resident_proofs`
--

LOCK TABLES `resident_proofs` WRITE;
/*!40000 ALTER TABLE `resident_proofs` DISABLE KEYS */;
INSERT INTO `resident_proofs` VALUES
(1,1,'drivers_license',NULL,'residency/130/64283315c8e22e2775dcd465df9fbd7c.png','pixil-frame-0.png','image/png',7889,'2026-10-01 09:29:35'),
(2,1,'national_id',NULL,'residency/130/ae6adbc38a5a2e9961c11ee46f0e199b.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp (1).jpg','image/jpeg',1469275,'2026-10-01 09:29:35'),
(3,2,'postal_id',NULL,'residency/161/8aa3bbb379fb62515f8bd03e40502cce.pdf','Case Study Proposal Data Privacy and Fairness in Digital Scholarship Processing.pdf','application/pdf',217859,'2026-10-02 19:48:59'),
(4,2,'national_id',NULL,'residency/161/e56e10b5df7b6e77200cd5d52a5d8c39.pdf','SIPP Case Study Proposal Free Drinking Fountains at NCST.pdf','application/pdf',232848,'2026-10-02 19:48:59'),
(5,3,'postal_id',NULL,'residency/163/f867ecc3058cfbfaab9cc56030259080.png','Screenshot 2025-08-15 201152 (1) (1) (1).png','image/png',32068,'2026-10-02 23:53:28'),
(6,3,'drivers_license',NULL,'residency/163/832553c928fb0c5567e1b43612ff5a18.png','pixil-frame-0.png','image/png',7889,'2026-10-02 23:53:28'),
(7,4,'postal_id',NULL,'residency/169/d7bfeea2f93f2f098b9c888bc51b8957.png','Screenshot 2025-08-15 201152 (1) (1).png','image/png',32068,'2026-10-03 17:45:56'),
(8,4,'drivers_license',NULL,'residency/169/d9a9baae768a13cb702ccc422ddc0190.jpg','Gemini_Generated_Image_6kwpkm6kwpkm6kwp (1).jpg','image/jpeg',1469275,'2026-10-03 17:45:56');
/*!40000 ALTER TABLE `resident_proofs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resident_verifications`
--

DROP TABLE IF EXISTS `resident_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resident_verifications`
--

LOCK TABLES `resident_verifications` WRITE;
/*!40000 ALTER TABLE `resident_verifications` DISABLE KEYS */;
INSERT INTO `resident_verifications` VALUES
(1,130,'pending','B4 L18 Narra Drv. P-B Treelane III subd','Burol I','Dasmariñas',2,'','2026-10-01 09:29:35',NULL,NULL,NULL,'2026-10-01 09:29:35'),
(2,161,'approved','Sample Street','Burol Main','Dasmariñas',1,'4103','2026-10-02 19:48:59',3,'2026-10-02 22:22:55',NULL,'2026-10-02 19:48:59'),
(3,163,'approved','Sample Street','Zone II','Dasmariñas',73,'4114','2026-10-02 23:53:28',75,'2026-10-02 23:54:45',NULL,'2026-10-02 23:53:28'),
(4,169,'approved','Sample Street','Zone II','Dasmariñas',73,'4108','2026-10-03 17:45:56',75,'2026-10-03 17:56:47',NULL,'2026-10-03 17:45:56');
/*!40000 ALTER TABLE `resident_verifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=250 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,'staff',NULL,1,'staff','staff@hotmail.com',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Jordan Reyes','Jordan',NULL,'Reyes',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:12',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:12',NULL),
(2,'admin',NULL,1,'staff','admin@hotmail.com',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'System Administrator','System',NULL,'Administrator',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:24',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:24',NULL),
(3,'staff',13,1,'staff','secretary.burol@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Burol Main','Barangay',NULL,'Secretary — Burol',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25','2026-10-02 23:17:56'),
(4,'staff',14,1,'staff','secretary.burol-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Burol I','Barangay',NULL,'Secretary — Burol I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25','2026-10-08 10:45:11'),
(5,'staff',15,1,'staff','secretary.burol-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Burol II','Barangay',NULL,'Secretary — Burol II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(6,'staff',16,1,'staff','secretary.burol-iii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Burol III','Barangay',NULL,'Secretary — Burol III',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(7,'staff',17,1,'staff','secretary.datu-esmael@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Datu Esmael','Barangay',NULL,'Secretary — Datu Esmael',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(8,'staff',18,1,'staff','secretary.emmanuel-bergado-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Emmanuel Bergado I','Barangay',NULL,'Secretary — Emmanuel Bergado I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(9,'staff',19,1,'staff','secretary.emmanuel-bergado-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Emmanuel Bergado II','Barangay',NULL,'Secretary — Emmanuel Bergado II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(10,'staff',20,1,'staff','secretary.fatima-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Fatima I','Barangay',NULL,'Secretary — Fatima I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(11,'staff',21,1,'staff','secretary.fatima-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Fatima II','Barangay',NULL,'Secretary — Fatima II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(12,'staff',22,1,'staff','secretary.fatima-iii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Fatima III','Barangay',NULL,'Secretary — Fatima III',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(13,'staff',23,1,'staff','secretary.h-2@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — H-2','Barangay',NULL,'Secretary — H-2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(14,'staff',24,1,'staff','secretary.langkaan-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Langkaan I','Barangay',NULL,'Secretary — Langkaan I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25','2026-10-05 09:47:41'),
(15,'staff',25,1,'staff','secretary.langkaan-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Langkaan II','Barangay',NULL,'Secretary — Langkaan II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(16,'staff',26,1,'staff','secretary.luzviminda-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Luzviminda I','Barangay',NULL,'Secretary — Luzviminda I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(17,'staff',27,1,'staff','secretary.luzviminda-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Luzviminda II','Barangay',NULL,'Secretary — Luzviminda II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(18,'staff',28,1,'staff','secretary.paliparan-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Paliparan I','Barangay',NULL,'Secretary — Paliparan I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(19,'staff',29,1,'staff','secretary.paliparan-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Paliparan II','Barangay',NULL,'Secretary — Paliparan II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(20,'staff',30,1,'staff','secretary.paliparan-iii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Paliparan III','Barangay',NULL,'Secretary — Paliparan III',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(21,'staff',31,1,'staff','secretary.sabang@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Sabang','Barangay',NULL,'Secretary — Sabang',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(22,'staff',32,1,'staff','secretary.saint-peter-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Saint Peter I','Barangay',NULL,'Secretary — Saint Peter I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(23,'staff',33,1,'staff','secretary.saint-peter-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Saint Peter II','Barangay',NULL,'Secretary — Saint Peter II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(24,'staff',34,1,'staff','secretary.salawag@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Salawag','Barangay',NULL,'Secretary — Salawag',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(25,'staff',35,1,'staff','secretary.salitran-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Salitran I','Barangay',NULL,'Secretary — Salitran I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(26,'staff',36,1,'staff','secretary.salitran-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Salitran II','Barangay',NULL,'Secretary — Salitran II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(27,'staff',37,1,'staff','secretary.salitran-iii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Salitran III','Barangay',NULL,'Secretary — Salitran III',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(28,'staff',38,1,'staff','secretary.salitran-iv@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Salitran IV','Barangay',NULL,'Secretary — Salitran IV',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(29,'staff',39,1,'staff','secretary.sampaloc-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Sampaloc I','Barangay',NULL,'Secretary — Sampaloc I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(30,'staff',40,1,'staff','secretary.sampaloc-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Sampaloc II','Barangay',NULL,'Secretary — Sampaloc II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(31,'staff',41,1,'staff','secretary.sampaloc-iii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Sampaloc III','Barangay',NULL,'Secretary — Sampaloc III',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(32,'staff',42,1,'staff','secretary.sampaloc-iv@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Sampaloc IV','Barangay',NULL,'Secretary — Sampaloc IV',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25','2026-10-03 17:58:45'),
(33,'staff',43,1,'staff','secretary.sampaloc-v@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Sampaloc V','Barangay',NULL,'Secretary — Sampaloc V',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(34,'staff',44,1,'staff','secretary.san-agustin-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Agustin I','Barangay',NULL,'Secretary — San Agustin I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(35,'staff',45,1,'staff','secretary.san-agustin-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Agustin II','Barangay',NULL,'Secretary — San Agustin II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(36,'staff',46,1,'staff','secretary.san-agustin-iii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Agustin III','Barangay',NULL,'Secretary — San Agustin III',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(37,'staff',47,1,'staff','secretary.san-andres-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Andres I','Barangay',NULL,'Secretary — San Andres I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(38,'staff',48,1,'staff','secretary.san-andres-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Andres II','Barangay',NULL,'Secretary — San Andres II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(39,'staff',49,1,'staff','secretary.san-antonio-de-padua-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Antonio de Padua I','Barangay',NULL,'Secretary — San Antonio de Padua I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(40,'staff',50,1,'staff','secretary.san-antonio-de-padua-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Antonio de Padua II','Barangay',NULL,'Secretary — San Antonio de Padua II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(41,'staff',51,1,'staff','secretary.san-dionisio@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Dionisio','Barangay',NULL,'Secretary — San Dionisio',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(42,'staff',52,1,'staff','secretary.san-esteban@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Esteban','Barangay',NULL,'Secretary — San Esteban',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(43,'staff',53,1,'staff','secretary.san-francisco-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Francisco I','Barangay',NULL,'Secretary — San Francisco I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(44,'staff',54,1,'staff','secretary.san-francisco-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Francisco II','Barangay',NULL,'Secretary — San Francisco II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(45,'staff',55,1,'staff','secretary.san-isidro-labrador-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Isidro Labrador I','Barangay',NULL,'Secretary — San Isidro Labrador I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(46,'staff',56,1,'staff','secretary.san-isidro-labrador-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Isidro Labrador II','Barangay',NULL,'Secretary — San Isidro Labrador II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(47,'staff',57,1,'staff','secretary.san-jose@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Jose','Barangay',NULL,'Secretary — San Jose',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(48,'staff',58,1,'staff','secretary.san-juan@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Juan','Barangay',NULL,'Secretary — San Juan',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(49,'staff',59,1,'staff','secretary.san-lorenzo-ruiz-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Lorenzo Ruiz I','Barangay',NULL,'Secretary — San Lorenzo Ruiz I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(50,'staff',60,1,'staff','secretary.san-lorenzo-ruiz-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Lorenzo Ruiz II','Barangay',NULL,'Secretary — San Lorenzo Ruiz II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(51,'staff',61,1,'staff','secretary.san-luis-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Luis I','Barangay',NULL,'Secretary — San Luis I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(52,'staff',62,1,'staff','secretary.san-luis-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Luis II','Barangay',NULL,'Secretary — San Luis II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(53,'staff',63,1,'staff','secretary.san-manuel-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Manuel I','Barangay',NULL,'Secretary — San Manuel I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(54,'staff',64,1,'staff','secretary.san-manuel-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Manuel II','Barangay',NULL,'Secretary — San Manuel II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(55,'staff',65,1,'staff','secretary.san-mateo@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Mateo','Barangay',NULL,'Secretary — San Mateo',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(56,'staff',66,1,'staff','secretary.san-miguel@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Miguel','Barangay',NULL,'Secretary — San Miguel',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(57,'staff',67,1,'staff','secretary.san-miguel-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Miguel II','Barangay',NULL,'Secretary — San Miguel II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(58,'staff',68,1,'staff','secretary.san-nicolas-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Nicolas I','Barangay',NULL,'Secretary — San Nicolas I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(59,'staff',69,1,'staff','secretary.san-nicolas-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Nicolas II','Barangay',NULL,'Secretary — San Nicolas II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(60,'staff',70,1,'staff','secretary.san-roque@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Roque','Barangay',NULL,'Secretary — San Roque',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(61,'staff',71,1,'staff','secretary.san-simon@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — San Simon','Barangay',NULL,'Secretary — San Simon',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(62,'staff',72,1,'staff','secretary.santa-cristina-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Santa Cristina I','Barangay',NULL,'Secretary — Santa Cristina I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(63,'staff',73,1,'staff','secretary.santa-cristina-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Santa Cristina II','Barangay',NULL,'Secretary — Santa Cristina II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(64,'staff',74,1,'staff','secretary.santa-cruz-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Santa Cruz I','Barangay',NULL,'Secretary — Santa Cruz I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(65,'staff',75,1,'staff','secretary.santa-cruz-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Santa Cruz II','Barangay',NULL,'Secretary — Santa Cruz II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(66,'staff',76,1,'staff','secretary.santa-fe@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Santa Fe','Barangay',NULL,'Secretary — Santa Fe',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(67,'staff',77,1,'staff','secretary.santa-lucia@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Santa Lucia','Barangay',NULL,'Secretary — Santa Lucia',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(68,'staff',78,1,'staff','secretary.santa-maria@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Santa Maria','Barangay',NULL,'Secretary — Santa Maria',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(69,'staff',79,1,'staff','secretary.santo-cristo@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Santo Cristo','Barangay',NULL,'Secretary — Santo Cristo',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(70,'staff',80,1,'staff','secretary.santo-nino-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Santo Niño I','Barangay',NULL,'Secretary — Santo Niño I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(71,'staff',81,1,'staff','secretary.santo-nino-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Santo Niño II','Barangay',NULL,'Secretary — Santo Niño II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(72,'staff',82,1,'staff','secretary.victoria-reyes@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Victoria Reyes','Barangay',NULL,'Secretary — Victoria Reyes',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(73,'staff',83,1,'staff','secretary.zone-i@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Zone I','Barangay',NULL,'Secretary — Zone I',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(74,'staff',84,1,'staff','secretary.zone-i-b@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Zone I-B','Barangay',NULL,'Secretary — Zone I-B',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(75,'staff',85,1,'staff','secretary.zone-ii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Zone II','Barangay',NULL,'Secretary — Zone II',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25','2026-10-05 14:01:36'),
(76,'staff',86,1,'staff','secretary.zone-iii@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Zone III','Barangay',NULL,'Secretary — Zone III',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(77,'staff',87,1,'staff','secretary.zone-iv@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Barangay Secretary — Zone IV','Barangay',NULL,'Secretary — Zone IV',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:25',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:25',NULL),
(130,'applicant',NULL,1,'unregistered','unregistered.test@permittrack.demo','+639000000130','$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Unregistered Test User','Unregistered',NULL,'Test User',NULL,'B4 L18 Narra Drv. P-B Treelane III subd','Burol I',2,'City of Dasmariñas','042106000','042100000','Cavite','','2026-09-30 23:16:39','2026-10-01 09:29:31',NULL,'pending',1,NULL,NULL,'2026-09-30 23:16:39','2026-10-08 10:44:15'),
(131,'applicant',NULL,1,'resident','resident.test@permittrack.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Resident Test User','Resident',NULL,'Test User',NULL,NULL,'Burol I',2,'City of Dasmariñas','042106000','042100000','Cavite',NULL,'2026-09-30 23:16:39',NULL,NULL,'verified',1,'2026-10-05 10:47:51',NULL,'2026-09-30 23:16:39','2026-10-05 10:54:45'),
(132,'applicant',NULL,1,'business','business.test@permittrack.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Business Approved Test User','Business',NULL,'Approved Test User',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:39',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:39','2026-10-01 08:57:14'),
(133,'applicant',NULL,1,'unregistered','business.pending.test@permittrack.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Business Pending Test User','Business',NULL,'Pending Test User',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-30 23:16:39',NULL,NULL,'none',1,NULL,NULL,'2026-09-30 23:16:39','2026-09-30 23:17:14'),
(134,'applicant',NULL,1,'business','both.test@permittrack.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Both Test User','Both',NULL,'Test User',NULL,NULL,NULL,2,'City of Dasmariñas','042106000','042100000','Cavite',NULL,'2026-09-30 23:16:39',NULL,NULL,'verified',1,'2026-10-08 09:21:48',NULL,'2026-09-30 23:16:39','2026-10-08 10:45:46'),
(137,'applicant',NULL,1,'business','user137@scrubbed.permittrack.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Test Applicant 137','Test',NULL,'Applicant 137','2000-01-01','Sample Street','Bayan Luma VI',NULL,'Imus',NULL,NULL,NULL,'4103','2026-10-01 01:47:10',NULL,'2026-10-01 01:46:39','none',1,'2026-10-08 10:38:11',NULL,'2026-10-01 01:46:39','2026-10-08 13:38:20'),
(145,'applicant',NULL,1,'unregistered',NULL,NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Test Applicant 145','Test',NULL,'Applicant 145','2000-01-01','Sample Street','asd',NULL,'Imus',NULL,NULL,NULL,'4103',NULL,'2026-10-01 02:37:30','2026-10-01 02:37:30','none',1,NULL,NULL,'2026-10-01 02:37:30','2026-10-01 02:37:30'),
(146,'staff',1,1,'staff','obo@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Building Official — OBO','Building',NULL,'Official',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24',NULL),
(147,'staff',2,1,'staff','bplo@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Licensing Officer — BPLO','Licensing',NULL,'Officer',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24',NULL),
(148,'staff',3,1,'staff','cho@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Sanitary Inspector — City Health Office','Sanitary',NULL,'Inspector',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24',NULL),
(149,'staff',4,1,'staff','cpdo@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Zoning Officer — CPDO','Zoning',NULL,'Officer',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24',NULL),
(150,'staff',5,1,'staff','bfp@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Fire Safety Inspector — BFP','Fire Safety',NULL,'Inspector',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24',NULL),
(151,'staff',6,1,'staff','cenro@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Environmental Officer — CENRO','Environmental',NULL,'Officer',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24',NULL),
(152,'staff',7,1,'staff','assessor@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Assessment Officer — City Assessor','Assessment',NULL,'Officer',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24',NULL),
(153,'staff',8,1,'staff','treasurer@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Revenue Officer — City Treasurer','Revenue',NULL,'Officer',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24',NULL),
(154,'staff',9,1,'staff','engineer@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'City Engineer — Public Works','City',NULL,'Engineer',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24','2026-10-02 20:41:28'),
(155,'staff',10,1,'staff','pnp@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Police Coordinator — PNP','Police',NULL,'Coordinator',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24',NULL),
(156,'staff',11,1,'staff','traffic@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Traffic Officer — TODA Section','Traffic',NULL,'Officer',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24',NULL),
(157,'staff',12,1,'staff','fda@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Licensing Officer — FDA','Licensing',NULL,'Officer (FDA)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 19:37:24',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 19:37:24',NULL),
(161,'applicant',NULL,1,'resident',NULL,'+639000000161','$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Test Applicant 161','Test',NULL,'Applicant 161','2000-01-01','Sample Street','Burol Main',1,'City of Dasmariñas','042106000','042100000','Cavite','4103','2026-10-02 19:46:49','2026-10-02 19:48:20','2026-10-02 19:46:49','verified',1,NULL,NULL,'2026-10-02 19:46:49','2026-10-05 19:55:39'),
(162,'staff',141,1,'staff','lto@dasmarinas.gov.ph.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Licensing Officer — LTO','Licensing',NULL,'Officer (LTO)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-02 23:38:02',NULL,NULL,'none',1,NULL,NULL,'2026-10-02 23:38:02',NULL),
(163,'applicant',NULL,1,'resident','user163@scrubbed.permittrack.demo','+639000000163','$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Test Applicant 163','Test',NULL,'Applicant 163','2000-01-01','Sample Street','Zone II',73,'City of Dasmariñas','042106000','042100000','Cavite','4114','2026-10-02 23:52:10','2026-10-02 23:52:38','2026-10-02 23:52:10','verified',1,'2026-10-03 17:01:17',NULL,'2026-10-02 23:52:10','2026-10-04 09:37:03'),
(168,'applicant',NULL,1,'unregistered','user168@scrubbed.permittrack.demo',NULL,'$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Test Applicant 168','Test',NULL,'Applicant 168','2000-01-01','Sample Street',NULL,NULL,'City of Imus','042109000','042100000','Cavite','4168','2026-10-03 13:00:44','2026-10-03 13:01:32','2026-10-03 13:00:44','none',1,NULL,NULL,'2026-10-03 13:00:44','2026-10-03 13:00:44'),
(169,'applicant',NULL,1,'business','user169@scrubbed.permittrack.demo','+639000000169','$2y$10$0pfRKkLFYWtk160sgRHlpOE4MeyjK1MwQuSOUcjPfbnXKeItMkXGS',NULL,0,'Test Applicant 169','Test',NULL,'Applicant 169','2000-01-01','Sample Street','Zone II',73,'Dasmariñas','042109000','042100000','Cavite','4108','2026-10-03 17:38:44','2026-10-03 17:43:09','2026-10-03 17:38:44','verified',1,'2026-10-03 18:07:48',NULL,'2026-10-03 17:38:44','2026-10-05 13:44:49');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `verification_codes`
--

DROP TABLE IF EXISTS `verification_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `verification_codes`
--

LOCK TABLES `verification_codes` WRITE;
/*!40000 ALTER TABLE `verification_codes` DISABLE KEYS */;
/*!40000 ALTER TABLE `verification_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'pt_orig'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed
