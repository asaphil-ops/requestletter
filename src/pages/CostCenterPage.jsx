import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../hooks/useAccounts'
import { useAuthStore } from '../store/authStore'
import { useAttachFileCostCenter, useCostCenter, useCreateCostCenter, useDeleteCostCenter, useProcessCostCenter, useUpdateCostCenter, useBatchDeleteCostCenter } from '../hooks/useCostCenter'
import { useInitiativeMappings } from '../hooks/useInitiativeMappings'
import { useEmployeeList } from '../hooks/useEmployeeList'
import { uploadToDrive } from '../lib/gas'
import { fmtCurrency, fmtDate, ROWS_PER_PAGE } from '../lib/utils'
import Pagination from '../components/shared/Pagination'
import { EmptyRow, TableLoader } from '../components/shared/Loader'
import StatusBadge from '../components/shared/StatusBadge'
import FilePreviewModal from '../components/shared/FilePreviewModal'
import { OpsModal } from '../components/shared/ProcessModal'
import Swal from 'sweetalert2'

// Operation email mapping for fallback
const OPERATION_EMAIL_MAP = {
  "LUZON I": "jinnette.anacio@asaphil.org",
  "LUZON II": "cynthia.casido@asaphil.org",
  "VISAYAS I": "jonnie.borgonia@asaphil.org",
  "VISAYAS II": "sharon.galeno@asaphil.org",
  "MINDANAO I": "taib.abduraji@asaphil.org",
  "MINDANAO II": "arlyn.yagaya@asaphil.org",
};

const TYPE_OPTIONS = ['Cash', 'Check', 'Online Transfer', 'Reimbursement', 'Others']

const CONFIG = {
  initiatives: {
    title: 'Initiatives Monthly Expenses',
    subtitle: 'Cost center tracking for monthly initiatives expenses',
    icon: 'fa-lightbulb',
    emptyForm: { date: '', particular: '', sub_account: '', account_title: '', amount: '', transaction_type: '', remarks: '' },
    columns: [
      ['date', 'Date'],
      ['particular', 'Particular'],
      ['sub_account', 'Sub Account'],
      ['account_title', 'Account Title'],
      ['amount', 'Amount'],
      ['transaction_type', 'Type of Transactions'],
      ['remarks', 'Remarks'],
    ],
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'particular', label: 'Particular', type: 'initiative-particular', required: true },
      { key: 'sub_account', label: 'Sub Account', type: 'initiative-sub-account' },
      { key: 'account_title', label: 'Account Title', type: 'initiative-account-title' },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'transaction_type', label: 'Type of Transactions', type: 'select', options: ['Cash','Non-Cash'], required: true },
      { key: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
  },
  cfoo: {
    title: 'CFOO Per Staff Monthly Expense',
    subtitle: 'Cost center tracking per staff member',
    icon: 'fa-user-tie',
    emptyForm: { date: '', id_number: '', staff_name: '', designation: '', sub_account: '', account_title: '', amount: '', transaction_type: '', remarks: '' },
    columns: [
      ['date', 'Date'],
      ['id_number', 'ID Number'],
      ['staff_name', 'Name of Staff'],
      ['designation', 'Designation'],
      ['sub_account', 'Sub Account'],
      ['account_title', 'Account Title'],
      ['amount', 'Amount'],
      ['transaction_type', 'Type of Transactions'],
      ['remarks', 'Remarks'],
    ],
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'staff_name', label: 'Name of Staff', type: 'employee-name', required: true },
      { key: 'id_number', label: 'ID Number', type: 'employee-id', required: true },
      { key: 'designation', label: 'Designation', type: 'employee-designation', required: true },
      { key: 'sub_account', label: 'Sub Account', type: 'cfoo-sub-account' },
      { key: 'account_title', label: 'Account Title', type: 'cfoo-account-title', required: true },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'transaction_type', label: 'Type of Transactions', type: 'select', options: TYPE_OPTIONS, required: true },
      { key: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
  },
  other: {
    title: 'Other Cost Center Monthly Expenses',
    subtitle: 'Other cost center monthly expense monitoring',
    icon: 'fa-building-columns',
    emptyForm: { date: '', account_title: '', cost_center: '', amount: '', remarks: '' },
    columns: [
      ['date', 'Date'],
      ['account_title', 'Account Title'],
      ['cost_center', 'Cost Center'],
      ['amount', 'Amount'],
      ['remarks', 'Remarks'],
    ],
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'account_title', label: 'Account Title', type: 'account', required: true },
      { key: 'cost_center', label: 'Cost Center', required: true },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
  },
}

