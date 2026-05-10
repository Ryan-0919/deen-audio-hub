import { ArrowLeft, BarChart3, Clock3, Heart, Loader2, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { cn } from "../../components/ui/utils";
import { mockApi, type TypingPracticeDifficultyConfig, type TypingPracticeText } from "../../lib/mockData";
import {
  buildTypingPracticeCompletionMessage,
  buildTypingPracticePromptText,
  buildTypingPracticeStageWindow,
  buildTypingPracticeTileWindow,
  buildTypingScoreText,
  DEFAULT_MEMORIZE_PREVIEW_SECONDS,
  formatTypingSecondsText,
  parseTypingPracticeDifficulty,
  parsePositiveSearchNumber,
  parseTypingPracticeMode,
  TYPING_PRACTICE_POLICE_IMAGE,
  TYPING_PRACTICE_THIEF_IMAGE,
  TYPING_PRACTICE_VISIBLE_TILE_COUNT,
} from "./typingPracticeShared";
import { MockExamDesktopNotice, useMockExamDesktopGuard } from "./mockExamDesktopGuard";

type TypingPhase = "loading" | "preview" | "ready" | "transition" | "saving";
type FlashTone = "success" | "danger" | "info";

const TRANSITION_DELAY_MS = 1100;
const FIRST_STAGE_BONUS_SECONDS = 18;
const STAGE_MODE_TIME_OFFSET_MAP = {
  guided: 0,
  sprint: -2,
  memorize: 4,
} as const;
const DEFAULT_DIFFICULTY_CONFIG_MAP: Record<"easy" | "medium" | "hard", TypingPracticeDifficultyConfig> = {
  easy: {
    difficulty: "easy",
    label: "入门",
    initialLives: 4,
    baseStageTimeSeconds: 22,
    extraTimePer20Chars: 4,
    minStageTimeSeconds: 14,
    levelTimeReductionSeconds: 1,
    thiefSpeedBase: 1,
    thiefSpeedStepLevels: 3,
    scorePerChar: 18,
    errorPenalty: 6,
    captureBonus: 220,
    lifeBonus: 90,
    memorizePreviewSeconds: 16,
  },
  medium: {
    difficulty: "medium",
    label: "标准",
    initialLives: 3,
    baseStageTimeSeconds: 18,
    extraTimePer20Chars: 3,
    minStageTimeSeconds: 12,
    levelTimeReductionSeconds: 1,
    thiefSpeedBase: 2,
    thiefSpeedStepLevels: 2,
    scorePerChar: 20,
    errorPenalty: 8,
    captureBonus: 260,
    lifeBonus: 120,
    memorizePreviewSeconds: 12,
  },
  hard: {
    difficulty: "hard",
    label: "挑战",
    initialLives: 2,
    baseStageTimeSeconds: 15,
    extraTimePer20Chars: 2,
    minStageTimeSeconds: 9,
    levelTimeReductionSeconds: 2,
    thiefSpeedBase: 3,
    thiefSpeedStepLevels: 2,
    scorePerChar: 24,
    errorPenalty: 10,
    captureBonus: 320,
    lifeBonus: 160,
    memorizePreviewSeconds: 8,
  },
};

const getMatchedPrefixLength = (targetText: string, typedText: string) => {
  const maxLength = Math.min(targetText.length, typedText.length);
  let index = 0;

  while (index < maxLength && targetText[index] === typedText[index]) {
    index += 1;
  }

  return index;
};

const calculateLevel = (stageIndex: number) => stageIndex + 1;
const calculateThiefSpeed = (level: number, difficultyConfig: TypingPracticeDifficultyConfig) =>
  Math.min(9, difficultyConfig.thiefSpeedBase + Math.floor(Math.max(level - 1, 0) / Math.max(difficultyConfig.thiefSpeedStepLevels, 1)));

const calculateScore = ({
  correctLength,
  errorCount,
  capturedStageCount,
  livesRemaining,
  difficultyConfig,
}: {
  correctLength: number;
  errorCount: number;
  capturedStageCount: number;
  livesRemaining: number;
  difficultyConfig: TypingPracticeDifficultyConfig;
}) =>
  Math.max(
    0,
    correctLength * difficultyConfig.scorePerChar -
      errorCount * difficultyConfig.errorPenalty +
      capturedStageCount * difficultyConfig.captureBonus +
      livesRemaining * difficultyConfig.lifeBonus,
  );

const calculateStageTimeLimitSeconds = ({
  mode,
  level,
  chunkLength,
  difficultyConfig,
}: {
  mode: "guided" | "sprint" | "memorize";
  level: number;
  chunkLength: number;
  difficultyConfig: TypingPracticeDifficultyConfig;
}) => {
  const baseSeconds =
    difficultyConfig.baseStageTimeSeconds +
    Math.ceil(chunkLength / 20) * difficultyConfig.extraTimePer20Chars +
    STAGE_MODE_TIME_OFFSET_MAP[mode];
  const levelPenalty = Math.max(level - 1, 0) * difficultyConfig.levelTimeReductionSeconds;
  const warmupBonus = level <= 1 ? FIRST_STAGE_BONUS_SECONDS : 0;
  return Math.max(difficultyConfig.minStageTimeSeconds, baseSeconds - levelPenalty + warmupBonus);
};

const getBannerToneClassName = (tone: FlashTone) => {
  if (tone === "danger") {
    return "text-[#ffd0d0]";
  }

  if (tone === "info") {
    return "text-[#8cc8ff]";
  }

  return "text-[#50f15d]";
};

function StageBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-[#b9d7e6]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
        <rect width="1600" height="900" fill="#b9d7e6" />

        <ellipse cx="220" cy="90" rx="110" ry="36" fill="#c5c1bd" opacity="0.18" />
        <ellipse cx="1380" cy="130" rx="90" ry="28" fill="#d4d1cd" opacity="0.45" />
        <ellipse cx="640" cy="185" rx="78" ry="22" fill="#d4d1cd" opacity="0.4" />

        <g opacity="0.2" fill="#7b9bb0">
          <rect x="20" y="310" width="28" height="92" />
          <rect x="42" y="330" width="24" height="72" />
          <rect x="86" y="290" width="40" height="112" />
          <rect x="145" y="305" width="22" height="97" />
          <rect x="192" y="275" width="44" height="127" />
          <rect x="248" y="295" width="58" height="107" />
          <rect x="334" y="260" width="38" height="142" />
          <rect x="402" y="315" width="28" height="87" />
          <rect x="468" y="285" width="32" height="117" />
          <rect x="512" y="305" width="48" height="97" />
          <rect x="588" y="328" width="26" height="74" />
          <rect x="640" y="278" width="42" height="124" />
          <rect x="718" y="338" width="52" height="64" />
          <rect x="804" y="297" width="36" height="105" />
          <rect x="878" y="250" width="56" height="152" />
          <rect x="962" y="278" width="46" height="124" />
          <rect x="1022" y="336" width="36" height="66" />
          <rect x="1088" y="286" width="44" height="116" />
          <rect x="1180" y="308" width="24" height="94" />
          <rect x="1220" y="266" width="36" height="136" />
          <rect x="1284" y="286" width="52" height="116" />
          <rect x="1368" y="300" width="28" height="102" />
          <rect x="1410" y="272" width="36" height="130" />
          <rect x="1482" y="296" width="44" height="106" />
        </g>

        <path d="M0 500 C180 460 300 480 430 520 C560 558 720 560 860 512 C1020 458 1180 462 1300 494 C1450 532 1540 520 1600 508 L1600 660 L0 660 Z" fill="#5b7f29" />
        <path d="M0 545 C150 522 300 540 458 580 C612 620 760 620 902 586 C1060 550 1228 550 1368 580 C1488 606 1560 600 1600 592 L1600 688 L0 688 Z" fill="#5f8a1a" />
        <path d="M0 600 C160 588 300 594 450 622 C648 658 842 652 1018 626 C1164 604 1308 604 1464 624 C1524 632 1568 634 1600 632 L1600 708 L0 708 Z" fill="#4f7305" />

        <path d="M376 520 C390 488 410 470 428 458 C444 454 450 462 444 474 C428 496 416 532 420 578 C392 580 378 562 376 520 Z" fill="#c7aa87" />
        <path d="M1184 520 C1228 486 1268 474 1310 474 C1280 504 1246 544 1216 592 C1198 590 1188 566 1184 520 Z" fill="#8d7052" opacity="0.7" />

        <g>
          <rect x="96" y="526" width="12" height="100" rx="6" fill="#2f4213" />
          <ellipse cx="102" cy="500" rx="24" ry="34" fill="#476d17" />
          <rect x="318" y="414" width="6" height="82" rx="3" fill="#28370e" />
          <ellipse cx="321" cy="398" rx="15" ry="20" fill="#4f751b" />
          <rect x="916" y="446" width="8" height="92" rx="4" fill="#2f4213" />
          <ellipse cx="920" cy="430" rx="20" ry="24" fill="#4f751b" />
          <rect x="1298" y="572" width="10" height="114" rx="5" fill="#2f4213" />
          <ellipse cx="1304" cy="548" rx="28" ry="40" fill="#547f1d" />
          <rect x="1460" y="374" width="7" height="82" rx="3.5" fill="#334a15" />
          <ellipse cx="1464" cy="352" rx="18" ry="26" fill="#4f751b" />
          <rect x="1518" y="356" width="7" height="96" rx="3.5" fill="#334a15" />
          <ellipse cx="1522" cy="334" rx="22" ry="30" fill="#4f751b" />
        </g>

        <rect x="0" y="688" width="1600" height="20" fill="#373d43" />
        <rect x="0" y="708" width="1600" height="188" fill="#2f353b" />
        <rect x="0" y="708" width="1600" height="58" fill="#343b41" />
        <g stroke="#f0d50b" strokeWidth="4">
          <line x1="0" y1="760" x2="86" y2="760" />
          <line x1="320" y1="760" x2="486" y2="760" />
          <line x1="650" y1="760" x2="816" y2="760" />
          <line x1="980" y1="760" x2="1146" y2="760" />
          <line x1="1310" y1="760" x2="1476" y2="760" />
        </g>
        <g stroke="#adb0b3" strokeWidth="6" strokeLinecap="round">
          <line x1="12" y1="858" x2="82" y2="858" />
          <line x1="126" y1="858" x2="196" y2="858" />
          <line x1="250" y1="858" x2="320" y2="858" />
          <line x1="374" y1="858" x2="444" y2="858" />
          <line x1="498" y1="858" x2="568" y2="858" />
          <line x1="622" y1="858" x2="692" y2="858" />
          <line x1="746" y1="858" x2="816" y2="858" />
          <line x1="870" y1="858" x2="940" y2="858" />
          <line x1="994" y1="858" x2="1064" y2="858" />
          <line x1="1118" y1="858" x2="1188" y2="858" />
          <line x1="1242" y1="858" x2="1312" y2="858" />
          <line x1="1366" y1="858" x2="1436" y2="858" />
          <line x1="1490" y1="858" x2="1560" y2="858" />
        </g>
      </svg>
    </>
  );
}

function HeaderStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex h-[60px] min-w-[98px] items-center gap-2 rounded-[8px] border border-[#083d74] bg-[#052e5e] px-4 text-white shadow-[0_4px_12px_rgba(0,0,0,0.22)]">
      <div className="text-[#ffd400]">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] leading-none text-[#c9dcf0]">{label}</div>
        <div className="mt-1 truncate text-[18px] font-bold leading-none">{value}</div>
      </div>
    </div>
  );
}

function TileGrid({
  chars,
  activeIndex,
  phase,
}: {
  chars: string[];
  activeIndex: number;
  phase: TypingPhase;
}) {
  return (
    <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-2 gap-y-3">
      {chars.map((char, index) => {
        const isCompleted = index < activeIndex;
        const isCurrent = index === activeIndex && phase === "ready";
        const displayChar = char === "" ? "" : char === "\n" ? "↵" : char === " " ? "空" : char;

        return (
          <div
            key={`${index}-${char}`}
            className={cn(
              "flex h-[40px] w-[40px] items-center justify-center rounded-[8px] border-2 text-[20px] font-bold tracking-[0.04em] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
              char === "" && "border-transparent bg-transparent shadow-none",
              char !== "" && !isCompleted && !isCurrent && "border-[#7bb4ff] bg-[#173f74] text-white",
              isCompleted && "border-[#67d648] bg-[#5d8d45] text-[#d8f8ce]",
              isCurrent && "border-[#ffd948] bg-[#5b7a9a] text-white shadow-[0_0_12px_rgba(255,217,72,0.55)]",
            )}
          >
            {displayChar}
          </div>
        );
      })}
    </div>
  );
}

