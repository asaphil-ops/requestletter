import { useState, useEffect } from 'react'
import { useBranchOptions } from '../../hooks/useBranches'

export function OpsModal({ record, onConfirm, onClose }) {
  const [note, setNote] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [branchLookupOpen, setBranchLookupOpen] = useState(false)
  const [branchCode, setBranchCode] = useState('')
  const branchOptions = useBranchOptions()

  // Extract branch code from record beneficiary if it's a branch request format "CODE - NAME"
  const getInitialBranchCode = () => {
    if (!record) return ''
    const beneficiary = record.beneficiary || ''
    const parts = beneficiary.split(' - ')
    if (parts.length >= 2) {
      return parts[0].trim()
    }
    // If not in branch format, maybe it's a staff name; we could try to look up branch code from staff list, but for simplicity return empty.
    return ''
  }

  const getBranchName = (code) => {
    const opt = branchOptions.find(o => o.value === code)
    if (!opt) return ''
    return opt.label.split(' - ').slice(1).join(' - ')
  }

  const handleBranchSelect = (code) => {
    setBranchCode(code)
    setBranchLookupOpen(false)
  }

  // Initialize branchCode from record
  useEffect(() => {
    setBranchCode(getInitialBranchCode())
  }, [record])

  if (!record) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Operations Processing</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500"><i className="fas fa-times" /></button>
        </div>
        <div className="p-6">
          {/* Branch Code Field */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Branch Code</label>
            <div className="relative">
              <input
                className="input text-sm font-semibold uppercase w-full"
                placeholder="Code (e.g. B0001)"
                value={branchCode}
                onFocus={() => setBranchLookupOpen(true)}
                onBlur={() => setTimeout(() => setBranchLookupOpen(false), 200)}
                onChange={e => {
                  const code = e.target.value.toUpperCase().replace(/O/g, '0')
                  setBranchCode(code)
                  setBranchLookupOpen(true)
                }}
              />
              {branchLookupOpen && (
                <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-blue-500 bg-white shadow-xl">
                  {(() => {
                    const needle = String(branchCode).trim().toLowerCase()
                    const matches = (needle
                      ? branchOptions.filter(branch =>
                          `${branch.value} ${branch.label}`.toLowerCase().includes(needle)
                        )
                      : branchOptions
                    ).slice(0, 10)
                    return matches.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">No branch found</div>
                    ) : matches.map(branch => (
                      <button
                        key={branch.value}
                        type="button"
                        className="grid w-full grid-cols-[72px_1fr] gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-blue-50"
                        onMouseDown={event => {
                          event.preventDefault()
                          handleBranchSelect(branch.value)
                          setBranchLookupOpen(false)
                        }}
                      >
                        <span className="font-bold text-blue-700">{branch.value}</span>
                        <span className="text-slate-600 truncate">{branch.label.split(' - ').slice(1).join(' - ')}</span>
                      </button>
                    ))
                  })()}
                </div>
              )}
            </div>
            <input className="mt-2 input text-sm text-rose-700 font-semibold" readOnly value={getBranchName(branchCode)} placeholder="Branch Name" />
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Add Note</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows="3"
              placeholder="Enter your remarks here..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowReject(true)} className="rounded-lg bg-red-50 px-4 py-2 font-semibold text-red-600 hover:bg-red-100">Reject</button>
            <button onClick={() => {
                // Determine action: if note filled -> reject, else approve/check
                const action = note.trim() ? 'OPS_REJECT' : 'OPS_CHECK'
                // Prepare updated record with potential beneficiary change
                let updatedRecord = { ...record }
                if (branchCode) {
                  // If record is a branch request, update beneficiary with selected branch
                  const beneficiary = record.beneficiary || ''
                  const isBranchFormat = beneficiary.includes(' - ')
                  if (isBranchFormat) {
                    updatedRecord.beneficiary = `${branchCode} - ${getBranchName(branchCode)}`
                  }
                  // If not branch format (staff request), we might not want to change beneficiary; keep as is.
                }
                onConfirm(action, { note, record: updatedRecord })
              }}>
              {note.trim() ? 'Confirm Reject' : 'Confirm Check'}
            </button>
          </div>
          {showReject && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="mb-3 text-sm font-medium text-red-800">Are you sure you want to reject this request?</p>
              <div className="flex gap-2">
                <button onClick={() => setShowReject(false)} className="rounded bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm border border-gray-300">Cancel</button>
                <button onClick={() => onConfirm('Rejected', { note })} className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700">Confirm Reject</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function FinanceModal({ record, titles, onConfirm, onClose }) {
  const [note, setNote] = useState('')
  const [showReject, setShowReject] = useState(false)

  if (!record) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Finance Processing</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500"><i className="fas fa-times" /></button>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Add Note</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows="3"
              placeholder="Enter your remarks here..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowReject(true)} className="rounded-lg bg-red-50 px-4 py-2 font-semibold text-red-600 hover:bg-red-100">Reject</button>
            <button onClick={() => onConfirm('Fin Approved', { note })} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow hover:bg-emerald-700">Approve</button>
          </div>
          {showReject && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="mb-3 text-sm font-medium text-red-800">Are you sure you want to reject this request?</p>
              <div className="flex gap-2">
                <button onClick={() => setShowReject(false)} className="rounded bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm border border-gray-300">Cancel</button>
                <button onClick={() => onConfirm('Rejected', { note })} className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700">Confirm Reject</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}