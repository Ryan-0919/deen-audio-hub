import { ClipboardCheck, LogOut, Sparkles, Trophy, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppLogo } from "../../components/branding/AppLogo";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import { type UserHomeConfig, mockApi } from "../../lib/mockData";
import { clearUserSession, getUserDeviceKey, getUserDisplayName, getUserId } from "../../lib/user-session";

type ShortcutItem = {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  iconClassName: string;
  glowClassName: string;
  accentText: string;
};

const EMPTY_HOME_CONFIG: UserHomeConfig = {
  memberHome: {
    hero: {
      badge: "快捷入口",
      title: "欢迎使用得宝",
      description: "课程学习、机考训练、法条检索和打字练习统一收口，直接进入今天的学习节奏。",
    },
    bannerImageUrl: "",
    bannerImageObjectKey: "",
    announcement: {
      title: "学习公告",
      subtitle: "Announcement",
      badge: "最新",
      items: [],
    },
    operations: {
      title: "快捷入口",
      subtitle: "DE EN FA KAO",
      items: [],
    },
  },
  examHome: {
    eyebrow: "Mock Exam",
    title: "我的试卷",
    objectiveModeLabel: "客观题专场",
    subjectiveModeLabel: "主观题专场",
    objectiveEmptyText: "当前还没有可进入的客观题试卷，请先在后台发布试卷。",
    subjectiveEmptyText: "当前还没有可进入的主观题试卷，请先在后台发布试卷。",
  },
  accountCenter: {
    eyebrow: "Account Center",
    description: "这里统一放课程学习外的个人操作入口。你可以查看主观题批改记录、考试排行榜，也可以随时安全退出当前设备。",
    shortcutTitle: "DE EN FA KAO",
    shortcuts: [
      {
        title: "我的考试",
        description: "查看已批改完成的主观题考试记录与结果。",
        path: "/user/my-exams",
        accentText: "进入批改记录",
      },
      {
        title: "考试排行榜",
        description: "按试卷查看你已考过的考试排行榜。",
        path: "/user/exam-leaderboard",
        accentText: "进入排行榜",
      },
    ],
  },
};

const fallbackShortcutItems: ShortcutItem[] = [
  {
    title: "我的考试",
    description: "查看已批改完成的主观题考试记录与结果。",
    path: "/user/my-exams",
    icon: ClipboardCheck,
    iconClassName: "text-[#8fd6ff]",
    glowClassName: "from-[#38a6ff]/28 via-[#1f6fff]/16 to-transparent",
    accentText: "进入批改记录",
  },
  {
    title: "考试排行榜",
    description: "按试卷查看你已考过的考试排行榜。",
    path: "/user/exam-leaderboard",
    icon: Trophy,
    iconClassName: "text-[#ffd39a]",
    glowClassName: "from-[#ffca57]/28 via-[#d68616]/16 to-transparent",
    accentText: "进入排行榜",
  },
];

export function UserMe() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [homeConfig, setHomeConfig] = useState<UserHomeConfig>(EMPTY_HOME_CONFIG);

  const displayName = getUserDisplayName() || "已登录用户";
  const deviceKey = getUserDeviceKey();

  useEffect(() => {
    void mockApi
      .getUserHomeConfig()
      .then((config) => setHomeConfig(config))
      .catch(() => setHomeConfig(EMPTY_HOME_CONFIG));
  }, []);

  const shortcutItems = useMemo(() => {
    const sourceItems =
      homeConfig.accountCenter.shortcuts.length > 0 ? homeConfig.accountCenter.shortcuts : EMPTY_HOME_CONFIG.accountCenter.shortcuts;
    const ensuredItems = sourceItems.some((item) => item.path === "/user/exam-leaderboard")
      ? sourceItems
      : [...sourceItems, EMPTY_HOME_CONFIG.accountCenter.shortcuts[1]];

    return ensuredItems.map((item, index) => ({
      title: item.title,
      description: item.description,
      path: item.path,
      accentText: item.accentText,
      icon: fallbackShortcutItems[index]?.icon ?? ClipboardCheck,
      iconClassName: fallbackShortcutItems[index]?.iconClassName ?? "text-[#8fd6ff]",
      glowClassName: fallbackShortcutItems[index]?.glowClassName ?? "from-[#38a6ff]/28 via-[#1f6fff]/16 to-transparent",
    }));
  }, [homeConfig.accountCenter.shortcuts]);

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
    <div className="relative min-h-screen overflow-hidden bg-[#040816] pb-24 text-white selection:bg-[#dff8ff] selection:text-[#061120]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[320px] h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />

      <div className="relative mx-auto max-w-[1320px] px-4 pb-10 pt-4 md:px-8 md:pt-8 xl:px-10">
        <div className="mb-5 flex items-center justify-between md:hidden">
          <AppLogo compact className="text-white" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="rounded-full border border-white/10 bg-white/[0.05] px-3 text-white hover:bg-white/[0.10] hover:text-white"
          >
            <LogOut className="size-4" />
            {loggingOut ? "退出中..." : "退出"}
          </Button>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="space-y-5">
            <div className="space-y-5">
              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[30px] md:p-6">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/38">
                  <Sparkles className="size-3.5 text-[#8fd6ff]" />
                  {homeConfig.accountCenter.eyebrow || "Account Center"}
                </div>

                <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.06] text-white shadow-[0_18px_50px_rgba(0,0,0,0.2)] md:size-20 md:rounded-[28px]">
                    <UserRound className="size-9 md:size-10" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="truncate text-[24px] font-semibold tracking-[-0.05em] text-white md:text-[36px]">{displayName}</h1>
                      <Badge className="rounded-full border-0 bg-emerald-400/14 text-emerald-200 shadow-none">已登录</Badge>
                    </div>

                    <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58 md:text-[15px]">
                      {homeConfig.accountCenter.description || "这里统一放课程学习外的个人操作入口。你可以查看主观题批改记录、考试排行榜，也可以随时安全退出当前设备。"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[28px] md:p-5">
                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/36">{homeConfig.accountCenter.shortcutTitle || "DE EN FA KAO"}</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {shortcutItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <motion.button
                        key={item.path}
                        type="button"
                        onClick={() => navigate(item.path)}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.08 + index * 0.05 }}
                        className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-black/16 p-4 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/18 hover:bg-black/20"
                      >
                        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", item.glowClassName)} />
                        <div className="relative z-10 flex h-full flex-col">
                          <div className="flex size-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.06]">
                            <Icon className={cn("size-5", item.iconClassName)} />
                          </div>
                          <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.04em] text-white md:text-[20px]">{item.title}</h3>
                          <p className="mt-2 text-[13px] leading-6 text-white/58">{item.description}</p>
                          <div className={cn("mt-auto pt-4 text-[13px] font-medium", item.iconClassName)}>{item.accentText}</div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                className="hidden h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-6 text-white hover:bg-white/[0.10] hover:text-white md:inline-flex"
              >
                <LogOut className="mr-2 size-4" />
                {loggingOut ? "退出中..." : "退出登录"}
              </Button>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
