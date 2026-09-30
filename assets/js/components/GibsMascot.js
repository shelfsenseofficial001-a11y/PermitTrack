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
// state (driven by ChatWidget.js): idle | listening | greeting | thinking | answering | pondering | error
// Each of greeting/answering/pondering/error plays a random bit from its REACTIONS pool, dealt so
// the same one never comes up twice in a row.

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

// Hands items out in shuffled order: nothing repeats until the whole set has been used, and the
// last one of a round never opens the next — so the same bit never plays twice in a row.
class Bag {
  constructor(items) {
    this.items = items;
    this.left = [];
    this.last = null;
  }

  next() {
    if (!this.left.length) {
      this.left = [...this.items];
      for (let i = this.left.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.left[i], this.left[j]] = [this.left[j], this.left[i]];
      }
      const n = this.left.length;
      if (n > 1 && this.left[n - 1] === this.last) [this.left[0], this.left[n - 1]] = [this.left[n - 1], this.left[0]];
    }
    this.last = this.left.pop();
    return this.last;
  }
}

// Peek framing, in the skin's own units (the model is 32 tall, centered on the origin). The canvas
// right edge is the "wall": at showX he leans out from behind it, at hideX he's fully past it.
const PEEK = { showX: 8.5, hideX: 30, lean: 0.5, yaw: -0.25, y: -1.5 };

// Springs ease these toward each frame's target pose.
const JOINTS = ['peek', 'roll', 'yaw', 'pitch', 'headX', 'headY', 'headZ', 'lArmX', 'lArmZ', 'rArmX', 'rArmZ', 'lLegX', 'rLegX', 'hop'];

// Sign guide (he faces you): headX < 0 looks up · headY > 0 turns toward the chat (your right) ·
// arm X < 0 swings forward/up · lArmZ > 0 / rArmZ < 0 lifts the arm out to the side (the opposite
// sign brings it across his body) · leg X < 0 kicks forward · pitch > 0 bows toward you ·
// roll > 0 leans to your left. add* values skip the springs, for quick wiggles.

const smoothDecay = (k, from, rate) => (k < from ? 0 : Math.exp(-(k - from) * rate));

const wave = (k, P, a) => {
  const up = Math.min(1, k / 0.35);
  P.rArmX = -0.25; P.rArmZ = -2.55 * up;
  P.addRArmZ = Math.sin(k * 13) * 0.3 * up * a;
  P.headZ = -0.1; P.headX = -0.06;
};
const salute = (P) => {
  P.rArmX = -2.6; P.rArmZ = 0.5; // flat hand at the brow
  P.headX = -0.08; P.pitch = -0.06; // chest out
};
const chin = (P) => {
  P.headX = -0.3; P.headY = -0.32; P.headZ = 0.13;
  P.rArmX = -1.95; P.rArmZ = 0.5; // hand to chin
  P.yaw = -0.08;
};

