import { motion } from "motion/react";
import { ArrowRight, FilePenLine, Keyboard, Library, LogOut, Scale, Sparkles, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import {
  type Course,
  type MockExamPaper,
  type PortalMemberHomeAnnouncementItem,
  type PortalMemberHomeOperationItem,
  type UserHomeConfig,
  mockApi,
} from "../../lib/mockData";
import { clearUserSession, getUserDeviceKey, getUserId } from "../../lib/user-session";
import { isSubjectivePaper } from "./mockExamLaunchShared";

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
      items: [
        {
          title: "首页直接承接今天最常用的学习入口",
          description: "从课程、机考、法条检索到打字练习，尽量把切换路径压到最短。",
        },
        {
          title: "课程提醒、模考安排和阶段通知会优先汇总到这里",
          description: "不用再去不同页面反复找消息，先在首页看重点即可。",
        },
      ],
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
    description: "这里统一放课程学习外的个人操作入口。你可以查看主观题批改记录，也可以随时安全退出当前设备。",
    shortcutTitle: "DE EN FA KAO",
    shortcuts: [
      {
        title: "我的考试",
        description: "查看已批改完成的主观题考试记录与结果。",
        path: "/user/my-exams",
        accentText: "进入批改记录",
      },
    ],
  },
};

type HomeActionCard = {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  glowClassName: string;
  accentClassName: string;
  meta: string;
};

const DEFAULT_ACTIONS: Array<Omit<HomeActionCard, "meta">> = [
  {
    path: "/user/mock-exams",
    eyebrow: "机考训练",
    title: "进入主观批改",
    description: "直接进入主观题试卷列表，查看已购的试卷。",
    icon: FilePenLine,
    iconClassName: "text-[#8ff3df]",
    glowClassName: "from-[#2dd4bf]/28 via-[#159981]/16 to-transparent",
    accentClassName: "text-[#8ff3df]",
  },
  {
    path: "/user/laws",
    eyebrow: "法条联动",
    title: "主观法条检索",
    description: "围绕主观题作答快速检索、定位和对照常用法条内容。",
    icon: Scale,
    iconClassName: "text-[#cdb4ff]",
    glowClassName: "from-[#8e67ff]/28 via-[#5a42dd]/16 to-transparent",
    accentClassName: "text-[#cdb4ff]",
  },
  {
    path: "/user/typing-practice",
    eyebrow: "专项提升",
    title: "主观打字练习",
    description: "针对主观题输入速度和稳定性做专项强化，提升输出效率。",
    icon: Keyboard,
    iconClassName: "text-[#ffd39a]",
    glowClassName: "from-[#ffca57]/28 via-[#d68616]/16 to-transparent",
    accentClassName: "text-[#ffd39a]",
  },
  {
    path: "/user/my-courses",
    eyebrow: "课程入口",
    title: "进入我的微课",
    description: "进入我的微课目录，查看已开通课程并继续今天的学习进度。",
    icon: Library,
    iconClassName: "text-[#8fd6ff]",
    glowClassName: "from-[#38a6ff]/30 via-[#1f6fff]/16 to-transparent",
    accentClassName: "text-[#8fd6ff]",
  },
];

const normalizeActionPath = (value: string, fallback: string) => {
  const path = `${value || ""}`.trim();
  if (!path) return fallback;
  if (path === "/user/courses") return "/user/my-courses";
  if (
    path === "/user/my-courses" ||
    path === "/user/mock-exams" ||
    path === "/user/laws" ||
    path === "/user/typing-practice"
  ) {
    return path;
  }
  return fallback;
};

const mergeActionConfig = (
  defaults: Array<Omit<HomeActionCard, "meta">>,
  overrides: PortalMemberHomeOperationItem[],
  metaMap: Record<string, string>,
) => {
  const overrideMap = new Map<string, PortalMemberHomeOperationItem>();
  overrides.forEach((item) => {
    const normalizedPath = normalizeActionPath(item.path, "");
    if (normalizedPath) {
      overrideMap.set(normalizedPath, item);
    }
  });

  return defaults.map((item) => {
    const override = overrideMap.get(item.path);
    return {
      ...item,
      eyebrow: override?.eyebrow?.trim() ?? item.eyebrow,
      title: override?.title?.trim() ?? item.title,
      description: override?.description?.trim() ?? item.description,
      path: normalizeActionPath(override?.path ?? item.path, item.path),
      meta: metaMap[item.path] ?? "点击进入",
    } satisfies HomeActionCard;
  });
};

