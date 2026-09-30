-- 014: Update the chat bot's FAQ content for the multi-office permit pipeline
-- (barangay routing, 27-type catalog, branch questions) added in migrations 008-011.
-- The matching logic itself (api/lib/chatbot.php) was updated separately to read live from
-- permit_types/permit_type_documents instead of the old 5-type hardcoded map.
--
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/014_chatbot_faq_pipeline_update.sql

USE permittrack;

UPDATE faq_entries SET
    answer = 'As a Normal User you can browse every permit type and see the documents each one requires.\nTo apply for a permit, verify your account:\n- as a Resident, for permits open to individuals (Building Permit, Fencing, Demolition, Excavation/Road-Cut, Special Event, and every barangay-only document), or\n- as a Business Owner, for business permits (Business License, Food Service, Sign, Liquor/Tobacco, MTOP/TODA, Market Stall/Vending).\nYou can be both.'
WHERE question = 'What can I do as a Normal User?';

UPDATE faq_entries SET
    answer = 'It depends on your account:\n- Verified Residents can file Building Permit, Fencing, Demolition, Excavation/Road-Cut and Special Event permits as individuals, plus every barangay-only document (personal clearances, certificates, and standalone barangay clearances).\n- Business Owners can file Business License, Food Service, Sign, Liquor/Tobacco License, MTOP/TODA and Market Stall/Vending permits for a verified business, plus Building Permit and Special Event.\nNormal Users can browse all of these but need to verify first.',
    keywords = 'which permits,what permits,permit types,kinds of permits,list of permits,available permits,can i apply,eligible,eligibility,anong permit,occupancy,fencing,demolition,excavation,liquor,tricycle,toda,market stall,barangay clearance'
WHERE question = 'Which permits can I apply for?';

UPDATE faq_entries SET
    answer = 'Open the application from your dashboard. Recent applications show a step-by-step view of which city office currently has it — starting with your Barangay, then whichever city departments that permit type needs, in order. Older applications show the original 5-step tracker (Submitted → Under Review → Inspection Scheduled → Inspector Notes → Approved) instead.'
WHERE question = 'How do I track my application?';

UPDATE faq_entries SET
    answer = 'For newer applications, the detail page lists every office in order (starting with your Barangay) and shows which one currently has your application. For older applications, the 5-step tracker still applies:\n- Submitted: received, waiting for a reviewer\n- Under Review: a reviewer is checking your documents\n- Inspection Scheduled: an on-site inspection is planned\n- Inspector Notes: the inspector left notes — check the activity log\n- Approved: your permit is issued\nIf a document is marked "Needs Re-upload", upload a new copy from the application page.'
WHERE question = 'What do the application statuses mean?';

INSERT IGNORE INTO faq_entries (category, question, answer, keywords, link_path, link_label, sort_order) VALUES
('Permits', 'How does the permit review process work?',
 'Most permits pass through more than one city office, in order — usually starting with your Barangay, then whichever offices that permit type needs (for example Zoning, then the Building Official, then the Treasurer). Each office has to clear its stage before the next one can act. Your application''s detail page shows exactly which office has it right now.',
 'how does review work,pipeline,multiple offices,which office,barangay first,review process,stages,steps in review,how long does each office take', NULL, NULL, 95),

('Permits', 'Why do I need to answer extra questions when applying?',
 'Some permits ask a couple of yes/no questions at submission — for example whether your project is inside a subdivision, or whether food will be manufactured for resale. Answering "yes" routes your application through an extra office that needs to review that specific condition. Answer honestly: if a condition you didn''t declare turns out to apply, your permit can be voided.',
 'extra questions,qualifying questions,yes no questions,why asking,branch question,condition,void,voided,undeclared,subdivision,manufactured,alcohol served', NULL, NULL, 96),

('Permits', 'What are barangay clearances?',
 'Some documents are issued directly by your Barangay and never reach City Hall — for example a Certificate of Residency, Certificate of Indigency, a personal Barangay Clearance, or a First-Time Jobseeker Certificate. These are only available to verified Residents, and they''re separate from the barangay step that''s automatically included as stage one of a bigger permit like a Building Permit.',
 'barangay clearance,barangay document,barangay certificate,standalone barangay,certificate of residency,certificate of indigency,first time jobseeker,good moral character,barangay only', '/applications/new', 'See barangay documents', 97),

('Resident', 'Why does my barangay matter?',
 'Your barangay is selected when you verify your residency (or, for a business, its registered address). It determines which Barangay office reviews the barangay stage of your permits and any barangay-only documents you request — Dasmariñas has 75 barangays, each with its own office.',
 'barangay,which barangay,my barangay,barangay matter,why barangay,select barangay,75 barangays', NULL, NULL, 25);
