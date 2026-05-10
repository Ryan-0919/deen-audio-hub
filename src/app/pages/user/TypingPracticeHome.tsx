import { ChevronLeft, ChevronRight, History, House, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import {
  type TypingPracticeHomePayload,
  type TypingPracticeLeaderboardEntry,
  type TypingPracticeMode,
  type TypingPracticeRecordListPayload,
  mockApi,
} from "../../lib/mockData";
import {
  buildTypingAccuracyText,
  buildTypingPracticeIdleHint,
  buildTypingPracticeSearch,
  pickNextTypingPracticeText,
  typingPracticeModeMeta,
} from "./typingPracticeShared";
import { MockExamDesktopNotice, useMockExamDesktopGuard } from "./mockExamDesktopGuard";

const EMPTY_HOME: TypingPracticeHomePayload = {
  homeConfig: {
    hero: {
      title: "",
      englishTitle: "",
      description: "",
      topNotice: "",
      policeImageUrl: "",
      policeImageObjectKey: "",
      thiefImageUrl: "",
      thiefImageObjectKey: "",
    },
    modeHints: {
      guided: "",
      sprint: "",
      memorize: "",
    },
    rules: {
      paragraphs: [],
      cards: [],
    },
  },
  summary: {
    totalFolders: 0,
    totalTexts: 0,
    practiceCount: 0,
    avgAccuracyRate: 0,
    avgCpm: 0,
    bestCpm: 0,
    bestScore: 0,
    totalTypedLength: 0,
  },
  folders: [],
  texts: [],
  recentRecords: [],
};

const HISTORY_PAGE_SIZE = 5;
const VISIBLE_TYPING_PRACTICE_MODES: TypingPracticeMode[] = ["guided", "sprint"];
const VISIBLE_TYPING_DIFFICULTIES = [
  { value: "easy", label: "入门" },
  { value: "medium", label: "标准" },
  { value: "hard", label: "挑战" },
] as const;

const EMPTY_RECORD_LIST: TypingPracticeRecordListPayload = {
  items: [],
  total: 0,
  page: 1,
  pageSize: HISTORY_PAGE_SIZE,
  totalPages: 1,
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-4 text-center backdrop-blur-xl">
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">{label}</div>
      <div className="mt-2 text-[28px] font-bold leading-none text-white">{value}</div>
    </div>
  );
}

function RuleCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/14 px-4 py-4 text-center backdrop-blur-xl">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1.5 text-xs leading-6 text-white/48">{description}</div>
    </div>
  );
}

function ModeButton({
  mode,
  active,
  onClick,
}: {
  mode: TypingPracticeMode;
  active: boolean;
  onClick: () => void;
}) {
  const meta = typingPracticeModeMeta[mode];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-[136px] rounded-[18px] border px-5 py-3 text-sm font-semibold transition backdrop-blur-xl",
        active ? "border-white/18 bg-white text-slate-950 shadow-[0_14px_34px_rgba(255,255,255,0.14)]" : "border-white/10 bg-white/[0.05] text-white/62 hover:bg-white/[0.08]",
      )}
    >
      {meta.label}
    </button>
  );
}