// Reactions: short bits of acting, several beats long. Each kind has a pool that ReactionBags deals
// from, so he doesn't answer the same way twice in a row. pose(k, P, a) sets the pose k seconds in;
// fx are [second, "!"/"?"/…] pops and hops are [second, upward kick] jumps.
const REACTIONS = {
  // A normal answer landed.
  answer: {
    tada: {
      dur: 2.3, fx: [[0.05, '!']], hops: [[0, 40]],
      pose(k, P, a) {
        if (k < 1.1) { P.lArmX = -0.15; P.lArmZ = 2.35; P.rArmX = -0.15; P.rArmZ = -2.35; P.headX = -0.15; return; }
        // ...then hands on hips, with a smug little nod
        P.lArmX = 0.25; P.lArmZ = 0.5; P.rArmX = 0.25; P.rArmZ = -0.5; P.pitch = -0.05;
        P.headX = -0.1; P.addHeadX = Math.sin((k - 1.1) * 7) * 0.07 * a;
      },
    },
    fingerGuns: {
      dur: 2.1, fx: [[0.55, '✦'], [1.05, '✦']], hops: [],
      pose(k, P, a) {
        if (k > 1.55) return; // holstered
        P.lArmX = -1.5; P.lArmZ = -0.1; P.rArmX = -1.5; P.rArmZ = 0.1; P.headZ = 0.14;
        // "pew, pew" — a kick of recoil on each shot
        const recoil = (smoothDecay(k, 0.5, 9) + smoothDecay(k, 1.0, 9)) * 0.5 * a;
        P.addLArmX = -recoil; P.addRArmX = -recoil;
      },
    },
    pointAtChat: {
      dur: 2.3, fx: [[0.25, '!']], hops: [[0, 16]],
      pose(k, P, a) {
        if (k < 1.3) {
          // "It's right there!" — turns and points at the answer
          P.headY = 0.5; P.headX = 0.05; P.yaw = 0.28;
          P.lArmX = -1.35; P.lArmZ = 0.8; P.addLArmZ = Math.sin(k * 10) * 0.06 * a;
          return;
        }
        P.headY = 0.05; P.addHeadX = Math.sin((k - 1.3) * 9) * 0.12 * a; // back to you: "yep, that one"
      },
    },
    chefsKiss: {
      dur: 2.1, fx: [[0.8, '✦']], hops: [],
      pose(k, P) {
        if (k < 0.75) { P.rArmX = -2.05; P.rArmZ = 0.42; P.headX = -0.05; P.headZ = -0.06; return; }
        if (k < 1.6) { P.rArmX = -1.4; P.rArmZ = -1.15; P.headX = -0.22; P.headZ = 0.1; P.pitch = -0.05; }
      },
    },
    victoryDance: {
      dur: 2.3, fx: [[0.1, '♪'], [1.1, '♪']], hops: [[0.37, 12], [1.1, 12]],
      pose(k, P, a) {
        if (k > 1.9) return;
        const s = Math.sin(k * 8.5) * a;
        P.lArmX = -0.3; P.lArmZ = 1.25; P.rArmX = -0.3; P.rArmZ = -1.25;
        P.addLArmZ = s * 0.8; P.addRArmZ = s * 0.8;
        P.addRoll = s * 0.07; P.headZ = -s * 0.12; P.lLegX = s * 0.28; P.rLegX = -s * 0.28;
        P.addHeadX = Math.abs(Math.cos(k * 8.5)) * 0.06 * a;
      },
    },
    salute: {
      dur: 2.0, fx: [[0.35, '!']], hops: [],
      pose(k, P, a) {
        if (k < 1.2) { salute(P); return; }
        P.addHeadX = Math.sin((k - 1.2) * 10) * 0.1 * a; // snap down, crisp nod
      },
    },
    bow: {
      dur: 2.2, fx: [[1.0, '✦']], hops: [],
      pose(k, P) {
        // A butler's bow: "at your service"
        if (k < 0.2 || k > 1.25) return;
        P.pitch = 0.38; P.headX = 0.15;
        P.rArmX = -0.95; P.rArmZ = 0.7; P.lArmX = 0.55; P.lArmZ = 0.1;
      },
    },
    bigBrain: {
      dur: 2.2, fx: [[1.05, '!']], hops: [[1.0, 14]],
      pose(k, P, a) {
        if (k < 1.0) {
          // tap, tap on the temple...
          P.rArmX = -2.35; P.rArmZ = 0.95; P.headZ = -0.14;
          P.addRArmX = Math.max(0, Math.sin(k * 18)) * 0.12 * a;
          return;
        }
        if (k < 1.8) { P.rArmX = -2.95; P.rArmZ = 0.1; P.headX = -0.12; } // ...one finger up: "Eureka!"
      },
    },
    fistPump: {
      dur: 1.9, fx: [[0.1, '!']], hops: [[0, 22], [0.45, 18]],
      pose(k, P, a) {
        if (k > 1.25) return;
        P.rArmX = -0.35; P.rArmZ = -2.0; P.addRArmZ = Math.sin(k * 14) * 0.45 * a;
        P.headX = -0.1; P.lArmZ = 0.25;
      },
    },
  },

  // The question was off-topic (or stumped him): he thinks it over, or gets lost in thought.
  ponder: {
    daydream: {
      dur: 3.3, fx: [[0.5, '?'], [2.55, '!']], hops: [[2.5, 16]],
      pose(k, P, a) {
        if (k < 2.45) {
          P.headX = -0.36; P.headY = -0.42; P.headZ = 0.1; P.yaw = -0.12;
          P.addRoll = Math.sin(k * 1.5) * 0.04 * a; P.breathPeriod = 5.5;
          return;
        }
        // Snaps out of it — "huh? oh!"
        P.headY = 0.3; P.headX = 0.05;
        P.addHeadY = Math.sin((k - 2.45) * 16) * 0.1 * a * smoothDecay(k, 2.45, 3);
      },
    },
    headScratch: {
      dur: 2.8, fx: [[0.35, '?'], [1.6, '?']], hops: [],
      pose(k, P, a) {
        P.rArmX = -2.75; P.rArmZ = 0.55; P.addRArmZ = Math.sin(k * 17) * 0.1 * a;
        P.headZ = 0.16; P.headX = 0.06; P.headY = -0.1;
      },
    },
    chinStroke: {
      dur: 3.0, fx: [[0.3, '?'], [1.6, '…']], hops: [],
      pose(k, P, a) {
        chin(P);
        P.headY = Math.sin(k * 1.2) * 0.4; // looks slowly from side to side, weighing it up
        P.addRArmX = Math.sin(k * 5) * 0.05 * a;
        P.lArmX = -0.55; P.lArmZ = -0.45; // other arm folded under
      },
    },
    puppyTilt: {
      dur: 2.6, fx: [[0.2, '?'], [1.0, '?']], hops: [],
      pose(k, P) {
        P.headZ = Math.floor(k / 0.75) % 2 ? -0.3 : 0.3; // head tilts one way, then the other
        P.headX = 0.05;
        P.lArmX = -0.45; P.lArmZ = 0.45; P.rArmX = -0.45; P.rArmZ = -0.45; // palms-up "no idea"
      },
    },
    cloudWatch: {
      dur: 3.2, fx: [[0.6, '?'], [2.4, '…']], hops: [],
      pose(k, P, a) {
        if (k < 2.3) {
          // Points at a cloud that looks suspiciously like a permit form
          P.headX = -0.45; P.yaw = -0.35 + k * 0.12;
          if (k > 0.8 && k < 2.1) { P.lArmX = -2.6; P.lArmZ = 0.2; }
          return;
        }
        P.addHeadY = Math.sin((k - 2.3) * 14) * 0.12 * a * smoothDecay(k, 2.3, 2.5); // shakes it off
      },
    },
  },

  // A request failed.
  error: {
    facepalm: {
      dur: 2.2, fx: [[0.1, '?!']], hops: [],
      pose(k, P, a) {
        P.rArmX = -2.35; P.rArmZ = 0.62;
        P.headX = 0.3; P.headY = -0.12; P.headZ = 0.08; P.roll = 0.02;
        P.addHeadY = Math.sin(k * 9) * 0.08 * Math.exp(-k * 1.5) * a;
      },
    },
    wasntMe: {
      dur: 2.0, fx: [[0.1, '?!']], hops: [[0, 14]],
      pose(k, P) {
        // Hands up, eyes darting: "I didn't touch anything!"
        P.lArmX = -2.8; P.lArmZ = 0.35; P.rArmX = -2.8; P.rArmZ = -0.35;
        P.headY = Math.floor(k / 0.3) % 2 ? 0.5 : -0.5; P.headX = -0.05;
      },
    },
    slump: {
      dur: 2.3, fx: [[0.3, '…']], hops: [],
      pose(k, P) {
        P.pitch = 0.1; P.headX = 0.45;
        P.lArmX = 0.1; P.lArmZ = -0.05; P.rArmX = 0.1; P.rArmZ = 0.05; P.breathPeriod = 5;
      },
    },
  },

  // Hello!
  greet: {
    wave: { dur: 2.0, fx: [[0.1, '!']], hops: [[0, 26]], pose: (k, P, a) => wave(k, P, a) },
    bothHands: {
      dur: 2.0, fx: [[0.1, '!']], hops: [[0, 20], [0.55, 14]],
      pose(k, P, a) {
        const up = Math.min(1, k / 0.35);
        P.lArmX = -0.2; P.lArmZ = 2.5 * up; P.rArmX = -0.2; P.rArmZ = -2.5 * up;
        P.addLArmZ = Math.sin(k * 12) * 0.28 * up * a; P.addRArmZ = -P.addLArmZ;
        P.headX = -0.08;
      },
    },
    saluteHi: {
      dur: 2.2, fx: [[0.3, '!']], hops: [],
      pose(k, P, a) {
        if (k < 0.9) salute(P);
        else wave(k - 0.9, P, a);
      },
    },
    peekaboo: {
      dur: 2.1, fx: [[0.95, '!']], hops: [[0.9, 24]],
      pose(k, P) {
        if (k < 0.85) { P.lArmX = -2.3; P.lArmZ = -0.5; P.rArmX = -2.3; P.rArmZ = 0.5; P.headX = 0.1; return; }
        if (k < 1.7) { P.lArmX = -0.4; P.lArmZ = 1.6; P.rArmX = -0.4; P.rArmZ = -1.6; P.headX = -0.1; } // "boo!"
      },
    },
  },
};

