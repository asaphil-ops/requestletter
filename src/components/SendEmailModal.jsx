import { useNavigate } from 'react-router-dom'
import SendEmail from '../pages/SendEmail'

export default function SendEmailModal({ draft, onClose }) {
  const navigate = useNavigate()

  const handleClose = () => {
    if (onClose) onClose()
    else navigate(-1)
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal-panel-modern flex max-h-[75vh] max-w-[980px] flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modern Sticky Header */}
        <div className="modal-header-modern-sticky flex items-start justify-between gap-6 px-8 py-6 sticky top-0 z-10">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600">
                <i className="fas fa-paper-plane text-white text-sm" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Send to Email</h3>
            </div>
            <p className="text-sm text-gray-500">Compose and send the approved request attachment</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-all duration-200 hover:bg-gray-200 hover:text-gray-700"
            aria-label="Close"
            title="Close"
          >
            <i className="fas fa-times text-base" />
          </button>
        </div>

        {/* Animated Divider */}
        <div className="h-px bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 sticky top-[88px] z-9" />

        {/* Scrollable Content */}
        <div className="email-modal-body-modern-scroll min-h-0 flex-1 overflow-y-auto bg-white">
          <SendEmail draft={draft} onClose={handleClose} embedded />
        </div>
      </div>
    </div>
  )
}
