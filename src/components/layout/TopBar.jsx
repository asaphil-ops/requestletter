import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useUpdateAccount } from '../../hooks/useAccounts'
import { uploadToDrive } from '../../lib/gas'
import Swal from 'sweetalert2'

export default function TopBar() {
  const { user, updatePhoto } = useAuthStore()
  const { toggleSidebar, darkMode, toggleDarkMode, notifications, clearNotifications } = useUIStore()
  const updateAccount = useUpdateAccount()
  const [showProfile, setShowProfile] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [newPass, setNewPass] = useState('')
  const profileRef = useRef()
  const notifRef = useRef()

  // Close on outside click
  useEffect(() => {
    const fn = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
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
      await updateAccount.mutateAsync({ username: user.username, updates: { photo_url: result.viewUrl } })
      updatePhoto(result.viewUrl)
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

  return (
    <header className="h-16 bg-gray-50/90 dark:bg-[#071427]/90 backdrop-blur border-b border-gray-200 dark:border-slate-800/80 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30">
      {/* Left: hamburger */}
      <button
        onClick={toggleSidebar}
        className="w-9 h-9 rounded-lg border border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all flex-shrink-0"
      >
        <i className="fas fa-bars text-sm" />
      </button>

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
            <div className="absolute right-0 top-11 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl dark:shadow-black/30 z-50">
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
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer"
          >
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">{user?.full_name}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400">{user?.role}</div>
            </div>
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-gray-200 dark:border-sky-300/30 bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center flex-shrink-0">
              {user?.photo_url ? (
                <img src={user.photo_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-sm">{initial}</span>
              )}
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-11 w-72 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl dark:shadow-black/30 z-50">
              {/* Profile header */}
              <div className="p-4 text-center border-b border-gray-100 dark:border-slate-800 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-sky-950/60 rounded-t-xl">
                <div className="relative w-16 h-16 mx-auto mb-2">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 dark:border-sky-300/30 bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center">
                    {user?.photo_url ? (
                      <img src={user.photo_url} alt="avatar" className="w-full h-full object-cover" />
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