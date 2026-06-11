import { useState, useEffect } from 'react'

const EMBEDS = {
  circular: {
    title: 'Circular & Admin Order',
    subtitle: 'Company circulars and administrative orders',
    src: 'https://script.google.com/a/macros/asaphil.org/s/AKfycbxLbNu8p4I1-rYn0PV7eBkwIWcFZsIz9VCdOT5OYnb4DJ2LnAexfGvu57oECB97a9XO/exec',
  },
  lantaw: {
    title: 'Lantaw',
    subtitle: 'Analytics Dashboard',
    src: 'https://lookerstudio.google.com/embed/reporting/fbce2779-f01c-48ac-8524-d96adfe9cc02/page/p_vkzggxhtvd',
  },
  cashflow: {
    title: 'Cash Flow',
    subtitle: 'Cash flow monitoring dashboard',
    src: 'https://lookerstudio.google.com/embed/reporting/57b63725-ef78-4751-9161-c538787da539',
  },
  budget: {
    title: 'Budget Monitoring',
    subtitle: 'Budget allocation and utilization',
    src: 'https://lookerstudio.google.com/embed/reporting/f9863dba-0d7f-4031-a793-2786bac64f81/page/p_mut4vqcpzd',
  },
}

export default function EmbeddedPage({ type }) {
  const [isLoading, setIsLoading] = useState(true)
  const embed = EMBEDS[type]

  // Reset loading state when switching between different embeds
  useEffect(() => {
    setIsLoading(true)
  }, [type])

  if (!embed) return null

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{embed.title}</h1>
          <p className="text-sm font-semibold text-gray-500">{embed.subtitle}</p>
        </div>
        <a
          href={embed.src}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1.5"
        >
          <i className="fas fa-external-link-alt" />Open in new tab
        </a>
      </div>

      <div className="card flex-1 overflow-hidden rounded-xl bg-white relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50/80 backdrop-blur-sm">
            <i className="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-4" />
            <div className="text-sm font-bold text-gray-700 animate-pulse">Loading Dashboard...</div>
            <div className="text-xs text-gray-500 mt-1">This may take a few seconds</div>
          </div>
        )}
        <iframe
          src={embed.src}
          title={embed.title}
          className={`w-full h-full min-h-[calc(100vh-220px)] border-0 transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          allow="clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  )
}