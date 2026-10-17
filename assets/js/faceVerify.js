// Client-side face verification: confirms a live selfie matches the face in an uploaded ID
// photo, so a submitted ID can be trusted to actually belong to the person submitting it.
// Runs entirely in the browser via face-api.js — the photo and the selfie never leave the
// device for this check, no account or API key needed, and nothing is billed per use.

const FACE_API_SRC = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
// justadudewhohacks/face-api.js-models (the usual source) keeps each net's weights in its own
// subfolder and the whole repo trips jsDelivr's 50 MB GitHub-proxy cap, so loadFromUri can't
// fetch it as one flat directory. @vladmandic/face-api ships the same net architectures with
// every model's files flattened into one npm-published folder, which loadFromUri needs.
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';

// Relaxed from the original 0.45 — still tighter than face-api.js's default 0.6, but
// generous enough to accommodate typical ID-photo-to-selfie lighting/angle differences.
// Lower distance is a closer match.
export const FACE_MATCH_THRESHOLD = 0.55;

let loadPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.faceapi) { resolve(); return; }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Could not load face verification. Check your internet connection and try again.'));
    document.head.appendChild(el);
  });
}

/** Loads face-api.js and its models once; safe to call repeatedly — later calls reuse the first load. */
export function loadFaceApi() {
  if (!loadPromise) {
    loadPromise = loadScript(FACE_API_SRC).then(async () => {
      const faceapi = window.faceapi;
      await Promise.all([
        // SsdMobilenetv1 for the actual identity decision: TinyFaceDetector is built for speed
        // and gives loose, poorly-aligned face boxes, which was letting different people's
        // descriptors land closer together than they should.
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        // TinyFaceDetector again here, but for live tracking during the blink check — several
        // reads a second, where its speed matters and its looser boxes are good enough.
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      ]);
      return faceapi;
    }).catch((e) => {
      loadPromise = null; // let the next attempt retry instead of staying stuck on a dropped connection
      throw e;
    });
  }
  return loadPromise;
}

/** The single face's descriptor in an image/video/canvas, or null if no face is clearly visible. */
export async function detectFaceDescriptor(input) {
  const faceapi = await loadFaceApi();
  const result = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result ? result.descriptor : null;
}

/** Distance between two face descriptors — at or under FACE_MATCH_THRESHOLD counts as a match. */
export function faceDistance(a, b) {
  return window.faceapi.euclideanDistance(a, b);
}

// ---------------------------------------------------------------------------------------------
// Liveness: a face matching the ID photo isn't proof a live person is at the camera — a printed
// photo or a phone screen held up to it matches too. Requiring the person to turn their head
// to the side rules that out: a flat photo or screen cannot change its viewing angle on cue.
// ---------------------------------------------------------------------------------------------

/**
 * Estimates horizontal head rotation (yaw) from a live video frame.
 *
 * Returns a signed offset in inter-eye-width units:
 *   ~  0.00  → facing straight at the camera
 *   > +0.20  → turned noticeably to one side
 *   < -0.20  → turned noticeably to the other side
 *   null     → no face detected in this frame
 *
 * Method: nose tip (landmark 30) displacement from the midpoint between the outer
 * eye corners (36 = left outer, 45 = right outer), normalised by inter-eye distance.
 * Geometrically robust across webcam resolutions and lighting conditions.
 * Uses TinyFaceDetector — speed matters here; we only need pose, not identity.
 */
export async function detectHeadYaw(video) {
  const faceapi = await loadFaceApi();
  const result = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
    .withFaceLandmarks();
  if (!result) return null;
  const lm       = result.landmarks.positions;
  const leftOuter  = lm[36];   // outer corner of the left eye
  const rightOuter = lm[45];   // outer corner of the right eye
  const noseTip    = lm[30];
  const eyeMidX    = (leftOuter.x + rightOuter.x) / 2;
  const interEye   = Math.abs(rightOuter.x - leftOuter.x);
  if (interEye === 0) return null;
  return (noseTip.x - eyeMidX) / interEye;
}
