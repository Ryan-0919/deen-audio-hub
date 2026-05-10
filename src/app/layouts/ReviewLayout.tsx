import { FileText, LogOut, PackageSearch } from "lucide-react";
import { Link, Navigate, Outlet, useLocation } from "react-router";
import { AppLogo } from "../components/branding/AppLogo";
import { Button } from "../components/ui/button";
import { cn } from "../components/ui/utils";
import { clearAdminSessionForMode, getAdminAccountForMode, getAdminRoleForMode, getAdminSessionKeys } from "../lib/admin-session";

const navigationGroups = [
  {
    title: "批改中心",
    items: [
      { name: "工作台", href: "/adminpg/dashboard", icon: FileText },
      { name: "试卷批改", href: "/adminpg/papers", icon: FileText },
    ],
  },
];

const navigationItems = navigationGroups.flatMap((group) => group.items);

export function ReviewLayout() {
  const location = useLocation();
  const token = getAdminSessionKeys("review").token ? localStorage.getItem(getAdminSessionKeys("review").token) : "";
  const role = getAdminRoleForMode("review");

  if (!token) {
    return <Navigate to="/adminpg/login" replace />;
  }

  if (role === "operations_admin" || role === "user_admin") {
    return <Navigate to="/admin/login" replace />;
  }

  const currentNav = [...navigationItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => location.pathname.startsWith(item.href));
  const account = getAdminAccountForMode("review") || "批改管理员";

  const handleLogout = () => {
    clearAdminSessionForMode("review");
    window.location.href = "/adminpg/login";
  };

  return (
    <div className="flex h-screen bg-[#f5f7fb] text-slate-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-6">
          <AppLogo />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">批改后台</h1>
          <p className="mt-2 text-sm text-slate-500">主观题 AI 批改、人工核对与发送工作台</p>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {navigationGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group.title}</div>
              {group.items.map((item) => {
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
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">当前账号</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
              <PackageSearch className="size-4 text-slate-500" />
              {account}
            </p>
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
            <h2 className="text-lg font-semibold text-slate-900">{currentNav?.name ?? "批改后台"}</h2>
            <p className="text-sm text-slate-500">得恩法考独立阅卷中心</p>
          </div>
          <Link to="/admin" className="text-sm text-slate-500 transition-colors hover:text-slate-900">
            返回总后台
          </Link>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
