import { supabase } from './supabase'
import { downloadCSV } from './csv'
import { getDriveViewUrl, getUploadedAt, sortByLatest } from './utils'

const PAGE_SIZE = 1000

const MODULES = [
  { label: 'Request Letters', table: 'requests', idKey: 'req_id', map: mapRequest },
  { label: 'SBAR / Budget Transfer', table: 'sbar', idKey: 'uniq_id', map: mapSbar },
  { label: 'IT Expenses', table: 'it_expenses', idKey: 'uniq_id', map: mapFieldExpense },
  { label: 'AT Expenses', table: 'at_expenses', idKey: 'uniq_id', map: mapFieldExpense },
  { label: 'Generator Expenses', table: 'generator_expenses', idKey: 'uniq_id', map: mapFieldExpense },
  { label: 'Comms Expenses', table: 'comms_expenses', idKey: 'uniq_id', map: mapFieldExpense },
  { label: 'Cost Center - Initiatives', table: 'cost_center_initiatives', idKey: 'uniq_id', map: mapCostCenter },
  { label: 'Cost Center - CFOO', table: 'cost_center_cfoo', idKey: 'uniq_id', map: mapCostCenter },
  { label: 'Cost Center - Other', table: 'cost_center_other', idKey: 'uniq_id', map: mapCostCenter },
  { label: 'Compliance - COR and DOLE', table: 'compliance_certificates', idKey: 'id', map: mapCompliance },
]

const HEADERS = [
  'Module',
  'Record ID',
  'Date Uploaded',
  'Date',
  'Type / Category',
  'Branch / Beneficiary / Giver',
  'Receiver / Cost Center',
  'Account Title',
  'Item / Title / Particular',
  'Description / Remarks',
  'Amount',
  'Status',
  'Uploader',
  'Checked By',
  'Attachment Link',
]

function textFromHtml(value) {
  if (!value) return ''
  if (typeof document === 'undefined') return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const element = document.createElement('div')
  element.innerHTML = String(value)
  return (element.textContent || element.innerText || String(value)).replace(/\s+/g, ' ').trim()
}

function formatDateTime(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function fetchAllRows(table) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase.from(table).select('*').range(from, to)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

function baseRow(module, row, idKey) {
  return {
    module,
    id: row[idKey] || row.id || '',
    uploaded: formatDateTime(getUploadedAt(row) || row.created_at),
    date: row.date_req || row.date || '',
    status: row.status || '',
    uploader: textFromHtml(row.uploader_info || row.uploader),
    checkedBy: textFromHtml(row.ops_info || row.fin_info),
    attachment: getDriveViewUrl(row.file_id) || '',
  }
}

function toRow(base, fields = {}) {
  return [
    base.module,
    base.id,
    base.uploaded,
    base.date,
    fields.type || '',
    fields.primary || '',
    fields.secondary || '',
    fields.accountTitle || '',
    fields.item || '',
    fields.description || '',
    fields.amount || '',
    base.status,
    base.uploader,
    base.checkedBy,
    base.attachment,
  ]
}

function mapRequest(module, row, idKey) {
  const base = baseRow(module, row, idKey)
  return toRow(base, {
    type: row.type,
    primary: row.beneficiary,
    item: row.title,
    description: row.description,
    amount: row.amount,
  })
}

function mapSbar(module, row, idKey) {
  const base = baseRow(module, row, idKey)
  return toRow(base, {
    type: row.type,
    primary: row.giver,
    secondary: row.receiver,
    accountTitle: [row.giver_title, row.receiver_title].filter(Boolean).join(' -> '),
    description: row.description,
    amount: row.amount,
  })
}

function mapFieldExpense(module, row, idKey) {
  const base = baseRow(module, row, idKey)
  return toRow(base, {
    type: row.category,
    primary: [row.branch_code, row.branch_name].filter(Boolean).join(' - '),
    accountTitle: row.account_title,
    item: row.item_name,
    description: row.description || row.remarks,
    amount: row.amount,
  })
}

function mapCostCenter(module, row, idKey) {
  const base = baseRow(module, row, idKey)
  return toRow(base, {
    type: row.transaction_type || row.category,
    primary: row.staff_name || row.particular || row.cost_center,
    secondary: row.cost_center,
    accountTitle: row.account_title,
    item: row.item_name || row.particular || row.sub_account || row.designation,
    description: row.description || row.remarks,
    amount: row.amount,
  })
}

function mapCompliance(module, row, idKey) {
  const base = baseRow(module, row, idKey)
  base.attachment = [row.cor_link, row.dole_link].filter(Boolean).join(' | ')
  return toRow(base, {
    primary: [row.branch_code, row.branch_name].filter(Boolean).join(' - '),
    secondary: row.cams_address,
    accountTitle: row.tin,
    item: 'COR and DOLE Certificate',
    description: [
      row.cor_address ? `COR: ${row.cor_address}` : '',
      row.dole_address ? `DOLE: ${row.dole_address}` : '',
      row.cor_link ? `COR Link: ${row.cor_link}` : '',
      row.dole_link ? `DOLE Link: ${row.dole_link}` : '',
    ].filter(Boolean).join(' | '),
  })
}

export async function exportAllRecordsCSV() {
  const rows = []
  for (const module of MODULES) {
    const data = await fetchAllRows(module.table)
    rows.push(...sortByLatest(data).map(row => module.map(module.label, row, module.idKey)))
  }
  downloadCSV([HEADERS, ...rows], `all_records_${new Date().toISOString().split('T')[0]}.csv`)
  return rows.length
}
