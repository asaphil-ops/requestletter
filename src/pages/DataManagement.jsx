import { useMemo, useRef, useState } from 'react'
import {
  useBulkUpsertInitiativeMappings,
  useCreateInitiativeMapping,
  useDeleteInitiativeMapping,
  useInitiativeMappings,
  useUpdateInitiativeMapping,
} from '../hooks/useInitiativeMappings'
import { useAuthStore } from '../store/authStore'
import { EmptyRow, TableLoader } from '../components/shared/Loader'
import Swal from 'sweetalert2'

const PARTICULAR_OPTIONS = [
  "2 Days Theoretical Orientation (PSO)",
  "Quarterly Management Meeting (AVP and up)",
  "Quarterly Divisional Performance Review (AVP, RA, AA)",
  "Quarterly Regional Performance Review (RA, AA, BH, ABH)",
  "Special Meeting with visiting SVP/VP (RA & AA)",
  "Special Meeting with visiting SVP/VP (BH & ABH)",
  "Year-end Party (Operations Supervisors)",
  "Year-end Party (Operations MFO/BH/AA/RA)",
  "Newly Deployed Staff",
  "Newly Deploy from Mindanao",
  "Newly Promoted ABH",
  "Promotional exam for ABH",
  "Performance Incentives",
  "New Satellites",
  "Conversion from Sat. to Full Branch",
  "Starlink (Monthly Internet Payment) - New",
  "Starlink (Monthly Internet Payment) - Existing",
  "Starlink (Monthly Internet Payment) - Additional",
  "Branch Internet Allocation paid by CO",
  "Printer (Heavy duty)",
  "CCTV",
  "Burial",
  "Maaasahan",
  "In Kind",
  "Cash",
  "Urban Gardening (Community Garden, Hydroponics)",
  "Medical Supplies & Intervention",
  "Educational Supplies",
  "Ecological Restoration & Waste Management",
  "Aquaculture & Agriculture Assistance",
  "Vulnerable Groups Assistance",
  "WASH Facility Projects (KasilyASAn, Water facility, Hand washing)",
  "Resilient House-build Projects",
  "Blended Financing (with Partners)",
  "Capacity Building (Emergency response for CCS)",
  "Learning Exchange Visit with Partners (Homfin & WaSaFin)",
  "CCS-Logistical expenses",
  "Contingency/Reserves for other projects and emergency funding",
  "Assistance Through Loan Rebates",
  "Office Equipment (Laptop)",
  "Office Equipment - Generator",
  "2 days RA TOT LDP (NOMURA)",
  "2 days TOT Performance Evaluation Workshop (OKRs - AVPs and Up)",
  "1 day Performance Evaluation Workshop (OKRs-RA)",
  "2 days RA TOT - Delinquency Management",
  "2 days RA TOT - Product Training and Credit assessment",
  "2 days RA Data Analytics Workshop",
  "2 days HR PPs TOT - MFOs Values Empowerment",
  "BH & ABH Head office Exposure",
  "IMF Staff Refresher Workshop",
  "Product Training (Cascading of DM and PTC ABH/ABH & MFO)",
  "AA LDP Cascading",
  "MFO Values Empowerment Cascading",
  "HR BP Training, Conferences, Networking and others",
  "Finance Operation Training",
  "International Conference",
  "Annual Conferences MCPI/MMC",
  "Industry & Regulatory Conference (CIC/MIDAS/DOLE/ SEC/BSP/Data Privacy etc.)",
  "SVP Training for Continuing Education",
  "VP Training for Continuing Education",
  "AVP Training for Continuing Education",
  "Monitor",
  "Branch IEC Materials (due to re-branding)",
  "Toilets Repairs",
  "Airconditioning",
  "Airconditioning Installation",
  "Clients loyalty program",
  "Tablets",
  "Tablets (amortization for globe)",
  "Tablets (amortization for smart)",
  "Tablets (Already purchased)",
  "MC insurance",
  "FAF",
  "Passbook",
  "Calendar",
  "GTR",
  "Monthly Meeting",
  "Semi-monthly meeting",
  "Weekly Team Meeting",
  "Quarterly Performance Review",
  "Budget Planning & Approval",
  "Performance Management System Enhancement",
  "Transportation Equipment (Car)",
  "Transportation Equipment (Motorcycle)",
  "Digital media boosting 1",
  "Digital media boosting 2",
  "Hero video 1 Client Feature Success Story",
  "Hero video 2 Client Feature Success Story",
  "Hero video 3 Client Feature Success Story",
  "Hero video 4 Client Feature Success Story",
  "Videos for ASA orientation to clients (regular)",
  "Videos for ASA orientation to clients (Islamic)",
  "ASA infomercials for branch TV monitors - talent fees",
  "For product posters - talent fees",
  "2027 Wall and Desk Calendars",
  "For product posters design and layout X 5 posters",
  "Furniture and Fixtures (Previous Year)"
]

