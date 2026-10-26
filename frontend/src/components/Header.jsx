// The title chalked at the top of the slate, with the kind of wobbly underline
// you get from dragging chalk along a board.
export default function Header() {
  return (
    <header className="header">
      <h1>
        Square <span className="accent">One</span>
        <span className="sparkle" aria-hidden="true">✦</span>
      </h1>

      <svg className="title-rule" viewBox="0 0 340 12" aria-hidden="true">
        <path
          d="M2 7 Q 44 1, 86 6 T 170 6 T 254 7 T 338 4"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>

      <p className="tagline">
        Private feedback on one Algebra 1 tutoring session about quadratics — only you see it.
      </p>
    </header>
  )
}
