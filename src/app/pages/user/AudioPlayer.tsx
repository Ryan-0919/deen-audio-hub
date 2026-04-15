import { ArrowLeft, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "../../components/ui/button";
import { Slider } from "../../components/ui/slider";
import { cn } from "../../components/ui/utils";
import { Audio, Course, Tag, mockApi } from "../../lib/mockData";

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [playerDiscImageUrl, setPlayerDiscImageUrl] = useState("");
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const savedRate = Number(window.localStorage.getItem("userPlaybackRate") ?? "1");
    return PLAYBACK_RATES.includes(savedRate) ? savedRate : 1;
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef(0);
  const hasCompletedRef = useRef(false);
  const initialSeekRef = useRef(0);
  const saveTimeoutRef = useRef<number | null>(null);
  const autoplayRequestedRef = useRef(false);

  const saveProgress = async (position = currentTime) => {
    const userId = localStorage.getItem("userId");
    if (!userId || !courseId || !audioId) return;
    await mockApi.saveProgress(userId, courseId, audioId, position);
  };

  const markCompleted = async () => {
    if (hasCompletedRef.current) return;

    const userId = localStorage.getItem("userId");
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
    const loadBranding = async () => {
      try {
        const data = await mockApi.getBrandingConfig();
        setPlayerDiscImageUrl(data.playerDiscImageUrl ?? "");
      } catch (error) {
        setPlayerDiscImageUrl("");
      }
    };

    void loadBranding();
  }, []);

  useEffect(() => {
    const load = async () => {
      const userId = localStorage.getItem("userId");
      if (!userId) {
        navigate("/");
        return;
      }

      if (!courseId || !audioId) return;

      try {
        setLoading(true);
        autoplayRequestedRef.current = Boolean((location.state as { autoplay?: boolean } | null)?.autoplay);
        const [detail, progress] = await Promise.all([
          mockApi.getAudioDetail(audioId, courseId),
          mockApi.getUserProgress(userId, courseId, audioId),
        ]);

        setAudio(detail.audio);
        setCourse(detail.course);
        setTag(detail.tag);
        setPrevAudio(detail.prev);
        setNextAudio(detail.next);
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

  const handleAudioEnd = async () => {
    setIsPlaying(false);
    await markCompleted();

    if (nextAudio && courseId) {
      navigate(`/user/player/${courseId}/${nextAudio.id}`, { state: { autoplay: true } });
    }
  };

  useEffect(() => {
    const node = audioRef.current;
    if (!node || !audio) return;

    const tryAutoplay = async () => {
      if (!autoplayRequestedRef.current) return;

      try {
        await node.play();
      } catch (error) {
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
  }, [audio, nextAudio]);

  const togglePlay = async () => {
    const node = audioRef.current;
    if (!node) return;

    if (node.paused) {
      try {
        await node.play();
      } catch (error) {
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

  const playerStatus = completed ? "已学完" : isPlaying ? "播放中" : currentTime > 0 ? "暂停中" : "未播放";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] px-4 py-6">
        <div className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          音频加载中...
        </div>
      </div>
    );
  }

  if (!audio || !course || !tag) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] px-4 py-6">
        <div className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          音频不存在
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
            onClick={handleBack}
            className="flex size-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-slate-900">音频播放</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-sm flex-col overflow-hidden px-4 py-4">
        <audio ref={audioRef} src={audio.audioUrl} preload="metadata" />

        <div className="shrink-0 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-blue-100 bg-blue-50 shadow-sm",
                isPlaying && "animate-[spin_10s_linear_infinite]",
              )}
            >
              {playerDiscImageUrl ? (
                <img src={playerDiscImageUrl} alt="播放器圆圈图片" className="size-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-blue-50" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold leading-8 text-slate-900">{audio.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">{course.name}</span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-600">{tag.name}</span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-white">{playerStatus}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4">
          {playerError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{playerError}</div>}

          <div
            className={cn(
              "h-full overflow-y-auto rounded-2xl bg-slate-50 px-4 py-4 text-[15px] leading-8 text-slate-700",
              playerError && "mt-4",
            )}
          >
            {audio.script ? (
              <div className="whitespace-pre-wrap">{audio.script}</div>
            ) : (
              <div className="flex h-full items-center justify-center py-10 text-center text-sm text-slate-400">暂无文案内容</div>
            )}
          </div>
        </div>

        <div className="mt-4 shrink-0 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{formatTime(currentTime)}</span>
            <span>总时长 {formatTime(duration)}</span>
          </div>

          <div className="mt-3">
            <Slider value={[currentTime]} max={duration || 1} step={1} onValueChange={handleSeek} />
          </div>

          <div className="mt-4 flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={handleCyclePlaybackRate} className="rounded-full px-4">
              倍速 {playbackRate}x
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex justify-start">
              <Button variant="outline" onClick={() => void handleJump(prevAudio)} disabled={!prevAudio} className="h-12 rounded-full px-4">
                <SkipBack className="mr-2 size-5" />
                上一条
              </Button>
            </div>

            <Button onClick={togglePlay} className="size-16 rounded-full bg-blue-600 p-0 text-white hover:bg-blue-700">
              {isPlaying ? <Pause className="size-7" /> : <Play className="ml-1 size-7" />}
            </Button>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => void handleJump(nextAudio)} disabled={!nextAudio} className="h-12 rounded-full px-4">
                下一条
                <SkipForward className="ml-2 size-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
