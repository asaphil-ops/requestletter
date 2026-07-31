import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Breadcrumbs from '../shared/Breadcrumbs'
import { useUIStore } from '../../store/uiStore'
import Toasts from '../shared/Toasts'
import SendEmailModal from '../SendEmailModal'

export default function Layout() {
  const { sidebarOpen, initDarkMode, sendEmailDraft, closeSendEmailModal } = useUIStore()

  useEffect(() => {
    initDarkMode()
  }, [])

  return (
    <div className="app-shell min-h-screen bg-gray-50 dark:bg-[#06111f]">
      <Sidebar />
      <div
        className={`app-content transition-all duration-300 flex flex-col min-h-screen ${sidebarOpen ? 'app-content--sidebar' : ''}`}
      >
        <TopBar />
        <main className="app-main flex-1">
          <Breadcrumbs />
          <Outlet />
        </main>
        <Toasts />
      </div>

      {/* Global Send Email Modal */}
      {sendEmailDraft && (
        <SendEmailModal draft={sendEmailDraft} onClose={closeSendEmailModal} />
      )}
    </div>
  )
}
