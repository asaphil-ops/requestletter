import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { permissionsForRole } from '../../lib/permissions'
import { usePendingCounts } from '../../hooks/useDashboard'
import { useSettings } from '../../hooks/useAccounts'
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
      { label: 'Generator', icon: 'fa-bolt', to: '/generator-expenses', badge: 'generator' },
      { label: 'Comms Expenses', icon: 'fa-bullhorn', to: '/comms-expenses', badge: 'comms' },
      { label: 'Request Letter Tracker', icon: 'fa-route', to: '/tracker' },
      { label: 'Online List', icon: 'fa-address-card', to: '/online-list' },
    ],
  },
  {
    key: 'employees',
    label: 'Employee Management',
    icon: 'fa-users-gear',
    items: [
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
        { label: 'Branches', icon: 'fa-code-branch', to: '/branches' },
        { label: 'Data Management', icon: 'fa-database', to: '/data-management', permission: 'canManageData' },
      ],
    }
]

function Badge({ value }) {
  if (!value) return null
  return (
    <span className="sidebar-count ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none">
      {value > 99 ? '99+' : value}
    </span>
  )
}

function MainLink({ to, icon, label, compact = false }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      className={({ isActive }) => `sidebar-link group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'sidebar-link-active text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="sidebar-active-mark absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full" />}
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isActive ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
            <i className={`fas ${icon} text-xs`} />
          </span>
          {!compact && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const auth = useAuthStore()
  const { user, isAdmin, isSuperAdmin, logout } = auth
  const rolePermissions = permissionsForRole(user?.role)
  const { sidebarOpen, sidebarCompact } = useUIStore()
  const { data: pendingByBadge = {} } = usePendingCounts()
  const { data: settings } = useSettings()
  const hiddenModules = new Set(settings?.hiddenModules || [])
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState({})
  const [search, setSearch] = useState('')
  const [flyout, setFlyout] = useState(null)
  const query = search.trim().toLowerCase()
  const compact = sidebarCompact && window.innerWidth >= 1024
  const initial = user?.full_name?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'U'
  const closeMobileSidebar = () => {
    if (window.innerWidth < 1024) useUIStore.getState().setSidebar(false)
  }

  useEffect(() => {
    if (window.innerWidth < 1024) useUIStore.getState().setSidebar(false)
    setFlyout(null)
  }, [location.pathname])

  useEffect(() => {
    if (compact) setSearch('')
    setFlyout(null)
  }, [compact])

  useEffect(() => {
    if (!flyout) return
    const closeFlyout = (event) => {
      if (!event.target.closest('.sidebar-flyout, .sidebar-section-heading')) setFlyout(null)
    }
    document.addEventListener('mousedown', closeFlyout)
    return () => document.removeEventListener('mousedown', closeFlyout)
  }, [flyout])

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
      <div className="fixed inset-0 z-[1250] bg-black/50 lg:hidden" onClick={() => useUIStore.getState().setSidebar(false)} />

      <aside className={`sidebar-panel ${compact ? 'sidebar-panel--compact' : ''} fixed left-0 top-0 z-[1300] flex h-screen flex-col`}>
        <div className="sidebar-header relative px-4 py-4">
          <img src="/ops-fin-logo.svg" alt="OPS-FIN — Operations Finance" className="block w-full h-auto" />
          <button type="button" onClick={closeMobileSidebar} className="sidebar-close lg:hidden" aria-label="Close navigation">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="sidebar-user-card lg:hidden">
          <div className="sidebar-user-avatar">{initial}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{user?.full_name || user?.username || 'Account'}</p>
            <p className="truncate text-xs text-slate-400">{user?.role || 'Staff'}</p>
          </div>
          <span className="sidebar-online-dot" title="Signed in" aria-label="Signed in" />
        </div>

        <div className="sidebar-search-area px-4 pt-4">
          <label htmlFor="sidebar-search" className="sr-only">Search modules</label>
          <div className="sidebar-search-wrap relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
            <input id="sidebar-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search modules..." className="sidebar-search w-full rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none" />
          </div>
        </div>

        <nav aria-label="Main navigation" className="sidebar-nav flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {'dashboard'.includes(query) && <MainLink to="/" icon="fa-th-large" label="Dashboard" compact={compact} />}
            {'send to email'.includes(query) && <MainLink to="/send-email" icon="fa-envelope" label="Send to Email" compact={compact} />}
          </div>

          {!query && <div className="my-4 h-px bg-white/10" />}

          <div className="space-y-3">
            {SECTIONS.map(section => {
              if (section.adminSection && !isAdmin) return null
              if (section.superAdminSection && !isSuperAdmin) return null
              const permittedItems = section.items.filter(item => {
                if (item.permission && !(auth[item.permission] || rolePermissions[item.permission])) return false
                if (hiddenModules.has(item.to)) return false
                return true
              })
              const visibleItems = query
                ? permittedItems.filter(item => item.label.toLowerCase().includes(query) || section.label.toLowerCase().includes(query))
                : permittedItems
              if (!visibleItems.length) return null

              const hasActiveItem = permittedItems.some(item => item.to === location.pathname)
              const isCollapsed = !query && Boolean(collapsed[section.key])
              const total = sectionCount(section)

              return (
                <section key={section.key} className={hasActiveItem ? 'sidebar-section-current' : ''}>
                  <button
                    type="button"
                    onClick={(event) => {
                      if (compact) {
                        const top = Math.min(event.currentTarget.getBoundingClientRect().top, window.innerHeight - 330)
                        setFlyout(prev => prev?.key === section.key ? null : { key: section.key, top: Math.max(90, top) })
                      } else setCollapsed(prev => ({ ...prev, [section.key]: !prev[section.key] }))
                    }}
                    aria-expanded={compact ? flyout?.key === section.key : !isCollapsed}
                    aria-label={compact ? section.label : undefined}
                    title={compact ? section.label : undefined}
                    className="sidebar-section-heading mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide text-slate-400 transition hover:bg-white/5 hover:text-white"
                  >
                    <i className={`fas ${section.icon} w-4 text-center text-[11px]`} />
                    {!compact && <span className="min-w-0 flex-1 truncate">{section.label}</span>}
                    {!compact && <Badge value={total} />}
                    {!compact && <i className="fas fa-chevron-down text-[10px] transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }} />}
                  </button>

                  {!compact && !isCollapsed && (
                    <div className="space-y-0.5">
                      {visibleItems.map(item => {
                        const count = countFor(item.badge)
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) =>
                              `sidebar-link group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                                isActive
                                  ? 'sidebar-link-active text-white'
                                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                              }`}
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && <span className="sidebar-active-mark absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full" />}
                                <i className={`fas ${item.icon} w-5 text-center text-xs ${isActive ? 'text-sky-200' : 'text-slate-400 group-hover:text-slate-200'}`} />
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
          {!compact && query && !SECTIONS.some(section =>
            (!section.adminSection || isAdmin) &&
            (!section.superAdminSection || isSuperAdmin) &&
            section.items.some(item =>
              (!item.permission || auth[item.permission] || rolePermissions[item.permission]) &&
              !hiddenModules.has(item.to) &&
              (item.label.toLowerCase().includes(query) || section.label.toLowerCase().includes(query))
            )
          ) && !'dashboard'.includes(query) && !'send to email'.includes(query) && (
            <p className="px-3 py-6 text-center text-xs text-slate-400">No modules found.</p>
          )}
        </nav>

        {compact && flyout && (() => {
          const section = SECTIONS.find(item => item.key === flyout.key)
          if (!section) return null
          const items = section.items.filter(item =>
            (!item.permission || auth[item.permission] || rolePermissions[item.permission]) &&
            !hiddenModules.has(item.to)
          )
          return (
            <div className="sidebar-flyout fixed z-[1400] w-56 rounded-2xl p-2" style={{ left: 94, top: flyout.top }}>
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{section.label}</div>
              {items.map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar-flyout-link flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${isActive ? 'sidebar-link-active' : ''}`}><i className={`fas ${item.icon} w-5 text-center text-xs`} />{item.label}<Badge value={countFor(item.badge)} /></NavLink>)}
            </div>
          )
        })()}

        <div className="sidebar-footer border-t p-3">
          <button
            type="button"
            onClick={handleLogout}
            title={compact ? 'Sign Out' : undefined}
            aria-label={compact ? 'Sign Out' : undefined}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-500/10">
              <i className="fas fa-sign-out-alt text-xs" />
            </span>
            {!compact && <span>Sign Out</span>}
            {!compact && <i className="fas fa-chevron-right ml-auto text-[10px] opacity-60" aria-hidden="true" />}
          </button>
        </div>
      </aside>
    </>
)
}
