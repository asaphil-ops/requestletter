export const fmtNum = (n) => n ? Number(n).toLocaleString('en-PH') : '0'
export const fmtCurrency = (n) => '₱' + fmtNum(n)
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

export const toTitleCase = (str) =>
  str ? str.toString().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : ''

export const normalizeID = (id) =>
  String(id || '').replace(/\s+/g, '').toUpperCase().trim()

export const getTime = () =>
  new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export const getInfoTimestamp = (html) => {
  if (!html) return null
  const text = String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const match = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4},?\s+\d{1,2}:\d{2}\s*(?:AM|PM)\b/i)
  if (!match) return null
  const date = new Date(match[0].replace(/,\s+(\d{1,2}:\d{2})/, ' $1'))
  return Number.isNaN(date.getTime()) ? null : date
}

export const getUploadedAt = (record = {}) => {
  const infoDate = getInfoTimestamp(record.uploader_info)
  if (infoDate) return infoDate
  if (!record.created_at) return null
  const created = new Date(record.created_at)
  return Number.isNaN(created.getTime()) ? null : created
}

export const formatBytes = (bytes) => {
  if (!bytes) return '0B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const getFileIcon = (filename = '') => {
  const ext = filename.split('.').pop().toLowerCase()
  const map = {
    pdf: { icon: 'fa-file-pdf', cls: 'text-red-500 bg-red-50' },
    doc: { icon: 'fa-file-word', cls: 'text-blue-500 bg-blue-50' },
    docx: { icon: 'fa-file-word', cls: 'text-blue-500 bg-blue-50' },
    xls: { icon: 'fa-file-excel', cls: 'text-green-500 bg-green-50' },
    xlsx: { icon: 'fa-file-excel', cls: 'text-green-500 bg-green-50' },
    png: { icon: 'fa-file-image', cls: 'text-emerald-500 bg-emerald-50' },
    jpg: { icon: 'fa-file-image', cls: 'text-emerald-500 bg-emerald-50' },
    jpeg: { icon: 'fa-file-image', cls: 'text-emerald-500 bg-emerald-50' },
    ppt: { icon: 'fa-file-powerpoint', cls: 'text-orange-500 bg-orange-50' },
    pptx: { icon: 'fa-file-powerpoint', cls: 'text-orange-500 bg-orange-50' },
    zip: { icon: 'fa-file-archive', cls: 'text-purple-500 bg-purple-50' },
  }
  return map[ext] || { icon: 'fa-file', cls: 'text-gray-500 bg-gray-50' }
}

export const getDrivePreviewUrl = (fileId) =>
  fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null

export const getDriveViewUrl = (fileId) =>
  fileId ? `https://drive.google.com/file/d/${fileId}/view?usp=sharing` : null

export const getDriveDownloadUrl = (fileId) =>
  fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : null

export const SUGGESTED_EMAILS = [
  'jinnette.anacio@asaphil.org',
  'cynthia.casido@asaphil.org',
  'jonnie.borgonia@asaphil.org',
  'sharon.galeno@asaphil.org',
  'taib.abduraji@asaphil.org',
  'arlyn.yagaya@asaphil.org',
]

export const AUTO_CC_RULES = {
  'sharon.galeno@asaphil.org': ['ramonelle.atchero@asaphil.org'],
}

export const IT_BUDGETS = { CCTV: 13000000, Printer: 9000000, Monitor: 8000000 }
export const AT_BUDGETS = { Aircon: 5000000, Toilet: 3000000 }

export const ROLES = ['Staff', 'Governance', 'Ops Finance', 'Finance', 'Planning', 'Admin', 'Super Admin']
export const ADMIN_ROLES = ['Admin', 'Super Admin']
export const CAN_UPLOAD_ROLES = ['Planning', 'Governance', 'Admin', 'Super Admin']

export const STATUS_COLORS = {
  Pending: 'badge-pending',
  Checked: 'badge-checked',
  'Recommended Ops Fin': 'badge-checked',
  'Pending For Recommendation of OPs Finance': 'badge-checked',
  Rejected: 'badge-rejected',
}

export const STATUS_LABELS = {
  Pending: 'Pending For Recommendation of OPs Finance',
  Checked: 'Already sent to Group Head',
  'Recommended Ops Fin': 'Already sent to Group Head',
  'Pending For Recommendation of OPs Finance': 'Pending For Recommendation of OPs Finance',
  Rejected: 'Rejected',
}

export const getStatusLabel = (status) => STATUS_LABELS[status] || status

export const ROWS_PER_PAGE = 50
