import { useMemo, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useStaffFilters } from '../hooks/useStaff'
import { fetchAllBranches } from '../hooks/useBranches'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import Swal from 'sweetalert2'
import Papa from 'papaparse'

const WORKFLOW_IMPORT_TYPES = new Set(['requests', 'sbar', 'it_expenses', 'at_expenses', 'comms_expenses'])

const parseImportDate = (value) => {
  if (!value) return null
  const text = String(value).trim()
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)

  if (isoMatch) {
    const [, year, month, day] = isoMatch.map(Number)
    return new Date(year, month - 1, day, 14, 46)
  }

  if (slashMatch) {
    const [, month, day, year] = slashMatch.map(Number)
    return new Date(year, month - 1, day, 14, 46)
  }

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(14, 46, 0, 0)
  return parsed
}

const formatWorkflowTime = (date) =>
  date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const workflowInfo = (name, date) =>
  `<b>${name}</b><br><span style="font-size:10px;color:#64748b">${formatWorkflowTime(date)}</span>`

const IMPORT_TYPES = {
  branches: {
    label: 'Branches',
    table: 'branches',
    conflict: 'branch_code',
    db_conflict: 'code',
    column_map: { branch_code: 'code', branch_name: 'name' },
    required: ['branch_code', 'branch_name'],
    columns: ['branch_code', 'branch_name', 'area', 'region', 'division', 'operation', 'email'],
    samples: [
      ['B0001', 'Caloocan City I', 'Area 1', 'Region 1', 'Division 1', 'Operation 1', 'branch1@example.com'],
      ['B0002', 'Pasig City I', 'Area 2', 'Region 1', 'Division 1', 'Operation 1', 'branch2@example.com'],
      ['B0003', 'Manila City I', 'Area 3', 'Region 2', 'Division 1', 'Operation 2', 'branch3@example.com'],
    ],
  },
  staff: {
    label: 'Staff Directory',
    table: 'staff',
    conflict: 'id',
    db_conflict: 'id',
    required: ['id', 'last_name'],
    columns: ['id', 'last_name', 'first_name', 'position', 'email', 'branch_code', 'branch_name', 'area', 'region', 'division', 'operation'],
    samples: [
      ['EMP001', 'Dela Cruz', 'Juan', 'Branch Manager', 'juan.delacruz@example.com', 'B0001', 'Caloocan City I', 'Area 1', 'Region 1', 'Division 1', 'Operation 1'],
      ['EMP002', 'Santos', 'Maria', 'Account Officer', 'maria.santos@example.com', 'B0002', 'Pasig City I', 'Area 2', 'Region 1', 'Division 1', 'Operation 1'],
      ['EMP003', 'Reyes', 'Pedro', 'Area Manager', 'pedro.reyes@example.com', 'B0003', 'Manila City I', 'Area 3', 'Region 2', 'Division 1', 'Operation 2'],
    ],
  },
  accounts: {
    label: 'User Accounts',
    table: 'accounts',
    conflict: 'username',
    db_conflict: 'username',
    required: ['username', 'password', 'role', 'full_name'],
    columns: ['username', 'password', 'role', 'full_name', 'email'],
    samples: [
      ['jdelacruz', 'change_me_123', 'Staff', 'Juan Dela Cruz', 'juan.delacruz@example.com'],
      ['msantos', 'change_me_123', 'Ops Finance', 'Maria Santos', 'maria.santos@example.com'],
      ['preyes', 'change_me_123', 'Finance', 'Pedro Reyes', 'pedro.reyes@example.com'],
    ],
  },
  requests: {
    label: 'Request Letters',
    table: 'requests',
    conflict: 'req_id',
    db_conflict: 'req_id',
    required: ['req_id', 'type', 'beneficiary', 'date_req', 'title'],
    columns: ['req_id', 'type', 'beneficiary', 'date_req', 'title', 'description', 'amount', 'status', 'file_id', 'uploader', 'uploader_info', 'ops_info', 'fin_info', 'remarks'],
    samples: [
      ['REQ-0001', 'Branch Request', 'B0001 - Caloocan City I', '2026-05-22', 'Supplies', 'Request letter details', '1500', 'Pending', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '', '', ''],
      ['REQ-0002', 'Staff Request', 'Juan Dela Cruz', '2026-05-22', 'Transportation', 'Staff request details', '800', 'Checked', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '<b>Ops User</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:45 AM</span>', '', ''], // Status 'Checked'
      ['REQ-0003', 'Branch Request', 'B0002 - Pasig City I', '2026-05-22', 'Utilities', 'Checked request sample', '3200', 'Checked', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '<b>Ops User</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:45 AM</span>', '', ''], // Status 'Checked'
    ],
  },
  sbar: {
    label: 'SBAR / Budget Transfer',
    table: 'sbar',
    conflict: 'uniq_id',
    db_conflict: 'uniq_id',
    required: ['uniq_id', 'type', 'date', 'giver', 'receiver', 'giver_title', 'receiver_title'],
    columns: ['uniq_id', 'type', 'date', 'giver', 'receiver', 'giver_title', 'receiver_title', 'description', 'amount', 'status', 'file_id', 'uploader', 'uploader_info', 'ops_info', 'fin_info', 'remarks'],
    samples: [
      ['SBAR-0001', 'SBAR', '2026-05-22', 'B0001 - Caloocan City I', 'B0002 - Pasig City I', 'Supplies', 'Transportation', 'Budget transfer details', '2500', 'Pending', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '', '', ''],
      ['SBAR-0002', 'Budget Transfer', '2026-05-22', 'B0002 - Pasig City I', 'B0003 - Manila City I', 'Utilities', 'Repairs', 'Budget transfer sample', '4000', 'Checked', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '<b>Ops User</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:45 AM</span>', '', ''],
      ['SBAR-0003', 'SBAR', '2026-05-22', 'B0003 - Manila City I', 'B0001 - Caloocan City I', 'Communication', 'Supplies', 'Checked SBAR sample', '1800', 'Checked', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '<b>Ops User</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:45 AM</span>', '', ''], // Status 'Checked'
    ],
  },
  it_expenses: {
    label: 'IT Expenses',
    table: 'it_expenses',
    conflict: 'uniq_id',
    db_conflict: 'uniq_id',
    required: ['uniq_id', 'category', 'date', 'branch_code', 'branch_name', 'item_name'],
    columns: ['uniq_id', 'category', 'date', 'branch_code', 'branch_name', 'account_title', 'item_name', 'description', 'amount', 'status', 'file_id', 'uploader', 'uploader_info', 'ops_info', 'fin_info', 'remarks'],
    samples: [
      ['IT-0001', 'Printer', '2026-05-22', 'B0001', 'Caloocan City I', 'Epson L3210', 'Printer purchase', '8500', 'Pending', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '', '', ''],
      ['IT-0002', 'CCTV', '2026-05-22', 'B0002', 'Pasig City I', '4CH CCTV Kit', 'CCTV installation', '12500', 'Checked', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '<b>Ops User</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:45 AM</span>', '', ''],
      ['IT-0003', 'Monitor', '2026-05-22', 'B0003', 'Manila City I', '24 inch Monitor', 'Monitor replacement', '6500', 'Checked', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '<b>Ops User</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:45 AM</span>', '', ''], // Status 'Checked'
    ],
  },
  at_expenses: {
    label: 'Aircon & Toilet',
    table: 'at_expenses',
    conflict: 'uniq_id',
    db_conflict: 'uniq_id',
    required: ['uniq_id', 'category', 'date', 'branch_code', 'branch_name', 'item_name'],
    columns: ['uniq_id', 'category', 'date', 'branch_code', 'branch_name', 'account_title', 'item_name', 'description', 'amount', 'status', 'file_id', 'uploader', 'uploader_info', 'ops_info', 'fin_info', 'remarks'],
    samples: [
      ['AT-0001', 'Aircon', '2026-05-22', 'B0001', 'Caloocan City I', 'Cleaning / Repair', 'Quarterly maintenance', '3000', 'Pending', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '', '', ''],
      ['AT-0002', 'Toilet', '2026-05-22', 'B0002', 'Pasig City I', 'Flush Repair', 'Toilet repair request', '1500', 'Checked', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '<b>Ops User</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:45 AM</span>', '', ''],
      ['AT-0003', 'Aircon', '2026-05-22', 'B0003', 'Manila City I', 'Freon Charging', 'Aircon repair sample', '2800', 'Checked', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '<b>Ops User</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:45 AM</span>', '', ''], // Status 'Checked'
    ],
  },
  comms_expenses: {
    label: 'Comms Expenses',
    table: 'comms_expenses',
    conflict: 'uniq_id',
    db_conflict: 'uniq_id',
    required: ['uniq_id', 'category', 'date', 'branch_code', 'branch_name', 'item_name'],
    columns: ['uniq_id', 'category', 'date', 'branch_code', 'branch_name', 'account_title', 'item_name', 'description', 'amount', 'status', 'file_id', 'uploader', 'uploader_info', 'ops_info', 'fin_info', 'remarks'],
    samples: [
      ['COMMS-0001', 'GTR', '2026-05-22', 'B0001', 'Caloocan City I', 'Branch Signage', 'Comms request details', '5000', 'Pending', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '', '', ''],
      ['COMMS-0002', 'FAF', '2026-05-22', 'B0002', 'Pasig City I', 'Calendar', 'Calendar printing sample', '2200', 'Checked', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '<b>Ops User</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:45 AM</span>', '', ''],
      ['COMMS-0003', 'Others', '2026-05-22', 'B0003', 'Manila City I', 'Tarpaulin', 'Checked comms request', '1800', 'Checked', '', 'Admin', '<b>Admin</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:34 AM</span>', '<b>Ops User</b><br><span style="font-size:10px;color:#64748b">May 22, 2026, 10:45 AM</span>', '', ''], // Status 'Checked'
    ],
  },
  cfoo_budget: {
    label: 'CFOO Budget Plan',
    table: 'cfoo_budget',
    conflict: 'id_number',
    db_conflict: 'id_number,account_title,month',
    required: ['id_number', 'staff_name', 'budget', 'month'],
    columns: ['id_number', 'staff_name', 'initiative', 'account_title', 'operation', 'division', 'region', 'area', 'budget', 'transfer_to_field_ops', 'sbar', 'actual', 'remaining_budget', 'month'],
  },
}

