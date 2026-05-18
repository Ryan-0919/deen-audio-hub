import { Eye, EyeOff, Headset, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppLogo } from "../../components/branding/AppLogo";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../components/ui/utils";
import { ApiRequestError, mockApi } from "../../lib/mockData";
import { ensureUserDeviceKey, getUserToken, saveUserSession } from "../../lib/user-session";

const DEVICE_LIMIT = 5;
const LOGIN_BACKGROUND_PARTICLES = [
  { left: "8%", top: "18%", size: 6, duration: 8.2, delay: 0.2 },
  { left: "18%", top: "72%", size: 4, duration: 10.4, delay: 1.1 },
  { left: "28%", top: "32%", size: 5, duration: 9.1, delay: 0.7 },
  { left: "42%", top: "14%", size: 4, duration: 11.8, delay: 0.4 },
  { left: "56%", top: "68%", size: 5, duration: 9.8, delay: 1.5 },
  { left: "68%", top: "26%", size: 6, duration: 12.4, delay: 0.9 },
  { left: "78%", top: "78%", size: 4, duration: 8.9, delay: 0.6 },
  { left: "88%", top: "38%", size: 5, duration: 10.7, delay: 1.8 },
];

type PointerState = {
  x: number;
  y: number;
  rx: number;
  ry: number;
};

type ActiveField = "phone" | "password" | null;
type AuthMode = "login" | "register";