// While a reply is on its way — a different way of thinking each time.
const THINKING = {
  chinTap(t, P, a) {
    chin(P);
    P.addHeadX = Math.sin(t * 2.3) * 0.045 * a; // slow "hmm" nods...
    P.rLegX = -0.24 * Math.max(0, Math.sin(t * 8.5)) * a; // ...and an impatient foot tap
    return '?';
  },
  armsFolded(t, P, a) {
    P.headX = -0.34; P.headY = 0.22; P.headZ = -0.08;
    P.lArmX = -0.75; P.lArmZ = -0.55; P.rArmX = -0.75; P.rArmZ = 0.55;
    P.addRoll = Math.sin(t * 1.6) * 0.035 * a; // rocking on his heels
    return '?';
  },
  takingNotes(t, P, a) {
    P.headX = 0.34; P.headY = 0.1;
    P.lArmX = -1.3; P.lArmZ = -0.3; // the notepad...
    P.rArmX = -1.2; P.rArmZ = 0.38; P.addRArmZ = Math.sin(t * 18) * 0.08 * a; // ...and a very busy pencil
    return '…';
  },
};

// Idle quirks: bits of body language he does on his own so he never just stands there.
const QUIRKS = {
  thought: { time: [2.8, 3.8], fx: '?', pose: (q, P) => chin(P) },
  stretch: {
    time: [2.2, 2.6],
    pose(q, P) { P.lArmX = -0.1; P.lArmZ = 2.85; P.rArmX = -0.1; P.rArmZ = -2.85; P.headX = -0.28; P.headZ = 0.04; },
  },
  shifty: {
    time: [1.8, 2.1],
    pose(q, P) { P.headY = Math.floor(q / 0.42) % 2 ? 0.62 : -0.62; P.headX = 0.06; P.yaw = P.headY * 0.15; },
  },
  watch: {
    time: [2.2, 2.6], // checks an imaginary wristwatch
    pose(q, P) { P.lArmX = -1.45; P.lArmZ = -0.35; P.headX = 0.38; P.headY = 0.22; },
  },
  wave: { time: [1.7, 2], fx: '!', pose: (q, P, a) => wave(q, P, a) },
  yawn: {
    time: [2.4, 2.8],
    pose(q, P) { P.lArmX = -2.15; P.lArmZ = -0.45; P.headX = -0.32; P.pitch = -0.05; P.breathPeriod = 5.5; },
  },
  kickPebble: {
    time: [1.8, 2.2],
    pose(q, P, a) {
      P.headX = 0.4; P.headY = 0.1;
      if (q > 0.6 && q < 1.0) P.rLegX = -0.65 * a;
      if (q > 1.0) P.headY = 0.45; // ...and watches it roll away
    },
  },
};

