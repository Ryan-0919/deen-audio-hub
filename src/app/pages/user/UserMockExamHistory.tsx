import { FileText } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";
import { type UserMockExamHistoryItem, mockApi } from "../../lib/mockData";

function HistoryCard({ item, index, onOpen }: { item: UserMockExamHistoryItem; index: number; onOpen: (recordId: string) => void }) {
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(item.id)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.04 + index * 0.04 }}
      className="group text-left"
    >
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/18 shadow-[0_24px_90px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/16 hover:bg-black/22">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[28px] bg-[#0a101d]">
          <img
            src={item.paper.coverUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-42 blur-3xl"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,8,22,0.24)_0%,rgba(4,8,22,0.04)_40%,rgba(4,8,22,0.34)_100%)]" />
          <img
            src={item.paper.coverUrl}
            alt={item.paper.title}
            className="relative h-full w-full object-contain transition duration-700 group-hover:scale-[1.025]"
          />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(4,8,22,0)_0%,rgba(4,8,22,0.62)_68%,rgba(4,8,22,0.9)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-10 md:px-5 md:pb-5">
            <h2 className="line-clamp-2 text-[20px] font-semibold leading-[1.15] tracking-[-0.04em] text-white md:text-[24px]">
              {item.paper.title}
            </h2>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export function UserMockExamHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UserMockExamHistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      try {
        setErrorMessage("");
        const list = await mockApi.getUserMockExamHistory();
        if (!disposed) {
          setRecords(list);
        }
      } catch (error) {
        if (!disposed) {
          setRecords([]);
          setErrorMessage(error instanceof Error ? error.message : "加载我的考试失败");
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

  if (loading) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#040816] px-5 py-12 text-white md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),linear-gradient(180deg,#07111d_0%,#040816_52%,#09172b_100%)]" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.04] px-8 py-24 backdrop-blur-xl">
          <div className="text-sm uppercase tracking-[0.28em] text-white/58">Loading Exams</div>
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
          <div className="mx-auto max-w-[1560px]">
            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/36">DE EN FA KAO</div>
              <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.06em] text-white md:text-[40px]">我的考试</h1>
            </div>

            <div>
              {errorMessage ? (
                <section className="rounded-[28px] border border-rose-400/16 bg-rose-500/[0.08] px-6 py-16 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-rose-300/14 bg-white/[0.04] text-rose-200">
                    <FileText className="size-6" />
                  </div>
                  <p className="mt-4 text-lg font-medium text-white">我的考试加载失败</p>
                  <p className="mt-2 text-sm leading-7 text-white/58">{errorMessage}</p>
                </section>
              ) : records.length === 0 ? (
                <section className="rounded-[28px] border border-dashed border-white/14 bg-white/[0.03] px-6 py-16 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/42">
                    <FileText className="size-6" />
                  </div>
                  <p className="mt-4 text-lg font-medium text-white">暂时还没有可查看的考试记录</p>
                  <p className="mt-2 text-sm leading-7 text-white/56">等主观题批改完成后，这里会自动显示对应的考试结果与详情入口。</p>
                  <Button
                    type="button"
                    onClick={() => navigate("/user/mock-exams")}
                    className="mt-6 h-11 rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100"
                  >
                    去我的试卷
                  </Button>
                </section>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {records.map((item, index) => (
                    <HistoryCard
                      key={item.id}
                      item={item}
                      index={index}
                      onOpen={(recordId) => navigate(`/user/mock-exams/records/${recordId}/result`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
