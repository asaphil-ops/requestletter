import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  isPhotocopyCorRecord,
  PHOTOCOPY_COR_TAG,
  useBulkImportComplianceCertificates,
  useComplianceCertificates,
  useComplianceHistory,
  useCreateComplianceCertificate,
  useDeleteComplianceCertificate,
  useUpdateComplianceCertificate,
  useUpdateComplianceFile,
} from '../hooks/useCompliance'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { branchCodesMatch, getBranchCodeAliases, useBranches, useBranchMap, useBranchOptions, useBranchEmailMap } from '../hooks/useBranches'
import { deleteFromDrive, uploadToDrive } from '../lib/gas'
import { downloadCSV } from '../lib/csv'
import { ROWS_PER_PAGE, fmtDate, normalizeText } from '../lib/utils'
import Pagination from '../components/shared/Pagination'
import { EmptyRow, TableLoader } from '../components/shared/Loader'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import FilePreviewModal from '../components/shared/FilePreviewModal'
import TimelineModal from '../components/shared/TimelineModal'
import ActionMenu from '../components/shared/ActionMenu'
import { WORKFLOW_MODULES } from '../lib/workflow'
import Swal from 'sweetalert2'

const EMPTY_FORM = {
  branch_code: '',
  branch_name: '',
  branch_type: '',
  tin: '',
  cor_address: '',
  dole_address: '',
  cams_address: '',
  cor_link: '',
  dole_link: '',
  remarks: '',
}

const compact = (value) => normalizeText(value)

const ADDRESS_ABBREVIATIONS = [
  [/\b(?:brgy|bgy|brg)\b/g, 'barangay'],
  [/\b(?:st|str)\b/g, 'street'],
  [/\b(?:ave|av)\b/g, 'avenue'],
  [/\brd\b/g, 'road'],
  [/\bblvd\b/g, 'boulevard'],
  [/\bbldg\b/g, 'building'],
  [/\b(?:flr|fl)\b/g, 'floor'],
  [/\bpob\b/g, 'poblacion'],
  [/\bsubd\b/g, 'subdivision'],
  [/\b(?:cmpd|comp)\b/g, 'compound'],
  [/\bcor\b/g, 'corner'],
  [/\b(?:ext|extn)\b/g, 'extension'],
  [/\b(?:hwy|hiway)\b/g, 'highway'],
  [/\bnatl\b/g, 'national'],
  [/\bdist\b/g, 'district'],
  [/\bsta\b/g, 'santa'],
  [/\bsto\b/g, 'santo'],
  [/\bgen\b/g, 'general'],
  [/\bblk\b/g, 'block'],
  [/\b(?:phil|phils)\b/g, 'philippines'],
  [/\b1st\b/g, 'first'],
  [/\b2nd\b/g, 'second'],
  [/\b3rd\b/g, 'third'],
  [/\b4th\b/g, 'fourth'],
  [/\b5th\b/g, 'fifth'],
  [/\b6th\b/g, 'sixth'],
]

const EMPTY_ADDRESS_TOKENS = new Set(['-', '--', 'n/a', 'na', 'none', 'null', 'no cor', 'no dole', 'no address'])

// Generic administrative / street-type words excluded when comparing specific location identifiers
const GENERIC_ADDRESS_WORDS = new Set([
  'philippines', 'ph', 'ncr', 'national', 'capital', 'region', 'metro', 'manila',
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'lone', 'district',
  'province', 'provincial', 'city', 'municipality', 'municipal', 'barangay', 'poblacion',
  'street', 'avenue', 'road', 'boulevard', 'highway', 'drive', 'lane', 'alley', 'corner', 'extension',
  'block', 'lot', 'phase', 'purok', 'zone', 'sitio', 'subdivision', 'village', 'homes', 'compound',
  'building', 'floor', 'unit', 'room', 'stall', 'door', 'ground', 'level', 'no', 'number',
  'of', 'the', 'and', 'in', 'at', 'de', 'del', 'dela', 'delos', 'las', 'los',
])

