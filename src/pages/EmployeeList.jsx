import { useMemo, useRef, useState } from 'react'
import {
  useBulkUpsertEmployees,
  useCreateEmployee,
  useDeleteEmployee,
  useEmployeeList,
  useUpdateEmployee,
} from '../hooks/useEmployeeList'
import { useAuthStore } from '../store/authStore'
import { parseCSV, normalizeCSVHeader } from '../lib/csv'
import { EmptyRow, TableLoader } from '../components/shared/Loader'
import Pagination from '../components/shared/Pagination'
import { ROWS_PER_PAGE } from '../lib/utils'
import Swal from 'sweetalert2'

const EMPTY_FORM = { id_number: '', full_name: '', designation: '', contact_number: '', email_address: '' }

export default function EmployeeList() {
  const { isAdmin, canUpload } = useAuthStore()
  const { data = [], isLoading } = useEmployeeList()
  const createEmployee = useCreateEmployee()
  const bulkUpsertEmployees = useBulkUpsertEmployees()
  const updateEmployee = useUpdateEmployee()
  const deleteEmployee = useDeleteEmployee()
  const fileInputRef = useRef(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const filtered = useMemo(() => {
    const needle = search.toLowerCase()
    if (!needle) return data
    return data.filter(row =>
      `${row.id_number} ${row.full_name} ${row.designation} ${row.contact_number} ${row.email_address}`
        .toLowerCase()
        .includes(needle)
    )
  }, [data, search])

  const padID = (val) => String(val || '').trim().padStart(5, '0')

  const openModal = (record = null) => {
    setEditing(record)
    setForm(record ? {
      id_number: padID(record.id_number),
      full_name: record.full_name || '',
      designation: record.designation || '',
      contact_number: record.contact_number || '',
      email_address: record.email_address || '',
    } : EMPTY_FORM)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.id_number.trim() || !form.full_name.trim()) {
      return Swal.fire('Missing field', 'ID Number and Full Name are required.', 'warning')
    }

    const payload = {
      id_number: padID(form.id_number),
      full_name: form.full_name.trim(),
      designation: form.designation.trim(),
      contact_number: form.contact_number.trim(),
      email_address: form.email_address.trim(),
    }

    try {
      if (editing) {
        await updateEmployee.mutateAsync({ id: editing.id, updates: payload })
        Swal.fire('Updated!', '', 'success')
      } else {
        await createEmployee.mutateAsync(payload)
        Swal.fire('Saved!', '', 'success')
      }
      setShowModal(false)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleDelete = async (record) => {
    const result = await Swal.fire({ title: 'Delete employee?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, delete' })
    if (!result.isConfirmed) return
    try {
      await deleteEmployee.mutateAsync(record.id)
      Swal.fire('Deleted!', '', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleCSVUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const rows = parseCSV(await file.text())
      if (rows.length < 2) return Swal.fire('Invalid CSV', 'CSV must include a header row and at least one data row.', 'warning')

      const headers = rows[0].map(normalizeCSVHeader)
      const findIndex = (...names) => names.map(normalizeCSVHeader).map(name => headers.indexOf(name)).find(index => index >= 0)
      const idIndex = findIndex('id_number', 'id no', 'id')
      const nameIndex = findIndex('full_name', 'name', 'employee_name')
      const designationIndex = findIndex('designation', 'position')
      const contactIndex = findIndex('contact_number', 'contact no', 'contact')
      const emailIndex = findIndex('email_address', 'email')

      if (idIndex === undefined || nameIndex === undefined) {
        return Swal.fire('Missing columns', 'CSV needs at least id_number and full_name columns.', 'warning')
      }

      const payload = rows.slice(1)
        .map(row => ({
          id_number: padID(String(row[idIndex] || '').trim()),
          full_name: String(row[nameIndex] || '').trim(),
          designation: designationIndex === undefined ? '' : String(row[designationIndex] || '').trim(),
          contact_number: contactIndex === undefined ? '' : String(row[contactIndex] || '').trim(),
          email_address: emailIndex === undefined ? '' : String(row[emailIndex] || '').trim(),
        }))
        .filter(row => row.id_number && row.full_name)

      if (!payload.length) return Swal.fire('No valid rows', 'No employees with ID Number and Full Name were found.', 'warning')

      await bulkUpsertEmployees.mutateAsync(payload)
      Swal.fire('Uploaded!', `${payload.length} employee row(s) imported.`, 'success')
    } catch (err) {
      Swal.fire('Error', err.message || 'Failed to upload CSV', 'error')
    }
  }

  const exportCSV = () => {
    const rows = [
      ['ID Number', 'Full Name', 'Designation', 'Contact Number', 'Email Address'],
      ...filtered.map(row => [row.id_number, row.full_name, row.designation, row.contact_number, row.email_address]),
    ]
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv)
    a.download = `employee_list_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const paged = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const scrollToBottom = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })

  return (
    <div>
      {/* Scroll buttons */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
        <button
          onClick={scrollToTop}
          className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all"
          title="Scroll to top"
        >
          <i className="fas fa-chevron-up text-xs" />
        </button>
        <button
          onClick={scrollToBottom}
          className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all"
          title="Scroll to bottom"
        >
          <i className="fas fa-chevron-down text-xs" />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Employee List</h1>
          <p className="text-sm font-semibold text-gray-500">Manage employee reference data for cost center forms</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpload && (
            <>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSVUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-xs px-3 py-2" disabled={bulkUpsertEmployees.isPending}>
                <i className="fas fa-upload mr-1 text-blue-600" />Upload CSV
              </button>
            </>
          )}
          <button onClick={exportCSV} className="btn-secondary text-xs px-3 py-2"><i className="fas fa-file-excel mr-1 text-green-600" />Export</button>
          {canUpload && <button onClick={() => openModal()} className="btn-primary text-xs px-3 py-2"><i className="fas fa-plus mr-1" />New Employee</button>}
        </div>
      </div>

      <div className="card mb-4 p-4">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input className="input pl-9" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full min-w-[800px]">
            <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
              <tr>
                <th className="table-th w-8 text-center">#</th>
                <th className="table-th w-[90px]">ID Number</th>
                <th className="table-th">Full Name</th>
                <th className="table-th w-[150px]">Designation</th>
                <th className="table-th w-[120px]">Contact</th>
                <th className="table-th">Email Address</th>
                <th className="table-th text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableLoader /> : filtered.length === 0 ? <EmptyRow cols={7} /> :
                paged.map((row, index) => (
                  <tr key={row.id} className="table-tr">
                    <td className="table-td text-xs text-gray-400 text-center">{(page - 1) * ROWS_PER_PAGE + index + 1}</td>
                    <td className="table-td font-semibold text-xs tracking-wider">{padID(row.id_number)}</td>
                    <td className="table-td text-sm whitespace-nowrap">{row.full_name}</td>
                    <td className="table-td text-sm text-gray-600 dark:text-gray-400 truncate max-w-[150px]">{row.designation || '-'}</td>
                    <td className="table-td text-xs">{row.contact_number || '-'}</td>
                    <td className="table-td text-xs text-gray-500 truncate max-w-[180px]">{row.email_address || '-'}</td>
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
        <Pagination page={page} total={filtered.length} onChange={setPage} />
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><i className="fas fa-id-card text-sky-200" />{editing ? 'Edit Employee' : 'New Employee'}</h3>
              <p className="modal-subtitle">Employee reference details</p>
            </div>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="label text-[10px] font-semibold uppercase tracking-wider text-gray-500">ID Number <span className="text-red-500">*</span></label>
                  <input className="input py-1.5 text-sm" value={form.id_number} onChange={e => setForm(prev => ({ ...prev, id_number: e.target.value }))} placeholder="e.g. 00070" />
                </div>
                <div>
                  <label className="label text-[10px] font-semibold uppercase tracking-wider text-gray-500">Full Name <span className="text-red-500">*</span></label>
                  <input className="input py-1.5 text-sm" value={form.full_name} onChange={e => setForm(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label className="label text-[10px] font-semibold uppercase tracking-wider text-gray-500">Designation</label>
                  <input className="input py-1.5 text-sm" value={form.designation} onChange={e => setForm(prev => ({ ...prev, designation: e.target.value }))} placeholder="Position" />
                </div>
                <div>
                  <label className="label text-[10px] font-semibold uppercase tracking-wider text-gray-500">Contact</label>
                  <input className="input py-1.5 text-sm" value={form.contact_number} onChange={e => setForm(prev => ({ ...prev, contact_number: e.target.value }))} placeholder="Contact number" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label text-[10px] font-semibold uppercase tracking-wider text-gray-500">Email</label>
                  <input className="input py-1.5 text-sm" value={form.email_address} onChange={e => setForm(prev => ({ ...prev, email_address: e.target.value }))} placeholder="email@asaphil.org" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowModal(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                <button onClick={handleSave} className="btn-primary text-xs px-3 py-1.5" disabled={createEmployee.isPending || updateEmployee.isPending}>{editing ? 'Update' : 'Save Employee'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
