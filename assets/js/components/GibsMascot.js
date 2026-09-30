// Gibs P. — 3D mascot rendered from a Minecraft skin via skinview3d (Three.js), loaded from a CDN
// on first use (see ensureLibraryLoaded).
//
// All motion comes from one procedural "brain" rather than swapping canned animations: every joint
// eases toward a target pose through a critically damped spring, and breathing, gaze shifts and
// slow drifts are layered on top, so state changes blend instead of snapping.
//
//   mode="stage"  full body, drag to rotate — the big panel beside the chat (ChatWidget.js)
//   mode="peek"   hidden past the right edge of the window, leaning out to peek (GibsPeek.js)
//
// state (driven by ChatWidget.js): idle | listening | greeting | thinking | answering | error

const SKINVIEW3D_SRC = 'https://unpkg.com/skinview3d@3.4.2/bundles/skinview3d.bundle.js';
let skinview3dPromise = null;

function ensureLibraryLoaded() {
  if (window.skinview3d) return Promise.resolve();
  if (!skinview3dPromise) {
    skinview3dPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SKINVIEW3D_SRC;
      script.onload = () => resolve();
      script.onerror = () => {
        skinview3dPromise = null;
        reject(new Error('Could not load the 3D viewer.'));
      };
      document.head.appendChild(script);
    });
  }
  return skinview3dPromise;
}

// Critically damped spring (implicit Euler): eases toward the target with no overshoot, stable at
// any frame rate. Higher omega = quicker.
function springTo(s, target, omega, dt) {
  const f = 1 + 2 * dt * omega;
  const hoo = dt * omega * omega;
  const hhoo = dt * hoo;
  const inv = 1 / (f + hhoo);
  const x = (f * s.x + dt * s.v + hhoo * target) * inv;
  s.v = (s.v + hoo * (target - s.x)) * inv;
  s.x = x;
}

// Smooth wobble in roughly [-1, 1] that never visibly repeats: sines at unrelated frequencies.
function drift(t, seed) {
  return Math.sin(t * 0.37 + seed) * 0.55 + Math.sin(t * 0.91 + seed * 2.3) * 0.3 + Math.sin(t * 1.73 + seed * 0.7) * 0.15;
}

// One breath as 0 (out) to 1 (in): a quicker inhale, a longer exhale, then a short rest.
function breathCurve(p) {
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  if (p < 0.38) return ease(p / 0.38);
  if (p < 0.88) return 1 - ease((p - 0.38) / 0.5);
  return 0;
}

const rand = (min, max) => min + Math.random() * (max - min);

// Peek framing, in the skin's own units (the model is 32 tall, centered on the origin). The canvas
// right edge is the "wall": at showX he leans out from behind it, at hideX he's fully past it.
const PEEK = { showX: 8.5, hideX: 30, lean: 0.5, yaw: -0.25, y: -1.5 };

const JOINTS = ['peek', 'roll', 'yaw', 'headX', 'headY', 'headZ', 'lArmX', 'lArmZ', 'rArmX', 'rArmZ', 'lLegX', 'rLegX', 'hop'];

// Bits of body language he does on his own while idle, so he never just stands there.
const QUIRK_TIME = { thought: [2.8, 3.8], stretch: [2.2, 2.6], shifty: [1.8, 2.1], watch: [2.2, 2.6], wave: [1.7, 2] };
const STAGE_QUIRKS = Object.keys(QUIRK_TIME);
const PEEK_QUIRKS = ['thought', 'shifty'];

class GibsBrain {
  constructor(mode, calm) {
    this.mode = mode;
    this.calm = calm;
    this.state = 'idle';
    this.t = 0;
    this.stateSince = 0;
    this.ch = {};
    JOINTS.forEach((k) => { this.ch[k] = { x: 0, v: 0 }; });
    this.peekTarget = mode === 'peek' ? 0 : 1;
    this.ch.peek.x = this.peekTarget;
    this.breathPhase = Math.random();
    this.gaze = { x: 0, y: 0 };
    this.nextGlanceAt = 0;
    this.weight = 0;
    this.nextWeightAt = 0;
    this.pointer = null; // { x, y } in [-1, 1] relative to the canvas
    this.pointerAt = -99;
    this.quirk = null;
    this.quirkStart = 0;
    this.quirkUntil = -1;
    this.lastQuirk = null;
    this.nextQuirkAt = rand(4, 7);
    this.nextQuestionAt = 0;
    this.spotted = false;
    this.hiddenSettled = false;
    this.onEffect = null;
    this.onHiddenSettled = null;
  }

