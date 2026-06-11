import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function SegmentedSearchSelect({
  label,
  value,
  options = [],
  onChange,
  placeholder = 'All',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef(null)

  const selected = options.find(option => option.value === value)

  useEffect(() => {
    setQuery(selected?.label || '')
  }, [selected?.label])

  useEffect(() => {
    const handleClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle || selected?.label === query) return options.slice(0, 80)
    return options
      .filter(option => option.label.toLowerCase().includes(needle))
      .slice(0, 80)
  }, [options, query, selected?.label])

  const clearSelection = () => {
    onChange('')
    setQuery('')
    setOpen(true)
  }

  const widthClass = className ? className : 'w-[220px]'

  return (
    <div ref={wrapperRef} className={`relative inline-flex min-w-0 max-w-full ${widthClass}`}>
      <div className="inline-flex w-full overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900">
        <span className="flex shrink-0 items-center border-r border-slate-300 bg-slate-50 px-2.5 text-xs font-semibold text-slate-900 sm:px-3 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {label}
        </span>
        <div className={`flex min-w-0 flex-1 items-center ${value ? 'bg-white dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent px-2.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 sm:px-3 dark:text-slate-100"
            value={query}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={event => {
              setQuery(event.target.value)
              if (value) onChange('')
              setOpen(true)
            }}
          />
          {query && (
            <button
              type="button"
              className="px-2 text-sm font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              onClick={clearSelection}
              title="Clear"
            >
              x
            </button>
          )}
          <button
            type="button"
            className="flex h-full items-center border-l border-slate-300 px-2 text-slate-500 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300"
            onClick={() => setOpen(current => !current)}
            title="Open options"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            className="block w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50 sm:px-4 dark:text-slate-200 dark:hover:bg-sky-400/10"
            onMouseDown={event => {
              event.preventDefault()
              onChange('')
              setQuery('')
              setOpen(false)
            }}
          >
            All
          </button>
          {filtered.map(option => (
            <button
              key={option.value}
              type="button"
              className={`block w-full break-words px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50 sm:px-4 dark:text-slate-200 dark:hover:bg-sky-400/10 ${
                option.value === value ? 'bg-blue-100 font-semibold text-blue-900 dark:bg-sky-400/20 dark:text-sky-100' : ''
              }`}
              onMouseDown={event => {
                event.preventDefault()
                onChange(option.value)
                setQuery(option.label)
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No branches found</div>
          )}
        </div>
      )}
    </div>
  )
}
