export const ATTENDANCE_ROLES = new Set([
  "Project Admin",
  "Supervisor",
  "Safety Officer",
  "Attendance Admin",
  "Project Manager",
]);

export const INVITE_ROLES = new Set([
  "Supervisor",
  "Safety Officer",
  "Attendance Admin",
  "Project Manager",
  "Viewer",
]);

export function canRecordAttendance(role: string) {
  return ATTENDANCE_ROLES.has(role);
}

export function canManageWorkers(role: string) {
  return role === "Project Admin";
}

export function canManageUsers(role: string) {
  return role === "Project Admin";
}

export function canViewReports(role: string) {
  return role === "Project Admin";
}

/** Supervisors and Admins can browse attendance by date (not only today). */
export function canBrowseAttendanceHistory(role: string) {
  return canRecordAttendance(role) || canViewReports(role) || role === "Viewer";
}
