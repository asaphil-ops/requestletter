import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getInfoTimestamp, fmtDate } from '../../lib/utils'
import { getWorkflowId } from '../../lib/workflow'
import FilePreviewModal from './FilePreviewModal'

const stripHtml = (value = '') =>
  String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function parseAudit(details) {
  try {
    return JSON.parse(details)
  } catch {
    return null
  }
}

const getDriveFileIdFromLink = (link) => {
  const value = String(link || '').trim()
  if (!value || value === '__MODULE_DOLE__') return ''
  const filePathMatch = value.match(/\/file\/d\/([^/]+)/)
  if (filePathMatch?.[1]) return filePathMatch[1]
  const idMatch = value.match(/[?&]id=([^&]+)/)
  if (idMatch?.[1]) return idMatch[1]
  return value
}

const formatRelativeTime = (date) => {
  if (!date || Number.isNaN(date.getTime?.())) return ''
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return ''
}

const ACTION_META = {
  CREATE_COMPLIANCE_CERTIFICATE: {
    label: 'Record Created',
    icon: 'fa-plus-circle',
    nodeBg: 'bg-emerald-500 text-white ring-emerald-100 dark:ring-emerald-950/60',
    badgeTone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  CREATE_COR_CERTIFICATE: {
    label: 'COR Record Created',
    icon: 'fa-certificate',
    nodeBg: 'bg-emerald-500 text-white ring-emerald-100 dark:ring-emerald-950/60',
    badgeTone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  CREATE_DOLE_CERTIFICATE: {
    label: 'DOLE Record Created',
    icon: 'fa-building-shield',
    nodeBg: 'bg-sky-500 text-white ring-sky-100 dark:ring-sky-950/60',
    badgeTone: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  },
  UPDATE_COMPLIANCE_CERTIFICATE: {
    label: 'Record Updated',
    icon: 'fa-pen-to-square',
    nodeBg: 'bg-blue-600 text-white ring-blue-100 dark:ring-blue-950/60',
    badgeTone: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  },
  UPDATE_COR_CERTIFICATE: {
    label: 'COR Details Updated',
    icon: 'fa-pen-to-square',
    nodeBg: 'bg-blue-600 text-white ring-blue-100 dark:ring-blue-950/60',
    badgeTone: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  },
  UPDATE_DOLE_CERTIFICATE: {
    label: 'DOLE Details Updated',
    icon: 'fa-pen-to-square',
    nodeBg: 'bg-indigo-600 text-white ring-indigo-100 dark:ring-indigo-950/60',
    badgeTone: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  UPLOAD_COR_CERTIFICATE: {
    label: 'COR File Uploaded',
    icon: 'fa-file-arrow-up',
    nodeBg: 'bg-teal-600 text-white ring-teal-100 dark:ring-teal-950/60',
    badgeTone: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  },
  UPLOAD_DOLE_CERTIFICATE: {
    label: 'DOLE File Uploaded',
    icon: 'fa-cloud-arrow-up',
    nodeBg: 'bg-sky-600 text-white ring-sky-100 dark:ring-sky-950/60',
    badgeTone: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  },
  DELETE_COMPLIANCE_CERTIFICATE: {
    label: 'Record Deleted',
    icon: 'fa-trash-can',
    nodeBg: 'bg-rose-600 text-white ring-rose-100 dark:ring-rose-950/60',
    badgeTone: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  },
  CREATE_TRANSMITTAL: {
    label: 'Transmittal Created',
    icon: 'fa-truck-fast',
    nodeBg: 'bg-emerald-500 text-white ring-emerald-100 dark:ring-emerald-950/60',
    badgeTone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  UPDATE_TRANSMITTAL: {
    label: 'Transmittal Updated',
    icon: 'fa-pen-to-square',
    nodeBg: 'bg-indigo-600 text-white ring-indigo-100 dark:ring-indigo-950/60',
    badgeTone: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  UPLOAD_TRANSMITTAL_COR: {
    label: 'Transmittal COR Uploaded',
    icon: 'fa-file-arrow-up',
    nodeBg: 'bg-teal-600 text-white ring-teal-100 dark:ring-teal-950/60',
    badgeTone: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  },
  DELETE_TRANSMITTAL: {
    label: 'Transmittal Deleted',
    icon: 'fa-trash-can',
    nodeBg: 'bg-rose-600 text-white ring-rose-100 dark:ring-rose-950/60',
    badgeTone: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  },
}

const FIELD_LABELS = {
  branch_code: 'Branch Code',
  branch_name: 'Branch Name',
  branch_type: 'Branch Type',
  tin: 'TIN',
  cor_address: 'COR Address',
  cor_link: 'COR Certificate File',
  dole_link: 'DOLE Certificate File',
  dole_address: 'DOLE Address',
  cams_address: 'CAMS Address',
  remarks: 'Remarks',
  type_of_application: 'Type of Application',
  date_received_lbc: 'Date Received (LBC)',
  date_submitted_bir: 'Date Submitted to BIR',
  remarks_in_charge: 'Remarks from In Charge',
  remarks_bir: 'Remarks from BIR',
  claimed_from_bir: 'Claimed from BIR',
}

const cleanComplianceVal = (key, val) => {
  const str = String(val ?? '').trim()
  if (key === 'cor_link' && str === '__MODULE_DOLE__') return ''
  if (key === 'dole_link' && str === '__MODULE_TRANSMITTAL__') return ''
  return str
}

function formatAuditDetail(action, parsed) {
  if (!parsed) return ''
  if (action === 'UPLOAD_COR_CERTIFICATE' || action === 'UPLOAD_TRANSMITTAL_COR') return 'COR certificate attachment was uploaded or replaced.'
  if (action === 'UPLOAD_DOLE_CERTIFICATE') return 'DOLE certificate attachment was uploaded or replaced.'
  if (action === 'CREATE_COMPLIANCE_CERTIFICATE' || action === 'CREATE_COR_CERTIFICATE') return 'Branch COR compliance record was initialized.'
  if (action === 'CREATE_DOLE_CERTIFICATE') return 'Branch DOLE compliance record was initialized.'
  if (action === 'CREATE_TRANSMITTAL') return 'Branch transmittal record was initialized.'
  if (action === 'DELETE_COMPLIANCE_CERTIFICATE' || action === 'DELETE_TRANSMITTAL') return 'Branch compliance record was removed.'

  if (
    (action === 'UPDATE_COMPLIANCE_CERTIFICATE' ||
      action === 'UPDATE_COR_CERTIFICATE' ||
      action === 'UPDATE_DOLE_CERTIFICATE' ||
      action === 'UPDATE_TRANSMITTAL') &&
    parsed.before &&
    parsed.after
  ) {
    const changes = Object.entries(FIELD_LABELS)
      .filter(([key]) => cleanComplianceVal(key, parsed.before?.[key]) !== cleanComplianceVal(key, parsed.after?.[key]))
      .map(([, label]) => label)
    return changes.length ? `Modified fields: ${changes.join(', ')}` : 'Record details were saved.'
  }

  if (parsed?.before?.status && parsed?.after?.status) return `Status changed from ${parsed.before.status} to ${parsed.after.status}`
  return parsed?.module || parsed?.details || ''
}

function getComplianceDiffs(parsed) {
  if (!parsed?.before || !parsed?.after) return { textDiffs: [], fileDiffs: [] }
  const textKeys = [
    'cor_address',
    'dole_address',
    'cams_address',
    'tin',
    'branch_type',
    'remarks',
    'type_of_application',
    'date_received_lbc',
    'date_submitted_bir',
    'remarks_in_charge',
    'remarks_bir',
    'claimed_from_bir',
  ]
  const textDiffs = []
  textKeys.forEach((key) => {
    const beforeVal = cleanComplianceVal(key, parsed.before?.[key])
    const afterVal = cleanComplianceVal(key, parsed.after?.[key])
    if (beforeVal !== afterVal) {
      textDiffs.push({
        key,
        label: FIELD_LABELS[key] || key,
        before: beforeVal,
        after: afterVal,
      })
    }
  })

  const fileDiffs = []
  ;['cor_link', 'dole_link'].forEach((key) => {
    const beforeVal = cleanComplianceVal(key, parsed.before?.[key])
    const afterVal = cleanComplianceVal(key, parsed.after?.[key])
    if (beforeVal !== afterVal && (beforeVal || afterVal)) {
      fileDiffs.push({
        key,
        label: key === 'dole_link' ? 'DOLE Certificate' : 'COR Certificate',
        beforeFileId: getDriveFileIdFromLink(beforeVal),
        afterFileId: getDriveFileIdFromLink(afterVal),
      })
    }
  })

  return { textDiffs, fileDiffs }
}

export default function TimelineModal({ record, module, onClose }) {
  const [previewFileId, setPreviewFileId] = useState('')
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'changes' | 'files'
  const recordId = getWorkflowId(record, module)
  const isCompliance = module?.key === 'compliance'
  const recordTitle =
    record?.branch_name ||
    record?.title ||
    record?.item_name ||
    record?.particular ||
    record?.beneficiary ||
    ''

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['timeline', module?.table, recordId],
    enabled: Boolean(recordId),
    queryFn: async () => {
      const pattern = isCompliance
        ? `%"recordId":"${recordId}"%`
        : `%${recordId}%`
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .ilike('details', pattern)
        .order('created_at', { ascending: false })
        .limit(40)

      if (error) throw error
      return data || []
    },
    staleTime: 15000,
  })

  const events = useMemo(() => {
    const list = []

    if (record?.created_at || record?.uploader_info) {
      const creatorName =
        record.uploaded_by ||
        record.uploader ||
        stripHtml(record.uploader_info) ||
        'System / Initial Import'
      list.push({
        key: 'created',
        category: 'system',
        label: isCompliance ? 'Initial Record Imported / Created' : 'Record Created',
        icon: 'fa-sparkles',
        nodeBg: 'bg-slate-600 text-white ring-slate-100 dark:ring-slate-800',
        badgeTone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        by: creatorName,
        at: getInfoTimestamp(record.uploader_info) || (record.created_at ? new Date(record.created_at) : null),
        detail: isCompliance
          ? `Registered branch record for ${[record.branch_code, record.branch_name].filter(Boolean).join(' - ')}.`
          : 'Initial record submission.',
      })
    }

    if (record?.ops_info) {
      list.push({
        key: 'checked',
        category: 'changes',
        label: 'Checked by OPs Finance',
        icon: 'fa-user-check',
        nodeBg: 'bg-blue-600 text-white ring-blue-100 dark:ring-blue-950/60',
        badgeTone: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
        by: stripHtml(record.ops_info),
        at: getInfoTimestamp(record.ops_info),
        detail: 'Verified by Operations Finance.',
      })
    }

    if (record?.fin_info) {
      list.push({
        key: 'finance',
        category: 'changes',
        label: 'Finance Updated',
        icon: 'fa-circle-check',
        nodeBg: 'bg-emerald-600 text-white ring-emerald-100 dark:ring-emerald-950/60',
        badgeTone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
        by: stripHtml(record.fin_info),
        at: getInfoTimestamp(record.fin_info),
        detail: 'Processed by Finance team.',
      })
    }

    if (record?.email_sent) {
      list.push({
        key: 'email',
        category: 'system',
        label: 'Sent via Email',
        icon: 'fa-paper-plane',
        nodeBg: 'bg-purple-600 text-white ring-purple-100 dark:ring-purple-950/60',
        badgeTone: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
        by: record.email_sent_by || 'Email Sender',
        at: record.email_sent_at ? new Date(record.email_sent_at) : null,
        detail: 'Notification email dispatched.',
      })
    }

    if (record?.status === 'Rejected') {
      list.push({
        key: 'rejected',
        category: 'changes',
        label: 'Rejected',
        icon: 'fa-ban',
        nodeBg: 'bg-rose-600 text-white ring-rose-100 dark:ring-rose-950/60',
        badgeTone: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
        by: record.remarks || 'Rejected',
        at: record.updated_at ? new Date(record.updated_at) : null,
        detail: record.remarks ? `Reason: ${record.remarks}` : 'Record was marked as Rejected.',
      })
    }

    logs.forEach(log => {
      const parsed = parseAudit(log.details)
      if (isCompliance && parsed?.recordId !== recordId) return
      const diffs = isCompliance ? getComplianceDiffs(parsed) : { textDiffs: [], fileDiffs: [] }
      const meta = ACTION_META[log.action] || {
        label: log.action || 'Activity',
        icon: 'fa-clock-rotate-left',
        nodeBg: 'bg-sky-600 text-white ring-sky-100 dark:ring-sky-950/60',
        badgeTone: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
      }
      const hasFiles = diffs.fileDiffs?.length > 0 || log.action?.includes('UPLOAD')
      list.push({
        key: `audit-${log.id}`,
        category: hasFiles ? 'files' : 'changes',
        label: meta.label,
        icon: meta.icon,
        nodeBg: meta.nodeBg,
        badgeTone: meta.badgeTone,
        by: log.user_name || 'Staff',
        at: log.created_at ? new Date(log.created_at) : null,
        detail: formatAuditDetail(log.action, parsed),
        diffs,
      })
    })

    return list.sort((a, b) => (b.at?.getTime?.() || 0) - (a.at?.getTime?.() || 0))
  }, [record, logs, isCompliance, recordId])

  const visibleEvents = useMemo(() => {
    if (filterTab === 'all') return events
    if (filterTab === 'files') {
      return events.filter(e => e.category === 'files' || e.diffs?.fileDiffs?.length > 0)
    }
    if (filterTab === 'changes') {
      return events.filter(e => e.category === 'changes' || e.diffs?.textDiffs?.length > 0)
    }
    return events
  }, [events, filterTab])

  if (!record || !module) return null

  const currentCorFileId = isCompliance
    ? getDriveFileIdFromLink(record.cor_link !== '__MODULE_DOLE__' ? record.cor_link : record.dole_link)
    : ''

  return (
    <div className="modal-backdrop z-[2000]" onClick={onClose}>
      <div
        className="modal-panel max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        {/* Modern Gradient Header */}
        <div className="modal-header">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-200">
                  {module.label}
                </span>
                <span className="rounded-md bg-sky-400/20 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                  {recordId}
                </span>
              </div>
              <h3 className="modal-title mt-1.5">
                <i className="fas fa-clock-rotate-left text-sky-200" />
                Activity &amp; Revision History
              </h3>
              {recordTitle && (
                <p className="modal-subtitle truncate">
                  {recordTitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/15 p-2 text-xs text-white transition hover:bg-white/25"
              title="Close"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* Subheader Summary & Filter Tabs */}
        <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {[
                { key: 'all', label: `All Events (${events.length})`, icon: 'fa-layer-group' },
                { key: 'changes', label: 'Updates & Edits', icon: 'fa-pen-to-square' },
                { key: 'files', label: 'Certificates / Files', icon: 'fa-file-shield' },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    filterTab === tab.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <i className={`fas ${tab.icon} text-[10px]`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {currentCorFileId && (
              <button
                type="button"
                onClick={() => setPreviewFileId(currentCorFileId)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300"
              >
                <i className="fas fa-eye text-[10px]" />
                Current Certificate
              </button>
            )}
          </div>
        </div>

        {/* Timeline Body */}
        <div className="modal-body flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="py-12 text-center text-xs font-semibold text-slate-400">
              <i className="fas fa-spinner animate-spin mr-2 text-sky-500" />
              Loading revision history...
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center dark:border-slate-800">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                <i className="fas fa-clock-rotate-left text-lg" />
              </div>
              <div className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                No matching activity found
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Updates, address edits, and certificate replacements will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="relative pl-4">
              {/* Vertical Connector Line */}
              <div className="absolute bottom-3 left-[27px] top-3 w-0.5 bg-gradient-to-b from-blue-500/40 via-slate-200 to-slate-200 dark:via-slate-800 dark:to-slate-800" />

              <div className="space-y-4">
                {visibleEvents.map((event, idx) => {
                  const rel = formatRelativeTime(event.at)
                  return (
                    <div key={event.key} className="relative flex gap-4">
                      {/* Icon Node */}
                      <div
                        className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs shadow-sm ring-4 ${event.nodeBg}`}
                      >
                        <i className={`fas ${event.icon} text-[11px]`} />
                      </div>

                      {/* Event Card */}
                      <div className="min-w-0 flex-1 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${event.badgeTone}`}>
                              {event.label}
                            </span>
                            {idx === 0 && filterTab === 'all' && (
                              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black uppercase text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                                Latest
                              </span>
                            )}
                          </div>
                          <div className="text-right text-[11px] font-semibold text-slate-400">
                            {event.at ? fmtDate(event.at) : 'No timestamp'}
                            {rel && <span className="ml-1.5 text-slate-400/80">({rel})</span>}
                          </div>
                        </div>

                        {/* Actor + Summary */}
                        <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            <i className="fas fa-user" />
                          </span>
                          <span>{event.by}</span>
                        </div>

                        {event.detail && (
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {event.detail}
                          </p>
                        )}

                        {/* Before vs After Field Diffs */}
                        {event.diffs?.textDiffs?.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {event.diffs.textDiffs.map(diff => (
                              <div
                                key={diff.key}
                                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/50"
                              >
                                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  <i className="fas fa-code-compare text-blue-500" />
                                  {diff.label}
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <div className="rounded-md border border-rose-200/70 bg-rose-50/60 p-2 dark:border-rose-900/40 dark:bg-rose-950/20">
                                    <div className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">
                                      Previous
                                    </div>
                                    <div className="mt-0.5 whitespace-normal break-words font-medium text-slate-700 dark:text-slate-300">
                                      {diff.before || <span className="italic text-slate-400">Empty / None</span>}
                                    </div>
                                  </div>
                                  <div className="rounded-md border border-emerald-200/70 bg-emerald-50/60 p-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                    <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                                      Updated To
                                    </div>
                                    <div className="mt-0.5 whitespace-normal break-words font-semibold text-slate-800 dark:text-slate-100">
                                      {diff.after || <span className="italic text-slate-400">Cleared</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Previous vs New Certificate File Previews */}
                        {event.diffs?.fileDiffs?.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                            {event.diffs.fileDiffs.map(fd => (
                              <div key={fd.key} className="flex flex-wrap gap-2">
                                {fd.beforeFileId && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewFileId(fd.beforeFileId)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300"
                                  >
                                    <i className="fas fa-box-archive text-[11px]" />
                                    Preview Archived {fd.label}
                                  </button>
                                )}
                                {fd.afterFileId && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewFileId(fd.afterFileId)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300"
                                  >
                                    <i className="fas fa-file-circle-check text-[11px]" />
                                    Preview New {fd.label}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-slate-400">
            Showing {visibleEvents.length} of {events.length} recorded event{events.length === 1 ? '' : 's'}
          </span>
          <button type="button" onClick={onClose} className="btn-secondary text-xs">
            Close
          </button>
        </div>
      </div>

      {previewFileId && (
        <FilePreviewModal
          fileId={previewFileId}
          showOpenButton={false}
          onClose={() => setPreviewFileId('')}
        />
      )}
    </div>
  )
}
