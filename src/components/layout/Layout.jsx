import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Breadcrumbs from '../shared/Breadcrumbs'
import { useUIStore } from '../../store/uiStore'
import Toasts from '../shared/Toasts'

export default function Layout() {
  const { sidebarOpen, initDarkMode } = useUIStore()

  useEffect(() => {
    initDarkMode()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#06111f]">
      <Sidebar />
      <div
        className="transition-all duration-300 flex flex-col min-h-screen"
        style={{ marginLeft: sidebarOpen ? '264px' : '0' }}
      >
        <TopBar />
        <main className="flex-1 p-6">
          <Breadcrumbs />
          <Outlet />
        </main>
        <Toasts />
      </div>
    </div>
  )
}
