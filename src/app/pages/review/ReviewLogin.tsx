import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { clearAdminSessionForMode, getReviewHomePathForRole, setAdminSessionForMode } from "../../lib/admin-session";
import { ApiRequestError, mockApi } from "../../lib/mockData";

export function ReviewLogin() {
  const navigate = useNavigate();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    if (!account.trim() || !password.trim()) {
      toast.error("请输入批改后台账号和密码");
      return;
    }

    setLoading(true);
    try {
      const result = await mockApi.adminLogin(account.trim(), password.trim());
      clearAdminSessionForMode("admin");
      setAdminSessionForMode("review", result);
      toast.success("登录成功");
      if (result.admin.role === "operations_admin" || result.admin.role === "user_admin") {
        toast.error("当前账号仅允许进入总后台");
        navigate("/admin/login");
        return;
      }
      navigate(getReviewHomePathForRole(result.admin.role));
    } catch (error) {
      const message =
        error instanceof ApiRequestError && error.code === 10042
          ? error.message
          : error instanceof Error
            ? error.message
            : "账号或密码错误";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-6 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.08fr_440px]">
        <div className="hidden lg:block">
          <p className="text-sm font-medium text-blue-600">独立批改后台</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight text-slate-900">主观题阅卷中心</h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-500">
            这里不处理课程、门户和系统设置，只聚焦主观题 AI 批改、人工核对、结果发送与批改流程管理。
          </p>
        </div>

        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8">
            <AppLogo />
            <div className="mt-5">
              <p className="text-sm font-medium text-blue-600">批改后台登录</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">进入阅卷中心</h2>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="account">账号</Label>
              <Input id="account" value={account} onChange={(event) => setAccount(event.target.value)} placeholder="请输入批改管理员账号" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? "登录中..." : "进入批改后台"}
            </Button>
          </form>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p>该后台用于主观题批改与核对。</p>
            <p>如需管理课程、题库或门户，请进入总后台。</p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/login")}
            className="mt-6 w-full text-center text-sm text-slate-500 transition-colors hover:text-blue-600"
          >
            前往总后台登录
          </button>
        </div>
      </div>
    </div>
  );
}
