import { BookOpenText, ChevronRight, PlayCircle } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { type BookQuestionBank, mockApi } from "../../lib/mockData";

export function MyBookQuestionBanks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<BookQuestionBank[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setBooks(await mockApi.getUserBookQuestionBanks());
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "加载我的题库失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <div className="relative min-h-screen bg-[#040816] px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-white/10 bg-white/[0.04] px-8 py-24 text-center text-sm uppercase tracking-[0.28em] text-white/58">
          Loading Books
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040816] pb-24 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />

      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-6 md:px-8">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/36">My Question Banks</div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-white md:text-[38px]">我的题库</h1>
          <p className="mt-3 text-sm leading-7 text-white/58">这里承接书籍型题库练习，不走考试流程，不提供批改，只做题、看答案、继续练习。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {books.map((book, index) => (
            <motion.button
              key={book.id}
              type="button"
              onClick={() => navigate(`/user/book-question-banks/${book.id}`)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06 + index * 0.04 }}
              className="group overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] text-left backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(145deg,#081122_0%,#1d4ed8_55%,#38bdf8_100%)]">
                {book.coverUrl ? <img src={book.coverUrl} alt={book.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : null}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(3,8,18,0.52))]" />
                <div className="absolute left-4 top-4 rounded-full border border-white/12 bg-black/24 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/72">
                  书籍题库
                </div>
              </div>

              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">{book.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/56">{book.description || "进入后可按科目筛题、继续练习并查看答案。"}</p>
                  </div>
                  <ChevronRight className="mt-1 size-5 shrink-0 text-white/34 transition group-hover:translate-x-1 group-hover:text-white/70" />
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-white/54">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{book.subjectCount} 个科目</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{book.itemCount} 道题</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{book.progress?.answeredCount ?? 0} 道已作答</span>
                </div>

                <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-black/16 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <PlayCircle className="size-4 text-[#8fd6ff]" />
                    <span>继续练习</span>
                  </div>
                  <div className="text-sm font-medium text-[#8fd6ff]">{book.progress?.lastPracticedAt || "从第一题开始"}</div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {books.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-dashed border-white/12 bg-white/[0.04] px-6 py-16 text-center">
            <BookOpenText className="mx-auto size-8 text-white/30" />
            <div className="mt-4 text-lg font-medium text-white">当前还没有开通书籍题库</div>
            <p className="mt-2 text-sm leading-7 text-white/52">后台为你开通后，这里会显示你已购或已授权的书籍题库产品。</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