function escapeCSV(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCSV(filename, rows) {
  const csv = rows.map(row => row.map(escapeCSV).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BulkUpload() {
  const { user } = useAuthStore()
  const [type, setType] = useState('branches')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [uploading, setUploading] = useState(false)
  const [parsingProgress, setParsingProgress] = useState(0);

  // Filter state
  const [operation, setOperation] = useState('')
  const [division, setDivision] = useState('')
  const [region, setRegion] = useState('')
  const [area, setArea] = useState('')
  const [branchCode, setBranchCode] = useState('')

  // Hooks for filter options
  useStaffFilters()

  // Load branches for filter dropdown
  const [branches, setBranches] = useState([])
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const data = await fetchAllBranches()
        setBranches(
          data
            .filter((branch) => branch.code && branch.name)
            .map((branch) => ({ value: branch.code, label: `${branch.code} - ${branch.name}` }))
        )
      } catch (error) {
        console.error('Error loading branches:', error.message)
      }
    }
    fetchBranches()
  }, [])

  const config = IMPORT_TYPES[type]

  // Helper to extract branch code from various column formats
  const getBranchCodeFromRow = (row) => {
    if (row.branch_code) return row.branch_code
    // SBAR format: "B1477-Mercedes, Camarines Norte" (giver/receiver)
    if (row.giver) {
      const match = String(row.giver).match(/^([A-Z0-9]+)[\s-]/)
      if (match) return match[1]
    }
    // Requests format: "B0001 - Caloocan City I" or staff name (beneficiary)
    if (row.beneficiary) {
      const match = String(row.beneficiary).match(/^([A-Z0-9]+)[\s-]/)
      if (match) return match[1]
    }
    return ''
  }

  // Apply filters to rows
  const filteredRows = useMemo(() => {
    if (!rows.length) return []

    return rows.filter(row => {
      // If no filters set, return all rows
      if (!operation && !division && !region && !area && !branchCode) return true

      // Check each filter
      if (operation && row.operation !== operation) return false
      if (division && row.division !== division) return false
      if (region && row.region !== region) return false
      if (area && row.area !== area) return false
      if (branchCode && getBranchCodeFromRow(row) !== branchCode) return false

      return true
    })
  }, [rows, operation, division, region, area, branchCode])

  const previewRows = useMemo(() => filteredRows.slice(0, 8), [filteredRows])
  const hasErrors = errors.length > 0

  const validateRows = (records, selectedConfig) => {
    const issues = []
    const normalized = records.map((record, index) => {
      const cleaned = {}
      selectedConfig.columns.forEach((column) => {
        const value = String(record[column] ?? '').trim()
        if (value) cleaned[column] = value
      })

      selectedConfig.required.forEach((column) => {
        if (!cleaned[column]) issues.push(`Row ${index + 2}: missing ${column}`)
      })

      return cleaned
    })

    return { normalized, issues }
  }

  const handleTemplate = () => {
    downloadCSV(`${type}_template_with_sample_data.csv`, [config.columns, ...(config.samples || [])])
  }

  const handleFile = async (file) => {
      if (!file) return;
      setFileName(file.name);
      setRows([]);
      setErrors([]);
      setParsingProgress(0);

      let rawText;
      try {
        const buffer = await file.arrayBuffer();
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        rawText = utf8Decoder.decode(buffer);
      } catch (e) {
        const buffer = await file.arrayBuffer();
        const ansiDecoder = new TextDecoder('windows-1252');
        rawText = ansiDecoder.decode(buffer);
      }
      // Remove Byte Order Mark (BOM) which often causes the first header to fail validation
      const text = rawText.replace(/^\uFEFF/, '');

      // Detect delimiter manually to ensure tab-separated data (Excel copy-paste) works
      const firstLine = text.split(/\r?\n/)[0];
      const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : '';

      Papa.parse(text, {
        header: true,
        skipEmptyLines: 'greedy',
        delimiter, 
        complete: (results) => {
          const rawHeaders = results.meta.fields || [];
          // Map possible alternative header names (case‑insensitive, spaces/hyphens normalized) to required canonical names
          const headerAliases = {
            // CFOO Budget aliases (keys after normalisation)
            id: 'id_number',
            id_number: 'id_number',
            employee_id: 'id_number',
            staff: 'staff_name',
            staff_name: 'staff_name',
            name: 'staff_name',
            budget: 'budget',
            budget_amount: 'budget',
            month: 'month',
            month_year: 'month',
            // Additional common variations
            'id number': 'id_number',
            'staff name': 'staff_name',
            'budget amount': 'budget',
            'month year': 'month',
          };
          // Helper to normalise header strings: trim, lower‑case, replace spaces/hyphens with underscores
          const normalizeHeader = (h) => h?.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s\u00A0-]+/g, '_');
          const headers = rawHeaders.map(h => {
            const norm = normalizeHeader(h);
            return headerAliases[norm] || norm;
          });
          const missingHeaders = config.required.filter(col => !headers.includes(col));
          if (missingHeaders.length) {
            setErrors([`Missing required header(s): ${missingHeaders.join(', ')}`]);
            setParsingProgress(0);
            return;
          }
           // Normalize record keys based on alias map (case‑insensitive, spaces/hyphens normalized)
           const rawRecords = results.data;
           const records = rawRecords.map(rec => {
             const normalized = {};
             Object.entries(rec).forEach(([key, value]) => {
               const normKey = normalizeHeader(key);
               const canonical = headerAliases[normKey] || normKey;
               normalized[canonical] = value;
             });
             return normalized;
           });

          // Fix scientific notation numbers in conflict key column (Excel truncates large numbers)
          records.forEach(record => {
            const val = record[config.conflict];
            if (val && /^[0-9]+\.[0-9]+E\+[0-9]+$/i.test(String(val).trim())) {
              const num = parseFloat(val);
              if (!Number.isNaN(num) && Number.isFinite(num)) {
                record[config.conflict] = num.toString();
              }
            }
          });

          const { normalized, issues } = validateRows(records, config);
          const sortedRows = normalized.slice().sort((a, b) => {
            const dateA = a.date || a.date_req || '';
            const dateB = b.date || b.date_req || '';
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateB.localeCompare(dateA);
          });
          setRows(sortedRows);
          setErrors(issues);
          setParsingProgress(100);
        },
        error: (err) => {
          setErrors([err.message]);
          setParsingProgress(0);
        },
      });
    };

  // Helper to remap CSV column names to DB column names
  const mapToDbColumns = (row) => {
    const mapped = {}
    config.columns.forEach(col => {
      if (row[col] !== undefined && row[col] !== '') {
        // Check if there's a column_map for this column (e.g., branch_code -> code)
        const targetKey = config.column_map?.[col] || col
        mapped[targetKey] = row[col]
      }
    })

    if (WORKFLOW_IMPORT_TYPES.has(type)) {
      const recordDate = parseImportDate(row.date_req || row.date) || new Date()
      const userName = row.uploader || user?.full_name || user?.username || 'Admin'
      const info = workflowInfo(userName, recordDate)
      const status = String(row.status || mapped.status || 'Pending').trim()

      mapped.created_at = recordDate.toISOString() // Keep created_at
      mapped.updated_at = recordDate.toISOString() // Keep updated_at
      mapped.uploader = userName
      mapped.uploader_info = info

      if (['Checked', 'Approved', 'Rejected'].includes(status)) { // If old data has 'Approved', treat it as 'Checked'
        mapped.ops_info = info
      } else {
        delete mapped.ops_info
      }

      // Remove fin_info as 'Approved' status is no longer part of the workflow
      delete mapped.fin_info
    }

    return mapped
  }

  const handleUpload = async () => {
    if (!filteredRows.length) return Swal.fire('No data', 'Choose a CSV file first.', 'info')
    if (hasErrors) return Swal.fire('Fix CSV first', 'Please resolve validation errors before uploading.', 'error')

    const result = await Swal.fire({
      title: `Upload ${rows.length} ${config.label} row(s)?`,
      text: 'Existing records with the same key will be updated.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Upload',
    })
    if (!result.isConfirmed) return

    setUploading(true)
    try {
      // Remove duplicates within the filtered rows based on conflict column
      const uniqueRows = []
      const seenKeys = new Set()
      for (const row of filteredRows) {
        // For budget plans, use a composite key to prevent incorrect deduplication
        const key = type === 'cfoo_budget'
          ? `${row.id_number}-${row.account_title}-${row.month}`
          : row[config.conflict]

        if (!seenKeys.has(key)) {
          seenKeys.add(key)
          uniqueRows.push(row)
        }
      }
      const duplicatesRemoved = filteredRows.length - uniqueRows.length
      if (duplicatesRemoved > 0) {
        console.log(`Removed ${duplicatesRemoved} duplicate rows based on ${config.conflict}`)
      }

      const chunkSize = 500
      for (let i = 0; i < uniqueRows.length; i += chunkSize) {
        const chunk = uniqueRows.slice(i, i + chunkSize)
        const mappedChunk = chunk.map(mapToDbColumns)
        const { error } = await supabase
          .from(config.table)
          .upsert(mappedChunk, { onConflict: config.db_conflict })

        if (error) throw error
      }

      await supabase.from('audit_logs').insert({
        user_name: user?.full_name || user?.username || 'Admin',
        action: `BULK_UPLOAD_${type.toUpperCase()}`,
        details: `${rows.length} row(s) from ${fileName} (${duplicatesRemoved} CSV duplicates removed)`,
      })

      Swal.fire('Uploaded!', `${uniqueRows.length} row(s) imported successfully.${duplicatesRemoved > 0 ? ` ${duplicatesRemoved} CSV duplicate(s) were skipped.` : ''}`, 'success')
      setRows([])
      setFileName('')
      setErrors([])
    } catch (err) {
      Swal.fire('Upload failed', err.message || 'Could not upload CSV.', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Bulk CSV Upload</h1>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Download a template, fill it out, then upload records directly to the system.</p>
        </div>
        <button onClick={handleTemplate} className="btn-secondary">
          <i className="fas fa-download mr-2" />Download Template
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-1">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Import Setup</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Data Type</label>
              <select className="input" value={type} onChange={e => { setType(e.target.value); setRows([]); setErrors([]); setFileName('') }}>
                {Object.entries(IMPORT_TYPES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
              </select>
            </div>

            {/* Branch filter for all types */}
            {branches.length > 0 && (
              <SegmentedSearchSelect
                label="Branch"
                value={branchCode}
                options={branches}
                onChange={setBranchCode}
                className="w-full"
              />
            )}

            <div>
              <label className="label">CSV File</label>
              <label className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all block">
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                  <i className="fas fa-file-csv text-3xl text-blue-500 mb-3 block" />
                  <div className="font-semibold text-sm text-gray-700 dark:text-gray-300">{fileName || 'Choose CSV file'}</div>
                  <div className="text-xs text-gray-400 mt-1">Use the downloaded template columns.</div>
                </label>
                {parsingProgress > 0 && parsingProgress < 100 && (
                  <div className="mt-2 w-full bg-gray-200 rounded h-2">
                    <div className="bg-blue-500 h-2" style={{ width: `${parsingProgress}%` }} />
                  </div>
                )}
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-slate-950/40 border border-gray-100 dark:border-slate-800 p-3">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Required Columns</div>
              <div className="flex flex-wrap gap-1.5">
                {config.required.map(column => <span key={column} className="badge badge-checked">{column}</span>)}
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 dark:bg-sky-400/10 border border-blue-100 dark:border-sky-300/20 p-3 text-sm text-blue-700 dark:text-sky-100">
              <div className="font-semibold mb-1">Upload Target</div>
              <div>Table: <span className="font-mono">{config.table}</span></div>
              <div>Update key: <span className="font-mono">{config.conflict}</span></div>
            </div>

            <button onClick={handleUpload} disabled={uploading || !rows.length || hasErrors} className="btn-primary w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed">
              {uploading ? <><i className="fas fa-circle-notch fa-spin mr-2" />Uploading...</> : <><i className="fas fa-upload mr-2" />Upload CSV</>}
            </button>
          </div>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">Preview</h3>
              <p className="text-xs text-gray-400">{rows.length ? `${rows.length} valid row(s) loaded` : 'No CSV loaded yet'}</p>
            </div>
            {hasErrors && <span className="badge badge-rejected">{errors.length} issue(s)</span>}
          </div>

          {hasErrors && (
            <div className="m-5 rounded-xl border border-red-200 dark:border-red-400/30 bg-red-50 dark:bg-red-400/10 p-4 max-h-48 overflow-y-auto">
              <div className="font-semibold text-sm text-red-700 dark:text-red-200 mb-2">Validation errors</div>
              <ul className="text-sm text-red-600 dark:text-red-200 space-y-1">
                {errors.slice(0, 30).map((error, index) => <li key={index}>{error}</li>)}
              </ul>
            </div>
          )}

          {!rows.length ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              <i className="fas fa-table text-3xl mb-3 block opacity-40" />
              Download a template and upload a CSV file to preview records.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr>
                    {config.columns.map(column => <th key={column} className="table-th">{column}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={index} className="table-tr">
                      {config.columns.map(column => <td key={column} className="table-td text-xs">{row[column] || '-'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > previewRows.length && (
                <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100 dark:border-slate-800">
                  Showing first {previewRows.length} rows only. Upload will include all {rows.length} rows.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
