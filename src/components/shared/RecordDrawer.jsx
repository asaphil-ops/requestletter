import { escapeHtml } from '../../lib/utils'

function textFromHtml(value) {
  if (!value) return ''
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function RecordDrawer({ title = 'Record Details', subtitle = '', record, fields = [], onClose }) {
  if (!record) return null

  const rows = fields.length
    ? fields
    : Object.keys(record).slice(0, 16).map(key => ({ key, label: key.replace(/_/g, ' ') }))

  return (
    <div className="fixed inset-0 z-[1400] bg-slate-950/30 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-xl flex-col bg-white text-slate-900 shadow-2xl dark:bg-slate-950 dark:text-slate-100"
        onClick={event => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{title}</h2>
              {subtitle && <p className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
            <button className="btn-icon bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300" onClick={onClose} title="Close">
              <i className="fas fa-times" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <dl className="grid gap-3">
            {rows.map(({ key, label, render }) => {
              const raw = record[key]
              const value = render ? render(record) : textFromHtml(raw)
              return (
                <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-100" dangerouslySetInnerHTML={{ __html: escapeHtml(value || '-') }} />
                </div>
              )
            })}
          </dl>
        </div>
      </aside>
    </div>
  )
}
