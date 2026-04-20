import { BookOpen, History, ImageIcon, LogOut, Music2, Settings, ShieldCheck, Users } from "lucide-react";
import { Link, Navigate, Outlet, useLocation } from "react-router";
import { AppLogo } from "../components/branding/AppLogo";
import { Button } from "../components/ui/button";
import { cn } from "../components/ui/utils";

const navigation = [
  { name: "管理员账号", href: "/admin/admins", icon: ShieldCheck },
  { name: "用户管理", href: "/admin/users", icon: Users },
  { name: "课程管理", href: "/admin/courses", icon: BookOpen },
  { name: "音频库", href: "/admin/library", icon: Music2 },
  { name: "系统日志", href: "/admin/logs", icon: History },
  { name: "系统配置", href: "/admin/settings", icon: Settings },
  { name: "系统图片配置", href: "/admin/image-settings", icon: ImageIcon },
];

export function AdminLayout() {
  const location = useLocation();
  const token = localStorage.getItem("adminToken");

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  const currentNav = navigation.find((item) => location.pathname.startsWith(item.href));
  const account = localStorage.getItem("adminAccount") ?? "运营管理员";

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminId");
    localStorage.removeItem("adminAccount");
    window.location.href = "/admin/login";
  };

  return (
    <div className="flex h-screen bg-[#f6f8fb] text-slate-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-6">
          <AppLogo />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">后台管理</h1>
          <p className="mt-2 text-sm text-slate-500">课程、音频与系统配置工作台</p>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <Icon className="size-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">当前账号</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{account}</p>
          </div>
          <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 size-4" />
            退出登录
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{currentNav?.name ?? "后台管理"}</h2>
            <p className="text-sm text-slate-500">得恩法考音频系统</p>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
