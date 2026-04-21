import { LogOut, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { AppLogo } from "../../components/branding/AppLogo";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { mockApi } from "../../lib/mockData";
import { clearUserSession, getUserDeviceKey, getUserId, getUserPhone } from "../../lib/user-session";

export function UserMe() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayPhone = getUserPhone() || "已登录用户";
  const deviceKey = getUserDeviceKey();

  const handleLogout = async () => {
    if (loggingOut) return;

    const userId = getUserId();

    try {
      setLoggingOut(true);
      if (userId) {
        await mockApi.logout(userId, deviceKey || undefined);
      }
    } catch {
      // Ignore logout request failures and always clear local session.
    } finally {
      clearUserSession();
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4f5f7_48%,#eceff3_100%)]">
      <div className="sticky top-0 z-20 border-b border-white/70 bg-white/72 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex h-14 max-w-sm items-center px-4">
          <div className="flex w-[72px] justify-start">
            <AppLogo compact />
          </div>
          <h1 className="flex-1 text-center text-base font-semibold tracking-[0.02em] text-slate-900">我的</h1>
          <div className="flex w-[72px] justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="rounded-full px-3 text-slate-600 hover:bg-black/[0.04]"
            >
              <LogOut className="size-4" />
              {loggingOut ? "退出中..." : "退出"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8 xl:px-8">
        <div className="mt-0 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_320px]">
          <section className="overflow-hidden rounded-[34px] border border-white/80 bg-white/78 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
            <div className="px-5 pb-5 pt-6 md:px-7 md:pb-7 md:pt-7">
              <div className="flex items-start gap-4 md:gap-5">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-[26px] bg-[linear-gradient(180deg,#111827_0%,#374151_100%)] text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)] md:size-20">
                  <UserRound className="size-8 md:size-10" />
                </div>

                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[22px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[30px]">{displayPhone}</p>
                    <Badge variant="secondary" className="rounded-full bg-emerald-50 text-emerald-700">
                      已登录
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500 md:max-w-2xl md:text-base md:leading-8">
                    商城暂未开放，当前页面仅保留账号与设备信息。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="overflow-hidden rounded-[30px] border border-white/80 bg-white/78 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <div className="px-5 py-5 md:px-6 md:py-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Smartphone className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">当前设备</p>
                    <p className="mt-1 break-all text-xs leading-5 text-slate-500">{deviceKey || "未记录设备标识"}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[30px] border border-white/80 bg-white/78 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <div className="px-5 py-5 md:px-6 md:py-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">安全说明</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">退出登录后会清除当前设备本地会话，下次访问需要重新校验身份。</p>
                  </div>
                </div>
              </div>
            </section>

            <Button
              variant="outline"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="hidden h-12 w-full rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:inline-flex"
            >
              <LogOut className="mr-2 size-4" />
              {loggingOut ? "退出中..." : "退出登录"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
