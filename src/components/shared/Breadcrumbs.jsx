import { useLocation, Link } from 'react-router-dom'

const LABELS = {
  '/': 'Dashboard',
  '/action-center': 'Action Center',
  '/requests': 'Requests',
  '/sbar': 'SBAR',
  '/it-expenses': 'IT Expenses',
  '/at-expenses': 'Aircon/Toilet Expenses',
  '/comms-expenses': 'Comms Expenses',
  '/cfoo-budget': 'CFOO Budget',
  '/cost-center/initiatives': 'Initiatives Expenses',
  '/cost-center/cfoo': 'CFOO Expenses',
  '/cost-center/other': 'Other Cost Center',
  '/data-management': 'Data Management',
  '/employee-list': 'Employee List',
  '/send-email': 'Send Email',
  '/reports': 'Reports',
  '/directory': 'Directory',
  '/bulk-upload': 'Bulk Upload',
  '/users': 'Users',
  '/audit-logs': 'Audit Logs',
  '/settings': 'Settings',
  '/tracker': 'Public Tracker',
}

export default function Breadcrumbs() {
  const pathname = useLocation().pathname
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return null

  const crumbs = [{ path: '/', label: 'Home' }]
  let accum = ''
  parts.forEach((p) => {
    accum += '/' + p
    crumbs.push({ path: accum, label: LABELS[accum] || p.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })
  })

  return (
    <nav className="flex items-center gap-1.5 text-xs mb-4 overflow-x-auto whitespace-nowrap">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={c.path} className="flex items-center gap-1.5">
            {i > 0 && <i className="fas fa-chevron-right text-[8px] text-gray-300 dark:text-slate-600" />}
            {last ? (
              <span className="font-semibold text-gray-900 dark:text-white">{c.label}</span>
            ) : (
              <Link to={c.path} className="text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-sky-300 transition-colors">
                {c.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}