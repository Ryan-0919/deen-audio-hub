export type AdminConsoleMode = "admin" | "review";
export type AdminRole = "super_admin" | "operations_admin" | "user_admin" | "review_admin";

type AdminSessionKeys = {
  token: string;
  id: string;
  account: string;
  role: string;
  loginPath: string;
  homePath: string;
};

const ADMIN_SESSION_KEYS: Record<AdminConsoleMode, AdminSessionKeys> = {
  admin: {
    token: "adminToken",
    id: "adminId",
    account: "adminAccount",
    role: "adminRole",
    loginPath: "/admin/login",
    homePath: "/admin/dashboard",
  },
  review: {
    token: "reviewAdminToken",
    id: "reviewAdminId",
    account: "reviewAdminAccount",
    role: "reviewAdminRole",
    loginPath: "/adminpg/login",
    homePath: "/adminpg/papers",
  },
};

export const getAdminConsoleModeFromPath = (pathname: string): AdminConsoleMode =>
  pathname.startsWith("/adminpg") || pathname.startsWith("/review") ? "review" : "admin";

export const getAdminConsoleMode = (): AdminConsoleMode =>
  typeof window === "undefined" ? "admin" : getAdminConsoleModeFromPath(window.location.pathname);

export const isAdminConsolePath = (pathname: string) =>
  pathname.startsWith("/admin") || pathname.startsWith("/adminpg") || pathname.startsWith("/review");

export const getAdminSessionKeys = (mode: AdminConsoleMode = getAdminConsoleMode()) => ADMIN_SESSION_KEYS[mode];

export const getAdminTokenForMode = (mode: AdminConsoleMode = getAdminConsoleMode()) =>
  localStorage.getItem(getAdminSessionKeys(mode).token) ?? "";

export const getAdminIdForMode = (mode: AdminConsoleMode = getAdminConsoleMode()) =>
  localStorage.getItem(getAdminSessionKeys(mode).id) ?? "";

export const getAdminAccountForMode = (mode: AdminConsoleMode = getAdminConsoleMode()) =>
  localStorage.getItem(getAdminSessionKeys(mode).account) ?? "";

export const getAdminRoleForMode = (mode: AdminConsoleMode = getAdminConsoleMode()) =>
  localStorage.getItem(getAdminSessionKeys(mode).role) ?? "";

export const isAdminConsoleRole = (role: string | null | undefined): role is Exclude<AdminRole, "review_admin"> =>
  role === "super_admin" || role === "operations_admin" || role === "user_admin";

export const isReviewConsoleRole = (role: string | null | undefined): role is Extract<AdminRole, "super_admin" | "review_admin"> =>
  role === "super_admin" || role === "review_admin";

export const getAdminHomePathForRole = (role: string | null | undefined) => {
  if (role === "operations_admin") return "/admin/courses";
  if (role === "user_admin") return "/admin/users";
  if (role === "review_admin") return "/adminpg/papers";
  return "/admin/dashboard";
};

export const getReviewHomePathForRole = (_role: string | null | undefined) => "/adminpg/papers";

export const setAdminSessionForMode = (
  mode: AdminConsoleMode,
  payload: { token: string; admin: { id: string; account: string; role?: string } },
) => {
  const keys = getAdminSessionKeys(mode);
  localStorage.setItem(keys.token, payload.token);
  localStorage.setItem(keys.id, payload.admin.id);
  localStorage.setItem(keys.account, payload.admin.account);
  localStorage.setItem(keys.role, payload.admin.role ?? "");
};

export const clearAdminSessionForMode = (mode: AdminConsoleMode = getAdminConsoleMode()) => {
  const keys = getAdminSessionKeys(mode);
  localStorage.removeItem(keys.token);
  localStorage.removeItem(keys.id);
  localStorage.removeItem(keys.account);
  localStorage.removeItem(keys.role);
};
