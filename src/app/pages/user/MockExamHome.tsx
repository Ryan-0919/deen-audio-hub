import { BookOpenText, PenSquare, Play, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../components/ui/utils";
import { MockExamPaper, type UserHomeConfig, mockApi } from "../../lib/mockData";
import { MockExamDesktopNotice, useMockExamDesktopGuard } from "./mockExamDesktopGuard";
import { getMockExamHomePath, isSubjectivePaper } from "./mockExamLaunchShared";

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
const getCategoryPath = (category: PaperCategory) => (category === "objective" ? "/user/objective-mock-exams" : "/user/mock-exams");
const UNGROUPED_SERIES_KEY = "__ungrouped__";
const UNGROUPED_SERIES_LABEL = "未分组试卷";

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

const buildOpenTimeText = (paper: MockExamPaper) => {
  if (paper.isOpen) {
    return "";
  }
  return paper.openTime ? `开放时间 ${paper.openTime}` : "暂未开放";
};

const groupPapersBySeries = (papers: MockExamPaper[]) => {
  const groups = new Map<string, { key: string; label: string; papers: MockExamPaper[] }>();

  for (const paper of papers) {
    const key = paper.seriesId || UNGROUPED_SERIES_KEY;
    const label = paper.seriesName?.trim() || UNGROUPED_SERIES_LABEL;
    const current = groups.get(key);

    if (current) {
      current.papers.push(paper);
      continue;
    }

    groups.set(key, {
      key,
      label,
      papers: [paper],
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.key === UNGROUPED_SERIES_KEY) return 1;
    if (right.key === UNGROUPED_SERIES_KEY) return -1;
    return left.label.localeCompare(right.label, "zh-CN");
  });
};

const getActionLabel = (paper: MockExamPaper) => {
  if (!paper.isOpen) {
    return "未开放";
  }

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
  const disabled = !paper.isOpen;

  return (
    <motion.button
      type="button"
      onClick={() => {
        if (disabled) {
          return;
        }
        onOpen(paper);
      }}
      disabled={disabled}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("group flex flex-col text-left", disabled ? "cursor-not-allowed opacity-75" : "")}
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
        {!paper.isOpen ? <p className="mt-1 text-[11px] font-medium text-[#ffd39a]">{buildOpenTimeText(paper)}</p> : null}
      </div>
    </motion.button>
  );
}

export function MockExamHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobileBlocked = useMockExamDesktopGuard();
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<MockExamPaper[]>([]);
  const [homeConfig, setHomeConfig] = useState<UserHomeConfig>(EMPTY_HOME_CONFIG);
  const pageCategory: PaperCategory = location.pathname === "/user/objective-mock-exams" ? "objective" : "subjective";

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
  const visiblePapers = pageCategory === "objective" ? objectivePapers : subjectivePapers;
  const groupedVisiblePapers = useMemo(() => groupPapersBySeries(visiblePapers), [visiblePapers]);
  const examHome = homeConfig.examHome;
  const pageMeta =
    pageCategory === "objective"
      ? {
          title: "客观题模考",
          modeLabel: examHome.objectiveModeLabel || "客观题专场",
          emptyText: examHome.objectiveEmptyText || paperTypeMeta.objective.emptyText,
          emptyIcon: BookOpenText,
        }
      : {
          title: "主观批改",
          modeLabel: examHome.subjectiveModeLabel || "主观题专场",
          emptyText: examHome.subjectiveEmptyText || paperTypeMeta.subjective.emptyText,
          emptyIcon: PenSquare,
        };

  const openPaper = (paper: MockExamPaper) => {
    if (!paper.isOpen) {
      window.alert(buildOpenTimeText(paper) || "该试卷暂未开放");
      return;
    }
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
              <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.06em] text-white md:text-[34px]">{pageMeta.title}</h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-white/62">当前展示 {visiblePapers.length} 套</div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-white/62">{pageMeta.modeLabel}</div>
              </div>
            </div>

            <div className="shrink-0">
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => navigate(getCategoryPath("subjective"))}
                  className={cn(
                    "inline-flex min-w-[148px] items-center justify-center gap-2 rounded-[22px] border px-4 py-3 text-sm font-semibold transition",
                    pageCategory === "subjective"
                      ? "border-white bg-white text-slate-950 shadow-[0_14px_34px_rgba(255,255,255,0.14)]"
                      : "border-white/10 bg-white/[0.05] text-white/62 hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  <PenSquare className="size-4" />
                  <span>主观批改</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", pageCategory === "subjective" ? "bg-[#fff1df] text-[#b45309]" : "bg-white/8 text-white/60")}>
                    {subjectivePapers.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(getCategoryPath("objective"))}
                  className={cn(
                    "inline-flex min-w-[148px] items-center justify-center gap-2 rounded-[22px] border px-4 py-3 text-sm font-semibold transition",
                    pageCategory === "objective"
                      ? "border-white bg-white text-slate-950 shadow-[0_14px_34px_rgba(255,255,255,0.14)]"
                      : "border-white/10 bg-white/[0.05] text-white/62 hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  <BookOpenText className="size-4" />
                  <span>客观题模考</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", pageCategory === "objective" ? "bg-[#e8f7ff] text-[#1d4ed8]" : "bg-white/8 text-white/60")}>
                    {objectivePapers.length}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {visiblePapers.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.04] px-6 py-16 text-center backdrop-blur-xl">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/34">
                <pageMeta.emptyIcon className="size-6" />
              </div>
              <p className="mt-4 text-lg font-medium text-white">暂无{paperTypeMeta[pageCategory].label}试卷</p>
              <p className="mt-2 text-sm leading-7 text-white/52">{pageMeta.emptyText}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedVisiblePapers.map((group) => (
                <section key={group.key} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">{group.label}</h2>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/34">{group.papers.length} 套试卷</p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {group.papers.map((paper) => (
                      <PaperCard key={paper.id} paper={paper} category={pageCategory} onOpen={openPaper} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}
