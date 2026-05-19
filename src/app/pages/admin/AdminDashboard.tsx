import { Activity, CalendarDays, Sparkles, UserCheck, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import type { AdminDashboardSummary } from "../../lib/mockData";
import { mockApi } from "../../lib/mockData";

const EMPTY_SUMMARY: AdminDashboardSummary = {
  currentOnlineUsers: 0,
  todayOnlineUsers: 0,
  todayRegisteredUsers: 0,
  recentSevenDayRegisteredUsers: 0,
  recentThirtyDayOnlineUsers: 0,
  onlineWindowMinutes: 30,
  generatedAt: "",
};

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "blue" | "emerald" | "amber" | "violet" | "slate";
}) {
  const toneClassName = {
    blue: "border-blue-200 bg-blue-50/70 text-blue-950",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-950",
    amber: "border-amber-200 bg-amber-50/70 text-amber-950",
    violet: "border-violet-200 bg-violet-50/70 text-violet-950",
    slate: "border-slate-200 bg-white text-slate-950",
  } as const;

  return (
    <Card className={`rounded-[28px] border shadow-none ${toneClassName[tone]}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium opacity-70">{title}</p>
            <p className="mt-4 text-4xl font-semibold tracking-[-0.06em]">{value}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
            <Icon className="size-5" />
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 opacity-70">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const [summary, setSummary] = useState<AdminDashboardSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSummary = async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setSummary(await mockApi.getAdminDashboardSummary());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载仪表盘失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  return (
    <div className="space-y-8 p-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] px-7 py-7 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600">
              <Sparkles className="size-3.5 text-sky-600" />
              总后台运营仪表盘
            </div>
            <h1 className="mt-4 text-[38px] font-semibold tracking-[-0.06em] text-slate-900">用户在线与注册概览</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
              这里先看平台当前活跃情况，再决定是去用户管理、课程运营还是机考系统。当前在线人数按最近 {summary.onlineWindowMinutes} 分钟内仍有活跃登录设备的去重用户计算。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {summary.generatedAt ? <Badge className="border-0 bg-white text-slate-700">数据更新时间 {summary.generatedAt}</Badge> : null}
            <Button variant="outline" className="rounded-full" onClick={() => void loadSummary(true)} disabled={refreshing}>
              {refreshing ? "刷新中..." : "刷新数据"}
            </Button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} className="rounded-[28px] border border-slate-200 shadow-none">
              <CardContent className="space-y-4 p-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="当前在线人数"
            value={summary.currentOnlineUsers}
            hint={`最近 ${summary.onlineWindowMinutes} 分钟内仍有活跃登录设备的去重用户数`}
            icon={Activity}
            tone="blue"
          />
          <MetricCard
            title="今日在线人数"
            value={summary.todayOnlineUsers}
            hint="今天 00:00 之后至少登录过一次的用户数"
            icon={UserCheck}
            tone="emerald"
          />
          <MetricCard
            title="今日注册人数"
            value={summary.todayRegisteredUsers}
            hint="今天新增注册成功的用户数"
            icon={UserPlus}
            tone="amber"
          />
          <MetricCard
            title="近 7 天注册人数"
            value={summary.recentSevenDayRegisteredUsers}
            hint="包含今天在内，最近 7 天累计注册用户数"
            icon={CalendarDays}
            tone="violet"
          />
          <MetricCard
            title="近 1 个月在线人数"
            value={summary.recentThirtyDayOnlineUsers}
            hint="包含今天在内，最近 30 天至少登录过一次的用户数"
            icon={Users}
            tone="slate"
          />
        </div>
      )}

      <Card className="rounded-[28px] border border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-2xl tracking-[-0.04em] text-slate-900">统计口径</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-slate-600">
          <p>当前在线人数：按 `UserDevice.updatedAt` 在最近 30 分钟内的去重用户统计。</p>
          <p>今日在线人数：按 `User.lastLoginAt` 在今日 00:00 之后的用户统计。</p>
          <p>今日注册人数、近 7 天注册人数：按 `User.registeredAt` 统计。</p>
          <p>近 1 个月在线人数：按 `User.lastLoginAt` 在最近 30 天内的用户统计。</p>
        </CardContent>
      </Card>
    </div>
  );
}
