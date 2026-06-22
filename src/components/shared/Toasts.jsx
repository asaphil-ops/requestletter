import { useEffect, useState } from 'react'
import { useUIStore } from '../../store/uiStore'

const ICONS = {
  success: 'fa-check-circle text-emerald-500',
  error: 'fa-times-circle text-red-500',
  info: 'fa-info-circle text-blue-500',
  warning: 'fa-exclamation-triangle text-amber-500',
}

export default function Toasts() {
  const toasts = useUIStore(s => s.toasts)
  const removeToast = useUIStore(s => s.removeToast)
  const [visible, setVisible] = useState({})

  useEffect(() => {
    toasts.forEach(t => {
      if (!visible[t.id]) {
        setVisible(prev => ({ ...prev, [t.id]: true }))
        setTimeout(() => {
          setVisible(prev => ({ ...prev, [t.id]: false }))
          setTimeout(() => removeToast(t.id), 300)
        }, t.duration || 3500)
      }
    })
  }, [toasts])

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 max-w-sm transform transition-all duration-300 ${visible[t.id] ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}
        >
          <i className={`fas ${ICONS[t.type] || ICONS.info} text-lg`} />
          <div className="flex-1 min-w-0">
            {t.title && <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{t.title}</p>}
            {t.message && <p className="text-xs text-gray-600 dark:text-slate-400 truncate">{t.message}</p>}
          </div>
          <button onClick={() => removeToast(t.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
            <i className="fas fa-times text-xs" />
          </button>
        </div>
      ))}
    </div>
  )
}