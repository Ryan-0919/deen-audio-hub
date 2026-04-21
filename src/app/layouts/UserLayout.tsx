import { BookMarked, Scale, UserRound } from "lucide-react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router";
import { AppLogo } from "../components/branding/AppLogo";
import { cn } from "../components/ui/utils";
import { getUserPhone, getUserToken } from "../lib/user-session";

const navigation = [
  {
    label: "课程",
    to: "/user/courses",
    icon: BookMarked,
    isActive: (pathname: string) =>
      pathname.startsWith("/user/courses") || pathname.startsWith("/user/course/") || pathname.startsWith("/user/player/"),
  },
  {
    label: "法条",
    to: "/user/laws",
    icon: Scale,
    isActive: (pathname: string) => pathname.startsWith("/user/laws"),
  },
  {
    label: "我的",
    to: "/user/me",
    icon: UserRound,
    isActive: (pathname: string) => pathname.startsWith("/user/me"),
  },
];

export function UserLayout() {
  const token = getUserToken();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  const hideNavigation = location.pathname.startsWith("/user/player/");
  const displayPhone = getUserPhone() || "已登录用户";

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      {!hideNavigation ? (
        <header className="sticky top-0 z-40 hidden border-b border-slate-200/80 bg-white/92 backdrop-blur md:block">
          <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-6 xl:px-8">
            <AppLogo />

            <nav className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 p-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = item.isActive(location.pathname);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="ml-auto inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
              <span className="max-w-[220px] truncate">{displayPhone}</span>
            </div>
          </div>
        </header>
      ) : null}

      <div
        className={cn(
          !hideNavigation && "pb-20 md:pb-0",
          hideNavigation ? "min-h-screen" : "min-h-[calc(100vh-80px)] md:min-h-[calc(100vh-72px)]",
        )}
      >
        <Outlet />
      </div>

      {!hideNavigation ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur md:hidden">
          <div className="mx-auto grid h-16 max-w-sm grid-cols-3 px-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = item.isActive(location.pathname);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition-colors",
                    active ? "text-blue-700" : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  <Icon className={cn("size-5", active && "text-blue-700")} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
