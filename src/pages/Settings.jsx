import { useState, useEffect } from 'react'
import { useSettings, useUpdateSettings } from '../hooks/useAccounts'
import Swal from 'sweetalert2'

export default function Settings() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const [maintenance, setMaintenance] = useState(false)
  const [titles, setTitles] = useState([])
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    if (settings) {
      setMaintenance(settings.maintenance)
      setTitles(settings.titles || [])
    }
  }, [settings])

  const addTitle = () => {
    const t = newTitle.trim()
    if (t && !titles.includes(t)) { setTitles(prev => [...prev, t]); setNewTitle('') }
  }

  const removeTitle = (t) => setTitles(prev => prev.filter(x => x !== t))

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({ maintenance, titles })
      Swal.fire('Saved!', 'Settings updated.', 'success')
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  if (isLoading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" /></div>

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mb-5">System Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Maintenance mode */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Maintenance Mode</h3>
              <p className="text-sm text-gray-500">Prevents non-admin users from logging in.</p>
            </div>
            <button
              onClick={() => setMaintenance(m => !m)}
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${maintenance ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${maintenance ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
          {maintenance && (
            <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
              <i className="fas fa-exclamation-triangle mr-1" />
              Maintenance mode is ON. Only admins can log in.
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">System Info</h3>
          <div className="space-y-2">
            {[
              { label: 'Total Request Titles', value: titles.length },
              { label: 'Maintenance Mode', value: maintenance ? 'ON' : 'OFF' },
              { label: 'Version', value: '2.0.0 (React + Supabase)' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{item.label}</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Request Titles */}
      <div className="card p-5 mb-5">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Manage Request Titles</h3>
        <div className="flex gap-2 mb-4">
          <input
            className="input flex-1"
            placeholder="Add new title..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTitle()}
          />
          <button onClick={addTitle} className="btn-primary px-5">Add</button>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          {titles.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No titles added yet.</div>
          ) : titles.map((t, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm">
              <span className="text-gray-700 dark:text-gray-300">{t}</span>
              <button onClick={() => removeTitle(t)} className="text-gray-400 hover:text-red-500 transition-colors w-6 h-6 flex items-center justify-center rounded hover:bg-red-50">
                <i className="fas fa-times text-xs" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={updateSettings.isPending}
        className="btn-success w-full py-3 text-base disabled:opacity-60"
      >
        {updateSettings.isPending ? 'Saving...' : <><i className="fas fa-save mr-2" />Save All Changes</>}
      </button>
    </div>
  )
}
