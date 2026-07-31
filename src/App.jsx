import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import SendEmail from './pages/SendEmail'

import Directory from './pages/Directory'
import Users from './pages/Users'
import AuditLogs from './pages/AuditLogs'
import Settings from './pages/Settings'
import BulkUpload from './pages/BulkUpload'
import EmbeddedPage from './pages/EmbeddedPage'
import PublicTracker from './pages/PublicTracker'
import { permissionsForRole } from './lib/permissions'
import useRealtime from './hooks/useRealtime'
import usePresence from './hooks/usePresence'
import Swal from 'sweetalert2'
import { lazy, Suspense } from 'react'
import { useSettings } from './hooks/useAccounts'

const LazyDashboard = lazy(() => import('./pages/Dashboard'))
const LazyRequests = lazy(() => import('./pages/Requests'))
const LazySbar = lazy(() => import('./pages/Sbar'))
const LazyITExpenses = lazy(() => import('./pages/ITExpenses'))
const LazyATExpenses = lazy(() => import('./pages/ATExpenses'))
const LazyGeneratorExpenses = lazy(() => import('./pages/GeneratorExpenses'))
const LazyCommsExpenses = lazy(() => import('./pages/CommsExpenses'))
const LazyInitiativesExpenses = lazy(() => import('./pages/InitiativesExpenses'))
const LazyCfooExpenses = lazy(() => import('./pages/CfooExpenses'))
const LazyOtherCostCenterExpenses = lazy(() => import('./pages/OtherCostCenterExpenses'))
const LazyDataManagement = lazy(() => import('./pages/DataManagement'))
const LazyEmployeeList = lazy(() => import('./pages/EmployeeList'))
const LazyReports = lazy(() => import('./pages/Reports'))
const LazyCFOOBudget = lazy(() => import('./pages/CFOOBudget'))
const LazyComplianceCertificates = lazy(() => import('./pages/ComplianceCertificates'))
const LazyOnlineStaffList = lazy(() => import('./pages/OnlineStaffList'))

function RouteLoader() {
  return <div className="flex min-h-[45vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" /></div>
}

function ModuleRoute({ modulePath, children }) {
  const { data: settings, isLoading } = useSettings()
  if (isLoading) return <RouteLoader />
  if ((settings?.hiddenModules || []).includes(modulePath)) return <Navigate to="/" replace />
  return children
}

const guarded = (path, element) => <ModuleRoute modulePath={path}>{element}</ModuleRoute>
function ProtectedRoute({ children, adminOnly = false, superAdminOnly = false }) {
  const { user, isAdmin, isSuperAdmin } = useAuthStore()
  const navigate = useNavigate()
  if (!user) return <Navigate to="/login" replace />
  if (superAdminOnly && !isSuperAdmin) {
    Swal.fire({
      icon: 'error',
      title: 'Access Denied',
      text: 'This page is restricted to Super Admin only.',
      confirmButtonText: 'OK',
      confirmButtonColor: '#2563eb',
      position: 'center'
    }).then(() => {
      navigate('/')
    })
    return null
  }
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user, canViewReports } = useAuthStore()
  const canOpenReports = canViewReports || permissionsForRole(user?.role).canViewReports
  useRealtime()
  usePresence()

  return (
    <Suspense fallback={<RouteLoader />}>
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/tracker" element={guarded('/tracker', <PublicTracker />)} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<LazyDashboard />} />
        <Route path="online-list" element={guarded('/online-list', <LazyOnlineStaffList />)} />
        <Route path="requests" element={guarded('/requests', <LazyRequests />)} />
        <Route path="sbar" element={guarded('/sbar', <LazySbar />)} />
        <Route path="it-expenses" element={guarded('/it-expenses', <LazyITExpenses />)} />
        <Route path="at-expenses" element={guarded('/at-expenses', <LazyATExpenses />)} />
        <Route path="generator-expenses" element={guarded('/generator-expenses', <LazyGeneratorExpenses />)} />
        <Route path="comms-expenses" element={guarded('/comms-expenses', <LazyCommsExpenses />)} />
        <Route path="compliance/cor-dole" element={guarded('/compliance/cor-dole', <LazyComplianceCertificates />)} />
        <Route path="cfoo-budget" element={guarded('/cfoo-budget', <LazyCFOOBudget />)} />
        
        <Route path="cost-center/initiatives" element={guarded('/cost-center/initiatives', <LazyInitiativesExpenses />)} />
        <Route path="cost-center/cfoo" element={guarded('/cost-center/cfoo', <LazyCfooExpenses />)} />
        <Route path="cost-center/other" element={guarded('/cost-center/other', <LazyOtherCostCenterExpenses />)} />
        <Route path="data-management" element={guarded('/data-management', <LazyDataManagement />)} />
        <Route path="employee-list" element={guarded('/employee-list', <LazyEmployeeList />)} />
        <Route path="send-email" element={<SendEmail />} />
        <Route path="reports" element={canOpenReports ? guarded('/reports', <LazyReports />) : <Navigate to="/" replace />} />

        <Route path="directory" element={<Directory />} />
        <Route path="bulk-upload" element={<ProtectedRoute adminOnly><BulkUpload /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute superAdminOnly><Users /></ProtectedRoute>} />
        <Route path="audit-logs" element={<ProtectedRoute superAdminOnly><AuditLogs /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
        <Route path="circular" element={guarded('/circular', <EmbeddedPage type="circular" />)} />
        <Route path="lantaw" element={guarded('/lantaw', <EmbeddedPage type="lantaw" />)} />
        <Route path="cashflow" element={guarded('/cashflow', <EmbeddedPage type="cashflow" />)} />
        <Route path="budget" element={guarded('/budget', <EmbeddedPage type="budget" />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppRoutes />
    </BrowserRouter>
  )
}