export function TypingPracticeHome() {
  const navigate = useNavigate();
  const isMobileBlocked = useMockExamDesktopGuard();
  const [payload, setPayload] = useState<TypingPracticeHomePayload>(EMPTY_HOME);
  const [historyPayload, setHistoryPayload] = useState<TypingPracticeRecordListPayload>(EMPTY_RECORD_LIST);
  const [leaderboard, setLeaderboard] = useState<TypingPracticeLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<TypingPracticeMode>("guided");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [selectedTextId, setSelectedTextId] = useState("");
  const [sprintSeconds, setSprintSeconds] = useState<180 | 300>(180);

  const loadHistory = async (page = 1) => {
    try {
      setHistoryLoading(true);
      const next = await mockApi.getTypingPracticeRecords({ page, pageSize: HISTORY_PAGE_SIZE });
      setHistoryPayload(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载练习记录失败");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isMobileBlocked) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const [nextHome, nextHistory, nextLeaderboard] = await Promise.all([
          mockApi.getTypingPracticeHome(),
          mockApi.getTypingPracticeRecords({ page: 1, pageSize: HISTORY_PAGE_SIZE }),
          mockApi.getTypingPracticeLeaderboard({ limit: 10 }),
        ]);
        setPayload(nextHome);
        setHistoryPayload(nextHistory);
        setLeaderboard(nextLeaderboard);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载打字练习失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isMobileBlocked]);

  const texts = payload.texts;
  const homeConfig = payload.homeConfig;
  const visibleRuleParagraphs = useMemo(
    () => homeConfig.rules.paragraphs.filter((item) => !/(法条默写|默写)/.test(item.text)),
    [homeConfig.rules.paragraphs],
  );

  useEffect(() => {
    if (texts.length === 0) {
      setSelectedTextId("");
      return;
    }

    setSelectedTextId((current) => (texts.some((text) => text.id === current) ? current : texts[0]?.id ?? ""));
  }, [texts]);

  const selectedText = useMemo(() => texts.find((text) => text.id === selectedTextId) ?? texts[0] ?? null, [selectedTextId, texts]);
  const recentRecord = payload.recentRecords[0] ?? null;
  const policePosition = recentRecord ? Math.min(76, 14 + Math.round(recentRecord.completionRate * 0.62)) : 18;
  const thiefPosition = 82;

  if (isMobileBlocked) {
    return <MockExamDesktopNotice />;
  }

  const cycleText = (direction: "next" | "prev") => {
    const next = pickNextTypingPracticeText(texts, selectedTextId, direction);
    if (next) {
      setSelectedTextId(next.id);
    }
  };

  const startPractice = () => {
    if (texts.length === 0) {
      toast.error("当前还没有可练习的文本");
      return;
    }

    if (selectedMode === "sprint") {
      const target = selectedText ?? texts[0];
      navigate(
        `/user/typing-practice/texts/${target.id}/play${buildTypingPracticeSearch("sprint", {
          difficulty: selectedDifficulty,
          timeLimitSeconds: sprintSeconds,
        })}`,
      );
      return;
    }

    const target = selectedText ?? texts[0];
    navigate(
      `/user/typing-practice/texts/${target.id}/play${buildTypingPracticeSearch(selectedMode, {
        difficulty: selectedDifficulty,
      })}`,
    );
  };

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#040816] px-4 py-6 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
        <div className="relative mx-auto max-w-[1180px] rounded-[30px] border border-white/10 bg-white/[0.05] px-6 py-20 text-center text-white/58 backdrop-blur-xl">
          页面加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040816] px-4 py-6 text-white selection:bg-[#dff8ff] selection:text-[#061120]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[320px] h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />

      <div className="relative mx-auto max-w-[1180px]">
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[30px]">
          <div className="border-b border-[#d8c16b]/35 bg-[linear-gradient(180deg,rgba(255,217,96,0.94)_0%,rgba(255,205,74,0.82)_100%)] px-4 py-3 text-center text-[15px] text-[#6d5200]">
            {homeConfig.hero.topNotice}
          </div>

          <div className="px-4 py-4 md:px-6 md:py-6">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.26em] text-white/36">{homeConfig.hero.englishTitle}</div>
                <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-white md:text-[42px]">{homeConfig.hero.title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/54 md:leading-7">{homeConfig.hero.description}</p>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/user/courses")}
                className="h-11 rounded-[16px] border border-white/10 bg-white/[0.05] px-5 text-white hover:bg-white/[0.10] hover:text-white"
              >
                <House className="mr-2 size-4" />
                返回主页
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="最高得分" value={recentRecord?.score ?? payload.summary.bestScore} />
              <StatCard label="练习次数" value={payload.summary.practiceCount} />
              <StatCard label="平均正确率" value={buildTypingAccuracyText(payload.summary.avgAccuracyRate)} />
              <StatCard label="最佳速度" value={`${payload.summary.bestCpm} CPM`} />
              <StatCard label="文本总数" value={payload.summary.totalTexts} />
            </div>

            <div className="mt-5 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl md:rounded-[26px] md:p-4">
              <div className="relative h-[170px] overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,#b9e6ff_0%,#dff5ff_56%,#d0f0c7_56%,#b3e49e_100%)] md:h-[210px] md:rounded-[20px]">
                <motion.div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.35),transparent_22%),radial-gradient(circle_at_78%_24%,rgba(255,255,255,0.22),transparent_18%)]"
                  animate={{ x: ["-2%", "2%", "-2%"], y: [0, -4, 0] }}
                  transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <div className="absolute inset-x-6 top-[53%] h-[14px] -translate-y-1/2 rounded-full border border-[#8fb6c8] bg-[#f7fbfd]" />
                <motion.div
                  aria-hidden
                  className="absolute inset-x-7 top-[53%] h-[4px] -translate-y-1/2 rounded-full bg-[repeating-linear-gradient(90deg,#c1d7e1_0_12px,transparent_12px_22px)]"
                  animate={{ backgroundPositionX: ["0px", "-44px"] }}
                  transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                />
                <motion.img
                  src={homeConfig.hero.policeImageUrl}
                  alt=""
                  className="absolute bottom-4 w-[84px] max-w-none -translate-x-1/2 md:bottom-5 md:w-[112px]"
                  style={{ left: `${policePosition}%` }}
                  animate={{
                    y: [0, -8, 0],
                    rotate: [0, -2, 0, 2, 0],
                    scaleX: [1, 0.985, 1, 1.015, 1],
                  }}
                  transition={{ duration: 0.9, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <motion.img
                  src={homeConfig.hero.thiefImageUrl}
                  alt=""
                  className="absolute bottom-4 w-[84px] max-w-none -translate-x-1/2 md:bottom-5 md:w-[112px]"
                  style={{ left: `${thiefPosition}%` }}
                  animate={{
                    y: [0, -5, 0],
                    rotate: [0, 2, 0, -2, 0],
                  }}
                  transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl md:rounded-[26px] md:p-5">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {VISIBLE_TYPING_PRACTICE_MODES.map((mode) => (
                  <ModeButton key={mode} mode={mode} active={selectedMode === mode} onClick={() => setSelectedMode(mode)} />
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {VISIBLE_TYPING_DIFFICULTIES.map((difficulty) => (
                  <button
                    key={difficulty.value}
                    type="button"
                    onClick={() => setSelectedDifficulty(difficulty.value)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm transition",
                      selectedDifficulty === difficulty.value
                        ? "border-white/18 bg-white text-slate-950"
                        : "border-white/10 bg-white/[0.05] text-white/62 hover:bg-white/[0.08]",
                    )}
                  >
                    {difficulty.label}
                  </button>
                ))}
              </div>

              {selectedMode === "sprint" ? (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSprintSeconds(180)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm transition",
                      sprintSeconds === 180 ? "border-white/18 bg-white text-slate-950" : "border-white/10 bg-white/[0.05] text-white/62 hover:bg-white/[0.08]",
                    )}
                  >
                    3分钟
                  </button>
                  <button
                    type="button"
                    onClick={() => setSprintSeconds(300)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm transition",
                      sprintSeconds === 300 ? "border-white/18 bg-white text-slate-950" : "border-white/10 bg-white/[0.05] text-white/62 hover:bg-white/[0.08]",
                    )}
                  >
                    5分钟
                  </button>
                </div>
              ) : null}

              <div className="mt-4 text-center text-sm text-white/48">{buildTypingPracticeIdleHint(selectedMode, homeConfig.modeHints)}</div>

              <div className="mt-5 flex justify-center">
                <Button
                  type="button"
                  onClick={startPractice}
                  className="h-11 w-full max-w-sm rounded-[16px] border border-white/10 bg-white px-6 text-base font-semibold text-slate-950 shadow-[0_14px_34px_rgba(255,255,255,0.12)] hover:bg-white/90"
                >
                  {typingPracticeModeMeta[selectedMode].startLabel}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
              <div className="space-y-5">
                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl md:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => cycleText("prev")}
                      disabled={texts.length === 0}
                      className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white disabled:opacity-50"
                    >
                      <ChevronLeft className="size-5" />
                    </button>

                    <div className="min-w-0 flex-1 text-center">
                      <div className="truncate text-lg font-semibold text-white">{selectedText?.title ?? "暂无练习文本"}</div>
                      <div className="mt-1 text-xs text-white/46">
                        {selectedText
                          ? `${selectedText.folderName} · ${selectedText.contentLength} 字符 · 正确率 ${buildTypingAccuracyText(payload.summary.avgAccuracyRate)}`
                          : "请先在后台录入法律文本"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => cycleText("next")}
                      disabled={texts.length === 0}
                      className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white disabled:opacity-50"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl md:p-5">
                  <div className="text-base font-semibold text-white">游戏说明</div>
                  <div className="mt-3 space-y-1 text-sm leading-7 text-white/54">
                    {visibleRuleParagraphs.map((item, index) => (
                      <p key={`${index}-${item.text}`}>{item.text}</p>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  {homeConfig.rules.cards.map((item) => (
                    <RuleCard key={item.title} title={item.title} description={item.description} />
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl md:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <History className="size-4 text-[#8fd6ff]" />
                      <div className="text-base font-semibold text-white">历史战绩</div>
                    </div>
                    <div className="text-xs text-white/42">
                      第 {historyPayload.page} / {historyPayload.totalPages} 页
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {historyLoading ? (
                      <div className="rounded-[18px] border border-dashed border-white/12 px-4 py-8 text-center text-sm text-white/42">战绩加载中...</div>
                    ) : historyPayload.items.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-white/12 px-4 py-8 text-center text-sm text-white/42">你还没有练习记录，先开始一局。</div>
                    ) : (
                      historyPayload.items.map((record) => (
                        <button
                          key={record.id}
                          type="button"
                          onClick={() => navigate(`/user/typing-practice/records/${record.id}`)}
                          className="flex w-full items-center justify-between rounded-[18px] border border-white/10 bg-black/10 px-3 py-3 text-left transition hover:border-white/16 hover:bg-white/[0.05]"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{record.title}</div>
                            <div className="mt-1 text-xs text-white/44">
                              {record.modeLabel} · {record.completedAt}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-sm font-bold text-white">{record.score} 分</div>
                            <div className="mt-1 text-xs text-white/44">
                              {record.cpm} CPM · {buildTypingAccuracyText(record.accuracyRate)}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={historyLoading || historyPayload.page <= 1}
                      className="rounded-[14px] border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.10] hover:text-white"
                      onClick={() => void loadHistory(Math.max(1, historyPayload.page - 1))}
                    >
                      上一页
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={historyLoading || historyPayload.page >= historyPayload.totalPages}
                      className="rounded-[14px] border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.10] hover:text-white"
                      onClick={() => void loadHistory(Math.min(historyPayload.totalPages, historyPayload.page + 1))}
                    >
                      下一页
                    </Button>
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl md:p-5">
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4 text-[#ffd39a]" />
                    <div className="text-base font-semibold text-white">排行榜</div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {leaderboard.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-white/12 px-4 py-8 text-center text-sm text-white/42">还没有可展示的排行榜数据。</div>
                    ) : (
                      leaderboard.map((entry) => (
                        <div
                          key={`${entry.rank}-${entry.userId}`}
                          className={cn(
                            "flex items-center justify-between rounded-[18px] border px-3 py-3",
                            entry.rank <= 3 ? "border-[#705117] bg-[#3e2d0f]/72" : "border-white/10 bg-black/10",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-xs font-bold text-slate-950">
                                {entry.rank}
                              </span>
                              <span className="truncate text-sm font-semibold text-white">{entry.userLabel}</span>
                            </div>
                            <div className="mt-1 text-xs text-white/44">
                              {entry.practiceCount} 局 · 平均正确率 {buildTypingAccuracyText(entry.avgAccuracyRate)}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-sm font-bold text-white">{entry.bestScore} 分</div>
                            <div className="mt-1 text-xs text-white/44">{entry.bestCpm} CPM</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
