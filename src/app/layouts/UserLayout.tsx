import { Navigate, Outlet } from "react-router";
import { getUserToken } from "../lib/user-session";

export function UserLayout() {
  const token = getUserToken();
  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <Outlet />
    </div>
  );
}
