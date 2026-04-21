import { ArrowLeft, Clock3, ListMusic, PlayCircle, Sparkles, Tags } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import { Audio, Course, Tag, UserProgress, mockApi } from "../../lib/mockData";
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
    let active = true;

    const load = async () => {
      const userId = getUserId();
      if (!userId) {
        navigate("/");
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
      <div className="flex min-w-max items-center gap-2">
        {tagSummaries.map((summary) => {
          const active = summary.tag.id === selectedTagId;

          return (
            <button
              key={summary.tag.id}
              type="button"
              onClick={() => setSelectedTagId(summary.tag.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium tracking-[0.01em] transition-all",
                active
                  ? "border-blue-500 bg-blue-500 text-white shadow-[0_8px_20px_rgba(59,130,246,0.22)]"
                  : "border-slate-200 bg-white text-slate-700 shadow-[0_3px_10px_rgba(15,23,42,0.05)]",
              )}
            >
              {summary.tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderTagSelectorSection = (className?: string) => (
    <section className={cn("rounded-3xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <div className="flex items-center gap-2 text-slate-900">
        <Tags className="size-4 text-blue-600" />
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
                "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{summary.tag.name}</p>
                  <p className={cn("mt-1 text-xs", active ? "text-blue-100" : "text-slate-500")}>
                    {summary.audioCount} 条音频 · {formatDuration(summary.totalDuration)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    active ? "bg-white/15 text-white" : "bg-white text-slate-600",
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
        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-sm text-slate-600">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span>当前标签</span>
            <span className="font-semibold text-slate-900">{selectedTagSummary.tag.name}</span>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span>音频数量</span>
            <span className="font-semibold text-slate-900">{selectedTagSummary.audioCount}</span>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span>完成情况</span>
            <span className="font-semibold text-slate-900">
              {selectedTagSummary.completedCount}/{selectedTagSummary.audioCount}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );

  if (loading) {
    return (
      <div className="min-h-full bg-[#f6f8fb] px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">课程加载中...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-full bg-[#f6f8fb] px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">课程不存在</div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f6f8fb]">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto flex h-14 max-w-sm items-center px-4">
          <button
            type="button"
            onClick={() => navigate("/user/courses")}
            className="flex size-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate px-3 text-center text-base font-semibold text-slate-900">{course.name}</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-8 xl:px-8">
        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => navigate("/user/courses")}
            className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-600">课程详情</p>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-[-0.03em] text-slate-900">{course.name}</h1>
          </div>
        </div>

        <div className="mt-0 grid gap-6 md:mt-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="grid items-start gap-5 p-5 md:p-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
                <div className="self-start overflow-hidden rounded-3xl bg-slate-100">
                  <div className="aspect-[3/2] w-full">
                    <img src={course.cover} alt={course.name} className="block h-full w-full object-cover" />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="bg-blue-50 text-blue-600">
                      共 {course.audioCount} 条音频
                    </Badge>
                    {recommendedEntry ? (
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                        推荐从 {recommendedEntry.entry.tagName} 开始
                      </Badge>
                    ) : null}
                  </div>

                  <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-900 md:text-[40px] md:leading-[1.08]">
                    {course.name}
                  </h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500 md:text-base md:leading-8">{course.description}</p>

                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <ListMusic className="size-4 text-blue-600" />
                      {allAudioEntries.length || course.audioCount} 条内容
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="size-4 text-blue-600" />
                      总时长 {formatDuration(courseTotalDuration)}
                    </span>
                    <span>已完成 {courseCompletedCount}/{allAudioEntries.length || course.audioCount}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 px-5 pb-5 md:px-6 md:pb-6">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-slate-900">
                        <Sparkles className="size-4 text-blue-600" />
                        <p className="text-sm font-semibold">继续学习</p>
                      </div>

                      {recommendedEntry ? (
                        <>
                          <p className="mt-3 line-clamp-1 text-lg font-semibold text-slate-900 md:text-xl">{recommendedEntry.entry.audio.name}</p>
                          <p className="mt-1 text-sm leading-7 text-slate-500">
                            {recommendedEntry.entry.tagName}
                            {(recommendedEntry.entry.progress?.progress ?? 0) > 0
                              ? ` · 上次听到 ${formatProgress(recommendedEntry.entry.progress?.progress)}`
                              : " · 从这里开始学习"}
                          </p>
                        </>
                      ) : (
                        <p className="mt-3 text-sm leading-7 text-slate-500">当前课程还没有可播放的音频内容。</p>
                      )}
                    </div>

                    {recommendedEntry ? (
                      <div className="lg:justify-self-end">
                        <Button className="w-full rounded-2xl lg:w-[200px]" onClick={() => handleOpenAudio(recommendedEntry.entry.audio.id, true)}>
                          {recommendedEntry.mode === "resume" ? "继续播放" : recommendedEntry.mode === "start" ? "开始学习" : "重新播放"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {tagSummaries.length > 0 ? renderMobileTagSelector() : null}

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedTag?.name || "音频列表"}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedTagSummary
                      ? `${selectedTagSummary.audioCount} 条音频 · 已完成 ${selectedTagSummary.completedCount} 条`
                      : "点击音频即可进入播放页。"}
                  </p>
                </div>

                {selectedTagSummary ? (
                  <Badge variant="secondary" className="bg-blue-50 px-4 py-2 text-blue-700">
                    当前标签进度 {selectedTagSummary.completionRate}%
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4 space-y-3 md:space-y-4">
                {tagLoading ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">内容加载中...</div>
                ) : audios.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">暂无音频内容</div>
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
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-blue-200 hover:bg-white hover:shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:px-5 md:py-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-3 md:gap-4">
                              <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                <PlayCircle className="size-5" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-semibold text-slate-900 md:text-lg">{audio.name}</h4>
                                  <span
                                    className={cn(
                                      "rounded-full px-2.5 py-1 text-[11px] font-medium",
                                      completed ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-600",
                                    )}
                                  >
                                    {completed ? "已学完" : getActionLabel(progress)}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Clock3 className="size-4" />
                                    {formatDuration(audio.duration)}
                                  </span>
                                  <span>上次播放 {formatProgress(progress?.progress)}</span>
                                </div>

                                <div className="mt-4">
                                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                                    <span>学习进度</span>
                                    <span>{completed ? "100%" : `${percent}%`}</span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                                    <div
                                      className={cn("h-full rounded-full transition-all", completed ? "bg-emerald-500" : "bg-blue-600")}
                                      style={{ width: `${completed ? 100 : percent}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center justify-end text-sm font-medium text-blue-600 lg:min-w-[96px]">
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
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <ListMusic className="size-4 text-blue-600" />
                <h3 className="text-sm font-semibold">学习概览</h3>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>课程音频</span>
                  <span className="font-semibold text-slate-900">{allAudioEntries.length}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>课程总时长</span>
                  <span className="font-semibold text-slate-900">{formatDuration(courseTotalDuration)}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>完成进度</span>
                  <span className="font-semibold text-slate-900">{courseCompletionRate}%</span>
                </div>
              </div>
            </section>

            {tagSummaries.length > 0 ? renderTagSelectorSection("hidden md:block") : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
