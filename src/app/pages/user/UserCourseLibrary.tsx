import { BookMarked, LogOut, Play } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";
import { type Course, mockApi } from "../../lib/mockData";
import { clearUserSession, getUserDeviceKey, getUserId } from "../../lib/user-session";

const courseStatusText = (status: Course["status"]) => (status === "open" ? "在学中" : status === "scheduled" ? "待开课" : "已关闭");

export function UserCourseLibrary() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const userId = getUserId();
      if (!userId) {
        navigate("/login", { replace: true });
        return;
      }

      const [courseResult] = await Promise.allSettled([mockApi.getUserCourses(userId)]);
      setCourses(courseResult.status === "fulfilled" ? courseResult.value : []);
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

  if (loading) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#040816] px-5 py-12 text-white md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(70,130,180,0.22),transparent_42%),linear-gradient(180deg,#07111d_0%,#040816_52%,#09172b_100%)]" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-center px-8 py-24">
          <div className="text-sm uppercase tracking-[0.28em] text-white/58">Loading Courses</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040816] pb-24 text-white selection:bg-[#dff8ff] selection:text-[#061120]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[320px] h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />

      <div className="relative px-4 pb-10 pt-4 md:px-8 md:pt-8 xl:px-10">
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
          <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/36">Course Library</div>
              <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.05em] text-white md:text-[38px]">课程学习</h1>
              <p className="mt-2 text-sm text-white/54 md:text-[15px]">已开通课程 {courses.length} 门，直接进入课程目录继续学习。</p>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/user/courses")}
              className="w-fit rounded-full border border-white/10 bg-white/[0.05] px-5 text-white hover:bg-white/[0.10] hover:text-white"
            >
              返回首页
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(212px,256px))] sm:justify-center md:justify-start">
            {courses.map((course, index) => (
              <motion.button
                key={course.id}
                type="button"
                onClick={() => navigate(`/user/course/${course.id}`, { state: { course } })}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 + index * 0.04 }}
                className="group flex flex-col overflow-hidden rounded-[18px] border border-white/10 bg-black/16 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/18 hover:bg-black/20 sm:max-w-[256px]"
              >
                <div className="relative aspect-[3/2] w-full overflow-hidden">
                  <img src={course.cover} alt={course.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(4,8,22,0.72))]" />
                  <div className="absolute right-1.5 top-1.5 rounded-full border border-white/12 bg-black/24 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.18em] text-white/72 backdrop-blur-xl sm:right-2 sm:top-2">
                    {courseStatusText(course.status)}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl">
                      <Play className="ml-0.5 size-3.5 fill-current" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-2.5 sm:p-3">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/38">{course.audioCount} 节内容</div>
                  <h2 className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-5 tracking-[-0.04em] text-white sm:text-[16px]">
                    {course.name}
                  </h2>
                  <p className="mt-1 hidden line-clamp-2 text-[11px] leading-[1.35rem] text-white/58 sm:block">
                    {course.description || "进入课程后可查看完整目录与音频内容。"}
                  </p>
                  <div className="mt-auto pt-2 text-[11px] font-medium text-[#8fd6ff]">进入课程</div>
                </div>
              </motion.button>
            ))}

            {courses.length === 0 && (
              <div className="col-span-full rounded-[24px] border border-dashed border-white/12 bg-white/[0.04] p-8 text-center">
                <BookMarked className="mx-auto mb-3 size-8 text-white/30" />
                <div className="text-sm font-medium text-white/58">暂无课程记录</div>
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