export default function CostCenterPage({ type }) {
  const config = CONFIG[type]
  const { canCheck, canUpload, isAdmin } = useAuthStore()
  const navigate = useNavigate()
  const { data = [], isLoading } = useCostCenter(type)
  const { data: initiativeMappings = [] } = useInitiativeMappings()
  const { data: employeeList = [] } = useEmployeeList()
  const { data: settings } = useSettings()
  const createRecord = useCreateCostCenter(type)
  const updateRecord = useUpdateCostCenter(type)
  const deleteRecord = useDeleteCostCenter(type)
  const processRecord = useProcessCostCenter(type)
  const attachFile = useAttachFileCostCenter(type)
  const batchDelete = useBatchDeleteCostCenter(type)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [opsTarget, setOpsTarget] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [form, setForm] = useState(config.emptyForm)
  const titles = settings?.titles || []
  const initiativeParticulars = useMemo(
    () => [...new Set(initiativeMappings.map(row => row.particular).filter(Boolean))].sort(),
    [initiativeMappings]
  )
  const cfooSubAccounts = useMemo(
    () => [...new Set(initiativeMappings.map(row => row.sub_account).filter(Boolean))].sort(),
    [initiativeMappings]
  );
  const initiativeAccountTitles = useMemo(
    () => [...new Set(initiativeMappings.map(row => row.account_title).filter(Boolean))].sort(),
    [initiativeMappings]
  )
  const employeeNames = useMemo(
    () => [...new Set(employeeList.map(row => row.full_name).filter(Boolean))].sort(),
    [employeeList]
  )

  const filtered = useMemo(() => {
    const needle = search.toLowerCase()
    let result = data
    if (needle) {
      result = result.filter(row => config.columns.some(([key]) => String(row[key] ?? '').toLowerCase().includes(needle)))
    }
    if (dateFrom) {
      const from = new Date(dateFrom)
      result = result.filter(row => row.date && new Date(row.date) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter(row => row.date && new Date(row.date) <= to)
    }
    if (statusFilter) {
      result = result.filter(row => (row.status || 'Pending') === statusFilter)
    }
    return result
  }, [config.columns, data, search, dateFrom, dateTo, statusFilter])

  const paged = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)
  const totalAmount = filtered.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)

  // Status counts
  const pendingCount = data.filter(r => (r.status || 'Pending') === 'Pending').length
  const checkedCount = data.filter(r => r.status === 'Checked').length

  const openModal = (record = null) => {
    setEditing(record)
    if (record) {
      setForm(Object.fromEntries(Object.keys(config.emptyForm).map(key => [key, record[key] ?? ''])))
    } else {
      // Set default date to today for new records
      const today = new Date().toISOString().split('T')[0]
      setForm({ ...config.emptyForm, date: today })
    }
    setShowModal(true)
  }

  const handleSave = async () => {
    const missing = config.fields.find(field => field.required && !String(form[field.key] || '').trim())
    if (missing) return Swal.fire('Missing field', `${missing.label} is required`, 'warning')

    const payload = { ...form, amount: form.amount || 0 }
    try {
      if (editing) {
        await updateRecord.mutateAsync({ uniqId: editing.uniq_id, updates: payload })
        Swal.fire('Updated!', '', 'success')
      } else {
        await createRecord.mutateAsync(payload)
        Swal.fire('Saved!', '', 'success')
      }
      setShowModal(false)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleDelete = async (record) => {
    const result = await Swal.fire({ title: 'Delete record?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, delete' })
    if (!result.isConfirmed) return
    try {
      await deleteRecord.mutateAsync(record.uniq_id)
      setSelectedIds(prev => { const next = new Set(prev); next.delete(record.uniq_id); return next })
      Swal.fire('Deleted!', '', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const toggleSelect = (uniqId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(uniqId)) next.delete(uniqId)
      else next.add(uniqId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paged.length && paged.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paged.map(r => r.uniq_id)))
    }
  }

  const handleBatchDelete = async () => {
    if (!selectedIds.size) return
    const result = await Swal.fire({
      title: `Delete ${selectedIds.size} record${selectedIds.size > 1 ? 's' : ''}?`,
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: `Yes, delete all`,
    })
    if (!result.isConfirmed) return
    try {
      await batchDelete.mutateAsync([...selectedIds])
      setSelectedIds(new Set())
      Swal.fire('Deleted!', `${selectedIds.size} record${selectedIds.size > 1 ? 's' : ''} deleted.`, 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleProcess = async (action, payload, record) => {
    setOpsTarget(null)
    try {
      await processRecord.mutateAsync({ uniqId: record.uniq_id, action, payload })
      Swal.fire('Success', 'Processed', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleUpload = async (record) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        Swal.fire({ title: 'Uploading...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
        const result = await uploadToDrive(file)
        await attachFile.mutateAsync({ uniqId: record.uniq_id, fileId: result.fileId })
        Swal.fire('Uploaded!', '', 'success')
      } catch (err) {
        Swal.fire('Error', err.message, 'error')
      }
    }
    input.click()
  }

  const handleBatchSendEmail = () => {
    const eligible = filtered.filter(r => selectedIds.has(r.uniq_id) && r.status === 'Checked')
    if (!eligible.length) return Swal.fire('Info', 'Select checked items first', 'info')
    
    const emails = eligible.map(r => {
      const emp = employeeList.find(e => e.id_number === r.id_number || e.full_name === r.staff_name)
      return emp?.email_address
    }).filter(Boolean)

    navigate('/send-email', {
      state: {
        draft: {
          to: [...new Set(emails)],
          subject: `${config.title} - Batch Release`,
          note: `Checked ${config.title} for multiple staff members. Total: ${fmtCurrency(eligible.reduce((s, r) => s + Number(r.amount || 0), 0))}`,
          refId: [...selectedIds].join(','),
          refType: config.title,
        },
      },
    })
  }

  const handleSendEmail = (record) => {
    const emp = employeeList.find(e => e.id_number === record.id_number || e.full_name === record.staff_name)
    const recipientEmail = emp?.email_address || ''

    const subject = `${config.title} - ${record.account_title || record.staff_name || record.cost_center || record.uniq_id}`
    navigate('/send-email', {
      state: {
        draft: {
          to: recipientEmail ? [recipientEmail] : [],
          subject,
          note: `Checked ${config.title} for ${record.staff_name || record.cost_center}. Amount: ${fmtCurrency(record.amount)}.`,
          refId: record.uniq_id,
          refType: config.title,
          fileId: record.file_id || '',
        },
      },
    })
  }

  const exportCSV = () => {
    const headers = config.columns.map(([, label]) => label)
    const rows = filtered.map(row => config.columns.map(([key]) => row[key] ?? ''))
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv)
    a.download = `${type}_cost_center_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const renderCell = (row, key) => {
    if (key === 'date') return fmtDate(row[key])
    if (key === 'amount') return <span className="font-semibold whitespace-nowrap">{fmtCurrency(row[key])}</span>
    if (key === 'remarks') return <span className="block truncate text-gray-500" title={row[key] || ''}>{row[key] || '-'}</span>
    return <span className="block truncate" title={String(row[key] || '')}>{row[key] || '-'}</span>
  }

  const renderField = (field) => {
    const value = form[field.key] ?? ''
    const onChange = (next) => setForm(prev => ({ ...prev, [field.key]: next }))

    if (field.type === 'initiative-particular') {
      return (
        <>
          <input
            className="input"
            list="initiative-particular-options"
            value={value}
            placeholder="Select or encode particular..."
            onChange={e => {
              const particular = e.target.value
              const matches = initiativeMappings.filter(row => row.particular === particular)
              const complete = matches.find(row => row.sub_account || row.account_title)
              setForm(prev => ({
                ...prev,
                particular,
                sub_account: '',
                account_title: '',
              }))
            }}
          />
          <datalist id="initiative-particular-options">
            {initiativeParticulars.map(particular => <option key={particular} value={particular} />)}
          </datalist>
        </>
      )
    }

    if (field.type === 'employee-name') {
      return (
        <>
          <input
            className="input"
            list="employee-name-options"
            value={value}
            placeholder="Select or encode name..."
            onChange={e => {
              const staffName = e.target.value
              const match = employeeList.find(row => row.full_name === staffName)
              setForm(prev => ({
                ...prev,
                staff_name: staffName,
                id_number: match?.id_number || prev.id_number,
                designation: match?.designation || prev.designation,
              }))
            }}
          />
          <datalist id="employee-name-options">
            {employeeNames.map(name => <option key={name} value={name} />)}
          </datalist>
        </>
      )
    }

    if (field.type === 'employee-id') {
      return <input className="input" value={value} placeholder="Auto-filled or encode ID number..." onChange={e => onChange(e.target.value)} />
    }

    if (field.type === 'employee-designation') {
      return <input className="input" value={value} placeholder="Auto-filled or encode designation..." onChange={e => onChange(e.target.value)} />
    }

    if (field.type === 'initiative-sub-account') {
      return (
        <>
          <input
            className="input"
            list="initiative-sub-account-options"
            value={value}
            placeholder="Select or encode sub account..."
            onChange={e => {
              const subAccount = e.target.value;
              const match = initiativeMappings.find(row => row.sub_account === subAccount);
              setForm(prev => ({ ...prev, sub_account: subAccount, account_title: match?.account_title || prev.account_title }));
            }}
          />
          <datalist id="initiative-sub-account-options">
            {initiativeSubAccounts.map(subAccount => <option key={subAccount} value={subAccount} />)}
          </datalist>
        </>
      )
    }

    if (field.type === 'cfoo-sub-account') {
        return (
          <>
            <input
              className="input"
              list="cfoo-sub-account-options"
              value={value}
              placeholder="Select sub account..."
              onChange={e => {
                const subAccount = e.target.value;
                const match = initiativeMappings.find(row => row.sub_account === subAccount);
                setForm(prev => ({
                  ...prev,
                  sub_account: subAccount,
                  account_title: match?.account_title || prev.account_title,
                }));
              }}
            />
            <datalist id="cfoo-sub-account-options">
              {cfooSubAccounts.map(sa => <option key={sa} value={sa} />)}
            </datalist>
          </>
        );
      }

      // existing initiative account title rendering remains unchanged
      if (field.type === 'cfoo-account-title') {
        return (
          <input
            className={`input ${value ? 'bg-green-100' : 'bg-red-100'}`}
            value={value}
            placeholder="Auto-filled account title"
            readOnly
            disabled
          />
        );
      }

    if (field.type === 'textarea') {
      return <textarea className="input resize-none" rows={3} value={value} onChange={e => onChange(e.target.value)} />
    }

    if (field.type === 'select') {
      return (
        <select className="input" value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select...</option>
          {field.options.map(option => <option key={option}>{option}</option>)}
        </select>
      )
    }

    if (field.type === 'account') {
      return (
        <select className="input" value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select account title...</option>
          {titles.map(title => <option key={title}>{title}</option>)}
        </select>
      )
    }

    return <input className="input" type={field.type || 'text'} value={value} onChange={e => onChange(e.target.value)} />
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{config.subtitle}</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{config.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCSV} className="btn-secondary text-xs px-3 py-2"><i className="fas fa-file-excel mr-1 text-green-600" />Export</button>
          {canUpload && <button onClick={() => openModal()} className="btn-primary text-xs px-3 py-2"><i className="fas fa-plus mr-1" />New Entry</button>}
        </div>
      </div>

      {/* Enhanced Score Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-lg shadow-blue-500/20">
          <div className="absolute top-2 right-2 text-blue-200/20">
            <i className="fas fa-database text-4xl" />
          </div>
          <div className="relative">
            <div className="text-3xl font-bold tracking-tight">{filtered.length}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-blue-100">Total Records</div>
            <div className="mt-0.5 text-[10px] text-blue-200/60">{data.length} records total</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-lg shadow-emerald-500/20">
          <div className="absolute top-2 right-2 text-emerald-200/20">
            <i className="fas fa-coins text-4xl" />
          </div>
          <div className="relative">
            <div className="text-3xl font-bold tracking-tight truncate">{fmtCurrency(totalAmount)}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-100">Total Amount</div>
            <div className="mt-0.5 text-[10px] text-emerald-200/60">Filtered total</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-4 text-white shadow-lg shadow-amber-500/20">
          <div className="absolute top-2 right-2 text-amber-200/40">
            <i className="fas fa-clock text-4xl" />
          </div>
          <div className="relative">
            <div className="text-3xl font-bold tracking-tight">{pendingCount}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-amber-100">Pending</div>
            <div className="mt-0.5 text-[10px] text-amber-200/60">Awaiting check</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 p-4 text-white shadow-lg shadow-sky-500/20">
          <div className="absolute top-2 right-2 text-sky-200/40">
            <i className="fas fa-check-double text-4xl" />
          </div>
          <div className="relative">
            <div className="text-3xl font-bold tracking-tight">{checkedCount}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-sky-100">Checked</div>
            <div className="mt-0.5 text-[10px] text-sky-200/60">Ready for sending</div>
          </div>
        </div>
      </div>

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-700/30 rounded-xl px-5 py-3">
          <div className="flex-1">
            <span className="text-sm font-semibold text-red-700 dark:text-red-300">
              <i className="fas fa-check-square mr-1.5" />
              {selectedIds.size} record{selectedIds.size > 1 ? 's' : ''} selected
            </span>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <i className="fas fa-times mr-1" />Clear
          </button>
          <button
            onClick={handleBatchSendEmail}
            className="bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <i className="fas fa-envelope" /> Email Selected
          </button>
          <button
            onClick={handleBatchDelete}
            disabled={batchDelete.isPending}
            className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {batchDelete.isPending ? (
              <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting...</>
            ) : (
              <><i className="fas fa-trash" /> Delete Selected</>
            )}
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              className="input pl-9"
              placeholder="Search records..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Date:</label>
            <input
              type="date"
              className="input text-sm w-[135px]"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              title="From date"
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              type="date"
              className="input text-sm w-[135px]"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
              title="To date"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
                className="btn-icon bg-red-50 text-red-500 hover:bg-red-100"
                title="Clear date filter"
              >
                <i className="fas fa-times" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Status:</label>
            <select
              className="input text-sm w-[125px]"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Checked">Checked</option>
              <option value="Rejected">Rejected</option>
            </select>
            {statusFilter && (
              <button
                onClick={() => { setStatusFilter(''); setPage(1) }}
                className="btn-icon bg-red-50 text-red-500 hover:bg-red-100"
                title="Clear status filter"
              >
                <i className="fas fa-times" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className={`w-full table-fixed ${type === 'cfoo' ? 'min-w-[1760px]' : type === 'initiatives' ? 'min-w-[1520px]' : 'min-w-[1280px]'}`}>
            <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
              <tr>
                <th className="table-th w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={paged.length > 0 && selectedIds.size === paged.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="table-th w-12">#</th>
                {config.columns.map(([, label]) => <th key={label} className="table-th w-40">{label}</th>)}
                <th className="table-th w-32">Status</th>
                <th className="table-th w-44">Uploader</th>
                <th className="table-th hidden md:table-cell w-44">Checked By</th>

                <th className="table-th text-right w-56">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableLoader /> : paged.length === 0 ? <EmptyRow cols={config.columns.length + 6} /> :
                paged.map((row, index) => (
                  <tr key={row.uniq_id} className={`table-tr ${selectedIds.has(row.uniq_id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                    <td className="table-td">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selectedIds.has(row.uniq_id)}
                        onChange={() => toggleSelect(row.uniq_id)}
                      />
                    </td>
                    <td className="table-td text-xs text-gray-400">{(page - 1) * ROWS_PER_PAGE + index + 1}</td>
                    {config.columns.map(([key]) => <td key={key} className="table-td min-w-0">{renderCell(row, key)}</td>)}
                    <td className="table-td whitespace-nowrap"><StatusBadge status={row.status || 'Pending'} remarks={row.remarks} /></td>
                    <td className="table-td text-xs truncate" dangerouslySetInnerHTML={{ __html: row.uploader_info || row.uploader || '-' }} />
                    <td className="table-td text-xs hidden md:table-cell truncate" dangerouslySetInnerHTML={{ __html: row.ops_info || '-' }} />

                    <td className="table-td">
                      <div className="table-actions">
                        <button onClick={() => row.file_id && setPreviewFile(row.file_id)} className={`btn-icon ${row.file_id ? 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title={row.file_id ? 'Preview' : 'No file'}><i className="fas fa-eye" /></button>
                        {canUpload && <button onClick={() => handleUpload(row)} className="btn-icon bg-blue-50 text-blue-600 hover:bg-blue-100" title="Upload"><i className="fas fa-upload" /></button>}
                        {canUpload && <button onClick={() => openModal(row)} className="btn-icon bg-gray-50 text-gray-500 hover:bg-gray-100" title="Edit"><i className="fas fa-pencil-alt" /></button>}
                        {(row.status || 'Pending') === 'Pending' && canCheck && <button onClick={() => setOpsTarget(row)} className="btn-icon bg-blue-50 text-blue-600 hover:bg-blue-100" title="Check"><i className="fas fa-check" /></button>}
                        <button 
                          onClick={() => handleSendEmail(row)} 
                          className={`btn-icon ${row.status === 'Checked' ? 'bg-amber-50 text-amber-500 hover:bg-amber-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} 
                          title={row.status === 'Checked' ? 'Send Email' : 'Available only for Checked status'}
                          disabled={row.status !== 'Checked'}
                        >
                          <i className="fas fa-envelope" />
                        </button>
                        {isAdmin && <button onClick={() => handleDelete(row)} className="btn-icon bg-red-50 text-red-500 hover:bg-red-100" title="Delete"><i className="fas fa-trash" /></button>}
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} onChange={(p) => { setPage(p); setSelectedIds(new Set()) }} />
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><i className={`fas ${config.icon} text-sky-200`} />{editing ? 'Edit Entry' : 'New Entry'}</h3>
              <p className="modal-subtitle">{config.title}</p>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {config.fields.map(field => (
                  <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="label">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} className="btn-primary" disabled={createRecord.isPending || updateRecord.isPending}>
                  {editing ? 'Update' : 'Save Record'}
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
