import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)

    if (mode === 'signin') {
      const { error } = await signIn(email, password)
      setBusy(false)
      if (error) return setError(error.message)
      navigate('/')
      return
    }

    const { error } = await signUp(email, password, fullName)
    setBusy(false)
    if (error) return setError(error.message)
    setInfo('Account created. Check your email to confirm, then sign in.')
    setMode('signin')
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Mechno Skill</h1>
        <p className="subtitle">{mode === 'signin' ? 'Staff Login' : 'Create Staff Account'}</p>
        {error && <div className="error-banner">{error}</div>}
        {info && <div className="info-banner">{info}</div>}
        {mode === 'signup' && (
          <label>
            Full Name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError('')
            setInfo('')
          }}
        >
          {mode === 'signin' ? 'New staff? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
