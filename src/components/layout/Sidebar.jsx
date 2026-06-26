import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { permissionsForRole } from '../../lib/permissions'
import { usePendingCounts } from '../../hooks/useDashboard'
import { ADMIN_ROLES, SUPER_ADMIN_ROLES } from '../../lib/utils'
import Swal from 'sweetalert2'

const SECTIONS = [
  {
    key: 'field',
    label: 'Field Operations',
    icon: 'fa-file-invoice',
    items: [
      { label: 'Request Letter', icon: 'fa-file-contract', to: '/requests', badge: 'req' },
      { label: 'SBAR / Transfer', icon: 'fa-exchange-alt', to: '/sbar', badge: 'sbar' },
      { label: 'IT Expenses', icon: 'fa-print', to: '/it-expenses', badge: 'it' },
      { label: 'Aircon & Toilet', icon: 'fa-tools', to: '/at-expenses', badge: 'at' },
      { label: 'Comms Expenses', icon: 'fa-bullhorn', to: '/comms-expenses', badge: 'comms' },
      { label: 'Request Letter Tracker', icon: 'fa-route', to: '/tracker' },
      { label: 'Online List', icon: 'fa-address-card', to: '/online-list' },
    ],
  },
  {
    key: 'cost',
    label: 'Cost Center',
    icon: 'fa-folder-tree',
    badge: 'otherCostCenter',
    items: [
      { label: 'CFOO Budget', icon: 'fa-chart-pie', to: '/cfoo-budget' },
      { label: 'Initiatives Monthly', icon: 'fa-lightbulb', to: '/cost-center/initiatives', badge: 'initiatives' },
      { label: 'CFOO Per Staff', icon: 'fa-user-tie', to: '/cost-center/cfoo', badge: 'cfoo' },
      { label: 'Other Cost Center', icon: 'fa-building-columns', to: '/cost-center/other' },
      { label: 'Data Management', icon: 'fa-database', to: '/data-management' },
      { label: 'Employee List', icon: 'fa-id-card', to: '/employee-list' },
    ],
  },
  {
    key: 'monitoring',
    label: 'Monitoring',
    icon: 'fa-chart-line',
    items: [
      { label: 'Circular & Admin Order', icon: 'fa-file-circle-check', to: '/circular' },
      { label: 'Lantaw', icon: 'fa-chart-pie', to: '/lantaw' },
      { label: 'Cash Flow', icon: 'fa-money-bill-wave', to: '/cashflow' },
      { label: 'Budget Monitoring', icon: 'fa-chart-line', to: '/budget' },
      { label: 'Reports', icon: 'fa-file-pdf', to: '/reports', permission: 'canViewReports' },
    ],
  },
  {
    key: 'compliance',
    label: 'Compliance',
    icon: 'fa-clipboard-check',
    items: [
      { label: 'COR and DOLE Certificate', icon: 'fa-certificate', to: '/compliance/cor-dole' },
    ],
  },
    {
      key: 'admin',
      label: 'Admin Settings',
      icon: 'fa-shield-alt',
      adminSection: true,
      items: [
        { label: 'Directory', icon: 'fa-address-book', to: '/directory' },
        { label: 'Bulk Upload', icon: 'fa-file-upload', to: '/bulk-upload' },
        { label: 'Accounts', icon: 'fa-user-cog', to: '/users' },
        { label: 'Audit Logs', icon: 'fa-history', to: '/audit-logs' },
        { label: 'Settings', icon: 'fa-sliders-h', to: '/settings' },
      ],
    },
    {
      key: 'superadmin',
      label: 'Super Admin',
      icon: 'fa-user-secret',
      superAdminSection: true,
      items: [
        { label: 'Data Management', icon: 'fa-database', to: '/data-management', permission: 'canManageData' },
      ],
    },
  ]

function Badge({ value }) {
  if (!value) return null
  return (
    <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
      {value > 99 ? '99+' : value}
    </span>
  )
}

function MainLink({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
          isActive
            ? 'bg-sky-500 text-white shadow-lg shadow-sky-950/30'
            : 'text-slate-300 hover:bg-white/8 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white" />}
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isActive ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
            <i className={`fas ${icon} text-xs`} />
          </span>
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const auth = useAuthStore()
  const { user, isAdmin, isSuperAdmin, logout } = auth
  const rolePermissions = permissionsForRole(user?.role)
  const { sidebarOpen } = useUIStore()
  const { data: pendingByBadge = {} } = usePendingCounts()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState({})

  const countFor = (badge) => badge ? Number(pendingByBadge[badge] || 0) : 0
  const sectionCount = (section) =>
    countFor(section.badge) + section.items.reduce((total, item) => total + countFor(item.badge), 0)

  const handleLogout = () => {
    Swal.fire({
      title: 'Sign Out?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, sign out',
      confirmButtonColor: '#2563eb',
    }).then(result => {
      if (result.isConfirmed) {
        logout()
        navigate('/login')
      }
    })
  }

  if (!sidebarOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => useUIStore.getState().setSidebar(false)} />

      <aside className="fixed left-0 top-0 z-50 flex h-screen w-[276px] flex-col border-r border-white/10 bg-[#081321] text-white shadow-2xl shadow-black/40">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <img
              src="https://asaphil.org/wp-content/themes/Philippines/asa-assets/images/Primary_logo.png"
              alt="ASA Philippines"
              className="h-12 w-auto shrink-0 object-contain"
            />
            <div className="min-w-0 border-l border-white/10 pl-3">
              <div className="truncate text-sm font-extrabold text-white">OPs Finance</div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Monitoring System</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          <div className="space-y-1">
            <MainLink to="/" icon="fa-th-large" label="Dashboard" />
            <MainLink to="/action-center" icon="fa-book-open" label="Guidelines" />
            <MainLink to="/send-email" icon="fa-envelope" label="Send to Email" />
          </div>

          <div className="my-4 h-px bg-white/10" />

          <div className="space-y-4">
            {SECTIONS.map(section => {
              if (section.adminSection && !isAdmin) return null
              if (section.superAdminSection && !isSuperAdmin) return null
              const visibleItems = section.items.filter(item => {
                if (item.permission && !(auth[item.permission] || rolePermissions[item.permission])) return false
                return true
              })
              if (!visibleItems.length) return null

              const isCollapsed = collapsed[section.key]
              const total = sectionCount(section)

              return (
                <section key={section.key}>
                  <button
                    type="button"
                    onClick={() => setCollapsed(prev => ({ ...prev, [section.key]: !prev[section.key] }))}
                    className="mb-1 flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-black uppercase tracking-wide text-slate-500 transition hover:text-slate-300"
                  >
                    <i className={`fas ${section.icon} w-4 text-center text-[11px]`} />
                    <span className="min-w-0 flex-1 truncate">{section.label}</span>
                    <Badge value={total} />
                    <i className="fas fa-chevron-down text-[10px] transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {visibleItems.map(item => {
                        const count = countFor(item.badge)
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) =>
                              `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                                isActive
                                  ? 'bg-white/12 text-white'
                                  : 'text-slate-400 hover:bg-white/7 hover:text-white'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sky-400" />}
                                <i className={`fas ${item.icon} w-5 text-center text-xs ${isActive ? 'text-sky-300' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                <Badge value={count} />
                              </>
                            )}
                          </NavLink>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-500/10">
              <i className="fas fa-sign-out-alt text-xs" />
            </span>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
