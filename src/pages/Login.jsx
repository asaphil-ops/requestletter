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
    <div className="min-h-screen bg-gradient-to-b from-[#0b1420] to-[#111d2e] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Corner accent borders */}
      <div className="absolute top-0 left-0 w-48 h-48 border-l-4 border-t-4 border-blue-400/20 rounded-tl-3xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-48 h-48 border-r-4 border-t-4 border-blue-400/20 rounded-tr-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 border-l-4 border-b-4 border-blue-400/20 rounded-bl-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-48 h-48 border-r-4 border-b-4 border-blue-400/20 rounded-br-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header with logo */}
          <div className="px-8 pt-10 pb-6 text-center border-b border-white/10">
            <div className="flex justify-center mb-5">
              <img
                src="https://asaphil.org/wp-content/themes/Philippines/asa-assets/images/Primary_logo.png"
                alt="ASA Logo"
                className="h-20 object-contain brightness-0 invert"
              />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Sign In</h1>
            <p className="text-blue-200/60 text-sm mt-1 font-medium">Finance Operations Portal</p>
          </div>

          <form onSubmit={handleLogin} className="px-8 pb-8 pt-6 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-blue-200/70 uppercase tracking-widest">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-300/40 group-focus-within:text-blue-300 transition-colors">
                  <i className="fas fa-user text-sm" />
                </div>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-blue-200/30 focus:outline-none focus:bg-white/10 focus:border-blue-400/50 transition-all"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-blue-200/70 uppercase tracking-widest">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-300/40 group-focus-within:text-blue-300 transition-colors">
                  <i className="fas fa-lock text-sm" />
                </div>
                <input
                  type="password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-blue-200/30 focus:outline-none focus:bg-white/10 focus:border-blue-400/50 transition-all"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
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
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm tracking-wide transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
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

            <p className="text-center text-[11px] text-blue-300/30 flex items-center justify-center gap-1.5 pt-1">
              <i className="fas fa-shield-alt text-blue-400/30" />
              Authorized Personnel Only
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
