import { Navigate, Outlet } from "react-router";

export function UserLayout() {
  const token = localStorage.getItem("userToken");
  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <Outlet />
    </div>
  );
}
