import { Eye, EyeOff, Headset, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppLogo } from "../../components/branding/AppLogo";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ApiRequestError, mockApi } from "../../lib/mockData";

const DEVICE_LIMIT = 5;

const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const savedKey = localStorage.getItem("userDeviceKey");
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const deviceKey = savedKey ?? `device-${randomId}`;

  if (!savedKey) {
    localStorage.setItem("userDeviceKey", deviceKey);
  }

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
  }

  return {
    deviceKey,
    type,
    model,
  };
};

export function UserLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [customerServiceUrl, setCustomerServiceUrl] = useState("");

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const data = await mockApi.getBrandingConfig();
        setCustomerServiceUrl(data.customerServiceUrl ?? "");
      } catch {
        setCustomerServiceUrl("");
      }
    };

    void loadBranding();
  }, []);

  const getErrorTitle = () => {
    if (loginError.includes("设备已达上限")) return "设备数量已达上限";
    if (loginError.includes("停用")) return "账号已停用";
    return "登录失败";
  };

  const normalizeErrorMessage = (message: string) => {
    if (message.includes("台设备")) return "当前登录设备已达上限，请联系管理员处理";
    if (message.includes("过于频繁")) return message;
    if (message.includes("停用")) return "该账号当前无法登录，请联系管理员";
    if (message.includes("设备已失效")) return "当前设备登录已失效，请重新登录";
    if (message.includes("手机号") || message.includes("密码")) return "手机号或密码不正确，请重新输入";
    return message || "登录失败，请稍后重试";
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    if (!phone.trim() || !password.trim()) {
      const message = "请输入您下单的手机号和密码";
      setLoginError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    setLoginError("");

    try {
      const result = await mockApi.login(phone.trim(), password.trim(), getDeviceInfo());
      localStorage.setItem("userToken", result.token);
      localStorage.setItem("userId", result.user.id);
      localStorage.setItem("userPhone", result.user.phone);
      toast.success("登录成功");
      navigate("/user/courses");
    } catch (error) {
      const rawMessage =
        error instanceof ApiRequestError && error.code === 10031
          ? `当前账号已达到 ${DEVICE_LIMIT} 台设备登录上限，请联系管理员处理`
          : error instanceof ApiRequestError && error.code === 10041
            ? error.message
          : error instanceof Error
            ? error.message
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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fafc_0%,#eef4fb_100%)] px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-sm flex-col justify-center">
        <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-white/92 p-6 shadow-[0_28px_90px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,#dbeafe_0%,rgba(219,234,254,0)_72%)]" />

          <div className="relative">
            <div className="mb-8">
              <AppLogo />
              <div className="mt-8 space-y-3">
                <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">欢迎回来</div>
                <h1 className="text-[28px] font-semibold leading-10 text-slate-900">欢迎使用得恩法考音频课程</h1>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <p className="text-sm font-medium text-slate-900">登录区</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">请输入您下单的手机号和密码，登录后可直接进入我的课程。</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="phone">手机号</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="请输入您下单的手机号"
                    value={phone}
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base"
                    onChange={(event) => {
                      setPhone(event.target.value);
                      if (loginError) setLoginError("");
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="请输入您的密码"
                      value={password}
                      className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 pr-12 text-base"
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (loginError) setLoginError("");
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <Alert className="border-red-200 bg-red-50 text-red-700">
                    <TriangleAlert className="mt-0.5 size-4" />
                    <AlertTitle>{getErrorTitle()}</AlertTitle>
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-slate-900 text-base text-white hover:bg-slate-800"
                  disabled={loading}
                >
                  {loading ? "登录中..." : "进入我的课程"}
                </Button>
              </form>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-4 text-blue-600" />
                  <div className="space-y-1">
                    <p>默认密码：den2024</p>
                    <p>如无法登录，点击下方联系客服</p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-4 h-12 w-full rounded-2xl border-slate-200 bg-white text-base text-slate-700 hover:bg-slate-50"
                onClick={handleContactService}
              >
                <Headset className="mr-2 size-5 text-blue-600" />
                联系客服
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
