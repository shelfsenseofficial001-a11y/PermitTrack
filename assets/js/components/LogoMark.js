// The PermitTrack mark as inline SVG, so it can be coloured, scaled and animated as artwork rather
// than shipped as a flat image. Rebuilt from assets/images/PermitTrackIcon.png in three parts:
//
//   the page    the document and its folded corner, traced from the icon as a filled outline
//   the shield  one stroke, from the top of the shield's right side, down round the point, to the curl
//   the arrow   the stroke carrying on from the curl up the swoosh, plus its head
//
// The shield and the arrow are strokes along the icon's own centreline (its skeleton, at the icon's
// stroke width) because that is what lets the arrow move: a stroke can be drawn on a little at a
// time, and the head can ride along the same line.
//
//   <LogoMark />            the mark, still
//   <LogoMark animated />   loading: the arrow launches from the curl, flies the swoosh with its trail
//                           drawing in behind it, lands, holds, then flies off as the trail chases
//                           it out — and goes again.
//
// The motion is SMIL (<animate>, <animateMotion>) rather than CSS, because the head has to follow a
// curve, and the trail and the head share one clock and one easing so they never drift apart.
// Reduced motion gets the still mark.

const PAGE = 'M5.65,0.57 L6.62,0.36 L28.75,0.36 L30.44,0.76 L31.61,1.43 L32.79,2.39 L41.02,10.47 L42.23,11.91 L43.21,13.59 L43.64,15.04 L43.67,17.44 L43.40,18.41 L42.71,19.37 L41.02,20.89 L39.98,21.35 L39.61,20.81 L39.55,17.68 L39.42,17.28 L39.02,16.88 L38.38,16.72 L31.16,16.70 L29.71,16.27 L28.51,15.47 L27.44,14.32 L26.77,12.87 L26.35,7.82 L26.32,5.41 L26.08,4.85 L25.60,4.53 L8.06,4.45 L7.10,4.64 L5.89,5.44 L5.17,6.38 L4.85,7.10 L4.69,8.30 L4.66,33.06 L4.29,33.72 L2.77,34.79 L1.38,36.16 L0.79,36.37 L0.60,35.73 L0.65,6.38 L1.06,4.93 L2.02,3.09 L3.49,1.70 L5.41,0.65Z';
const SHIELD = 'M42.21,34.29C42.10,34.61 41.80,35.29 41.57,36.21C41.34,37.13 41.04,38.94 40.81,39.82C40.58,40.70 40.51,40.86 40.19,41.50C39.87,42.15 39.37,42.99 38.89,43.67C38.41,44.35 38.10,44.82 37.33,45.59C36.57,46.37 35.56,47.34 34.29,48.32C33.02,49.30 31.12,50.61 29.71,51.48C28.31,52.35 26.91,53.05 25.86,53.53C24.82,54.02 24.26,54.26 23.46,54.40C22.66,54.54 21.77,54.50 21.05,54.40C20.33,54.30 20.21,54.29 19.13,53.79C18.05,53.30 15.76,52.12 14.56,51.43C13.35,50.75 12.83,50.33 11.91,49.68C10.99,49.04 9.85,48.23 9.02,47.55C8.20,46.87 7.52,46.24 6.97,45.59C6.42,44.95 6.02,44.35 5.72,43.67C5.42,42.99 5.26,41.86 5.17,41.50';
const ARROW = 'M5.17,41.50C5.19,41.30 5.18,40.70 5.30,40.30C5.42,39.91 5.65,39.49 5.91,39.13C6.17,38.77 6.51,38.41 6.87,38.14C7.23,37.86 6.18,37.86 8.06,37.49C9.94,37.12 15.20,36.49 18.17,35.92C21.13,35.36 23.42,34.86 25.86,34.09C28.31,33.33 30.76,32.26 32.84,31.33C34.93,30.41 36.53,29.63 38.38,28.54C40.22,27.46 42.23,26.06 43.91,24.81C45.59,23.55 47.33,22.05 48.48,21.02C49.64,19.99 49.79,19.88 50.84,18.65C51.89,17.41 54.14,14.45 54.80,13.61';
// ARROW, then straight on past the head for 20 units — the line the head flies off along.
const FLIGHT = 'M5.17,41.50C5.19,41.30 5.18,40.70 5.30,40.30C5.42,39.91 5.65,39.49 5.91,39.13C6.17,38.77 6.51,38.41 6.87,38.14C7.23,37.86 6.18,37.86 8.06,37.49C9.94,37.12 15.20,36.49 18.17,35.92C21.13,35.36 23.42,34.86 25.86,34.09C28.31,33.33 30.76,32.26 32.84,31.33C34.93,30.41 36.53,29.63 38.38,28.54C40.22,27.46 42.23,26.06 43.91,24.81C45.59,23.55 47.33,22.05 48.48,21.02C49.64,19.99 49.79,19.88 50.84,18.65C51.89,17.41 53.63,15.11 54.80,13.61C55.96,12.10 56.83,10.96 57.84,9.64C58.86,8.32 59.87,7.00 60.89,5.68C61.90,4.35 62.92,3.03 63.93,1.71C64.95,0.39 66.47,-1.60 66.98,-2.26';
// The arrowhead in its own frame: the middle of its base at the origin, pointing along +x, so
// <animateMotion rotate="auto"> can steer it along the curve. HEAD_AT puts it on the logo when still.
const HEAD = '14.12,-0.00 0.18,-8.47 -0.18,8.47';
const HEAD_AT = 'translate(54.80 13.61) rotate(-52.48)';
const STROKE = 4.52;
// How far along FLIGHT the head sits when it has landed on the logo (the end of ARROW).
const LAND = 0.7483;

