// The ledge along the bottom of the board, with a few sticks of chalk and the
// eraser resting on it. Decorative only.
export default function ChalkTray() {
  return (
    <div className="chalk-tray" aria-hidden="true">
      <span className="chalk chalk-white" />
      <span className="chalk chalk-pink" />
      <span className="chalk chalk-yellow" />
      <span className="eraser" />
    </div>
  )
}