// One bag per pool, shared by every Gibs on the page, so reopening the chat doesn't reset them.
const bags = {};
const deal = (key, items) => (bags[key] = bags[key] || new Bag(items)).next();

const STATE_REACTION = { answering: 'answer', pondering: 'ponder', error: 'error', greeting: 'greet' };

class GibsBrain {
  constructor(mode, calm) {
    this.mode = mode;
    this.calm = calm;
    this.state = 'idle';
    this.t = 0;
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
    this.reaction = null; // { def, start, lastK }
    this.thinking = null;
    this.thinkingSince = 0;
    this.nextThinkFxAt = 0;
    this.quirk = null; // { def, start, until }
    this.nextQuirkAt = rand(4, 7);
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
    this.quirk = null;
    const kind = STATE_REACTION[state];
    if (kind) {
      const name = deal(kind, Object.keys(REACTIONS[kind]));
      this.reaction = { def: REACTIONS[kind][name], start: this.t, lastK: -1 };
    } else if (state === 'listening' || state === 'thinking') {
      this.reaction = null; // you've moved on; so does he
    }
    // Going back to idle lets a reaction finish its bit instead of cutting it off.
    if (state === 'thinking') {
      this.thinking = THINKING[deal('thinking', Object.keys(THINKING))];
      this.thinkingSince = this.t;
      this.nextThinkFxAt = this.t + 0.5;
    }
    this.nextQuirkAt = Math.max(this.nextQuirkAt, this.t + rand(4, 7));
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
    const pool = this.mode === 'peek' ? ['thought', 'shifty'] : Object.keys(QUIRKS);
    const def = QUIRKS[deal('quirk-' + this.mode, pool)];
    this.quirk = { def, start: t, until: t + rand(...def.time) };
    this.nextQuirkAt = this.quirk.until + (this.mode === 'peek' ? rand(7, 12) : rand(5, 10));
    if (def.fx) this.emit(def.fx);
  }

