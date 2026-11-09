import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useUpdateAccount } from '../../hooks/useAccounts'
import { uploadToDrive } from '../../lib/gas'
import { getDriveThumbnailUrl, getImageDisplayUrl } from '../../lib/utils'
import Swal from 'sweetalert2'
import { useNavigate } from 'react-router-dom'

export default function TopBar() {
  const { user, updatePhoto, logout } = useAuthStore()
  const { toggleSidebar, darkMode, toggleDarkMode, notifications, clearNotifications } = useUIStore()
  const updateAccount = useUpdateAccount()
  const [showProfile, setShowProfile] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [showCmd, setShowCmd] = useState(false)
  const [cmdQuery, setCmdQuery] = useState('')
  const [newPass, setNewPass] = useState('')
  const profileRef = useRef()
  const notifRef = useRef()
  const navigate = useNavigate()

  const QUICK_MODULES = [
    { label: 'Dashboard Overview', to: '/', icon: 'fa-th-large', group: 'Core' },
    { label: 'Request Letter', to: '/requests', icon: 'fa-file-contract', group: 'Field Operations' },
    { label: 'SBAR / Transfer', to: '/sbar', icon: 'fa-exchange-alt', group: 'Field Operations' },
    { label: 'IT Expenses', to: '/it-expenses', icon: 'fa-print', group: 'Field Operations' },
    { label: 'Aircon & Toilet', to: '/at-expenses', icon: 'fa-tools', group: 'Field Operations' },
    { label: 'Generator Expenses', to: '/generator-expenses', icon: 'fa-bolt', group: 'Field Operations' },
    { label: 'Comms Expenses', to: '/comms-expenses', icon: 'fa-bullhorn', group: 'Field Operations' },
    { label: 'Request Letter Tracker', to: '/tracker', icon: 'fa-route', group: 'Field Operations' },
    { label: 'Online Staff List', to: '/online-list', icon: 'fa-address-card', group: 'Field Operations' },
    { label: 'Employee List', to: '/employee-list', icon: 'fa-id-card', group: 'Employee Management' },
    { label: 'Budget Monitoring', to: '/budget', icon: 'fa-chart-line', group: 'Monitoring' },
    { label: 'Reports & Export', to: '/reports', icon: 'fa-file-pdf', group: 'Monitoring' },
    { label: 'Send Email', to: '/send-email', icon: 'fa-envelope', group: 'Actions' },
  ]

  const filteredCmdModules = QUICK_MODULES.filter(m =>
    !cmdQuery.trim() ||
    m.label.toLowerCase().includes(cmdQuery.toLowerCase()) ||
    m.group.toLowerCase().includes(cmdQuery.toLowerCase())
  )

  // Close profile/notif on outside click + Ctrl+K shortcut
  useEffect(() => {
    const fn = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
    }
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCmd((prev) => !prev)
      } else if (e.key === 'Escape') {
        setShowCmd(false)
      }
    }
    document.addEventListener('mousedown', fn)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', fn)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      Swal.fire({ title: 'Uploading...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
      const result = await uploadToDrive(file)
      const photoUrl = getDriveThumbnailUrl(result.fileId, 400) || result.viewUrl
      await updateAccount.mutateAsync({ username: user.username, updates: { photo_url: photoUrl } })
      updatePhoto(photoUrl)
      Swal.fire('Success', 'Profile picture updated', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleChangePassword = async () => {
    if (!newPass.trim()) return Swal.fire('Error', 'Enter new password', 'error')
    try {
      await updateAccount.mutateAsync({ username: user.username, updates: { password: newPass } })
      setNewPass('')
      Swal.fire('Success', 'Password updated', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleLogout = () => {
    setShowProfile(false)
    Swal.fire({
      title: 'Sign out of OPS-FIN?',
      text: 'You will need to sign in again to continue.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sign out',
      cancelButtonText: 'Stay signed in',
      confirmButtonColor: '#e11d48',
    }).then((result) => {
      if (result.isConfirmed) {
        logout()
        navigate('/login', { replace: true })
      }
    })
  }

  const unreadCount = notifications.length
  const initial = user?.full_name?.charAt(0).toUpperCase() || 'U'

  return (
    <>
    <header className="app-topbar h-16 backdrop-blur border-b flex items-center justify-between gap-3 px-3 sm:px-6 sticky top-0 z-[1200]">
      {/* Left: hamburger + quick jump search */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={toggleSidebar}
          aria-label="Toggle navigation menu"
          className="topbar-action w-9 h-9 rounded-lg border flex items-center justify-center transition-all flex-shrink-0"
        >
          <i className="fas fa-bars text-sm" />
        </button>

        <button
          type="button"
          onClick={() => { setShowCmd(true); setCmdQuery('') }}
          className="hidden sm:inline-flex items-center gap-2.5 h-9 px-3 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 transition-all w-56 lg:w-64"
          title="Quick jump to any module (Ctrl+K)"
        >
          <i className="fas fa-search text-[11px] text-slate-400" />
          <span className="truncate">Quick jump module...</span>
          <kbd className="ml-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right */}
      <div className="topbar-controls flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => { setShowCmd(true); setCmdQuery('') }}
          aria-label="Search modules"
          className="topbar-action sm:hidden w-9 h-9 rounded-lg border flex items-center justify-center transition-all flex-shrink-0"
        >
          <i className="fas fa-search text-sm" />
        </button>
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="topbar-action w-9 h-9 rounded-lg border flex items-center justify-center transition-all flex-shrink-0"
          title={darkMode ? 'Light Mode' : 'Dark Mode'}
        >
          <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'} text-sm`} />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            className="topbar-action w-9 h-9 rounded-lg border flex items-center justify-center transition-all relative flex-shrink-0"
          >
            <i className="fas fa-bell text-sm" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-11 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl dark:shadow-black/30 z-[1300]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
                <span className="font-semibold text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={clearNotifications} className="text-xs text-blue-600 dark:text-sky-300 hover:underline">Clear all</button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-400">No notifications</div>
                ) : notifications.map((n) => (
                  <div key={n.id} className="px-4 py-3 border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/70">
                    <div className="text-sm font-medium text-gray-800 dark:text-slate-200">{n.message}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{n.table?.replace('_', ' ')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            aria-label="Open account settings"
            aria-expanded={showProfile}
            className="flex items-center gap-2 cursor-pointer flex-shrink-0"
          >
            <div className="topbar-profile-text hidden min-w-0 text-right sm:block">
              <div className="max-w-40 truncate text-sm font-semibold text-gray-800 dark:text-slate-100">{user?.full_name || user?.username}</div>
              <div className="truncate text-xs text-gray-500 dark:text-slate-400">{user?.role}</div>
            </div>
            <div className="app-avatar w-9 h-9 rounded-full overflow-hidden border-2 flex items-center justify-center flex-shrink-0 relative">
              {user?.photo_url ? (
                <img src={getImageDisplayUrl(user.photo_url)} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-sm relative z-10">{initial}</span>
              )}
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-11 w-72 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl dark:shadow-black/30 z-[1300]">
              {/* Profile header */}
              <div className="p-4 text-center border-b border-gray-100 dark:border-slate-800 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-sky-950/60 rounded-t-xl">
                <div className="relative w-16 h-16 mx-auto mb-2">
                  <div className="app-avatar w-16 h-16 rounded-full overflow-hidden border-2 flex items-center justify-center">
                    {user?.photo_url ? (
                      <img src={getImageDisplayUrl(user.photo_url)} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-2xl">{initial}</span>
                    )}
                  </div>
                  <label htmlFor="photoUpload" className="absolute bottom-0 right-0 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center cursor-pointer">
                    <i className="fas fa-camera text-white text-[8px]" />
                  </label>
                  <input type="file" id="photoUpload" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                </div>
                <div className="font-semibold text-gray-800 dark:text-slate-100">{user?.full_name}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400">{user?.role}</div>
              </div>

              {/* Change password */}
              <div className="p-4">
                <div className="label mb-2">Change Password</div>
                <input
                  type="password"
                  className="input mb-2"
                  placeholder="New password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />
                <button onClick={handleChangePassword} className="btn-primary w-full">
                  Update Password
                </button>
              </div>
              <div className="border-t border-gray-100 p-3 dark:border-slate-800">
                <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">
                  <i className="fas fa-sign-out-alt text-xs" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    {showCmd && (
      <div className="fixed inset-0 z-[1600] flex items-start justify-center bg-slate-900/50 backdrop-blur-xs pt-16 sm:pt-24 px-4" onClick={() => setShowCmd(false)}>
        <div
          className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <i className="fas fa-search text-sm text-sky-500" />
            <input
              type="text"
              autoFocus
              value={cmdQuery}
              onChange={(e) => setCmdQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredCmdModules[0]) {
                  navigate(filteredCmdModules[0].to)
                  setShowCmd(false)
                }
              }}
              placeholder="Jump to module (e.g. Request Letter, SBAR, Budget)..."
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowCmd(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-slate-600"
            >
              ESC
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto p-2 space-y-1">
            {filteredCmdModules.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No matching modules found.</div>
            ) : (
              filteredCmdModules.map((mod) => (
                <button
                  key={mod.to}
                  type="button"
                  onClick={() => {
                    navigate(mod.to)
                    setShowCmd(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <i className={`fas ${mod.icon} text-xs`} />
                  </span>
                  <span className="flex-1 truncate font-semibold">{mod.label}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{mod.group}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
