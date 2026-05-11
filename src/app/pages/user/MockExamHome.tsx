import { BookOpenText, PenSquare, Play, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { cn } from "../../components/ui/utils";
import { MockExamPaper, type UserHomeConfig, mockApi } from "../../lib/mockData";
import { MockExamDesktopNotice, useMockExamDesktopGuard } from "./mockExamDesktopGuard";
import { isSubjectivePaper } from "./mockExamLaunchShared";

type PaperCategory = "objective" | "subjective";

const paperTypeMeta: Record<
  PaperCategory,
  {
    label: string;
    emptyText: string;
    badgeClassName: string;
    progressClassName: string;
    coverClassName: string;
    coverBadgeClassName: string;
    coverYearClassName: string;
    iconClassName: string;
  }
> = {
  objective: {
    label: "客观题",
    emptyText: "当前还没有可进入的客观题试卷，请先在后台发布试卷。",
    badgeClassName: "bg-[#122845] text-[#8fd6ff]",
    progressClassName: "text-[#8fd6ff]",
    coverClassName: "bg-[linear-gradient(145deg,#081122_0%,#1d4ed8_55%,#38bdf8_100%)]",
    coverBadgeClassName: "bg-white/16 text-white",
    coverYearClassName: "bg-white/14 text-white/88",
    iconClassName: "text-[#8fd6ff]",
  },
  subjective: {
    label: "主观题",
    emptyText: "当前还没有可进入的主观题试卷，请先在后台发布试卷。",
    badgeClassName: "bg-[#3a2410] text-[#ffd39a]",
    progressClassName: "text-[#ffd39a]",
    coverClassName: "bg-[linear-gradient(145deg,#171720_0%,#8a4310_52%,#f59e0b_100%)]",
    coverBadgeClassName: "bg-white/16 text-white",
    coverYearClassName: "bg-white/14 text-white/88",
    iconClassName: "text-[#ffd39a]",
  },
};

const getPaperCategory = (paper: MockExamPaper): PaperCategory => (isSubjectivePaper(paper) ? "subjective" : "objective");
const getExamEntryPath = (paperId: string) => `/user/mock-exams/papers/${paperId}`;

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

const buildPaperMetaText = (paper: MockExamPaper) => [paper.year ? `${paper.year}年` : "", paper.phase || ""].filter(Boolean).join(" · ");

const buildAttemptsText = (paper: MockExamPaper) =>
  [paper.maxAttempts > 0 ? `限考 ${paper.maxAttempts} 次` : "不限次数", isSubjectivePaper(paper) ? (paper.reviewEnabled ? "人工批改" : "直接解析") : ""]
    .filter(Boolean)
    .join(" · ");

const getActionLabel = (paper: MockExamPaper) => {
  if (paper.activeRecord?.canResume) {
    return "继续作答";
  }

  if (paper.latestRecord) {
    return "再次机考";
  }

  return "进入考试";
};

function PaperCard({
  paper,
  category,
  onOpen,
}: {
  paper: MockExamPaper;
  category: PaperCategory;
  onOpen: (paper: MockExamPaper) => void;
}) {
  const typeMeta = paperTypeMeta[category];
  const Icon = category === "objective" ? BookOpenText : PenSquare;

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(paper)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="group flex flex-col text-left"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[26px] border border-white/10 bg-black/18 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/18 hover:shadow-[0_30px_110px_rgba(0,0,0,0.34)] md:rounded-[30px]">
        {paper.coverUrl ? (
          <img src={paper.coverUrl} alt={paper.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : (
          <div className={cn("absolute inset-0", typeMeta.coverClassName)} />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_44%,rgba(3,8,18,0.44)_100%)]" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/8 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-xl md:h-12 md:w-12">
            <Play className="ml-0.5 size-4 fill-current md:size-5" />
          </div>
        </div>
        <div className="absolute -right-4 top-3 text-white/14">
          <Icon className="size-24 md:size-28" strokeWidth={1.25} />
        </div>

        <div className="relative flex h-full flex-col justify-start p-4 text-white [text-shadow:0_4px_20px_rgba(15,23,42,0.35)] md:p-5">
          <div className="flex items-start justify-between gap-3">
            <Badge className={cn("border-0 shadow-none", typeMeta.coverBadgeClassName)}>{typeMeta.label}</Badge>
            {paper.year ? <span className={cn("rounded-full px-3 py-1 text-[11px] font-medium", typeMeta.coverYearClassName)}>{paper.year}年</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-3 px-1 md:mt-4 md:px-2">
        <div className="mb-1 flex items-center gap-1.5 md:mb-1.5 md:gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/34 md:text-[11px]">{buildPaperMetaText(paper) || "机考试卷"}</span>
          <span className="h-1 w-1 rounded-full bg-white/18" />
          <span className={cn("text-[10px] font-bold uppercase tracking-wider md:text-[11px]", typeMeta.progressClassName)}>{getActionLabel(paper)}</span>
        </div>
        <h4 className="line-clamp-1 text-[15px] font-bold tracking-tight text-white md:text-[17px]">{paper.title}</h4>
        <p className="mt-1 text-[11px] font-medium text-white/34">{buildAttemptsText(paper)}</p>
      </div>
    </motion.button>
  );
}

export function MockExamHome() {
  const navigate = useNavigate();
  const isMobileBlocked = useMockExamDesktopGuard();
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<MockExamPaper[]>([]);
  const [homeConfig, setHomeConfig] = useState<UserHomeConfig>(EMPTY_HOME_CONFIG);
  const [activeTab, setActiveTab] = useState<PaperCategory>("subjective");

  useEffect(() => {
    if (isMobileBlocked) return;

    const load = async () => {
      try {
        const [paperList, config] = await Promise.all([
          mockApi.getMockExamPapers(),
          mockApi.getUserHomeConfig().catch(() => EMPTY_HOME_CONFIG),
        ]);
        setPapers(paperList);
        setHomeConfig(config);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "加载机考试卷失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isMobileBlocked]);

  const objectivePapers = useMemo(() => papers.filter((paper) => getPaperCategory(paper) === "objective"), [papers]);
  const subjectivePapers = useMemo(() => papers.filter((paper) => getPaperCategory(paper) === "subjective"), [papers]);

  useEffect(() => {
    if (activeTab === "objective" && objectivePapers.length === 0 && subjectivePapers.length > 0) {
      setActiveTab("subjective");
      return;
    }

    if (activeTab === "subjective" && subjectivePapers.length === 0 && objectivePapers.length > 0) {
      setActiveTab("objective");
    }
  }, [activeTab, objectivePapers.length, subjectivePapers.length]);

  const visiblePapers = activeTab === "objective" ? objectivePapers : subjectivePapers;
  const examHome = homeConfig.examHome;

  const openPaper = (paper: MockExamPaper) => {
    navigate(getExamEntryPath(paper.id));
  };

  if (isMobileBlocked) {
    return <MockExamDesktopNotice />;
  }

  if (loading) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#040816] px-5 py-12 text-white md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(70,130,180,0.22),transparent_42%),linear-gradient(180deg,#07111d_0%,#040816_52%,#09172b_100%)]" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.04] px-8 py-24 backdrop-blur-xl">
          <div className="text-sm uppercase tracking-[0.28em] text-white/58">Loading Papers</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040816] pb-24 text-white selection:bg-[#dff8ff] selection:text-[#061120]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[320px] h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />

      <div className="relative mx-auto max-w-[1320px] px-5 pb-10 pt-5 md:px-8 md:pt-8 xl:px-10">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/38">
                <Sparkles className="size-3.5 text-[#8fd6ff]" />
                {examHome.eyebrow || "Mock Exam"}
              </div>
              <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.06em] text-white md:text-[34px]">{examHome.title || "我的试卷"}</h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-white/62">当前展示 {visiblePapers.length} 套</div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-white/62">
                  {activeTab === "objective" ? examHome.objectiveModeLabel || "客观题专场" : examHome.subjectiveModeLabel || "主观题专场"}
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <div>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PaperCategory)} className="gap-0">
                  <TabsList className="h-auto gap-1.5 rounded-[22px] border border-white/10 bg-white/[0.05] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <TabsTrigger
                      value="objective"
                      className="min-w-[148px] rounded-2xl px-4 py-3 text-white/62 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-[0_14px_34px_rgba(255,255,255,0.14)]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-[#122845] text-[#8fd6ff]">
                          <BookOpenText className="size-3.5" />
                        </span>
                        <span className="text-sm font-semibold">客观题</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            activeTab === "objective" ? "bg-[#e8f7ff] text-[#1d4ed8]" : "bg-white/8 text-white/60",
                          )}
                        >
                          {objectivePapers.length}
                        </span>
                      </span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="subjective"
                      className="min-w-[148px] rounded-2xl px-4 py-3 text-white/62 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-[0_14px_34px_rgba(255,255,255,0.14)]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-[#3a2410] text-[#ffd39a]">
                          <PenSquare className="size-3.5" />
                        </span>
                        <span className="text-sm font-semibold">主观题</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            activeTab === "subjective" ? "bg-[#fff1df] text-[#b45309]" : "bg-white/8 text-white/60",
                          )}
                        >
                          {subjectivePapers.length}
                        </span>
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visiblePapers.length === 0 ? (
              <div className="col-span-full rounded-[28px] border border-dashed border-white/12 bg-white/[0.04] px-6 py-16 text-center backdrop-blur-xl">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/34">
                  <PenSquare className="size-6" />
                </div>
                <p className="mt-4 text-lg font-medium text-white">暂无{paperTypeMeta[activeTab].label}试卷</p>
                <p className="mt-2 text-sm leading-7 text-white/52">
                  {activeTab === "objective"
                    ? examHome.objectiveEmptyText || paperTypeMeta[activeTab].emptyText
                    : examHome.subjectiveEmptyText || paperTypeMeta[activeTab].emptyText}
                </p>
              </div>
            ) : (
              visiblePapers.map((paper) => <PaperCard key={paper.id} paper={paper} category={activeTab} onOpen={openPaper} />)
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
