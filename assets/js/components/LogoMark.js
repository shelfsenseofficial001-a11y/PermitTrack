// The PermitTrack mark as inline SVG, traced from assets/images/PermitTrackIcon.png (outline
// smoothed so the pixel staircase doesn't show at large sizes) so it can be
// coloured, scaled and animated as artwork instead of shipped as a flat image. Two pieces, because
// they move separately while loading: the page (the document and its folded corner) and the rise
// (the shield and the arrow leaving it).
//
//   <LogoMark />                 still, currentColor
//   <LogoMark animated />        the loading loop: the mark floats, the arrow pulls away and settles
//
// The loop is deliberately gentle and never resets with a jolt — every keyframe returns to where it
// started. prefers-reduced-motion stops it outright (see index.html).
const PAGE = 'M5.65,0.57 L6.62,0.36 L28.75,0.36 L30.44,0.76 L31.61,1.43 L32.79,2.39 L41.02,10.47 L42.23,11.91 L43.21,13.59 L43.64,15.04 L43.67,17.44 L43.40,18.41 L42.71,19.37 L41.02,20.89 L39.98,21.35 L39.61,20.81 L39.55,17.68 L39.42,17.28 L39.02,16.88 L38.38,16.72 L31.16,16.70 L29.71,16.27 L28.51,15.47 L27.44,14.32 L26.77,12.87 L26.35,7.82 L26.32,5.41 L26.08,4.85 L25.60,4.53 L8.06,4.45 L7.10,4.64 L5.89,5.44 L5.17,6.38 L4.85,7.10 L4.69,8.30 L4.66,33.06 L4.29,33.72 L2.77,34.79 L1.38,36.16 L0.79,36.37 L0.60,35.73 L0.65,6.38 L1.06,4.93 L2.02,3.09 L3.49,1.70 L5.41,0.65Z';
const RISE = 'M63.08,2.82 L63.48,2.95 L63.64,3.49 L63.18,5.89 L62.92,10.23 L62.46,12.39 L62.17,16.72 L61.90,17.92 L61.58,18.46 L61.31,18.57 L60.75,18.33 L57.78,15.89 L56.96,15.84 L56.21,16.48 L53.05,20.33 L50.17,23.11 L45.35,26.96 L42.71,28.83 L39.37,30.86 L33.80,33.62 L29.23,35.46 L21.05,37.73 L15.04,38.83 L10.95,39.10 L9.74,39.34 L8.38,40.14 L7.61,41.26 L7.63,42.57 L8.38,43.91 L10.23,45.83 L11.67,46.98 L15.52,49.60 L17.68,50.83 L21.53,52.57 L22.98,52.57 L26.59,50.94 L28.83,49.63 L33.56,46.26 L36.45,43.43 L37.57,41.98 L38.91,39.58 L39.31,38.14 L39.58,34.53 L39.85,33.70 L40.97,32.82 L42.92,31.72 L43.40,31.64 L43.67,32.12 L43.64,37.89 L43.38,39.10 L42.01,42.95 L40.86,44.77 L38.40,47.68 L36.50,49.36 L33.64,51.48 L30.68,53.40 L25.62,56.10 L23.22,56.85 L21.77,56.90 L20.57,56.69 L18.17,55.81 L15.52,54.44 L12.39,52.62 L9.26,50.49 L5.89,47.76 L3.11,44.39 L2.37,42.71 L2.34,39.82 L2.87,38.38 L3.76,37.23 L4.45,36.64 L5.65,35.89 L7.10,35.36 L9.98,34.79 L11.91,34.77 L14.08,34.31 L16.96,34.02 L23.57,32.55 L28.27,30.84 L31.88,29.26 L35.97,27.20 L41.98,23.19 L45.83,20.06 L48.88,17.02 L52.12,13.11 L52.44,12.42 L52.33,11.62 L49.02,9.16 L48.78,8.62 L49.02,8.22 L55.94,5.41 L62.89,2.85Z';

export default {
  name: 'LogoMark',
  props: {
    animated: { type: Boolean, default: false },
    // The mark is one colour; inherit it so a loader on a dark veil can go white.
    color: { type: String, default: '#FFD100' },
  },
  data: () => ({ PAGE, RISE }),
  template: `
  <svg viewBox="0 0 64 57.26" :fill="color" fill-rule="evenodd" aria-hidden="true"
    :class="animated ? 'pt-logo pt-logo-animated' : 'pt-logo'">
    <g class="pt-logo-float">
      <path class="pt-logo-page" :d="PAGE" />
      <path class="pt-logo-rise" :d="RISE" />
    </g>
  </svg>
  `,
};
