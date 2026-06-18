import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtCurrency, fmtDate } from '../lib/utils'
import { escapeHtml } from '../lib/utils'
import { useAuthStore } from '../store/authStore'
import { permissionsForRole } from '../lib/permissions'
import { PageLoader } from '../components/shared/Loader'

const MODULES = [
  { key: 'requests', label: 'Request Letter', table: 'requests', date: 'date_req', select: 'id,req_id,status,amount,title,type,date_req,created_at' },
  { key: 'sbar', label: 'SBAR / Transfer', table: 'sbar', date: 'date', select: 'id,uniq_id,status,amount,type,date,created_at' },
  { key: 'it', label: 'IT Expenses', table: 'it_expenses', date: 'date', select: 'id,uniq_id,status,amount,category,date,created_at' },
  { key: 'at', label: 'Aircon & Toilet', table: 'at_expenses', date: 'date', select: 'id,uniq_id,status,amount,category,date,created_at' },
  { key: 'comms', label: 'Comms Expenses', table: 'comms_expenses', date: 'date', select: 'id,uniq_id,status,amount,category,date,created_at' },
  { key: 'initiatives', label: 'Initiatives Cost Center', table: 'cost_center_initiatives', date: 'date', select: 'id,uniq_id,status,amount,date,created_at' },
  { key: 'cfoo', label: 'CFOO Cost Center', table: 'cost_center_cfoo', date: 'date', select: 'id,uniq_id,status,amount,date,created_at' },
  { key: 'other', label: 'Other Cost Center', table: 'cost_center_other', date: 'date', select: 'id,uniq_id,status,amount,date,created_at' },
]

const STATUS_ORDER = ['Pending', 'Checked', 'Approved', 'Rejected']

const normalizeStatus = (status) => status || 'Pending'