const ensureAnnouncementItems = (items: PortalMemberHomeAnnouncementItem[]) =>
  (items.length > 0 ? items : EMPTY_HOME_CONFIG.memberHome.announcement.items).slice(0, 2);

export function MyCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [papers, setPapers] = useState<MockExamPaper[]>([]);
  const [homeConfig, setHomeConfig] = useState<UserHomeConfig>(EMPTY_HOME_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const userId = getUserId();
      if (!userId) {
        navigate("/login", { replace: true });
        return;
      }

      const [courseResult, paperResult, homeConfigResult] = await Promise.allSettled([
        mockApi.getUserCourses(userId),
        mockApi.getMockExamPapers(),
        mockApi.getUserHomeConfig(),
      ]);

      setCourses(courseResult.status === "fulfilled" ? courseResult.value : []);
      setPapers(paperResult.status === "fulfilled" ? paperResult.value : []);
      setHomeConfig(homeConfigResult.status === "fulfilled" ? homeConfigResult.value : EMPTY_HOME_CONFIG);
      setLoading(false);
    };

    void load();
  }, [navigate]);

  const handleLogout = async () => {
    const userId = getUserId();
    try {
      if (userId) {
        await mockApi.logout(userId, getUserDeviceKey() || undefined);
      }
    } catch {}
    clearUserSession();
    navigate("/");
  };

  const objectiveCount = useMemo(() => papers.filter((item) => !isSubjectivePaper(item)).length, [papers]);
  const subjectiveCount = useMemo(() => papers.filter((item) => isSubjectivePaper(item)).length, [papers]);

  const actionMetaMap = useMemo(
    () => ({
      "/user/my-courses": courses.length > 0 ? `已开通 ${courses.length} 门课程` : "查看全部课程",
      "/user/mock-exams":
        papers.length > 0 ? `主观 ${subjectiveCount} 套 / 客观 ${objectiveCount} 套` : "进入试卷列表",
      "/user/laws": "考试中可直接调出",
      "/user/typing-practice": "跟打、冲刺、默写",
    }),
    [courses.length, objectiveCount, papers.length, subjectiveCount],
  );

  const actionCards = useMemo(
    () => mergeActionConfig(DEFAULT_ACTIONS, homeConfig.memberHome.operations.items, actionMetaMap),
    [actionMetaMap, homeConfig.memberHome.operations.items],
  );

  const announcement = homeConfig.memberHome.announcement;
  const hero = homeConfig.memberHome.hero;
  const announcementItems = ensureAnnouncementItems(announcement.items);
  const bannerImageUrl = homeConfig.memberHome.bannerImageUrl?.trim() || "/portal/home-hero-banner.png";

  const renderAnnouncementCards = (keyPrefix: string) => (
    <>
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px]">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/38">
          <Sparkles className="size-3.5 text-[#8fd6ff]" />
          {announcement.subtitle || "Announcement"}
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-white">
              {announcement.title || "学习公告"}
            </h2>
            <p className="mt-2 text-sm leading-7 text-white/56">课程、机考与练习提醒统一收在这里。</p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-white/58">
            {announcement.badge || "最新动态"}
          </div>
        </div>
      </div>

      {announcementItems.map((item, index) => (
        <motion.div
          key={`home_announcement_${keyPrefix}_${index}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18 + index * 0.06 }}
          className="rounded-[26px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl"
        >
          <div className="text-base font-medium leading-7 text-white">{item.title}</div>
          <div className="mt-2 text-sm leading-7 text-white/58">{item.description}</div>
        </motion.div>
      ))}
    </>
  );

  if (loading) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#040816] px-5 py-12 text-white md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(70,130,180,0.22),transparent_42%),linear-gradient(180deg,#07111d_0%,#040816_52%,#09172b_100%)]" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.04] px-8 py-24 backdrop-blur-xl">
          <div className="text-sm uppercase tracking-[0.28em] text-white/58">Loading Home</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#040816] pb-24 text-white selection:bg-[#dff8ff] selection:text-[#061120]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[320px] h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />

      <div className="relative mx-auto max-w-[1320px] px-4 pb-10 pt-4 md:px-8 md:pt-8 xl:px-10">
        <div className="mb-5 flex items-center justify-between md:hidden">
          <AppLogo compact className="text-white" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="rounded-full border border-white/10 bg-white/[0.05] px-3 text-white hover:bg-white/[0.10] hover:text-white"
          >
            <LogOut className="size-4" />
            退出
          </Button>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="mx-auto max-w-[1560px] xl:grid xl:grid-cols-[minmax(24px,1fr)_minmax(0,980px)_32px_236px_minmax(24px,1fr)] xl:items-start">
            <div className="xl:col-start-2 xl:col-end-3">
              <motion.button
                type="button"
                onClick={() => navigate("/user/my-courses")}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.04, ease: "easeOut" }}
                className="group relative block w-full overflow-hidden rounded-[24px] border border-white/10 bg-black/18 text-left shadow-[0_30px_110px_rgba(0,0,0,0.24)] backdrop-blur-[20px] md:rounded-[30px]"
              >
                <div className="aspect-[25/13] w-full">
                  <img src={bannerImageUrl} alt="首页推荐 Banner" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,8,18,0.78)_0%,rgba(3,8,18,0.38)_36%,rgba(3,8,18,0.08)_100%)]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(3,8,18,0.58))]" />
                <div className="absolute inset-0 flex flex-col justify-between p-4 md:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-full border border-white/12 bg-black/24 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/72 backdrop-blur-xl md:text-[11px]">
                      {hero.badge || "快捷入口"}
                    </div>
                    <div className="rounded-full border border-white/12 bg-black/20 p-2 text-white/68 backdrop-blur-xl transition group-hover:translate-x-0.5 group-hover:text-white">
                      <ArrowRight className="size-4" />
                    </div>
                  </div>

                  <div className="max-w-[420px]">
                    <div className="text-[24px] font-semibold tracking-[-0.05em] text-white md:text-[38px]">{hero.title || "欢迎使用得宝"}</div>
                    <p className="mt-2 text-[13px] leading-6 text-white/72 md:mt-3 md:text-[15px] md:leading-7">
                      {hero.description || "课程学习、机考训练、法条检索和打字练习统一收口，直接进入今天的学习节奏。"}
                    </p>
                  </div>
                </div>
              </motion.button>

              <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:mt-5 md:rounded-[28px] md:p-5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-white/36">
                      {homeConfig.memberHome.operations.subtitle || "DE EN FA KAO"}
                    </div>
                    <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.05em] text-white md:text-[34px]">
                      {homeConfig.memberHome.operations.title || "快捷入口"}
                    </h1>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {actionCards.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <motion.button
                        key={item.path}
                        type="button"
                        onClick={() => navigate(item.path)}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.08 + index * 0.05 }}
                        className="group relative overflow-hidden rounded-[20px] border border-white/10 bg-black/16 p-3 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/18 hover:bg-black/20 md:rounded-[22px] md:p-4 md:min-h-[180px] xl:min-h-[188px]"
                      >
                        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", item.glowClassName)} />
                        <div className="relative z-10 flex h-full min-h-[158px] flex-col md:min-h-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex size-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] md:size-10 md:rounded-[18px]">
                              <Icon className={cn("size-4", item.iconClassName, "md:size-4.5")} />
                            </div>
                            <ArrowRight className="mt-0.5 size-4 text-white/34 transition group-hover:translate-x-0.5 group-hover:text-white/64" />
                          </div>

                          <div className="mt-3 text-[9px] uppercase tracking-[0.18em] text-white/34 md:mt-4 md:text-[10px] md:tracking-[0.22em]">
                            {item.eyebrow}
                          </div>
                          <h2 className="mt-2 text-[17px] font-semibold leading-[1.2] tracking-[-0.05em] text-white md:mt-2.5 md:text-[21px]">
                            {item.title}
                          </h2>
                          <p className="mt-2 hidden text-[13px] leading-6 text-white/58 md:block">{item.description}</p>
                          <div className={cn("mt-auto pt-3 text-[12px] font-medium md:pt-4 md:text-[13px]", item.accentClassName)}>
                            {item.meta}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3 xl:hidden">{renderAnnouncementCards("mobile")}</div>

            <aside className="hidden xl:col-start-4 xl:col-end-5 xl:block">
              <div className="sticky top-24 space-y-4">{renderAnnouncementCards("desktop")}</div>
            </aside>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
