import { useState } from 'react'
import { updateAccount } from '../api.js'

// Change email or password. The current password is required either way —
// holding the browser session is not enough to take the account over.
export default function AccountSettings({ user, onUpdated, onClose }) {
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setStatus(null)

    try {
      const changes = { currentPassword }
      if (email !== user.email) changes.email = email
      if (newPassword) changes.newPassword = newPassword

      if (!changes.email && !changes.newPassword) {
        setStatus({ kind: 'error', message: 'Nothing to change yet.' })
        return
      }

      const result = await updateAccount(changes)
      onUpdated(result.user)
      setCurrentPassword('')
      setNewPassword('')
      setStatus({ kind: 'ok', message: 'Saved.' })
    } catch (problem) {
      setStatus({ kind: 'error', message: problem.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="panel-head">
        <h2>Account settings</h2>
        <button className="button ghost" type="button" onClick={onClose}>Back</button>
      </div>

      <label className="field">
        <span className="label">Email</span>
        <input className="tutor-input" type="email" value={email}
               onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
      </label>

      <label className="field">
        <span className="label">New password</span>
        <input className="tutor-input" type="password" value={newPassword}
               onChange={(event) => setNewPassword(event.target.value)}
               placeholder="leave blank to keep it" autoComplete="new-password" />
      </label>

      <label className="field">
        <span className="label">Current password</span>
        <input className="tutor-input" type="password" value={currentPassword}
               onChange={(event) => setCurrentPassword(event.target.value)}
               autoComplete="current-password" required />
      </label>
      <p className="hint">Required to confirm any change.</p>

      {status && <p className={`upload-status ${status.kind}`}>{status.message}</p>}

      <div className="actions">
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <p className="hint login-note">
        Changing your email takes effect immediately. No confirmation message is
        sent — this app does not send email of any kind.
      </p>
    </form>
  )
}
