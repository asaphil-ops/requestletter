import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
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
import SendEmailModal from './components/SendEmailModal'

import Directory from './pages/Directory'
import Users from './pages/Users'
import AuditLogs from './pages/AuditLogs'
import Settings from './pages/Settings'
import BulkUpload from './pages/BulkUpload'
import EmbeddedPage from './pages/EmbeddedPage'
import CFOOBudget from './pages/CFOOBudget'
import BudgetPage from './pages/BudgetPage'
import PublicTracker from './pages/PublicTracker'
import useRealtime from './hooks/useRealtime'
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuthStore()
  useRealtime()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/tracker" element={<PublicTracker />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="requests" element={<Requests />} />
        <Route path="sbar" element={<Sbar />} />
        <Route path="it-expenses" element={<ITExpenses />} />
        <Route path="at-expenses" element={<ATExpenses />} />
        <Route path="comms-expenses" element={<CommsExpenses />} />
        <Route path="cfoo-budget" element={<CFOOBudget />} />
        
        <Route path="cost-center/initiatives" element={<InitiativesExpenses />} />
        <Route path="cost-center/cfoo" element={<CfooExpenses />} />
        <Route path="cost-center/other" element={<OtherCostCenterExpenses />} />
        <Route path="data-management" element={<DataManagement />} />
        <Route path="employee-list" element={<EmployeeList />} />
        <Route path="send-email" element={<SendEmailModal />} />

        <Route path="directory" element={<Directory />} />
        <Route path="bulk-upload" element={<ProtectedRoute adminOnly><BulkUpload /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
        <Route path="audit-logs" element={<ProtectedRoute adminOnly><AuditLogs /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
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
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
