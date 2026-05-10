import { ArrowLeft, MonitorSmartphone, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";

const MOBILE_BREAKPOINT = 768;
const PHONE_DEVICE_RE = /Android.+Mobile|iPhone|iPod|Windows Phone|Mobile/i;
const TOUCH_DEVICE_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

const detectMockExamMobileDevice = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  return PHONE_DEVICE_RE.test(userAgent) || (window.innerWidth < MOBILE_BREAKPOINT && TOUCH_DEVICE_RE.test(userAgent));
};

export function useMockExamDesktopGuard() {
  const [blocked, setBlocked] = useState(() => detectMockExamMobileDevice());

  useEffect(() => {
    const syncBlockedState = () => {
      setBlocked(detectMockExamMobileDevice());
    };

    syncBlockedState();
    window.addEventListener("resize", syncBlockedState);
    window.addEventListener("orientationchange", syncBlockedState);

    return () => {
      window.removeEventListener("resize", syncBlockedState);
      window.removeEventListener("orientationchange", syncBlockedState);
    };
  }, []);

  return blocked;
}

export function MockExamDesktopNotice() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[calc(100vh-5.5rem)] overflow-hidden bg-[#040816] px-4 py-5 text-white md:min-h-full md:px-6 md:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.2),transparent_24%),radial-gradient(circle_at_82%_14%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_50%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[22%] h-[15rem] w-[15rem] -translate-x-1/2 rounded-full bg-[#2e8fff]/18 blur-[96px]" />
      <div className="pointer-events-none absolute right-[-3rem] top-20 h-40 w-40 rounded-full bg-[#7b61ff]/16 blur-[110px]" />
      <div className="pointer-events-none absolute inset-x-6 bottom-[-5rem] h-[12rem] rounded-full bg-white/10 blur-3xl mix-blend-screen" />

      <div className="relative mx-auto flex min-h-[calc(100vh-10rem)] max-w-md items-center md:max-w-3xl md:min-h-0">
        <div className="w-full overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-[20px]">
          <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)]" />

          <div className="relative p-5 md:p-8">
            <div className="absolute left-8 top-16 h-20 w-20 rounded-full bg-[#1dc7b8]/12 blur-3xl" />

            <div className="relative flex items-center justify-between gap-3">
              <AppLogo compact className="[&_p:first-of-type]:text-white [&_p:last-of-type]:text-white/40" />
              <div className="inline-flex items-center gap-2 rounded-full border border-[#8fd6ff]/20 bg-[#8fd6ff]/10 px-3 py-1.5 text-[11px] font-medium tracking-[0.22em] text-[#9bdcff]">
                <Sparkles className="size-3.5" />
                仅支持电脑端
              </div>
            </div>

            <div className="relative mt-6 rounded-[26px] border border-white/10 bg-black/16 p-4 md:mt-7 md:p-5">
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] text-[#8fd6ff] shadow-[0_18px_40px_rgba(8,18,36,0.28)]">
                  <MonitorSmartphone className="size-7" />
                </div>

                <div className="min-w-0 flex-1">
                  <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.05em] text-white md:text-[34px]">
                    请使用电脑打开机考系统
                  </h1>
                  <p className="mt-3 text-sm leading-7 text-white/64 md:text-[15px]">
                    当前机考答题、法条联动和批改查看暂不支持手机端使用。请切换到电脑浏览器后，再进入客观题或主观题考试流程。
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/38">使用建议</div>
                  <div className="mt-2 text-sm leading-6 text-white/76">
                    建议使用 Chrome、Edge 等现代浏览器，避免影响登录、考试须知、作答和交卷流程。
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/38">进入方式</div>
                  <div className="mt-2 text-sm leading-6 text-white/76">
                    回到课程首页后可继续学习课程内容；换到电脑端登录后，再进入机考试卷列表开始答题。
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  className="h-12 rounded-full border border-white/12 bg-white px-5 text-slate-950 shadow-[0_18px_40px_rgba(255,255,255,0.14)] hover:bg-slate-100"
                  onClick={() => navigate("/user/courses")}
                >
                  <ArrowLeft className="size-4" />
                  返回课程页
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
