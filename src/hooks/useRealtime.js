import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useUIStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'

const TABLES = [
  'requests',
  'sbar',
  'it_expenses',
  'at_expenses',
  'comms_expenses',
  'cost_center_initiatives',
  'cost_center_cfoo',
  'cost_center_other',
  'initiative_account_mappings',
  'employee_list',
]

export default function useRealtime() {
  const qc = useQueryClient()
  const addNotification = useUIStore((s) => s.addNotification)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user) return

    const channels = TABLES.map((table) =>
      supabase
        .channel(`rt-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          qc.invalidateQueries({ queryKey: [table] })
          qc.invalidateQueries({ queryKey: ['dashboard'] })

          if (payload.eventType === 'INSERT' && payload.new?.uploader !== user.full_name) {
            addNotification({
              type: 'new',
              table,
              message: `New entry in ${table.replace('_', ' ')}`,
              data: payload.new,
            })
          }
          if (payload.eventType === 'UPDATE') {
            const s = payload.new?.status
            if (s && ['Approved', 'Rejected', 'Checked'].includes(s)) {
              addNotification({
                type: s.toLowerCase(),
                table,
                message: `Entry ${s} in ${table.replace('_', ' ')}`,
                data: payload.new,
              })
            }
          }
        })
        .subscribe()
    )

    return () => channels.forEach((ch) => supabase.removeChannel(ch))
  }, [user])
}