const stripAddressBoilerplate = (normalized) => {
  if (!normalized) return ''
  return normalized
    // Remove administrative region/district/country suffixes
    .replace(/\b(?:republic of the philippines|philippines|national capital region|ncr|metro manila)\b/g, ' ')
    .replace(/\b(?:first|second|third|fourth|fifth|sixth|lone)\s+district\b/g, ' ')
    .replace(/\bdistrict\s+(?:i|ii|iii|iv|v|vi|1|2|3|4|5|6)\b/g, ' ')
    .replace(/\bregion\s+(?:i|ii|iii|iv\s*a|iv\s*b|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|1|2|3|4a|4b|4|5|6|7|8|9|10|11|12|13)\b/g, ' ')
    // Remove 4-digit Philippine postal/zip codes (e.g. 1109, 1119)
    .replace(/\b\d{4}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const normalizeAddressForMatch = (value) => {
  const raw = compact(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  if (!raw || EMPTY_ADDRESS_TOKENS.has(raw)) return ''

  let text = raw
    // Collapse dotted initials like "j.p." or "j. p." into "jp" before stripping punctuation
    .replace(/\b([a-z])\.(?:\s*([a-z])\.)+/g, (match) => match.replace(/[^a-z]/g, ''))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text || EMPTY_ADDRESS_TOKENS.has(text)) return ''

  // Collapse adjacent single-letter tokens (e.g. "j p rizal" -> "jp rizal")
  text = text.replace(/\b([a-z])\s+(?=[a-z]\b)/g, '$1')

  for (const [pattern, replacement] of ADDRESS_ABBREVIATIONS) {
    text = text.replace(pattern, replacement)
  }

  return text.replace(/\s+/g, ' ').trim()
}

export const addressesAreEqual = (a, b) => {
  if (!a || !b) return false
  if (a === b) return true
  if (a.replace(/\s+/g, '') === b.replace(/\s+/g, '')) return true

  // Compare after stripping zip codes, NCR/region/district, and country suffixes
  const coreA = stripAddressBoilerplate(a)
  const coreB = stripAddressBoilerplate(b)
  if (!coreA || !coreB) return false
  if (coreA === coreB || coreA.replace(/\s+/g, '') === coreB.replace(/\s+/g, '')) return true

  // Check if one core address directly contains the other
  if ((coreA.includes(coreB) || coreB.includes(coreA)) && Math.min(coreA.length, coreB.length) >= 10) {
    return true
  }

  // Compare specific location words (e.g. subdivision, street name, barangay, city)
  // Handles cases like "Blk. 7 Lot 8 Violago Homes Bagong Silangan Quezon City 1119"
  // vs "BLK 7 LOT 28 VIOLAGO HOMES BAGONG SILANGAN QUEZON CITY NCR SECOND DISTRICT PHILIPPINES"
  const wordsA = [...new Set(coreA.split(' ').filter(w => /^[a-z]{2,}$/.test(w) && !GENERIC_ADDRESS_WORDS.has(w)))]
  const wordsB = [...new Set(coreB.split(' ').filter(w => /^[a-z]{2,}$/.test(w) && !GENERIC_ADDRESS_WORDS.has(w)))]

  if (wordsA.length >= 2 && wordsB.length >= 2) {
    const setB = new Set(wordsB)
    const sharedSpecific = wordsA.filter(w => setB.has(w)).length
    const minSpecific = Math.min(wordsA.length, wordsB.length)
    const maxSpecific = Math.max(wordsA.length, wordsB.length)
    if (sharedSpecific >= 2 && sharedSpecific / minSpecific >= 0.8 && sharedSpecific / maxSpecific >= 0.6) {
      return true
    }
  }

  // Fallback overall token overlap (words + numbers)
  const tokensA = [...new Set(coreA.split(' ').filter(Boolean))]
  const tokensB = [...new Set(coreB.split(' ').filter(Boolean))]
  if (tokensA.length >= 3 && tokensB.length >= 3) {
    const tokenSetB = new Set(tokensB)
    const sharedTokens = tokensA.filter(t => tokenSetB.has(t)).length
    const minTokens = Math.min(tokensA.length, tokensB.length)
    if (sharedTokens / minTokens >= 0.8) {
      return true
    }
  }

  return false
}

export const getAddressMatch = (row, certType = 'cor') => {
  const isDole = certType === 'dole'
  const primaryLabel = isDole ? 'DOLE' : 'COR'
  const primaryValue = isDole ? row.dole_address : row.cor_address
  const primaryNorm = normalizeAddressForMatch(primaryValue)
  const camsNorm = normalizeAddressForMatch(row.cams_address)

  if (!primaryNorm) {
    return {
      status: `No ${primaryLabel}`,
      remarks: `No ${primaryLabel} address recorded`,
    }
  }

  if (camsNorm && addressesAreEqual(primaryNorm, camsNorm)) {
    return {
      status: 'Matched',
      remarks: `${primaryLabel} and CAMS addresses matched`,
    }
  }

  if (!camsNorm) {
    return {
      status: 'Unmatched',
      remarks: 'Missing CAMS address',
    }
  }

  return {
    status: 'Unmatched',
    remarks: `${primaryLabel} and CAMS addresses differ`,
  }
}

const safeFilePart = (value) =>
  compact(value)
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')

const renameCertificateFile = (file, record, form, label) => {
  const branchCode = safeFilePart(record?.branch_code || form.branch_code)
  const branchName = safeFilePart(record?.branch_name || form.branch_name)
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
  const fileName = [branchCode, branchName].filter(Boolean).join(' ')
  return new File([file], `${fileName} - ${label}${extension}`, { type: file.type })
}

const getDriveFileIdFromLink = (link) => {
  const value = compact(link)
  if (!value) return ''
  const filePathMatch = value.match(/\/file\/d\/([^/]+)/)
  if (filePathMatch?.[1]) return filePathMatch[1]
  const idMatch = value.match(/[?&]id=([^&]+)/)
  if (idMatch?.[1]) return idMatch[1]
  return value
}

export default function ComplianceCertificates({
  certType = 'cor',
  satelliteNoCorOnly = false,
  photocopyCorOnly = false,
}) {
  const isDole = certType === 'dole'
  const certLabel = isDole ? 'DOLE' : 'COR'
  const pageTitle = satelliteNoCorOnly
    ? `Satellite with No ${certLabel}`
    : photocopyCorOnly
      ? 'Photocopy COR'
      : isDole
        ? 'DOLE Certification'
        : 'COR Certification'
  const addressField = isDole ? 'dole_address' : 'cor_address'
  const linkField = isDole ? 'dole_link' : 'cor_link'
  const addressLabel = isDole ? 'DOLE Address' : 'COR Address'
  const shortAddrLabel = isDole ? 'DOLE Addr' : 'COR Addr'
  const linkLabel = isDole ? 'DOLE Link' : 'COR Link'

  const { canUpload, isAdmin, isSuperAdmin } = useAuthStore()
  const { data = [], isLoading } = useComplianceCertificates(certType)
  const createRecord = useCreateComplianceCertificate(certType)
  const updateRecord = useUpdateComplianceCertificate(certType)
  const deleteRecord = useDeleteComplianceCertificate()
  const updateFile = useUpdateComplianceFile()
  const bulkImport = useBulkImportComplianceCertificates(certType)
  const { data: branches = [] } = useBranches()
  const branchMap = useBranchMap()
  const branchEmailMap = useBranchEmailMap()
  const branchOptions = useBranchOptions()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('view') // 'view' | 'edit'
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [branchLookupOpen, setBranchLookupOpen] = useState(false)
  const [geoFilter, setGeoFilter] = useState({ operation: '', division: '', region: '', area: '', branchCode: '' })
  const [uploadingField, setUploadingField] = useState('')
  const [pendingDriveFiles, setPendingDriveFiles] = useState({})
  const [certFilter, setCertFilter] = useState('')
  const [previewFile, setPreviewFile] = useState('')
  const [timelineTarget, setTimelineTarget] = useState(null)
  const { data: previousVersions = [], isLoading: historyLoading } = useComplianceHistory(
    showModal && editing ? editing.branch_code : '',
    certType
  )

  // Bulk Upload state
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkMode, setBulkMode] = useState('upsert')
  const [bulkFileName, setBulkFileName] = useState('')
  const [bulkPreview, setBulkPreview] = useState(null)
  const bulkInputRef = useRef(null)

  // Satellite with No COR/DOLE modal state
  const [showSatelliteModal, setShowSatelliteModal] = useState(false)
  const [satelliteSearch, setSatelliteSearch] = useState('')
  const [satelliteTypeFilter, setSatelliteTypeFilter] = useState('')

  // Reset filters and modals when switching between COR, Satellite No COR, Photocopy COR, and DOLE modules
  useEffect(() => {
    setSearch('')
    setCertFilter('')
    setSelected([])
    setPage(1)
    setShowModal(false)
    setShowBulkModal(false)
    setShowSatelliteModal(false)
    setSatelliteSearch('')
    setSatelliteTypeFilter('')
    setBulkPreview(null)
    setBulkFileName('')
  }, [certType, satelliteNoCorOnly, photocopyCorOnly])

  const geoLists = useMemo(() => {
    const operations = [...new Set(branches.map(branch => branch.operation).filter(Boolean))].sort()

    let divBranches = branches
    if (geoFilter.operation) {
      divBranches = divBranches.filter(branch => branch.operation === geoFilter.operation)
    }
    const divisions = [...new Set(divBranches.map(branch => branch.division).filter(Boolean))].sort()

    let regBranches = divBranches
    if (geoFilter.division) {
      regBranches = regBranches.filter(branch => branch.division === geoFilter.division)
    }
    const regions = [...new Set(regBranches.map(branch => branch.region).filter(Boolean))].sort()

    let areaBranches = regBranches
    if (geoFilter.region) {
      areaBranches = areaBranches.filter(branch => branch.region === geoFilter.region)
    }
    const areas = [...new Set(areaBranches.map(branch => branch.area).filter(Boolean))].sort()

    let branchList = areaBranches
    if (geoFilter.area) {
      branchList = branchList.filter(branch => branch.area === geoFilter.area)
    }
    const branchesOptions = branchList
      .filter(branch => branch.code && branch.name)
      .map(branch => ({ value: branch.code, label: `${branch.code} - ${branch.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return { operations, divisions, regions, areas, branchesOptions }
  }, [branches, geoFilter.operation, geoFilter.division, geoFilter.region, geoFilter.area])

  const filtered = useMemo(() => {
    const needle = search.toLowerCase()
    return data
      .filter(row => !needle || [
        row.branch_code,
        row.branch_name,
        row.tin,
        row[addressField],
        row.cams_address,
        row.remarks,
      ].some(value => String(value || '').toLowerCase().includes(needle)))
      .filter(row => {
        if (!geoFilter.operation && !geoFilter.division && !geoFilter.region && !geoFilter.area && !geoFilter.branchCode) return true
        const branchCode = String(row.branch_code || '').trim().toUpperCase()
        const branch = branches.find(item => {
          const code = String(item.code || item.branch_code || '').trim().toUpperCase()
          return branchCodesMatch(code, branchCode)
        })
        if (!branch) return false
        if (geoFilter.operation && branch.operation !== geoFilter.operation) return false
        if (geoFilter.division && branch.division !== geoFilter.division) return false
        if (geoFilter.region && branch.region !== geoFilter.region) return false
        if (geoFilter.area && branch.area !== geoFilter.area) return false
        if (geoFilter.branchCode && !branchCodesMatch(branchCode, geoFilter.branchCode)) return false
        return true
      })
      .filter(row => {
        if (photocopyCorOnly && !isPhotocopyCorRecord(row)) return false
        if (satelliteNoCorOnly) {
          const type = compact(row.branch_type).toLowerCase()
          if (!type.includes('satellite')) return false
          const match = getAddressMatch(row, certType)
          if (!match.status.startsWith('No ')) return false
          if (certFilter === 'sat_1') return type === 'satellite i'
          if (certFilter === 'sat_2') return type === 'satellite ii'
          return true
        }
        if (!certFilter) return true
        if (certFilter === 'with_cert') return Boolean(row[linkField])
        if (certFilter === 'no_cert') return !row[linkField]
        if (certFilter === 'matched') return getAddressMatch(row, certType).status === 'Matched'
        if (certFilter === 'unmatched') return getAddressMatch(row, certType).status === 'Unmatched'
        if (certFilter === 'no_address') return getAddressMatch(row, certType).status === `No ${certLabel}`
        return true
      })
      .sort((a, b) => String(a.branch_code || '').localeCompare(String(b.branch_code || '')))
  }, [branches, data, geoFilter, search, certFilter, addressField, linkField, certType, certLabel, satelliteNoCorOnly, photocopyCorOnly])

  const paged = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const branchMatches = useMemo(() => {
    const needle = compact(form.branch_code).toLowerCase()
    const list = needle
      ? branchOptions.filter(branch => `${branch.value} ${branch.label}`.toLowerCase().includes(needle))
      : branchOptions
    return list.slice(0, 10)
  }, [branchOptions, form.branch_code])

  const selectedBranch = useMemo(() => {
    const code = compact(form.branch_code).toUpperCase()
    if (!code) return null
    return (
      branches.find(branch => {
        const bCode = String(branch.code || branch.branch_code || '').trim().toUpperCase()
        return bCode === code || branchCodesMatch(bCode, code)
      }) || null
    )
  }, [branches, form.branch_code])

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const selectBranch = (branch) => {
    setForm(prev => ({
      ...prev,
      branch_code: branch.value,
      branch_name: branch.label.split(' - ').slice(1).join(' - '),
    }))
    setBranchLookupOpen(false)
  }

  const setGeo = (key, value) => {
    setGeoFilter(prev => {
      let next = { ...prev, [key]: value }

      if (key === 'operation') next = { ...next, division: '', region: '', area: '', branchCode: '' }
      else if (key === 'division') next = { ...next, region: '', area: '', branchCode: '' }
      else if (key === 'region') next = { ...next, area: '', branchCode: '' }
      else if (key === 'area') next = { ...next, branchCode: '' }

      if (key === 'branchCode' && value) {
        const aliases = getBranchCodeAliases(value)
        const branch = branches.find(item => {
          const code = String(item.code || item.branch_code || '').trim().toUpperCase()
          return aliases.includes(code)
        })
        if (branch) {
          next = {
            ...next,
            operation: String(branch.operation || '').trim(),
            division: String(branch.division || '').trim(),
            region: String(branch.region || '').trim(),
            area: String(branch.area || '').trim(),
          }
        }
      }

      return next
    })
    setPage(1)
  }

  const selectOptions = (items) => items.map(item => ({ value: item, label: item }))

  const openModal = (record = null, mode = null) => {
    setEditing(record)
    setModalMode(mode || (record ? 'view' : 'edit'))
    setPendingDriveFiles({})
    setUploadingField('')
    setForm(
      record
        ? {
            branch_code: record.branch_code || '',
            branch_name: record.branch_name || '',
            branch_type: record.branch_type || '',
            tin: record.tin || '',
            cor_address: record.cor_address || '',
            dole_address:
              !isDole && isPhotocopyCorRecord(record)
                ? PHOTOCOPY_COR_TAG
                : record.dole_address || '',
            cams_address: record.cams_address || '',
            cor_link: record.cor_link || '',
            dole_link: record.dole_link || '',
            remarks: record.remarks || '',
          }
        : {
            ...EMPTY_FORM,
            dole_address: photocopyCorOnly ? PHOTOCOPY_COR_TAG : '',
            remarks: photocopyCorOnly ? 'Photocopy COR' : '',
          }
    )
    setShowModal(true)
  }

  const cleanupPendingDriveFiles = async () => {
    const files = Object.values(pendingDriveFiles).filter(Boolean)
    if (!files.length) return
    await Promise.allSettled(files.map(file => deleteFromDrive(file.fileId)))
    setPendingDriveFiles({})
  }

  const closeModal = async () => {
    await cleanupPendingDriveFiles()
    setShowModal(false)
    setUploadingField('')
  }

  const handleSave = async () => {
    if (!compact(form.branch_code)) return Swal.fire('Missing field', 'Branch code is required.', 'warning')
    if (!compact(form.branch_name)) return Swal.fire('Missing field', 'Branch name is required.', 'warning')

    try {
      if (editing) {
        await updateRecord.mutateAsync({ id: editing.id, updates: form })
        Swal.fire(
          'Updated!',
          `New ${certLabel} details saved. Any previous address or file has been archived to History.`,
          'success'
        )
      } else {
        await createRecord.mutateAsync(form)
        Swal.fire('Saved!', '', 'success')
      }
      setPendingDriveFiles({})
      setShowModal(false)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleDelete = async (record) => {
    const result = await Swal.fire({
      title: `Delete ${certLabel} compliance record?`,
      text: `${record.branch_code} - ${record.branch_name}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete',
    })
    if (!result.isConfirmed) return

    try {
      await deleteRecord.mutateAsync(record)
      Swal.fire('Deleted!', '', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleUpload = async (record, field, label, deferSave = false) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg'
    input.onchange = async (event) => {
      const file = event.target.files?.[0]
      if (!file) return

      try {
        setUploadingField(field)
        Swal.fire({ title: `Uploading ${label}...`, allowOutsideClick: false, didOpen: () => Swal.showLoading() })
        const renamedFile = renameCertificateFile(file, record, form, label)
        const result = await uploadToDrive(renamedFile, { convertToPdf: true })
        const link = result.url || `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`
        setField(field, link)
        if (record?.id && !deferSave) {
          await updateFile.mutateAsync({ id: record.id, field, link })
          Swal.fire('Uploaded!', `${label} saved to Google Drive and archived previous version in History.`, 'success')
        } else {
          if (result.fileId) {
            const previous = pendingDriveFiles[field]
            if (previous?.fileId) await deleteFromDrive(previous.fileId).catch(() => {})
            setPendingDriveFiles(prev => ({ ...prev, [field]: { fileId: result.fileId, link } }))
          }
          Swal.fire(
            'File Attached!',
            `${label} uploaded. Update the ${addressLabel} or Remarks if needed, then click "${record?.id ? 'Update Record' : 'Save Record'}" to finalize.`,
            'success'
          )
        }
      } catch (err) {
        Swal.fire('Error', err.message, 'error')
      } finally {
        setUploadingField('')
      }
    }
    input.click()
  }

  const exportCSV = () => {
    const headers = [
      'Branch Code',
      'Branch Name',
      'Type',
      'TIN',
      addressLabel,
      'CAMS Address',
      linkLabel,
      'Status',
      'Remarks',
    ]
    const rows = filtered.map(row => {
      const addressMatch = getAddressMatch(row, certType)
      return [
        row.branch_code,
        row.branch_name,
        row.branch_type || '',
        row.tin || '',
        row[addressField] || '',
        row.cams_address || '',
        row[linkField] || '',
        addressMatch.status,
        row.remarks || '',
      ]
    })
    downloadCSV([headers, ...rows], `${certType}_certification_${new Date().toISOString().split('T')[0]}.csv`)
  }

  const downloadBulkTemplate = () => {
    const templateHeaders = [
      'branch_code',
      'branch_name',
      'branch_type',
      'tin',
      addressField,
      'cams_address',
      linkField,
      'remarks',
    ]
    const sampleRows = [
      ['B0001', 'Sample Branch 1', 'Single', '000-123-456-000', '123 Rizal Ave, Manila', '123 Rizal Ave, Manila', '', 'Complete'],
      ['B0002', 'Sample Branch 2', 'Mother', '000-123-456-001', '456 Mabini St, Quezon City', '456 Mabini St, Quezon City', '', ''],
    ]
    downloadCSV([templateHeaders, ...sampleRows], `${certType}_certification_template.csv`)
  }

  const normalizeBulkKey = (key = '') => {
    const k = String(key || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
    const aliasMap = {
      code: 'branch_code',
      branchcode: 'branch_code',
      branch_name: 'branch_name',
      branchname: 'branch_name',
      name: 'branch_name',
      type: 'branch_type',
      branchtype: 'branch_type',
      cor_addr: 'cor_address',
      coraddress: 'cor_address',
      dole_addr: 'dole_address',
      doleaddress: 'dole_address',
      address: addressField,
      cams_addr: 'cams_address',
      camsaddress: 'cams_address',
      cor: 'cor_link',
      corlink: 'cor_link',
      dole: 'dole_link',
      dolelink: 'dole_link',
      link: linkField,
    }
    return aliasMap[k] || k
  }

  const handleBulkFileChange = (file) => {
    if (!file) return
    setBulkFileName(file.name)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawRows = results.data || []
        const branchLookup = new Map()
        branches.forEach(b => {
          const code = String(b.code || b.branch_code || '').trim().toUpperCase()
          if (code) branchLookup.set(code, b.name || b.branch_name || '')
        })

        const validRows = []
        const invalidRows = []

        rawRows.forEach((raw, idx) => {
          const mapped = {}
          Object.entries(raw || {}).forEach(([k, v]) => {
            mapped[normalizeBulkKey(k)] = String(v ?? '').trim()
          })
          const code = String(mapped.branch_code || '').trim().toUpperCase().replace(/O/g, '0')
          const name = mapped.branch_name || branchLookup.get(code) || ''

          if (!code) {
            invalidRows.push({ rowNumber: idx + 2, reason: 'Missing branch_code', raw: mapped })
            return
          }
          if (!name) {
            invalidRows.push({ rowNumber: idx + 2, reason: `Missing branch_name for ${code}`, raw: mapped })
            return
          }

          validRows.push({
            branch_code: code,
            branch_name: name,
            branch_type: mapped.branch_type || '',
            tin: mapped.tin || '',
            cor_address: mapped.cor_address || '',
            dole_address: photocopyCorOnly ? PHOTOCOPY_COR_TAG : (mapped.dole_address || ''),
            cams_address: mapped.cams_address || '',
            cor_link: mapped.cor_link || '',
            dole_link: mapped.dole_link || '',
            remarks: mapped.remarks || (photocopyCorOnly ? 'Photocopy COR' : ''),
          })
        })

        setBulkPreview({ validRows, invalidRows, total: rawRows.length })
      },
      error: (err) => {
        Swal.fire('CSV Parse Error', err.message || 'Unable to parse CSV file', 'error')
      },
    })
  }

  const handleConfirmBulkImport = async () => {
    if (!bulkPreview?.validRows?.length) return
    try {
      const res = await bulkImport.mutateAsync({
        rows: bulkPreview.validRows,
        mode: bulkMode,
      })
      setShowBulkModal(false)
      setBulkPreview(null)
      setBulkFileName('')
      Swal.fire(
        'Bulk Upload Complete!',
        `Processed ${res.inserted + res.updated} ${certLabel} records (${res.inserted} new, ${res.updated} updated).`,
        'success'
      )
    } catch (err) {
      Swal.fire('Import Failed', err.message || 'Failed to import records.', 'error')
    }
  }

  const previewLink = (link) => {
    const fileId = getDriveFileIdFromLink(link)
    if (fileId) setPreviewFile(fileId)
  }

  const handleSendEmail = (row) => {
    if (!row) return
    const branchCode = String(row.branch_code || '').trim().toUpperCase()
    const branch = branchMap[branchCode] || branches.find(b => branchCodesMatch(String(b.code || b.branch_code || '').trim().toUpperCase(), branchCode)) || {}
    const opKey = String(branch.operation || '').toUpperCase()
    const operationEmail = branchEmailMap[opKey] || branchEmailMap[branchCode]

    const branchName = compact(row.branch_name || branch.name || '')
    const branchLabel = [branchCode, branchName].filter(Boolean).join(' - ') || 'Branch'
    const addressMatch = getAddressMatch(row, certType)
    const fileId = getDriveFileIdFromLink(row[linkField])
    const fileName = `${branchCode} ${branchName} - ${certLabel}`.trim()

    useUIStore.getState().openSendEmailModal({
      to: operationEmail ? [operationEmail] : [],
      subject: `${branchLabel} | ${pageTitle} (${addressMatch.status})`,
      messageBody: `Good day Ma'am/Sir,\n\nKindly see the ${pageTitle} details${fileId ? ' and attached certificate' : ''} for ${branchLabel}.`,
      refId: branchCode || String(row.id || ''),
      refType: pageTitle,
      emailTitle: pageTitle,
      fileId: fileId || '',
      fileName,
      allowNoAttachment: true,
      emailDetails: {
        title: `${pageTitle} Details`,
        reference: branchLabel,
        status: addressMatch.status,
        rows: [
          ['Branch', branchLabel],
          ['Branch Type', compact(row.branch_type)],
          ['TIN', compact(row.tin)],
          [addressLabel, compact(row[addressField])],
          ['CAMS Address', compact(row.cams_address)],
          ['Status', `${addressMatch.status} — ${addressMatch.remarks}`],
          ['Remarks', compact(row.remarks)],
        ].filter(([, value]) => Boolean(value)),
      },
    })
  }

  const handleBatchSendEmail = () => {
    const records = filtered.filter(r => selected.includes(r.id))
    if (!records.length) {
      return Swal.fire('Select records first', `Check one or more ${certLabel} records from the table to send via email.`, 'info')
    }
    if (records.length === 1) {
      return handleSendEmail(records[0])
    }

    const emails = records.flatMap(r => {
      const branchCode = String(r.branch_code || '').trim().toUpperCase()
      const branch = branchMap[branchCode] || branches.find(b => branchCodesMatch(String(b.code || b.branch_code || '').trim().toUpperCase(), branchCode)) || {}
      const opKey = String(branch.operation || '').toUpperCase()
      return branchEmailMap[opKey] || branchEmailMap[branchCode]
    }).filter(Boolean)

    useUIStore.getState().openSendEmailModal({
      to: [...new Set(emails)],
      subject: `${pageTitle} Summary (${records.length} Branches)`,
      messageBody: `Good day Ma'am/Sir,\n\nKindly see the consolidated ${pageTitle} summary for ${records.length} branches below.`,
      refId: records.map(r => r.branch_code).join(','),
      refType: `${pageTitle} Batch`,
      emailTitle: pageTitle,
      allowNoAttachment: true,
      emailDetails: {
        title: `${pageTitle} Batch Summary`,
        reference: `${records.length} Branches`,
        status: 'Summary',
        rows: records.map((record, idx) => {
          const match = getAddressMatch(record, certType)
          return [
            `${idx + 1}. ${record.branch_code} - ${compact(record.branch_name)}`,
            `${match.status} | ${addressLabel}: ${compact(record[addressField]) || 'N/A'}`,
          ]
        }),
      },
    })
  }

  const matchedCount = useMemo(
    () => filtered.filter(row => getAddressMatch(row, certType).status === 'Matched').length,
    [filtered, certType]
  )

  const satelliteNoCertList = useMemo(() => {
    return filtered.filter(row => {
      const type = compact(row.branch_type).toLowerCase()
      if (!type.includes('satellite')) return false
      const match = getAddressMatch(row, certType)
      return match.status.startsWith('No ')
    })
  }, [filtered, certType])

  const filteredSatelliteList = useMemo(() => {
    const needle = satelliteSearch.trim().toLowerCase()
    return satelliteNoCertList.filter(row => {
      if (satelliteTypeFilter && compact(row.branch_type).toLowerCase() !== satelliteTypeFilter.toLowerCase()) {
        return false
      }
      if (!needle) return true
      const bCode = String(row.branch_code || '').trim().toUpperCase()
      const branch = branchMap[bCode] || branches.find(b => branchCodesMatch(String(b.code || b.branch_code || '').trim().toUpperCase(), bCode)) || {}
      return [
        row.branch_code,
        row.branch_name,
        row.branch_type,
        row.tin,
        row.cams_address,
        row.remarks,
        branch.operation,
        branch.division,
        branch.region,
        branch.area,
      ].some(val => String(val || '').toLowerCase().includes(needle))
    })
  }, [satelliteNoCertList, satelliteSearch, satelliteTypeFilter, branchMap, branches])

  const exportSatelliteCSV = () => {
    const headers = [
      'Branch Code',
      'Branch Name',
      'Branch Type',
      'Operation',
      'Division',
      'Region',
      'Area',
      'TIN',
      'CAMS Address',
      'Status',
      'Remarks',
    ]
    const rows = filteredSatelliteList.map(row => {
      const bCode = String(row.branch_code || '').trim().toUpperCase()
      const branch = branchMap[bCode] || branches.find(b => branchCodesMatch(String(b.code || b.branch_code || '').trim().toUpperCase(), bCode)) || {}
      const match = getAddressMatch(row, certType)
      return [
        row.branch_code,
        row.branch_name,
        row.branch_type || '',
        branch.operation || '',
        branch.division || '',
        branch.region || '',
        branch.area || '',
        row.tin || '',
        row.cams_address || '',
        match.status,
        row.remarks || '',
      ]
    })
    downloadCSV([headers, ...rows], `satellite_with_no_${certType}_${new Date().toISOString().split('T')[0]}.csv`)
  }

  const handleSendSatelliteEmail = () => {
    if (!filteredSatelliteList.length) {
      return Swal.fire('No records', `No Satellite with No ${certLabel} records found to send.`, 'info')
    }
    const emails = filteredSatelliteList.flatMap(r => {
      const branchCode = String(r.branch_code || '').trim().toUpperCase()
      const branch = branchMap[branchCode] || branches.find(b => branchCodesMatch(String(b.code || b.branch_code || '').trim().toUpperCase(), branchCode)) || {}
      const opKey = String(branch.operation || '').toUpperCase()
      return branchEmailMap[opKey] || branchEmailMap[branchCode]
    }).filter(Boolean)

    useUIStore.getState().openSendEmailModal({
      to: [...new Set(emails)],
      subject: `Satellite with No ${certLabel} (${filteredSatelliteList.length} Branches)`,
      messageBody: `Good day Ma'am/Sir,\n\nKindly see the list of ${filteredSatelliteList.length} Satellite branches with No ${certLabel} below.`,
      refId: filteredSatelliteList.map(r => r.branch_code).slice(0, 15).join(','),
      refType: `Satellite with No ${certLabel}`,
      emailTitle: `Satellite with No ${certLabel}`,
      allowNoAttachment: true,
      emailDetails: {
        title: `Satellite with No ${certLabel} List`,
        reference: `${filteredSatelliteList.length} Satellite Branches`,
        status: `No ${certLabel}`,
        rows: filteredSatelliteList.map((record, idx) => [
          `${idx + 1}. ${record.branch_code} - ${compact(record.branch_name)} (${compact(record.branch_type) || 'Satellite'})`,
          `CAMS: ${compact(record.cams_address) || 'N/A'}`,
        ]),
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Compliance Module</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{pageTitle}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="px-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                {selected.length} selected
              </span>
              <button
                type="button"
                onClick={handleBatchSendEmail}
                className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-500 px-3 text-xs font-bold text-white transition hover:bg-amber-600"
              >
                <i className="fas fa-envelope" />Send to Email
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                title="Clear selection"
              >
                <i className="fas fa-times" />
              </button>
            </div>
          )}
          {!satelliteNoCorOnly && !photocopyCorOnly && (
            <button
              type="button"
              onClick={() => {
                setSatelliteSearch('')
                setSatelliteTypeFilter('')
                setShowSatelliteModal(true)
              }}
              className="btn-secondary text-xs px-3 py-2 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800/60 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              <i className="fas fa-satellite-dish mr-1.5 text-rose-600 dark:text-rose-400" />
              Satellite with No {certLabel} ({satelliteNoCertList.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (selected.length > 0) handleBatchSendEmail()
              else if (satelliteNoCorOnly) handleSendSatelliteEmail()
              else useUIStore.getState().openSendEmailModal({
                subject: `${pageTitle} — Compliance Update`,
                messageBody: `Good day Ma'am/Sir,\n\nKindly see the attached ${pageTitle} file/s.`,
                refType: pageTitle,
                emailTitle: pageTitle,
                allowNoAttachment: true,
              })
            }}
            className="btn-secondary text-xs px-3 py-2 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800/60 dark:text-amber-300 dark:hover:bg-amber-950/40"
          >
            <i className="fas fa-paper-plane mr-1.5 text-amber-600 dark:text-amber-400" />Send to Email
          </button>
          <button onClick={exportCSV} className="btn-secondary text-xs px-3 py-2">
            <i className="fas fa-file-excel mr-1 text-green-600" />Export
          </button>
          {!satelliteNoCorOnly && (canUpload || isAdmin || isSuperAdmin) && (
            <button
              onClick={() => {
                setBulkPreview(null)
                setBulkFileName('')
                setShowBulkModal(true)
              }}
              className="btn-secondary text-xs px-3 py-2 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800/60 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              <i className="fas fa-file-csv mr-1.5 text-blue-600 dark:text-blue-400" />Bulk Upload CSV
            </button>
          )}
          {!satelliteNoCorOnly && canUpload && (
            <button onClick={() => openModal(null, 'edit')} className="btn-primary text-xs px-3 py-2">
              <i className="fas fa-plus mr-1" />
              {photocopyCorOnly ? 'New Photocopy COR' : `New ${certLabel} Record`}
            </button>
          )}
        </div>
      </div>

      {satelliteNoCorOnly ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-gradient-to-br from-rose-600 to-red-700 p-4 text-white shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-white/75">Total Satellite (No {certLabel})</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{filtered.length}</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-white/75">Satellite I (No {certLabel})</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">
              {filtered.filter(r => compact(r.branch_type).toLowerCase() === 'satellite i').length}
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 p-4 text-white shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-white/75">Satellite II (No {certLabel})</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">
              {filtered.filter(r => compact(r.branch_type).toLowerCase() === 'satellite ii').length}
            </div>
          </div>
        </div>
      ) : photocopyCorOnly ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 p-4 text-white shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-white/75">Total Photocopy COR</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{filtered.length}</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-white shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-white/75">With Photocopy File</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{filtered.filter(row => row[linkField]).length}</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-white/75">Matched (COR &amp; CAMS)</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{matchedCount}</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-rose-600 to-red-700 p-4 text-white shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-white/75">Unmatched / No Address</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{Math.max(0, filtered.length - matchedCount)}</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-gradient-to-br from-sky-600 to-blue-700 p-4 text-white shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-white/75">Total Records</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{filtered.length}</div>
          </div>
          <div className={`rounded-xl bg-gradient-to-br p-4 text-white shadow-sm ${isDole ? 'from-indigo-600 to-blue-700' : 'from-emerald-600 to-teal-700'}`}>
            <div className="text-xs font-bold uppercase tracking-wide text-white/75">With {certLabel} File</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{filtered.filter(row => row[linkField]).length}</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-white/75">Matched ({certLabel} &amp; CAMS)</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{matchedCount}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSatelliteSearch('')
              setSatelliteTypeFilter('')
              setShowSatelliteModal(true)
            }}
            className="group rounded-xl bg-gradient-to-br from-rose-600 to-red-700 p-4 text-left text-white shadow-sm transition hover:from-rose-500 hover:to-red-600"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-white/80">
                Satellite with No {certLabel}
              </span>
              <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase text-white group-hover:bg-white/30">
                View List <i className="fas fa-arrow-up-right-from-square ml-0.5 text-[9px]" />
              </span>
            </div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{satelliteNoCertList.length}</div>
          </button>
        </div>
      )}

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px] flex-1">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
            <input
              className="input pl-9"
              value={search}
              placeholder={`Search branch code, branch name, TIN, or ${certLabel} address...`}
              onChange={event => { setSearch(event.target.value); setPage(1) }}
            />
          </div>
          <select
            className="input h-10 w-56 py-1.5 text-xs font-semibold"
            value={certFilter}
            onChange={event => { setCertFilter(event.target.value); setPage(1) }}
            title={`${certLabel} certificate and address status filter`}
          >
            {satelliteNoCorOnly ? (
              <>
                <option value="">All Satellite Types</option>
                <option value="sat_1">Satellite I</option>
                <option value="sat_2">Satellite II</option>
              </>
            ) : (
              <>
                <option value="">All {certLabel} Certificates</option>
                <option value="with_cert">With {certLabel} File</option>
                <option value="no_cert">No {certLabel} File</option>
                <option value="matched">Matched ({certLabel} &amp; CAMS)</option>
                <option value="unmatched">Unmatched</option>
                <option value="no_address">No {certLabel}</option>
              </>
            )}
          </select>
          <button
            onClick={() => {
              setSearch('')
              setGeoFilter({ operation: '', division: '', region: '', area: '', branchCode: '' })
              setCertFilter('')
              setPage(1)
            }}
            className="btn-secondary h-10 text-xs px-3.5"
          >
            <i className="fas fa-sync-alt mr-1.5" />Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <SegmentedSearchSelect label="Operation" value={geoFilter.operation} options={selectOptions(geoLists.operations)} onChange={value => setGeo('operation', value)} className="w-full" />
          <SegmentedSearchSelect label="Division" value={geoFilter.division} options={selectOptions(geoLists.divisions)} onChange={value => setGeo('division', value)} className="w-full" />
          <SegmentedSearchSelect label="Region" value={geoFilter.region} options={selectOptions(geoLists.regions)} onChange={value => setGeo('region', value)} className="w-full" />
          <SegmentedSearchSelect label="Area" value={geoFilter.area} options={selectOptions(geoLists.areas)} onChange={value => setGeo('area', value)} className="w-full" />
          <SegmentedSearchSelect
            label="Branch"
            value={geoFilter.branchCode}
            options={geoLists.branchesOptions}
            onChange={value => setGeo('branchCode', value)}
            placeholder="All"
            className="w-full"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[72vh]">
          <table className="w-full min-w-[1820px]">
            <thead className="sticky top-0 z-20 bg-white shadow-sm dark:bg-slate-900">
              <tr>
                <th className="table-th w-11">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={paged.length > 0 && paged.every(r => selected.includes(r.id))}
                    onChange={e => {
                      const pageIds = paged.map(r => r.id)
                      if (e.target.checked) {
                        setSelected(prev => [...new Set([...prev, ...pageIds])])
                      } else {
                        setSelected(prev => prev.filter(id => !pageIds.includes(id)))
                      }
                    }}
                  />
                </th>
                <th className="table-th w-12">&#35;</th>
                <th className="table-th w-28">Branch Code</th>
                <th className="table-th min-w-[200px] w-56">Branch Name</th>
                <th className="table-th w-32">Type</th>
                <th className="table-th min-w-[160px] w-44">TIN</th>
                <th className="table-th min-w-[320px] w-96">{shortAddrLabel}</th>
                <th className="table-th min-w-[320px] w-96">CAMS Addr</th>
                <th className="table-th w-32">{certLabel} File</th>
                <th className="table-th w-32">Status</th>
                <th className="table-th min-w-[220px] w-64">Remarks</th>
                <th className="table-th table-actions-sticky w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableLoader /> : paged.length === 0 ? <EmptyRow cols={12} /> : paged.map((row, index) => {
                const addressMatch = getAddressMatch(row, certType)
                const remarks = row.remarks || ''
                const fileLink = row[linkField]
                const primaryAddress = row[addressField]
                const isSelected = selected.includes(row.id)
                return (
                  <tr
                    key={row.id}
                    onClick={() => openModal(row, 'view')}
                    className={`table-tr group cursor-pointer transition-colors hover:bg-blue-50/60 dark:hover:bg-slate-800/70 ${isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}
                    title="Click to view details and edit"
                  >
                    <td className="table-td align-top py-4" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 mt-0.5"
                        checked={isSelected}
                        onChange={e => {
                          if (e.target.checked) setSelected(prev => [...prev, row.id])
                          else setSelected(prev => prev.filter(id => id !== row.id))
                        }}
                      />
                    </td>
                    <td className="table-td align-top py-4 text-xs text-gray-400">{(page - 1) * ROWS_PER_PAGE + index + 1}</td>
                    <td className="table-td align-top py-4 whitespace-nowrap font-bold text-blue-600 group-hover:underline dark:text-blue-400">{row.branch_code}</td>
                    <td className="table-td align-top py-4 whitespace-normal break-words font-semibold leading-snug text-slate-800 dark:text-slate-100">
                      {compact(row.branch_name)}
                    </td>
                    <td className="table-td align-top py-4 whitespace-nowrap font-medium">
                      {compact(row.branch_type) || '-'}
                    </td>
                    <td className="table-td align-top py-4 whitespace-nowrap font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {row.tin || '-'}
                    </td>
                    <td className="table-td align-top py-4 whitespace-normal break-words text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                      {compact(primaryAddress || '-')}
                    </td>
                    <td className="table-td align-top py-4 whitespace-normal break-words text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                      {compact(row.cams_address || '-')}
                    </td>
                    <td className="table-td align-top py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {fileLink ? (
                        <button type="button" className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300" onClick={() => previewLink(fileLink)}>
                          <i className="fas fa-eye text-[10px]" />Preview {certLabel}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">No file</span>
                      )}
                    </td>
                    <td className="table-td align-top py-4 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                        addressMatch.status === 'Matched'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : addressMatch.status.startsWith('No ')
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                      }`}>
                        {addressMatch.status}
                      </span>
                    </td>
                    <td className="table-td align-top py-4 whitespace-normal break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {remarks || '-'}
                    </td>
                    <td className="table-td table-actions-sticky align-top py-4" onClick={e => e.stopPropagation()}>
                      <ActionMenu actions={[
                        { label: 'View Details', icon: 'fa-eye', tone: 'blue', onClick: () => openModal(row, 'view') },
                        { label: 'Send to Email', icon: 'fa-envelope', tone: 'amber', onClick: () => handleSendEmail(row) },
                        { label: 'History', icon: 'fa-clock-rotate-left', tone: 'slate', onClick: () => setTimelineTarget(row) },
                        canUpload && {
                          label: `Upload ${certLabel}`,
                          icon: isDole ? 'fa-cloud-upload-alt' : 'fa-file-upload',
                          tone: isDole ? 'blue' : 'emerald',
                          onClick: () => handleUpload(row, linkField, certLabel),
                        },
                        (canUpload || isAdmin || isSuperAdmin) && { label: 'Edit', icon: 'fa-pencil-alt', tone: 'gray', onClick: () => openModal(row, 'edit') },
                        (isAdmin || isSuperAdmin) && { label: 'Delete', icon: 'fa-trash', tone: 'red', onClick: () => handleDelete(row) },
                      ]} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} onChange={setPage} />
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-panel max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="modal-title">
                    <i className={`fas ${isDole ? 'fa-building-shield' : 'fa-certificate'} text-sky-200`} />
                    {!editing ? `New ${certLabel} Record` : modalMode === 'view' ? `${certLabel} Record Details` : `Edit ${certLabel} Record`}
                  </h3>
                  <p className="modal-subtitle">
                    {editing ? `${form.branch_code} — ${selectedBranch?.name || form.branch_name}` : `Branch ${certLabel} and CAMS compliance details`}
                  </p>
                </div>
                {editing && (canUpload || isAdmin || isSuperAdmin) && (
                  <button
                    type="button"
                    onClick={() => setModalMode(prev => (prev === 'view' ? 'edit' : 'view'))}
                    className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/25"
                  >
                    {modalMode === 'view' ? (
                      <><i className="fas fa-pencil-alt mr-1.5" />Edit Record</>
                    ) : (
                      <><i className="fas fa-eye mr-1.5" />View Mode</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {editing && modalMode === 'view' ? (
              <>
                <div className="modal-body flex-1 space-y-4 overflow-y-auto">
                  {/* Top Summary Card */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-black uppercase text-white">
                          {form.branch_code || '-'}
                        </span>
                        {form.branch_type && (
                          <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                            {form.branch_type}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${
                          getAddressMatch(form, certType).status === 'Matched'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : getAddressMatch(form, certType).status.startsWith('No ')
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                        }`}>
                          <i className={`fas ${
                            getAddressMatch(form, certType).status === 'Matched'
                              ? 'fa-check-circle'
                              : getAddressMatch(form, certType).status.startsWith('No ')
                                ? 'fa-minus-circle'
                                : 'fa-exclamation-circle'
                          }`} />
                          {getAddressMatch(form, certType).status}
                        </span>
                      </div>
                      <h4 className="mt-2 text-base font-extrabold text-slate-900 dark:text-slate-100">
                        {selectedBranch?.name || form.branch_name || '-'}
                      </h4>
                      <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {getAddressMatch(form, certType).remarks}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">TIN Number</div>
                      <div className="mt-0.5 font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                        {form.tin || 'Not provided'}
                      </div>
                    </div>
                  </div>

                  {/* Organization Hierarchy */}
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {[
                      { label: 'Operation', value: selectedBranch?.operation },
                      { label: 'Division', value: selectedBranch?.division },
                      { label: 'Region', value: selectedBranch?.region },
                      { label: 'Area', value: selectedBranch?.area },
                    ].map(item => (
                      <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</div>
                        <div className="mt-1 whitespace-normal break-words text-xs font-bold text-slate-800 dark:text-slate-200">
                          {item.value || '-'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Addresses Comparison */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Registered Addresses ({certLabel} vs CAMS)
                    </div>
                    {[
                      {
                        label: addressLabel,
                        value: form[addressField],
                        icon: isDole ? 'fa-building-shield' : 'fa-file-invoice',
                        tone: isDole ? 'text-blue-600' : 'text-emerald-600',
                      },
                      { label: 'CAMS Address', value: form.cams_address, icon: 'fa-map-location-dot', tone: 'text-amber-600' },
                    ].map(addr => (
                      <div key={addr.label} className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          <i className={`fas ${addr.icon} ${addr.tone}`} />
                          {addr.label}
                        </div>
                        <div className="mt-1.5 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-100">
                          {compact(addr.value) || <span className="italic text-slate-400">No address recorded</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Certificate Section */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Attached {certLabel} Certificate
                      </div>
                      {(canUpload || isAdmin || isSuperAdmin) && (form[linkField] || form[addressField]) && (
                        <button
                          type="button"
                          onClick={() => setModalMode('edit')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-blue-700"
                        >
                          <i className="fas fa-rotate" />Update New {certLabel} (Address &amp; File)
                        </button>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">{certLabel} Certificate File</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          form[linkField] ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {form[linkField] ? 'Attached' : 'No file'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {form[linkField] && (
                          <button
                            type="button"
                            onClick={() => previewLink(form[linkField])}
                            className="btn-primary flex-1 justify-center py-2 text-xs"
                          >
                            <i className="fas fa-eye mr-1.5" />Preview Current {certLabel}
                          </button>
                        )}
                        {canUpload && (
                          <button
                            type="button"
                            disabled={Boolean(uploadingField) || updateFile.isPending}
                            onClick={() => handleUpload(editing, linkField, certLabel, false)}
                            className="btn-secondary flex-1 justify-center py-2 text-xs disabled:opacity-50"
                          >
                            <i className={`fas ${uploadingField === linkField ? 'fa-spinner animate-spin text-amber-600' : isDole ? 'fa-cloud-upload-alt text-blue-600' : 'fa-file-upload text-emerald-600'} mr-1.5`} />
                            {uploadingField === linkField ? `Uploading ${certLabel}...` : form[linkField] ? `Quick Replace ${certLabel} File` : `Upload ${certLabel}`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Remarks</div>
                    <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {form.remarks || <span className="italic text-slate-400">No remarks</span>}
                    </div>
                  </div>

                  {/* Previous Certificate Versions / Archive */}
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        <i className="fas fa-box-archive" />
                        Previous {certLabel} History ({previousVersions.length})
                      </div>
                      <span className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-400/80">
                        Automatic Archive
                      </span>
                    </div>

                    {historyLoading ? (
                      <div className="py-3 text-xs text-slate-500">Loading revision history...</div>
                    ) : previousVersions.length === 0 ? (
                      <div className="rounded-lg border border-amber-200/60 bg-white/80 p-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                        No previous {certLabel} revisions yet. When this branch updates to a new {certLabel} address or attachment, the old version will be archived here automatically.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {previousVersions.map((ver, idx) => (
                          <div
                            key={ver.id || idx}
                            className="rounded-lg border border-amber-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                                  Archived #{previousVersions.length - idx}
                                </span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                  Updated by {ver.changedBy}
                                </span>
                                <span className="text-[11px] font-medium text-slate-400">
                                  {ver.changedAt ? fmtDate(new Date(ver.changedAt)) : ''}
                                </span>
                              </div>
                              {ver.previousLink && (
                                <button
                                  type="button"
                                  onClick={() => previewLink(ver.previousLink)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                >
                                  <i className="fas fa-eye text-[10px]" />Preview Old {certLabel}
                                </button>
                              )}
                            </div>

                            {ver.previousAddress && (
                              <div className="mt-2 space-y-1 text-xs">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Previous {addressLabel}
                                </div>
                                <div className="whitespace-normal break-words rounded-md bg-slate-50 px-2.5 py-1.5 font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                                  {ver.previousAddress}
                                </div>
                              </div>
                            )}

                            {ver.newRemarks && (
                              <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="font-semibold">Remarks on update:</span> {ver.newRemarks}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const target = { ...editing, ...form }
                        closeModal()
                        handleSendEmail(target)
                      }}
                      className="btn-secondary border-amber-200 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-800/60 dark:text-amber-300 dark:hover:bg-amber-950/40"
                    >
                      <i className="fas fa-paper-plane mr-1.5 text-amber-600 dark:text-amber-400" />Send to Email
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = editing
                        closeModal()
                        setTimelineTarget(target)
                      }}
                      className="btn-secondary text-xs"
                    >
                      <i className="fas fa-clock-rotate-left mr-1.5" />History
                    </button>
                    {(isAdmin || isSuperAdmin) && (
                      <button
                        type="button"
                        onClick={async () => {
                          const target = editing
                          await closeModal()
                          handleDelete(target)
                        }}
                        className="btn-secondary border-red-200 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400"
                      >
                        <i className="fas fa-trash mr-1.5" />Delete
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={closeModal} className="btn-secondary">Close</button>
                    {(canUpload || isAdmin || isSuperAdmin) && (
                      <button onClick={() => setModalMode('edit')} className="btn-primary">
                        <i className="fas fa-pencil-alt mr-1.5" />Edit Information
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="modal-body flex-1 space-y-3 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="relative">
                      <label className="label">Branch Code *</label>
                      <input
                        className="input font-semibold uppercase"
                        value={form.branch_code}
                        placeholder="B0001"
                        onFocus={() => setBranchLookupOpen(true)}
                        onBlur={() => setTimeout(() => setBranchLookupOpen(false), 200)}
                        onChange={event => {
                          const code = event.target.value.toUpperCase().replace(/O/g, '0')
                          const branch = branchOptions.find(option => option.value === code)
                          setForm(prev => ({
                            ...prev,
                            branch_code: code,
                            branch_name: branch ? branch.label.split(' - ').slice(1).join(' - ') : prev.branch_name,
                          }))
                          setBranchLookupOpen(true)
                        }}
                      />
                      {branchLookupOpen && (
                        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-blue-500 bg-white shadow-xl dark:bg-slate-900">
                          {branchMatches.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-slate-500">No branch found</div>
                          ) : branchMatches.map(branch => (
                            <button
                              key={branch.value}
                              type="button"
                              className="grid w-full grid-cols-[72px_1fr] gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-slate-800"
                              onMouseDown={event => {
                                event.preventDefault()
                                selectBranch(branch)
                              }}
                            >
                              <span className="font-bold text-blue-700 dark:text-blue-400">{branch.value}</span>
                              <span className="truncate text-slate-600 dark:text-slate-300">{branch.label.split(' - ').slice(1).join(' - ')}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="label">Branch Name *</label>
                      <input className="input font-semibold text-rose-700 dark:text-rose-400" readOnly value={selectedBranch?.name || form.branch_name} placeholder="Auto-filled" />
                    </div>
                    <div>
                      <label className="label">Branch Type</label>
                      <select
                        className="input"
                        value={form.branch_type}
                        onChange={event => setField('branch_type', event.target.value)}
                      >
                        <option value="">Select type...</option>
                        <option value="Single">Single</option>
                        <option value="Mother">Mother</option>
                        <option value="Satellite I">Satellite I</option>
                        <option value="Satellite II">Satellite II</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Area</label>
                      <input className="input text-sm" readOnly value={selectedBranch?.area || ''} placeholder="Auto-filled" />
                    </div>
                    <div>
                      <label className="label">Region</label>
                      <input className="input text-sm" readOnly value={selectedBranch?.region || ''} placeholder="Auto-filled" />
                    </div>
                    <div>
                      <label className="label">Division</label>
                      <input className="input text-sm" readOnly value={selectedBranch?.division || ''} placeholder="Auto-filled" />
                    </div>
                    <div>
                      <label className="label">Operation</label>
                      <input className="input text-sm" readOnly value={selectedBranch?.operation || ''} placeholder="Auto-filled" />
                    </div>
                    <div>
                      <label className="label">TIN</label>
                      <input className="input" value={form.tin} onChange={event => setField('tin', event.target.value)} />
                    </div>
                    {editing && (editing[addressField] || editing[linkField]) && (
                      <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                            <i className="fas fa-box-archive" />
                            Current {certLabel} on Record (Will be archived to History on save)
                          </div>
                          {editing[linkField] && (
                            <button
                              type="button"
                              onClick={() => previewLink(editing[linkField])}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300"
                            >
                              <i className="fas fa-eye text-[10px]" />Preview Current {certLabel}
                            </button>
                          )}
                        </div>
                        <div className="mt-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                          <span className="font-bold text-slate-500 dark:text-slate-400">Current {addressLabel}: </span>
                          {editing[addressField] || <span className="italic text-slate-400">No address recorded</span>}
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-amber-700/90 dark:text-amber-400/90">
                          Enter the new {addressLabel} and upload the new {certLabel} attachment below, then click &ldquo;Update Record&rdquo;.
                        </p>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <label className="label">{addressLabel}</label>
                      <textarea className="input resize-none" rows={2} value={form[addressField]} onChange={event => setField(addressField, event.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">CAMS Address</label>
                      <input className="input" value={form.cams_address} onChange={event => setField('cams_address', event.target.value)} />
                    </div>
                    <div>
                      <label className="label">Status ({certLabel} vs CAMS)</label>
                      <input className="input font-bold" readOnly value={getAddressMatch(form, certType).status} />
                    </div>
                    {!isDole && (
                      <div>
                        <label className="label">COR Copy Status</label>
                        <select
                          className="input"
                          value={form.dole_address === PHOTOCOPY_COR_TAG ? PHOTOCOPY_COR_TAG : ''}
                          onChange={event => {
                            const val = event.target.value
                            setField('dole_address', val)
                            if (val === PHOTOCOPY_COR_TAG && !compact(form.remarks)) {
                              setField('remarks', 'Photocopy COR')
                            }
                          }}
                        >
                          <option value="">With Original COR</option>
                          <option value={PHOTOCOPY_COR_TAG}>Photocopy COR (W/O Original)</option>
                        </select>
                      </div>
                    )}
                    <div className={!isDole ? 'sm:col-span-2' : ''}>
                      <label className="label">Remarks</label>
                      <input
                        className="input"
                        value={form.remarks}
                        placeholder={`e.g. Updated new ${certLabel} address & certificate...`}
                        onChange={event => setField('remarks', event.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">{certLabel} Certificate Upload</div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-xs font-bold uppercase text-slate-500">{certLabel} Certificate</div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                            uploadingField === linkField
                              ? 'bg-amber-100 text-amber-700'
                              : pendingDriveFiles[linkField]
                                ? 'bg-blue-100 text-blue-700'
                                : form[linkField]
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                          }`}>
                            {uploadingField === linkField
                              ? 'Uploading'
                              : pendingDriveFiles[linkField]
                                ? 'New File Ready to Save'
                                : form[linkField]
                                  ? 'Attached'
                                  : 'No file'}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(uploadingField) || updateFile.isPending}
                          onClick={() => handleUpload(editing, linkField, certLabel, true)}
                          className="btn-secondary inline-flex w-full items-center justify-center gap-2 text-xs px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                          title={`Upload ${certLabel} certificate`}
                        >
                          <i className={`fas ${uploadingField === linkField ? 'fa-spinner animate-spin text-amber-600' : isDole ? 'fa-cloud-upload-alt text-blue-600' : 'fa-file-upload text-emerald-600'}`} />
                          {uploadingField === linkField ? `Uploading ${certLabel}...` : form[linkField] ? `Upload New / Replace ${certLabel}` : `Upload ${certLabel}`}
                        </button>
                        {form[linkField] && (
                          <button type="button" className="mt-2 block max-w-full truncate text-left text-xs font-semibold text-sky-600 hover:underline" onClick={() => previewLink(form[linkField])}>
                            Preview {pendingDriveFiles[linkField] ? 'newly uploaded' : 'attached'} {certLabel}
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        {editing
                          ? `When you click "Update Record", the new ${certLabel} file & address will become active and the previous version will be saved in History.`
                          : 'Uploaded link will be saved with this new record.'}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">{linkLabel}</label>
                      <input className="input" value={form[linkField]} onChange={event => setField(linkField, event.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
                  {editing ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await cleanupPendingDriveFiles()
                        setForm({
                          branch_code: editing.branch_code || '',
                          branch_name: editing.branch_name || '',
                          branch_type: editing.branch_type || '',
                          tin: editing.tin || '',
                          cor_address: editing.cor_address || '',
                          dole_address: editing.dole_address || '',
                          cams_address: editing.cams_address || '',
                          cor_link: editing.cor_link || '',
                          dole_link: editing.dole_link || '',
                          remarks: editing.remarks || '',
                        })
                        setModalMode('view')
                      }}
                      className="btn-secondary"
                    >
                      Back to Details
                    </button>
                  ) : (
                    <button onClick={closeModal} className="btn-secondary">Cancel</button>
                  )}
                  <button onClick={handleSave} disabled={createRecord.isPending || updateRecord.isPending} className="btn-primary">
                    {editing ? 'Update Record' : 'Save Record'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="modal-backdrop" onClick={() => !bulkImport.isPending && setShowBulkModal(false)}>
          <div className="modal-panel max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="modal-title"><i className="fas fa-file-csv text-sky-200" />Bulk Upload {pageTitle}</h3>
                  <p className="modal-subtitle">Import or update multiple {certLabel} compliance records via CSV</p>
                </div>
                <button
                  type="button"
                  onClick={downloadBulkTemplate}
                  className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25 transition"
                >
                  <i className="fas fa-download mr-1.5" />Download CSV Template
                </button>
              </div>
            </div>

            <div className="modal-body flex-1 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setBulkMode('upsert')}
                  className={`rounded-xl border p-3 text-left transition ${
                    bulkMode === 'upsert'
                      ? 'border-blue-500 bg-blue-50/70 dark:border-blue-500/70 dark:bg-blue-950/30'
                      : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300">Smart Upsert (Recommended)</span>
                    {bulkMode === 'upsert' && <i className="fas fa-check-circle text-blue-600 dark:text-blue-400" />}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    Updates existing records matching <code className="font-bold">branch_code</code> and inserts new branches.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setBulkMode('insert')}
                  className={`rounded-xl border p-3 text-left transition ${
                    bulkMode === 'insert'
                      ? 'border-blue-500 bg-blue-50/70 dark:border-blue-500/70 dark:bg-blue-950/30'
                      : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">Insert All as New Rows</span>
                    {bulkMode === 'insert' && <i className="fas fa-check-circle text-blue-600 dark:text-blue-400" />}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    Adds every CSV row as a new certificate record (useful for multiple certificates per branch).
                  </p>
                </button>
              </div>

              <div
                onClick={() => bulkInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const file = e.dataTransfer?.files?.[0]
                  if (file) handleBulkFileChange(file)
                }}
                className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center transition hover:border-blue-500 hover:bg-blue-50/30 dark:border-slate-700 dark:bg-slate-900/50"
              >
                <input
                  ref={bulkInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => handleBulkFileChange(e.target.files?.[0])}
                />
                <i className="fas fa-cloud-upload-alt text-2xl text-blue-600 dark:text-blue-400" />
                <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  {bulkFileName ? bulkFileName : 'Click to select or drag & drop a CSV file'}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Columns: <code className="font-mono">branch_code, branch_name, branch_type, tin, {addressField}, cams_address, {linkField}, remarks</code>
                </p>
              </div>

              {bulkPreview && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Total Rows</div>
                      <div className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{bulkPreview.total}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
                      <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Ready to Import</div>
                      <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{bulkPreview.validRows.length}</div>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-2.5 text-center dark:border-rose-900/50 dark:bg-rose-950/30">
                      <div className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Skipped / Invalid</div>
                      <div className="text-lg font-extrabold text-rose-700 dark:text-rose-300">{bulkPreview.invalidRows.length}</div>
                    </div>
                  </div>

                  {bulkPreview.invalidRows.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                      <div className="font-bold mb-1"><i className="fas fa-exclamation-triangle mr-1" />Skipped Rows:</div>
                      <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                        {bulkPreview.invalidRows.slice(0, 15).map((item, i) => (
                          <li key={i}>Row {item.rowNumber}: {item.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {bulkPreview.validRows.length > 0 && (
                    <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-100 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <tr>
                            <th className="px-2.5 py-2">Code</th>
                            <th className="px-2.5 py-2">Branch Name</th>
                            <th className="px-2.5 py-2">Type</th>
                            <th className="px-2.5 py-2">TIN</th>
                            <th className="px-2.5 py-2">{shortAddrLabel}</th>
                            <th className="px-2.5 py-2">CAMS Addr</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {bulkPreview.validRows.slice(0, 25).map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-2.5 py-1.5 font-bold text-blue-600 dark:text-blue-400">{r.branch_code}</td>
                              <td className="px-2.5 py-1.5 truncate max-w-[140px]">{r.branch_name}</td>
                              <td className="px-2.5 py-1.5">{r.branch_type || '-'}</td>
                              <td className="px-2.5 py-1.5">{r.tin || '-'}</td>
                              <td className="px-2.5 py-1.5 truncate max-w-[160px]">{r[addressField] || '-'}</td>
                              <td className="px-2.5 py-1.5 truncate max-w-[160px]">{r.cams_address || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {bulkPreview.validRows.length > 25 && (
                        <div className="bg-slate-50 px-3 py-1.5 text-center text-[11px] text-slate-500 dark:bg-slate-900">
                          Showing first 25 of {bulkPreview.validRows.length} valid rows
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                disabled={bulkImport.isPending}
                onClick={() => setShowBulkModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!bulkPreview?.validRows?.length || bulkImport.isPending}
                onClick={handleConfirmBulkImport}
                className="btn-primary disabled:opacity-50"
              >
                {bulkImport.isPending ? (
                  <><i className="fas fa-spinner animate-spin mr-1.5" />Importing...</>
                ) : (
                  <><i className="fas fa-upload mr-1.5" />Import {bulkPreview?.validRows?.length || 0} Records</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {showSatelliteModal && (
        <div className="modal-backdrop" onClick={() => setShowSatelliteModal(false)}>
          <div className="modal-panel max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="modal-title">
                    <i className="fas fa-satellite-dish text-rose-200" />
                    Satellite with No {certLabel}
                  </h3>
                  <p className="modal-subtitle">
                    Satellite branches (Satellite I / II) with no {certLabel} address or certificate on file ({filteredSatelliteList.length} of {satelliteNoCertList.length})
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendSatelliteEmail}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600"
                  >
                    <i className="fas fa-paper-plane mr-1.5" />Send List to Email
                  </button>
                  <button
                    type="button"
                    onClick={exportSatelliteCSV}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <i className="fas fa-file-excel mr-1.5" />Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSatelliteModal(false)}
                    className="rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/25"
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[220px] flex-1">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                  <input
                    className="input h-9 pl-8 text-xs"
                    value={satelliteSearch}
                    onChange={e => setSatelliteSearch(e.target.value)}
                    placeholder="Search branch code, name, operation, region, area, or CAMS address..."
                  />
                </div>
                <select
                  className="input h-9 w-44 py-1 text-xs font-semibold"
                  value={satelliteTypeFilter}
                  onChange={e => setSatelliteTypeFilter(e.target.value)}
                >
                  <option value="">All Satellite Types ({satelliteNoCertList.length})</option>
                  <option value="Satellite I">
                    Satellite I ({satelliteNoCertList.filter(r => compact(r.branch_type).toLowerCase() === 'satellite i').length})
                  </option>
                  <option value="Satellite II">
                    Satellite II ({satelliteNoCertList.filter(r => compact(r.branch_type).toLowerCase() === 'satellite ii').length})
                  </option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto">
              {filteredSatelliteList.length === 0 ? (
                <div className="py-16 text-center text-sm font-medium text-slate-400">
                  <i className="fas fa-check-circle mb-2 block text-2xl text-emerald-500" />
                  No Satellite branches without {certLabel} found.
                </div>
              ) : (
                <table className="w-full min-w-[960px] text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-white shadow-sm dark:bg-slate-900">
                    <tr>
                      <th className="table-th w-12">#</th>
                      <th className="table-th w-28">Branch Code</th>
                      <th className="table-th min-w-[180px]">Branch Name</th>
                      <th className="table-th w-28">Type</th>
                      <th className="table-th w-36">TIN</th>
                      <th className="table-th min-w-[280px]">CAMS Registered Address</th>
                      <th className="table-th w-32">Status</th>
                      <th className="table-th min-w-[160px]">Remarks</th>
                      <th className="table-th w-24 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSatelliteList.map((row, idx) => {
                      const bCode = String(row.branch_code || '').trim().toUpperCase()
                      const branch = branchMap[bCode] || branches.find(b => branchCodesMatch(String(b.code || b.branch_code || '').trim().toUpperCase(), bCode)) || {}
                      const match = getAddressMatch(row, certType)
                      const geoSubtitle = [branch.operation, branch.division, branch.region, branch.area].filter(Boolean).join(' • ')
                      return (
                        <tr
                          key={row.id || idx}
                          onClick={() => {
                            setShowSatelliteModal(false)
                            openModal(row, 'view')
                          }}
                          className="table-tr cursor-pointer transition-colors hover:bg-rose-50/50 dark:hover:bg-slate-800/70"
                          title="Click to view or update branch record"
                        >
                          <td className="table-td align-top py-3 text-slate-400">{idx + 1}</td>
                          <td className="table-td align-top py-3 font-bold text-blue-600 dark:text-blue-400">{row.branch_code}</td>
                          <td className="table-td align-top py-3 whitespace-normal break-words">
                            <div className="font-bold text-slate-800 dark:text-slate-100">{compact(row.branch_name)}</div>
                            {geoSubtitle && (
                              <div className="mt-0.5 text-[10px] font-medium text-slate-400">{geoSubtitle}</div>
                            )}
                          </td>
                          <td className="table-td align-top py-3 whitespace-nowrap">
                            <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300">
                              {compact(row.branch_type) || 'Satellite'}
                            </span>
                          </td>
                          <td className="table-td align-top py-3 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
                            {row.tin || '-'}
                          </td>
                          <td className="table-td align-top py-3 whitespace-normal break-words leading-relaxed text-slate-700 dark:text-slate-200">
                            {compact(row.cams_address || '-')}
                          </td>
                          <td className="table-td align-top py-3 whitespace-nowrap">
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                              {match.status}
                            </span>
                          </td>
                          <td className="table-td align-top py-3 whitespace-normal break-words text-slate-500 dark:text-slate-400">
                            {row.remarks || '-'}
                          </td>
                          <td className="table-td align-top py-3 text-right" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setShowSatelliteModal(false)
                                openModal(row, canUpload ? 'edit' : 'view')
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
                            >
                              <i className="fas fa-pen-to-square text-[10px]" />Update
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs font-semibold text-slate-500">
                Click any row to view details or attach a {certLabel} certificate.
              </span>
              <button type="button" onClick={() => setShowSatelliteModal(false)} className="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {previewFile && <FilePreviewModal fileId={previewFile} showOpenButton={false} onClose={() => setPreviewFile('')} />}
      {timelineTarget && <TimelineModal record={timelineTarget} module={WORKFLOW_MODULES.compliance} onClose={() => setTimelineTarget(null)} />}
    </div>
  )
}