// One loop, in fractions of DURATION: launch and fly the swoosh, hold on the finished logo, fly off
// as the trail is pulled after it, then a beat with no arrow before the next launch.
const DURATION = '2.4s';
const KEY_TIMES = '0;0.42;0.66;0.9;1';
const KEY_SPLINES = '0.55 0 0.25 1;0 0 1 1;0.6 0 0.9 0.5;0 0 1 1';
// The trail is a single dash the length of the arrow (pathLength="1"). 1.06 rather than 1 keeps the
// round cap out of sight while it waits off either end — the cap reaches half a stroke past the dash.
const TRAIL = '1.06;0;0;-1.06;-1.06';
const HEAD_POINTS = `0;${LAND};${LAND};1;1`;

let instances = 0;
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default {
  name: 'LogoMark',
  props: {
    animated: { type: Boolean, default: false },
    // The mark is one colour; pass currentColor to let a dark veil turn it white.
    color: { type: String, default: '#FFD100' },
  },
  data() {
    instances += 1;
    return {
      PAGE, SHIELD, ARROW, FLIGHT, HEAD, HEAD_AT, STROKE,
      DURATION, KEY_TIMES, KEY_SPLINES, TRAIL, HEAD_POINTS,
      // <mpath> finds its path by id, and the same mark is often on screen more than once.
      uid: 'pt-logo-' + instances,
      moving: this.animated && !prefersReducedMotion(),
    };
  },
  watch: {
    animated(on) { this.moving = on && !prefersReducedMotion(); },
  },
  template: `
  <svg viewBox="0 0 64 57.26" aria-hidden="true" class="pt-logo" :class="moving ? 'pt-logo-moving' : ''">
    <path :d="PAGE" :fill="color" fill-rule="evenodd" />
    <path :d="SHIELD" fill="none" :stroke="color" :stroke-width="STROKE" stroke-linecap="round" stroke-linejoin="round" />

    <template v-if="moving">
      <defs><path :id="uid + '-flight'" :d="FLIGHT" fill="none" /></defs>
      <path :d="ARROW" fill="none" :stroke="color" :stroke-width="STROKE" stroke-linecap="round" stroke-linejoin="round"
        pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="1.06">
        <animate attributeName="stroke-dashoffset" :dur="DURATION" repeatCount="indefinite"
          :values="TRAIL" :keyTimes="KEY_TIMES" calcMode="spline" :keySplines="KEY_SPLINES" />
      </path>
      <g opacity="0">
        <!-- grows out of the curl as it leaves, rather than appearing full size on the shield -->
        <polygon :points="HEAD" :fill="color" :stroke="color" stroke-width="0.6" stroke-linejoin="round">
          <animateTransform attributeName="transform" type="scale" :dur="DURATION" repeatCount="indefinite"
            values="0.25;1;1" keyTimes="0;0.16;1" calcMode="spline" keySplines="0.3 0 0.2 1;0 0 1 1" />
        </polygon>
        <animateMotion :dur="DURATION" repeatCount="indefinite" rotate="auto"
          :keyPoints="HEAD_POINTS" :keyTimes="KEY_TIMES" calcMode="spline" :keySplines="KEY_SPLINES">
          <mpath :href="'#' + uid + '-flight'" :xlink:href="'#' + uid + '-flight'" />
        </animateMotion>
        <animate attributeName="opacity" :dur="DURATION" repeatCount="indefinite"
          values="0;1;1;0;0" keyTimes="0;0.05;0.7;0.86;1" />
      </g>
    </template>
    <template v-else>
      <path :d="ARROW" fill="none" :stroke="color" :stroke-width="STROKE" stroke-linecap="round" stroke-linejoin="round" />
      <polygon :points="HEAD" :transform="HEAD_AT" :fill="color" :stroke="color" stroke-width="0.6" stroke-linejoin="round" />
    </template>
  </svg>
  `,
};