  emit(kind) {
    if (!this.calm && this.onEffect) this.onEffect(kind);
  }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.stateSince = this.t;
    this.quirk = null;
    this.nextQuirkAt = Math.max(this.nextQuirkAt, this.t + rand(4, 7));
    const jump = this.calm ? 0 : 1;
    if (state === 'answering') { this.ch.hop.v = 44 * jump; this.emit('!'); }
    if (state === 'greeting') { this.ch.hop.v = 26 * jump; this.emit('!'); }
    if (state === 'error') this.emit('?!');
    if (state === 'thinking') this.nextQuestionAt = this.t + 0.5;
  }

  setPeek(out) {
    this.peekTarget = out ? 1 : 0;
    this.hiddenSettled = false;
    if (out) this.spotted = false;
  }

  lookAt(nx, ny) {
    this.pointer = { x: nx, y: ny };
    this.pointerAt = this.t;
  }

  startQuirk(t) {
    const pool = (this.mode === 'peek' ? PEEK_QUIRKS : STAGE_QUIRKS).filter((q) => q !== this.lastQuirk);
    const q = pool[Math.floor(Math.random() * pool.length)];
    this.quirk = q;
    this.lastQuirk = q;
    this.quirkStart = t;
    this.quirkUntil = t + rand(...QUIRK_TIME[q]);
    this.nextQuirkAt = this.quirkUntil + (this.mode === 'peek' ? rand(7, 12) : rand(5, 10));
    if (q === 'thought') this.emit('?');
    if (q === 'wave') this.emit('!');
  }

  update(player, rawDt) {
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    this.t += dt;
    const t = this.t;
    const ch = this.ch;
    const skin = player.skin;
    const peekMode = this.mode === 'peek';
    const since = t - this.stateSince;
    const a = this.calm ? 0 : 1; // amplitude of the living, breathing layer

    // --- where he looks: a new glance every second or three, or the cursor if it just moved
    if (t >= this.nextGlanceAt) {
      const atViewer = Math.random() < 0.35;
      this.gaze.y = atViewer ? 0 : rand(-0.5, 0.5);
      this.gaze.x = atViewer ? 0 : rand(-0.2, 0.14);
      this.nextGlanceAt = t + rand(0.9, 3.2);
    }
    let gazeX = this.gaze.x;
    let gazeY = this.gaze.y;
    if (this.pointer && t - this.pointerAt < 2.2) {
      gazeY = this.pointer.x * 0.65;
      gazeX = this.pointer.y * 0.38;
    }
    if (t >= this.nextWeightAt) {
      this.weight = rand(-0.035, 0.035);
      this.nextWeightAt = t + rand(3.5, 7);
    }

    // --- target pose for the current state
    let headX = gazeX, headY = gazeY, headZ = 0;
    let roll = this.weight * 0.6, yaw = gazeY * 0.22 + (peekMode ? 0 : drift(t * 0.15, 9) * 0.08 * a);
    let lArmX = 0, lArmZ = 0.06, rArmX = 0, rArmZ = -0.06;
    let lLegX = 0, rLegX = 0;
    let addHeadX = 0, addHeadY = 0, addRArmZ = 0;
    let breathPeriod = 4.2;

    const thinkPose = () => {
      headX = -0.3; headY = -0.32; headZ = 0.13;
      rArmX = -1.95; rArmZ = 0.5; // hand to chin
      yaw = -0.08;
    };
    const wave = (from) => {
      const up = Math.min(1, (t - from) / 0.35);
      rArmX = -0.25; rArmZ = -2.55 * up;
      addRArmZ = Math.sin((t - from) * 13) * 0.3 * up * a;
    };

    switch (this.state) {
      case 'listening':
        // You're typing: he turns to the chat, leans in, and nods along.
        headY = 0.42; headX = 0.12; headZ = -0.05; roll = -0.03; yaw = 0.15;
        addHeadX = Math.sin(t * 3.2) * 0.035 * a;
        break;
      case 'thinking':
        thinkPose();
        addHeadX = Math.sin(t * 2.3) * 0.045 * a; // slow "hmm" nods...
        rLegX = -0.24 * Math.max(0, Math.sin(t * 8.5)) * a; // ...and an impatient foot tap
        if (t >= this.nextQuestionAt) { this.emit('?'); this.nextQuestionAt = t + rand(1.7, 2.6); }
        breathPeriod = 3.8;
        break;
      case 'greeting':
        wave(this.stateSince);
        headX = -0.06; headZ = -0.1; roll = -0.03;
        breathPeriod = 3.4;
        break;
      case 'answering':
        // "Ta-da!" — both arms up in a V.
        lArmX = -0.15; lArmZ = 2.35; rArmX = -0.15; rArmZ = -2.35;
        headX = -0.15;
        breathPeriod = 3.4;
        break;
      case 'error':
        // Facepalm.
        rArmX = -2.35; rArmZ = 0.62;
        headX = 0.3; headY = -0.12; headZ = 0.08; roll = 0.02;
        addHeadY = Math.sin(since * 9) * 0.08 * Math.exp(-since * 1.5) * a;
        break;
      default: {
        if (!this.quirk && t >= this.nextQuirkAt && !this.calm) this.startQuirk(t);
        if (this.quirk && t >= this.quirkUntil) this.quirk = null;
        const qt = t - this.quirkStart;
        switch (this.quirk) {
          case 'thought': // drifts off: looks up and away, hand to chin
            thinkPose();
            break;
          case 'stretch': // big stretch, head back
            lArmX = -0.1; lArmZ = 2.85; rArmX = -0.1; rArmZ = -2.85;
            headX = -0.28; headZ = 0.04;
            break;
          case 'shifty': // suspicious glances left, right, left
            headY = Math.floor(qt / 0.42) % 2 ? 0.62 : -0.62;
            headX = 0.06; yaw = headY * 0.15;
            break;
          case 'watch': // checks an imaginary wristwatch
            lArmX = -1.45; lArmZ = -0.35;
            headX = 0.38; headY = 0.22;
            break;
          case 'wave': // a quick "hey!"
            wave(this.quirkStart);
            break;
          default:
        }
      }
    }

    // "!" the moment he's far enough out to have spotted you.
    const p = ch.peek.x;
    if (peekMode && !this.spotted && this.peekTarget === 1 && p > 0.7) {
      this.spotted = true;
      this.emit('!');
    }

    // --- ease every joint toward its target
    springTo(ch.peek, this.peekTarget, 3.4, dt);
    springTo(ch.roll, roll, 3.5, dt);
    springTo(ch.yaw, yaw, 3.5, dt);
    springTo(ch.headX, headX, 8, dt);
    springTo(ch.headY, headY, 7, dt);
    springTo(ch.headZ, headZ, 6, dt);
    springTo(ch.lArmX, lArmX, 6.5, dt);
    springTo(ch.lArmZ, lArmZ, 6.5, dt);
    springTo(ch.rArmX, rArmX, 6.5, dt);
    springTo(ch.rArmZ, rArmZ, 6.5, dt);
    springTo(ch.lLegX, lLegX, 14, dt);
    springTo(ch.rLegX, rLegX, 14, dt);
    springTo(ch.hop, 0, 7, dt);

    // --- breathing and micro-movements, layered on top
    this.breathPhase = (this.breathPhase + dt / (breathPeriod + Math.sin(t * 0.07) * 0.4)) % 1;
    const b = breathCurve(this.breathPhase) * a;
    const hx = drift(t * 0.6, 4.1) * 0.025 * a;
    const hy = drift(t * 0.55, 1.3) * 0.035 * a;
    const hz = drift(t * 0.4, 2.2) * 0.03 * a;

    const peekP = peekMode ? ch.peek.x : 0;
    player.position.x = peekMode ? PEEK.hideX + (PEEK.showX - PEEK.hideX) * peekP : 0;
    player.position.y = (peekMode ? PEEK.y : 0) + ch.hop.x;
    player.rotation.z = ch.roll.x + PEEK.lean * peekP + drift(t * 0.25, 7) * 0.012 * a;
    player.rotation.y = ch.yaw.x + PEEK.yaw * peekP;

    skin.head.rotation.set(ch.headX.x + addHeadX + hx - 0.03 * b, ch.headY.x + addHeadY + hy, ch.headZ.x + hz);
    skin.head.position.y = 0.2 * b;
    skin.body.scale.set(1 + 0.012 * b, 1, 1 + 0.03 * b);
    skin.leftArm.position.y = -2 + 0.16 * b;
    skin.rightArm.position.y = -2 + 0.16 * b;
    skin.leftArm.rotation.set(ch.lArmX.x + drift(t * 0.45, 3) * 0.03 * a, 0, ch.lArmZ.x + 0.025 * b);
    skin.rightArm.rotation.set(ch.rArmX.x + drift(t * 0.45, 5) * 0.03 * a, 0, ch.rArmZ.x + addRArmZ - 0.025 * b);
    skin.leftLeg.rotation.set(ch.lLegX.x, 0, 0);
    skin.rightLeg.rotation.set(ch.rLegX.x, 0, 0);

    // Fully tucked away: tell the component it can stop rendering until he peeks again.
    if (peekMode && this.peekTarget === 0 && !this.hiddenSettled && ch.peek.x < 0.002 && Math.abs(ch.peek.v) < 0.01) {
      this.hiddenSettled = true;
      if (this.onHiddenSettled) this.onHiddenSettled();
    }
  }
}