  // Fires the reaction's "!"/"?" pops and hops as their moments pass.
  cue(r, k) {
    const a = this.calm ? 0 : 1;
    r.def.fx.forEach(([at, kind]) => { if (at > r.lastK && at <= k) this.emit(kind); });
    r.def.hops.forEach(([at, v]) => { if (at > r.lastK && at <= k) this.ch.hop.v = v * a; });
    r.lastK = k;
  }

  update(player, rawDt) {
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    this.t += dt;
    const t = this.t;
    const ch = this.ch;
    const skin = player.skin;
    const peekMode = this.mode === 'peek';
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

    // --- target pose, starting from relaxed and looking around
    const P = {
      headX: gazeX, headY: gazeY, headZ: 0,
      roll: this.weight * 0.6, yaw: gazeY * 0.22 + (peekMode ? 0 : drift(t * 0.15, 9) * 0.08 * a), pitch: 0,
      lArmX: 0, lArmZ: 0.06, rArmX: 0, rArmZ: -0.06, lLegX: 0, rLegX: 0,
      addHeadX: 0, addHeadY: 0, addLArmX: 0, addLArmZ: 0, addRArmX: 0, addRArmZ: 0, addRoll: 0,
      breathPeriod: 4.2,
    };

    if (this.state === 'listening') {
      // You're typing: he turns to the chat, leans in, and nods along.
      P.headY = 0.42; P.headX = 0.12; P.headZ = -0.05; P.roll = -0.03; P.yaw = 0.15;
      P.addHeadX = Math.sin(t * 3.2) * 0.035 * a;
    } else if (this.state === 'thinking' && this.thinking) {
      const fx = this.thinking(t - this.thinkingSince, P, a);
      P.breathPeriod = 3.8;
      if (t >= this.nextThinkFxAt) { this.emit(fx); this.nextThinkFxAt = t + rand(1.7, 2.6); }
    } else if (this.reaction) {
      const r = this.reaction;
      const k = t - r.start;
      this.cue(r, k);
      r.def.pose(k, P, a);
      if (k >= r.def.dur) {
        this.reaction = null;
        this.nextQuirkAt = Math.max(this.nextQuirkAt, t + rand(4, 7));
      }
    } else {
      if (!this.quirk && t >= this.nextQuirkAt && !this.calm) this.startQuirk(t);
      if (this.quirk && t >= this.quirk.until) this.quirk = null;
      if (this.quirk) this.quirk.def.pose(t - this.quirk.start, P, a);
    }

    // "!" the moment he's far enough out to have spotted you.
    const p = ch.peek.x;
    if (peekMode && !this.spotted && this.peekTarget === 1 && p > 0.7) {
      this.spotted = true;
      this.emit('!');
    }

    // --- ease every joint toward its target
    springTo(ch.peek, this.peekTarget, 3.4, dt);
    springTo(ch.roll, P.roll, 3.5, dt);
    springTo(ch.yaw, P.yaw, 3.5, dt);
    springTo(ch.pitch, peekMode ? 0 : P.pitch, 4, dt);
    springTo(ch.headX, P.headX, 8, dt);
    springTo(ch.headY, P.headY, 7, dt);
    springTo(ch.headZ, P.headZ, 6, dt);
    springTo(ch.lArmX, P.lArmX, 6.5, dt);
    springTo(ch.lArmZ, P.lArmZ, 6.5, dt);
    springTo(ch.rArmX, P.rArmX, 6.5, dt);
    springTo(ch.rArmZ, P.rArmZ, 6.5, dt);
    springTo(ch.lLegX, P.lLegX, 14, dt);
    springTo(ch.rLegX, P.rLegX, 14, dt);
    springTo(ch.hop, 0, 7, dt);

    // --- breathing and micro-movements, layered on top
    this.breathPhase = (this.breathPhase + dt / (P.breathPeriod + Math.sin(t * 0.07) * 0.4)) % 1;
    const b = breathCurve(this.breathPhase) * a;
    const hx = drift(t * 0.6, 4.1) * 0.025 * a;
    const hy = drift(t * 0.55, 1.3) * 0.035 * a;
    const hz = drift(t * 0.4, 2.2) * 0.03 * a;

    // Bowing pivots on his feet (y = -16), not his middle, so he doesn't slide off his shadow.
    const pitch = ch.pitch.x;
    const peekP = peekMode ? ch.peek.x : 0;
    player.position.x = peekMode ? PEEK.hideX + (PEEK.showX - PEEK.hideX) * peekP : 0;
    player.position.y = (peekMode ? PEEK.y : 0) + ch.hop.x - 16 * (1 - Math.cos(pitch));
    player.position.z = 16 * Math.sin(pitch);
    player.rotation.x = pitch;
    player.rotation.z = ch.roll.x + P.addRoll + PEEK.lean * peekP + drift(t * 0.25, 7) * 0.012 * a;
    player.rotation.y = ch.yaw.x + PEEK.yaw * peekP;

    skin.head.rotation.set(ch.headX.x + P.addHeadX + hx - 0.03 * b, ch.headY.x + P.addHeadY + hy, ch.headZ.x + hz);
    skin.head.position.y = 0.2 * b;
    skin.body.scale.set(1 + 0.012 * b, 1, 1 + 0.03 * b);
    skin.leftArm.position.y = -2 + 0.16 * b;
    skin.rightArm.position.y = -2 + 0.16 * b;
    skin.leftArm.rotation.set(ch.lArmX.x + P.addLArmX + drift(t * 0.45, 3) * 0.03 * a, 0, ch.lArmZ.x + P.addLArmZ + 0.025 * b);
    skin.rightArm.rotation.set(ch.rArmX.x + P.addRArmX + drift(t * 0.45, 5) * 0.03 * a, 0, ch.rArmZ.x + P.addRArmZ - 0.025 * b);
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
    fxClass(kind) {
      if (kind === '♪') return 'gibs-fx-note';
      return kind === '?' || kind === '…' ? 'gibs-fx-q' : 'gibs-fx-bang';
    },
    // "!" / "?" / "?!" / "♪" / "✦" / "…" pops above his head, wherever his head is on screen.
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
    <span v-for="fx in effects" :key="fx.id" class="gibs-fx" :class="fxClass(fx.kind)"
      :style="{ left: fx.x + 'px', top: fx.y + 'px' }">{{ fx.kind }}</span>
  </div>
  `,
};
