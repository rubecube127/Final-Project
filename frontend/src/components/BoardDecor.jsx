// Chalk doodles left on the board around the app: a few stray symbols, a
// worked quadratic in the corner, and a sketched parabola.
//
// Purely decorative. It sits behind the content, ignores the mouse, and is
// hidden from screen readers — none of it is real output from the pipeline.
export default function BoardDecor() {
  return (
    <div className="decor" aria-hidden="true">
      <span className="doodle doodle-pi">π</span>
      <span className="doodle doodle-root">√</span>
      <span className="doodle doodle-pm">±</span>
      <span className="doodle doodle-div">÷</span>

      {/* A worked example, the sort already on the board when class starts. */}
      <div className="worked">
        <p className="worked-line">x² − 5x + 6 = 0</p>
        <p className="worked-line worked-indent">(x − 2)(x − 3) = 0</p>
        <p className="worked-line worked-answer">x = 2, 3</p>
        <svg className="worked-underline" viewBox="0 0 160 14">
          <path d="M4 6 Q 48 13, 92 7 T 156 9" fill="none" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      {/* The parabola those roots come from, with the roots marked. */}
      <svg className="parabola" viewBox="0 0 220 110">
        <line className="parabola-axis" x1="6" y1="94" x2="214" y2="94" strokeWidth="3" strokeLinecap="round" />
        <path
          className="parabola-curve"
          d="M18 94 Q 110 -24, 202 94"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle className="parabola-root" cx="18" cy="94" r="7" />
        <circle className="parabola-root" cx="202" cy="94" r="7" />
      </svg>
    </div>
  )
}
