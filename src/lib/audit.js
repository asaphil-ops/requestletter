import { supabase } from './supabase'

export async function logAudit({ user, action, module, recordId, before, after, details }) {
  const payload = {
    module,
    recordId,
    before: before || null,
    after: after || null,
    details: details || '',
  }

  const { error } = await supabase.from('audit_logs').insert({
    user_name: user?.full_name || user?.username || 'Unknown',
    action,
    details: JSON.stringify(payload),
  })

  if (error) console.warn('Audit log failed:', error.message)
}
