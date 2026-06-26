import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useUpdateAccount } from '../../hooks/useAccounts'
import { uploadToDrive } from '../../lib/gas'
import { getDriveThumbnailUrl, getImageDisplayUrl } from '../../lib/utils'
import Swal from 'sweetalert2'

export default function TopBar() {
  const { user, updatePhoto } = useAuthStore()
  const { toggleSidebar, darkMode, toggleDarkMode, notifications, clearNotifications } = useUIStore()
  const navigate = useNavigate()
  const location = useLocation()
  const updateAccount = useUpdateAccount()
  const [showProfile, setShowProfile] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const profileRef = useRef()
  const notifRef = useRef()
  const searchRef = useRef()

  // Keyboard shortcut: Ctrl+K to search
  useEffect(() => {
    const fn = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(prev => !prev)
      }
      if (e.key === 'Escape') setShowSearch(false)
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  // Close profile/notif on outside click
  useEffect(() => {
    const fn = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
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

  const unreadCount = notifications.length
  const initial = user?.full_name?.charAt(0).toUpperCase() || 'U'

  // Quick-search destinations
  const searchDestinations = useMemo(() => [
    { label: 'Dashboard', path: '/', icon: 'fa-th-large' },
    { label: 'Requests', path: '/requests', icon: 'fa-file-alt' },
    { label: 'SBAR', path: '/sbar', icon: 'fa-exchange-alt' },
    { label: 'IT Expenses', path: '/it-expenses', icon: 'fa-laptop' },
    { label: 'Aircon/Toilet Expenses', path: '/at-expenses', icon: 'fa-fan' },
    { label: 'Comms Expenses', path: '/comms-expenses', icon: 'fa-phone' },
    { label: 'CFOO Budget', path: '/cfoo-budget', icon: 'fa-chart-pie' },
    { label: 'Initiatives Expenses', path: '/cost-center/initiatives', icon: 'fa-lightbulb' },
    { label: 'CFOO Expenses', path: '/cost-center/cfoo', icon: 'fa-users' },
    { label: 'Other Cost Center', path: '/cost-center/other', icon: 'fa-building' },
    { label: 'Data Management', path: '/data-management', icon: 'fa-database' },
    { label: 'Employee List', path: '/employee-list', icon: 'fa-id-card' },
    { label: 'Send Email', path: '/send-email', icon: 'fa-paper-plane' },
    { label: 'Reports', path: '/reports', icon: 'fa-chart-bar' },
    { label: 'Directory', path: '/directory', icon: 'fa-address-book' },
    { label: 'Bulk Upload', path: '/bulk-upload', icon: 'fa-upload' },
    { label: 'Audit Logs', path: '/audit-logs', icon: 'fa-history' },
    { label: 'Settings', path: '/settings', icon: 'fa-cog' },
  ], [])

  const filteredSearch = useMemo(() => {
    if (!searchQuery.trim()) return searchDestinations.slice(0, 6)
    return searchDestinations.filter(d =>
      d.label.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 8)
  }, [searchQuery, searchDestinations])

  const handleSearchSelect = (path) => {
    navigate(path)
    setShowSearch(false)
    setSearchQuery('')
  }

  return (
    <header className="h-16 bg-gray-50/90 dark:bg-[#071427]/90 backdrop-blur border-b border-gray-200 dark:border-slate-800/80 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-[1200]">
      {/* Left: hamburger */}
      <button
        onClick={toggleSidebar}
        className="w-9 h-9 rounded-lg border border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all flex-shrink-0"
      >
        <i className="fas fa-bars text-sm" />
      </button>

      {/* Center: Global Search (desktop) */}
      <div className="hidden md:flex flex-1 max-w-md mx-4" ref={searchRef}>
        {showSearch && (
          <div className="w-full relative">
            <div className="flex items-center bg-white dark:bg-slate-900 border border-blue-300 dark:border-sky-500 rounded-lg shadow-lg px-3 py-2 gap-2">
              <i className="fas fa-search text-gray-400 text-xs" />
              <input
                autoFocus
                type="text"
                placeholder="Search pages... (Ctrl+K)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && filteredSearch.length > 0) handleSearchSelect(filteredSearch[0].path)
                }}
                className="flex-1 outline-none text-sm bg-transparent text-gray-800 dark:text-white placeholder-gray-400"
              />
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700">ESC</kbd>
            </div>
            {filteredSearch.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl dark:shadow-black/30 z-[1300] max-h-80 overflow-y-auto">
                {filteredSearch.map(d => {
                  const active = location.pathname === d.path
                  return (
                    <button
                      key={d.path}
                      onClick={() => handleSearchSelect(d.path)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${active ? 'bg-blue-50 dark:bg-sky-950/40 text-blue-700 dark:text-sky-300' : 'text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                    >
                      <i className={`fas ${d.icon} w-5 text-center ${active ? 'text-blue-500 dark:text-sky-400' : 'text-gray-400'}`} />
                      <span className="truncate">{d.label}</span>
                      {active && <span className="ml-auto text-[9px] font-bold bg-blue-100 dark:bg-sky-900/50 text-blue-600 dark:text-sky-300 px-1.5 py-0.5 rounded">NOW</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {!showSearch && (
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-400 text-sm hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
          >
            <i className="fas fa-search text-xs" />
            <span>Search...</span>
            <kbd className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700">Ctrl+K</kbd>
          </button>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-9 h-9 rounded-lg border border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all flex-shrink-0"
          title={darkMode ? 'Light Mode' : 'Dark Mode'}
        >
          <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'} text-sm`} />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="w-9 h-9 rounded-lg border border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all relative flex-shrink-0"
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
            className="flex items-center gap-2 cursor-pointer flex-shrink-0"
          >
            <div className="text-right hidden sm:block min-w-0">
              <div className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">{user?.full_name}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{user?.role}</div>
            </div>
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-gray-200 dark:border-sky-300/30 bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center flex-shrink-0 relative">
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
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 dark:border-sky-300/30 bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center">
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
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
