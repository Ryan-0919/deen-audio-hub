import {
  BookOpen,
  Bot,
  FileText,
  FolderOpen,
  History,
  ImageIcon,
  Keyboard,
  LogOut,
  Music2,
  PackageSearch,
  Scale,
  Settings,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { Link, Navigate, Outlet, useLocation } from "react-router";
import { AppLogo } from "../components/branding/AppLogo";
import { Button } from "../components/ui/button";
import { cn } from "../components/ui/utils";
import { clearAdminSessionForMode, getAdminAccountForMode, getAdminHomePathForRole, getAdminRoleForMode, getAdminTokenForMode } from "../lib/admin-session";

const navigationGroups = [
  {
    title: "基础管理",
    items: [
      { name: "管理员账号", href: "/admin/admins", icon: ShieldCheck },
      { name: "用户管理", href: "/admin/users", icon: Users },
      { name: "音频课程管理", href: "/admin/courses?type=audio", icon: BookOpen },
      { name: "视频课程管理", href: "/admin/courses?type=video", icon: Video },
      { name: "音频课程库", href: "/admin/library", icon: Music2 },
      { name: "视频课程库", href: "/admin/video-library", icon: Video },
      { name: "法条检索", href: "/admin/laws", icon: Scale },
    ],
  },
  {
    title: "机考系统",
    items: [
      { name: "机考题库", href: "/admin/mock-exams/question-bank", icon: FolderOpen },
      { name: "机考试卷", href: "/admin/mock-exams/papers", icon: FileText },
      { name: "启动页设置", href: "/admin/mock-exams/launch-settings", icon: Settings },
      { name: "AI批改设置", href: "/admin/mock-exams/ai-review-settings", icon: Bot },
      { name: "打字练习", href: "/admin/typing-practice", icon: Keyboard },
    ],
  },
  {
    title: "门户设置",
    items: [
      { name: "门户内容设置", href: "/admin/settings", icon: Settings },
      { name: "门户图片设置", href: "/admin/image-settings", icon: ImageIcon },
    ],
  },
  {
    title: "系统",
    items: [{ name: "系统日志", href: "/admin/logs", icon: History }],
  },
];

const filterNavigationByRole = (role: string) => {
  if (role === "user_admin") {
    return navigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.href === "/admin/users"),
      }))
      .filter((group) => group.items.length > 0);
  }

  return navigationGroups;
};

const isNavActive = (pathname: string, href: string) => {
  if (href.includes("?")) {
    const [pathOnly, queryString] = href.split("?");
    const current = new URLSearchParams(window.location.search);
    const expected = new URLSearchParams(queryString);
    if (!pathname.startsWith(pathOnly)) return false;
    return Array.from(expected.entries()).every(([key, value]) => current.get(key) === value);
  }

  return pathname.startsWith(href);
};

export function AdminLayout() {
  const location = useLocation();
  const token = getAdminTokenForMode("admin");
  const role = getAdminRoleForMode("admin");

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  if (role === "review_admin") {
    return <Navigate to="/adminpg/login" replace />;
  }

  const visibleNavigationGroups = filterNavigationByRole(role);
  const visibleNavigationItems = visibleNavigationGroups.flatMap((group) => group.items);

  if (visibleNavigationItems.length === 0) {
    return <Navigate to="/admin/login" replace />;
  }

  const currentNav = [...visibleNavigationItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => isNavActive(location.pathname, item.href));

  if (!currentNav && !location.pathname.startsWith("/admin/login")) {
    return <Navigate to={getAdminHomePathForRole(role)} replace />;
  }

  const account = getAdminAccountForMode("admin") || "运营管理员";

  const handleLogout = () => {
    clearAdminSessionForMode("admin");
    window.location.href = "/admin/login";
  };

  return (
    <div className="flex h-screen bg-[#f6f8fb] text-slate-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-6">
          <AppLogo />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">后台管理</h1>
          <p className="mt-2 text-sm text-slate-500">课程、题库、试卷、门户与系统运营工作台</p>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {visibleNavigationGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group.title}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = isNavActive(location.pathname, item.href);

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
            <h2 className="text-lg font-semibold text-slate-900">{currentNav?.name ?? "后台管理"}</h2>
            <p className="text-sm text-slate-500">得恩法考课程系统</p>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
