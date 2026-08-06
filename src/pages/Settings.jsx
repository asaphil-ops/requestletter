import { useState, useEffect } from 'react'
import { useSettings, useUpdateSettings } from '../hooks/useAccounts'
import Swal from 'sweetalert2'
import PageHeader from '../components/shared/PageHeader'
import { DEFAULT_MODULE_BUDGETS } from '../lib/utils'
import { useAuthStore } from '../store/authStore'
import { testGASConnection } from '../lib/gas'

const BUDGET_MODULES = [
  { key: 'it', label: 'IT Equipment', icon: 'fa-print', tone: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
  { key: 'comms', label: 'Communications', icon: 'fa-bullhorn', tone: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' },
  { key: 'at', label: 'Aircon & Toilet', icon: 'fa-tools', tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
  { key: 'generator', label: 'Generator', icon: 'fa-bolt', tone: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
]

const VISIBILITY_MODULES = [
  { key: '/requests', label: 'Request Letter', group: 'Field Operations', icon: 'fa-file-contract' },
  { key: '/sbar', label: 'SBAR / Transfer', group: 'Field Operations', icon: 'fa-exchange-alt' },
  { key: '/it-expenses', label: 'IT Expenses', group: 'Field Operations', icon: 'fa-print' },
  { key: '/at-expenses', label: 'Aircon & Toilet', group: 'Field Operations', icon: 'fa-tools' },
  { key: '/generator-expenses', label: 'Generator', group: 'Field Operations', icon: 'fa-bolt' },
  { key: '/comms-expenses', label: 'Comms Expenses', group: 'Field Operations', icon: 'fa-bullhorn' },
  { key: '/tracker', label: 'Request Letter Tracker', group: 'Field Operations', icon: 'fa-route' },
  { key: '/online-list', label: 'Online List', group: 'Field Operations', icon: 'fa-address-card' },
  { key: '/cfoo-budget', label: 'CFOO Budget', group: 'Cost Center', icon: 'fa-chart-pie' },
  { key: '/cost-center/initiatives', label: 'Initiatives Monthly', group: 'Cost Center', icon: 'fa-lightbulb' },
  { key: '/cost-center/cfoo', label: 'CFOO Per Staff', group: 'Cost Center', icon: 'fa-user-tie' },
  { key: '/cost-center/other', label: 'Other Cost Center', group: 'Cost Center', icon: 'fa-building-columns' },
  { key: '/data-management', label: 'Data Management', group: 'Cost Center', icon: 'fa-database' },
  { key: '/employee-list', label: 'Employee List', group: 'Cost Center', icon: 'fa-id-card' },
  { key: '/circular', label: 'Circular & Admin Order', group: 'Monitoring', icon: 'fa-file-circle-check' },
  { key: '/lantaw', label: 'Lantaw', group: 'Monitoring', icon: 'fa-chart-pie' },
  { key: '/cashflow', label: 'Cash Flow', group: 'Monitoring', icon: 'fa-money-bill-wave' },
  { key: '/budget', label: 'Budget Monitoring', group: 'Monitoring', icon: 'fa-chart-line' },
  { key: '/reports', label: 'Reports', group: 'Monitoring', icon: 'fa-file-pdf' },
  { key: '/compliance/cor-dole', label: 'COR and DOLE Certificate', group: 'Compliance', icon: 'fa-certificate' },
]

const mergeBudgets = (saved = {}) => Object.fromEntries(
  Object.entries(DEFAULT_MODULE_BUDGETS).map(([module, defaults]) => [
    module,
    { ...defaults, ...(saved[module] || {}) },
  ]),
)

const SETTINGS_CATEGORIES = [
  { key: 'general', label: 'General', icon: 'fa-cog', description: 'System-wide settings' },
  { key: 'titles', label: 'Request Titles', icon: 'fa-file-alt', description: 'Manage available request titles' },
  { key: 'budgets', label: 'Budgets', icon: 'fa-wallet', description: 'Manage module allocations' },
  { key: 'modules', label: 'Module Visibility', icon: 'fa-eye', description: 'Show or hide navigation modules' },
]

export default function Settings() {
  const { user } = useAuthStore()
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const [activeTab, setActiveTab] = useState('general')
  const [maintenance, setMaintenance] = useState(false)
  const [titles, setTitles] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [budgets, setBudgets] = useState(() => mergeBudgets())
  const [hiddenModules, setHiddenModules] = useState([])
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [testingSheets, setTestingSheets] = useState(false)
  const [sheetsStatus, setSheetsStatus] = useState(null)

  const testSheets = async () => {
    setTestingSheets(true)
    try {
      const result = await testGASConnection()
      setSheetsStatus({ ok: true, message: `Connected to ${result.sheetName}` })
    } catch (error) {
      setSheetsStatus({ ok: false, message: error.message })
    } finally {
      setTestingSheets(false)
    }
  }

  const snapshot = JSON.stringify({ maintenance, titles, budgets, hiddenModules })
  const hasUnsavedChanges = Boolean(savedSnapshot && savedSnapshot !== snapshot)

  useEffect(() => {
    if (settings) {
      setMaintenance(settings.maintenance)
      setTitles(settings.titles || [])
      setBudgets(mergeBudgets(settings.budgets))
      setHiddenModules(settings.hiddenModules || [])
      setSavedSnapshot(JSON.stringify({
        maintenance: settings.maintenance,
        titles: settings.titles || [],
        budgets: mergeBudgets(settings.budgets),
        hiddenModules: settings.hiddenModules || [],
      }))
    }
  }, [settings])

  useEffect(() => {
    const warnIfUnsaved = event => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnIfUnsaved)
    return () => window.removeEventListener('beforeunload', warnIfUnsaved)
  }, [hasUnsavedChanges])

  const addTitle = () => {
    const t = newTitle.trim()
    if (t && !titles.includes(t)) {
      setTitles(prev => [...prev, t])
      setNewTitle('')
    }
  }

  const removeTitle = (t) => setTitles(prev => prev.filter(x => x !== t))

  const setBudgetAmount = (module, category, value) => {
    const amount = value === '' ? null : Math.max(0, Number(value) || 0)
    setBudgets(previous => ({
      ...previous,
      [module]: { ...previous[module], [category]: amount },
    }))
  }

  const toggleModule = (key) => {
    setHiddenModules(previous => previous.includes(key)
      ? previous.filter(item => item !== key)
      : [...previous, key])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings.mutateAsync({ maintenance, titles, budgets, hiddenModules, updatedBy: user?.full_name || user?.username })
      setSavedSnapshot(snapshot)
      Swal.fire({ icon: 'success', title: 'Settings saved', timer: 2000, showConfirmButton: false, toast: true, position: 'top-end' })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="System Settings"
        subtitle="Manage application configuration without changing the code"
        eyebrow="Administration"
        icon="fa-sliders-h"
        actions={<button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-6 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <i className="fas fa-save text-xs" />
              {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
            </>
          )}
        </button>}
      />

      {(settings?.updatedAt || hasUnsavedChanges) && (
        <div className={`mb-5 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-xs ${hasUnsavedChanges ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/10 dark:text-amber-300' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>
          <i className={`fas ${hasUnsavedChanges ? 'fa-circle-exclamation' : 'fa-clock'}`} />
          {hasUnsavedChanges
            ? 'You have unsaved changes. Save before leaving or closing this page.'
            : `Last updated ${new Date(settings.updatedAt).toLocaleString('en-PH')} by ${settings.updatedBy || 'Administrator'}`}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1 space-y-4">
          {/* Tab Navigation */}
          <div className="relative">
            {/* Glow effect behind active tab */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent rounded-2xl blur-xl" />

            <div className="relative bg-gradient-to-b from-gray-50/80 to-white dark:from-slate-800/60 dark:to-slate-900/60 border border-gray-200/60 dark:border-slate-700/50 rounded-2xl p-2 backdrop-blur-sm">
              <div className="space-y-1">
                {SETTINGS_CATEGORIES.map(cat => {
                  const isActive = activeTab === cat.key
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setActiveTab(cat.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 text-left group relative overflow-hidden ${
                        isActive
                          ? 'bg-white dark:bg-slate-800 shadow-lg shadow-blue-500/10 dark:shadow-sky-500/10 border border-blue-100 dark:border-sky-900/50'
                          : 'hover:bg-white/60 dark:hover:bg-slate-800/40 border border-transparent'
                      }`}
                    >
                      {/* Active indicator glow */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-gradient-to-b from-blue-500 to-sky-400 rounded-r-full" />
                      )}

                      {/* Icon */}
                      <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-md shadow-blue-500/30'
                          : 'bg-gray-100 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 group-hover:bg-gray-200 dark:group-hover:bg-slate-700'
                      }`}>
                        <i className={`fas ${cat.icon} text-sm`} />
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0 relative">
                        <div className={`text-sm font-bold truncate transition-colors ${
                          isActive ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-slate-200'
                        }`}>
                          {cat.label}
                        </div>
                        <div className={`text-[10px] truncate transition-colors ${
                          isActive ? 'text-gray-500 dark:text-slate-400' : 'text-gray-400 dark:text-slate-500'
                        }`}>
                          {cat.description}
                        </div>
                      </div>

                      {/* Active arrow */}
                      {isActive && (
                        <i className="fas fa-chevron-right text-[9px] text-blue-500 dark:text-sky-400" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Quick Stats Card */}
          <div className="relative overflow-hidden">
            {/* Decorative background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10" />

            <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-gray-200/60 dark:border-slate-700/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">System Overview</h4>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      maintenance
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      <i className={`fas ${maintenance ? 'fa-exclamation-triangle' : 'fa-check-circle'} text-xs`} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">Maintenance</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                    maintenance
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {maintenance ? 'ON' : 'OFF'}
                  </span>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-slate-700 to-transparent" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <i className="fas fa-file-alt text-xs" />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">Titles</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">{titles.length}</span>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-slate-700 to-transparent" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <i className="fas fa-code-branch text-xs" />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">Version</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">v2.0.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'general' && (
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-sky-950/40 flex items-center justify-center">
                  <i className="fas fa-cog text-blue-600 dark:text-sky-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">General Settings</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Manage system-wide configuration</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-700 dark:bg-slate-800/30">
                  <div><h4 className="text-sm font-bold text-slate-900 dark:text-white"><i className="fas fa-table mr-2 text-emerald-600" />Google Sheets connection</h4><p className={`mt-1 text-xs ${sheetsStatus?.ok === false ? 'text-red-600' : sheetsStatus?.ok ? 'text-emerald-600' : 'text-slate-500 dark:text-slate-400'}`}>{sheetsStatus?.message || 'Test the deployed Apps Script and tracker access.'}</p></div>
                  <button type="button" onClick={testSheets} disabled={testingSheets} className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"><i className={`fas ${testingSheets ? 'fa-spinner fa-spin' : 'fa-plug'}`} />{testingSheets ? 'Testing...' : 'Test connection'}</button>
                </div>
                {/* Maintenance Mode Card */}
                <div className={`border rounded-xl p-5 transition-all ${
                  maintenance
                    ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700/50'
                    : 'bg-gray-50/50 dark:bg-slate-800/30 border-gray-200 dark:border-slate-700'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <i className="fas fa-tools text-sm text-gray-600 dark:text-slate-300" />
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Maintenance Mode</h4>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                        When enabled, only administrators can access the system. Regular users will see a maintenance notice.
                      </p>
                      {maintenance && (
                        <div className="mt-3 flex items-start gap-2 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-lg p-3">
                          <i className="fas fa-exclamation-circle text-amber-600 dark:text-amber-400 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Maintenance mode is active</p>
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">Only admins can log in right now.</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setMaintenance(m => !m)}
                      className={`relative w-14 h-8 rounded-full transition-all duration-200 flex-shrink-0 ${
                        maintenance
                          ? 'bg-blue-600 dark:bg-sky-500'
                          : 'bg-gray-300 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-200 ${
                        maintenance ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* System Info Card */}
                <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                    <h4 className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wider">System Information</h4>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {[
                      { label: 'Total Request Titles', value: titles.length, icon: 'fa-file-alt', color: 'text-blue-500' },
                      { label: 'Maintenance Mode', value: maintenance ? 'Active' : 'Inactive', icon: 'fa-toggle-on', color: maintenance ? 'text-amber-500' : 'text-emerald-500' },
                      { label: 'Application Version', value: '2.0.0', icon: 'fa-code-branch', color: 'text-purple-500' },
                      { label: 'Environment', value: 'Production', icon: 'fa-server', color: 'text-cyan-500' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <i className={`fas ${item.icon} text-xs ${item.color}`} />
                          <span className="text-sm text-gray-700 dark:text-slate-200">{item.label}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'titles' && (
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                  <i className="fas fa-file-alt text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Request Titles</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Manage the list of available request titles across the system</p>
                </div>
              </div>

              {/* Add new title */}
              <div className="flex gap-3 mb-4">
                <div className="flex-1 relative">
                  <i className="fas fa-plus absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input
                    className="input pl-9"
                    placeholder="Enter new request title..."
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTitle()}
                  />
                </div>
                <button onClick={addTitle} className="btn-primary px-6 flex items-center gap-2">
                  <i className="fas fa-plus text-xs" />
                  Add Title
                </button>
              </div>

              {/* Titles List */}
              <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {titles.length} {titles.length === 1 ? 'Title' : 'Titles'}
                  </span>
                </div>
                {titles.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center">
                      <i className="fas fa-inbox text-xl text-gray-300 dark:text-slate-600" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">No titles yet</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Add your first request title above</p>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
                    {titles.map((t, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-md bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-slate-400">
                            {i + 1}
                          </span>
                          <span className="text-sm text-gray-800 dark:text-slate-200 font-medium">{t}</span>
                        </div>
                        <button
                          onClick={() => removeTitle(t)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <i className="fas fa-trash-alt text-xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'budgets' && (
            <div className="space-y-4">
              <div className="card p-6">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <i className="fas fa-wallet" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Module Budget Allocations</h3>
                    <p className="text-xs leading-relaxed text-gray-500 dark:text-slate-400">Enter the approved total budget for each category. Leave an amount blank when the category has no fixed allocation.</p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {BUDGET_MODULES.map(module => (
                    <section key={module.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30">
                      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${module.tone}`}>
                          <i className={`fas ${module.icon} text-sm`} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{module.label}</div>
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{Object.keys(budgets[module.key] || {}).length} categories</div>
                        </div>
                      </div>
                      <div className="grid gap-3 p-4 sm:grid-cols-2">
                        {Object.entries(budgets[module.key] || {}).map(([category, amount]) => (
                          <label key={category} className="block min-w-0">
                            <span className="mb-1.5 block truncate text-xs font-bold text-slate-600 dark:text-slate-300" title={category}>{category}</span>
                            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900">
                              <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800">₱</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount ?? ''}
                                onChange={event => setBudgetAmount(module.key, category, event.target.value)}
                                placeholder="No fixed budget"
                                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-right text-sm font-bold text-slate-900 outline-none placeholder:text-xs placeholder:font-normal placeholder:text-slate-400 dark:text-white"
                              />
                            </div>
                          </label>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="card p-6">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                  <i className="fas fa-eye" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Module Visibility</h3>
                  <p className="text-xs leading-relaxed text-gray-500 dark:text-slate-400">Turn off a module to hide it from the sidebar and global search for everyone, including administrators. System Settings always remains available so modules can be restored.</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {VISIBILITY_MODULES.map(module => {
                  const visible = !hiddenModules.includes(module.key)
                  return (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() => toggleModule(module.key)}
                      className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${visible ? 'border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900' : 'border-slate-200 bg-slate-100 opacity-70 dark:border-slate-700 dark:bg-slate-800/50'}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${visible ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                        <i className={`fas ${module.icon}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{module.label}</span>
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{module.group}</span>
                      </span>
                      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${visible ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${visible ? 'left-6' : 'left-1'}`} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
