// Where to actually get each required document or ID — shown as a "How do I get this?" disclosure
// next to the upload field, so a first-time applicant isn't left to guess. Keyed by the exact
// doc_name stored in permit_type_documents (see database/migrations/021_document_handlers.sql for
// the full list) plus the handful of extra keys BusinessForm.js uses for business registration.
export const DOCUMENT_INSTRUCTIONS = {
  'Valid Government ID': 'Any current government-issued photo ID — PhilSys/National ID, UMID, driver’s license, passport, PRC ID, postal ID, or voter’s ID. If you don’t have one yet, a PhilSys ID can be applied for at your barangay or a PSA registration center.',
  'Driver’s License': 'Apply at any LTO Licensing Center: bring a valid ID, pass the written and practical exams if this is your first license, and complete a medical and drug test. Renewals can often be done online through LTMS.',
  'DTI/SEC/CDA Registration': 'Sole proprietorships register their business name with DTI; partnerships and corporations with the SEC; cooperatives with the CDA. Apply online through the DTI Business Name Registration System, the SEC’s eSPARC, or your nearest CDA office.',
  'Business Formation Document (DTI / SEC / CDA)': 'Sole proprietorships register their business name with DTI; partnerships and corporations with the SEC; cooperatives with the CDA. Apply online through the DTI Business Name Registration System, the SEC’s eSPARC, or your nearest CDA office.',
  'BIR Certificate of Registration (Form 2303)': 'Register your business with the BIR Revenue District Office (RDO) covering your location. You’ll receive Form 2303 after submitting your business registration, a valid ID, and proof of address.',
  'Zoning Compliance Letter': 'Apply at the City Planning and Development Office (CPDO) with your lot title or lease contract and your business details, to confirm the location is zoned for your intended use.',
  'Site Plan': 'A scaled drawing of your lot showing where the building sits on it. A licensed geodetic engineer or architect can prepare one — your original property documents may already include one.',
  'Structural Drawings': 'Engineering plans signed and sealed by a licensed civil or structural engineer, showing the building’s structural design.',
  'Proof of Insurance': 'A certificate of insurance — comprehensive general liability or fire insurance, depending on what’s being covered — from any accredited insurance provider.',
  'Contractor License': 'Your contractor’s PCAB (Philippine Contractors Accreditation Board) license. Ask your contractor for a copy, or look them up on the PCAB website.',
  'Sign Drawing / Rendering': 'A scaled drawing or rendering of the proposed sign. Your signage contractor or a designer can prepare this for you.',
  'Property Owner Authorization': 'A signed letter from the property or lot owner authorizing the sign or construction, needed if you are not the owner yourself.',
  'Event Layout Map': 'A sketch or map of the event venue showing the stage, exits, seating and booths. The organizer or venue usually has one, or can help you prepare it.',
  'Event Details / Program': 'A written program or schedule for the event — date, time and the planned activities.',
  'Security/Safety Plan': 'A written plan covering crowd control, emergency exits and first-aid/fire-safety arrangements. Coordinate with the BFP and PNP for what they require.',
  'Health Permit Application': 'The City Health Office’s Health Permit Application form, available at the CHO or your barangay health center.',
  'Food Handler Certificate': 'Attend a Food Handler’s Training seminar at the City Health Office and pass the required health exam to receive your certificate.',
  'Floor Plan': 'A scaled drawing of your establishment’s interior layout. Ask your architect or engineer, or use the one submitted when the space was built or renovated.',
  'Lease Contract or Land Title': 'A signed lease agreement if you’re renting, or the land title/tax declaration if you own the property.',
  'Previous Barangay Clearance': 'Your most recently issued barangay clearance. Check your own records, or request a certified copy from your barangay hall.',
  'Previous Barangay Business Clearance': 'Your most recently issued barangay business clearance. Check your own records, or request a certified copy from your barangay hall.',
  'Lot Title or Tax Declaration': 'A Transfer Certificate of Title from the Registry of Deeds, or the latest Tax Declaration from the City Assessor’s Office.',
  'Building Plan Sketch': 'A simple drawing of the planned structure — it just needs to show the basic dimensions and layout.',
  'Vehicle OR/CR': 'The Official Receipt and Certificate of Registration of the vehicle, issued by the LTO — bring these when you apply.',
  'Proof of Ownership': 'A land title, tax declaration, or deed of sale showing you own the property.',
  'Job Offer Letter': 'A signed letter from your employer confirming the job offer, on company letterhead.',
  'First-Time Jobseeker Certificate': 'Issued by your barangay under the First-Time Jobseekers Assistance Act (RA 11261). Bring a valid government ID and a barangay clearance showing you are a first-time jobseeker — your barangay hall will issue the certificate on the same visit. It can only be claimed once.',
  'Site Sketch': 'A simple sketch showing where the work will take place relative to nearby streets or structures.',
  'Excavation Plan': 'An engineering plan for the excavation, prepared by a licensed engineer, showing depth, area and safety measures.',
  'Utility Company Authorization (if applicable)': 'A letter from the relevant utility company — water, electric or telecom — authorizing or coordinating work near their lines, if your project is near one.',
  'Demolition Plan': 'An engineering plan for the demolition, prepared by a licensed engineer, detailing the method and safety measures.',
  'Fencing Plan / Sketch': 'A simple plan or sketch of the proposed fence showing its dimensions, materials and where it sits on the lot.',
  'Certificate of Residency': 'Apply at your barangay hall with a valid ID and proof of address — most barangays issue this the same day.',
  'Mediation Records (Lupon)': 'Records from your barangay’s Lupong Tagapamayapa showing mediation was attempted. Request these from your barangay secretary.',
  'As-Built Plans': 'Plans showing the building exactly as it was constructed, prepared or certified by your architect or engineer after construction.',
  'Certificate of Completion': 'Issued by your contractor or supervising engineer, certifying the construction is finished according to the approved plans.',
  'Community Tax Certificate (Cedula)': 'Apply at your City/Municipal Treasurer’s Office or barangay hall with a valid ID — the fee depends on your income or property.',
  'Health Card': 'Apply at the City Health Office. It requires a medical exam and lab tests, plus a Food Handler’s seminar if you’ll be handling food.',
  'Previous Mayor’s / Business Permit': 'Your most recently issued Mayor’s/Business Permit. Check your own records, or request a certified copy from BPLO.',
  'Official Receipt of last year’s permit payment': 'The receipt from your last business permit payment. Check your own records, or request a copy from the City Treasurer’s Office.',
  'Certified gross sales / receipts summary (previous year)': 'A summary of your previous year’s gross sales, certified by your accountant or bookkeeper — often prepared alongside your BIR filings.',
  'Copy of Business/Mayor’s Permit': 'Your current Business/Mayor’s Permit. Check your own records, or request a certified copy from BPLO.',
  'Proof of Address': 'A recent utility bill, barangay certificate, or lease contract showing your current address.',
  'Previous Sanitary Permit': 'Your Sanitary Permit issued by the City Health Office for the previous year. If renewed on PermitTrack, this is automatically pre-listed from your earlier approved application.',
  'Previous Fire Safety Inspection Certificate': 'The Fire Safety Inspection Certificate (FSIC) issued by the BFP for your premises for the previous year. Automatically pre-listed from your earlier approved application.',
  'Previous Mayor’s Permit (Food Service)': 'Your Food Service Mayor’s Permit from the previous year, issued by BPLO. Automatically pre-listed from your earlier approved application.',
  'Previous Liquor/Tobacco License': 'Your Liquor and/or Tobacco retailing authority from the previous year, issued by BPLO. Automatically pre-listed from your earlier approved application.',
  'Previous Police Clearance': 'Your police clearance issued by the PNP for liquor/tobacco licensing from the previous year. Automatically pre-listed from your earlier approved application.',
  'Previous Market Stall/Vending Permit': 'Your public market stall lease or vending permit from the previous year. Automatically pre-listed from your earlier approved application.',
  'Official Receipt of last year’s stall fee': 'The official receipt for your market stall fee or vending permit fee from the City Treasurer’s Office.',
  'Previous Barangay Clearance for Tricycles (TODA)': 'The TODA clearance or endorsement issued by your barangay for tricycle operations from the previous year. Automatically pre-listed from your earlier approved application.',
  'Previous MTOP Permit': 'Your Motorized Tricycle Operator’s Permit (MTOP) franchise issued by BPLO for the previous year. Automatically pre-listed from your earlier approved application.',
  'Updated Driver’s License': 'Your current, valid professional driver’s license issued by the LTO.',
  'Updated Vehicle OR/CR': 'The current Official Receipt (OR) and Certificate of Registration (CR) of your tricycle, issued by the LTO.',
  'Previous Sign Permit': 'Your outdoor advertising/signboard permit from the previous year, issued by BPLO. Automatically pre-listed from your earlier approved application.',
  'Previous Building Permit': 'Your Building Permit issued by the Office of the Building Official (OBO) for the previous year. Automatically pre-listed from your earlier approved application when you renew through PermitTrack.',
  'Previous Barangay Construction Clearance': 'The Barangay Construction Clearance from your barangay, issued for the original building permit. Automatically pre-listed from your earlier approved application when you renew through PermitTrack.',

  // BusinessForm.js uses its own doc_key values rather than doc_name — these cover the ones
  // that aren't already a close match to an entry above.
  'registration': 'Sole proprietorships register their business name with DTI; partnerships and corporations with the SEC; cooperatives with the CDA. Apply online through the DTI Business Name Registration System, the SEC’s eSPARC, or your nearest CDA office.',
  'representative_id': 'Any current government-issued photo ID in your own name — PhilSys/National ID, UMID, driver’s license, passport, PRC ID, postal ID, or voter’s ID.',
  'barangay_clearance': 'Apply at the barangay hall covering your business address, with your DTI/SEC/CDA registration and a valid ID.',
  'location_proof': 'A signed lease agreement if you’re renting the space, or the land title/tax declaration if you own it.',
  'authority': 'For a partnership or corporation, ask your Corporate Secretary for a Secretary’s Certificate or Board Resolution naming you as representative. If someone other than the owner is filing for a sole proprietorship, have the owner sign a notarized Special Power of Attorney (SPA) or authorization letter instead.',
};

// A handful of document names are worded slightly differently depending on where they're quoted
// (curly vs straight apostrophe, "Driver's" vs "Driver’s"). Matching loosely on a normalized
// form means the lookup still finds the right entry either way.
function normalize(name) {
  return String(name || '').toLowerCase().replace(/[‘’']/g, '’').trim();
}

const NORMALIZED_INSTRUCTIONS = Object.fromEntries(
  Object.entries(DOCUMENT_INSTRUCTIONS).map(([name, text]) => [normalize(name), text])
);

/** Where to get a required document, or '' when nothing specific is on file for it. */
export function documentInstructions(docName) {
  return NORMALIZED_INSTRUCTIONS[normalize(docName)] || '';
}
