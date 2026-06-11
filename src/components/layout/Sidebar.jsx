import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import Swal from 'sweetalert2'

const NAV = [
  { label: 'Dashboard', icon: 'fa-th-large', to: '/' },
  { section: 'Field Operations' },
  { label: 'Request Letter', icon: 'fa-file-contract', to: '/requests', badge: 'req' },
  { label: 'SBAR / Transfer', icon: 'fa-exchange-alt', to: '/sbar', badge: 'sbar' },
  { label: 'IT Expenses', icon: 'fa-print', to: '/it-expenses', badge: 'it' },
  { label: 'Aircon & Toilet', icon: 'fa-tools', to: '/at-expenses', badge: 'at' },
  { label: 'Comms Expenses', icon: 'fa-bullhorn', to: '/comms-expenses', badge: 'comms' },
  { label: 'Request Letter Tracker', icon: 'fa-route', to: '/tracker' },
  { section: 'Cost Center' },
{ label: 'CFOO Budget', icon: 'fa-chart-pie', to: '/cfoo-budget' },
{ label: 'Initiatives Monthly', icon: 'fa-lightbulb', to: '/cost-center/initiatives' },

  { label: 'CFOO Per Staff', icon: 'fa-user-tie', to: '/cost-center/cfoo' },
  { label: 'Other Cost Center', icon: 'fa-building-columns', to: '/cost-center/other' },
  { label: 'Data Management', icon: 'fa-database', to: '/data-management' },
  { label: 'Employee List', icon: 'fa-id-card', to: '/employee-list' },
  { section: 'Tools' },
  { label: 'Send to Email', icon: 'fa-paper-plane', to: '/send-email' },
  { section: 'Monitoring' },
  { label: 'Circular & Admin Order', icon: 'fa-file-circle-check', to: '/circular' },
  { label: 'Lantaw', icon: 'fa-chart-pie', to: '/lantaw' },
  { label: 'Cash Flow', icon: 'fa-money-bill-wave', to: '/cashflow' },
  { label: 'Budget Monitoring', icon: 'fa-chart-line', to: '/budget' },
  { section: 'Admin' },
  { label: 'Directory', icon: 'fa-users', to: '/directory' },
  { label: 'Bulk Upload', icon: 'fa-file-csv', to: '/bulk-upload', adminOnly: true },
  { label: 'Accounts', icon: 'fa-user-shield', to: '/users', adminOnly: true },
  { label: 'Audit Logs', icon: 'fa-history', to: '/audit-logs', adminOnly: true },
  { label: 'Settings', icon: 'fa-cogs', to: '/settings', adminOnly: true },
]

export default function Sidebar() {
  const { user, isAdmin, logout } = useAuthStore()
  const { sidebarOpen, darkMode, toggleDarkMode } = useUIStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    Swal.fire({ title: 'Sign Out?', icon: 'question', showCancelButton: true, confirmButtonText: 'Yes, sign out', confirmButtonColor: '#2563eb' })
      .then(r => { if (r.isConfirmed) { logout(); navigate('/login') } })
  }

  if (!sidebarOpen) return null

  return (
    <>
      {/* Overlay mobile */}
      <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => useUIStore.getState().setSidebar(false)} />

      <aside className="fixed top-0 left-0 h-screen w-[272px] bg-gradient-to-b from-[#0b1420] to-[#111d2e] z-50 flex flex-col shadow-2xl shadow-black/50 border-r border-white/5">
        {/* Header with logo */}
        <div className="relative px-6 pt-8 pb-6 flex flex-col items-center gap-2 overflow-hidden">
          {/* Decorative gradient blobs */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -left-12 w-28 h-28 bg-indigo-500/8 rounded-full blur-2xl" />

          <img
            src="https://asaphil.org/wp-content/themes/Philippines/asa-assets/images/Primary_logo.png"
            alt="ASA Logo"
            className="h-14 object-contain"
          />
          <span className="text-[10px] text-white/30 uppercase tracking-[2px] font-medium mt-1">Monitoring System</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          {NAV.map((item, i) => {
            if (item.section) return (
              <div key={i} className="flex items-center gap-2 pt-5 pb-1.5 px-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <span className="text-[9px] font-bold text-white/20 uppercase tracking-[2px]">{item.section}</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
            )
            if (item.adminOnly && !isAdmin) return null
            if (item.external) return (
              <a key={i} href={item.external} target="_blank" rel="noreferrer"
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/8 transition-all text-sm font-medium">
                <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-white/10 flex items-center justify-center flex-shrink-0 transition-colors">
                  <i className={`fas ${item.icon} text-xs opacity-75 group-hover:opacity-100`} />
                </div>
                <span className="truncate">{item.label}</span>
                <i className="fas fa-external-link-alt text-[9px] ml-auto opacity-0 group-hover:opacity-40 transition-opacity" />
              </a>
            )
            return (
              <NavLink key={i} to={item.to} end={item.to === '/'}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium relative
                  ${isActive
                    ? 'text-white bg-gradient-to-r from-blue-600/30 to-indigo-600/20 shadow-sm shadow-blue-500/10'
                    : 'text-white/50 hover:text-white hover:bg-white/8'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <>
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-400 to-indigo-400 rounded-r-full" />
                        <span className="absolute inset-0 rounded-xl ring-1 ring-blue-500/20" />
                      </>
                    )}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
                      ${isActive
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-500/30'
                        : 'bg-white/5 text-white/50 group-hover:bg-white/10 group-hover:text-white'}`}>
                      <i className={`fas ${item.icon} text-xs ${isActive ? 'opacity-100' : 'opacity-75'}`} />
                    </div>
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/5 space-y-1.5">
          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-all text-sm font-medium group"
          >
            <div className="w-7 h-7 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 flex items-center justify-center flex-shrink-0 transition-colors">
              <i className="fas fa-sign-out-alt text-xs" />
            </div>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
