-- 005: Built-in FAQ chat bot (prototype). Answers are editable by Admins; questions are logged
-- so Admins can see what the bot couldn't answer and add FAQ entries for it.
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/005_chatbot.sql

USE permittrack;

CREATE TABLE IF NOT EXISTS faq_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(40) NOT NULL DEFAULT 'General',
    question VARCHAR(255) NOT NULL,            -- shown as a suggestion chip
    answer TEXT NOT NULL,                      -- plain text; lines starting with "- " become bullets
    keywords VARCHAR(600) NOT NULL DEFAULT '', -- comma-separated words/phrases that point to this answer
    link_path VARCHAR(120) NULL,               -- optional in-app page, e.g. /residency
    link_label VARCHAR(60) NULL,
    sort_order INT NOT NULL DEFAULT 100,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_faq_question (question)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    message VARCHAR(500) NOT NULL,
    matched_faq_id INT NULL,       -- NULL = the bot didn't find an answer
    intent VARCHAR(40) NULL,       -- faq | permit_requirements | my_status | greeting | fallback
    score DECIMAL(6,2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_chat_unanswered (matched_faq_id, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (matched_faq_id) REFERENCES faq_entries(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO faq_entries (category, question, answer, keywords, link_path, link_label, sort_order) VALUES
('Account', 'What can I do as a Normal User?',
 'As a Normal User you can browse every permit type and see the documents it requires.\nTo apply for a permit, verify your account:\n- as a Resident (for permits like Building/Renovation and Special Event), or\n- as a Business Owner (for Business License, Food Service and Sign permits).\nYou can be both.',
 'normal user,what can i do,browse,cannot apply,can''t apply,cant apply,why can''t i apply,apply button,locked,level,account level,label', '/dashboard', 'Go to my dashboard', 10),

('Resident', 'How do I become a verified Resident?',
 'Open "Become a Resident" on your dashboard, then:\n- verify both your email and mobile number,\n- confirm your address,\n- upload two proofs of residence of different types,\n- tick the declaration and submit.\nCity Staff checks your documents and you''ll be notified by email or SMS.',
 'resident,residency,become resident,verify resident,verified resident,proof of residence,residente,paano maging residente,how to apply resident', '/residency', 'Start resident verification', 20),

('Resident', 'What documents count as proof of residence?',
 'Upload two different documents that show your name and address:\n- Barangay Certificate of Residency (issued within 180 days)\n- Utility bill — electricity, water or internet (within 90 days)\n- Bank or credit card statement (within 90 days)\n- Lease or rental contract\n- Land title or tax declaration\n- Voter''s ID or Voter''s Certification\n- Driver''s license, National ID (PhilSys) or Postal ID with your address\nFiles can be PDF, JPG, PNG or WEBP, up to 5 MB each.',
 'proof,proofs,proof of residence,accepted documents,what documents resident,utility bill,barangay certificate,billing,bill,lease,voter,cedula,patunay,katibayan', '/residency', 'Upload my proofs', 30),

('Verification', 'How long does verification take?',
 'City Staff usually reviews resident and business verifications within a few working days. You''ll get an email or SMS as soon as a decision is made, and your dashboard shows the current status.',
 'how long,how many days,waiting,pending,still pending,under review,review time,gaano katagal,matagal,when will,approved yet', NULL, NULL, 40),

('Verification', 'My verification was rejected. What now?',
 'Open the item on your dashboard — the reason from City Staff is shown at the top. Fix the issue (for example, upload a newer bill or a document in your name) and submit again. For businesses you only need to re-upload the documents that changed.',
 'rejected,denied,not approved,declined,failed,resubmit,try again,why rejected,na-reject,hindi naaprubahan', '/dashboard', 'Go to my dashboard', 50),

('Business', 'How do I register a business?',
 'Choose "Register a business" on your dashboard and fill in:\n- business details (registered name, ownership type, line of business, DTI/SEC/CDA number, TIN),\n- the business location,\n- your role and government ID,\n- the required documents.\nOnce City Staff verifies it, you can apply for business permits for that business. You can register more than one business.',
 'register business,business,negosyo,add business,new business,business owner,company,store,shop,how to register business,business account', '/businesses/new', 'Register a business', 60),

('Business', 'What documents do I need to register a business?',
 'Every business needs:\n- its registration certificate — DTI (sole proprietorship), SEC (partnership or corporation) or CDA (cooperative)\n- your primary government ID (the name must match the registration)\n- a Barangay Business Clearance\n- proof of the business location (lease contract, land title or tax declaration)\nPartnerships, corporations and cooperatives also need a Secretary''s Certificate or Board Resolution naming you. If you''re not the owner of a sole proprietorship, add an SPA or authorization letter.',
 'business documents,business requirements,dti,sec,cda,tin,secretary''s certificate,board resolution,spa,barangay clearance,business clearance,requirements business', '/businesses/new', 'Register a business', 70),

('Permits', 'Which permits can I apply for?',
 'It depends on your account:\n- Verified Residents can file Building/Renovation and Special Event permits as individuals.\n- Business Owners can file Business License, Food Service, Sign, Building/Renovation and Special Event permits for a verified business.\nNormal Users can browse permits but need to verify first.',
 'which permits,what permits,permit types,kinds of permits,list of permits,available permits,can i apply,eligible,eligibility,anong permit', '/applications/new', 'See permits', 80),

('Permits', 'How do I track my application?',
 'Your dashboard shows each application with a 5-step tracker: Submitted → Under Review → Inspection Scheduled → Inspector Notes → Approved. Open an application to see its documents, the activity log, and messages from the reviewer.',
 'track,tracking,status,application status,where is my application,progress,update on my permit,follow up,nasaan,estado', '/dashboard', 'Go to my dashboard', 90),

('Permits', 'What do the application statuses mean?',
 '- Submitted: received, waiting for a reviewer\n- Under Review: a reviewer is checking your documents\n- Inspection Scheduled: an on-site inspection is planned\n- Inspector Notes: the inspector left notes — check the activity log\n- Approved: your permit is issued\nIf a document is marked "Needs Re-upload", upload a new copy from the application page.',
 'statuses,status meaning,what does submitted mean,under review mean,inspection scheduled,inspector notes,needs re-upload,reupload,re-upload', NULL, NULL, 100),

('Account', 'I didn''t receive my verification code',
 'Codes are sent to the email or mobile number you entered and expire after 10 minutes.\n- Check your spam or promotions folder.\n- Make sure the number or email is correct.\n- Wait a minute, then tap "Resend code".\nYou can request up to 8 codes per hour.',
 'code,otp,verification code,didn''t receive,did not receive,no code,no sms,no email,resend,one time,walang code,hindi dumating', NULL, NULL, 110),

('Account', 'How do I change my password?',
 'Use the "Password" link at the top of any page after you sign in. If you forgot your password, contact the city office — an Admin can give you a temporary password that you''ll change when you next sign in.',
 'password,change password,forgot password,reset password,forgot,nakalimutan,can''t log in,cannot login,login problem', '/account/password', 'Change my password', 120),

('Account', 'How do I add or change my email or mobile number?',
 'If your account is missing an email or a mobile number, add it on the "Become a Resident" page — we''ll send a code to confirm it. To change a contact that''s already verified, please contact the city office.',
 'change email,change number,change mobile,update email,update phone,add email,add mobile,phone number,cellphone,cp number,contact details', '/residency', 'Open my contacts', 130),

('General', 'Is my personal information safe?',
 'Your documents are stored privately and can only be viewed by you and City Staff. We collect your information only to process your account and permits, in line with the Data Privacy Act of 2012 (RA 10173).',
 'privacy,data privacy,safe,secure,security,who can see,personal information,my data,ra 10173,datos', NULL, NULL, 140),

('General', 'Are there fees, and how do I pay?',
 'Permit fees are assessed by the office handling your application once it''s reviewed. Online payment isn''t available yet — the office will tell you how and where to pay.',
 'fee,fees,cost,how much,payment,pay,price,bayad,magkano,charges', NULL, NULL, 150),

('General', 'How do I contact the city office?',
 'For questions the assistant can''t answer, please visit or call the city hall during office hours (Monday to Friday, 8:00 AM – 5:00 PM). You can also message the reviewer from your application page.',
 'contact,office,phone,call,hotline,email the office,office hours,city hall,visit,talk to a person,human,agent,staff', NULL, NULL, 160);
