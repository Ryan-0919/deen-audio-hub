export const ADMIN_ROLE_VALUES = ["super_admin", "operations_admin", "user_admin", "review_admin"];

export const hasAdminRoleAccess = (role, allowedRoles = []) => allowedRoles.includes(role);

export const normalizeAdminRole = (value, fallback = "operations_admin") => {
  const normalized = `${value ?? ""}`.trim();
  return ADMIN_ROLE_VALUES.includes(normalized) ? normalized : fallback;
};
