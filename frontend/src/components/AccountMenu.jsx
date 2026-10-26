import { useEffect, useRef, useState } from 'react'

// The signed-in person's name, top right, with a menu that opens only on a
// click — never on hover. Closes on a click outside, on Escape, and after a
// choice is made.
export default function AccountMenu({ user, onViewProgress, onAccountSettings, onLogOut }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function choose(action) {
    setOpen(false)
    action()
  }

  return (
    <div className="account" ref={wrapRef}>
      <button
        type="button"
        className={`account-button ${open ? 'open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="account-name">{user.firstName} {user.lastName}</span>
        <span className="account-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="account-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => choose(onViewProgress)}>
            My progress
          </button>
          <button type="button" role="menuitem" onClick={() => choose(onAccountSettings)}>
            Account settings
          </button>
          <button type="button" role="menuitem" className="account-logout" onClick={() => choose(onLogOut)}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
