import { STATUS_COLORS } from '../../lib/utils'

export default function StatusBadge({ status, remarks, emailSent, emailSentAt }) {
  const cls = STATUS_COLORS[status] || 'badge-pending'
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`badge ${cls}`}>{status}</span>
      {emailSent && (
        <span
          className="badge bg-purple-50 text-purple-600 border border-purple-100"
          title={emailSentAt ? `Email sent: ${new Date(emailSentAt).toLocaleString('en-PH')}` : 'Email sent'}
        >
          Sent
        </span>
      )}
      {status === 'Rejected' && remarks && (
        <span title={remarks} className="text-red-400 cursor-pointer text-xs">
          <i className="fas fa-info-circle" />
        </span>
      )}
    </span>
  )
}