const SUB_ACCOUNT_OPTIONS = [
  "In-house Trainings and Conferences", "External Trainings and Conferences", "Fuel Expense", "Vehicle Repair and Maintenance (PMS)",
  "Usage Costs", "Vehicle Rental/Leasing", "Public Fare", "Way home", "Meal expenses", "Lodging and Accommodation",
  "Freight/delivery costs", "Terminal fees", "Rent", "Interest Expense on Lease Obligations", "Utilities", "Postage Expense",
  "Internet Expense", "Meetings", "Publication and Subscription", "Association and Membership Dues", "Licenses and Permits",
  "Documentary Stamp Tax", "Local Taxes", "Real Estate Taxes", "Penalty", "Other Taxes Paid", "Repairs and Maintenance",
  "Insurance Expense", "Software licenses and subscriptions", "IT service and support fees", "Domain and web hosting",
  "Network costs", "Security services", "Recruitment services", "Janitorial and housekeeping services", "Other services",
  "Representation", "Miscellaneous", "Burial Assistance", "MaaASAhan Assistance", "In kind", "Cash", "Tertiary Education Assistance Program",
  "Technical Vocational Education & Training", "Formation Program", "Child Nutrition Program", "Health", "Food Access",
  "Financial Literacy", "iSTAR", "Product Promotion", "Livelihood Training", "Agri-based Livelihood", "Reforestation",
  "Consulting Services", "Legal Services", "Audit Services", "Other Professional Services", "Bank Charges/Others",
  "Stationery and Office Supplies", "Program and Survey Supplies", "Maintenance Supplies", "Emergency Supplies",
  "Furniture and Fixtures", "Office Equipment", "Office Equipment (Laptop)", "Transportation Equipment (Car)", "Transportation Equipment (Motorcycle)"
]

const EMPTY_FORM = { particular: '', sub_account: '', account_title: '' }

