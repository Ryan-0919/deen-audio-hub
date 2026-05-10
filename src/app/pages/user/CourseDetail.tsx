import { ArrowLeft, Clock3, ListMusic, PlayCircle, Sparkles, Tags } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import { Audio, Course, Tag, UserProgress, mockApi } from "../../lib/mockData";
import { saveRecentCourseSnapshot } from "../../lib/recent-course";
import { getUserId } from "../../lib/user-session";

type TagContent = {
  audios: Audio[];
  progress: UserProgress[];
};

type CourseAudioEntry = {
  tagId: string;
  tagName: string;
  audio: Audio;
  progress?: UserProgress;
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatProgress = (seconds = 0) => formatDuration(seconds);
const formatPercent = (progress = 0, duration = 0) => (duration ? Math.min(100, Math.round((progress / duration) * 100)) : 0);

const getProgressTimestamp = (progress?: UserProgress) => {
  if (!progress?.lastUpdated) return 0;
  const time = new Date(progress.lastUpdated).getTime();
  return Number.isFinite(time) ? time : 0;
};

const pickInitialTagId = (tags: Tag[], tagContents: Record<string, TagContent>) => {
  let resumeTagId = "";
  let latestTimestamp = -1;

  for (const tag of tags) {
    const content = tagContents[tag.id];
    if (!content) continue;

    for (const progress of content.progress) {
      if ((progress.progress ?? 0) <= 0 || progress.completed) continue;
      const timestamp = getProgressTimestamp(progress);
      if (timestamp > latestTimestamp) {
        latestTimestamp = timestamp;
        resumeTagId = tag.id;
      }
    }
  }

  if (resumeTagId) return resumeTagId;

  for (const tag of tags) {
    const content = tagContents[tag.id];
    if (!content) continue;
    const progressMap = new Map(content.progress.map((item) => [item.audioId, item]));
    if (content.audios.some((audio) => !progressMap.get(audio.id)?.completed)) {
      return tag.id;
    }
  }

  return tags[0]?.id ?? "";
};

const getActionLabel = (progress?: UserProgress) => {
  if (progress?.completed) return "重新播放";
  if ((progress?.progress ?? 0) > 0) return "继续播放";
  return "开始学习";
};

export function CourseDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId } = useParams<{ courseId: string }>();
  const stateCourse = (location.state as { course?: Course } | null)?.course;
  const seededCourse = stateCourse && stateCourse.id === courseId ? stateCourse : null;

  const [course, setCourse] = useState<Course | null>(seededCourse);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [audios, setAudios] = useState<Audio[]>([]);
  const [progressList, setProgressList] = useState<UserProgress[]>([]);
  const [tagCache, setTagCache] = useState<Record<string, TagContent>>({});
  const [loading, setLoading] = useState(!seededCourse);
  const [tagLoading, setTagLoading] = useState(Boolean(seededCourse));
  const recentOpenPersistedRef = useRef("");

  const cachedTagContent = selectedTagId ? tagCache[selectedTagId] : undefined;
  const selectedTag = useMemo(() => tags.find((tag) => tag.id === selectedTagId) ?? null, [selectedTagId, tags]);
  const selectedProgressMap = useMemo(() => new Map(progressList.map((item) => [item.audioId, item])), [progressList]);

  const tagSummaries = useMemo(
    () =>
      tags.map((tag) => {
        const content = tagCache[tag.id] ?? { audios: [], progress: [] };
        const progressMap = new Map(content.progress.map((item) => [item.audioId, item]));
        const completedCount = content.audios.filter((audio) => progressMap.get(audio.id)?.completed).length;
        const totalDuration = content.audios.reduce((sum, audio) => sum + audio.duration, 0);

        return {
          tag,
          audioCount: content.audios.length,
          completedCount,
          totalDuration,
          completionRate: content.audios.length ? Math.min(100, Math.round((completedCount / content.audios.length) * 100)) : 0,
        };
      }),
    [tagCache, tags],
  );

  const selectedTagSummary = useMemo(() => tagSummaries.find((item) => item.tag.id === selectedTagId) ?? null, [selectedTagId, tagSummaries]);

  const allAudioEntries = useMemo(() => {
    const seen = new Set<string>();

    return tags.flatMap((tag) => {
      const content = tagCache[tag.id];
      if (!content) return [];

      const progressMap = new Map(content.progress.map((item) => [item.audioId, item]));
      return content.audios.flatMap((audio) => {
        if (seen.has(audio.id)) return [];
        seen.add(audio.id);
        return [
          {
            tagId: tag.id,
            tagName: tag.name,
            audio,
            progress: progressMap.get(audio.id),
          },
        ];
      });
    });
  }, [tagCache, tags]);

  const courseCompletedCount = useMemo(() => allAudioEntries.filter((item) => item.progress?.completed).length, [allAudioEntries]);
  const courseTotalDuration = useMemo(() => allAudioEntries.reduce((sum, item) => sum + item.audio.duration, 0), [allAudioEntries]);
  const courseCompletionRate = useMemo(() => {
    if (!allAudioEntries.length) return 0;
    return Math.min(100, Math.round((courseCompletedCount / allAudioEntries.length) * 100));
  }, [allAudioEntries.length, courseCompletedCount]);

  const recommendedEntry = useMemo(() => {
    const resumed = [...allAudioEntries]
      .filter((item) => (item.progress?.progress ?? 0) > 0 && !item.progress?.completed)
      .sort((a, b) => getProgressTimestamp(b.progress) - getProgressTimestamp(a.progress))[0];

    if (resumed) {
      return { entry: resumed, mode: "resume" as const };
    }

    const firstUnfinished = allAudioEntries.find((item) => !item.progress?.completed);
    if (firstUnfinished) {
      return {
        entry: firstUnfinished,
        mode: (firstUnfinished.progress?.progress ?? 0) > 0 ? ("resume" as const) : ("start" as const),
      };
    }

    const firstEntry = allAudioEntries[0];
    if (firstEntry) {
      return { entry: firstEntry, mode: "replay" as const };
    }

    return null;
  }, [allAudioEntries]);

  useEffect(() => {
    const userId = getUserId();
    const targetAudioId = recommendedEntry?.entry.audio.id;

    if (!userId || !course?.id || !targetAudioId) {
      return;
    }

    const persistKey = `${course.id}:${targetAudioId}`;
    if (recentOpenPersistedRef.current === persistKey) {
      return;
    }

    recentOpenPersistedRef.current = persistKey;
    void mockApi.saveProgress(userId, course.id, targetAudioId, recommendedEntry?.entry.progress?.progress ?? 0).catch(() => {
      recentOpenPersistedRef.current = "";
    });

    saveRecentCourseSnapshot(userId, {
      courseId: course.id,
      courseName: course.name,
      audioId: targetAudioId,
      audioName: recommendedEntry.entry.audio.name,
      tagName: recommendedEntry.entry.tagName,
      progressSeconds: Math.max(0, recommendedEntry?.entry.progress?.progress ?? 0),
      durationSeconds: Math.max(0, recommendedEntry.entry.audio.duration ?? 0),
      progressPercent: formatPercent(
        Math.max(0, recommendedEntry?.entry.progress?.progress ?? 0),
        Math.max(0, recommendedEntry.entry.audio.duration ?? 0),
      ),
      completed: Boolean(recommendedEntry.entry.progress?.completed),
      lastUpdated: new Date().toISOString(),
    });
  }, [course?.id, recommendedEntry]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const userId = getUserId();
      if (!userId) {
        navigate("/login");
        return;
      }

      if (!courseId) {
        if (active) {
          setLoading(false);
          setTagLoading(false);
        }
        return;
      }

      try {
        if (active) {
          setLoading(!seededCourse);
          setTagLoading(Boolean(seededCourse));
          setCourse(seededCourse);
          setTags([]);
          setSelectedTagId("");
          setAudios([]);
          setProgressList([]);
          setTagCache({});
        }

        const detail = await mockApi.getCourseDetail(courseId);
        if (!active) return;

        const preloadedTagCache = Object.fromEntries(
          (detail.tagContents ?? []).map((item) => [
            item.tagId,
            {
              audios: item.audios,
              progress: item.progress,
            },
          ]),
        );

        const recommendedTagId = pickInitialTagId(detail.tags, preloadedTagCache);
        const initialTagId = recommendedTagId || detail.selectedTagId || detail.tags[0]?.id || "";
        const initialTagContent = preloadedTagCache[initialTagId] ?? {
          audios: detail.initialAudios ?? [],
          progress: detail.initialProgress ?? [],
        };
        const nextTagCache =
          initialTagId && !preloadedTagCache[initialTagId]
            ? {
                ...preloadedTagCache,
                [initialTagId]: initialTagContent,
              }
            : preloadedTagCache;

        setCourse(detail.course);
        setTags(detail.tags);
        setTagCache(nextTagCache);

        if (initialTagId) {
          setSelectedTagId(initialTagId);
          setAudios(initialTagContent.audios);
          setProgressList(initialTagContent.progress);
        }
      } catch {
        if (!active) return;
        setCourse(null);
        setTags([]);
        setSelectedTagId("");
        setAudios([]);
        setProgressList([]);
        setTagCache({});
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
  }, [courseId, navigate, seededCourse]);

  useEffect(() => {
    let active = true;

    const loadTagAudios = async () => {
      if (!selectedTagId) {
        setTagLoading(false);
        return;
      }

      if (cachedTagContent) {
        if (!active) return;
        setTagLoading(false);
        setAudios(cachedTagContent.audios);
        setProgressList(cachedTagContent.progress);
        return;
      }

      setTagLoading(true);
      setAudios([]);
      setProgressList([]);

      try {
        const data = await mockApi.getTagAudios(selectedTagId, "user");
        if (!active) return;
        setAudios(data.audios);
        setProgressList(data.progress);
        setTagCache((current) => ({
          ...current,
          [selectedTagId]: data,
        }));
      } finally {
        if (active) {
          setTagLoading(false);
        }
      }
    };

    void loadTagAudios();

    return () => {
      active = false;
    };
  }, [cachedTagContent, selectedTagId]);

  const handleOpenAudio = (targetAudioId: string, autoplay = true) => {
    if (!course) return;
    navigate(`/user/player/${course.id}/${targetAudioId}`, { state: { autoplay } });
  };

  const renderMobileTagSelector = () => (
    <div className="-mx-1 overflow-x-auto px-1 pb-1 md:hidden">
      <div className="flex min-w-max items-center gap-2.5">
        {tagSummaries.map((summary) => {
          const active = summary.tag.id === selectedTagId;

          return (
            <button
              key={summary.tag.id}
              type="button"
              onClick={() => setSelectedTagId(summary.tag.id)}
              className={cn(
                "rounded-full border px-4 py-2.5 text-sm font-medium tracking-[0.01em] transition-all backdrop-blur-xl",
                active
                  ? "border-white/18 bg-white text-slate-950 shadow-[0_10px_24px_rgba(255,255,255,0.14)]"
                  : "border-white/10 bg-white/[0.05] text-white/68",
              )}
            >
              <span>{summary.tag.name}</span>
              <span className={cn("ml-2 text-[11px]", active ? "text-slate-700/72" : "text-white/38")}>{summary.completionRate}%</span>
            </button>
          );
        })}
      </div>
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
                    {summary.audioCount} 条音频 · {formatDuration(summary.totalDuration)}
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
            <span>音频数量</span>
            <span className="font-semibold text-white">{selectedTagSummary.audioCount}</span>
          </div>

          <div className="flex items-center justify-between rounded-[20px] bg-white/[0.05] px-4 py-3">
            <span>完成情况</span>
            <span className="font-semibold text-white">
              {selectedTagSummary.completedCount}/{selectedTagSummary.audioCount}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );

  const renderCourseOverviewSection = (className?: string, compact = false) => (
    <section
      className={cn(
        "rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[28px] md:p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-white">
        <ListMusic className="size-4 text-[#8fd6ff]" />
        <h3 className="text-sm font-semibold">学习概览</h3>
      </div>

      {compact ? (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/56">
          <div className="rounded-[20px] bg-white/[0.05] px-4 py-3">
            <div className="text-xs text-white/42">课程音频</div>
            <div className="mt-2 text-lg font-semibold text-white">{allAudioEntries.length || course.audioCount}</div>
          </div>

          <div className="rounded-[20px] bg-white/[0.05] px-4 py-3">
            <div className="text-xs text-white/42">课程总时长</div>
            <div className="mt-2 text-lg font-semibold text-white">{formatDuration(courseTotalDuration)}</div>
          </div>

          <div className="col-span-2 rounded-[20px] bg-white/[0.05] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-white/56">完成进度</span>
              <span className="text-lg font-semibold text-white">{courseCompletionRate}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3 text-sm text-white/56">
          <div className="flex items-center justify-between rounded-[20px] bg-white/[0.05] px-4 py-3">
            <span>课程音频</span>
            <span className="font-semibold text-white">{allAudioEntries.length || course.audioCount}</span>
          </div>

          <div className="flex items-center justify-between rounded-[20px] bg-white/[0.05] px-4 py-3">
            <span>课程总时长</span>
            <span className="font-semibold text-white">{formatDuration(courseTotalDuration)}</span>
          </div>

          <div className="flex items-center justify-between rounded-[20px] bg-white/[0.05] px-4 py-3">
            <span>完成进度</span>
            <span className="font-semibold text-white">{courseCompletionRate}%</span>
          </div>
        </div>
      )}
    </section>
  );

  if (loading) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#040816] px-4 py-6 text-white md:px-6 md:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
        <div className="relative mx-auto max-w-7xl rounded-[30px] border border-white/10 bg-white/[0.05] p-10 text-center text-white/58 backdrop-blur-xl">
          课程加载中...
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#040816] px-4 py-6 text-white md:px-6 md:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
        <div className="relative mx-auto max-w-7xl rounded-[30px] border border-white/10 bg-white/[0.05] p-10 text-center text-white/58 backdrop-blur-xl">
          课程不存在
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#040816] pb-24 text-white selection:bg-[#dff8ff] selection:text-[#061120]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[320px] h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />

      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#06101d]/88 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex h-14 max-w-sm items-center px-4 text-white">
          <button
            type="button"
            onClick={() => navigate("/user/courses")}
            className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/76 transition hover:bg-white/[0.10]"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate px-3 text-center text-base font-semibold text-white">{course.name}</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="relative mx-auto max-w-[1320px] px-4 py-4 md:px-6 md:py-8 xl:px-8">
        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => navigate("/user/courses")}
            className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/76 transition hover:bg-white/[0.10]"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#8fd6ff]">Course Detail</p>
            <h1 className="mt-2 truncate text-3xl font-semibold tracking-[-0.05em] text-white">{course.name}</h1>
          </div>
        </div>

        <div className="mt-0 grid gap-5 md:mt-6 xl:grid-cols-[minmax(0,1fr)_320px]">
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
                      共 {course.audioCount} 条音频
                    </Badge>
                    {recommendedEntry ? (
                      <Badge variant="secondary" className="rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                        推荐从 {recommendedEntry.entry.tagName} 开始
                      </Badge>
                    ) : null}
                  </div>

                  <h2 className="mt-4 text-[26px] font-semibold tracking-[-0.05em] text-white md:text-[40px] md:leading-[1.08]">
                    {course.name}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58 md:mt-4 md:text-base md:leading-8">{course.description}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/52 md:mt-5 md:gap-x-5 md:gap-y-3">
                    <span className="inline-flex items-center gap-2">
                      <ListMusic className="size-4 text-[#8fd6ff]" />
                      {allAudioEntries.length || course.audioCount} 条内容
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="size-4 text-[#8fd6ff]" />
                      总时长 {formatDuration(courseTotalDuration)}
                    </span>
                    <span>已完成 {courseCompletedCount}/{allAudioEntries.length || course.audioCount}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/8 px-4 pb-4 md:px-6 md:pb-6">
                <div className="rounded-[22px] border border-white/10 bg-black/16 p-4 backdrop-blur-xl md:rounded-[26px] md:p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-white">
                        <Sparkles className="size-4 text-[#8fd6ff]" />
                        <p className="text-sm font-semibold">继续学习</p>
                      </div>

                      {recommendedEntry ? (
                        <>
                          <p className="mt-3 line-clamp-1 text-base font-semibold text-white md:text-xl">{recommendedEntry.entry.audio.name}</p>
                          <p className="mt-1 text-sm leading-6 text-white/54 md:leading-7">
                            {recommendedEntry.entry.tagName}
                            {(recommendedEntry.entry.progress?.progress ?? 0) > 0
                              ? ` · 上次听到 ${formatProgress(recommendedEntry.entry.progress?.progress)}`
                              : " · 从这里开始学习"}
                          </p>
                        </>
                      ) : (
                        <p className="mt-3 text-sm leading-7 text-white/54">当前课程还没有可播放的音频内容。</p>
                      )}
                    </div>

                    {recommendedEntry ? (
                      <div className="lg:justify-self-end">
                        <Button
                          className="w-full rounded-[18px] border border-white/18 bg-white px-5 text-slate-950 hover:bg-white/92 lg:w-[200px]"
                          onClick={() => handleOpenAudio(recommendedEntry.entry.audio.id, true)}
                        >
                          {recommendedEntry.mode === "resume" ? "继续播放" : recommendedEntry.mode === "start" ? "开始学习" : "重新播放"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {renderCourseOverviewSection("xl:hidden", true)}

            {tagSummaries.length > 0 ? renderMobileTagSelector() : null}

            <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[30px] md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedTag?.name || "音频列表"}</h3>
                  <p className="mt-1 text-sm text-white/54">
                    {selectedTagSummary
                      ? `${selectedTagSummary.audioCount} 条音频 · 已完成 ${selectedTagSummary.completedCount} 条`
                      : "点击音频即可进入播放页。"}
                  </p>
                </div>

                {selectedTagSummary ? (
                  <Badge variant="secondary" className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-white/70">
                    当前标签进度 {selectedTagSummary.completionRate}%
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4 space-y-3 md:space-y-4">
                {tagLoading ? (
                  <div className="rounded-[22px] border border-white/10 bg-black/16 px-5 py-12 text-center text-sm text-white/54 md:rounded-[26px] md:px-6 md:py-14">内容加载中...</div>
                ) : audios.length === 0 ? (
                  <div className="rounded-[22px] border border-white/10 bg-black/16 px-5 py-12 text-center text-sm text-white/54 md:rounded-[26px] md:px-6 md:py-14">暂无音频内容</div>
                ) : (
                  audios.map((audio) => {
                    const progress = selectedProgressMap.get(audio.id);
                    const completed = progress?.completed ?? false;
                    const percent = formatPercent(progress?.progress ?? 0, audio.duration);

                    return (
                      <button
                        key={audio.id}
                        type="button"
                        onClick={() => handleOpenAudio(audio.id, true)}
                        className="w-full rounded-[22px] border border-white/10 bg-black/16 px-4 py-4 text-left transition backdrop-blur-xl hover:-translate-y-0.5 hover:border-white/16 hover:bg-black/20 hover:shadow-[0_18px_48px_rgba(0,0,0,0.22)] md:rounded-[26px] md:px-5 md:py-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-3 md:gap-4">
                              <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.06] text-[#8fd6ff]">
                                <PlayCircle className="size-5" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-[15px] font-semibold text-white md:text-lg">{audio.name}</h4>
                                  <span
                                    className={cn(
                                      "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                                      completed
                                        ? "border-emerald-300/15 bg-emerald-400/10 text-emerald-200"
                                        : "border-white/10 bg-white/[0.05] text-white/60",
                                    )}
                                  >
                                    {completed ? "已学完" : getActionLabel(progress)}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/50">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Clock3 className="size-4" />
                                    {formatDuration(audio.duration)}
                                  </span>
                                  <span>上次播放 {formatProgress(progress?.progress)}</span>
                                </div>

                                <div className="mt-4">
                                  <div className="mb-2 flex items-center justify-between text-xs text-white/38">
                                    <span>学习进度</span>
                                    <span>{completed ? "100%" : `${percent}%`}</span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className={cn("h-full rounded-full transition-all", completed ? "bg-emerald-400" : "bg-[#4f84ff]")}
                                      style={{ width: `${completed ? 100 : percent}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center justify-start text-sm font-medium text-[#8fd6ff] lg:min-w-[96px] lg:justify-end">
                            {getActionLabel(progress)}
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
            {renderCourseOverviewSection("hidden xl:block")}

            {tagSummaries.length > 0 ? renderTagSelectorSection("hidden md:block") : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
