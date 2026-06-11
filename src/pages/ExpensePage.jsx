import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, useProcessExpense, useAttachFileExpense, useBatchProcessExpense } from '../hooks/useExpenses'
import { useAuthStore } from '../store/authStore'
import { useBranches, useBranchMap, useBranchOptions, useBranchEmailMap } from '../hooks/useBranches'
import { useSettings } from '../hooks/useAccounts'

// Mapping of operations to recipient email addresses
const OPERATION_EMAIL_MAP = {
  "LUZON I": "jinnette.anacio@asaphil.org",
  "LUZON II": "cynthia.casido@asaphil.org",
  "VISAYAS I": "jonnie.borgonia@asaphil.org",
  "VISAYAS II": "sharon.galeno@asaphil.org",
  "MINDANAO I": "taib.abduraji@asaphil.org",
  "MINDANAO II": "arlyn.yagaya@asaphil.org",
};
import { uploadToDrive } from '../lib/gas'
import { supabase } from '../lib/supabase'
import { fmtCurrency, getUploadedAt, IT_BUDGETS, AT_BUDGETS, ROWS_PER_PAGE } from '../lib/utils'
import StatusBadge from '../components/shared/StatusBadge'
import { OpsModal } from '../components/shared/ProcessModal'
import FilePreviewModal from '../components/shared/FilePreviewModal'
import Pagination from '../components/shared/Pagination'
import { TableLoader, EmptyRow } from '../components/shared/Loader'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import Swal from 'sweetalert2'

const CONFIG = {
  it: {
    title: 'IT Equipment Procurement',
    subtitle: 'Budget Monitoring and Inventory Tracking',
    icon: 'fa-print',
    categories: ['CCTV', 'Printer', 'Monitor'],
    budgets: IT_BUDGETS,
    budgetColors: { CCTV: 'from-blue-600 to-blue-700', Printer: 'from-emerald-500 to-emerald-600', Monitor: 'from-amber-500 to-amber-600' },
    table: 'it_expenses',
  },
  at: {
    title: 'Aircon & Toilet Maintenance',
    subtitle: 'Budget Monitoring for Repairs and Maintenance',
    icon: 'fa-tools',
    categories: ['Aircon', 'Toilet'],
    budgets: AT_BUDGETS,
    budgetColors: { Aircon: 'from-blue-600 to-blue-700', Toilet: 'from-emerald-500 to-emerald-600' },
    table: 'at_expenses',
  },
  comms: {
    title: 'Comms Expenses',
    subtitle: 'Budget Monitoring for communications-related expenses',
    icon: 'fa-bullhorn',
    categories: ['GTR', 'FAF', 'Calendar', 'Branch Signage', 'Others'],
    budgets: null,
    budgetColors: { GTR: 'from-blue-600 to-blue-700', FAF: 'from-emerald-500 to-emerald-600', Calendar: 'from-amber-500 to-amber-600', 'Branch Signage': 'from-red-500 to-red-600', Others: 'from-purple-600 to-purple-700' },
    table: 'comms_expenses',
  },
}

