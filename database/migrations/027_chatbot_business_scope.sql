-- ---------------------------------------------------------------------------
-- 027 — Chatbot answers for the business-scope reframing and permit renewal
--
-- Three entries drifted from the code: #6 and #7 were rewritten when business
-- registration was reframed (PermitTrack records a business that already
-- exists; it does not form one), and the renewal entry was added with the
-- Business Permit Renewal permit. All three were applied straight to the
-- running database, so a fresh install was missing them — this is that change,
-- written down.
--
-- Tagalog is kept in step with the English: 20 of 21 entries carry it, and
-- updating only one side would have the assistant answer Tagalog speakers with
-- the old story.
--
-- Idempotent: the updates are keyed by id, and the new entry is only inserted
-- if its question is not already there.
-- ---------------------------------------------------------------------------

UPDATE faq_entries SET question = 'How do I add my business to PermitTrack?',
       answer = 'PermitTrack does not create businesses. Forming one happens at the DTI (sole proprietorship), SEC (partnership or corporation) or CDA (cooperative). What you do here is put a business you already run on record, so the city can check it is real and you can file its permits.
Choose "Add your business" on your dashboard and fill in:
- business details (registered name, ownership type, line of business, DTI/SEC/CDA number, TIN),
- the business location — the barangay it operates in, chosen from the list,
- your role and government ID,
- the required documents.
Once City Staff verify it against your registration certificate, you can apply for and renew business permits for it. You can add more than one business.',
       question_tl = 'Paano ko maidadagdag ang negosyo ko sa PermitTrack?',
       answer_tl = 'Hindi gumagawa ng negosyo ang PermitTrack. Ang pagbuo nito ay sa DTI (sole proprietorship), SEC (partnership o corporation), o CDA (cooperative). Ang ginagawa mo rito ay itala ang negosyong pinapatakbo mo na, para makumpirma ng lungsod na totoo ito at makapag-file ka ng mga permit nito.
Piliin ang "Add your business" sa iyong dashboard at punan ang:
- detalye ng negosyo (rehistradong pangalan, ownership type, linya ng negosyo, DTI/SEC/CDA number, TIN),
- lokasyon ng negosyo — ang barangay kung saan ito nag-ooperate, piliin mula sa listahan,
- iyong role at government ID,
- kinakailangang dokumento.
Kapag na-verify na ng City Staff laban sa iyong registration certificate, maaari ka nang mag-apply at mag-renew ng business permits para rito. Maaari kang magdagdag ng higit sa isang negosyo.',
       updated_at = NOW()
 WHERE id = 6;

UPDATE faq_entries SET question = 'What documents do I need to register a business?',
       answer = 'These prove the business already exists and that you are the one who runs it:
- its registration certificate — DTI (sole proprietorship), SEC (partnership or corporation) or CDA (cooperative)
- your primary government ID (the name must match the registration)
- a Barangay Business Clearance
- proof of the business location (lease contract, land title or tax declaration)
Partnerships, corporations and cooperatives also need a Secretary''s Certificate or Board Resolution naming you. If you''re not the owner of a sole proprietorship, add an SPA or authorization letter.
PermitTrack only records these — it does not issue any of them.',
       question_tl = 'Anong mga dokumento ang kailangan ko para maitala ang negosyo ko?',
       answer_tl = 'Ito ang patunay na umiiral na ang negosyo at ikaw ang nagpapatakbo nito:
- rehistrasyon certificate — DTI (sole proprietorship), SEC (partnership o corporation), o CDA (cooperative)
- pangunahing government ID mo (dapat magkatugma ang pangalan sa rehistrasyon)
- Barangay Business Clearance
- patunay ng lokasyon ng negosyo (lease contract, land title, o tax declaration)
Ang partnership, corporation, at cooperative ay kailangan din ng Secretary''s Certificate o Board Resolution na nagpapangalan sa iyo. Kung ikaw ay hindi ang may-ari ng sole proprietorship, magdagdag ng SPA o authorization letter.
Itinatala lang ng PermitTrack ang mga ito — hindi ito ang nag-iisyu ng alinman sa kanila.',
       updated_at = NOW()
 WHERE id = 7;

INSERT INTO faq_entries (category, question, answer, question_tl, answer_tl, keywords, link_path, link_label, sort_order, is_active, created_at, updated_at)
SELECT 'Business', 'When do I renew my business permit?', 'Business permits lapse on 31 December. Renewal runs from 1 to 20 January every year — renewing after that adds a 25% surcharge plus 2% interest per month on the local business tax.
File it here as "Business Permit Renewal". It goes to the barangay first, then BPLO assesses your gross receipts, the Health Office renews the Sanitary Permit and staff health cards, the Bureau of Fire Protection re-inspects, you pay at the Treasurer, and BPLO re-issues the Mayor''s Permit.
Have ready: last year''s Mayor''s Permit and its official receipt, your previous Barangay Business Clearance, and a certified summary of last year''s gross sales.
Your DTI or SEC registration is not part of this — DTI runs five years and SEC does not expire.', 'Kailan ko dapat i-renew ang business permit ko?', 'Nag-e-expire ang business permit tuwing Disyembre 31. Ang renewal ay mula Enero 1 hanggang 20 bawat taon — kapag lumagpas ka roon, may 25% surcharge at 2% interes kada buwan sa local business tax.
I-file ito rito bilang "Business Permit Renewal". Dadaan ito sa barangay muna, susuriin ng BPLO ang iyong gross receipts, bibigyan ng Health Office ng bagong Sanitary Permit at health cards ng mga tauhan, iinspeksyunin muli ng Bureau of Fire Protection, magbabayad ka sa Treasurer, at muling i-iisyu ng BPLO ang Mayor''s Permit.
Ihanda: ang Mayor''s Permit noong nakaraang taon at ang opisyal na resibo nito, ang dati mong Barangay Business Clearance, at sertipikadong buod ng gross sales noong nakaraang taon.
Hindi kasama rito ang DTI o SEC registration mo — limang taon ang DTI at hindi nag-e-expire ang SEC.', 'renew, renewal, business permit, mayor permit, january, expire, surcharge, deadline', '/applications/new', 'File a renewal', 61, 1, NOW(), NOW()
  FROM (SELECT 1) AS one
 WHERE NOT EXISTS (SELECT 1 FROM faq_entries f WHERE f.question = 'When do I renew my business permit?');

-- 005 seeds the FAQ with INSERT IGNORE, which is idempotent only because `question` is unique.
-- Renaming #6 above frees its old text, so a later re-run of 005 would happily insert the old
-- entry again as a new row. Clearing it here — after the rename — keeps a full re-run of the
-- migration set landing on the same 21 entries rather than growing one each time.
DELETE FROM faq_entries
 WHERE question = 'How do I register a business?'
   AND id <> 6;
