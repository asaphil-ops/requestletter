export const SUPABASE_PAGE_SIZE = 1000

export async function fetchAllPages(buildQuery, pageSize = SUPABASE_PAGE_SIZE) {
  const rows = []

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await buildQuery().range(from, to)

    if (error) throw error

    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }

  return rows
}
