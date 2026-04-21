import { BookMarked, LogOut, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AppLogo } from "../../components/branding/AppLogo";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Course, mockApi } from "../../lib/mockData";
import { clearUserSession, getUserDeviceKey, getUserId } from "../../lib/user-session";

export function MyCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void import("./CourseDetail");

    const load = async () => {
      const userId = getUserId();
      if (!userId) {
        navigate("/");
        return;
      }

      try {
        const list = await mockApi.getUserCourses(userId);
        setCourses(list);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [navigate]);

  const handleLogout = async () => {
    const userId = getUserId();
    const deviceKey = getUserDeviceKey() || undefined;

    try {
      if (userId) {
        await mockApi.logout(userId, deviceKey);
      }
    } catch (_error) {
      // Ignore logout request failures and always clear local session.
    }

    clearUserSession();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-full bg-[#f6f8fb] px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          课程加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f6f8fb]">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto flex h-14 max-w-sm items-center px-4">
          <div className="flex w-[72px] justify-start">
            <AppLogo compact />
          </div>
          <h1 className="flex-1 text-center text-base font-semibold tracking-[0.02em] text-slate-900">我的课程</h1>
          <div className="flex w-[72px] justify-end">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="rounded-full px-3 text-slate-600">
              <LogOut className="size-4" />
              退出
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-8 xl:px-8">
        <div className="mt-0">
          {courses.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-8 py-14 text-center md:px-12 md:py-20">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <BookMarked className="size-7" />
              </div>
              <h2 className="text-lg font-medium text-slate-900">暂无课程</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">课程未开放或尚未分配权限时，这里会显示“暂无课程”。</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
              {courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => navigate(`/user/course/${course.id}`, { state: { course } })}
                  className="group w-full overflow-hidden rounded-3xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
                >
                  <div className="aspect-[3/2] bg-slate-100">
                    <img src={course.cover} alt={course.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                  </div>

                  <div className="space-y-3 p-3 md:p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-50 text-[11px] text-blue-600">
                        {course.audioCount} 条音频
                      </Badge>
                    </div>

                    <div>
                      <h2 className="line-clamp-2 text-sm font-semibold text-slate-900 md:text-lg">{course.name}</h2>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500 md:text-sm md:leading-6">{course.description}</p>
                    </div>

                    <div className="flex justify-end text-xs md:text-sm">
                      <span className="inline-flex items-center gap-1 text-blue-600">
                        进入课程
                        <PlayCircle className="size-3.5 md:size-4" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
