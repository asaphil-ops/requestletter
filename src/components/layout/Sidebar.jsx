import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { permissionsForRole } from '../../lib/permissions'
import { usePendingCounts } from '../../hooks/useDashboard'
import Swal from 'sweetalert2'

const SECTIONS = [
  {
    key: 'field', label: 'Field Operations', icon: 'fa-file-invoice',
    items: [
      { label: 'Request Letter', icon: 'fa-file-contract', to: '/requests', badge: 'req' },
      { label: 'SBAR / Transfer', icon: 'fa-exchange-alt', to: '/sbar', badge: 'sbar' },
      { label: 'IT Expenses', icon: 'fa-print', to: '/it-expenses', badge: 'it' },
      { label: 'Aircon & Toilet', icon: 'fa-tools', to: '/at-expenses', badge: 'at' },
      { label: 'Comms Expenses', icon: 'fa-bullhorn', to: '/comms-expenses', badge: 'comms' },
      { label: 'Request Letter Tracker', icon: 'fa-route', to: '/tracker' },
    ]
  },
  {
    key: 'cost', label: 'Cost Center', icon: 'fa-folder-tree',
    badge: 'otherCostCenter',
    items: [
      { label: 'CFOO Budget', icon: 'fa-chart-pie', to: '/cfoo-budget' },
      { label: 'Initiatives Monthly', icon: 'fa-lightbulb', to: '/cost-center/initiatives', badge: 'initiatives' },
      { label: 'CFOO Per Staff', icon: 'fa-user-tie', to: '/cost-center/cfoo', badge: 'cfoo' },
      { label: 'Other Cost Center', icon: 'fa-building-columns', to: '/cost-center/other' },
      { label: 'Data Management', icon: 'fa-database', to: '/data-management' },
      { label: 'Employee List', icon: 'fa-id-card', to: '/employee-list' },
    ]
  },
  {
    key: 'monitoring', label: 'Monitoring', icon: 'fa-chart-line',
    items: [
      { label: 'Circular & Admin Order', icon: 'fa-file-circle-check', to: '/circular' },
      { label: 'Lantaw', icon: 'fa-chart-pie', to: '/lantaw' },
      { label: 'Cash Flow', icon: 'fa-money-bill-wave', to: '/cashflow' },
      { label: 'Budget Monitoring', icon: 'fa-chart-line', to: '/budget' },
      { label: 'Reports', icon: 'fa-file-pdf', to: '/reports', permission: 'canViewReports' },
    ]
  },
  {
    key: 'admin', label: 'Admin Settings', icon: 'fa-shield-alt',
    adminSection: true,
    items: [
      { label: 'Directory', icon: 'fa-address-book', to: '/directory' },
      { label: 'Bulk Upload', icon: 'fa-file-upload', to: '/bulk-upload' },
      { label: 'Accounts', icon: 'fa-user-cog', to: '/users' },
      { label: 'Audit Logs', icon: 'fa-history', to: '/audit-logs' },
      { label: 'Settings', icon: 'fa-sliders-h', to: '/settings' },
    ]
  },
]

export default function Sidebar() {
  const auth = useAuthStore()
  const { user, isAdmin, logout } = auth
  const rolePermissions = permissionsForRole(user?.role)
  const { sidebarOpen, darkMode, toggleDarkMode } = useUIStore()
  const { data: pendingByBadge = {} } = usePendingCounts()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState({})

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
          {/* Dashboard — highlight like in screenshot */}
          <div className="mb-1">
            <NavLink to="/" end
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold relative
                ${isActive
                  ? 'bg-white text-gray-900 shadow-lg'
                  : 'text-white/70 hover:text-white hover:bg-white/8'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-400 rounded-r-full" />
                  )}
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0
                    ${isActive ? 'text-gray-700' : 'text-white/50'}`}>
                    <i className="fas fa-th-large text-[11px]" />
                  </div>
                  <span className="truncate">Dashboard</span>
                </>
              )}
            </NavLink>
          </div>

          {/* Guidelines — plain link like Dashboard */}
          <div className="mb-1">
            <NavLink to="/action-center"
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium relative
                ${isActive
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/65 hover:text-white hover:bg-white/8'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-400 rounded-r-full" />
                  )}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                    ${isActive ? 'text-white' : 'text-white/40'}`}>
                    <i className="fas fa-book-open text-xs" />
                  </div>
                  <span className="truncate">Guidelines</span>
                </>
              )}
            </NavLink>
          </div>

          {/* Collapsible sections */}
          {SECTIONS.map((sec) => {
            if (sec.adminSection && !isAdmin) return null
            const isCollapsed = collapsed[sec.key]
            const visibleItems = sec.items.filter(item => {
              if (item.permission && !(auth[item.permission] || rolePermissions[item.permission])) return false
              return true
            })
            if (!visibleItems.length) return null

            const HeaderIcon = sec.icon

            return (
              <div key={sec.key} className="mb-1">
                {/* Section header — clickable */}
                <button
                  onClick={() => setCollapsed(prev => ({ ...prev, [sec.key]: !prev[sec.key] }))}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-sm font-medium group mb-0.5 hover:bg-white/5"
                >
                  <i className={`fas ${HeaderIcon} text-xs text-white/35`} />
                  <span className="flex-1 text-left text-white/55 group-hover:text-white/85 font-semibold text-[11px] uppercase tracking-wider transition-colors">{sec.label}</span>
                  <i className={`fas fa-chevron-up text-[10px] text-white/25 transition-transform duration-200`} style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>

                {/* Section items — indented, rounded highlight */}
                {!isCollapsed && (
                  <div className="ml-1 space-y-0.5">
                    {visibleItems.map((item) => (
                      <NavLink key={item.to} to={item.to} end={item.to === '/'}
                        className={({ isActive }) =>
                          `group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-sm font-medium relative
                          ${isActive
                            ? 'bg-white/12 text-white'
                            : 'text-white/50 hover:text-white hover:bg-white/7'}`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-blue-400 rounded-r-full" />
                            )}
                            <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 transition-all
                              ${isActive ? 'text-white' : 'text-white/35 group-hover:text-white/60'}`}>
                              <i className={`fas ${item.icon} text-[10px]`} />
                            </div>
                            <span className="truncate">{item.label}</span>
                            {item.badge && (pendingByBadge[item.badge] || 0) > 0 && (
                              <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none flex items-center justify-center">
                                {pendingByBadge[item.badge] > 99 ? '99+' : pendingByBadge[item.badge]}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
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