export function TypingPracticeGame() {
  const { textId = "" } = useParams();
  const navigate = useNavigate();
  const isMobileBlocked = useMockExamDesktopGuard();
  const [searchParams] = useSearchParams();
  const mode = parseTypingPracticeMode(searchParams.get("mode"));
  const difficulty = parseTypingPracticeDifficulty(searchParams.get("difficulty"));
  const timeLimitSeconds = mode === "sprint" ? parsePositiveSearchNumber(searchParams.get("limit"), 180) : null;
  const requestedPreviewSeconds = mode === "memorize" ? parsePositiveSearchNumber(searchParams.get("preview"), 0) : 0;
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const submitGuardRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);
  const isComposingRef = useRef(false);

  const [text, setText] = useState<TypingPracticeText | null>(null);
  const [targetContent, setTargetContent] = useState("");
  const [playTicket, setPlayTicket] = useState("");
  const [phase, setPhase] = useState<TypingPhase>("loading");
  const [inputValue, setInputValue] = useState("");
  const [rawInputValue, setRawInputValue] = useState("");
  const [errorCount, setErrorCount] = useState(0);
  const [backspaceCount, setBackspaceCount] = useState(0);
  const [activePreviewSeconds, setActivePreviewSeconds] = useState(0);
  const [previewCountdown, setPreviewCountdown] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [segmentStartedAt, setSegmentStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [livesRemaining, setLivesRemaining] = useState(DEFAULT_DIFFICULTY_CONFIG_MAP.medium.initialLives);
  const [capturedStageCount, setCapturedStageCount] = useState(0);
  const [flashBanner, setFlashBanner] = useState<{ text: string; tone: FlashTone } | null>(null);
  const difficultyConfig = useMemo(() => {
    if (!text) {
      return DEFAULT_DIFFICULTY_CONFIG_MAP.medium;
    }

    return text.difficultyConfig ?? DEFAULT_DIFFICULTY_CONFIG_MAP[difficulty] ?? DEFAULT_DIFFICULTY_CONFIG_MAP.medium;
  }, [difficulty, text]);

  const currentIndex = inputValue.length;
  const targetLength = targetContent.length;
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((nowTick - startedAt) / 1000)) : 0;
  const currentCpm = elapsedSeconds > 0 ? Math.round((currentIndex / elapsedSeconds) * 60) : 0;
  const remainingSeconds = timeLimitSeconds !== null ? Math.max(0, timeLimitSeconds - elapsedSeconds) : null;
  const chunkAnchorIndex = targetLength > 0 && currentIndex >= targetLength ? targetLength - 1 : currentIndex;
  const currentChunkStart = targetLength > 0 ? Math.floor(chunkAnchorIndex / TYPING_PRACTICE_VISIBLE_TILE_COUNT) * TYPING_PRACTICE_VISIBLE_TILE_COUNT : 0;
  const currentChunkEnd = Math.min(currentChunkStart + TYPING_PRACTICE_VISIBLE_TILE_COUNT, targetLength);
  const currentChunkLength = Math.max(1, currentChunkEnd - currentChunkStart);
  const currentChunkTypedLength = Math.max(0, Math.min(currentIndex - currentChunkStart, currentChunkLength));
  const currentStageIndex = targetLength > 0 ? Math.floor(chunkAnchorIndex / TYPING_PRACTICE_VISIBLE_TILE_COUNT) : 0;
  const currentStageNumber = currentStageIndex + 1;
  const totalStageCount = Math.max(1, Math.ceil(targetLength / TYPING_PRACTICE_VISIBLE_TILE_COUNT));
  const level = calculateLevel(currentStageIndex);
  const thiefSpeed = calculateThiefSpeed(level, difficultyConfig);
  const stageTimeLimitSeconds = calculateStageTimeLimitSeconds({ mode, level, chunkLength: currentChunkLength, difficultyConfig });
  const segmentElapsedSeconds = segmentStartedAt ? Math.max(0, Math.floor((nowTick - segmentStartedAt) / 1000)) : 0;
  const segmentRemainingSeconds = Math.max(0, stageTimeLimitSeconds - segmentElapsedSeconds);
  const stageProgress = currentChunkTypedLength / currentChunkLength;
  const score = calculateScore({
    correctLength: currentIndex,
    errorCount,
    capturedStageCount,
    livesRemaining,
    difficultyConfig,
  });
  const policePosition = Math.min(78, 10 + Math.round(stageProgress * 58));
  const thiefPosition = Math.min(82, 44 + Math.round((segmentElapsedSeconds / Math.max(stageTimeLimitSeconds, 1)) * 34));
  const showHiddenPrompt = mode === "memorize" && phase !== "preview";

  if (isMobileBlocked) {
    return <MockExamDesktopNotice />;
  }
  const tileWindow = useMemo(() => buildTypingPracticeTileWindow(targetContent, currentIndex), [currentIndex, targetContent]);
  const topLeftTargets = useMemo(() => buildTypingPracticeStageWindow(totalStageCount, currentStageIndex), [currentStageIndex, totalStageCount]);
  const committedPreviewText = inputValue;
  const composingPreviewText = rawInputValue.startsWith(inputValue) ? rawInputValue.slice(inputValue.length) : "";
  const statusText =
    phase === "transition"
      ? "警力整备中"
      : phase === "preview"
        ? "题面预览中"
        : phase === "saving"
          ? "正在结算"
          : `第 ${Math.min(currentStageNumber, totalStageCount)} / ${totalStageCount} 关追捕中`;

  const clearTransitionTimer = () => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  };

  const focusInput = () => {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      const currentLength = rawInputValue.length;
      inputRef.current?.setSelectionRange(currentLength, currentLength);
    });
  };

  const runTransition = (options: { message: string; tone?: FlashTone; next: () => void; delayMs?: number }) => {
    clearTransitionTimer();
    setPhase("transition");
    setFlashBanner({
      text: options.message,
      tone: options.tone ?? "success",
    });
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      setFlashBanner(null);
      options.next();
    }, options.delayMs ?? TRANSITION_DELAY_MS);
  };

  const saveAndExit = async (overrides?: { capturedStageCount?: number; livesRemaining?: number }) => {
    if (!text || !targetContent || submitGuardRef.current) {
      return;
    }

    const finalCapturedStageCount = overrides?.capturedStageCount ?? capturedStageCount;
    const finalLivesRemaining = overrides?.livesRemaining ?? livesRemaining;
    submitGuardRef.current = true;
    clearTransitionTimer();
    setPhase("saving");

    try {
      const record = await mockApi.createTypingPracticeRecord({
        textId: text.id,
        mode,
        difficulty,
        title: text.title,
        sourceSnapshot: text.source,
        contentSnapshot: targetContent,
        typedContent: inputValue,
        playTicket,
        errorCount,
        backspaceCount,
        comboMax: Math.max(currentIndex, finalCapturedStageCount * TYPING_PRACTICE_VISIBLE_TILE_COUNT),
        capturedStageCount: finalCapturedStageCount,
        livesRemaining: finalLivesRemaining,
        durationSeconds: Math.max(1, elapsedSeconds),
        timeLimitSeconds: timeLimitSeconds ?? undefined,
        previewSeconds: mode === "memorize" ? activePreviewSeconds : undefined,
      });

      navigate(`/user/typing-practice/records/${record.id}`, { replace: true });
    } catch (error) {
      submitGuardRef.current = false;
      setPhase("ready");
      toast.error(error instanceof Error ? error.message : "保存练习记录失败");
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setPhase("loading");
        setPlayTicket("");
        const nextText = await mockApi.getTypingPracticeText(textId, {
          mode,
          difficulty,
          timeLimitSeconds: timeLimitSeconds ?? undefined,
        });
        const nextDifficultyConfig = nextText.difficultyConfig ?? DEFAULT_DIFFICULTY_CONFIG_MAP[difficulty] ?? DEFAULT_DIFFICULTY_CONFIG_MAP.medium;
        const resolvedPreviewSeconds =
          mode === "memorize"
            ? requestedPreviewSeconds || nextDifficultyConfig.memorizePreviewSeconds || DEFAULT_MEMORIZE_PREVIEW_SECONDS
            : 0;
        setText(nextText);
        setTargetContent(nextText.content);
        setPlayTicket(nextText.playTicket ?? "");
        setInputValue("");
        setRawInputValue("");
        setErrorCount(0);
        setBackspaceCount(0);
        setActivePreviewSeconds(resolvedPreviewSeconds);
        setPreviewCountdown(resolvedPreviewSeconds);
        setStartedAt(null);
        setSegmentStartedAt(null);
        setLivesRemaining(nextDifficultyConfig.initialLives);
        setCapturedStageCount(0);
        setFlashBanner(null);
        submitGuardRef.current = false;
        isComposingRef.current = false;
        clearTransitionTimer();

        if (mode === "memorize") {
          setPhase("preview");
          return;
        }

        const startTime = Date.now();
        setStartedAt(startTime);
        setSegmentStartedAt(startTime);
        setNowTick(startTime);
        setPhase("ready");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载练习文本失败");
        navigate("/user/typing-practice", { replace: true });
      }
    };

    void load();

    return () => {
      clearTransitionTimer();
    };
  }, [difficulty, mode, navigate, requestedPreviewSeconds, textId, timeLimitSeconds]);

  useEffect(() => {
    if (phase !== "preview") return;

    const timer = window.setInterval(() => {
      setPreviewCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          const startTime = Date.now();
          setStartedAt(startTime);
          setSegmentStartedAt(startTime);
          setNowTick(startTime);
          setPhase("ready");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "ready") return;

    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "ready") return;
    focusInput();
  }, [phase]);

  useEffect(() => {
    if (phase !== "ready" || targetLength <= 0) {
      return;
    }

    if (currentIndex <= 0 || currentIndex < currentChunkEnd) {
      return;
    }

    const isLastStage = currentChunkEnd >= targetLength;
    const completedStageNumber = Math.min(currentStageNumber, totalStageCount);
    runTransition({
      message: isLastStage ? "全部小偷已抓获，任务完成！" : `第 ${completedStageNumber} 名小偷已抓获，进入下一关！`,
      tone: "success",
      next: () => {
        setCapturedStageCount(completedStageNumber);

        if (isLastStage) {
          void saveAndExit({ capturedStageCount: completedStageNumber });
          return;
        }

        const restartTime = Date.now();
        setSegmentStartedAt(restartTime);
        setNowTick(restartTime);
        setPhase("ready");
      },
    });
  }, [currentChunkEnd, currentIndex, currentStageNumber, phase, targetLength, totalStageCount]);

  useEffect(() => {
    if (phase !== "ready" || targetLength <= 0) {
      return;
    }

    if (segmentRemainingSeconds > 0 || currentIndex >= currentChunkEnd) {
      return;
    }

    const nextLives = Math.max(0, livesRemaining - 1);
    const resetValue = targetContent.slice(0, currentChunkStart);
    runTransition({
      message:
        nextLives > 0
          ? `第 ${Math.min(currentStageNumber, totalStageCount)} 关追捕失败，剩余 ${nextLives} 条生命`
          : "最后一条生命已失去，本局结束",
      tone: "danger",
      next: () => {
        setLivesRemaining(nextLives);
        if (nextLives <= 0) {
          void saveAndExit({ livesRemaining: nextLives });
          return;
        }

        isComposingRef.current = false;
        setInputValue(resetValue);
        setRawInputValue(resetValue);
        const restartTime = Date.now();
        setSegmentStartedAt(restartTime);
        setNowTick(restartTime);
        setPhase("ready");
      },
    });
  }, [currentChunkEnd, currentChunkStart, currentIndex, currentStageNumber, livesRemaining, phase, segmentRemainingSeconds, targetContent, targetLength, totalStageCount]);

  useEffect(() => {
    if (phase !== "ready" || timeLimitSeconds === null || remainingSeconds !== 0 || currentIndex >= targetLength) {
      return;
    }

    runTransition({
      message: "总计时间已到，本局自动结算",
      tone: "danger",
      delayMs: 800,
      next: () => {
        void saveAndExit();
      },
    });
  }, [currentIndex, phase, remainingSeconds, targetLength, timeLimitSeconds]);

  const handleInputChange = (nextValue: string) => {
    if (phase !== "ready" || !targetContent) {
      return;
    }

    setRawInputValue(nextValue);

    if (isComposingRef.current) {
      return;
    }

    if (nextValue === inputValue) {
      return;
    }

    if (nextValue.length < inputValue.length) {
      setRawInputValue(inputValue);
      return;
    }

    if (nextValue.length === inputValue.length) {
      return;
    }

    const appendedText = nextValue.slice(inputValue.length);
    const expectedSlice = targetContent.slice(inputValue.length, inputValue.length + appendedText.length);
    const matchedLength = getMatchedPrefixLength(expectedSlice, appendedText);
    const acceptedValue = inputValue + appendedText.slice(0, matchedLength);
    const wrongLength = appendedText.length - matchedLength;

    if (matchedLength > 0) {
      setInputValue(acceptedValue);
      setRawInputValue(acceptedValue);
    }

    if (wrongLength > 0) {
      setErrorCount((current) => current + wrongLength);
      setRawInputValue(acceptedValue);
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (nextValue: string) => {
    isComposingRef.current = false;
    handleInputChange(nextValue);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      setBackspaceCount((current) => current + 1);
      setRawInputValue(inputValue);
    }
  };

  useEffect(() => {
    if (!isComposingRef.current) {
      setRawInputValue(inputValue);
    }
  }, [inputValue]);

  if (phase === "loading" || !text) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#20262b] text-white">
        <div className="inline-flex items-center gap-3 rounded-[12px] bg-[#052e5e] px-5 py-4 text-base shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <Loader2 className="size-5 animate-spin" />
          正在进入练习...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#20262b] text-white">
      <div className="h-[72px] border-b-2 border-[#3569ae] bg-[#232a30] shadow-[0_8px_24px_rgba(0,0,0,0.25)] md:h-[80px]">
        <div className="mx-auto flex h-full max-w-[1180px] items-center gap-2 overflow-x-auto px-3 md:gap-3 md:px-4">
          <button
            type="button"
            onClick={() => navigate("/user/typing-practice")}
            className="inline-flex h-[46px] shrink-0 items-center rounded-[10px] border border-[#0f487f] bg-[#0a2745] px-3 text-sm font-medium text-white transition hover:bg-[#0d3158] md:h-[52px] md:px-4"
          >
            <ArrowLeft className="mr-2 size-4" />
            返回
          </button>

          <div className="flex h-[52px] min-w-[172px] shrink-0 items-center gap-2 rounded-[10px] border border-[#0d467e] bg-[#062a54] px-3 shadow-[0_4px_12px_rgba(0,0,0,0.18)] md:h-[60px] md:min-w-[190px] md:gap-3">
            <div className="flex size-[38px] items-center justify-center rounded-full bg-white text-[22px] md:size-[46px] md:text-[26px]">🦉</div>
            <div className="min-w-0">
              <div className="truncate text-[18px] font-bold tracking-[0.04em] text-[#f6e2b1] md:text-[24px]">得恩打字通</div>
              <div className="mt-1 text-[11px] text-[#ff6959]">警察抓小偷训练场</div>
            </div>
          </div>

          <HeaderStat icon={<Star className="size-4 fill-current" />} label="得分" value={buildTypingScoreText(score)} />
          <HeaderStat icon={<Heart className="size-4 fill-current" />} label="生命" value={livesRemaining} />
          <HeaderStat icon={<BarChart3 className="size-4" />} label="关卡" value={`${Math.min(currentStageNumber, totalStageCount)}/${totalStageCount}`} />
          <HeaderStat icon={<BarChart3 className="size-4" />} label="打字速度" value={`${currentCpm} 字/分钟`} />
          <HeaderStat icon={<Star className="size-4" />} label="小偷速度" value={thiefSpeed} />
          <HeaderStat
            icon={<Clock3 className="size-4" />}
            label={timeLimitSeconds !== null ? "总倒计时" : "本关倒计时"}
            value={formatTypingSecondsText(timeLimitSeconds !== null ? remainingSeconds ?? 0 : segmentRemainingSeconds)}
          />
        </div>
      </div>

      <div className="relative h-[calc(100vh-72px)] min-h-[760px] overflow-hidden md:h-[calc(100vh-80px)] md:min-h-[700px]" onClick={focusInput}>
        <StageBackdrop />

        <textarea
          ref={inputRef}
          value={rawInputValue}
          disabled={phase !== "ready"}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={(event) => handleCompositionEnd(event.currentTarget.value)}
          onPaste={(event) => event.preventDefault()}
          onCut={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
          onBlur={() => {
            if (phase === "ready") {
              focusInput();
            }
          }}
          className="absolute left-1/2 top-[286px] h-8 w-8 -translate-x-1/2 opacity-0 md:top-[330px]"
        />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 md:left-[20px] md:top-[4px] md:gap-2">
          {topLeftTargets.map((item) => (
            <div
              key={item}
              className={cn(
                "flex h-[34px] w-[34px] items-center justify-center rounded-[6px] border text-[17px] shadow-[0_4px_12px_rgba(0,0,0,0.12)] md:h-[50px] md:w-[50px] md:text-[24px]",
                item < capturedStageCount
                  ? "border-[#f5cd27] bg-[#ffe36e] text-[#7a5000]"
                  : item === currentStageIndex && phase === "ready"
                    ? "border-[#9bd4ff] bg-[#dff2ff] text-[#0f3b4d]"
                    : "border-[#d6d6d6] bg-white/80 text-slate-700",
              )}
            >
              🚨
            </div>
          ))}
        </div>

        {flashBanner ? (
          <div
            className={cn(
              "absolute left-1/2 top-[138px] w-[calc(100%-28px)] -translate-x-1/2 rounded-[14px] bg-[rgba(14,18,18,0.75)] px-4 py-4 text-center text-[18px] font-bold shadow-[0_12px_28px_rgba(0,0,0,0.25)] md:top-[230px] md:w-[min(1300px,calc(100%-140px))] md:rounded-[16px] md:px-6 md:py-6 md:text-[32px]",
              getBannerToneClassName(flashBanner.tone),
            )}
          >
            {flashBanner.text}
          </div>
        ) : null}

        <div className="absolute left-1/2 top-[132px] w-[calc(100%-20px)] -translate-x-1/2 rounded-[16px] border-2 border-[#2d74d1] bg-[rgba(13,19,14,0.82)] px-3 pb-7 pt-4 shadow-[0_0_24px_rgba(58,120,214,0.25)] md:top-[220px] md:w-[min(1080px,calc(100%-36px))] md:rounded-[18px] md:px-8 md:pb-9 md:pt-6">
          <div className="text-center text-[18px] font-bold text-[#ffcc15] md:text-[24px]">{buildTypingPracticePromptText(mode)}</div>
          <div className="mt-2 text-center text-sm text-[#9fc5ff]">{text.title}</div>

          {phase === "preview" ? (
            <div className="mt-6 text-center">
              <div className="mb-4 text-[18px] font-bold text-[#f4e4ff] md:text-[24px]">预览倒计时 {previewCountdown} 秒</div>
              <div className="rounded-[14px] border border-[#6f6f6f] bg-black/20 px-4 py-4 text-left text-[14px] leading-[1.8] text-white md:px-5 md:py-5 md:text-[22px] md:leading-[1.9]">
                {targetContent.slice(0, 120)}
              </div>
            </div>
          ) : showHiddenPrompt ? (
            <div className="mt-6 rounded-[14px] border border-[#675995] bg-[rgba(66,49,95,0.35)] px-4 py-8 text-center text-[18px] font-bold text-[#f0defe] md:mt-8 md:py-10 md:text-[28px]">
              题面已隐藏，请继续凭记忆输入
            </div>
          ) : (
            <div className="mt-5 flex justify-center">
              <TileGrid chars={tileWindow.chars} activeIndex={tileWindow.activeIndexInChunk} phase={phase} />
            </div>
          )}

          <div className="absolute bottom-[-14px] left-3 rounded-[8px] bg-[#58d25a] px-3 py-1 text-[14px] font-bold leading-none text-white shadow-[0_4px_10px_rgba(0,0,0,0.22)] md:bottom-[-16px] md:left-[18px] md:px-4 md:text-[20px]">
            {formatTypingSecondsText(segmentRemainingSeconds)}
          </div>
          <div className="absolute bottom-[-14px] right-3 rounded-[8px] bg-[#0c315d] px-3 py-1 text-[13px] font-bold leading-none text-[#d9e9ff] shadow-[0_4px_10px_rgba(0,0,0,0.22)] md:bottom-[-16px] md:right-[18px] md:px-4 md:text-[18px]">
            本关 {currentChunkTypedLength}/{currentChunkLength}
          </div>
        </div>

        <div className="absolute left-1/2 top-[356px] w-[calc(100%-20px)] -translate-x-1/2 rounded-[14px] border border-[#335d90] bg-[rgba(9,16,26,0.82)] px-4 py-3 shadow-[0_10px_26px_rgba(0,0,0,0.22)] md:top-[520px] md:w-[min(1080px,calc(100%-36px))] md:px-5">
          <div className="text-[14px] font-semibold tracking-[0.08em] text-[#8fb8e8]">当前输入</div>
          <div className="mt-2 flex h-[32px] items-center justify-end overflow-hidden whitespace-nowrap text-[18px] leading-[32px] text-white md:h-[38px] md:text-[24px] md:leading-[38px]">
            <div className="flex shrink-0 items-center">
              {committedPreviewText ? <span>{committedPreviewText}</span> : null}
              {composingPreviewText ? <span className="text-[#ffd35d]">{composingPreviewText}</span> : null}
              {!committedPreviewText && !composingPreviewText ? <span className="text-[#7d8fa4]">输入内容会显示在这里</span> : null}
              <span className="ml-0.5 animate-pulse text-[#8cc8ff]">|</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-[150px] left-1/2 w-[calc(100%-32px)] -translate-x-1/2 text-center text-[19px] font-black tracking-[0.06em] text-white [text-shadow:0_3px_6px_rgba(0,0,0,0.35)] md:bottom-[220px] md:left-[82px] md:w-auto md:translate-x-0 md:text-left md:text-[36px] md:tracking-[0.08em]">
          {statusText}
        </div>

        <img
          src={TYPING_PRACTICE_POLICE_IMAGE}
          alt="追捕的警察"
          className="absolute bottom-[92px] w-[92px] max-w-none -translate-x-1/2 drop-shadow-[0_12px_20px_rgba(0,0,0,0.35)] transition-all duration-300 md:bottom-[132px] md:w-[150px]"
          style={{ left: `${policePosition}%` }}
        />

        <img
          src={TYPING_PRACTICE_THIEF_IMAGE}
          alt="逃跑的小偷"
          className="absolute bottom-[90px] w-[92px] max-w-none -translate-x-1/2 drop-shadow-[0_12px_20px_rgba(0,0,0,0.35)] transition-all duration-300 md:bottom-[128px] md:w-[150px]"
          style={{ left: `${thiefPosition}%` }}
        />

        {phase === "saving" ? (
          <div className="absolute bottom-[30px] left-1/2 -translate-x-1/2 rounded-full bg-[rgba(0,0,0,0.55)] px-6 py-3 text-sm text-white shadow-[0_10px_26px_rgba(0,0,0,0.22)]">
            {buildTypingPracticeCompletionMessage(currentIndex >= targetLength)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
