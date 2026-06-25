import { ADMIN_ROLES, SUPER_ADMIN_ROLES, CAN_UPLOAD_ROLES } from './utils'

export const PERMISSIONS = {
  dashboard: { view: ['Staff', 'Governance', 'Ops Finance', 'Finance', 'Planning', 'Admin', 'Super Admin'] },
  reports: { view: ['Ops Finance', 'Finance', 'Planning', 'Admin', 'Super Admin'], export: ['Ops Finance', 'Finance', 'Planning', 'Admin', 'Super Admin'] },
  requests: { create: CAN_UPLOAD_ROLES, update: CAN_UPLOAD_ROLES, upload: CAN_UPLOAD_ROLES, check: ['Ops Finance', ...ADMIN_ROLES], sendEmail: CAN_UPLOAD_ROLES, delete: ADMIN_ROLES },
  sbar: { create: CAN_UPLOAD_ROLES, update: CAN_UPLOAD_ROLES, upload: CAN_UPLOAD_ROLES, check: ['Ops Finance', ...ADMIN_ROLES], approve: ['Finance', ...ADMIN_ROLES], sendEmail: CAN_UPLOAD_ROLES, delete: ADMIN_ROLES },
  expenses: { create: CAN_UPLOAD_ROLES, update: CAN_UPLOAD_ROLES, upload: CAN_UPLOAD_ROLES, check: ['Ops Finance', ...ADMIN_ROLES], approve: ['Finance', ...ADMIN_ROLES], sendEmail: CAN_UPLOAD_ROLES, delete: ADMIN_ROLES },
  costCenter: { create: CAN_UPLOAD_ROLES, update: CAN_UPLOAD_ROLES, upload: CAN_UPLOAD_ROLES, check: ['Ops Finance', ...ADMIN_ROLES], approve: ['Finance', ...ADMIN_ROLES], sendEmail: CAN_UPLOAD_ROLES, delete: ADMIN_ROLES },
  admin: { manage: ADMIN_ROLES },
  superAdmin: { 
    manageUsers: SUPER_ADMIN_ROLES,
    manageSettings: SUPER_ADMIN_ROLES,
    manageEmployees: SUPER_ADMIN_ROLES,
    manageData: SUPER_ADMIN_ROLES,
    forceDelete: SUPER_ADMIN_ROLES,
  }
}

export function can(role, module, action) {
  const allowed = PERMISSIONS[module]?.[action] || []
  return allowed.includes(role)
}

export function permissionsForRole(role) {
  return {
    isAdmin: ADMIN_ROLES.includes(role),
    isSuperAdmin: SUPER_ADMIN_ROLES.includes(role),
    canUpload: can(role, 'requests', 'create'),
    canCheck: can(role, 'requests', 'check'),
    canApprove: can(role, 'expenses', 'approve'),
    canViewReports: can(role, 'reports', 'view'),
    canExportReports: can(role, 'reports', 'export'),
    canManageUsers: can(role, 'superAdmin', 'manageUsers'),
    canManageSettings: can(role, 'superAdmin', 'manageSettings'),
    canManageEmployees: can(role, 'superAdmin', 'manageEmployees'),
    canManageData: can(role, 'superAdmin', 'manageData'),
    canForceDelete: can(role, 'superAdmin', 'forceDelete'),
  }
}