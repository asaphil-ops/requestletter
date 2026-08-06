import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogin } from '../hooks/useAccounts'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { useSettings } from '../hooks/useAccounts'
import { isSupabaseConfigured } from '../lib/supabase'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const login = useLogin()
  const setUser = useAuthStore((s) => s.setUser)
  const initDarkMode = useUIStore((s) => s.initDarkMode)
  const { data: settings } = useSettings()
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e?.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password.')
      return
    }
    try {
      const user = await login.mutateAsync({ username, password })
      if (settings?.maintenance && !['Admin', 'Super Admin'].includes(user.role)) {
        setError('System is under maintenance. Please try again later.')
        return
      }
      setUser(user)
      initDarkMode()
      navigate('/')
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid username or password');
    }
  }

  return (
    <div className="min-h-screen bg-[#071426] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Corner accent borders */}
      <div className="absolute top-0 left-0 w-48 h-48 border-l-4 border-t-4 border-blue-400/20 rounded-tl-3xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-48 h-48 border-r-4 border-t-4 border-blue-400/20 rounded-tr-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 border-l-4 border-b-4 border-blue-400/20 rounded-bl-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-48 h-48 border-r-4 border-b-4 border-blue-400/20 rounded-br-3xl pointer-events-none" />

      <div className="w-full max-w-5xl relative grid overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden min-h-[610px] flex-col justify-between overflow-hidden bg-[#0b1e38] p-12 text-white lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_40%)]" />
          <div className="relative"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-sky-300">ASA Philippines Foundation</p><h2 className="mt-5 max-w-md text-4xl font-extrabold leading-tight tracking-tight">Finance operations, clearly connected.</h2><p className="mt-4 max-w-md text-base leading-7 text-slate-300">Manage requests, monitor budgets, and keep operational decisions moving from one secure workspace.</p></div>
          <div className="relative grid grid-cols-3 gap-3">{['Secure access', 'Unified records', 'Clear approvals'].map((item, index) => <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4"><i className={`fas ${['fa-shield-halved', 'fa-layer-group', 'fa-circle-check'][index]} mb-3 text-sky-300`} /><div className="text-xs font-bold text-slate-200">{item}</div></div>)}</div>
        </section>
        <div className="flex items-center bg-white">
        <div className="w-full px-7 py-10 sm:px-12">
          {/* Header with logo */}
          <div className="pb-7 text-left">
            <div className="mb-7 flex h-14 items-center">
              <img
                src="https://asaphil.org/wp-content/themes/Philippines/asa-assets/images/Primary_logo.png"
                alt="ASA Logo"
                className="h-14 max-w-[190px] object-contain"
              />
            </div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">Finance Operations Portal</p>
            <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-2 font-medium">Sign in with your authorized account.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="label">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600">
                  <i className="fas fa-user text-sm" />
                </div>
                <input
                  type="text"
                  className="input pl-10"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="label">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600">
                  <i className="fas fa-lock text-sm" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-10 pr-11"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700" aria-label={showPassword ? 'Hide password' : 'Show password'}><i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} /></button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-400/30 text-red-200 text-sm rounded-xl px-4 py-3 font-medium flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-exclamation-circle text-xs text-red-300" />
                </div>
                {error}
              </div>
            )}

            {!isSupabaseConfigured && (
              <div className="bg-amber-500/10 border border-amber-400/30 text-amber-100 text-sm rounded-xl px-4 py-3 font-medium flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-triangle-exclamation text-xs text-amber-200" />
                </div>
                Missing Supabase environment variables in this deployment.
              </div>
            )}

            <button
              type="submit"
              disabled={login.isPending || !isSupabaseConfigured}
              className="btn-primary w-full min-h-12 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {login.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt" /> Sign In
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5 pt-1">
              <i className="fas fa-shield-alt text-slate-400" />
              Authorized Personnel Only
            </p>
          </form>
        </div></div>
      </div>
    </div>
  )
}
