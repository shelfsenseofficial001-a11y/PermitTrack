// 3D mascot ("Gibs P.") rendered from a Minecraft-format skin via skinview3d (Three.js-based).
// Loaded from a CDN on first use, not bundled — see ensureLibraryLoaded().
//
// States map to chat events (driven by ChatWidget.js):
//   idle      - gentle breathing/sway (skinview3d's IdleAnimation) + head follows the cursor
//   greeting  - waves (skinview3d's WaveAnimation)
//   thinking  - head nods while Gibs P. is "typing" (custom FunctionAnimation)
//   answering - a small hop the moment a reply lands (custom FunctionAnimation)
//   error     - a head shake (custom FunctionAnimation)
// Drag-to-rotate is skinview3d's own OrbitControls, left enabled by default.

const SKINVIEW3D_SRC = 'https://unpkg.com/skinview3d@3.4.2/bundles/skinview3d.bundle.js';
let skinview3dPromise = null;

function ensureLibraryLoaded() {
  if (window.skinview3d) return Promise.resolve();
  if (!skinview3dPromise) {
    skinview3dPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SKINVIEW3D_SRC;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load the 3D viewer.'));
      document.head.appendChild(script);
    });
  }
  return skinview3dPromise;
}

export default {
  name: 'GibsMascot',
  props: {
    state: { type: String, default: 'idle' }, // idle | greeting | thinking | answering | error
    size: { type: Number, default: 64 },
    skinUrl: { type: String, default: 'assets/images/skin-ett4.png' },
  },
  data() {
    return { failed: false, ready: false };
  },
  async mounted() {
    try {
      await ensureLibraryLoaded();
      const sv = window.skinview3d;
      this.viewer = new sv.SkinViewer({
        canvas: this.$refs.canvas,
        width: this.size,
        height: this.size,
        skin: this.skinUrl,
        zoom: 0.85,
      });
      // Keep interaction to rotate-only — zoom/pan would let the model escape a small header canvas.
      this.viewer.controls.enableZoom = false;
      this.viewer.controls.enablePan = false;
      this.viewer.background = null;
      this.canvasEl = this.$refs.canvas;
      this.canvasEl.addEventListener('pointermove', this.onPointerMove);
      this.canvasEl.addEventListener('pointerleave', this.onPointerLeave);
      this.ready = true;
      this.applyState(this.state);
    } catch (e) {
      this.failed = true;
    }
  },
  beforeUnmount() {
    if (this.canvasEl) {
      this.canvasEl.removeEventListener('pointermove', this.onPointerMove);
      this.canvasEl.removeEventListener('pointerleave', this.onPointerLeave);
    }
    if (this.viewer) this.viewer.dispose();
  },
  watch: {
    state(next) {
      if (this.ready) this.applyState(next);
    },
  },
  methods: {
    applyState(state) {
      const sv = window.skinview3d;
      this.headTrackingEnabled = state === 'idle';
      switch (state) {
        case 'greeting':
          this.viewer.animation = new sv.WaveAnimation();
          break;
        case 'thinking':
          this.viewer.animation = new sv.FunctionAnimation((player, progress) => {
            const t = progress * 4;
            player.skin.head.rotation.x = Math.sin(t) * 0.25 + 0.15;
            player.skin.head.rotation.y = Math.sin(t * 0.5) * 0.15;
            const armZ = Math.PI * 0.02;
            player.skin.leftArm.rotation.z = Math.cos(t) * 0.03 + armZ;
            player.skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.03 - armZ;
          });
          break;
        case 'answering':
          this.viewer.animation = new sv.FunctionAnimation((player, progress) => {
            const t = progress * 10;
            player.position.y = Math.max(0, Math.sin(t)) * 3;
            player.skin.leftArm.rotation.x = -Math.max(0, Math.sin(t)) * 0.6;
            player.skin.rightArm.rotation.x = -Math.max(0, Math.sin(t)) * 0.6;
          });
          break;
        case 'error':
          this.viewer.animation = new sv.FunctionAnimation((player, progress) => {
            player.skin.head.rotation.y = Math.sin(progress * 14) * 0.35;
          });
          break;
        default:
          this.viewer.animation = new sv.IdleAnimation();
      }
    },
    // Head-follows-cursor, only while idle (other states already drive the head themselves) and
    // only on a plain hover — OrbitControls owns actual pointer drags (button held).
    onPointerMove(e) {
      if (!this.ready || !this.headTrackingEnabled || e.buttons !== 0) return;
      const rect = this.canvasEl.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      const head = this.viewer.playerObject.skin.head;
      head.rotation.y = nx * 0.6;
      head.rotation.x = ny * 0.4;
    },
    onPointerLeave() {
      if (!this.ready || !this.viewer) return;
      const head = this.viewer.playerObject.skin.head;
      head.rotation.y = 0;
      head.rotation.x = 0;
    },
  },
  template: `
  <div class="relative shrink-0" :style="{ width: size + 'px', height: size + 'px' }">
    <canvas ref="canvas" class="rounded-lg cursor-grab active:cursor-grabbing" :class="{ 'opacity-0': !ready }"></canvas>
    <div v-if="failed || !ready" class="absolute inset-0 rounded-lg bg-sun-400 text-ink-700 flex items-center justify-center font-bold">?</div>
  </div>
  `,
};
