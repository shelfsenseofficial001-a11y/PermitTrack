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

// Stricter than face-api.js's usual 0.6 "same person" cutoff — 0.6 is loose enough to accept
// two different people often enough to matter here. Lower distance is a closer match.
export const FACE_MATCH_THRESHOLD = 0.45;

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
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }))
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
// photo or a phone screen held up to it matches too. Requiring a real blink before the selfie is
// captured rules that out: a static photo cannot blink on cue.
// ---------------------------------------------------------------------------------------------

// The standard eye-aspect-ratio blink cutoff (Soukupová & Čech) — open eyes read ~0.28-0.35,
// closed ones drop under this.
export const EAR_BLINK_THRESHOLD = 0.23;

function eyeAspectRatio(eye) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const vertical = dist(eye[1], eye[5]) + dist(eye[2], eye[4]);
  const horizontal = dist(eye[0], eye[3]);
  return horizontal === 0 ? 0 : vertical / (2 * horizontal);
}

/**
 * One fast read of how open the eyes are right now, for polling a live video several times a
 * second. Uses TinyFaceDetector — fine here, since this only ever decides "open or closed", never
 * identity. Returns null when no face is currently found.
 */
export async function detectEyeOpenness(video) {
  const faceapi = await loadFaceApi();
  const result = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
    .withFaceLandmarks();
  if (!result) return null;
  return (eyeAspectRatio(result.landmarks.getLeftEye()) + eyeAspectRatio(result.landmarks.getRightEye())) / 2;
}
