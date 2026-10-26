import { useState } from 'react'
import { login, createAccount, setToken } from '../api.js'

// The gate. Sign in, or make an account — nothing else in the app is reachable
// until one of those succeeds.
//
// No email is ever sent: there is no verification step and no password reset,
// which is a real limitation and is stated on screen rather than hidden.
export default function LoginScreen({ onSignedIn }) {
  const [mode, setMode] = useState('login') // login | signup
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const signingUp = mode === 'signup'
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const result = signingUp
        ? await createAccount(form)
        : await login(form.email, form.password)

      setToken(result.token)
      onSignedIn(result.user)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  function switchMode() {
    setMode(signingUp ? 'login' : 'signup')
    setError('')
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={handleSubmit}>
        <h2>{signingUp ? 'Create an account' : 'Sign in'}</h2>
        <p className="hint">
          {signingUp
            ? 'Your sessions are tracked against this account, so your progress is yours alone.'
            : 'Square One keeps your coaching private to your own account.'}
        </p>

        {signingUp && (
          <div className="login-row">
            <label className="field">
              <span className="label">First name</span>
              <input className="tutor-input" value={form.firstName} onChange={set('firstName')}
                     autoComplete="given-name" required />
            </label>
            <label className="field">
              <span className="label">Last name</span>
              <input className="tutor-input" value={form.lastName} onChange={set('lastName')}
                     autoComplete="family-name" required />
            </label>
          </div>
        )}

        <label className="field">
          <span className="label">Email</span>
          <input className="tutor-input" type="email" value={form.email} onChange={set('email')}
                 autoComplete="email" required />
        </label>

        <label className="field">
          <span className="label">Password</span>
          <input className="tutor-input" type="password" value={form.password} onChange={set('password')}
                 autoComplete={signingUp ? 'new-password' : 'current-password'} required />
        </label>

        {signingUp && <p className="hint">At least 8 characters.</p>}

        {error && <p className="login-error">{error}</p>}

        <div className="actions">
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? 'One moment…' : signingUp ? 'Create account' : 'Sign in'}
          </button>
          <button className="button ghost" type="button" onClick={switchMode} disabled={busy}>
            {signingUp ? 'I already have an account' : 'Create an account'}
          </button>
        </div>

        <p className="hint login-note">
          No email is ever sent from this app — there is no verification message
          and no password reset, so keep your password somewhere safe.
        </p>
      </form>
    </div>
  )
}
