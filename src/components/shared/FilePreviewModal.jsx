import { useEffect, useMemo, useState } from 'react'
import { getFileContent } from '../../lib/gas'
import { getDriveDownloadUrl, getDriveFileIdFromUrl, getDriveThumbnailUrl, getDriveViewUrl } from '../../lib/utils'

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
}

export default function FilePreviewModal({ fileId, onClose, showOpenButton = true }) {
  const [file, setFile] = useState(null)
  const [blobUrl, setBlobUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [legacyFallback, setLegacyFallback] = useState(false)

  const cleanFileId = getDriveFileIdFromUrl(fileId) || String(fileId || '').trim()
  const driveViewUrl = getDriveViewUrl(cleanFileId)
  const driveDownloadUrl = getDriveDownloadUrl(cleanFileId)
  const thumbnailUrl = getDriveThumbnailUrl(cleanFileId)
  const canInlinePreview = file?.mimeType === 'application/pdf' || file?.mimeType?.startsWith('image/')
  const downloadName = file?.name || 'attachment'

  useEffect(() => {
    let active = true
    let objectUrl = ''

    async function loadFile() {
      if (!cleanFileId) return
      setLoading(true)
      setError('')
      setFile(null)
      setBlobUrl('')
      setLegacyFallback(false)

      try {
        const data = await getFileContent(cleanFileId)
        const blob = base64ToBlob(data.base64, data.mimeType)
        objectUrl = URL.createObjectURL(blob)

        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }

        setFile(data)
        setBlobUrl(objectUrl)
      } catch (err) {
        if (!active) return
        const message = err.message || 'Unable to load attachment preview.'
        if (
          message.includes('Unknown action: GET_FILE_CONTENT') ||
          message.includes('Unknown action') ||
          message.includes('not found') ||
          message.includes('File not found')
        ) {
          setLegacyFallback(true)
          return
        }
        setError(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadFile()

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [cleanFileId])

  const localDownloadUrl = useMemo(() => blobUrl || driveDownloadUrl, [blobUrl, driveDownloadUrl])

  if (!cleanFileId) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1923] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-[#132230] px-5 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <i className="fas fa-file-alt text-sky-400" /> File Preview
            </h3>
            {file?.name && <p className="mt-0.5 max-w-[42rem] truncate text-xs text-slate-400">{file.name}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showOpenButton && (
              <a href={driveViewUrl} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs">
                <i className="fas fa-up-right-from-square mr-1" /> Open File
              </a>
            )}
            <a href={localDownloadUrl} download={downloadName} target="_blank" rel="noreferrer" className="btn-primary px-3 py-1.5 text-xs">
              <i className="fas fa-download mr-1" /> Download
            </a>
            <button onClick={onClose} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white/5 transition-all hover:bg-white/15">
              <i className="fas fa-times text-sm text-slate-300" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden bg-[#151515]">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-sm font-semibold text-slate-300">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
              Loading attachment...
            </div>
          ) : legacyFallback ? (
            <div className="flex h-full w-full flex-col bg-[#151515]">
              <div className="flex flex-1 items-center justify-center overflow-auto p-4">
                <img
                  src={thumbnailUrl}
                  alt="Attachment preview"
                  className="max-h-full max-w-full object-contain"
                  onError={() => setError('Preview requires the updated Google Apps Script deployment.')}
                />
              </div>
              <div className="border-t border-white/10 bg-[#101a24] px-5 py-2 text-xs text-slate-400">
                Limited preview mode. Redeploy the updated Apps Script to enable full PDF/image preview.
              </div>
            </div>
          ) : error ? (
            <div className="mx-4 max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
              <div className="text-base font-bold text-red-100">Unable to load attachment</div>
              <p className="mt-2 text-sm text-red-200">{error}</p>
              {showOpenButton && (
                <a href={driveViewUrl} target="_blank" rel="noreferrer" className="btn-primary mt-4 inline-flex px-4 py-2 text-xs">
                  <i className="fas fa-up-right-from-square mr-1" /> Open File
                </a>
              )}
            </div>
          ) : canInlinePreview && file.mimeType === 'application/pdf' ? (
            <iframe src={blobUrl} className="h-full w-full border-0 bg-slate-950" title={file.name || 'File Preview'} />
          ) : canInlinePreview ? (
            <img src={blobUrl} alt={file.name || 'Attachment preview'} className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="mx-4 max-w-lg rounded-xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-sky-300">
                <i className="fas fa-file text-lg" />
              </div>
              <div className="mt-4 text-base font-bold text-slate-100">Preview not available for this file type</div>
              <p className="mt-2 text-sm text-slate-400">Use Open File or Download to view the attachment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
