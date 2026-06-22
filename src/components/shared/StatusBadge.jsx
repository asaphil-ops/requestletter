import { STATUS_COLORS } from '../../lib/utils'

export default function StatusBadge({ status, remarks, emailSent, emailSentAt, fileId }) {
  const cls = STATUS_COLORS[status] || 'badge-pending'
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`badge ${cls}`}>{status}</span>
      <span
        className={`badge border text-xs ${fileId ? 'bg-cyan-50 text-cyan-600 border-cyan-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
        title={fileId ? 'Attachment available' : 'No attachment uploaded'}
      >
        {fileId ? <><i className="fas fa-paperclip mr-1" />Attached</> : 'No File'}
      </span>
      {emailSent && (
        <span
          className="badge bg-emerald-50 text-emerald-600 border border-emerald-100"
          title={emailSentAt ? `Email sent: ${new Date(emailSentAt).toLocaleString('en-PH')}` : 'Email sent'}
        >
          <i className="fas fa-check-circle mr-1" />Sent
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
