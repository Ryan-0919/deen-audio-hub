import { CheckCircle2, ChevronLeft, ChevronRight, Eye, RotateCcw, Save, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Textarea } from "../../components/ui/textarea";
import { type BookQuestionBankAnswerState, type BookQuestionBankPracticePayload, type QuestionBankSubQuestion, mockApi } from "../../lib/mockData";

const AUTO_SAVE_DELAY_MS = 1200;

const buildInitialAnswerState = (payload: BookQuestionBankPracticePayload | null) => {
  const item = payload?.item;
  if (!item) {
    return {
      objectiveAnswerKeys: [] as string[],
      subjectiveAnswers: {} as Record<string, string>,
    };
  }

  if (item.questionType === "subjective_case") {
    const existingAnswerJson = (item.answerState.answerJson as Record<string, string> | null) ?? {};
    return {
      objectiveAnswerKeys: [] as string[],
      subjectiveAnswers: item.subjectiveSubQuestions.reduce<Record<string, string>>((result, subQuestion) => {
        const subQuestionId = subQuestion.id ?? "";
        result[subQuestionId] = `${existingAnswerJson[subQuestionId] ?? ""}`;
        return result;
      }, {}),
    };
  }

  return {
    objectiveAnswerKeys: Array.isArray(item.answerState.answerJson) ? [...(item.answerState.answerJson as string[])] : [],
    subjectiveAnswers: {} as Record<string, string>,
  };
};

const normalizeAnswerKeys = (values: string[]) => Array.from(new Set(values.map((item) => item.trim().toUpperCase()).filter(Boolean))).sort();

