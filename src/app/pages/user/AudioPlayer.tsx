import { ArrowLeft, FileDown, Loader2, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Slider } from "../../components/ui/slider";
import { cn } from "../../components/ui/utils";
import { Audio, Course, Tag, mockApi } from "../../lib/mockData";
import { saveRecentCourseSnapshot } from "../../lib/recent-course";
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
    const userId = getUserId();
    if (!userId || !courseId || !audioId || !course || !audio || !tag) return;

    const durationSeconds = Math.max(0, Math.floor(Number(duration || audio.duration || 0)));
    const progressSeconds = Math.max(0, Math.floor(Number(currentTime || 0)));
    const progressPercent =
      durationSeconds > 0 ? Math.min(100, Math.round((progressSeconds / durationSeconds) * 100)) : 0;

    saveRecentCourseSnapshot(userId, {
      courseId,
      courseName: course.name,
      audioId,
      audioName: audio.name,
      tagName: tag.name,
      progressSeconds,
      durationSeconds,
      progressPercent,
      completed,
      lastUpdated: new Date().toISOString(),
    });
  }, [audio, audioId, completed, course, courseId, currentTime, duration, tag]);

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
        navigate("/login");
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
    void markCompleted();

    if (loopMode === "single") {
      await replayCurrentAudio();
      return;
    }

    if (nextAudio && courseId) {
      autoplayRequestedRef.current = true;
      navigate(`/user/player/${courseId}/${nextAudio.id}`, { state: { autoplay: true } });
      return;
    }

    if (firstAudio && courseId && firstAudio.id !== audioId) {
      autoplayRequestedRef.current = true;
      navigate(`/user/player/${courseId}/${firstAudio.id}`, { state: { autoplay: true } });
      return;
    }

    if (courseId) {
      await replayCurrentAudio();
    }
  };

  useEffect(() => {
    const node = audioRef.current;
    if (!node || !audio || audio.id !== audioId) return;

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
  const progressPercent = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#040816] px-5 py-12 text-white md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
        <div className="relative mx-auto flex max-w-[1320px] items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.04] px-8 py-24 text-sm uppercase tracking-[0.28em] text-white/58 backdrop-blur-xl">
          音频加载中...
        </div>
      </div>
    );
  }

  if (!audio || !course || !tag) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#040816] px-5 py-12 text-white md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
        <div className="relative mx-auto flex max-w-[1320px] items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.04] px-8 py-24 text-center text-white/58 backdrop-blur-xl">
          音频不存在
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040816] pb-24 text-white selection:bg-[#dff8ff] selection:text-[#061120]">
      <audio ref={audioRef} src={audio.audioUrl} preload="metadata" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[300px] h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />

      <div className="relative mx-auto max-w-[1320px] px-4 pb-10 pt-4 md:px-8 md:pt-8 xl:px-10">
        <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[30px] md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/[0.12]"
              >
                <ArrowLeft className="size-5" />
              </button>

              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/36">DE EN FA KAO</div>
                <h1 className="mt-2 truncate text-[22px] font-semibold tracking-[-0.05em] text-white md:text-[34px]">{audio.name}</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/64">{course.name}</span>
              <span className="rounded-full border border-[#73a9ff]/20 bg-[#3f6fff]/14 px-4 py-2 text-sm text-[#9bc3ff]">{tag.name}</span>
              <span className="rounded-full border border-white/10 bg-black/26 px-4 py-2 text-sm text-white">{playerStatus}</span>
              {audio.hasHandout ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void handleDownloadHandout()}
                  disabled={downloadingHandout}
                  className="hidden rounded-full border border-white/10 bg-white/[0.05] px-4 text-white hover:bg-white/[0.10] hover:text-white md:inline-flex"
                >
                  {downloadingHandout ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />}
                  下载讲义
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-5 xl:sticky xl:top-8 xl:h-fit">
            <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[30px] md:p-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative flex size-[148px] items-center justify-center md:size-[260px]">
                  <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.18),transparent_68%)] blur-3xl" />
                  <div
                    className={cn(
                      "relative flex size-full items-center justify-center overflow-hidden rounded-full border-[7px] border-white/12 bg-white/[0.05] shadow-[0_30px_80px_rgba(0,0,0,0.3)]",
                      isPlaying && "animate-[spin_12s_linear_infinite]",
                    )}
                  >
                    {playerDiscImageUrl ? (
                      <img src={playerDiscImageUrl} alt="播放器图片" className="size-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.22),rgba(255,255,255,0.04)_55%,rgba(255,255,255,0.02))]" />
                    )}
                  </div>
                </div>

                <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.05em] text-white md:mt-6 md:text-[28px]">{audio.name}</h2>
                <p className="mt-2 text-sm leading-6 text-white/56 md:leading-7">{course.name}</p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                  <span className="rounded-full border border-[#73a9ff]/20 bg-[#3f6fff]/14 px-3 py-1.5 text-[#9bc3ff]">{tag.name}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-white/68">{playerStatus}</span>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:hidden">
              <div className="p-3">
                <div className="min-h-[240px] overflow-hidden rounded-[20px] border border-white/8 bg-black/18">
                  <div className="max-h-[46vh] overflow-y-auto px-4 py-4 text-[14px] leading-7 text-white/72">
                    {audio.script ? (
                      <div className="whitespace-pre-wrap">{audio.script}</div>
                    ) : (
                      <div className="flex min-h-[220px] items-center justify-center text-center text-sm text-white/38">暂无文稿内容</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[28px] md:p-5">
              {playerError ? (
                <div className="mb-4 rounded-[20px] border border-[#ff8f8f]/18 bg-[#ff5f6d]/10 px-4 py-3 text-sm leading-6 text-[#ffc3c8]">
                  {playerError}
                </div>
              ) : null}

              <div className="flex items-center justify-between text-sm text-white/50">
                <span>{formatTime(currentTime)}</span>
                <span>总时长 {formatTime(duration)}</span>
              </div>

              <div className="mt-4 text-sm leading-7 text-white/48 md:hidden">
                {audio.script ? "边听边看，按自己的学习节奏通读课程文稿。" : "当前音频暂无文稿内容。"}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-white/34">
                <span>当前进度</span>
                <span>{progressPercent}%</span>
              </div>

              <div className="mt-3 rounded-full border border-white/8 bg-black/18 px-3 py-3">
                <Slider value={[currentTime]} max={duration || 1} step={1} onValueChange={handleSeek} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleToggleLoopMode}
                  className={cn(
                    "h-auto flex-col items-start rounded-[22px] border border-white/10 bg-black/16 px-4 py-3 text-left text-white shadow-none hover:bg-black/24 hover:text-white",
                    loopMode === "single" && "border-[#73a9ff]/20 bg-[#3f6fff]/12 text-[#9bc3ff]",
                  )}
                >
                  <span className="text-[11px] uppercase tracking-[0.22em] text-white/32">循环模式</span>
                  <span className="mt-2 flex items-center text-sm font-semibold">
                    {loopMode === "single" ? <Repeat1 className="mr-2 size-4" /> : <Repeat className="mr-2 size-4" />}
                    {loopMode === "single" ? "单曲循环" : "顺序循环"}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCyclePlaybackRate}
                  className="h-auto flex-col items-start rounded-[22px] border border-white/10 bg-black/16 px-4 py-3 text-left text-white shadow-none hover:bg-black/24 hover:text-white"
                >
                  <span className="text-[11px] uppercase tracking-[0.22em] text-white/32">播放速度</span>
                  <span className="mt-2 text-sm font-semibold">倍速 {playbackRate}x</span>
                </Button>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2 md:gap-3">
                <Button
                  variant="ghost"
                  onClick={() => void handleJump(currentPrevAudio)}
                  disabled={!currentPrevAudio}
                  className="h-11 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-3 text-white hover:bg-white/[0.10] hover:text-white disabled:opacity-40 md:h-12 md:px-4"
                >
                  <SkipBack className="mr-2 size-5" />
                  上一条
                </Button>

                <Button
                  onClick={togglePlay}
                  className="size-12 shrink-0 rounded-full bg-[linear-gradient(180deg,#3d7dff_0%,#2456ff_100%)] p-0 text-white shadow-[0_18px_42px_rgba(36,86,255,0.38)] hover:brightness-110 md:size-16"
                >
                  {isPlaying ? <Pause className="size-6 md:size-7" /> : <Play className="ml-0.5 size-6 md:ml-1 md:size-7" />}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => void handleJump(currentNextAudio)}
                  disabled={!currentNextAudio}
                  className="h-11 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-3 text-white hover:bg-white/[0.10] hover:text-white disabled:opacity-40 md:h-12 md:px-4"
                >
                  下一条
                  <SkipForward className="ml-2 size-5" />
                </Button>
              </div>
            </section>
          </aside>

          <section className="hidden overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:block md:rounded-[30px]">
            <div className="flex flex-col gap-4 border-b border-white/8 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/36">SCRIPT PANEL</div>
                <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.05em] text-white md:text-[30px]">课程文稿</h2>
              </div>

              <div className="text-sm leading-7 text-white/48">
                {audio.script ? "边听边看，按自己的学习节奏通读课程文稿。" : "当前音频暂无文稿内容。"}
              </div>
            </div>

            <div className="p-3 md:p-5">
              <div className="min-h-[300px] overflow-hidden rounded-[20px] border border-white/8 bg-black/18 md:min-h-[380px] md:rounded-[24px]">
                <div className="h-full max-h-[56vh] overflow-y-auto px-4 py-4 text-[14px] leading-7 text-white/72 md:min-h-[620px] md:max-h-[70vh] md:px-6 md:py-6 md:text-base md:leading-9 xl:max-h-[calc(100vh-240px)]">
                  {audio.script ? (
                    <div className="whitespace-pre-wrap">{audio.script}</div>
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center text-center text-sm text-white/38">暂无文稿内容</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {audio.hasHandout ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 md:bottom-8">
          <div className="mx-auto flex max-w-[1320px] justify-end px-5 md:px-8 xl:px-10">
            <button
              type="button"
              onClick={() => void handleDownloadHandout()}
              disabled={downloadingHandout}
              className="pointer-events-auto flex size-16 flex-col items-center justify-center rounded-full border border-white/12 bg-[linear-gradient(180deg,#3d7dff_0%,#2456ff_100%)] text-white shadow-[0_18px_45px_rgba(37,99,235,0.35)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-80 md:hidden"
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
