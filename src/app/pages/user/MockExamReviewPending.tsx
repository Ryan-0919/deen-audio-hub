import { Clock3, FileCheck2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { mockApi } from "../../lib/mockData";

const REDIRECT_SECONDS = 5;

export function MockExamReviewPending() {
  const { recordId = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paperTitle, setPaperTitle] = useState("当前试卷");
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const detail = await mockApi.getMockExamRecord(recordId);
        if (!alive) return;
        setPaperTitle(detail.paper.title || "当前试卷");

        if (!detail.reviewEnabled || detail.reviewWorkflowStatus === "published") {
          navigate(`/user/mock-exams/records/${detail.id}/result`, { replace: true });
          return;
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, [navigate, recordId]);

  useEffect(() => {
    if (loading) return;
    if (countdown <= 0) {
      navigate("/user/mock-exams", { replace: true });
      return;
    }

    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, loading, navigate]);

  const countdownText = useMemo(() => `${countdown}s 后返回机考试卷`, [countdown]);

  if (loading) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#040816] px-5 py-12 text-white md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(70,130,180,0.22),transparent_42%),linear-gradient(180deg,#07111d_0%,#040816_52%,#09172b_100%)]" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.04] px-8 py-24 backdrop-blur-xl">
          <div className="text-sm uppercase tracking-[0.28em] text-white/58">Loading Review</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-120px)] overflow-hidden bg-[#040816] px-5 py-10 text-white md:px-8 md:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[220px] h-[360px] w-[860px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />

      <div className="relative mx-auto max-w-[760px]">
        <div className="overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] shadow-[0_32px_100px_rgba(0,0,0,0.24)] backdrop-blur-[20px]">
          <div className="relative px-8 py-10 md:px-12 md:py-12">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#ffb54d]/12 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-[#73a8ff]/12 blur-3xl" />

            <div className="relative flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/12 bg-[linear-gradient(135deg,rgba(255,246,216,0.16)_0%,rgba(255,217,156,0.32)_100%)] shadow-[0_16px_40px_rgba(255,179,71,0.18)]">
                <FileCheck2 className="size-10 text-[#f5b14b]" />
              </div>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#ffd79f]/18 bg-[#ffcc6b]/10 px-4 py-1 text-[13px] font-semibold text-[#ffd39a]">
                <Sparkles className="size-4" />
                主观题正在进入批改流程
              </div>

              <div className="mt-6 text-[11px] uppercase tracking-[0.28em] text-white/36">DE EN FA KAO</div>
              <h1 className="mt-3 text-[30px] font-bold tracking-[-0.04em] text-white md:text-[36px]">已成功交卷</h1>
              <p className="mt-3 text-[18px] font-semibold text-white/88">{paperTitle}</p>
              <p className="mt-4 max-w-[520px] text-[15px] leading-8 text-white/54">
                正在等待老师批改。批改完成后，请到“我的考试”中查看成绩、评语和批改详情。
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/62">
                  <Clock3 className="size-4 text-white/48" />
                  {countdownText}
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/user/my-exams")}
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_30px_rgba(255,255,255,0.14)] transition hover:bg-white/92"
                >
                  去我的考试查看
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/user/mock-exams")}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-white/74 transition hover:bg-white/[0.10] hover:text-white"
                >
                  返回机考试卷
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
