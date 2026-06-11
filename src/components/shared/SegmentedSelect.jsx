export default function SegmentedSelect({ label, value, onChange, children, className = '' }) {
  const selectedBg = value ? 'bg-white dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800'

  return (
    <label className={`inline-flex w-[180px] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <span className="flex shrink-0 items-center border-r border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
        {label}
      </span>
      <select
        className={`min-w-0 flex-1 appearance-auto border-0 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:text-slate-100 dark:focus:bg-slate-900 ${selectedBg}`}
        value={value}
        onChange={onChange}
      >
        {children}
      </select>
    </label>
  )
}
