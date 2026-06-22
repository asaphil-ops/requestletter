import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getWorkflowId, WORKFLOW_LIST } from '../lib/workflow'

export function useActionCenter() {
  return useQuery({
    queryKey: ['action-center'],
    queryFn: async () => {
      const results = await Promise.all(
        WORKFLOW_LIST.map(async (module) => {
          const { data, error } = await supabase
            .from(module.table)
            .select('*')
            .or('status.eq.Pending,status.is.null')
            .order('created_at', { ascending: false })
            .limit(50)

          if (error) throw error
          return (data || []).map(row => ({
            ...row,
            _module: module.key,
            _moduleLabel: module.label,
            _route: module.route,
            _recordId: getWorkflowId(row, module),
            _title: module.title(row),
            _owner: module.owner(row),
            _amount: module.amount(row),
          }))
        })
      )

      return results
        .flat()
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    },
    staleTime: 15000,
  })
}
