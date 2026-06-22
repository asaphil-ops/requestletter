import { useState } from 'react'

export function OpsModal({ record, onConfirm, onClose }) {
  const [note, setNote] = useState('')
  const [showReject, setShowReject] = useState(false)

  if (!record) return null

  const title =
    record.title ||
    record.item_name ||
    record.particular ||
    record.account_title ||
    record.type ||
    'Pending entry'
  const reference = record.req_id || record.uniq_id || record.id || '-'
  const owner =
    record.beneficiary ||
    record.branch_name ||
    record.staff_name ||
    record.giver ||
    record.cost_center ||
    ''

  const handleCheck = () => {
    onConfirm('OPS_CHECK', { note })
  }

  const handleReject = () => {
    if (!note.trim()) return
    onConfirm('OPS_REJECT', { note })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">OPs Finance Review</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Check pending entry</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Close"
          >
            <i className="fas fa-times text-sm" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-blue-600 text-white">
                <i className="fas fa-file-circle-check text-sm" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-900" title={String(title)}>
                  {title}
                </div>
                {owner && (
                  <div className="mt-0.5 truncate text-xs font-medium text-slate-500" title={String(owner)}>
                    {owner}
                  </div>
                )}
                <div className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
                  Ref: {reference}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Remarks {showReject && <span className="text-red-500">*</span>}
            </label>
            <textarea
              className="min-h-[92px] w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              rows="3"
              placeholder={showReject ? 'Required reason for rejection...' : 'Optional remarks before checking...'}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {showReject && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              This will mark the entry as rejected. Add a reason above before confirming.
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={() => {
                setShowReject(true)
                setNote('')
              }}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
            >
              Reject
            </button>
            {showReject ? (
              <button
                onClick={handleReject}
                disabled={!note.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm Reject
              </button>
            ) : (
              <button
                onClick={handleCheck}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-500"
              >
                Confirm Check
              </button>
            )}
            {showReject && (
              <button
                onClick={() => setShowReject(false)}
                className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                Cancel
              </button>
            )}
          </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Finance Review</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Approve checked entry</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Close"
          >
            <i className="fas fa-times text-sm" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Remarks {showReject && <span className="text-red-500">*</span>}
            </label>
            <textarea
              className="min-h-[92px] w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              rows="3"
              placeholder={showReject ? 'Required reason for rejection...' : 'Optional remarks before approval...'}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {showReject && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              This will mark the entry as rejected. Add a reason above before confirming.
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={() => {
                setShowReject(true)
                setNote('')
              }}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
            >
              Reject
            </button>
            {showReject ? (
              <button
                onClick={() => note.trim() && onConfirm('FINANCE_REJECT', { note })}
                disabled={!note.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm Reject
              </button>
            ) : (
              <button
                onClick={() => onConfirm('FINANCE_APPROVE', { note })}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500"
              >
                Approve
              </button>
            )}
            {showReject && (
              <button
                onClick={() => setShowReject(false)}
                className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
