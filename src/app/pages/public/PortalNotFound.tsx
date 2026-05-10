import { ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";
import { getUserToken } from "../../lib/user-session";

export function PortalNotFound() {
  const navigate = useNavigate();
  const hasToken = Boolean(getUserToken());

  return (
    <div className="min-h-screen bg-[#07111d] px-4 py-6 text-white md:px-6 md:py-8 xl:px-8">
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-[#1b7cff]/18 blur-3xl" />
        <div className="absolute right-[-4rem] top-32 h-72 w-72 rounded-full bg-[#8b5cf6]/14 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-[28%] h-72 w-72 rounded-full bg-[#1dc7b8]/12 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_38%),linear-gradient(180deg,#07111d_0%,#081322_38%,#091827_72%,#0c1728_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,38,0.96),rgba(8,16,28,0.94))] shadow-[0_30px_90px_rgba(8,15,24,0.18)] md:rounded-[36px]">
          <div className="grid gap-6 p-5 md:gap-8 md:p-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div className="rounded-[24px] border border-white/10 bg-white/6 p-5 md:rounded-[30px] md:p-6">
              <AppLogo className="[&_p:first-of-type]:text-white [&_p:last-of-type]:text-white/45" />
              <div className="mt-6 text-4xl font-semibold tracking-[-0.06em] text-white md:mt-8 md:text-5xl">404</div>
              <div className="mt-4 text-[26px] font-semibold tracking-[-0.04em] text-white md:text-2xl">当前页面不存在</div>
              <div className="mt-4 text-sm leading-7 text-white/58">你访问的地址可能已失效，或内容尚未开放。可以返回门户首页继续查看公开信息，或直接进入学习中心。</div>
            </div>

            <div>
              <div className="text-sm uppercase tracking-[0.24em] text-white/42">建议操作</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button type="button" className="h-12 rounded-full bg-white text-slate-950 hover:bg-slate-100" onClick={() => navigate("/")}>
                  <Home className="mr-2 size-4" />
                  返回门户首页
                </Button>
                <Button type="button" variant="outline" className="h-12 rounded-full border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={() => navigate(hasToken ? "/user/courses" : "/login")}>
                  {hasToken ? "进入学习中心" : "立即登录"}
                </Button>
              </div>

              <Button type="button" variant="outline" className="mt-3 h-12 w-full rounded-full border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={() => navigate(-1)}>
                <ArrowLeft className="mr-2 size-4" />
                返回上一页
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
