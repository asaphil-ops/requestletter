import { useState } from 'react'
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '../hooks/useAccounts'
import { ROLES, ROWS_PER_PAGE } from '../lib/utils'
import Pagination from '../components/shared/Pagination'
import { TableLoader, EmptyRow } from '../components/shared/Loader'
import Swal from 'sweetalert2'

export default function Users() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const { data: accounts = [], isLoading } = useAccounts()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()

  const EMPTY_FORM = { username: '', password: '', role: 'Staff', full_name: '', email: '' }
  const [form, setForm] = useState(EMPTY_FORM)

  const filtered = accounts.filter(a =>
    (a.full_name + a.username + a.email).toLowerCase().includes(search.toLowerCase())
  )
  const paged = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const openModal = (rec = null) => {
    setEditing(rec)
    setForm(rec ? { username: rec.username, password: '', role: rec.role, full_name: rec.full_name, email: rec.email || '' } : EMPTY_FORM)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.full_name || !form.username) return Swal.fire('Error', 'Name and username are required', 'error')
    if (!editing && !form.password) return Swal.fire('Error', 'Password is required for new accounts', 'error')
    try {
      if (editing) {
        const updates = { role: form.role, full_name: form.full_name, email: form.email }
        if (form.password) updates.password = form.password
        await updateAccount.mutateAsync({ username: editing.username, updates })
        Swal.fire('Updated!', '', 'success')
      } else {
        // Check if username exists
        const exists = accounts.find(a => a.username.toLowerCase() === form.username.toLowerCase())
        if (exists) return Swal.fire('Error', 'Username already taken', 'error')
        await createAccount.mutateAsync({ username: form.username, password: form.password, role: form.role, full_name: form.full_name, email: form.email })
        Swal.fire('Created!', 'Account added.', 'success')
      }
      setShowModal(false)
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleDelete = (a) => {
    Swal.fire({ title: `Delete ${a.full_name}?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes' })
      .then(r => { if (r.isConfirmed) deleteAccount.mutateAsync(a.username).then(() => Swal.fire('Deleted!', '', 'success')).catch(e => Swal.fire('Error', e.message, 'error')) })
  }

  const roleBadge = (role) => {
    const colors = {
      'Super Admin': 'bg-red-100 text-red-700',
      'Admin': 'bg-orange-100 text-orange-700',
      'Finance': 'bg-emerald-100 text-emerald-700',
      'Ops Finance': 'bg-blue-100 text-blue-700',
      'Planning': 'bg-purple-100 text-purple-700',
      'Governance': 'bg-cyan-100 text-cyan-700',
      'Staff': 'bg-gray-100 text-gray-600',
    }
    return <span className={`badge text-xs ${colors[role] || 'bg-gray-100 text-gray-600'}`}>{role}</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">User Accounts</h1>
          <p className="text-sm font-semibold text-gray-500">Manage system access and roles</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary text-xs px-3 py-2">
          <i className="fas fa-plus mr-1" />Add User
        </button>
      </div>

      <div className="card p-3 mb-4">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input className="input pl-9 text-sm" placeholder="Search accounts..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full min-w-[600px]">
            <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
              <tr>
                <th className="table-th">#</th>
                <th className="table-th">Name</th>
                <th className="table-th">Username</th>
                <th className="table-th">Role</th>
                <th className="table-th">Email</th>
                <th className="table-th text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableLoader /> : paged.length === 0 ? <EmptyRow cols={6} /> :
                paged.map((a, idx) => (
                  <tr key={a.username} className="table-tr">
                    <td className="table-td text-gray-400 text-xs">{(page - 1) * ROWS_PER_PAGE + idx + 1}</td>
                    <td className="table-td font-semibold">{a.full_name}</td>
                    <td className="table-td text-sm text-gray-500">{a.username}</td>
                    <td className="table-td">{roleBadge(a.role)}</td>
                    <td className="table-td text-sm text-gray-500">{a.email || '-'}</td>
                    <td className="table-td text-right">
                      <div className="table-actions">
                        <button onClick={() => openModal(a)} className="btn-icon bg-blue-50 text-blue-600 hover:bg-blue-100" title="Edit"><i className="fas fa-edit text-xs" /></button>
                        <button onClick={() => handleDelete(a)} className="btn-icon bg-red-50 text-red-500 hover:bg-red-100" title="Delete"><i className="fas fa-trash text-xs" /></button>
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
          <div className="modal-panel max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><i className="fas fa-user-shield text-sky-200" />{editing ? 'Edit Account' : 'New Account'}</h3>
              <p className="modal-subtitle">Manage access and role assignment</p>
            </div>
            <div className="modal-body space-y-3">
              <div><label className="label">Full Name *</label><input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Username *</label>
                  <input className="input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editing} />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div>
                <label className="label">Password {editing && <span className="text-gray-400 font-normal normal-case">(leave blank to keep)</span>}</label>
                <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editing ? 'Leave blank to keep password' : 'New password'} />
              </div>
              <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={createAccount.isPending || updateAccount.isPending} className="btn-primary">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
