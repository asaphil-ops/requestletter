export const WORKFLOW_MODULES = {
  req: {
    key: 'req',
    table: 'requests',
    route: '/requests',
    label: 'Request Letter',
    idField: 'req_id',
    dateField: 'date_req',
    title: row => row.title || row.type || 'Request Letter',
    owner: row => row.beneficiary || row.uploader || '-',
    amount: row => row.amount,
  },
  sbar: {
    key: 'sbar',
    table: 'sbar',
    route: '/sbar',
    label: 'SBAR / Transfer',
    idField: 'uniq_id',
    dateField: 'date',
    title: row => row.type || 'SBAR / Transfer',
    owner: row => [row.giver, row.receiver].filter(Boolean).join(' -> ') || row.uploader || '-',
    amount: row => row.amount,
  },
  it: {
    key: 'it',
    table: 'it_expenses',
    route: '/it-expenses',
    label: 'IT Expenses',
    idField: 'uniq_id',
    dateField: 'date',
    title: row => row.item_name || row.category || 'IT Expense',
    owner: row => row.branch_name || row.branch_code || row.uploader || '-',
    amount: row => row.amount,
  },
  at: {
    key: 'at',
    table: 'at_expenses',
    route: '/at-expenses',
    label: 'Aircon & Toilet',
    idField: 'uniq_id',
    dateField: 'date',
    title: row => row.item_name || row.category || 'AT Expense',
    owner: row => row.branch_name || row.branch_code || row.uploader || '-',
    amount: row => row.amount,
  },
  generator: {
    key: 'generator',
    table: 'generator_expenses',
    route: '/generator-expenses',
    label: 'Generator Expenses',
    idField: 'uniq_id',
    dateField: 'date',
    title: row => row.item_name || row.category || 'Generator Expense',
    owner: row => row.branch_name || row.branch_code || row.uploader || '-',
    amount: row => row.amount,
  },
  comms: {
    key: 'comms',
    table: 'comms_expenses',
    route: '/comms-expenses',
    label: 'Comms Expenses',
    idField: 'uniq_id',
    dateField: 'date',
    title: row => row.item_name || row.category || 'Comms Expense',
    owner: row => row.branch_name || row.branch_code || row.uploader || '-',
    amount: row => row.amount,
  },
  initiatives: {
    key: 'initiatives',
    table: 'cost_center_initiatives',
    route: '/cost-center/initiatives',
    label: 'Initiatives Monthly',
    idField: 'uniq_id',
    dateField: 'date',
    title: row => row.particular || row.account_title || 'Initiatives Expense',
    owner: row => row.staff_name || row.sub_account || row.uploader || '-',
    amount: row => row.amount,
  },
  cfoo: {
    key: 'cfoo',
    table: 'cost_center_cfoo',
    route: '/cost-center/cfoo',
    label: 'CFOO Per Staff',
    idField: 'uniq_id',
    dateField: 'date',
    title: row => row.account_title || 'CFOO Expense',
    owner: row => row.staff_name || row.id_number || row.uploader || '-',
    amount: row => row.amount,
  },
  otherCostCenter: {
    key: 'otherCostCenter',
    table: 'cost_center_other',
    route: '/cost-center/other',
    label: 'Other Cost Center',
    idField: 'uniq_id',
    dateField: 'date',
    title: row => row.account_title || 'Other Cost Center Expense',
    owner: row => row.cost_center || row.uploader || '-',
    amount: row => row.amount,
  },
  compliance: {
    key: 'compliance',
    table: 'compliance_certificates',
    route: '/compliance/cor-dole',
    label: 'Compliance - COR and DOLE',
    idField: 'branch_code',
    dateField: 'created_at',
    title: row => 'COR and DOLE Certificate',
    owner: row => row.branch_name || row.branch_code || '-',
    amount: () => '',
  },
}

export const WORKFLOW_LIST = Object.values(WORKFLOW_MODULES)

export const WORKFLOW_TABLE_TO_MODULE = WORKFLOW_LIST.reduce((acc, module) => {
  acc[module.table] = module
  return acc
}, {})

export function getWorkflowId(row = {}, module) {
  return row[module?.idField] || row.req_id || row.uniq_id || row.id || ''
}

export function makeModuleFilterUrl(module, filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return `${module.route}${query ? `?${query}` : ''}`
}

export function downloadCsv(filename, headers, rows) {
  const csvRows = [headers, ...rows].map(row =>
    row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')
  )
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