function usePointerScene() {
  const [pointer, setPointer] = useState<PointerState>({ x: 72, y: 22, rx: 0, ry: 0 });

  useEffect(() => {
    let frame = 0;

    const handlePointerMove = (event: PointerEvent) => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      frame = window.requestAnimationFrame(() => {
        const xPercent = event.clientX / window.innerWidth;
        const yPercent = event.clientY / window.innerHeight;

        setPointer({
          x: Math.round(xPercent * 100),
          y: Math.round(yPercent * 100),
          rx: Number((((0.5 - yPercent) * 9)).toFixed(2)),
          ry: Number((((xPercent - 0.5) * 10)).toFixed(2)),
        });
      });
    };

    const handlePointerLeave = () => {
      setPointer((current) => ({
        ...current,
        rx: 0,
        ry: 0,
      }));
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return pointer;
}

function LoginTechBackground({ pointer, activeField }: { pointer: PointerState; activeField: ActiveField }) {
  const focusBoost = activeField ? 1 : 0;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden [perspective:1600px]">
      <motion.div
        aria-hidden="true"
        className="absolute inset-[-8%] bg-[linear-gradient(135deg,#020814_0%,#07111d_34%,#05101d_58%,#081421_100%)]"
        animate={{ x: pointer.ry * -3, y: pointer.rx * 3, rotateX: pointer.rx * 0.15, rotateY: pointer.ry * 0.15 }}
        transition={{ type: "spring", stiffness: 38, damping: 20, mass: 1.6 }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-[-6%] bg-[radial-gradient(circle_at_18%_0%,rgba(67,126,219,0.22),transparent_24%),radial-gradient(circle_at_88%_14%,rgba(46,255,220,0.12),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(103,82,255,0.12),transparent_20%)]"
        animate={{ x: pointer.ry * -8, y: pointer.rx * 8, rotateX: pointer.rx * 0.35, rotateY: pointer.ry * 0.35, opacity: 1 + focusBoost * 0.08 }}
        transition={{ type: "spring", stiffness: 34, damping: 18, mass: 1.8 }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-[-10%] opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(143,214,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(143,214,255,0.09) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
        animate={{
          backgroundPosition: ["0px 0px", "0px 72px"],
          x: pointer.ry * -10,
          y: pointer.rx * 10,
          rotateX: pointer.rx * 0.45,
          rotateY: pointer.ry * 0.45,
          opacity: 0.16 + focusBoost * 0.06,
        }}
        transition={{
          backgroundPosition: { duration: 9, repeat: Infinity, ease: "linear" },
          x: { type: "spring", stiffness: 34, damping: 18 },
          y: { type: "spring", stiffness: 34, damping: 18 },
          rotateX: { type: "spring", stiffness: 34, damping: 18 },
          rotateY: { type: "spring", stiffness: 34, damping: 18 },
          opacity: { duration: 0.35, ease: "easeOut" },
        }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-y-0 left-[-20%] w-[45%] bg-[linear-gradient(90deg,transparent_0%,rgba(123,220,255,0.04)_40%,rgba(123,220,255,0.16)_50%,rgba(123,220,255,0.04)_60%,transparent_100%)] blur-2xl"
        animate={{ x: ["0%", "220%"], y: pointer.rx * 14, rotateY: pointer.ry * 0.6, opacity: 1 + focusBoost * 0.12 }}
        transition={{
          x: { duration: 10, repeat: Infinity, ease: "linear" },
          y: { type: "spring", stiffness: 28, damping: 18 },
          rotateY: { type: "spring", stiffness: 28, damping: 18 },
          opacity: { duration: 0.35, ease: "easeOut" },
        }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute left-[-8%] top-[-18%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(80,144,255,0.28)_0%,rgba(80,144,255,0)_68%)] blur-[95px]"
        animate={{ x: [-18 + pointer.ry * -4, 22 + pointer.ry * -4, -12 + pointer.ry * -4], y: [0 + pointer.rx * 8, 26 + pointer.rx * 8, 8 + pointer.rx * 8], scale: [0.94, 1.06 + focusBoost * 0.06, 0.98], opacity: 1 + focusBoost * 0.1 }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute right-[-12%] top-[6%] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(47,246,220,0.16)_0%,rgba(47,246,220,0)_72%)] blur-[108px]"
        animate={{ x: [12 + pointer.ry * 6, -26 + pointer.ry * 6, 18 + pointer.ry * 6], y: [-8 + pointer.rx * -10, 20 + pointer.rx * -10, -4 + pointer.rx * -10], scale: [1.02, 0.94 + focusBoost * 0.02, 1.05 + focusBoost * 0.06], opacity: 1 + focusBoost * 0.14 }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute left-[16%] top-[60%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(113,84,255,0.16)_0%,rgba(113,84,255,0)_72%)] blur-[110px]"
        animate={{ x: [pointer.ry * -8, 28 + pointer.ry * -8, -10 + pointer.ry * -8], y: [8 + pointer.rx * 12, -24 + pointer.rx * 12, 14 + pointer.rx * 12], scale: [0.98, 1.08 + focusBoost * 0.05, 1], opacity: 1 + focusBoost * 0.08 }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2"
        animate={{ left: `${pointer.x}%`, top: `${pointer.y}%`, x: pointer.ry * 6, y: pointer.rx * -6, scale: 1 + focusBoost * 0.04 }}
        transition={{ type: "spring", stiffness: 70, damping: 18, mass: 1.1 }}
      >
        <motion.div
          className="h-full w-full rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18)_0%,rgba(143,214,255,0.12)_20%,rgba(143,214,255,0.06)_34%,rgba(143,214,255,0)_72%)] blur-[88px]"
          animate={{ scale: [0.94, 1.05 + focusBoost * 0.08, 0.98], opacity: [0.18 + focusBoost * 0.08, 0.28 + focusBoost * 0.18, 0.22 + focusBoost * 0.08] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 top-[22%] h-px bg-[linear-gradient(90deg,transparent_0%,rgba(143,214,255,0.06)_18%,rgba(143,214,255,0.34)_50%,rgba(143,214,255,0.06)_82%,transparent_100%)]"
        animate={{ opacity: [0.18 + focusBoost * 0.08, 0.48 + focusBoost * 0.28, 0.18 + focusBoost * 0.08], scaleX: [0.92, 1.04 + focusBoost * 0.05, 0.96], x: pointer.ry * 10 }}
        transition={{ opacity: { duration: 4.8, repeat: Infinity, ease: "easeInOut" }, scaleX: { duration: 4.8, repeat: Infinity, ease: "easeInOut" }, x: { type: "spring", stiffness: 30, damping: 18 } }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-y-[12%] right-[13%] w-px bg-[linear-gradient(180deg,transparent_0%,rgba(47,246,220,0.06)_18%,rgba(47,246,220,0.30)_50%,rgba(47,246,220,0.06)_82%,transparent_100%)]"
        animate={{ opacity: [0.14 + focusBoost * 0.1, 0.42 + focusBoost * 0.32, 0.14 + focusBoost * 0.1], scaleY: [0.84, 1.03 + focusBoost * 0.1, 0.9], y: pointer.rx * 12 }}
        transition={{ opacity: { duration: 5.4, repeat: Infinity, ease: "easeInOut" }, scaleY: { duration: 5.4, repeat: Infinity, ease: "easeInOut" }, y: { type: "spring", stiffness: 30, damping: 18 } }}
      />

      {LOGIN_BACKGROUND_PARTICLES.map((particle) => (
        <motion.span
          key={`${particle.left}-${particle.top}`}
          aria-hidden="true"
          className="absolute rounded-full bg-[#b8edff]"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            boxShadow: "0 0 18px rgba(184,237,255,0.55)",
          }}
          animate={{ y: [0, -22 + pointer.rx * 3, 0], x: [0, pointer.ry * 2.2, 0], opacity: [0.18 + focusBoost * 0.08, 0.8 + focusBoost * 0.1, 0.24 + focusBoost * 0.08], scale: [0.88, 1.18 + focusBoost * 0.08, 0.94] }}
          transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const deviceKey = ensureUserDeviceKey();

  let type = "移动端";
  let model = "Web App";

  if (/iPhone/i.test(userAgent)) {
    type = "iPhone";
    model = "iPhone Safari";
  } else if (/iPad/i.test(userAgent)) {
    type = "iPad";
    model = "iPad Safari";
  } else if (/Android/i.test(userAgent)) {
    type = "Android";
    model = "Android WebView";
  } else if (/Windows/i.test(userAgent)) {
    type = "Windows";
    model = "Windows Browser";
  } else if (/Macintosh/i.test(userAgent)) {
    type = "Mac";
    model = "Mac Browser";
  } else if (/UOS|UnionTech|Deepin|X11|Linux/i.test(userAgent)) {
    type = "Linux";
    model = "Linux Browser";
  }

  return {
    deviceKey,
    type,
    model,
  };
};

export function UserLogin() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [customerServiceUrl, setCustomerServiceUrl] = useState("");
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const pointer = usePointerScene();

  useEffect(() => {
    let active = true;

    ensureUserDeviceKey();

    const bootstrap = async () => {
      try {
        try {
          const branding = await mockApi.getBrandingConfig();
          if (active) {
            setCustomerServiceUrl(branding.customerServiceUrl ?? "");
          }
        } catch {
          if (active) {
            setCustomerServiceUrl("");
          }
        }

        const token = getUserToken();
        if (!token) return;

        const currentUser = await mockApi.getCurrentUser();
        if (!active) return;

        saveUserSession({
          token,
          userId: currentUser.id,
          phone: currentUser.phone,
        });
        navigate("/user/courses", { replace: true });
      } catch {
        if (!active) return;
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [navigate]);

  const getErrorTitle = () => {
    if (loginError.includes("设备数量已达上限")) return "设备数量已达上限";
    if (loginError.includes("停用")) return "账号已停用";
    return authMode === "register" ? "注册失败" : "登录失败";
  };

  const normalizeErrorMessage = (message: string) => {
    if (message.includes("设备已达上限")) return `当前账号已达到 ${DEVICE_LIMIT} 台设备登录上限，请联系管理员处理`;
    if (message.includes("过于频繁")) return message;
    if (message.includes("停用")) return "该账号当前无法登录，请联系管理员";
    if (message.includes("设备已失效")) return "当前设备登录已失效，请重新登录";
    if (message.includes("已注册")) return "该手机号已注册，请直接登录";
    if (message.includes("手机号") || message.includes("密码")) return "手机号或密码不正确，请重新输入";
    return message || (authMode === "register" ? "注册失败，请稍后重试" : "登录失败，请稍后重试");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!phone.trim() || !password.trim()) {
      const message = authMode === "register" ? "请输入手机号和密码完成注册" : "请输入您下单的手机号和密码";
      setLoginError(message);
      toast.error(message);
      return;
    }

    if (authMode === "register" && password.trim().length < 6) {
      const message = "密码长度至少 6 位";
      setLoginError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    setLoginError("");

    try {
      const action = authMode === "register" ? mockApi.register : mockApi.login;
      const result = await action(phone.trim(), password.trim(), getDeviceInfo());
      saveUserSession({
        token: result.token,
        userId: result.user.id,
        phone: result.user.phone,
      });
      toast.success(authMode === "register" ? "注册成功" : "登录成功");
      navigate("/user/courses", { replace: true });
    } catch (error) {
      const rawMessage =
        error instanceof ApiRequestError && error.code === 10041
          ? error.message
          : error instanceof ApiRequestError && error.code === 10043
            ? error.message
          : error instanceof Error
            ? error.message
            : authMode === "register"
              ? "注册失败，请稍后重试"
              : "登录失败，请稍后重试";
      const message = normalizeErrorMessage(rawMessage);
      setLoginError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleContactService = () => {
    if (!customerServiceUrl) {
      toast.error("请先在后台系统配置中填写企业微信客服链接");
      return;
    }

    window.open(customerServiceUrl, "_blank", "noopener,noreferrer");
  };

  if (checkingSession) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#040816] px-4 py-5 text-white md:px-8 md:py-10">
        <LoginTechBackground pointer={pointer} activeField={null} />
        <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl items-center justify-center md:min-h-[calc(100vh-4rem)]">
          <div className="w-full max-w-md rounded-[26px] border border-white/10 bg-white/[0.05] p-7 text-center text-white/62 shadow-[0_28px_90px_rgba(0,0,0,0.22)] backdrop-blur-xl md:rounded-[32px] md:p-10">
            登录状态校验中...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040816] px-4 py-5 text-white md:px-8 md:py-10 [perspective:1800px]">
      <LoginTechBackground pointer={pointer} activeField={activeField} />

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl items-center justify-center md:min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-[520px]">
          <motion.div
            className="relative mx-auto w-full overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur-[20px] md:rounded-[32px] md:p-7"
            animate={{
              rotateX: pointer.rx,
              rotateY: pointer.ry,
              x: pointer.ry * 1.8,
              y: pointer.rx * -1.8,
            }}
            transition={{ type: "spring", stiffness: 55, damping: 20, mass: 1.1 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_38%),linear-gradient(140deg,rgba(255,255,255,0.04),transparent_42%)]"
              animate={{ x: pointer.ry * -4, y: pointer.rx * 4 }}
              transition={{ type: "spring", stiffness: 42, damping: 20 }}
            />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[32px] p-px"
              animate={{ opacity: activeField ? [0.28, 0.7, 0.28] : [0.16, 0.34, 0.16] }}
              transition={{ duration: activeField ? 2.4 : 4.8, repeat: Infinity, ease: "linear" }}
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(143,214,255,0) 0deg, rgba(143,214,255,0.05) 40deg, rgba(143,214,255,0.55) 95deg, rgba(46,246,220,0.34) 140deg, rgba(143,214,255,0.04) 220deg, rgba(143,214,255,0) 360deg)",
              }}
            >
              <div className="h-full w-full rounded-[31px] bg-transparent" />
            </motion.div>
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-18%] rounded-[40px] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(143,214,255,0.08)_68deg,rgba(46,246,220,0.22)_108deg,transparent_150deg,transparent_360deg)] blur-2xl"
              animate={{ rotate: [0, 360], opacity: activeField ? 0.85 : 0.45 }}
              transition={{ rotate: { duration: activeField ? 5.5 : 10.5, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.3 } }}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(143,214,255,0.26)_0%,rgba(143,214,255,0)_72%)]" />

            <div className="relative">
              <div className="mb-6 flex justify-center md:mb-8">
                <AppLogo className="origin-center scale-105 text-white md:scale-125" />
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/14 p-4 backdrop-blur-xl md:rounded-[28px] md:p-6">
                <div className="mb-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-[#8fd6ff]">
                    <Sparkles className="size-3.5" />
                    {authMode === "register" ? "注册入口" : "登录入口"}
                  </div>
                  <h1 className="mt-4 text-[24px] font-semibold leading-8 text-white md:text-[28px] md:leading-10">欢迎使用得宝-智学系统</h1>
                  <p className="mt-3 text-sm leading-6 text-white/54 md:leading-7">
                    {authMode === "register" ? "请输入手机号并设置密码，注册成功后将自动进入我的课程。" : "请输入您的手机号和密码，登录后可直接进入我的课程。"}
                  </p>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                  <button
                    type="button"
                    className={cn(
                      "h-10 rounded-[14px] text-sm font-medium transition",
                      authMode === "login" ? "bg-white text-slate-950" : "text-white/68 hover:bg-white/[0.06] hover:text-white",
                    )}
                    onClick={() => {
                      setAuthMode("login");
                      setLoginError("");
                    }}
                  >
                    登录
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "h-10 rounded-[14px] text-sm font-medium transition",
                      authMode === "register" ? "bg-white text-slate-950" : "text-white/68 hover:bg-white/[0.06] hover:text-white",
                    )}
                    onClick={() => {
                      setAuthMode("register");
                      setLoginError("");
                    }}
                  >
                    注册
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white/72">
                      手机号
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder={authMode === "register" ? "请输入您的手机号" : "请输入您下单的手机号"}
                      value={phone}
                      className={cn(
                        "h-12 rounded-2xl px-4 text-base text-white placeholder:text-white/28 transition",
                        activeField === "phone"
                          ? "border-[#8fd6ff]/45 bg-white/[0.09] shadow-[0_0_0_1px_rgba(143,214,255,0.18),0_0_28px_rgba(143,214,255,0.18)]"
                          : "border-white/10 bg-white/[0.06]",
                      )}
                      onFocus={() => setActiveField("phone")}
                      onBlur={() => setActiveField((current) => (current === "phone" ? null : current))}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        if (loginError) setLoginError("");
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white/72">
                      密码
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={authMode === "register" ? "请设置登录密码" : "请输入您的密码"}
                        value={password}
                        className={cn(
                          "h-12 rounded-2xl px-4 pr-12 text-base text-white placeholder:text-white/28 transition",
                          activeField === "password"
                            ? "border-[#8fd6ff]/45 bg-white/[0.09] shadow-[0_0_0_1px_rgba(143,214,255,0.18),0_0_28px_rgba(143,214,255,0.18)]"
                            : "border-white/10 bg-white/[0.06]",
                        )}
                        onFocus={() => setActiveField("password")}
                        onBlur={() => setActiveField((current) => (current === "password" ? null : current))}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          if (loginError) setLoginError("");
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className={cn(
                          "absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full transition",
                          activeField === "password"
                            ? "text-[#8fd6ff] hover:bg-white/[0.09] hover:text-white"
                            : "text-white/34 hover:bg-white/[0.06] hover:text-white/70",
                        )}
                        aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <Alert className="border-red-500/25 bg-red-500/10 text-red-100">
                      <TriangleAlert className="mt-0.5 size-4" />
                      <AlertTitle>{getErrorTitle()}</AlertTitle>
                      <AlertDescription>{loginError}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="h-12 w-full rounded-2xl bg-white text-base text-slate-950 hover:bg-white/90" disabled={loading}>
                    {loading ? (authMode === "register" ? "注册中..." : "登录中...") : authMode === "register" ? "注册并进入学习中心" : "进入学习中心"}
                  </Button>
                </form>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-white/62">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-4 text-[#8fd6ff]" />
                    <div className="space-y-1">
                      {authMode === "register" ? <p>注册后可直接登录并进入学习中心。</p> : <p>默认密码：den2024</p>}
                      <p>{authMode === "register" ? "如注册或登录遇到问题，可点击下方联系客服。" : "如无法登录，可点击下方联系客服。"}</p>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="mt-4 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] text-base text-white hover:bg-white/[0.10] hover:text-white"
                  onClick={handleContactService}
                >
                  <Headset className="mr-2 size-5 text-[#8fd6ff]" />
                  联系客服
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
