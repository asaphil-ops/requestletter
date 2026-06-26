import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getImageDisplayUrl } from '../lib/utils'

const ACTIVE_STATUSES = new Set(['Pending', 'Checked', 'Recommended Ops Fin', 'Pending For Recommendation of OPs Finance'])

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

const latestTime = (row = {}) => {
  const date = new Date(row.updated_at || row.created_at || row.date_req || row.date || 0)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function addWork(map, name, item) {
  const key = normalizeKey(name)
  if (!key) return
  const list = map.get(key) || []
  list.push(item)
  map.set(key, list)
}

async function fetchOnlineStaffList() {
  const [
    employeesResult,
    accountsResult,
    requestsResult,
    sbarResult,
    initiativesResult,
    cfooResult,
    otherCostResult,
  ] = await Promise.all([
    supabase.from('employee_list').select('*').order('full_name'),
    supabase.from('accounts').select('full_name,email,role,photo_url'),
    supabase.from('requests').select('title,beneficiary,uploader,status,created_at,date_req').limit(1000),
    supabase.from('sbar').select('type,giver,receiver,uploader,status,created_at,date').limit(1000),
    supabase.from('cost_center_initiatives').select('staff_name,designation,account_title,uploader,status,created_at,date').limit(1000),
    supabase.from('cost_center_cfoo').select('staff_name,designation,account_title,uploader,status,created_at,date').limit(1000),
    supabase.from('cost_center_other').select('cost_center,account_title,uploader,status,created_at,date').limit(1000),
  ])

  const results = [employeesResult, accountsResult, requestsResult, sbarResult, initiativesResult, cfooResult, otherCostResult]
  const failed = results.find(result => result.error)
  if (failed) throw failed.error

  return {
    employees: employeesResult.data || [],
    accounts: accountsResult.data || [],
    requests: requestsResult.data || [],
    sbar: sbarResult.data || [],
    initiatives: initiativesResult.data || [],
    cfoo: cfooResult.data || [],
    otherCost: otherCostResult.data || [],
  }
}

export default function OnlineStaffList() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['online-staff-list'],
    queryFn: fetchOnlineStaffList,
    staleTime: 60000,
    refetchInterval: 120000,
  })

  const rows = useMemo(() => {
    const employees = data?.employees || []
    const accounts = data?.accounts || []
    const accountByEmail = new Map(accounts.map(account => [normalizeKey(account.email), account]))
    const accountByName = new Map(accounts.map(account => [normalizeKey(account.full_name), account]))
    const workByName = new Map()

    ;(data?.requests || []).filter(row => ACTIVE_STATUSES.has(row.status || 'Pending')).forEach(row => {
      addWork(workByName, row.uploader, {
        module: 'Request Letter',
        title: row.title || row.beneficiary || 'Request Letter',
        status: row.status || 'Pending',
        time: latestTime(row),
      })
    })

    ;(data?.sbar || []).filter(row => ACTIVE_STATUSES.has(row.status || 'Pending')).forEach(row => {
      addWork(workByName, row.uploader, {
        module: 'SBAR',
        title: row.type || row.giver || row.receiver || 'SBAR',
        status: row.status || 'Pending',
        time: latestTime(row),
      })
    })

    ;[...(data?.initiatives || []), ...(data?.cfoo || [])]
      .filter(row => ACTIVE_STATUSES.has(row.status || 'Pending'))
      .forEach(row => {
        addWork(workByName, row.staff_name || row.uploader, {
          module: row.staff_name ? 'Cost Center' : 'Uploaded Record',
          title: row.account_title || row.staff_name || 'Cost Center Record',
          status: row.status || 'Pending',
          time: latestTime(row),
        })
      })

    ;(data?.otherCost || []).filter(row => ACTIVE_STATUSES.has(row.status || 'Pending')).forEach(row => {
      addWork(workByName, row.uploader, {
        module: 'Other Cost Center',
        title: row.account_title || row.cost_center || 'Cost Center Record',
        status: row.status || 'Pending',
        time: latestTime(row),
      })
    })

    return employees.map(employee => {
      const account = accountByEmail.get(normalizeKey(employee.email_address)) || accountByName.get(normalizeKey(employee.full_name)) || {}
      const work = (workByName.get(normalizeKey(employee.full_name)) || [])
        .sort((a, b) => b.time - a.time)
      return {
        ...employee,
        role: account.role || '',
        photo_url: account.photo_url || '',
        currentWork: work[0] || null,
        workCount: work.length,
      }
    })
  }, [data])

  const filtered = useMemo(() => {
    const needle = search.toLowerCase()
    return rows.filter(row => {
      const workText = row.currentWork ? `${row.currentWork.module} ${row.currentWork.title} ${row.currentWork.status}` : ''
      const haystack = `${row.id_number || ''} ${row.full_name || ''} ${row.designation || ''} ${row.email_address || ''} ${workText}`.toLowerCase()
      if (needle && !haystack.includes(needle)) return false
      if (statusFilter === 'active' && !row.currentWork) return false
      if (statusFilter === 'available' && row.currentWork) return false
      return true
    })
  }, [rows, search, statusFilter])

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="https://asaphil.org/wp-content/themes/Philippines/asa-assets/images/Primary_logo.png"
              alt="ASA Philippines"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-extrabold text-slate-950">Online Staff List</h1>
              <p className="text-sm font-semibold text-slate-500">{filtered.length.toLocaleString('en-PH')} employee records</p>
            </div>
          </div>
          <a href="/tracker" className="btn-secondary text-xs px-3 py-2">
            <i className="fas fa-route mr-1 text-blue-600" />Tracker
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            <input
              className="input bg-white pl-9"
              placeholder="Search name, designation, email, or current work..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
          <select className="input w-auto bg-white text-sm" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="">All Staff</option>
            <option value="active">With Current Work</option>
            <option value="available">No Active Work</option>
          </select>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error.message || 'Unable to load online staff list.'}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(row => (
              <article key={row.id || row.id_number || row.full_name} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-gradient-to-br from-blue-600 to-cyan-700 text-white">
                    {row.photo_url ? (
                      <img src={getImageDisplayUrl(row.photo_url)} alt={row.full_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-black">{initials(row.full_name)}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-slate-950">{row.full_name || '-'}</div>
                    <div className="truncate text-xs font-semibold text-slate-500">{row.designation || row.role || 'No designation'}</div>
                    <div className="mt-1 truncate text-[11px] font-medium text-slate-400">{row.email_address || row.contact_number || row.id_number || ''}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  {row.currentWork ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-black text-slate-800">{row.currentWork.module}</span>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">{row.currentWork.status}</span>
                      </div>
                      <div className="mt-1 truncate text-xs font-semibold text-slate-600">{row.currentWork.title}</div>
                      {row.workCount > 1 && <div className="mt-1 text-[10px] font-bold text-slate-400">+{row.workCount - 1} more active item(s)</div>}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      No active work tagged
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
