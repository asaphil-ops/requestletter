import { useState, useEffect } from 'react'
import { useSettings, useUpdateSettings } from '../hooks/useAccounts'
import Swal from 'sweetalert2'

const SETTINGS_CATEGORIES = [
  { key: 'general', label: 'General', icon: 'fa-cog', description: 'System-wide settings' },
  { key: 'titles', label: 'Request Titles', icon: 'fa-file-alt', description: 'Manage available request titles' },
]

export default function Settings() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const [activeTab, setActiveTab] = useState('general')
  const [maintenance, setMaintenance] = useState(false)
  const [titles, setTitles] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings) {
      setMaintenance(settings.maintenance)
      setTitles(settings.titles || [])
    }
  }, [settings])

  const addTitle = () => {
    const t = newTitle.trim()
    if (t && !titles.includes(t)) {
      setTitles(prev => [...prev, t])
      setNewTitle('')
    }
  }

  const removeTitle = (t) => setTitles(prev => prev.filter(x => x !== t))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings.mutateAsync({ maintenance, titles })
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
      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Administration</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">System Settings</h1>
        </div>
        <button
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
              Save Changes
            </>
          )}
        </button>
      </div>

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
        </div>
      </div>
    </div>
  )
}