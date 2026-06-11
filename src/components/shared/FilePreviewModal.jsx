import { getDriveDownloadUrl, getDrivePreviewUrl } from '../../lib/utils'

export default function FilePreviewModal({ fileId, onClose }) {
  if (!fileId) return null
  const previewUrl = getDrivePreviewUrl(fileId)
  const downloadUrl = getDriveDownloadUrl(fileId)

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f1923] border border-white/10 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#132230]">
          <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
            <i className="fas fa-file-alt text-sky-400" /> File Preview
          </h3>
          <div className="flex items-center gap-2">
            <a href={downloadUrl} className="btn-primary text-xs px-3 py-1.5">
              <i className="fas fa-download mr-1" /> Download
            </a>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/15 transition-all cursor-pointer">
              <i className="fas fa-times text-sm text-slate-300" />
            </button>
          </div>
        </div>
        <iframe src={previewUrl} className="flex-1 w-full border-0 bg-slate-950" title="File Preview" />
      </div>
    </div>
  )
}