export default function ExpensePage({ type }) {
  const config = CONFIG[type]
  const { canCheck, canUpload, isAdmin } = useAuthStore()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [status, setStatus] = useState('All')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [geoFilter, setGeoFilter] = useState({ operation: '', division: '', region: '', area: '', branchCode: '' })
  const [selected, setSelected] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [opsTarget, setOpsTarget] = useState(null) // Keep opsTarget for 'Check' action
  const [previewFile, setPreviewFile] = useState(null)
  const [branchLookupOpen, setBranchLookupOpen] = useState(false)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const { data: allData = [], isLoading } = useExpenses(type)
  const { data: settings } = useSettings()
  const createExp = useCreateExpense(type)
  const updateExp = useUpdateExpense(type)
  const deleteExp = useDeleteExpense(type)
  const processExp = useProcessExpense(type)
  const attachFile = useAttachFileExpense(type)
  const batchProcess = useBatchProcessExpense(type)
  const { data: branches = [] } = useBranches()
  const branchMap = useBranchMap()
  const branchOptions = useBranchOptions()
  const branchEmailMap = useBranchEmailMap()
  const navigate = useNavigate()
  const titles = settings?.titles || []

  const handleSendEmail = (rec) => {
  const branchCode = String(rec.branch_code || '').trim().toUpperCase()
  const branch = branchMap[branchCode] || {}
  
  // Auto-detect based on Operation (Case-insensitive)
  const opKey = String(branch.operation || '').toUpperCase()
  const operationEmail = OPERATION_EMAIL_MAP[opKey] || branchEmailMap[branchCode]
  
  let refType = 'IT Expense'
  if (type === 'at') refType = 'Aircon/Toilet Maintenance'
  if (type === 'comms') refType = 'Comms Expense'
  
  navigate('/send-email', {
    state: {
      draft: {
        to: operationEmail ? [operationEmail] : [],
        subject: `${rec.item_name || refType} - ${rec.branch_code} - ${rec.branch_name || rec.uniq_id} (Checked)`,
        note: `Expense for ${rec.branch_code} - ${rec.branch_name || rec.uniq_id} has been checked. Amount: ${fmtCurrency(rec.amount)}.`,
        refId: rec.uniq_id,
        refType: refType,
        fileId: rec.file_id || '',
      },
    },
  })
}

  const handleBatchSendEmail = () => {
    const eligible = filtered.filter(r => selected.includes(r.uniq_id) && r.status === 'Checked')
    if (!eligible.length) return Swal.fire('Info', 'Select approved items first', 'info')

    const emails = eligible.flatMap(r => {
      const branchCode = String(r.branch_code || '').trim().toUpperCase()
      const branch = branchMap[branchCode] || {}
      const opKey = String(branch.operation || '').toUpperCase()
      return OPERATION_EMAIL_MAP[opKey] || branchEmailMap[branchCode]
    }).filter(Boolean)

    let refType = 'IT Expense'
    if (type === 'at') refType = 'Aircon/Toilet Maintenance'
    if (type === 'comms') refType = 'Comms Expense'

    navigate('/send-email', {
      state: {
        draft: {
          to: [...new Set(emails)], // Use Set to get unique emails
          subject: `${refType} Batch (Checked - ${eligible.length} items)`,
          note: `Attached are the ${refType} records that have been checked. Total Amount: ${fmtCurrency(eligible.reduce((s, r) => s + Number(r.amount || 0), 0))}.`,
          refId: eligible.map(r => r.uniq_id).join(','),
          refType: `${refType} Batch`,
        },
      },
    })
  }

  const defaultAccountTitle = ['it', 'at', 'comms'].includes(type) ? 'Supplies' : ''
  const EMPTY_FORM = { category: config.categories[0], date: '', branchCode: '', branchName: '', accountTitle: defaultAccountTitle, itemName: '', description: '', amount: '' }
  const [form, setForm] = useState(EMPTY_FORM)

  const setGeo = (key, val) => {
    setGeoFilter(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'operation') { next.division = ''; next.region = ''; next.area = ''; next.branchCode = '' }
      if (key === 'division')  { next.region = ''; next.area = ''; next.branchCode = '' }
      if (key === 'region')    { next.area = ''; next.branchCode = '' }
      if (key === 'area')      { next.branchCode = '' }
      return next
    })
    setPage(1)
  }

  // Budget stats
  const budgetStats = useMemo(() => {
    const stats = {}
    config.categories.forEach(cat => {
      const items = allData.filter(r => r.category === cat)
      stats[cat] = { count: items.length, spent: items.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) }
    })
    return stats
  }, [allData])

  // Dynamically compute geo lists based on current selected values (cascading options)
  const geoLists = useMemo(() => {
    const operations = [...new Set(branches.map(b => b.operation).filter(Boolean))].sort()
    let divBranches = branches
    if (geoFilter.operation) {
      divBranches = divBranches.filter(b => b.operation === geoFilter.operation)
    }
    const divisions = [...new Set(divBranches.map(b => b.division).filter(Boolean))].sort()
    let regBranches = divBranches
    if (geoFilter.division) {
      regBranches = regBranches.filter(b => b.division === geoFilter.division)
    }
    const regions = [...new Set(regBranches.map(b => b.region).filter(Boolean))].sort()
    let areaBranches = regBranches
    if (geoFilter.region) {
      areaBranches = areaBranches.filter(b => b.region === geoFilter.region)
    }
    const areas = [...new Set(areaBranches.map(b => b.area).filter(Boolean))].sort()
    let branchList = areaBranches
    if (geoFilter.area) {
      branchList = branchList.filter(b => b.area === geoFilter.area)
    }
    const branchesOptions = branchList
      .filter(b => b.code && b.name)
      .map(b => ({ value: b.code, label: `${b.code} - ${b.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return { operations, divisions, regions, areas, branchesOptions }
  }, [branches, geoFilter.operation, geoFilter.division, geoFilter.region, geoFilter.area])

  const filtered = useMemo(() => {
    let arr = [...allData]
    if (category !== 'All') arr = arr.filter(r => r.category === category)
    if (status !== 'All')   arr = arr.filter(r => r.status === status)
    if (search) arr = arr.filter(r => `${r.branch_code} ${r.branch_name} ${r.account_title} ${r.item_name}`.toLowerCase().includes(search.toLowerCase()))
    if (dateStart && dateEnd) arr = arr.filter(r => {
      const d = new Date(r.created_at); const s = new Date(dateStart); const e = new Date(dateEnd)
      s.setHours(0,0,0,0); e.setHours(23,59,59,999); return d >= s && d <= e
    })
    if (geoFilter.operation || geoFilter.division || geoFilter.region || geoFilter.area || geoFilter.branchCode) {
      arr = arr.filter(r => {
        const bCode = String(r.branch_code || '').trim().toUpperCase()
        const bDet = branchMap[bCode]
        if (!bDet) return false
        if (geoFilter.operation && bDet.operation !== geoFilter.operation) return false
        if (geoFilter.division && bDet.division !== geoFilter.division) return false
        if (geoFilter.region && bDet.region !== geoFilter.region) return false
        if (geoFilter.area && bDet.area !== geoFilter.area) return false
        if (geoFilter.branchCode && bCode !== geoFilter.branchCode) return false
        return true
      })
    }
    arr.sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? ''
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [allData, category, status, search, dateStart, dateEnd, geoFilter, sortKey, sortDir, branchMap])

  const paged = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const openModal = (rec = null) => {
    setEditing(rec)
    if (rec) {
      setForm({ category: rec.category, date: rec.date, branchCode: rec.branch_code, branchName: rec.branch_name, accountTitle: rec.account_title || defaultAccountTitle, itemName: rec.item_name, description: rec.description, amount: rec.amount })
    } else {
      const today = new Date().toISOString().split('T')[0]
      setForm({ ...EMPTY_FORM, date: today })
    }
    setShowModal(true)
  }

  const handleBranchSelect = (code) => {
    const branch = branchOptions.find(b => b.value === code)
    setForm(f => ({ ...f, branchCode: code, branchName: branch ? branch.label.split(' - ').slice(1).join(' - ') : '' }))
  }

  const selectedBranch = branchOptions.find(b => b.value === form.branchCode)
  const branchMatches = useMemo(() => {
    const needle = String(form.branchCode || '').trim().toLowerCase()
    const list = needle
      ? branchOptions.filter(branch => `${branch.value} ${branch.label}`.toLowerCase().includes(needle))
      : branchOptions
    return list.slice(0, 10)
  }, [branchOptions, form.branchCode])

  const handleSave = async () => {
    if (!form.date || !form.branchCode || !form.accountTitle || !form.itemName || !form.amount)
      return Swal.fire('Error', 'Missing required fields', 'error')
    try {
      if (editing) {
        await updateExp.mutateAsync({ uniqId: editing.uniq_id, updates: { category: form.category, date: form.date, branch_code: form.branchCode, branch_name: form.branchName, account_title: form.accountTitle, item_name: form.itemName, description: form.description, amount: form.amount } })
        Swal.fire('Updated!', '', 'success')
      } else {
        await createExp.mutateAsync({ category: form.category, date: form.date, branchCode: form.branchCode, branchName: form.branchName, accountTitle: form.accountTitle, itemName: form.itemName, description: form.description, amount: form.amount })
        Swal.fire('Saved!', '', 'success')
      }
      setShowModal(false)
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleDelete = (rec) => {
    Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes' })
      .then(r => { if (r.isConfirmed) deleteExp.mutateAsync(rec.uniq_id).then(() => Swal.fire('Deleted!', '', 'success')).catch(e => Swal.fire('Error', e.message, 'error')) })
  }

  const handleProcess = async (action, payload, record) => {
    setOpsTarget(null)
    try {
      await processExp.mutateAsync({ uniqId: record.uniq_id, action, payload })
      Swal.fire('Success', 'Processed', 'success')
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleUpload = async (rec) => {
    const input = document.createElement('input'); input.type = 'file'
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return
      try {
        Swal.fire({ title: 'Uploading...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
        const result = await uploadToDrive(file)
        await attachFile.mutateAsync({ uniqId: rec.uniq_id, fileId: result.fileId })
        Swal.fire('Uploaded!', '', 'success')
      } catch (err) { Swal.fire('Error', err.message, 'error') }
    }
    input.click()
  }

  const handleBatchProcess = async (action) => {
    if (!selected.length) return Swal.fire('Info', 'No items selected', 'info')
    const requiredStatus = action === 'OPS_CHECK' ? 'Pending' : 'Checked'
    const eligible = filtered.filter(r => selected.includes(r.uniq_id) && r.status === requiredStatus)
    if (!eligible.length) return Swal.fire('Info', 'No eligible items', 'info')
    const result = await Swal.fire({ title: `Process ${eligible.length} item(s)?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Yes' })
    if (!result.isConfirmed) return
    try {
      await batchProcess.mutateAsync({ ids: eligible.map(r => r.uniq_id), action })
      setSelected([])
      Swal.fire('Done!', `Processed ${eligible.length} items.`, 'success')
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleBatchDelete = async () => {
    if (!selected.length) return
    const result = await Swal.fire({ title: `Delete ${selected.length} item(s)?`, text: 'Cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, delete' })
    if (!result.isConfirmed) return
    try {
      for (const id of selected) await deleteExp.mutateAsync(id)
      setSelected([])
      Swal.fire('Deleted!', '', 'success')
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const exportCSV = () => {
    const rows = [['Date', 'Account Title', 'Category', 'Branch Code', 'Branch Name', 'Item', 'Amount', 'Status', 'Uploader'],
      ...filtered.map(r => [r.date, r.account_title, r.category, r.branch_code, r.branch_name, r.item_name, r.amount, r.status, r.uploader])]
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv)
    a.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  const handleSort = (key) => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc') }; setPage(1) }
  const SortIcon = ({ k }) => sortKey === k ? <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'} text-blue-500 text-xs ml-1`} /> : <i className="fas fa-sort text-gray-300 text-xs ml-1" />
  const selectOptions = (items) => items.map(item => ({ value: item, label: item }))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{config.title}</h1>
          <p className="text-sm font-semibold text-gray-500">{config.subtitle}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.length > 0 && (
            <>
              {canCheck && <button onClick={() => handleBatchProcess('OPS_CHECK')} className="btn-primary text-xs px-3 py-2"><i className="fas fa-check-double mr-1" />Check ({selected.length})</button>}
              <button onClick={handleBatchSendEmail} className="btn-icon bg-amber-500 text-white text-xs px-3 py-2 rounded-lg"><i className="fas fa-envelope mr-1" />Email ({selected.length})</button>
              {isAdmin && <button onClick={handleBatchDelete} className="btn-danger text-xs px-3 py-2"><i className="fas fa-trash mr-1" />Delete ({selected.length})</button>}
            </>
          )}
          <button onClick={exportCSV} className="btn-secondary text-xs px-3 py-2"><i className="fas fa-file-excel mr-1 text-green-600" />Export</button>
          {canUpload && <button onClick={() => openModal()} className="btn-primary text-xs px-3 py-2"><i className="fas fa-plus mr-1" />New Entry</button>}
        </div>
      </div>

      {/* Budget Cards */}
      <div className={`grid gap-3 mb-5 ${config.categories.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : config.categories.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
        {config.categories.map(cat => {
          const stats = budgetStats[cat] || { count: 0, spent: 0 }
          const budget = config.budgets?.[cat]
          const pct = budget ? Math.min(100, Math.round(stats.spent / budget * 100)) : null
          return (
            <div key={cat} className={`bg-gradient-to-br ${config.budgetColors[cat]} rounded-xl p-4 text-white shadow-sm`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold opacity-80 uppercase tracking-wide">{cat}</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-semibold">{stats.count} items</span>
              </div>
              {budget && <div className="text-xs opacity-70 mb-1">Budget: {fmtCurrency(budget)}</div>}
              <div className="text-xl font-bold mb-2">{fmtCurrency(stats.spent)}</div>
              {budget && (
                <>
                  <div className="h-1.5 bg-white/25 rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs opacity-75">Remaining: {fmtCurrency(budget - stats.spent)}</div>
                </>
              )}
              {!budget && <div className="text-xs opacity-75">Total Spent</div>}
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input className="input pl-9 text-sm" placeholder="Search branch or item..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <select className="input text-sm py-1.5 w-auto" value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}>
            <option value="All">All Categories</option>
            {config.categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="input text-sm py-1.5 w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            <option value="All">All Status</option>
            {['Pending', 'Checked', 'Rejected'].map(s => <option key={s}>{s}</option>)}
          </select>
          <input type="date" className="input text-sm py-1.5 w-auto" value={dateStart} onChange={e => { setDateStart(e.target.value); setPage(1) }} />
          <span className="self-center text-gray-400">to</span>
          <input type="date" className="input text-sm py-1.5 w-auto" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setPage(1) }} />
          <SegmentedSearchSelect label="Operation" value={geoFilter.operation} options={selectOptions(geoLists.operations)} onChange={value => setGeo('operation', value)} />
          <SegmentedSearchSelect label="Division" value={geoFilter.division} options={selectOptions(geoLists.divisions)} onChange={value => setGeo('division', value)} />
          <SegmentedSearchSelect label="Region" value={geoFilter.region} options={selectOptions(geoLists.regions)} onChange={value => setGeo('region', value)} />
          <SegmentedSearchSelect label="Area" value={geoFilter.area} options={selectOptions(geoLists.areas)} onChange={value => setGeo('area', value)} />
          <SegmentedSearchSelect label="Branch" value={geoFilter.branchCode} options={geoLists.branchesOptions} onChange={value => setGeo('branchCode', value)} className="w-[260px]" />
          <button onClick={() => { setSearch(''); setCategory('All'); setStatus('All'); setDateStart(''); setDateEnd(''); setGeoFilter({ operation: '', division: '', region: '', area: '', branchCode: '' }); setPage(1) }} className="btn-secondary text-xs px-3 py-1.5">
            <i className="fas fa-sync-alt mr-1" />Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full min-w-[1240px] table-fixed">
            <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
              <tr>
                <th className="table-th w-10">
                  <input type="checkbox" className="rounded"
                    checked={paged.length > 0 && paged.every(r => selected.includes(r.uniq_id))}
                    onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...paged.map(r => r.uniq_id)])] : selected.filter(id => !paged.map(r => r.uniq_id).includes(id)))}
                  />
                </th>
                <th className="table-th w-12">#</th>
                {[['created_at', 'Date Uploaded'], ['account_title', 'Account Title'], ['category', 'Category'], ['branch_code', 'Branch & Item'], ['amount', 'Amount'], ['status', 'Status']].map(([k, l]) => (
                  <th key={k} className={`table-th cursor-pointer ${
                    k === 'created_at' ? 'w-44' :
                    k === 'account_title' ? 'w-52' :
                    k === 'branch_code' ? 'w-72' :
                    'w-36'
                  }`} onClick={() => handleSort(k)}>{l}<SortIcon k={k} /></th>
                ))}
                <th className="table-th w-44">Uploader</th>
                <th className="table-th hidden md:table-cell w-44">Checked By</th>

                <th className="table-th text-right w-56">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableLoader /> : paged.length === 0 ? <EmptyRow cols={12} /> :
                paged.map((r, idx) => {
                  const uploadedAt = getUploadedAt(r)
                  return (
                  <tr key={r.uniq_id} className="table-tr">
                    <td className="table-td">
                      <input type="checkbox" className="rounded" checked={selected.includes(r.uniq_id)}
                        onChange={e => setSelected(e.target.checked ? [...selected, r.uniq_id] : selected.filter(id => id !== r.uniq_id))}
                      />
                    </td>
                    <td className="table-td text-gray-400 text-xs">{(page - 1) * ROWS_PER_PAGE + idx + 1}</td>
                    <td className="table-td text-sm whitespace-nowrap">
                      <div className="font-semibold text-sm">
                        {uploadedAt ? uploadedAt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {uploadedAt ? uploadedAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>
                    <td className="table-td min-w-0">
                      <div className="font-semibold text-sm truncate" title={r.account_title || ''}>{r.account_title || '-'}</div>
                    </td>
                    <td className="table-td"><span className="badge badge-approved text-xs">{r.category}</span></td>
                    <td className="table-td min-w-0">
                      <div className="font-semibold text-sm truncate" title={`${r.branch_code} - ${r.branch_name}`}>{r.branch_code} - {r.branch_name}</div>
                      {(() => {
                        const itemName = r.item_name || ''
                        const parts = itemName.split(' - ')
                        if (parts.length > 1) {
                          const subcategory = parts[0].trim()
                          const itemDetail = parts.slice(1).join(' - ').trim()
                          return (
                            <>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={subcategory}>{subcategory}</div>
                              <div className="text-xs text-gray-400 dark:text-gray-500 truncate" title={itemDetail}>- {itemDetail}</div>
                            </>
                          )
                        }
                        return <div className="text-xs text-gray-400 dark:text-gray-500 truncate" title={itemName}>{itemName}</div>
                      })()}
                    </td>
                    <td className="table-td font-semibold whitespace-nowrap">{fmtCurrency(r.amount)}</td>
                    <td className="table-td whitespace-nowrap"><StatusBadge status={r.status} remarks={r.remarks} /></td>
                    <td className="table-td text-xs" dangerouslySetInnerHTML={{ __html: r.uploader_info || r.uploader || '—' }} />
                    <td className="table-td text-xs hidden md:table-cell" dangerouslySetInnerHTML={{ __html: r.ops_info || '—' }} />

                    <td className="table-td">
                      <div className="table-actions">
                        <button onClick={() => r.file_id && setPreviewFile(r.file_id)} className={`btn-icon ${r.file_id ? 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title={r.file_id ? 'Preview' : 'No file'}><i className="fas fa-eye" /></button>
                        {canUpload && <>
                          <button onClick={() => handleUpload(r)} className="btn-icon bg-blue-50 text-blue-600 hover:bg-blue-100" title="Upload"><i className="fas fa-upload" /></button>
                          <button onClick={() => openModal(r)} className="btn-icon bg-gray-50 text-gray-500 hover:bg-gray-100" title="Edit"><i className="fas fa-pencil-alt" /></button>
                        </>}
                        {r.status === 'Pending' && canCheck && <button onClick={() => setOpsTarget(r)} className="btn-icon bg-blue-50 text-blue-600 hover:bg-blue-100" title="Check"><i className="fas fa-check" /></button>}
                        {/* Removed Approve button */}
                        {/* {r.status === 'Checked' && canApprove && <button onClick={() => setFinTarget(r)} className="btn-icon bg-emerald-50 text-emerald-600 hover:bg-emerald-100" title="Approve"><i className="fas fa-thumbs-up" /></button>} */}
                        <button 
                          onClick={() => handleSendEmail(r)} 
                          className={`btn-icon ${r.status === 'Checked' ? 'bg-amber-50 text-amber-500 hover:bg-amber-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} 
                          title={r.status === 'Checked' ? 'Send Email' : 'Available only for Checked status'}
                          disabled={r.status !== 'Checked'}
                        ><i className="fas fa-envelope" /></button>
                        {isAdmin && <button onClick={() => handleDelete(r)} className="btn-icon bg-red-50 text-red-500 hover:bg-red-100" title="Delete"><i className="fas fa-trash" /></button>}
                      </div>
                    </td>
                  </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} onChange={setPage} />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="modal-header flex items-start justify-between gap-4 shrink-0">
              <div>
                <h3 className="modal-title"><i className={`fas ${config.icon} text-sky-200`} />{editing ? 'Edit Expense Entry' : 'New Expense Entry'}</h3>
                <p className="modal-subtitle">{config.title}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-300 transition hover:bg-white/15 hover:text-white" title="Close">
                <i className="fas fa-times text-sm" />
              </button>
            </div>

            <div className="modal-body space-y-5 bg-slate-50 overflow-y-auto flex-1">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Category</label>
                    <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {config.categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Date</label>
                    <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <i className="fas fa-building text-xs" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Branch Details</div>
                    <div className="text-xs text-slate-500">Select branch code and confirm the branch name.</div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr]">
                  <div className="relative">
                    <label className="label text-blue-700">Branch Code*</label>
                    <input
                      className="input text-base font-semibold uppercase"
                      value={form.branchCode}
                      placeholder="B0001"
                      onFocus={() => setBranchLookupOpen(true)}
                      onBlur={() => setTimeout(() => setBranchLookupOpen(false), 200)}
                      onChange={e => {
                        // Auto-correct letter 'O' to number '0' to prevent typos
                        const code = e.target.value.toUpperCase().replace(/O/g, '0')
                        const branch = branchOptions.find(b => b.value === code)
                        setForm(f => ({ ...f, branchCode: code, branchName: branch ? branch.label.split(' - ').slice(1).join(' - ') : '' }))
                        setBranchLookupOpen(true)
                      }}
                    />
                    {branchLookupOpen && (
                      <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-blue-500 bg-white shadow-xl">
                        {branchMatches.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-slate-500">No branch found</div>
                        ) : branchMatches.map(branch => (
                          <button
                            key={branch.value}
                            type="button"
                            className={`grid w-full grid-cols-[72px_1fr] gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-blue-50 ${branch.value === form.branchCode ? 'bg-blue-100' : ''}`}
                            onMouseDown={event => {
                              event.preventDefault()
                              handleBranchSelect(branch.value)
                              setBranchLookupOpen(false)
                            }}
                          >
                            <span className="font-bold text-blue-700">{branch.value}</span>
                            <span className="text-slate-600">{branch.label.split(' - ').slice(1).join(' - ')}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label text-blue-700">Branch Name</label>
                    <input className="input text-sm font-semibold text-rose-700" readOnly value={form.branchName} placeholder="Auto-filled" />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label text-blue-700">Area</label>
                    <input className="input text-sm" readOnly value={selectedBranch?.area || ''} placeholder="Auto-filled" />
                  </div>
                  <div>
                    <label className="label text-blue-700">Region</label>
                    <input className="input text-sm" readOnly value={selectedBranch?.region || ''} placeholder="Auto-filled" />
                  </div>
                  <div>
                    <label className="label text-blue-700">Division</label>
                    <input className="input text-sm" readOnly value={selectedBranch?.division || ''} placeholder="Auto-filled" />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Account Title</label>
                    <select className="input" value={form.accountTitle} onChange={e => setForm(f => ({ ...f, accountTitle: e.target.value }))}>
                      <option value="">Select...</option>
                      {titles.map(title => <option key={title}>{title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Amount (PHP)</label>
                    <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label">{type === 'it' ? 'Item Name (Model/Brand)' : 'Particulars'}</label>
                  <input className="input" placeholder={type === 'it' ? 'e.g. Epson L3210 EcoTank' : 'e.g. Cleaning / Repair'} value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} />
                </div>
                <div className="mt-3">
                  <label className="label">Notes</label>
                  <textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} disabled={createExp.isPending || updateExp.isPending} className="btn-primary">
                  {editing ? 'Update Entry' : 'Save Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {opsTarget && <OpsModal record={opsTarget} onConfirm={(a, p) => handleProcess(a, p, opsTarget)} onClose={() => setOpsTarget(null)} />}
      {previewFile && <FilePreviewModal fileId={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  )
}
