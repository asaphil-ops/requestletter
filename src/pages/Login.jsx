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
  const [rememberLogin, setRememberLogin] = useState(false)
  const login = useLogin()
  const setUser = useAuthStore((s) => s.setUser)
  const setRememberMe = useAuthStore((s) => s.setRememberMe)
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
      setRememberMe(rememberLogin)
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
      {/* Subtle modern ambient glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-[430px]">
        <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-7 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/5 backdrop-blur-xl sm:p-9">
          <div className="mb-7 text-center">
            <img className="mx-auto mb-5 h-12 w-auto" src="/ops-fin-logo.svg" alt="OPS-FIN Operations Finance" />
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1 text-[11px] font-bold tracking-wider text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              STAFF ACCESS
            </div>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in with your account credentials to continue
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Username or email
              </label>
              <div className="relative">
                <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  className="login-input pl-10 pr-4 text-sm"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Password
              </label>
              <div className="relative">
                <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="login-input pl-10 pr-11 text-sm"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition-colors hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="login-remember" htmlFor="login-remember">
                <input
                  id="login-remember"
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(event) => setRememberLogin(event.target.checked)}
                />
                <span>Stay logged in</span>
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <label htmlFor="login-captcha" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Security verification
                </label>
                <button
                  type="button"
                  onClick={refreshChallenge}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 transition-colors hover:text-blue-800"
                  aria-label="Get a new verification question"
                >
                  <i className="fas fa-rotate-right text-[10px]" aria-hidden="true" />
                  Refresh
                </button>
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className="login-equation flex h-11 min-w-[108px] items-center justify-center rounded-xl px-3 text-center text-sm font-extrabold tracking-wide tabular-nums"
                  aria-label={`${challenge.first} plus ${challenge.second}`}
                >
                  {challenge.first} + {challenge.second} = ?
                </span>
                <input
                  id="login-captcha"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className="login-input !min-h-[44px] min-w-0 flex-1 px-3.5 text-sm tabular-nums"
                  placeholder="Answer"
                  value={captchaAnswer}
                  onChange={(event) => setCaptchaAnswer(event.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                <i className="fas fa-circle-exclamation text-rose-500" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {!isSupabaseConfigured && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
                Missing Supabase environment variables in this deployment.
              </div>
            )}

            <button
              type="submit"
              disabled={login.isPending || !isSupabaseConfigured}
              className="login-submit mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60"
            >
              {login.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <i className="fas fa-arrow-right text-xs" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </section>

        <p className="mt-5 text-center text-xs font-medium text-slate-500">
          <i className="fas fa-shield-halved mr-1.5 text-blue-600" aria-hidden="true" />
          Authorized personnel only
        </p>
      </div>
    </main>
  )
}
