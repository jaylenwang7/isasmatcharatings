// Marks in Isa's strawberry pen. Each path has pathLength="1" so CSS can draw it on
// with stroke-dashoffset (see .pen-mark in index.css)

// A loose loop, stretched to circle whatever it sits behind
export const PenCircle = ({ className = '' }) => (
  <svg className={`pen-mark ${className}`} viewBox="0 0 120 100" preserveAspectRatio="none" aria-hidden="true">
    <path
      pathLength="1"
      vectorEffect="non-scaling-stroke"
      d="M78 9C50 2 14 14 9 46c-4 28 24 46 56 44 30-2 48-22 46-46C109 22 88 8 60 9 44 10 31 15 22 23"
    />
  </svg>
);

// A hanamaru, the flower Japanese teachers draw on a perfect paper: a loop around the
// letter that spirals out into petals. Only S grades get one
export const PenHanamaru = ({ className = '' }) => (
  <svg className={`pen-mark ${className}`} viewBox="0 0 140 120" aria-hidden="true">
    <path
      pathLength="1"
      d="M95.4 45.4 L92.7 42.6 L89.5 40.1 L86.0 38.0 L82.0 36.3 L77.9 35.1 L73.5 34.4 L69.1 34.2 L64.6 34.5 L60.2 35.3 L56.0 36.6 L52.1 38.4 L48.5 40.6 L45.3 43.2 L42.6 46.2 L40.4 49.5 L38.8 53.0 L37.8 56.6 L37.5 60.4 L37.8 64.1 L38.8 67.8 L40.3 71.4 L42.5 74.7 L45.3 77.8 L48.5 80.5 L52.2 82.8 L56.3 84.7 L60.7 86.1 L65.2 87.0 L69.9 87.3 L74.7 87.1 L79.3 86.4 L83.8 85.1 L88.0 83.3 L91.9 81.1 L95.4 78.4 L98.4 75.3 L100.8 71.9 L102.6 68.3 L103.8 64.4 L104.3 60.5 L104.1 56.5 L103.3 52.6 L101.7 48.8 L99.6 45.2 L96.8 41.9 L93.5 39.0 L89.7 36.4 L85.4 34.3 L85.1 31.4 L83.9 30.6 L82.7 29.6 L81.4 28.6 L80.1 27.6 L78.8 26.6 L77.3 25.6 L75.8 24.6 L74.2 23.7 L72.5 22.9 L70.7 22.1 L68.9 21.6 L67.0 21.1 L65.1 20.9 L63.2 20.8 L61.3 21.0 L59.4 21.4 L57.6 22.0 L56.0 22.9 L54.5 24.1 L53.3 25.7 L52.4 27.7 L50.4 27.5 L47.6 26.4 L44.9 25.5 L42.2 25.0 L39.7 25.0 L37.2 25.2 L34.9 25.7 L32.8 26.4 L30.7 27.3 L28.9 28.4 L27.3 29.7 L25.8 31.1 L24.7 32.8 L23.7 34.5 L23.1 36.3 L22.7 38.3 L22.6 40.3 L22.8 42.3 L23.3 44.4 L24.2 46.4 L25.4 48.5 L27.1 50.5 L27.6 52.1 L24.8 53.1 L22.5 54.4 L20.5 55.9 L18.9 57.5 L17.5 59.2 L16.4 61.0 L15.6 62.8 L15.1 64.7 L14.9 66.6 L15.0 68.5 L15.4 70.4 L16.1 72.2 L17.0 73.9 L18.2 75.5 L19.7 77.0 L21.4 78.3 L23.4 79.5 L25.6 80.5 L27.9 81.3 L30.5 81.8 L33.3 82.1 L36.9 81.6 L35.6 84.4 L35.2 86.8 L35.2 89.1 L35.6 91.2 L36.2 93.2 L37.1 95.1 L38.3 96.9 L39.7 98.4 L41.2 99.8 L43.0 101.0 L44.9 102.0 L47.0 102.8 L49.2 103.3 L51.4 103.6 L53.7 103.6 L56.1 103.4 L58.4 102.9 L60.7 102.2 L62.9 101.2 L65.1 99.9 L67.1 98.3 L69.0 96.2 L70.8 97.0 L72.7 98.9 L74.8 100.4 L76.9 101.6 L79.2 102.6 L81.5 103.3 L83.8 103.7 L86.1 103.9 L88.4 103.8 L90.7 103.5 L92.8 102.9 L94.9 102.1 L96.8 101.1 L98.5 99.8 L100.0 98.4 L101.4 96.8 L102.5 95.0 L103.3 93.1 L103.9 91.0 L104.2 88.9 L104.2 86.6 L103.7 84.1 L104.0 82.4 L107.2 82.6 L109.9 82.3 L112.4 81.7 L114.7 80.9 L116.9 79.8 L118.8 78.6 L120.4 77.3 L121.9 75.7 L123.0 74.1 L123.9 72.4 L124.6 70.6 L124.9 68.7 L124.9 66.8 L124.7 64.9 L124.1 63.0 L123.2 61.1 L122.1 59.4 L120.7 57.7 L119.0 56.1 L116.9 54.7 L114.5 53.4 L111.1 52.5 L113.7 50.5 L115.3 48.5 L116.4 46.4 L117.2 44.4 L117.6 42.3 L117.8 40.3 L117.6 38.3 L117.2 36.4 L116.5 34.6 L115.5 32.9 L114.3 31.3 L112.9 29.8 L111.2 28.6 L109.3 27.5 L107.2 26.6 L105.0 26.0 L102.7 25.6 L100.3 25.4 L97.7 25.4 L95.2 25.8"
    />
  </svg>
);

// A quick, slightly wavy underline
export const PenUnderline = ({ className = '' }) => (
  <svg className={`pen-mark ${className}`} viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">
    <path pathLength="1" vectorEffect="non-scaling-stroke" d="M3 7c22-3 44-4 66-3s34 2 48-1" />
  </svg>
);

// Two quick strokes, for closing a note
export const PenCross = ({ className = '' }) => (
  <svg className={`pen-mark ${className}`} viewBox="0 0 24 24" aria-hidden="true">
    <path pathLength="1" d="M5.5 5c4 4.5 8.5 9.5 13 14" />
    <path pathLength="1" d="M18.5 5.5C14 9.5 9.5 14 5 19" />
  </svg>
);
