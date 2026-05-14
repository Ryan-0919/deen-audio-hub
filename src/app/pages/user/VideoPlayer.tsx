import { ArrowLeft, Clock3, FileDown, Pause, Play, SkipBack, SkipForward, Video as VideoIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Slider } from "../../components/ui/slider";
import { Course, Tag, UserVideoProgress, Video, mockApi } from "../../lib/mockData";
import { getUserId } from "../../lib/user-session";

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const triggerFileDownload = (blob: Blob, fileName: string) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
};

export function VideoPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, videoId } = useParams<{ courseId: string; videoId: string }>();

  const [video, setVideo] = useState<Video | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [tag, setTag] = useState<Tag | null>(null);
  const [prevVideo, setPrevVideo] = useState<Video | undefined>();
  const [nextVideo, setNextVideo] = useState<Video | undefined>();
  const [firstVideo, setFirstVideo] = useState<Video | undefined>();
  const [lastVideo, setLastVideo] = useState<Video | undefined>();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [downloadingHandout, setDownloadingHandout] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressRef = useRef(0);
  const saveTimeoutRef = useRef<number | null>(null);

  const saveProgress = async (position = currentTime) => {
    const userId = getUserId();
    if (!userId || !courseId || !videoId) return;
    await mockApi.saveVideoProgress(userId, courseId, videoId, position);
  };

  const markCompleted = async () => {
    const userId = getUserId();
    if (!userId || !courseId || !videoId) return;
    setCompleted(true);
    await mockApi.markVideoCompleted(userId, courseId, videoId, progressRef.current);
  };

  useEffect(() => {
    progressRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    const load = async () => {
      const userId = getUserId();
      if (!userId) {
        navigate("/login");
        return;
      }

      if (!courseId || !videoId) return;

      try {
        setLoading(true);
        const [detail, progress] = await Promise.all([mockApi.getVideoDetail(videoId, courseId), mockApi.getUserVideoProgress(userId, courseId, videoId)]);
        setVideo(detail.video);
        setCourse(detail.course);
        setTag(detail.tag);
        setPrevVideo(detail.prev);
        setNextVideo(detail.next);
        setFirstVideo(detail.first);
        setLastVideo(detail.last);
        setDuration(detail.video.duration ?? 0);
        setCurrentTime(progress?.progress ?? 0);
        setCompleted(progress?.completed ?? false);
      } finally {
        setLoading(false);
      }
    };

    void load();
    return () => {
      void saveProgress(progressRef.current);
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [courseId, navigate, videoId]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !video) return;

    const syncTime = () => {
      const next = Math.floor(node.currentTime || 0);
      setCurrentTime(next);
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        void saveProgress(next);
      }, 1200);
    };

    const syncMetadata = () => {
      setDuration(Math.floor(node.duration || video.duration || 0));
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      void saveProgress(Math.floor(node.currentTime || 0));
    };
    const onEnded = () => {
      setIsPlaying(false);
      void markCompleted();
    };
    const onError = () => {
      setPlayerError("视频播放失败，请稍后重试");
      setIsPlaying(false);
    };

    node.addEventListener("timeupdate", syncTime);
    node.addEventListener("loadedmetadata", syncMetadata);
    node.addEventListener("play", onPlay);
    node.addEventListener("pause", onPause);
    node.addEventListener("ended", onEnded);
    node.addEventListener("error", onError);

    if (node.readyState >= 1) {
      syncMetadata();
    }

    return () => {
      node.pause();
      node.removeEventListener("timeupdate", syncTime);
      node.removeEventListener("loadedmetadata", syncMetadata);
      node.removeEventListener("play", onPlay);
      node.removeEventListener("pause", onPause);
      node.removeEventListener("ended", onEnded);
      node.removeEventListener("error", onError);
    };
  }, [video]);

  const togglePlay = async () => {
    const node = videoRef.current;
    if (!node) return;
    if (node.paused) {
      try {
        await node.play();
      } catch {
        setPlayerError("视频暂时无法播放");
      }
      return;
    }
    node.pause();
  };

  const handleSeek = (value: number[]) => {
    const nextValue = value[0];
    const node = videoRef.current;
    if (node) {
      node.currentTime = nextValue;
    }
    setCurrentTime(nextValue);
    void saveProgress(nextValue);
  };

  const handleJump = async (target?: Video) => {
    if (!target || !courseId) return;
    await saveProgress();
    navigate(`/user/video-player/${courseId}/${target.id}`, { state: { autoplay: true } });
  };

  const handleDownloadHandout = async () => {
    if (!video?.hasHandout || downloadingHandout || !courseId) return;
    try {
      setDownloadingHandout(true);
      const blob = await mockApi.downloadVideoHandout(courseId, video.id);
      triggerFileDownload(blob, video.handoutName || `${video.name}-讲义`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "讲义下载失败");
    } finally {
      setDownloadingHandout(false);
    }
  };

  const progressPercent = useMemo(() => (duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0), [currentTime, duration]);

  if (loading) {
    return <div className="p-8 text-white/60">视频加载中...</div>;
  }

  if (!video || !course || !tag) {
    return <div className="p-8 text-white/60">视频不存在</div>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040816] pb-24 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="relative mx-auto max-w-[1320px] px-4 pb-10 pt-4 md:px-8 md:pt-8 xl:px-10">
        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[30px] md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/user/video-course/${courseId}`, { state: { course } })}
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/[0.12]"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/36">VIDEO PLAYER</div>
                <h1 className="mt-2 truncate text-[22px] font-semibold tracking-[-0.05em] text-white md:text-[34px]">{video.name}</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/64">{course.name}</span>
              <span className="rounded-full border border-[#73a9ff]/20 bg-[#3f6fff]/14 px-4 py-2 text-sm text-[#9bc3ff]">{tag.name}</span>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px]">
            <div className="aspect-video w-full bg-black">
              <video ref={videoRef} src={video.videoUrl} controls className="h-full w-full" autoPlay={Boolean((location.state as { autoplay?: boolean } | null)?.autoplay)} />
            </div>
            <div className="p-4 md:p-5">
              <div className="mb-2 flex items-center justify-between text-sm text-white/50">
                <span>{formatTime(currentTime)}</span>
                <span>总时长 {formatTime(duration)}</span>
              </div>
              <div className="rounded-full border border-white/8 bg-black/18 px-3 py-3">
                <Slider value={[currentTime]} max={duration || 1} step={1} onValueChange={handleSeek} />
              </div>
              <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-white/34">
                <span>当前进度</span>
                <span>{progressPercent}%</span>
              </div>
              {playerError ? <div className="mt-4 rounded-[20px] border border-[#ff8f8f]/18 bg-[#ff5f6d]/10 px-4 py-3 text-sm leading-6 text-[#ffc3c8]">{playerError}</div> : null}
            </div>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-8 xl:h-fit">
            <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[28px] md:p-5">
              <div className="flex items-center gap-2 text-white">
                <VideoIcon className="size-4 text-[#8fd6ff]" />
                <h3 className="text-sm font-semibold">播放控制</h3>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                <Button variant="ghost" onClick={() => void handleJump(prevVideo)} disabled={!prevVideo} className="h-11 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-3 text-white hover:bg-white/[0.10] hover:text-white disabled:opacity-40">
                  <SkipBack className="mr-2 size-5" />
                  上一条
                </Button>
                <Button onClick={togglePlay} className="size-12 shrink-0 rounded-full bg-[linear-gradient(180deg,#3d7dff_0%,#2456ff_100%)] p-0 text-white shadow-[0_18px_42px_rgba(36,86,255,0.38)] hover:brightness-110">
                  {isPlaying ? <Pause className="size-6" /> : <Play className="ml-0.5 size-6" />}
                </Button>
                <Button variant="ghost" onClick={() => void handleJump(nextVideo)} disabled={!nextVideo} className="h-11 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-3 text-white hover:bg-white/[0.10] hover:text-white disabled:opacity-40">
                  下一条
                  <SkipForward className="ml-2 size-5" />
                </Button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-white/56">
                <div className="flex items-center justify-between rounded-[20px] bg-white/[0.05] px-4 py-3">
                  <span>状态</span>
                  <span className="font-semibold text-white">{completed ? "已看完" : isPlaying ? "播放中" : currentTime > 0 ? "暂停中" : "未播放"}</span>
                </div>
                <div className="flex items-center justify-between rounded-[20px] bg-white/[0.05] px-4 py-3">
                  <span>时长</span>
                  <span className="font-semibold text-white">{formatTime(duration)}</span>
                </div>
                <div className="flex items-center justify-between rounded-[20px] bg-white/[0.05] px-4 py-3">
                  <span>进度</span>
                  <span className="font-semibold text-white">{formatTime(currentTime)}</span>
                </div>
              </div>

              {video.hasHandout ? (
                <Button type="button" variant="ghost" onClick={() => void handleDownloadHandout()} disabled={downloadingHandout} className="mt-4 w-full rounded-full border border-white/10 bg-white/[0.05] px-4 text-white hover:bg-white/[0.10] hover:text-white">
                  <FileDown className="mr-2 size-4" />
                  {downloadingHandout ? "下载中..." : "下载讲义"}
                </Button>
              ) : null}
            </section>

            <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px]">
              <div className="border-b border-white/8 px-4 py-4">
                <h2 className="text-[24px] font-semibold tracking-[-0.05em] text-white">课程文稿</h2>
              </div>
              <div className="p-3">
                <div className="min-h-[300px] overflow-hidden rounded-[20px] border border-white/8 bg-black/18">
                  <div className="h-full max-h-[56vh] overflow-y-auto px-4 py-4 text-[14px] leading-7 text-white/72">
                    {video.script ? <div className="whitespace-pre-wrap">{video.script}</div> : <div className="flex min-h-[220px] items-center justify-center text-center text-sm text-white/38">暂无文稿内容</div>}
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