export function BookQuestionBankPractice() {
  const navigate = useNavigate();
  const { bookId = "", bookItemId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [manualSaving, setManualSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [payload, setPayload] = useState<BookQuestionBankPracticePayload | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [objectiveAnswerKeys, setObjectiveAnswerKeys] = useState<string[]>([]);
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<Record<string, string>>({});
  const [lastSavedSignature, setLastSavedSignature] = useState("");
  const savePromiseRef = useRef<Promise<BookQuestionBankAnswerState | null> | null>(null);
  const latestSaveSignatureRef = useRef("");
  const currentPayloadRef = useRef<BookQuestionBankPracticePayload | null>(null);
  const currentAnswerRequestPayloadRef = useRef<{ answerJson: unknown; draftText?: string } | null>(null);
  const currentAnswerSignatureRef = useRef("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const detail = await mockApi.getUserBookQuestionBankPractice(bookId, bookItemId);
      currentPayloadRef.current = detail;
      setPayload(detail);
      const initial = buildInitialAnswerState(detail);
      setObjectiveAnswerKeys(initial.objectiveAnswerKeys);
      setSubjectiveAnswers(initial.subjectiveAnswers);
      setShowAnswer(detail.item.answerState.hasViewedAnswer);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "加载题目失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [bookId, bookItemId]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const item = payload?.item;

  const answerRequestPayload = useMemo(() => {
    if (!item) return null;

    if (item.questionType === "subjective_case") {
      const normalizedAnswers = item.subjectiveSubQuestions.reduce<Record<string, string>>((result, subQuestion) => {
        const subQuestionId = subQuestion.id ?? "";
        result[subQuestionId] = `${subjectiveAnswers[subQuestionId] ?? ""}`;
        return result;
      }, {});

      return {
        answerJson: normalizedAnswers,
        draftText: Object.values(normalizedAnswers)
          .map((value) => value.trim())
          .filter(Boolean)
          .join("\n"),
      };
    }

    return {
      answerJson: normalizeAnswerKeys(objectiveAnswerKeys),
    };
  }, [item, objectiveAnswerKeys, subjectiveAnswers]);

  const answerSignature = useMemo(() => JSON.stringify(answerRequestPayload ?? {}), [answerRequestPayload]);

  useEffect(() => {
    currentPayloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    currentAnswerRequestPayloadRef.current = answerRequestPayload;
    currentAnswerSignatureRef.current = answerSignature;
  }, [answerRequestPayload, answerSignature]);

  useEffect(() => {
    if (!item) return;
    const initialPayload =
      item.questionType === "subjective_case"
        ? {
            answerJson: item.answerState.answerJson ?? {},
            draftText: item.answerState.draftText || "",
          }
        : {
            answerJson: normalizeAnswerKeys(Array.isArray(item.answerState.answerJson) ? (item.answerState.answerJson as string[]) : []),
          };
    const signature = JSON.stringify(initialPayload);
    latestSaveSignatureRef.current = signature;
    setLastSavedSignature(signature);
  }, [item]);

  useEffect(() => {
    setShowAnswer(Boolean(item?.answerState.hasViewedAnswer));
  }, [item?.answerState.hasViewedAnswer]);

  const referenceAnswerText = useMemo(() => {
    if (!item) return "";
    if (item.questionType === "subjective_case") {
      const sections = item.subjectiveSubQuestions
        .map((subQuestion, index) => {
          const title = subQuestion.title || `第 ${index + 1} 问`;
          const answer = subQuestion.referenceAnswer || subQuestion.rubricGuidance || "";
          const rubricPoints = (subQuestion.rubricPoints ?? [])
            .map((point) => `${point.title}${point.score ? `（${point.score}分）` : ""}${point.description ? `：${point.description}` : ""}`)
            .filter(Boolean)
            .join("\n");
          return [title, answer, rubricPoints].filter(Boolean).join("\n");
        })
        .filter(Boolean);

      if (item.analysis) {
        sections.push(`解析\n${item.analysis}`);
      }

      return sections.join("\n\n");
    }

    const answerKeys = item.correctAnswerKeys.join("、");
    return [answerKeys ? `正确答案：${answerKeys}` : "", item.analysis || ""].filter(Boolean).join("\n\n");
  }, [item]);

  const isDirty = Boolean(item) && answerSignature !== lastSavedSignature;

  const applyAnswerState = (nextState: BookQuestionBankAnswerState) => {
    setPayload((current) => {
      if (!current) return current;
      return {
        ...current,
        item: {
          ...current.item,
          answerState: nextState,
        },
      };
    });
    if (nextState.hasViewedAnswer) {
      setShowAnswer(true);
    }
  };

  const persistAnswer = async ({ showToast = false, reason = "manual" }: { showToast?: boolean; reason?: "manual" | "auto" | "navigation" | "before-action" } = {}) => {
    if (!currentPayloadRef.current?.item || !currentAnswerRequestPayloadRef.current) {
      return null;
    }

    while (true) {
      const nextSignature = currentAnswerSignatureRef.current;
      if (nextSignature === latestSaveSignatureRef.current) {
        if (showToast) {
          toast.success("答案已保存");
        }
        return currentPayloadRef.current.item.answerState;
      }

      if (savePromiseRef.current) {
        await savePromiseRef.current;
        continue;
      }

      const nextRequestPayload = currentAnswerRequestPayloadRef.current;
      const savePromise = mockApi.saveUserBookQuestionBankAnswer(bookId, bookItemId, nextRequestPayload)
        .then((nextState) => {
          latestSaveSignatureRef.current = nextSignature;
          setLastSavedSignature(nextSignature);
          applyAnswerState(nextState);
          if (showToast) {
            toast.success("答案已保存");
          }
          return nextState;
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : "保存答案失败");
          throw error;
        })
        .finally(() => {
          if (savePromiseRef.current === savePromise) {
            savePromiseRef.current = null;
          }
          if (reason === "auto") {
            setAutoSaving(false);
          } else {
            setManualSaving(false);
          }
        });

      savePromiseRef.current = savePromise;
      if (reason === "auto") {
        setAutoSaving(true);
      } else {
        setManualSaving(true);
      }
      return savePromise;
    }
  };

  useEffect(() => {
    if (!item || !isDirty) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void persistAnswer({ reason: "auto" });
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [item, isDirty, answerSignature]);

  const handleObjectiveToggle = (key: string) => {
    if (!item) return;
    if (item.questionType === "single_choice") {
      setObjectiveAnswerKeys([key]);
      return;
    }

    setObjectiveAnswerKeys((current) => (current.includes(key) ? current.filter((itemKey) => itemKey !== key) : normalizeAnswerKeys([...current, key])));
  };

  const goToBookItem = async (targetBookItemId: string) => {
    try {
      await persistAnswer({ reason: "navigation" });
      if (!targetBookItemId) {
        navigate(`/user/book-question-banks/${bookId}`);
        return;
      }
      navigate(`/user/book-question-banks/${bookId}/items/${targetBookItemId}`);
    } catch {
      return;
    }
  };

  const toggleViewedAnswer = async () => {
    if (showAnswer) {
      setShowAnswer(false);
      return;
    }

    try {
      await persistAnswer({ reason: "before-action" });
      const nextState = await mockApi.markUserBookQuestionBankViewedAnswer(bookId, bookItemId);
      applyAnswerState(nextState);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "显示答案失败");
    }
  };

  const updatePracticeState = async (payloadState: { isMastered?: boolean; isRedoMarked?: boolean }) => {
    try {
      await persistAnswer({ reason: "before-action" });
      const nextState = await mockApi.updateUserBookQuestionBankItemState(bookId, bookItemId, payloadState);
      applyAnswerState(nextState);
      toast.success("练习状态已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新练习状态失败");
    }
  };

  if (loading || !item) {
    return (
      <div className="relative min-h-screen bg-[#040816] px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-white/10 bg-white/[0.04] px-8 py-24 text-center text-sm uppercase tracking-[0.28em] text-white/58">
          Loading Practice
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040816] pb-24 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-6 md:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button variant="outline" className="border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.10] hover:text-white" onClick={() => void goToBookItem("")}>
            <ChevronLeft className="mr-2 size-4" />
            返回题库
          </Button>
          <Badge className="border-0 bg-white/10 text-white shadow-none">{item.subjectName}</Badge>
          <Badge className="border-0 bg-white/8 text-white/70 shadow-none">{item.questionTypeLabel}</Badge>
          {item.questionNo ? <Badge className="border-0 bg-white/8 text-white/70 shadow-none">{item.questionNo}</Badge> : null}
          {item.answerState.isAnswered ? <Badge className="border-0 bg-emerald-400/16 text-emerald-200 shadow-none">已作答</Badge> : null}
          {item.answerState.hasViewedAnswer ? <Badge className="border-0 bg-sky-400/16 text-sky-200 shadow-none">已看答案</Badge> : null}
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/68 md:flex-row md:items-center md:justify-between">
          <div>
            {autoSaving ? "正在自动保存草稿..." : manualSaving ? "正在保存答案..." : isDirty ? "你有尚未保存的修改，系统会自动保存。" : "当前内容已保存。"}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="border-white/12 bg-transparent text-white hover:bg-white/[0.10] hover:text-white" onClick={() => void goToBookItem(payload.prevBookItemId)} disabled={!payload.prevBookItemId || manualSaving || autoSaving}>
              <ChevronLeft className="mr-1 size-4" />
              上一题
            </Button>
            <Button variant="outline" size="sm" className="border-white/12 bg-transparent text-white hover:bg-white/[0.10] hover:text-white" onClick={() => void goToBookItem(payload.nextBookItemId)} disabled={!payload.nextBookItemId || manualSaving || autoSaving}>
              下一题
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl md:p-7">
          <h1 className="text-[26px] font-semibold tracking-[-0.05em] text-white md:text-[34px]">{item.title}</h1>
          {item.material ? <div className="mt-5 whitespace-pre-wrap rounded-[22px] border border-white/10 bg-black/16 p-5 text-sm leading-7 text-white/72">{item.material}</div> : null}
          <div className="mt-5 whitespace-pre-wrap text-base leading-8 text-white/90">{item.stem}</div>

          {item.lessonAudioUrl ? (
            <div className="mt-6 rounded-[22px] border border-white/10 bg-black/16 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm text-white/72">
                <Volume2 className="size-4 text-[#8fd6ff]" />
                题目微课
              </div>
              <audio controls src={item.lessonAudioUrl} className="w-full" />
            </div>
          ) : null}

          {item.questionType === "subjective_case" ? (
            <div className="mt-6 space-y-6">
              {item.subjectiveSubQuestions.map((subQuestion: QuestionBankSubQuestion, index) => (
                <div key={subQuestion.id ?? index} className="space-y-3">
                  <div className="text-lg font-medium text-white">{subQuestion.title || `第 ${index + 1} 问`}</div>
                  <Textarea
                    value={subjectiveAnswers[subQuestion.id ?? ""] ?? ""}
                    onChange={(event) =>
                      setSubjectiveAnswers((current) => ({
                        ...current,
                        [subQuestion.id ?? ""]: event.target.value,
                      }))
                    }
                    placeholder={subQuestion.placeholder || "请在此输入答案。"}
                    className="min-h-[180px] border-white/10 bg-white/[0.04] text-white placeholder:text-white/28"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {item.options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleObjectiveToggle(option.key)}
                  className={`flex w-full items-start gap-3 rounded-[18px] border p-4 text-left transition ${
                    objectiveAnswerKeys.includes(option.key) ? "border-blue-400 bg-blue-400/10" : "border-white/10 bg-white/[0.04] hover:border-white/18"
                  }`}
                >
                  <Checkbox checked={objectiveAnswerKeys.includes(option.key)} className="mt-1" />
                  <div className="min-w-0">
                    <div className="font-medium text-white">{option.key}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm leading-7 text-white/72">{option.content}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => void persistAnswer({ showToast: true, reason: "manual" })} disabled={manualSaving || autoSaving}>
              <Save className="mr-2 size-4" />
              {manualSaving ? "保存中..." : "保存答案"}
            </Button>
            <Button variant="outline" className="border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.10] hover:text-white" onClick={() => void toggleViewedAnswer()} disabled={manualSaving || autoSaving}>
              <Eye className="mr-2 size-4" />
              {showAnswer ? "收起答案" : "查看答案"}
            </Button>
            <Button
              variant="outline"
              className="border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.10] hover:text-white"
              onClick={() => void updatePracticeState({ isMastered: !item.answerState.isMastered })}
              disabled={manualSaving || autoSaving}
            >
              <CheckCircle2 className="mr-2 size-4" />
              {item.answerState.isMastered ? "取消掌握" : "标记已掌握"}
            </Button>
            <Button
              variant="outline"
              className="border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.10] hover:text-white"
              onClick={() => void updatePracticeState({ isRedoMarked: !item.answerState.isRedoMarked })}
              disabled={manualSaving || autoSaving}
            >
              <RotateCcw className="mr-2 size-4" />
              {item.answerState.isRedoMarked ? "取消重做" : "标记重做"}
            </Button>
          </div>
        </div>

        {showAnswer ? (
          <div className="mt-6 rounded-[28px] border border-[#8fd6ff]/20 bg-[#071727] p-6 text-white">
            <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-[#8fd6ff]">Reference Answer</div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-white/78">{referenceAnswerText || item.analysis || "暂无参考答案与解析。"}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
