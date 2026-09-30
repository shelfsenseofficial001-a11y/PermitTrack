-- 015: Tagalog translations for the chat bot's FAQ content.
-- question_tl/answer_tl are nullable — a missing translation falls back to English (api/lib/chatbot.php).
--
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/015_chatbot_language.sql

USE permittrack;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'faq_entries' AND COLUMN_NAME = 'question_tl');
SET @sql := IF(@col = 0, 'ALTER TABLE faq_entries ADD COLUMN question_tl VARCHAR(255) NULL AFTER question', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'faq_entries' AND COLUMN_NAME = 'answer_tl');
SET @sql := IF(@col = 0, 'ALTER TABLE faq_entries ADD COLUMN answer_tl TEXT NULL AFTER answer', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE faq_entries SET question_tl = 'Ano ang magagawa ko bilang Normal User?', answer_tl =
'Bilang isang Normal User, maaari mong tingnan ang lahat ng uri ng permit at makita ang mga dokumentong kailangan ng bawat isa.\nUpang makapag-apply ng permit, i-verify muna ang iyong account:\n- bilang Resident, para sa mga permit na maaaring i-file ng indibidwal (Building Permit, Fencing, Demolition, Excavation/Road-Cut, Special Event, at lahat ng barangay-only na dokumento), o\n- bilang Business Owner, para sa mga business permit (Business License, Food Service, Sign, Liquor/Tobacco, MTOP/TODA, Market Stall/Vending).\nPwede kang maging pareho.'
WHERE question = 'What can I do as a Normal User?';

UPDATE faq_entries SET question_tl = 'Paano ako maging verified Resident?', answer_tl =
'Buksan ang "Become a Resident" sa iyong dashboard, pagkatapos:\n- i-verify ang iyong email at mobile number,\n- kumpirmahin ang iyong address,\n- mag-upload ng dalawang magkaibang uri ng proof of residence,\n- lagyan ng check ang deklarasyon at i-submit.\nSusuriin ito ng City Staff at maaabisuhan ka sa pamamagitan ng email o SMS.'
WHERE question = 'How do I become a verified Resident?';

UPDATE faq_entries SET question_tl = 'Anong mga dokumento ang tinatanggap bilang proof of residence?', answer_tl =
'Mag-upload ng dalawang magkaibang dokumentong nagpapakita ng iyong pangalan at address:\n- Barangay Certificate of Residency (ibinigay sa loob ng 180 araw)\n- Utility bill — kuryente, tubig, o internet (sa loob ng 90 araw)\n- Bank o credit card statement (sa loob ng 90 araw)\n- Lease o rental contract\n- Land title o tax declaration\n- Voter\'s ID o Voter\'s Certification\n- Driver\'s license, National ID (PhilSys), o Postal ID na may address mo\nPwedeng PDF, JPG, PNG, o WEBP ang file, hanggang 5 MB bawat isa.'
WHERE question = 'What documents count as proof of residence?';

UPDATE faq_entries SET question_tl = 'Gaano katagal ang verification?', answer_tl =
'Karaniwang sinusuri ng City Staff ang resident at business verification sa loob ng ilang araw ng trabaho. Makakatanggap ka ng email o SMS kapag may desisyon na, at makikita rin sa iyong dashboard ang kasalukuyang status.'
WHERE question = 'How long does verification take?';

UPDATE faq_entries SET question_tl = 'Na-reject ang aking verification. Ano ang gagawin ko?', answer_tl =
'Buksan ang item sa iyong dashboard — makikita sa itaas ang dahilan mula sa City Staff. Ayusin ang isyu (halimbawa, mag-upload ng mas bagong bill o dokumentong nasa pangalan mo) at i-submit muli. Para sa business, kailangan mo lang i-upload ulit ang mga dokumentong binago.'
WHERE question = 'My verification was rejected. What now?';

UPDATE faq_entries SET question_tl = 'Paano ako magrehistro ng negosyo?', answer_tl =
'Piliin ang "Register a business" sa iyong dashboard at punan ang:\n- detalye ng negosyo (rehistradong pangalan, ownership type, linya ng negosyo, DTI/SEC/CDA number, TIN),\n- lokasyon ng negosyo,\n- iyong role at government ID,\n- kinakailangang dokumento.\nKapag na-verify na ng City Staff, maaari ka nang mag-apply ng business permits para sa negosyong iyon. Maaari kang magrehistro ng higit sa isang negosyo.'
WHERE question = 'How do I register a business?';

UPDATE faq_entries SET question_tl = 'Anong mga dokumento ang kailangan ko para magrehistro ng negosyo?', answer_tl =
'Kailangan ng bawat negosyo:\n- rehistrasyon certificate — DTI (sole proprietorship), SEC (partnership o corporation), o CDA (cooperative)\n- pangunahing government ID mo (dapat magkatugma ang pangalan sa rehistrasyon)\n- Barangay Business Clearance\n- patunay ng lokasyon ng negosyo (lease contract, land title, o tax declaration)\nAng partnership, corporation, at cooperative ay kailangan din ng Secretary\'s Certificate o Board Resolution na nagpapangalan sa iyo. Kung ikaw ay hindi ang may-ari ng sole proprietorship, magdagdag ng SPA o authorization letter.'
WHERE question = 'What documents do I need to register a business?';

UPDATE faq_entries SET question_tl = 'Anong mga permit ang maaari kong i-apply?', answer_tl =
'Depende ito sa iyong account:\n- Ang verified Residents ay maaaring mag-file ng Building Permit, Fencing, Demolition, Excavation/Road-Cut, at Special Event permits bilang indibidwal, pati na rin ang lahat ng barangay-only na dokumento (personal clearances, certificates, at standalone barangay clearances).\n- Ang Business Owners ay maaaring mag-file ng Business License, Food Service, Sign, Liquor/Tobacco License, MTOP/TODA, at Market Stall/Vending permits para sa verified na negosyo, pati na rin ang Building Permit at Special Event.\nMaaaring tingnan ng Normal Users ang lahat ng ito ngunit kailangan munang mag-verify.'
WHERE question = 'Which permits can I apply for?';

UPDATE faq_entries SET question_tl = 'Paano ko masusubaybayan ang aking aplikasyon?', answer_tl =
'Buksan ang aplikasyon mula sa iyong dashboard. Ang mas bagong aplikasyon ay nagpapakita ng step-by-step na view kung saang opisina kasalukuyang nakatalaga ito — mula sa iyong Barangay, tapos sa mga opisina ng lungsod na kailangan ng permit na iyon, ayon sa pagkakasunod-sunod. Ang mas lumang aplikasyon ay nagpapakita pa rin ng orihinal na 5-step tracker (Submitted → Under Review → Inspection Scheduled → Inspector Notes → Approved).'
WHERE question = 'How do I track my application?';

UPDATE faq_entries SET question_tl = 'Ano ang ibig sabihin ng mga status ng aplikasyon?', answer_tl =
'Para sa mas bagong aplikasyon, ang detail page ay naglilista ng bawat opisina ayon sa pagkakasunod-sunod (simula sa iyong Barangay) at ipinapakita kung sino ang may hawak ngayon ng iyong aplikasyon. Para sa mas lumang aplikasyon, ganito pa rin ang 5-step tracker:\n- Submitted: natanggap na, naghihintay ng reviewer\n- Under Review: sinusuri ng reviewer ang iyong mga dokumento\n- Inspection Scheduled: may naka-iskedyul na on-site inspection\n- Inspector Notes: may naiwang notes ang inspector — tingnan ang activity log\n- Approved: naibigay na ang iyong permit\nKung may dokumentong naka-mark na "Needs Re-upload", mag-upload ng bago mula sa application page.'
WHERE question = 'What do the application statuses mean?';

UPDATE faq_entries SET question_tl = 'Paano gumagana ang proseso ng pagsusuri ng permit?', answer_tl =
'Karamihan sa mga permit ay dumadaan sa higit sa isang opisina ng lungsod, ayon sa pagkakasunod-sunod — kadalasan magsisimula sa iyong Barangay, pagkatapos sa mga opisinang kailangan ng permit na iyon (halimbawa Zoning, tapos ang Building Official, tapos ang Treasurer). Kailangang tapusin muna ng bawat opisina ang kanilang stage bago makagalaw ang susunod. Makikita sa detail page ng iyong aplikasyon kung sinong opisina ang may hawak ngayon.'
WHERE question = 'How does the permit review process work?';

UPDATE faq_entries SET question_tl = 'Bakit kailangan kong sagutin ang mga karagdagang tanong kapag nag-a-apply?', answer_tl =
'May ilang permit na nagtatanong ng ilang yes/no na tanong sa oras ng pag-submit — halimbawa kung ang proyekto mo ay nasa loob ng subdivision, o kung gagawa ng pagkain para ibenta pa. Ang pagsagot ng "yes" ay magpapadaan sa iyong aplikasyon sa karagdagang opisina na kailangang suriin ang kondisyong iyon. Sagutin nang tapat: kung may kondisyong hindi mo idineklara na lumabas na totoo pala, maaaring ma-void ang iyong permit.'
WHERE question = 'Why do I need to answer extra questions when applying?';

UPDATE faq_entries SET question_tl = 'Ano ang mga barangay clearance?', answer_tl =
'May ilang dokumento na direktang inilalabas ng iyong Barangay at hindi na umaabot sa City Hall — halimbawa ang Certificate of Residency, Certificate of Indigency, personal na Barangay Clearance, o First-Time Jobseeker Certificate. Ito ay para lamang sa verified Residents, at hiwalay ito sa barangay step na awtomatikong kasama bilang unang hakbang ng mas malaking permit tulad ng Building Permit.'
WHERE question = 'What are barangay clearances?';

UPDATE faq_entries SET question_tl = 'Bakit mahalaga ang aking barangay?', answer_tl =
'Pinipili ang iyong barangay kapag ni-verify mo ang iyong residency (o, para sa negosyo, ang rehistradong address nito). Ito ang magtatakda kung aling opisina ng Barangay ang susuri sa barangay stage ng iyong mga permit at anumang barangay-only na dokumento na hihilingin mo — may 75 barangay ang Dasmariñas, bawat isa ay may sariling opisina.'
WHERE question = 'Why does my barangay matter?';

UPDATE faq_entries SET question_tl = 'Hindi ko natanggap ang aking verification code', answer_tl =
'Ipinapadala ang code sa email o mobile number na inilagay mo at mag-e-expire ito pagkalipas ng 10 minuto.\n- Tingnan ang iyong spam o promotions folder.\n- Siguraduhing tama ang number o email.\n- Maghintay ng isang minuto, pagkatapos i-tap ang "Resend code".\nMaaari kang humiling ng hanggang 8 code kada oras.'
WHERE question = 'I didn''t receive my verification code';

UPDATE faq_entries SET question_tl = 'Paano ko babaguhin ang aking password?', answer_tl =
'Gamitin ang "Password" na link sa itaas ng anumang page pagkatapos mong mag-sign in. Kung nakalimutan mo ang iyong password, makipag-ugnayan sa city office — maaaring magbigay ang Admin ng temporary password na babaguhin mo sa susunod mong pag-sign in.'
WHERE question = 'How do I change my password?';

UPDATE faq_entries SET question_tl = 'Paano ko idadagdag o babaguhin ang aking email o mobile number?', answer_tl =
'Kung walang email o mobile number ang iyong account, idagdag ito sa "Become a Resident" page — magpapadala kami ng code para kumpirmahin ito. Para baguhin ang contact na verified na, mangyaring makipag-ugnayan sa city office.'
WHERE question = 'How do I add or change my email or mobile number?';

UPDATE faq_entries SET question_tl = 'Ligtas ba ang aking personal na impormasyon?', answer_tl =
'Ang iyong mga dokumento ay iniimbak nang pribado at maaari lamang makita ng ikaw at ng City Staff. Kinokolekta namin ang iyong impormasyon para lamang iproseso ang iyong account at mga permit, alinsunod sa Data Privacy Act of 2012 (RA 10173).'
WHERE question = 'Is my personal information safe?';

UPDATE faq_entries SET question_tl = 'May mga bayarin ba, at paano ako magbabayad?', answer_tl =
'Ang mga bayarin sa permit ay tinatasa ng opisinang humahawak sa iyong aplikasyon kapag naisuri na ito. Wala pang online payment — sasabihin sa iyo ng opisina kung paano at saan magbabayad.'
WHERE question = 'Are there fees, and how do I pay?';

UPDATE faq_entries SET question_tl = 'Paano ako makikipag-ugnayan sa city office?', answer_tl =
'Para sa mga tanong na hindi masagot ng assistant, mangyaring bisitahin o tawagan ang city hall sa oras ng opisina (Lunes hanggang Biyernes, 8:00 AM – 5:00 PM). Maaari mo ring i-message ang reviewer mula sa iyong application page.'
WHERE question = 'How do I contact the city office?';