let effectId = 0;

export default {
  name: 'GibsMascot',
  props: {
    state: { type: String, default: 'idle' },
    mode: { type: String, default: 'stage' }, // stage | peek
    peek: { type: Boolean, default: false }, // peek mode only: leaning out, or tucked away
    // Stage mode fills its container and follows it as it resizes; peek mode uses width/height.
    fill: { type: Boolean, default: false },
    width: { type: Number, default: 300 },
    height: { type: Number, default: 400 },
    skinUrl: { type: String, default: 'assets/images/skin-ett4.png' },
  },
  data() {
    return { failed: false, ready: false, effects: [], w: this.width, h: this.height, shadow: null };
  },
  async mounted() {
    const calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (this.fill) this.measure();
    try {
      await ensureLibraryLoaded();
      if (this.unmounted) return;
      const sv = window.skinview3d;
      const peekMode = this.mode === 'peek';
      this.viewer = new sv.SkinViewer({
        canvas: this.$refs.canvas,
        width: this.w,
        height: this.h,
        skin: this.skinUrl,
        // Stage leaves headroom for hops, "ta-da" arms and the "!"/"?" pops above his head.
        zoom: peekMode ? 1 : 0.55,
        enableControls: !peekMode,
      });
      this.viewer.background = null;
      if (!peekMode) {
        // Rotate only — zoom/pan would let him escape the stage.
        this.viewer.controls.enableZoom = false;
        this.viewer.controls.enablePan = false;
      }
      this.brain = new GibsBrain(this.mode, calm);
      this.brain.setState(this.state);
      this.brain.setPeek(this.peek);
      this.brain.onEffect = (kind) => this.spawnEffect(kind);
      // Pausing from inside a frame would be undone when that frame reschedules the next one,
      // so wait for it to finish.
      this.brain.onHiddenSettled = () => queueMicrotask(() => {
        if (this.viewer && this.brain.peekTarget === 0) this.viewer.renderPaused = true;
      });
      this.viewer.animation = new sv.FunctionAnimation((player, progress, delta) => this.brain.update(player, delta));
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      if (this.fill && window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.$el);
      }
      this.placeShadow();
      this.ready = true;
    } catch (e) {
      this.failed = true;
    }
  },
  beforeUnmount() {
    this.unmounted = true;
    window.removeEventListener('pointermove', this.onPointerMove);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    (this.effectTimers || []).forEach(clearTimeout);
    if (this.viewer) this.viewer.dispose();
  },
  watch: {
    state(next) {
      if (this.brain) this.brain.setState(next);
    },
    peek(out) {
      if (!this.brain) return;
      this.brain.setPeek(out);
      if (out) this.viewer.renderPaused = false;
    },
  },
  methods: {
    measure() {
      const r = this.$el.getBoundingClientRect();
      this.w = Math.max(1, Math.round(r.width));
      this.h = Math.max(1, Math.round(r.height));
    },
    resize() {
      const w = this.w, h = this.h;
      this.measure();
      if (this.viewer && (w !== this.w || h !== this.h)) {
        this.viewer.setSize(this.w, this.h);
        this.placeShadow();
      }
    },
    // Screen position (px, within the canvas) of a point in the model's space.
    project(x, y, z) {
      const v = this.viewer.camera.position.clone().set(x, y, z);
      v.project(this.viewer.camera);
      return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h };
    },
    // A soft contact shadow under his feet, so he stands on the stage instead of floating.
    placeShadow() {
      if (this.mode !== 'stage' || !this.viewer) return;
      const left = this.project(-8, -16, 0);
      const right = this.project(8, -16, 0);
      this.shadow = { x: (left.x + right.x) / 2, y: left.y, w: (right.x - left.x) * 1.3 };
    },
    onPointerMove(e) {
      if (!this.brain) return;
      const rect = this.$refs.canvas.getBoundingClientRect();
      const clamp = (v) => Math.max(-1, Math.min(1, v));
      const scale = this.mode === 'stage' ? 420 : 320;
      this.brain.lookAt(
        clamp((e.clientX - (rect.left + rect.width / 2)) / scale),
        clamp((e.clientY - (rect.top + rect.height * 0.25)) / scale),
      );
    },
    // "!" / "?" / "?!" pops above his head, wherever his head currently is on screen.
    spawnEffect(kind) {
      if (!this.viewer) return;
      const v = this.viewer.camera.position.clone();
      this.viewer.playerObject.skin.head.getWorldPosition(v);
      v.y += 14;
      v.project(this.viewer.camera);
      const inset = this.mode === 'peek' ? 22 : 16;
      const x = Math.min(this.w - inset, Math.max(inset, ((v.x + 1) / 2) * this.w));
      const y = Math.max(4, ((1 - v.y) / 2) * this.h);
      const id = ++effectId;
      this.effects.push({ id, kind, x, y });
      this.effectTimers = this.effectTimers || [];
      this.effectTimers.push(setTimeout(() => {
        this.effects = this.effects.filter((fx) => fx.id !== id);
      }, 1500));
    },
  },
  template: `
  <div class="relative" :class="fill ? 'w-full h-full' : 'shrink-0'" :style="fill ? null : { width: width + 'px', height: height + 'px' }">
    <div v-if="shadow && ready" class="gibs-shadow" aria-hidden="true"
      :style="{ left: shadow.x + 'px', top: shadow.y + 'px', width: shadow.w + 'px' }"></div>
    <canvas ref="canvas" class="relative" :class="[mode === 'stage' ? 'cursor-grab active:cursor-grabbing' : '', ready ? '' : 'opacity-0']"
      :title="mode === 'stage' ? 'Drag to spin Gibs around' : null"></canvas>
    <div v-if="mode === 'stage' && !ready" class="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-400">
      {{ failed ? 'Gibs wandered off — the chat still works!' : 'Waking Gibs up…' }}
    </div>
    <span v-for="fx in effects" :key="fx.id" class="gibs-fx" :class="fx.kind === '!' ? 'gibs-fx-bang' : 'gibs-fx-q'"
      :style="{ left: fx.x + 'px', top: fx.y + 'px' }">{{ fx.kind }}</span>
  </div>
  `,
};