export default function DataManagement() {
  const { isAdmin, canUpload } = useAuthStore()
  const { data = [], isLoading } = useInitiativeMappings()
  const createMapping = useCreateInitiativeMapping()
  const bulkUpsertMappings = useBulkUpsertInitiativeMappings()
  const updateMapping = useUpdateInitiativeMapping()
  const deleteMapping = useDeleteInitiativeMapping()
  const fileInputRef = useRef(null)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const filtered = useMemo(() => {
    const needle = search.toLowerCase()
    if (!needle) return data
    return data.filter(row =>
      `${row.particular} ${row.sub_account} ${row.account_title}`.toLowerCase().includes(needle)
    )
  }, [data, search])

  const openModal = (record = null) => {
    setEditing(record)
    setForm(record ? {
      particular: record.particular || '',
      sub_account: record.sub_account || '',
      account_title: record.account_title || '',
    } : EMPTY_FORM)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.particular.trim() && !form.sub_account.trim()) {
      return Swal.fire('Missing field', 'Add at least Particular or Sub Account.', 'warning')
    }

    try {
      const payload = {
        particular: form.particular.trim(),
        sub_account: form.sub_account.trim(),
        account_title: form.account_title.trim(),
      }
      if (editing) {
        await updateMapping.mutateAsync({ id: editing.id, updates: payload })
        Swal.fire('Updated!', '', 'success')
      } else {
        await createMapping.mutateAsync(payload)
        Swal.fire('Saved!', '', 'success')
      }
      setShowModal(false)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleDelete = async (record) => {
    const result = await Swal.fire({ title: 'Delete mapping?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, delete' })
    if (!result.isConfirmed) return
    try {
      await deleteMapping.mutateAsync(record.id)
      Swal.fire('Deleted!', '', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const exportCSV = () => {
    const rows = [
      ['Particular', 'Sub Account', 'Account Title'],
      ...filtered.map(row => [row.particular, row.sub_account, row.account_title]),
    ]
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv)
    a.download = `initiative_account_mappings_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const normalizeHeader = (value) =>
    String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')

  const parseCSV = (text) => {
    const rows = []
    let row = []
    let cell = ''
    let inQuotes = false

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i]
      const next = text[i + 1]

      if (char === '"' && inQuotes && next === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        row.push(cell)
        cell = ''
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1
        row.push(cell)
        if (row.some(value => value.trim())) rows.push(row)
        row = []
        cell = ''
      } else {
        cell += char
      }
    }

    row.push(cell)
    if (row.some(value => value.trim())) rows.push(row)
    return rows
  }

  const handleCSVUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (rows.length < 2) return Swal.fire('Invalid CSV', 'CSV must include a header row and at least one data row.', 'warning')

      const headers = rows[0].map(normalizeHeader)
      const findIndex = (...names) => names.map(normalizeHeader).map(name => headers.indexOf(name)).find(index => index >= 0)
      const particularIndex = findIndex('particular')
      const subAccountIndex = findIndex('sub_account', 'sub account')
      const accountTitleIndex = findIndex('account_title', 'account title')

      if ([particularIndex, subAccountIndex, accountTitleIndex].some(index => index === undefined)) {
        return Swal.fire('Missing columns', 'CSV needs columns: particular, sub_account, account_title', 'warning')
      }

      const payload = rows.slice(1)
        .map(row => ({
          particular: String(row[particularIndex] || '').trim(),
          sub_account: String(row[subAccountIndex] || '').trim(),
          account_title: String(row[accountTitleIndex] || '').trim(),
        }))
        .filter(row => row.particular || row.sub_account || row.account_title)

      if (!payload.length) return Swal.fire('No valid rows', 'No mapping rows were found in the CSV.', 'warning')

      await bulkUpsertMappings.mutateAsync(payload)
      Swal.fire('Uploaded!', `${payload.length} mapping row(s) imported.`, 'success')
    } catch (err) {
      Swal.fire('Error', err.message || 'Failed to upload CSV', 'error')
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Data Management</h1>
          <p className="text-sm font-semibold text-gray-500">Manage Initiative Particular, Sub Account, and Account Title mapping</p>
        </div>
        <div className="flex gap-2">
          {canUpload && (
            <>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSVUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-xs px-3 py-2" disabled={bulkUpsertMappings.isPending}>
                <i className="fas fa-upload mr-1 text-blue-600" />Upload CSV
              </button>
            </>
          )}
          <button onClick={exportCSV} className="btn-secondary text-xs px-3 py-2"><i className="fas fa-file-excel mr-1 text-green-600" />Export</button>
          {canUpload && <button onClick={() => openModal()} className="btn-primary text-xs px-3 py-2"><i className="fas fa-plus mr-1" />New Mapping</button>}
        </div>
      </div>

      <div className="card mb-4 p-4">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input className="input pl-9" placeholder="Search mapping..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full min-w-[800px]">
            <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
              <tr>
                <th className="table-th w-12">#</th>
                <th className="table-th">Particular</th>
                <th className="table-th">Sub Account</th>
                <th className="table-th">Account Title</th>
                <th className="table-th text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableLoader /> : filtered.length === 0 ? <EmptyRow cols={5} /> :
                filtered.map((row, index) => (
                  <tr key={row.id} className="table-tr">
                    <td className="table-td text-xs text-gray-400">{index + 1}</td>
                    <td className="table-td font-semibold">{row.particular}</td>
                    <td className="table-td">{row.sub_account}</td>
                    <td className="table-td">{row.account_title}</td>
                    <td className="table-td">
                      <div className="table-actions">
                        {canUpload && <button onClick={() => openModal(row)} className="btn-icon bg-gray-50 text-gray-500 hover:bg-gray-100" title="Edit"><i className="fas fa-pencil-alt" /></button>}
                        {isAdmin && <button onClick={() => handleDelete(row)} className="btn-icon bg-red-50 text-red-500 hover:bg-red-100" title="Delete"><i className="fas fa-trash" /></button>}
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><i className="fas fa-database text-sky-200" />{editing ? 'Edit Mapping' : 'New Mapping'}</h3>
              <p className="modal-subtitle">Initiative account mapping</p>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="label">Particular</label>
                <select className="input" value={form.particular} onChange={e => setForm(prev => ({ ...prev, particular: e.target.value }))}>
                  <option value="">Select Particular</option>
                  {PARTICULAR_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sub Account</label>
                <select className="input" value={form.sub_account} onChange={e => setForm(prev => ({ ...prev, sub_account: e.target.value }))}>
                  <option value="">Select Sub Account</option>
                  {SUB_ACCOUNT_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Account Title</label>
                <input className="input" value={form.account_title} onChange={e => setForm(prev => ({ ...prev, account_title: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} className="btn-primary" disabled={createMapping.isPending || updateMapping.isPending}>{editing ? 'Update' : 'Save Mapping'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
