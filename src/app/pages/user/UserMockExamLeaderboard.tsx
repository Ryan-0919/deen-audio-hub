import { Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { type MockExamLeaderboardDetail, type MockExamLeaderboardPaperOption, mockApi } from "../../lib/mockData";
import { getUserDisplayName } from "../../lib/user-session";

const EMPTY_PAPERS: MockExamLeaderboardPaperOption[] = [];

const EMPTY_DETAIL: MockExamLeaderboardDetail = {
  paper: {
    id: "",
    code: "",
    title: "",
    phase: "",
    year: 0,
    coverUrl: "",
    totalScore: 0,
    passScore: 0,
    questionCount: 0,
    paperType: "objective",
  },
  currentUserBestScore: null,
  currentUserBestRank: null,
  totalParticipants: 0,
  leaderboard: [],
};

const buildPaperLabel = (paper: MockExamLeaderboardPaperOption) =>
  [paper.title, paper.phase, paper.year ? `${paper.year}` : ""].filter(Boolean).join(" · ");

const maskPhone = (value: string) => {
  const normalized = `${value ?? ""}`.trim();
  if (normalized.length !== 11) {
    return normalized || "--";
  }
  return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
};

export function UserMockExamLeaderboard() {
  const navigate = useNavigate();
  const currentUserDisplayName = useMemo(() => getUserDisplayName() || "我", []);
  const [papers, setPapers] = useState<MockExamLeaderboardPaperOption[]>(EMPTY_PAPERS);
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [detail, setDetail] = useState<MockExamLeaderboardDetail>(EMPTY_DETAIL);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      try {
        setLoading(true);
        setErrorMessage("");
        const list = await mockApi.getUserMockExamLeaderboardPapers();
        if (disposed) return;
        setPapers(list);
        setSelectedPaperId(list[0]?.id ?? "");
      } catch (error) {
        if (!disposed) {
          setErrorMessage(error instanceof Error ? error.message : "加载考试排行榜失败");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedPaperId) {
      setDetail(EMPTY_DETAIL);
      return;
    }

    let disposed = false;

    const loadDetail = async () => {
      try {
        setDetailLoading(true);
        setErrorMessage("");
        const next = await mockApi.getUserMockExamLeaderboard(selectedPaperId);
        if (!disposed) {
          setDetail(next);
        }
      } catch (error) {
        if (!disposed) {
          setDetail(EMPTY_DETAIL);
          setErrorMessage(error instanceof Error ? error.message : "加载排行榜失败");
        }
      } finally {
        if (!disposed) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      disposed = true;
    };
  }, [selectedPaperId]);

  const selectedPaper = useMemo(
    () => papers.find((item) => item.id === selectedPaperId) ?? null,
    [papers, selectedPaperId],
  );

  const topTenLeaderboard = useMemo(() => detail.leaderboard.slice(0, 10), [detail.leaderboard]);

  if (loading) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#040816] px-5 py-12 text-white md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),linear-gradient(180deg,#07111d_0%,#040816_52%,#09172b_100%)]" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.04] px-8 py-24 backdrop-blur-xl">
          <div className="text-sm uppercase tracking-[0.28em] text-white/58">Loading Leaderboard</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#040816] pb-24 text-white selection:bg-[#dff8ff] selection:text-[#061120]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[320px] h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />

      <div className="relative mx-auto max-w-[1320px] px-5 pb-10 pt-5 md:px-8 md:pt-8 xl:px-10">
        <div className="mb-5 md:hidden">
          <AppLogo compact className="text-white" />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="mx-auto max-w-[1560px] space-y-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/36">DE EN FA KAO</div>
              <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.06em] text-white md:text-[40px]">考试排行榜</h1>
            </div>

            {papers.length === 0 ? (
              <section className="rounded-[28px] border border-dashed border-white/14 bg-white/[0.03] px-6 py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/42">
                  <Trophy className="size-6" />
                </div>
                <p className="mt-4 text-lg font-medium text-white">暂时还没有可查看的排行榜</p>
                <p className="mt-2 text-sm leading-7 text-white/56">只有你已经参加过的试卷，才会显示在这里。</p>
                <Button
                  type="button"
                  onClick={() => navigate("/user/mock-exams")}
                  className="mt-6 h-11 rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100"
                >
                  去我的试卷
                </Button>
              </section>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <section className="rounded-[28px] border border-white/10 bg-black/18 p-5 backdrop-blur-xl">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div className="space-y-2">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-white/36">选择试卷</div>
                        <div className="w-full md:w-[420px]">
                          <Select value={selectedPaperId} onValueChange={setSelectedPaperId}>
                            <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-white/[0.05] text-white">
                              <SelectValue placeholder="请选择试卷" />
                            </SelectTrigger>
                            <SelectContent>
                              {papers.map((paper) => (
                                <SelectItem key={paper.id} value={paper.id}>
                                  {buildPaperLabel(paper)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {selectedPaper ? (
                        <div className="text-sm text-white/58">{selectedPaper.paperType === "subjective" ? "主观题" : "客观题"}</div>
                      ) : null}
                    </div>

                    {errorMessage ? <div className="mt-4 text-sm text-rose-300">{errorMessage}</div> : null}

                    <div className="mt-5">
                      <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs uppercase tracking-[0.24em] text-white/36">我的当前排名</div>
                        <div className="mt-3 text-[28px] font-semibold tracking-[-0.05em] text-white">{detail.currentUserBestRank ?? "--"}</div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[28px] border border-white/10 bg-black/18 p-5 backdrop-blur-xl">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/36">当前试卷</div>
                    <div className="mt-3 text-[20px] font-semibold tracking-[-0.04em] text-white">
                      {detail.paper.title || selectedPaper?.title || "未选择试卷"}
                    </div>
                    <div className="mt-3 text-sm leading-7 text-white/58">
                      {[detail.paper.phase, detail.paper.year ? `${detail.paper.year}年` : "", `${detail.paper.totalScore}分`]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </section>
                </div>

                <section className="rounded-[28px] border border-white/10 bg-black/18 p-5 backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-[18px] font-semibold text-white">排行榜前 10</div>
                    {detailLoading ? <div className="text-sm text-white/42">加载中...</div> : null}
                  </div>

                  {topTenLeaderboard.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-white/12 px-4 py-8 text-center text-sm text-white/42">
                      还没有可展示的排行榜数据。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topTenLeaderboard.map((entry) => (
                        <div
                          key={entry.userId}
                          className={[
                            "flex items-center gap-3 rounded-[22px] border px-4 py-4",
                            entry.isCurrentUser
                              ? "border-[#ffd39a]/40 bg-[#3a2410]/40"
                              : entry.rank <= 3
                                ? "border-[#705117] bg-[#3e2d0f]/72"
                                : "border-white/10 bg-black/10",
                          ].join(" ")}
                        >
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-lg font-semibold text-white">
                            {entry.rank}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-base font-medium text-white">
                                {entry.isCurrentUser ? currentUserDisplayName : maskPhone(entry.userPhone)}
                              </div>
                              {entry.isCurrentUser ? (
                                <span className="rounded-full border border-[#ffd39a]/40 bg-[#ffd39a]/12 px-2 py-0.5 text-xs text-[#ffd39a]">
                                  我
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-sm text-white/48">提交时间：{entry.submittedAt || "--"}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-semibold tracking-[-0.04em] text-white">{entry.score}</div>
                            <div className="text-xs uppercase tracking-[0.24em] text-white/36">Score</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
