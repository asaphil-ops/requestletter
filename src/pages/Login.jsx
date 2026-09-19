import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogin, useSettings } from '../hooks/useAccounts'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { isSupabaseConfigured } from '../lib/supabase'

function newChallenge() {
  const first = Math.floor(Math.random() * 8) + 2
  const second = Math.floor(Math.random() * 8) + 2
  return { first, second, answer: first + second }
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [challenge, setChallenge] = useState(newChallenge)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const login = useLogin()
  const setUser = useAuthStore((s) => s.setUser)
  const initDarkMode = useUIStore((s) => s.initDarkMode)
  const { data: settings } = useSettings()
  const navigate = useNavigate()

  const refreshChallenge = () => {
    setChallenge(newChallenge())
    setCaptchaAnswer('')
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.')
      return
    }
    if (!captchaAnswer.trim() || Number(captchaAnswer) !== challenge.answer) {
      setError('Please solve the verification question correctly.')
      refreshChallenge()
      return
    }
    try {
      const user = await login.mutateAsync({ username, password })
      if (settings?.maintenance && !['Admin', 'Super Admin'].includes(user.role)) {
        setError('System is under maintenance. Please try again later.')
        refreshChallenge()
        return
      }
      setUser(user)
      initDarkMode()
      navigate('/')
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message || 'Invalid username or password.')
      refreshChallenge()
    }
  }

  return (
    <main className="login-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div aria-hidden="true" className="login-glow login-glow-one" />
      <div aria-hidden="true" className="login-glow login-glow-two" />
      <div className="relative z-10 w-full max-w-[440px]">
        <section className="login-card rounded-[28px] px-6 py-8 sm:px-9 sm:py-10">
          <div className="login-heading mb-8">
            <div className="login-badge mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />STAFF ACCESS
            </div>
            <h1 className="text-[30px] font-bold leading-tight tracking-tight text-white">Welcome back</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">Enter your account details to continue.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="login-username" className="mb-2 block text-sm font-semibold text-slate-200">Username or email</label>
              <div className="relative">
                <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-300" aria-hidden="true" />
                <input id="login-username" type="text" autoComplete="username" className="login-input pl-11" placeholder="Enter username or email" value={username} onChange={(event) => setUsername(event.target.value)} autoFocus required />
              </div>
            </div>
            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-semibold text-slate-200">Password</label>
              <div className="relative">
                <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-300" aria-hidden="true" />
                <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="login-input pl-11 pr-12" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-300 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="login-captcha rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label htmlFor="login-captcha" className="text-sm font-semibold text-slate-100">Security check</label>
                <button type="button" onClick={refreshChallenge} className="text-xs font-semibold text-orange-300 hover:text-white" aria-label="Get a new verification question">
                  <i className="fas fa-rotate-right mr-1" aria-hidden="true" />New question
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="login-equation min-w-[110px] rounded-xl px-3 py-3 text-center text-sm font-bold tracking-wide" aria-label={`${challenge.first} plus ${challenge.second}`}>
                  {challenge.first} + {challenge.second} = ?
                </span>
                <input id="login-captcha" type="number" inputMode="numeric" min="0" className="login-input min-w-0 flex-1 px-4" placeholder="Your answer" value={captchaAnswer} onChange={(event) => setCaptchaAnswer(event.target.value)} required />
              </div>
            </div>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
            {!isSupabaseConfigured && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">Missing Supabase environment variables in this deployment.</div>}
            <button type="submit" disabled={login.isPending || !isSupabaseConfigured} className="login-submit flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60">
              {login.isPending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />Signing in...</> : <>Sign in <i className="fas fa-arrow-right text-xs" aria-hidden="true" /></>}
            </button>
          </form>
        </section>
        <p className="mt-6 text-center text-xs font-medium text-slate-600"><i className="fas fa-shield-halved mr-1.5" aria-hidden="true" />Authorized personnel only</p>
      </div>
    </main>
  )
}
