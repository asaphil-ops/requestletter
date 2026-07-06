const toneClass = {
  cyan: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100 dark:bg-cyan-400/10 dark:text-cyan-200',
  slate: 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300',
  blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-sky-400/10 dark:text-sky-200',
  emerald: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200',
  amber: 'bg-amber-50 text-amber-500 hover:bg-amber-100 dark:bg-amber-400/10 dark:text-amber-200',
  gray: 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300',
  red: 'bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-400/10 dark:text-red-200',
  orange: 'bg-orange-50 text-orange-500 hover:bg-orange-100 dark:bg-orange-400/10 dark:text-orange-200',
}

function ActionButton({ action, compact = false }) {
  const tone = toneClass[action.tone] || toneClass.gray
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.title || action.label}
      className={`${compact ? 'action-menu-item' : 'btn-icon'} ${tone} ${action.disabled ? 'cursor-not-allowed opacity-45 hover:bg-gray-50 dark:hover:bg-slate-800' : ''}`}
    >
      <i className={`fas ${action.icon}`} />
      {compact && <span>{action.label}</span>}
    </button>
  )
}

export default function ActionMenu({ actions = [] }) {
  const visibleActions = actions.filter(Boolean)
  const primary = visibleActions[0]
  const rest = visibleActions.slice(1)

  if (!primary) return null

  return (
    <div className="action-menu">
      <ActionButton action={primary} />
      {rest.length > 0 && (
        <details className="action-menu-more">
          <summary className="btn-icon bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700" title="More actions">
            <i className="fas fa-ellipsis-h" />
          </summary>
          <div className="action-menu-panel">
            {rest.map((action, index) => (
              <ActionButton key={`${action.label}-${index}`} action={action} compact />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
