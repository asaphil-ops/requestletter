export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  badge,
  actions,
  className = '',
}) {
  return (
    <header className={`page-header ${className}`}>
      <div className="flex min-w-0 items-center gap-3.5">
        {icon && (
          <div className="page-header-icon" aria-hidden="true">
            <i className={`fas ${icon}`} />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="page-title">{title}</h1>
            {badge !== undefined && badge !== null && (
              <span className="page-header-badge">{badge}</span>
            )}
          </div>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
