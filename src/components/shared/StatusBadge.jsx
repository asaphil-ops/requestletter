import { STATUS_COLORS } from '../../lib/utils'

export default function StatusBadge({ status, remarks }) {
  const cls = STATUS_COLORS[status] || 'badge-pending'
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`badge ${cls}`}>{status}</span>
      {status === 'Rejected' && remarks && (
        <span title={remarks} className="text-red-400 cursor-pointer text-xs">
          <i className="fas fa-info-circle" />
        </span>
      )}
    </span>
  )
}
