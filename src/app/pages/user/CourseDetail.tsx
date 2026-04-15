import { ArrowLeft, CircleCheck, Clock3, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../components/ui/utils";
import { Audio, Course, Tag, UserProgress, mockApi } from "../../lib/mockData";
import { getUserId } from "../../lib/user-session";

type TagContent = {
  audios: Audio[];
  progress: UserProgress[];
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatProgress = (seconds = 0) => formatDuration(seconds);
const formatPercent = (progress = 0, duration = 0) => (duration ? Math.min(100, Math.round((progress / duration) * 100)) : 0);

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

        const initialTagId = detail.selectedTagId ?? detail.tags[0]?.id ?? "";
        const preloadedTagCache = Object.fromEntries(
          (detail.tagContents ?? []).map((item) => [
            item.tagId,
            {
              audios: item.audios,
              progress: item.progress,
            },
          ]),
        );
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
      } catch (error) {
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

  const getProgress = (audioId: string) => progressList.find((item) => item.audioId === audioId);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] px-4 py-6">
        <div className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          课程加载中...
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] px-4 py-6">
        <div className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          课程不存在
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
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

      <div className="mx-auto max-w-sm px-4 py-4">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="aspect-[3/2] bg-slate-100">
            <img src={course.cover} alt={course.name} className="h-full w-full object-cover" />
          </div>

          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-blue-50 text-blue-600">
                {course.audioCount} 条音频
              </Badge>
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{course.name}</h1>
              <p className="mt-2 text-sm leading-7 text-slate-500">{course.description}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-3">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedTagId(tag.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition-colors",
                    selectedTagId === tag.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {tagLoading ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center text-sm text-slate-500">
              内容加载中...
            </div>
          ) : audios.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center text-sm text-slate-500">
              暂无课程
            </div>
          ) : (
            audios.map((audio) => {
              const progress = getProgress(audio.id);
              const completed = progress?.completed ?? false;
              const percent = formatPercent(progress?.progress ?? 0, audio.duration);

              return (
                <button
                  key={audio.id}
                  type="button"
                  onClick={() => navigate(`/user/player/${course.id}/${audio.id}`)}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-blue-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                          <PlayCircle className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-slate-900">{audio.name}</h3>
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="size-4" />
                              {formatDuration(audio.duration)}
                            </span>
                            <span>上次播放 {formatProgress(progress?.progress)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                          <span>学习进度</span>
                          <span>{completed ? "100%" : `${percent}%`}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn("h-full rounded-full transition-all", completed ? "bg-emerald-500" : "bg-blue-600")}
                            style={{ width: `${completed ? 100 : percent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                        completed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {completed ? (
                        <span className="flex items-center gap-1">
                          <CircleCheck className="size-3.5" />
                          已学完
                        </span>
                      ) : (
                        "未学完"
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
