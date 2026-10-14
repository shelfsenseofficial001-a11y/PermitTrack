// Checks that an uploaded ID photo actually reads like a Philippine government ID, not just any
// picture with a face in it. Runs OCR on the photo entirely in the browser (Tesseract.js, also
// from a CDN) and looks for the wording genuine PH government IDs carry — agency names, program
// names, abbreviations. It is a sanity check, not forgery detection: it catches "that's not an ID
// at all" and "wrong document", not a well-made fake. Paired with the face/liveness check in
// faceVerify.js, which is what actually ties the document to the person holding it.

const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

let tesseractLoadPromise = null;

function loadTesseractScript() {
  if (!tesseractLoadPromise) {
    tesseractLoadPromise = new Promise((resolve, reject) => {
      if (window.Tesseract) { resolve(window.Tesseract); return; }
      const existing = document.querySelector(`script[src="${TESSERACT_SRC}"]`);
      if (existing) { existing.addEventListener('load', () => resolve(window.Tesseract)); return; }
      const el = document.createElement('script');
      el.src = TESSERACT_SRC;
      el.onload = () => resolve(window.Tesseract);
      el.onerror = () => reject(new Error('Could not load ID verification. Check your internet connection and try again.'));
      document.head.appendChild(el);
    }).catch((e) => { tesseractLoadPromise = null; throw e; });
  }
  return tesseractLoadPromise;
}

/** The raw OCR text Tesseract reads off an image — noisy, uppercase/lowercase mixed, as printed. */
export async function readIdText(image) {
  const Tesseract = await loadTesseractScript();
  const { data } = await Tesseract.recognize(image, 'eng');
  return data.text || '';
}

// Any one of these appearing is enough — each is specific enough to a real PH government ID
// that a random photo or an unrelated document is very unlikely to contain it. Listed as the
// issuing agency's name or the ID program's name, in whichever form is usually printed, so OCR
// only has to get one recognizable chunk right rather than an exact phrase.
const PH_ID_MARKERS = [
  'REPUBLIKA NG PILIPINAS',
  'REPUBLIC OF THE PHILIPPINES',
  'PAMBANSANG PAGKAKAKILANLAN',
  'PHILIPPINE IDENTIFICATION',
  'PHILSYS',
  'LAND TRANSPORTATION OFFICE',
  'DRIVERS LICENSE',
  'NON PROFESSIONAL',
  'UNIFIED MULTI PURPOSE',
  'UMID',
  'SOCIAL SECURITY SYSTEM',
  'GOVERNMENT SERVICE INSURANCE SYSTEM',
  'GSIS',
  'DEPARTMENT OF FOREIGN AFFAIRS',
  'PASAPORTE',
  'COMMISSION ON ELECTIONS',
  'COMELEC',
  'PROFESSIONAL REGULATION COMMISSION',
  'PHILIPPINE POSTAL CORPORATION',
  'PHLPOST',
  'NATIONAL BUREAU OF INVESTIGATION',
  'PHILIPPINE NATIONAL POLICE',
  'BUREAU OF INTERNAL REVENUE',
  'PHILHEALTH',
  'PAGIBIG',
  'HOME DEVELOPMENT MUTUAL FUND',
  'OFFICE OF SENIOR CITIZEN',
  'PERSON WITH DISABILITY',
  'KAGAWARAN NG',
  'PAMAHALAANG',
];

/** Strips accents/punctuation and collapses whitespace, so OCR noise doesn't break a substring match. */
function normalizeOcrText(text) {
  return text
    .toUpperCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True once any known PH government ID marker is found in the OCR'd text of the photo. */
export function looksLikePhilippineGovernmentId(rawText) {
  const normalized = normalizeOcrText(rawText);
  return PH_ID_MARKERS.some((marker) => normalized.includes(marker));
}
