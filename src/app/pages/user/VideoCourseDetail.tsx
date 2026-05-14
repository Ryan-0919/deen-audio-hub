import { ArrowLeft, Clock3, PlayCircle, Sparkles, Tags, Video as VideoIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import { Course, Tag, UserVideoProgress, Video, mockApi } from "../../lib/mockData";
import { getUserId } from "../../lib/user-session";

type TagContent = {
  videos: Video[];
  progress: UserVideoProgress[];
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatPercent = (progress = 0, duration = 0) => (duration ? Math.min(100, Math.round((progress / duration) * 100)) : 0);

export function VideoCourseDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId } = useParams<{ courseId: string }>();
  const stateCourse = (location.state as { course?: Course } | null)?.course;
  const seededCourse = stateCourse && stateCourse.id === courseId ? stateCourse : null;

  const [course, setCourse] = useState<Course | null>(seededCourse);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [progressList, setProgressList] = useState<UserVideoProgress[]>([]);
  const [tagCache, setTagCache] = useState<Record<string, TagContent>>({});
  const [loading, setLoading] = useState(!seededCourse);
  const [tagLoading, setTagLoading] = useState(Boolean(seededCourse));

  const selectedTag = useMemo(() => tags.find((tag) => tag.id === selectedTagId) ?? null, [selectedTagId, tags]);
  const progressMap = useMemo(() => new Map(progressList.map((item) => [item.videoId, item])), [progressList]);
  const tagSummaries = useMemo(
    () =>
      tags.map((tag) => {
        const content = tagCache[tag.id] ?? { videos: [], progress: [] };
        const currentProgressMap = new Map(content.progress.map((item) => [item.videoId, item]));
        const completedCount = content.videos.filter((video) => currentProgressMap.get(video.id)?.completed).length;
        const totalDuration = content.videos.reduce((sum, video) => sum + video.duration, 0);

        return {
          tag,
          videoCount: content.videos.length,
          completedCount,
          totalDuration,
          completionRate: content.videos.length ? Math.min(100, Math.round((completedCount / content.videos.length) * 100)) : 0,
        };
      }),
    [tagCache, tags],
  );
  const selectedTagSummary = useMemo(() => tagSummaries.find((item) => item.tag.id === selectedTagId) ?? null, [selectedTagId, tagSummaries]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const userId = getUserId();
      if (!userId) {
        navigate("/login");
        return;
      }

      if (!courseId) return;

      try {
        const detail = await mockApi.getCourseDetail(courseId);
        if (!active) return;

        const initialTagId = detail.selectedTagId || detail.tags[0]?.id || "";
        const preloadedTagCache = Object.fromEntries(
          (detail.tagContents ?? []).map((item) => [
            item.tagId,
            {
              videos: item.initialVideos ?? detail.initialVideos ?? [],
              progress: item.initialVideoProgress ?? detail.initialVideoProgress ?? [],
            },
          ]),
        );

        setCourse(detail.course);
        setTags(detail.tags);
        setSelectedTagId(initialTagId);
        setTagCache(preloadedTagCache);

        const initialContent = preloadedTagCache[initialTagId];
        setVideos(initialContent?.videos ?? detail.initialVideos ?? []);
        setProgressList(initialContent?.progress ?? detail.initialVideoProgress ?? []);
      } catch {
        if (!active) return;
        setCourse(null);
      } finally {
        if (active) {
          setLoading(false);
          setTagLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [courseId, navigate]);

  useEffect(() => {
    let active = true;
    const loadVideos = async () => {
      if (!selectedTagId) return;
      const cached = tagCache[selectedTagId];
      if (cached) {
        setVideos(cached.videos);
        setProgressList(cached.progress);
        return;
      }

      setTagLoading(true);
      try {
        const data = await mockApi.getTagVideos(selectedTagId, "user");
        if (!active) return;
        setVideos(data.videos);
        setProgressList(data.progress);
        setTagCache((current) => ({
          ...current,
          [selectedTagId]: {
            videos: data.videos,
            progress: data.progress,
          },
        }));
      } finally {
        if (active) {
          setTagLoading(false);
        }
      }
    };

    void loadVideos();
    return () => {
      active = false;
    };
  }, [selectedTagId, tagCache]);

  const totalDuration = videos.reduce((sum, item) => sum + item.duration, 0);
  const completedCount = videos.filter((item) => progressMap.get(item.id)?.completed).length;
  const recommendedVideo = videos.find((item) => !progressMap.get(item.id)?.completed) ?? videos[0] ?? null;

  const openVideo = (videoId: string) => {
    if (!course) return;
    navigate(`/user/video-player/${course.id}/${videoId}`);
  };

  const renderMobileTagSelector = () => (
    <div className="grid grid-cols-4 gap-2.5 md:hidden">
      {tagSummaries.map((summary) => {
        const active = summary.tag.id === selectedTagId;

        return (
          <button
            key={summary.tag.id}
            type="button"
            onClick={() => setSelectedTagId(summary.tag.id)}
            className={cn(
              "min-w-0 rounded-[18px] border px-2 py-2.5 text-center text-sm font-medium tracking-[0.01em] transition-all backdrop-blur-xl",
              active
                ? "border-white/18 bg-white text-slate-950 shadow-[0_10px_24px_rgba(255,255,255,0.14)]"
                : "border-white/10 bg-white/[0.05] text-white/68",
            )}
          >
            <div className="truncate">{summary.tag.name}</div>
            <div className={cn("mt-1 text-[11px]", active ? "text-slate-700/72" : "text-white/38")}>{summary.completionRate}%</div>
          </button>
        );
      })}
    </div>
  );

  const renderTagSelectorSection = (className?: string) => (
    <section
      className={cn(
        "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px]",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-white">
        <Tags className="size-4 text-[#cdb4ff]" />
        <h3 className="text-sm font-semibold">选择标签</h3>
      </div>

      <div className="mt-4 space-y-2">
        {tagSummaries.map((summary) => {
          const active = summary.tag.id === selectedTagId;

          return (
            <button
              key={summary.tag.id}
              type="button"
              onClick={() => setSelectedTagId(summary.tag.id)}
              className={cn(
                "w-full rounded-[22px] border px-4 py-3 text-left transition-colors backdrop-blur-xl",
                active
                  ? "border-white/18 bg-white text-slate-950 shadow-[0_12px_30px_rgba(255,255,255,0.12)]"
                  : "border-white/10 bg-black/14 text-white/72 hover:border-white/16 hover:bg-black/18",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{summary.tag.name}</p>
                  <p className={cn("mt-1 text-xs", active ? "text-slate-700/72" : "text-white/42")}>
                    {summary.videoCount} 条视频 · {formatDuration(summary.totalDuration)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    active ? "bg-slate-950/8 text-slate-800" : "bg-white/[0.06] text-white/60",
                  )}
                >
                  {summary.completionRate}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedTagSummary ? (
        <div className="mt-4 space-y-3 border-t border-white/8 pt-4 text-sm text-white/56">
          <div className="flex items-center justify-between rounded-[20px] bg-white/[0.05] px-4 py-3">
            <span>当前标签</span>
            <span className="font-semibold text-white">{selectedTagSummary.tag.name}</span>
          </div>

          <div className="flex items-center justify-between rounded-[20px] bg-white/[0.05] px-4 py-3">
            <span>视频数量</span>
            <span className="font-semibold text-white">{selectedTagSummary.videoCount}</span>
          </div>

          <div className="flex items-center justify-between rounded-[20px] bg-white/[0.05] px-4 py-3">
            <span>完成情况</span>
            <span className="font-semibold text-white">
              {selectedTagSummary.completedCount}/{selectedTagSummary.videoCount}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );

  if (loading) {
    return <div className="p-8 text-white/60">课程加载中...</div>;
  }

  if (!course) {
    return <div className="p-8 text-white/60">课程不存在</div>;
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#040816] pb-24 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="relative mx-auto max-w-[1320px] px-4 py-4 md:px-6 md:py-8 xl:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/user/courses")}
            className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/76 transition hover:bg-white/[0.10]"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#8fd6ff]">Video Course</p>
            <h1 className="mt-2 truncate text-3xl font-semibold tracking-[-0.05em] text-white">{course.name}</h1>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="space-y-6">
            <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[30px]">
              <div className="grid items-start gap-4 p-4 md:p-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
                <div className="self-start overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] shadow-[0_18px_48px_rgba(0,0,0,0.24)] md:rounded-[28px]">
                  <div className="aspect-[3/2] w-full">
                    <img src={course.cover} alt={course.name} className="block h-full w-full object-cover" />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full border border-[#8fd6ff]/18 bg-[#8fd6ff]/10 px-3 py-1 text-[#8fd6ff]">
                      共 {course.contentCount} 节视频
                    </Badge>
                    <Badge variant="secondary" className="rounded-full border border-amber-300/15 bg-amber-400/10 px-3 py-1 text-amber-100">
                      视频课程
                    </Badge>
                  </div>

                  <h2 className="mt-4 text-[26px] font-semibold tracking-[-0.05em] text-white md:text-[40px] md:leading-[1.08]">{course.name}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58 md:mt-4 md:text-base md:leading-8">{course.description}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/52 md:mt-5 md:gap-x-5 md:gap-y-3">
                    <span className="inline-flex items-center gap-2">
                      <VideoIcon className="size-4 text-[#8fd6ff]" />
                      {course.contentCount} 条内容
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="size-4 text-[#8fd6ff]" />
                      总时长 {formatDuration(totalDuration)}
                    </span>
                    <span>已完成 {completedCount}/{videos.length}</span>
                  </div>
                </div>
              </div>

              {recommendedVideo ? (
                <div className="border-t border-white/8 px-4 pb-4 md:px-6 md:pb-6">
                  <div className="rounded-[22px] border border-white/10 bg-black/16 p-4 backdrop-blur-xl md:rounded-[26px] md:p-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-white">
                          <Sparkles className="size-4 text-[#8fd6ff]" />
                          <p className="text-sm font-semibold">继续学习</p>
                        </div>
                        <p className="mt-3 line-clamp-1 text-base font-semibold text-white md:text-xl">{recommendedVideo.name}</p>
                      </div>

                      <div className="lg:justify-self-end">
                        <Button className="w-full rounded-[18px] border border-white/18 bg-white px-5 text-slate-950 hover:bg-white/92 lg:w-[200px]" onClick={() => openVideo(recommendedVideo.id)}>
                          进入视频
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            {tagSummaries.length > 0 ? renderMobileTagSelector() : null}

            <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[30px] md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedTag?.name || "视频列表"}</h3>
                  <p className="mt-1 text-sm text-white/54">点击视频即可进入播放页。</p>
                </div>

                {selectedTagSummary ? (
                  <Badge variant="secondary" className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-white/70">
                    当前标签进度 {selectedTagSummary.completionRate}%
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4 space-y-3 md:space-y-4">
                {tagLoading ? (
                  <div className="rounded-[22px] border border-white/10 bg-black/16 px-5 py-12 text-center text-sm text-white/54">内容加载中...</div>
                ) : videos.length === 0 ? (
                  <div className="rounded-[22px] border border-white/10 bg-black/16 px-5 py-12 text-center text-sm text-white/54">暂无视频内容</div>
                ) : (
                  videos.map((video) => {
                    const progress = progressMap.get(video.id);
                    const percent = formatPercent(progress?.progress ?? 0, video.duration);

                    return (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => openVideo(video.id)}
                        className="w-full rounded-[22px] border border-white/10 bg-black/16 px-4 py-4 text-left transition backdrop-blur-xl hover:-translate-y-0.5 hover:border-white/16 hover:bg-black/20"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-3 md:gap-4">
                              <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.06] text-[#8fd6ff]">
                                <PlayCircle className="size-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-[15px] font-semibold text-white md:text-lg">{video.name}</h4>
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/50">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Clock3 className="size-4" />
                                    {formatDuration(video.duration)}
                                  </span>
                                  <span>上次观看 {formatDuration(progress?.progress ?? 0)}</span>
                                </div>
                                <div className="mt-4">
                                  <div className="mb-2 flex items-center justify-between text-xs text-white/38">
                                    <span>学习进度</span>
                                    <span>{progress?.completed ? "100%" : `${percent}%`}</span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className={cn("h-full rounded-full transition-all", progress?.completed ? "bg-emerald-400" : "bg-[#4f84ff]")}
                                      style={{ width: `${progress?.completed ? 100 : percent}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center justify-start text-sm font-medium text-[#8fd6ff] lg:min-w-[96px] lg:justify-end">
                            进入视频
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </main>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:h-fit">
            {tagSummaries.length > 0 ? renderTagSelectorSection("hidden md:block") : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
