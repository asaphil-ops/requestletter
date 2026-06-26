import { useMemo, useState } from 'react'
import { useEmployeeList } from '../hooks/useEmployeeList'
import { getImageDisplayUrl } from '../lib/utils'
import { usePresenceStore } from '../store/presenceStore'

const normalizeKey = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const initials = (name = '') =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?'

const formatOnlineSince = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Avatar({ user, size = 'md' }) {
  const classes = size === 'lg' ? 'h-14 w-14 text-sm' : 'h-9 w-9 text-xs'
  return (
    <div className={`${classes} shrink-0 overflow-hidden rounded-full bg-blue-100 font-black text-blue-700`}>
      {user.photo_url ? (
        <img src={getImageDisplayUrl(user.photo_url)} alt={user.full_name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">{initials(user.full_name)}</div>
      )}
    </div>
  )
}

export default function OnlineStaffList() {
  const onlineUsers = usePresenceStore((state) => state.onlineUsers)
  const { data: employees = [] } = useEmployeeList()
  const [search, setSearch] = useState('')

  const employeeByName = useMemo(() => {
    const map = new Map()
    employees.forEach(row => {
      map.set(normalizeKey(row.full_name), row)
      map.set(normalizeKey(row.email_address), row)
      map.set(normalizeKey(row.id_number), row)
    })
    return map
  }, [employees])

  const users = useMemo(() => {
    return onlineUsers.map(user => {
      const employee = employeeByName.get(normalizeKey(user.email)) || employeeByName.get(normalizeKey(user.full_name)) || {}
      return {
        ...user,
        designation: employee.designation || user.role || '-',
        branch: employee.branch || employee.branch_code || '-',
        area: employee.area || '-',
      }
    })
  }, [onlineUsers, employeeByName])

  const filtered = useMemo(() => {
    const needle = search.toLowerCase()
    if (!needle) return users
    return users.filter(user =>
      `${user.full_name || ''} ${user.email || ''} ${user.role || ''} ${user.designation || ''} ${user.activity || ''}`
        .toLowerCase()
        .includes(needle)
    )
  }, [users, search])

  const featured = filtered.slice(0, 4)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">
            <i className="fas fa-signal text-blue-500" />
            Live Presence
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100">ONLINE LIST</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Currently connected users in the OPs Finance web app.
          </p>
        </div>

        <div className="min-w-[148px] rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-4 text-center text-emerald-800">
          <div className="text-4xl font-black leading-none">{users.length}</div>
          <div className="mt-1 text-xs font-black uppercase">Online</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
          <input
            className="input bg-white pl-9"
            placeholder="Search online users..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        <button onClick={() => setSearch('')} className="btn-secondary text-xs px-3 py-2">
          <i className="fas fa-sync-alt mr-1 text-blue-600" />Reset
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {featured.map(user => (
          <article key={user.user_key} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Avatar user={user} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-slate-950 dark:text-slate-100">{user.full_name}</div>
              <div className="truncate text-xs font-bold text-slate-500">{user.activity || 'Online'}</div>
              <div className="mt-1 text-[10px] font-black uppercase text-slate-500">{user.role || user.designation}</div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />Online
            </span>
          </article>
        ))}
      </div>

      <div className="card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="bg-blue-50 dark:bg-slate-800">
                <th className="table-th w-16 text-center">#</th>
                <th className="table-th">Name</th>
                <th className="table-th">Email</th>
                <th className="table-th w-36">Role</th>
                <th className="table-th w-44">Designation</th>
                <th className="table-th">Ginagawa</th>
                <th className="table-th w-44">Online Since</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm font-semibold text-slate-400">
                    No online users found.
                  </td>
                </tr>
              ) : filtered.map((user, index) => (
                <tr key={user.user_key} className="table-tr">
                  <td className="table-td text-center text-sm font-semibold text-slate-500">{index + 1}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <Avatar user={user} />
                      <span className="font-bold text-slate-800 dark:text-slate-100">{user.full_name}</span>
                    </div>
                  </td>
                  <td className="table-td max-w-[240px] truncate text-sm text-slate-600 dark:text-slate-300">{user.email || '-'}</td>
                  <td className="table-td text-sm font-bold uppercase text-slate-700 dark:text-slate-200">{user.role || '-'}</td>
                  <td className="table-td text-sm text-slate-600 dark:text-slate-300">{user.designation || '-'}</td>
                  <td className="table-td text-sm font-semibold text-blue-700 dark:text-sky-300">{user.activity || 'Online'}</td>
                  <td className="table-td text-sm text-slate-600 dark:text-slate-300">{formatOnlineSince(user.online_since)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
