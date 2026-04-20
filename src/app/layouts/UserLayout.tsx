import { BookMarked, UserRound } from "lucide-react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router";
import { cn } from "../components/ui/utils";
import { getUserToken } from "../lib/user-session";

const navigation = [
  {
    label: "课程",
    to: "/user/courses",
    icon: BookMarked,
    isActive: (pathname: string) =>
      pathname.startsWith("/user/courses") || pathname.startsWith("/user/course/") || pathname.startsWith("/user/player/"),
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

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <div className={cn(!hideNavigation && "pb-20")}>
        <Outlet />
      </div>

      {!hideNavigation ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur">
          <div className="mx-auto grid h-16 max-w-sm grid-cols-2 px-2">
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
