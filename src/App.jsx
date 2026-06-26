import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ActionCenter from './pages/ActionCenter'
import Requests from './pages/Requests'
import Sbar from './pages/Sbar'
import ITExpenses from './pages/ITExpenses'
import ATExpenses from './pages/ATExpenses'
import CommsExpenses from './pages/CommsExpenses'
import InitiativesExpenses from './pages/InitiativesExpenses'
import CfooExpenses from './pages/CfooExpenses'
import OtherCostCenterExpenses from './pages/OtherCostCenterExpenses'
import DataManagement from './pages/DataManagement'
import EmployeeList from './pages/EmployeeList'
import SendEmail from './pages/SendEmail'

import Directory from './pages/Directory'
import Users from './pages/Users'
import AuditLogs from './pages/AuditLogs'
import Settings from './pages/Settings'
import BulkUpload from './pages/BulkUpload'
import Reports from './pages/Reports'
import EmbeddedPage from './pages/EmbeddedPage'
import CFOOBudget from './pages/CFOOBudget'
import BudgetPage from './pages/BudgetPage'
import PublicTracker from './pages/PublicTracker'
import ComplianceCertificates from './pages/ComplianceCertificates'
import OnlineStaffList from './pages/OnlineStaffList'
import { permissionsForRole } from './lib/permissions'
import useRealtime from './hooks/useRealtime'
import usePresence from './hooks/usePresence'
import Swal from 'sweetalert2'
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
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/tracker" element={<PublicTracker />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="online-list" element={<OnlineStaffList />} />
        <Route path="action-center" element={<ActionCenter />} />
        <Route path="requests" element={<Requests />} />
        <Route path="sbar" element={<Sbar />} />
        <Route path="it-expenses" element={<ITExpenses />} />
        <Route path="at-expenses" element={<ATExpenses />} />
        <Route path="comms-expenses" element={<CommsExpenses />} />
        <Route path="compliance/cor-dole" element={<ComplianceCertificates />} />
        <Route path="cfoo-budget" element={<CFOOBudget />} />
        
        <Route path="cost-center/initiatives" element={<InitiativesExpenses />} />
        <Route path="cost-center/cfoo" element={<CfooExpenses />} />
        <Route path="cost-center/other" element={<OtherCostCenterExpenses />} />
        <Route path="data-management" element={<DataManagement />} />
        <Route path="employee-list" element={<EmployeeList />} />
        <Route path="send-email" element={<SendEmail />} />
        <Route path="reports" element={canOpenReports ? <Reports /> : <Navigate to="/" replace />} />

        <Route path="directory" element={<Directory />} />
        <Route path="bulk-upload" element={<ProtectedRoute adminOnly><BulkUpload /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute superAdminOnly><Users /></ProtectedRoute>} />
        <Route path="audit-logs" element={<ProtectedRoute superAdminOnly><AuditLogs /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute superAdminOnly><Settings /></ProtectedRoute>} />
        <Route path="circular" element={<EmbeddedPage type="circular" />} />
        <Route path="lantaw" element={<EmbeddedPage type="lantaw" />} />
        <Route path="cashflow" element={<EmbeddedPage type="cashflow" />} />
        <Route path="budget" element={<EmbeddedPage type="budget" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