const recordDate = (record) => {
  const value = record.date || record.date_req || record.created_at
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

const inRange = (record, dateStart, dateEnd) => {
  const date = recordDate(record)
  if (!date) return false
  if (dateStart) {
    const start = new Date(dateStart)
    start.setHours(0, 0, 0, 0)
    if (date < start) return false
  }
  if (dateEnd) {
    const end = new Date(dateEnd)
    end.setHours(23, 59, 59, 999)
    if (date > end) return false
  }
  return true
}

const countRecipients = (row) =>
  String(row.to_addresses || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .length

function buildRows(data, filters) {
  const selectedModule = filters.module
  return data.records.filter(row =>
    (!selectedModule || row.moduleKey === selectedModule) &&
    (!filters.status || normalizeStatus(row.status) === filters.status || (filters.status === 'Checked' && normalizeStatus(row.status) === 'Approved')) &&
    inRange(row, filters.dateStart, filters.dateEnd)
  )
}

function printReport({ filters, summary, moduleRows, statusRows, emailRows }) {
  const generatedAt = new Date().toLocaleString('en-PH')
  const range = `${filters.dateStart || 'All'} to ${filters.dateEnd || 'All'}`
  const module = MODULES.find(item => item.key === filters.module)?.label || 'All Modules'
  const html = `<!doctype html>
    <html>
      <head>
        <title>Reports</title>
        <style>
          @page { margin: 18mm; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; }
          .brand { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; }
          .brand img { height: 44px; }
          h1 { margin: 0 0 4px; font-size: 24px; }
          .muted { color: #64748b; font-size: 12px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 22px 0; }
          .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
          .label { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold; }
          .value { font-size: 22px; font-weight: bold; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f1f5f9; }
          h2 { margin: 22px 0 0; font-size: 16px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()" style="float:right;padding:8px 12px">Save as PDF</button>
        <div class="brand">
          <img src="https://asaphil.org/wp-content/themes/Philippines/asa-assets/images/Primary_logo.png" alt="ASA Philippines">
          <div>
            <h1>Operations Finance Reports</h1>
            <div class="muted">Generated: ${escapeHtml(generatedAt)} | Module: ${escapeHtml(module)} | Date Range: ${escapeHtml(range)} | Status: ${escapeHtml(filters.status || 'All')}</div>
          </div>
        </div>
        <div class="grid">
          <div class="card"><div class="label">Total Records</div><div class="value">${summary.total}</div></div>
          <div class="card"><div class="label">Pending</div><div class="value">${summary.pending}</div></div>
          <div class="card"><div class="label">Sent / Checked</div><div class="value">${summary.checked}</div></div>
          <div class="card"><div class="label">Emails Sent</div><div class="value">${summary.emailsSent}</div></div>
        </div>
        <h2>Status Summary</h2>
        <table>
          <thead><tr><th>Status</th><th>Count</th><th>Total Amount</th></tr></thead>
          <tbody>${statusRows.map(row => `<tr><td>${escapeHtml(row.status)}</td><td>${row.count}</td><td>${escapeHtml(row.amount)}</td></tr>`).join('')}</tbody>
        </table>
        <h2>Module Summary</h2>
        <table>
          <thead><tr><th>Module</th><th>Total</th><th>Pending</th><th>Sent / Checked</th><th>Rejected</th><th>Amount</th></tr></thead>
          <tbody>${moduleRows.map(row => `<tr><td>${escapeHtml(row.module)}</td><td>${row.total}</td><td>${row.pending}</td><td>${row.checked}</td><td>${row.rejected}</td><td>${escapeHtml(row.amount)}</td></tr>`).join('')}</tbody>
        </table>
        <h2>Email Sent Log</h2>
        <table>
          <thead><tr><th>Date</th><th>Subject</th><th>Sent By</th><th>Recipients</th><th>Reference</th></tr></thead>
          <tbody>${emailRows.map(row => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.subject)}</td><td>${escapeHtml(row.sentBy)}</td><td>${row.recipients}</td><td>${escapeHtml(row.reference)}</td></tr>`).join('')}</tbody>
        </table>
      </body>
    </html>`

  const win = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
}

export default function Reports() {
  const { user, canExportReports } = useAuthStore()
  const canExport = canExportReports || permissionsForRole(user?.role).canExportReports
  const [searchParams] = useSearchParams()
  const today = new Date().toISOString().split('T')[0]
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const [filters, setFilters] = useState({
    dateStart: searchParams.get('dateStart') || firstDay,
    dateEnd: searchParams.get('dateEnd') || today,
    module: searchParams.get('module') || '',
    status: searchParams.get('status') || '',
  })

  const { data = { records: [], emails: [] }, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const [moduleResults, emailLogs] = await Promise.all([
        Promise.all(MODULES.map(async (module) => {
          const { data: rows, error } = await supabase
            .from(module.table)
            .select(module.select)
            .order('created_at', { ascending: false })

          if (error) throw error
          return (rows || []).map(row => ({
            ...row,
            moduleKey: module.key,
            moduleLabel: module.label,
            date: row[module.date] || row.date,
          }))
        })),
        supabase
          .from('email_logs')
          .select('id,sent_by,to_addresses,cc_addresses,subject,ref_type,ref_id,created_at')
          .order('created_at', { ascending: false }),
      ])

      if (emailLogs.error) throw emailLogs.error
      return { records: moduleResults.flat(), emails: emailLogs.data || [] }
    },
    staleTime: 30000,
  })

  const records = useMemo(() => buildRows(data, filters), [data, filters])
  const emails = useMemo(() =>
    data.emails.filter(row => inRange({ date: row.created_at }, filters.dateStart, filters.dateEnd)),
    [data.emails, filters.dateStart, filters.dateEnd]
  )

  const summary = useMemo(() => {
    const statusCount = (values) => records.filter(row => values.includes(normalizeStatus(row.status))).length
    return {
      total: records.length,
      pending: statusCount(['Pending']),
      checked: statusCount(['Checked', 'Approved']),
      rejected: statusCount(['Rejected']),
      emailsSent: emails.length,
      amount: records.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      recipients: emails.reduce((sum, row) => sum + countRecipients(row), 0),
    }
  }, [records, emails])

  const statusRows = useMemo(() => STATUS_ORDER.map(status => {
    const statusRecords = records.filter(row => normalizeStatus(row.status) === status)
    return {
      status: status === 'Checked' ? 'Sent / Checked' : status,
      count: statusRecords.length,
      amount: fmtCurrency(statusRecords.reduce((sum, row) => sum + Number(row.amount || 0), 0)),
    }
  }), [records])

  const moduleRows = useMemo(() => MODULES.map(module => {
    const rows = records.filter(row => row.moduleKey === module.key)
    const checked = rows.filter(row => ['Checked', 'Approved'].includes(normalizeStatus(row.status))).length
    return {
      module: module.label,
      total: rows.length,
      pending: rows.filter(row => normalizeStatus(row.status) === 'Pending').length,
      checked,
      rejected: rows.filter(row => normalizeStatus(row.status) === 'Rejected').length,
      amount: fmtCurrency(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)),
    }
  }).filter(row => !filters.module || row.total > 0), [records, filters.module])

  const emailRows = useMemo(() => emails.slice(0, 200).map(row => ({
    date: row.created_at ? new Date(row.created_at).toLocaleString('en-PH') : '-',
    subject: row.subject || '-',
    sentBy: row.sent_by || '-',
    recipients: countRecipients(row),
    reference: [row.ref_type, row.ref_id].filter(Boolean).join(' / ') || '-',
  })), [emails])

  const handlePdf = () => printReport({ filters, summary, moduleRows, statusRows, emailRows })

  if (isLoading) return <PageLoader />
  if (isError) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Reports unavailable</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{error?.message || 'Unable to load report data.'}</p>
        <button className="btn-primary mt-4" onClick={() => refetch()}>
          <i className="fas fa-sync-alt mr-2" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Analytics</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Reports</h1>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Status, sent emails, and module summaries</p>
        </div>
        <button onClick={handlePdf} disabled={!canExport} className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed" title={!canExport ? 'No export permission' : 'Download PDF'}>
          <i className="fas fa-file-pdf mr-2" /> Download PDF
        </button>
      </div>

      <div className="card mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <label className="label">Date Start</label>
            <input type="date" className="input" value={filters.dateStart} onChange={event => setFilters(prev => ({ ...prev, dateStart: event.target.value }))} />
          </div>
          <div>
            <label className="label">Date End</label>
            <input type="date" className="input" value={filters.dateEnd} onChange={event => setFilters(prev => ({ ...prev, dateEnd: event.target.value }))} />
          </div>
          <div>
            <label className="label">Module</label>
            <select className="input" value={filters.module} onChange={event => setFilters(prev => ({ ...prev, module: event.target.value }))}>
              <option value="">All Modules</option>
              {MODULES.map(module => <option key={module.key} value={module.key}>{module.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={filters.status} onChange={event => setFilters(prev => ({ ...prev, status: event.target.value }))}>
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Checked">Sent / Checked</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-secondary w-full" onClick={() => setFilters({ dateStart: '', dateEnd: '', module: '', status: '' })}>
              <i className="fas fa-sync-alt mr-2" /> Reset
            </button>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['Total Records', summary.total, 'fa-layer-group'],
          ['Pending', summary.pending, 'fa-clock'],
          ['Sent / Checked', summary.checked, 'fa-paper-plane'],
          ['Rejected', summary.rejected, 'fa-ban'],
          ['Emails Sent', summary.emailsSent, 'fa-envelope-circle-check'],
        ].map(([label, value, icon]) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</div>
                <div className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-gray-100">{value}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-sky-400/10 dark:text-sky-300">
                <i className={`fas ${icon}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-slate-800">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">Module Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr><th className="table-th">Module</th><th className="table-th">Total</th><th className="table-th">Pending</th><th className="table-th">Sent / Checked</th><th className="table-th">Rejected</th><th className="table-th">Amount</th></tr></thead>
              <tbody>
                {moduleRows.map(row => (
                  <tr key={row.module} className="table-tr">
                    <td className="table-td font-semibold">{row.module}</td>
                    <td className="table-td">{row.total}</td>
                    <td className="table-td">{row.pending}</td>
                    <td className="table-td">{row.checked}</td>
                    <td className="table-td">{row.rejected}</td>
                    <td className="table-td font-semibold">{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-slate-800">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">Email Sent Log</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead><tr><th className="table-th">Date</th><th className="table-th">Subject</th><th className="table-th">Sent By</th><th className="table-th">Recipients</th><th className="table-th">Reference</th></tr></thead>
              <tbody>
                {emailRows.slice(0, 20).map((row, index) => (
                  <tr key={`${row.date}-${index}`} className="table-tr">
                    <td className="table-td whitespace-nowrap text-xs text-gray-500">{row.date}</td>
                    <td className="table-td max-w-[220px] truncate font-semibold">{row.subject}</td>
                    <td className="table-td">{row.sentBy}</td>
                    <td className="table-td">{row.recipients}</td>
                    <td className="table-td max-w-[180px] truncate">{row.reference}</td>
                  </tr>
                ))}
                {!emailRows.length && (
                  <tr><td className="table-td text-center text-gray-400" colSpan={5}>No sent emails found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-5 card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400">Total Amount</div>
            <div className="mt-1 text-xl font-extrabold text-gray-900 dark:text-gray-100">{fmtCurrency(summary.amount)}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400">Total Email Recipients</div>
            <div className="mt-1 text-xl font-extrabold text-gray-900 dark:text-gray-100">{summary.recipients}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400">Report Date</div>
            <div className="mt-1 text-xl font-extrabold text-gray-900 dark:text-gray-100">{fmtDate(new Date())}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
