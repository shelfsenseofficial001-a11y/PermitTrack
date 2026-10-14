import BaseModal from './BaseModal.js?v=168';
import { detectFaceDescriptor, faceDistance, FACE_MATCH_THRESHOLD, detectEyeOpenness, EAR_BLINK_THRESHOLD } from '../faceVerify.js?v=168';
import { readIdText, looksLikePhilippineGovernmentId } from '../idVerify.js?v=168';

// How often the live video is sampled while watching for a blink.
const LIVENESS_POLL_MS = 220;
// After this long without a face in frame, or without a blink, nudge the person rather than
// failing silently — they're still free to keep trying, nothing times out into a bypass.
const LIVENESS_HINT_MS = 9000;

// Proof that a government ID belongs to the person submitting it: a live selfie, matched
// against the face in the ID photo right there in the browser. Shown over the upload field
// the moment an ID file is chosen; the file is only accepted once the two faces match.
export default {
  name: 'FaceVerifyModal',
  components: { BaseModal },
  props: {
    // The ID photo already chosen in the file input — never re-uploaded, just read locally.
    idFile: { type: File, required: true },
  },
  emits: ['verified', 'close'],
  data() {
    return {
      // loading -> camera -> review -> checking, with id-no-face / cam-error / no-face / mismatch
      // as dead ends that lead back to 'camera' (Retake) or out via 'close' (Choose another file).
      phase: 'loading',
      error: '',
      idPreviewUrl: '',
      capturedUrl: '',
      stream: null,
      idDescriptor: null,
      // Liveness: capture only fires once a real blink is seen, so a printed photo or a photo
      // held up to the camera — which would otherwise match the ID just fine — can't pass.
      livenessHint: false,
      livenessTimer: null,
      eyesWereClosed: false,
      noFaceStreak: 0,
    };
  },
  async mounted() {
    this.idPreviewUrl = URL.createObjectURL(this.idFile);
    try {
      const img = await this.loadImage(this.idPreviewUrl);
      // OCR and face detection don't depend on each other, so they run together — OCR alone
      // takes a few seconds, and there's no reason to make the person wait through it twice.
      // OCR failing to even load (e.g. offline) fails open rather than wrongly blocking someone
      // over an infrastructure problem — the face/liveness check below is still the real gate.
      const [idText, idDescriptor] = await Promise.all([
        readIdText(img).catch(() => null),
        detectFaceDescriptor(img),
      ]);
      if (idText !== null && !looksLikePhilippineGovernmentId(idText)) {
        this.phase = 'id-not-ph';
        return;
      }
      this.idDescriptor = idDescriptor;
      if (!this.idDescriptor) {
        this.phase = 'id-no-face';
        return;
      }
      await this.openCamera();
    } catch (e) {
      this.error = e.message || 'Face verification could not start.';
      this.phase = 'cam-error';
    }
  },
  beforeUnmount() {
    this.stopCamera();
    if (this.idPreviewUrl) URL.revokeObjectURL(this.idPreviewUrl);
    if (this.capturedUrl) URL.revokeObjectURL(this.capturedUrl);
  },
  methods: {
    loadImage(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not read that image.'));
        img.src = url;
      });
    },
    async openCamera() {
      this.stopCamera();
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      } catch (e) {
        this.error = 'Camera access was blocked. Allow camera access for this site, then try again.';
        this.phase = 'cam-error';
        return;
      }
      this.phase = 'camera';
      await this.$nextTick();
      if (this.$refs.video) {
        this.$refs.video.srcObject = this.stream;
        await this.$refs.video.play().catch(() => {});
      }
      this.startLivenessCheck();
    },
    stopCamera() {
      this.stopLivenessCheck();
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
      }
    },
    // Polls the live video for a blink (eyes closed, then open again) and captures the instant
    // one happens — a photo held up to the camera never blinks, so it never reaches this point.
    startLivenessCheck() {
      this.stopLivenessCheck();
      this.livenessHint = false;
      this.eyesWereClosed = false;
      this.noFaceStreak = 0;
      const startedAt = Date.now();
      this.livenessTimer = setInterval(async () => {
        if (this.phase !== 'camera' || !this.$refs.video) return;
        const ear = await detectEyeOpenness(this.$refs.video);
        if (this.phase !== 'camera') return; // the frame may have closed while that await was in flight
        if (ear == null) {
          this.noFaceStreak++;
        } else {
          this.noFaceStreak = 0;
          if (ear < EAR_BLINK_THRESHOLD) {
            this.eyesWereClosed = true;
          } else if (this.eyesWereClosed) {
            this.capture();
            return;
          }
        }
        if (Date.now() - startedAt > LIVENESS_HINT_MS) this.livenessHint = true;
      }, LIVENESS_POLL_MS);
    },
    stopLivenessCheck() {
      if (this.livenessTimer) {
        clearInterval(this.livenessTimer);
        this.livenessTimer = null;
      }
    },
    capture() {
      const video = this.$refs.video;
      if (!video || !video.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      this.capturedCanvas = canvas;
      if (this.capturedUrl) URL.revokeObjectURL(this.capturedUrl);
      this.capturedUrl = canvas.toDataURL('image/jpeg', 0.9);
      this.stopCamera();
      this.phase = 'review';
    },
    retake() {
      this.capturedCanvas = null;
      this.openCamera();
    },
    async confirm() {
      this.phase = 'checking';
      const selfieDescriptor = await detectFaceDescriptor(this.capturedCanvas);
      if (!selfieDescriptor) {
        this.phase = 'no-face';
        return;
      }
      const distance = faceDistance(this.idDescriptor, selfieDescriptor);
      if (distance > FACE_MATCH_THRESHOLD) {
        this.phase = 'mismatch';
        return;
      }
      this.capturedCanvas.toBlob((blob) => {
        const selfieFile = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
        this.$emit('verified', { selfieFile });
      }, 'image/jpeg', 0.9);
    },
    close() {
      this.stopCamera();
      this.$emit('close');
    },
  },
  template: `
  <BaseModal title="Confirm it's you" subtitle="A quick live photo, matched against the ID you just chose." eyebrow="Face verification" @close="close">
    <template #icon>
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6H4a1 1 0 0 0-1 1v4M16 6h4a1 1 0 0 1 1 1v4M8 22H4a1 1 0 0 1-1-1v-4M16 22h4a1 1 0 0 0 1-1v-4"/><circle cx="12" cy="12" r="3.5"/></svg>
    </template>

    <div class="space-y-4">
      <div v-if="phase === 'loading'" class="flex flex-col items-center justify-center py-10 text-center gap-3">
        <svg class="w-6 h-6 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke-opacity=".25"/><path d="M22 12a10 10 0 0 0-10-10"/></svg>
        <p class="text-sm text-slate-500">Reading the ID photo…</p>
      </div>

      <div v-else-if="phase === 'id-not-ph'" class="text-center py-6 space-y-3">
        <p class="text-sm text-slate-600 leading-relaxed">That doesn't read like a Philippine government ID. Upload a clear, well-lit photo of a National ID (PhilSys), Driver's License, UMID, Passport, Voter's ID, PRC ID, Postal ID, SSS/GSIS ID, PhilHealth ID, Senior Citizen/PWD ID, or Barangay ID.</p>
        <img :src="idPreviewUrl" alt="" class="max-h-40 mx-auto rounded-xl ring-1 ring-slate-200" />
      </div>

      <div v-else-if="phase === 'id-no-face'" class="text-center py-6 space-y-3">
        <p class="text-sm text-slate-600 leading-relaxed">We couldn't find a clear face on that ID photo. Make sure the whole ID is in frame, in focus and well-lit, then choose the file again.</p>
        <img :src="idPreviewUrl" alt="" class="max-h-40 mx-auto rounded-xl ring-1 ring-slate-200" />
      </div>

      <div v-else-if="phase === 'cam-error'" class="text-center py-6">
        <p class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{{ error }}</p>
      </div>

      <div v-else-if="phase === 'camera'" class="space-y-3">
        <div class="relative rounded-2xl overflow-hidden bg-ink-900 aspect-square">
          <video ref="video" class="w-full h-full object-cover -scale-x-100" muted playsinline autoplay></video>
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/85 to-transparent px-4 pt-8 pb-3 flex items-center justify-center gap-2">
            <svg class="w-4 h-4 text-sun-300 shrink-0 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            <p class="text-xs font-semibold text-white text-center">{{ noFaceStreak > 6 ? "We can't see your face — center it in frame" : 'Look at the camera and blink naturally' }}</p>
          </div>
        </div>
        <p class="text-xs text-slate-500 text-center">Captures itself the moment you blink — proof it's really you, live, not a photo.</p>
        <p v-if="livenessHint" class="text-xs text-sun-700 bg-sun-50 border border-sun-200 rounded-xl px-3.5 py-2 text-center">Still waiting for a blink. Make sure your eyes are visible and well-lit, then blink normally.</p>
      </div>

      <div v-else-if="phase === 'review' || phase === 'checking' || phase === 'no-face' || phase === 'mismatch'" class="space-y-3">
        <div class="relative rounded-2xl overflow-hidden bg-ink-900 aspect-square">
          <img :src="capturedUrl" alt="Captured selfie" class="w-full h-full object-cover -scale-x-100" />
        </div>
        <div v-if="phase === 'checking'" class="flex items-center justify-center gap-2 text-sm text-slate-500">
          <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke-opacity=".25"/><path d="M22 12a10 10 0 0 0-10-10"/></svg>
          Comparing with the ID photo…
        </div>
        <p v-else-if="phase === 'no-face'" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">We couldn't find your face in that photo. Try again with your face centered and well-lit.</p>
        <p v-else-if="phase === 'mismatch'" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">That doesn't look like a match for the ID photo. Make sure you're the person on the ID, then try again.</p>
      </div>
    </div>

    <template #footer>
      <template v-if="phase === 'id-not-ph' || phase === 'id-no-face' || phase === 'cam-error'">
        <button type="button" @click="close" class="ml-auto text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 transition">Choose a different file</button>
      </template>
      <template v-else-if="phase === 'camera'">
        <button type="button" @click="close" class="ml-auto text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 transition">Cancel</button>
      </template>
      <template v-else-if="phase === 'review'">
        <button type="button" @click="retake" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 transition">Retake</button>
        <button type="button" @click="confirm" class="ml-auto text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-5 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">Use this photo</button>
      </template>
      <template v-else-if="phase === 'no-face' || phase === 'mismatch'">
        <button type="button" @click="close" class="text-sm font-semibold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200/60 transition">Cancel</button>
        <button type="button" @click="retake" class="ml-auto text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-5 py-2.5 rounded-xl transition shadow-[0_8px_18px_-8px_rgba(31,122,58,0.6)]">Retake</button>
      </template>
    </template>
  </BaseModal>
  `,
};
