import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getInfoTimestamp, fmtDate } from '../../lib/utils'
import { getWorkflowId } from '../../lib/workflow'

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

export default function TimelineModal({ record, module, onClose }) {
  const recordId = getWorkflowId(record, module)

  const { data: logs = [] } = useQuery({
    queryKey: ['timeline', module?.table, recordId],
    enabled: Boolean(recordId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .ilike('details', `%${recordId}%`)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error
      return data || []
    },
    staleTime: 30000,
  })

  const events = useMemo(() => {
    const list = []

    if (record?.created_at || record?.uploader_info) {
      list.push({
        key: 'created',
        label: 'Created',
        by: record.uploader || stripHtml(record.uploader_info) || 'Uploader',
        at: getInfoTimestamp(record.uploader_info) || (record.created_at ? new Date(record.created_at) : null),
        tone: 'bg-slate-100 text-slate-700',
      })
    }

    if (record?.ops_info) {
      list.push({
        key: 'checked',
        label: 'Checked by OPs Finance',
        by: stripHtml(record.ops_info),
        at: getInfoTimestamp(record.ops_info),
        tone: 'bg-blue-100 text-blue-700',
      })
    }

    if (record?.fin_info) {
      list.push({
        key: 'finance',
        label: 'Finance Updated',
        by: stripHtml(record.fin_info),
        at: getInfoTimestamp(record.fin_info),
        tone: 'bg-emerald-100 text-emerald-700',
      })
    }

    if (record?.email_sent) {
      list.push({
        key: 'email',
        label: 'Email Sent',
        by: record.email_sent_by || 'Email sender',
        at: record.email_sent_at ? new Date(record.email_sent_at) : null,
        tone: 'bg-purple-100 text-purple-700',
      })
    }

    if (record?.status === 'Rejected') {
      list.push({
        key: 'rejected',
        label: 'Rejected',
        by: record.remarks || 'Rejected',
        at: record.updated_at ? new Date(record.updated_at) : null,
        tone: 'bg-red-100 text-red-700',
      })
    }

    logs.forEach(log => {
      const parsed = parseAudit(log.details)
      list.push({
        key: `audit-${log.id}`,
        label: log.action || 'Audit',
        by: log.user_name || '-',
        at: log.created_at ? new Date(log.created_at) : null,
        detail: parsed?.before?.status && parsed?.after?.status
          ? `${parsed.before.status} -> ${parsed.after.status}`
          : parsed?.module || parsed?.details || '',
        tone: 'bg-gray-100 text-gray-700',
      })
    })

    return list.sort((a, b) => (b.at?.getTime?.() || 0) - (a.at?.getTime?.() || 0))
  }, [record, logs])

  if (!record || !module) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-300">{module.label}</p>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Activity Timeline</h3>
            <p className="text-xs font-semibold text-gray-500">{recordId}</p>
          </div>
          <button onClick={onClose} className="btn-icon bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {events.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No activity recorded yet.</div>
          ) : (
            <div className="space-y-3">
              {events.map(event => (
                <div key={event.key} className="flex gap-3">
                  <div className="mt-1 h-2.5 w-2.5 flex-none rounded-full bg-sky-500" />
                  <div className="min-w-0 flex-1 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${event.tone}`}>{event.label}</span>
                      <span className="text-xs font-semibold text-gray-400">{event.at ? fmtDate(event.at) : 'No date'}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-800 dark:text-slate-200">{event.by}</div>
                    {event.detail && <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">{event.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
