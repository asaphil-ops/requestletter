import { STATUS_COLORS } from '../../lib/utils'

const STATUS_ICONS = {
  Pending: 'fa-clock',
  Checked: 'fa-paper-plane',
  'Forwarded to OPS Planning': 'fa-paper-plane',
  Approved: 'fa-check-circle',
  Rejected: 'fa-circle-xmark',
  'Recommended Ops Fin': 'fa-paper-plane',
  'Pending For Recommendation of OPs Finance': 'fa-clock',
}

export default function StatusBadge({ status, remarks, emailSent, emailSentAt, fileId }) {
  const cls = STATUS_COLORS[status] || 'badge-pending'
  const icon = STATUS_ICONS[status] || 'fa-circle'
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <span className={`badge ${cls} inline-flex items-center gap-1.5`}>
        <i className={`fas ${icon} text-[10px]`} />
        {status}
      </span>
      <span
        className={`badge border text-xs inline-flex items-center gap-1.5 ${fileId ? 'bg-cyan-50 text-cyan-600 border-cyan-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
        title={fileId ? 'Attachment available' : 'No attachment uploaded'}
      >
        <i className={`fas ${fileId ? 'fa-paperclip' : 'fa-file-circle-xmark'} text-[10px]`} />
        {fileId ? 'Attached' : 'No File'}
      </span>
      {emailSent && (
        <span
          className="badge inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100"
          title={emailSentAt ? `Email sent: ${new Date(emailSentAt).toLocaleString('en-PH')}` : 'Email sent'}
        >
          <i className="fas fa-check-circle text-[10px]" />Sent
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
