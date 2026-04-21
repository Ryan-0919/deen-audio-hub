import { ArrowLeft, FileDown, Loader2, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Slider } from "../../components/ui/slider";
import { cn } from "../../components/ui/utils";
import { Audio, Course, Tag, mockApi } from "../../lib/mockData";
import { getUserId } from "../../lib/user-session";

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];
const LOOP_MODES = ["sequence", "single"] as const;

type LoopMode = (typeof LOOP_MODES)[number];

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

export function AudioPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, audioId } = useParams<{ courseId: string; audioId: string }>();

  const [audio, setAudio] = useState<Audio | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [tag, setTag] = useState<Tag | null>(null);
  const [prevAudio, setPrevAudio] = useState<Audio | undefined>();
  const [nextAudio, setNextAudio] = useState<Audio | undefined>();
  const [firstAudio, setFirstAudio] = useState<Audio | undefined>();
  const [lastAudio, setLastAudio] = useState<Audio | undefined>();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [playerDiscImageUrl, setPlayerDiscImageUrl] = useState("");
  const [downloadingHandout, setDownloadingHandout] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const savedRate = Number(window.localStorage.getItem("userPlaybackRate") ?? "1");
    return PLAYBACK_RATES.includes(savedRate) ? savedRate : 1;
  });
  const [loopMode, setLoopMode] = useState<LoopMode>(() => {
    if (typeof window === "undefined") return "sequence";
    const savedMode = window.localStorage.getItem("userLoopMode");
    return LOOP_MODES.includes(savedMode as LoopMode) ? (savedMode as LoopMode) : "sequence";
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef(0);
  const hasCompletedRef = useRef(false);
  const initialSeekRef = useRef(0);
  const saveTimeoutRef = useRef<number | null>(null);
  const autoplayRequestedRef = useRef(false);

  const saveProgress = async (position = currentTime) => {
    const userId = getUserId();
    if (!userId || !courseId || !audioId) return;
    await mockApi.saveProgress(userId, courseId, audioId, position);
  };

  const markCompleted = async () => {
    if (hasCompletedRef.current) return;

    const userId = getUserId();
    if (!userId || !courseId || !audioId) return;

    hasCompletedRef.current = true;
    setCompleted(true);
    await mockApi.markCompleted(userId, courseId, audioId, progressRef.current);
  };

  useEffect(() => {
    progressRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("userPlaybackRate", `${playbackRate}`);
    }

    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, audio]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("userLoopMode", loopMode);
    }
  }, [loopMode]);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const data = await mockApi.getBrandingConfig();
        setPlayerDiscImageUrl(data.playerDiscImageUrl ?? "");
      } catch {
        setPlayerDiscImageUrl("");
      }
    };

    void loadBranding();
  }, []);

  useEffect(() => {
    const load = async () => {
      const userId = getUserId();
      if (!userId) {
        navigate("/");
        return;
      }

      if (!courseId || !audioId) return;

      try {
        setLoading(true);
        autoplayRequestedRef.current = Boolean((location.state as { autoplay?: boolean } | null)?.autoplay);
        const [detail, progress] = await Promise.all([mockApi.getAudioDetail(audioId, courseId), mockApi.getUserProgress(userId, courseId, audioId)]);

        setAudio(detail.audio);
        setCourse(detail.course);
        setTag(detail.tag);
        setPrevAudio(detail.prev);
        setNextAudio(detail.next);
        setFirstAudio(detail.first);
        setLastAudio(detail.last);
        setDuration(detail.audio.duration ?? 0);
        setCurrentTime(progress?.progress ?? 0);
        setCompleted(progress?.completed ?? false);
        setPlayerError("");
        hasCompletedRef.current = Boolean(progress?.completed);
        initialSeekRef.current = progress?.progress ?? 0;
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
  }, [audioId, courseId, location.state, navigate]);

  const replayCurrentAudio = async () => {
    const node = audioRef.current;
    if (!node) return;

    node.currentTime = 0;
    setCurrentTime(0);
    progressRef.current = 0;

    try {
      await node.play();
    } catch {
      setPlayerError("音频已切换，请点击播放继续收听");
    }
  };

  const handleAudioEnd = async () => {
    setIsPlaying(false);
    await markCompleted();

    if (loopMode === "single") {
      await replayCurrentAudio();
      return;
    }

    if (nextAudio && courseId) {
      navigate(`/user/player/${courseId}/${nextAudio.id}`, { state: { autoplay: true } });
      return;
    }

    if (firstAudio && courseId && firstAudio.id !== audioId) {
      navigate(`/user/player/${courseId}/${firstAudio.id}`, { state: { autoplay: true } });
      return;
    }

    if (courseId) {
      await replayCurrentAudio();
    }
  };

  useEffect(() => {
    const node = audioRef.current;
    if (!node || !audio) return;

    const tryAutoplay = async () => {
      if (!autoplayRequestedRef.current) return;

      try {
        await node.play();
      } catch {
        setPlayerError("音频已切换，请点击播放继续收听");
      } finally {
        autoplayRequestedRef.current = false;
      }
    };

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
      const metadataDuration = Math.floor(node.duration || audio.duration || 0);
      setDuration(metadataDuration);
      if (initialSeekRef.current > 0) {
        node.currentTime = initialSeekRef.current;
        setCurrentTime(initialSeekRef.current);
        initialSeekRef.current = 0;
      }
      node.playbackRate = playbackRate;
      void tryAutoplay();
    };

    const onPlay = () => {
      setIsPlaying(true);
      setPlayerError("");
    };

    const onPause = () => {
      setIsPlaying(false);
      void saveProgress(Math.floor(node.currentTime || 0));
    };

    const onEnded = () => {
      void handleAudioEnd();
    };

    const onError = () => {
      setIsPlaying(false);
      setPlayerError("音频播放失败，请稍后重试");
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
  }, [audio, audioId, courseId, firstAudio, loopMode, nextAudio, playbackRate]);

  const togglePlay = async () => {
    const node = audioRef.current;
    if (!node) return;

    if (node.paused) {
      try {
        await node.play();
      } catch {
        setPlayerError("音频暂时无法播放");
      }
      return;
    }

    node.pause();
  };

  const handleSeek = (value: number[]) => {
    const nextValue = value[0];
    const node = audioRef.current;

    if (node) {
      node.currentTime = nextValue;
    }

    setCurrentTime(nextValue);

    if (duration && nextValue >= duration - 3) {
      void markCompleted();
    }

    void saveProgress(nextValue);
  };

  const handleJump = async (target?: Audio) => {
    if (!target || !courseId) return;

    if (target.id === audioId) {
      await replayCurrentAudio();
      return;
    }

    const shouldAutoplay = Boolean(audioRef.current && !audioRef.current.paused);
    audioRef.current?.pause();
    await saveProgress();
    navigate(`/user/player/${courseId}/${target.id}`, { state: { autoplay: shouldAutoplay } });
  };

  const handleBack = async () => {
    audioRef.current?.pause();
    await saveProgress();
    navigate(`/user/course/${courseId}`, { state: { course } });
  };

  const handleCyclePlaybackRate = () => {
    setPlaybackRate((currentRate) => {
      const currentIndex = PLAYBACK_RATES.indexOf(currentRate);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % PLAYBACK_RATES.length : 1;
      return PLAYBACK_RATES[nextIndex];
    });
  };

  const handleToggleLoopMode = () => {
    setLoopMode((currentMode) => (currentMode === "sequence" ? "single" : "sequence"));
  };

  const handleDownloadHandout = async () => {
    if (!courseId || !audio?.hasHandout || downloadingHandout) return;

    try {
      setDownloadingHandout(true);
      const blob = await mockApi.downloadAudioHandout(courseId, audio.id);
      const fileName = audio.handoutName || `${audio.name}-讲义`;
      triggerFileDownload(blob, fileName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "讲义下载失败");
    } finally {
      setDownloadingHandout(false);
    }
  };

  const currentPrevAudio = prevAudio ?? (loopMode === "sequence" ? lastAudio : undefined);
  const currentNextAudio = nextAudio ?? (loopMode === "sequence" ? firstAudio : undefined);
  const playerStatus = completed ? "已学完" : isPlaying ? "播放中" : currentTime > 0 ? "暂停中" : "未播放";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">音频加载中...</div>
      </div>
    );
  }

  if (!audio || !course || !tag) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">音频不存在</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <audio ref={audioRef} src={audio.audioUrl} preload="metadata" />

      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto flex h-14 max-w-sm items-center px-4">
          <button
            type="button"
            onClick={handleBack}
            className="flex size-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-slate-900">音频播放</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="hidden border-b border-slate-200/80 bg-white/95 backdrop-blur md:block">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
            >
              <ArrowLeft className="size-5" />
            </button>

            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-600">音频播放</p>
              <h1 className="truncate text-2xl font-semibold tracking-[-0.03em] text-slate-900">{audio.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-600">{course.name}</span>
            <span className="rounded-full bg-blue-50 px-4 py-2 text-blue-700">{tag.name}</span>
            <span className="rounded-full bg-slate-900 px-4 py-2 text-white">{playerStatus}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-8 xl:px-8">
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-8 xl:h-fit">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col items-center text-center">
                <div
                  className={cn(
                    "relative flex size-40 items-center justify-center overflow-hidden rounded-full border-[6px] border-blue-100 bg-blue-50 shadow-sm md:size-48",
                    isPlaying && "animate-[spin_10s_linear_infinite]",
                  )}
                >
                  {playerDiscImageUrl ? (
                    <img src={playerDiscImageUrl} alt="播放器图片" className="size-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-blue-50" />
                  )}
                </div>

                <h2 className="mt-5 text-2xl font-semibold text-slate-900">{audio.name}</h2>
                <p className="mt-2 text-sm text-slate-500">{course.name}</p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{tag.name}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{playerStatus}</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{formatTime(currentTime)}</span>
                <span>总时长 {formatTime(duration)}</span>
              </div>

              <div className="mt-3">
                <Slider value={[currentTime]} max={duration || 1} step={1} onValueChange={handleSeek} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleToggleLoopMode}
                  className={cn(
                    "h-auto flex-col items-start rounded-2xl border-slate-200 px-4 py-3 text-left shadow-none",
                    loopMode === "single" && "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
                  )}
                >
                  <span className="text-xs font-medium text-slate-400">循环模式</span>
                  <span className="mt-1 flex items-center text-sm font-semibold">
                    {loopMode === "single" ? <Repeat1 className="mr-2 size-4" /> : <Repeat className="mr-2 size-4" />}
                    {loopMode === "single" ? "单曲循环" : "顺序循环"}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCyclePlaybackRate}
                  className="h-auto flex-col items-start rounded-2xl border-slate-200 px-4 py-3 text-left shadow-none"
                >
                  <span className="text-xs font-medium text-slate-400">播放速度</span>
                  <span className="mt-1 text-sm font-semibold text-slate-900">倍速 {playbackRate}x</span>
                </Button>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => void handleJump(currentPrevAudio)}
                  disabled={!currentPrevAudio}
                  className="h-12 flex-1 rounded-full px-4"
                >
                  <SkipBack className="mr-2 size-5" />
                  上一条
                </Button>

                <Button onClick={togglePlay} className="size-16 shrink-0 rounded-full bg-blue-600 p-0 text-white hover:bg-blue-700">
                  {isPlaying ? <Pause className="size-7" /> : <Play className="ml-1 size-7" />}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => void handleJump(currentNextAudio)}
                  disabled={!currentNextAudio}
                  className="h-12 flex-1 rounded-full px-4"
                >
                  下一条
                  <SkipForward className="ml-2 size-5" />
                </Button>
              </div>
            </section>
          </aside>

          <section className="min-h-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 md:p-6">
              {audio.hasHandout ? (
                <div className="mb-4 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleDownloadHandout()}
                    disabled={downloadingHandout}
                    className="rounded-full"
                  >
                    {downloadingHandout ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />}
                    下载讲义
                  </Button>
                </div>
              ) : null}

              {playerError ? (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{playerError}</div>
              ) : null}

              <div className="overflow-hidden rounded-2xl bg-slate-50">
                <div className="max-h-[calc(100vh-260px)] min-h-[360px] overflow-y-auto px-4 py-4 text-[15px] leading-8 text-slate-700 md:px-6 md:py-6 md:text-base md:leading-8">
                  {audio.script ? (
                    <div className="whitespace-pre-wrap">{audio.script}</div>
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center text-center text-sm text-slate-400">暂无文案内容</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {audio.hasHandout ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 md:bottom-8">
          <div className="mx-auto flex max-w-7xl justify-end px-4 md:px-6 xl:px-8">
            <button
              type="button"
              onClick={() => void handleDownloadHandout()}
              disabled={downloadingHandout}
              className="pointer-events-auto flex size-16 flex-col items-center justify-center rounded-full bg-[linear-gradient(180deg,#2563eb_0%,#1d4ed8_100%)] text-white shadow-[0_18px_45px_rgba(37,99,235,0.35)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-80 md:hidden"
            >
              {downloadingHandout ? <Loader2 className="size-5 animate-spin" /> : <FileDown className="size-5" />}
              <span className="mt-1 text-[11px] font-medium leading-none">讲义</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
