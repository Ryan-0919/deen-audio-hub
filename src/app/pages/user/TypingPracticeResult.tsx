import { ArrowLeft, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { mockApi, type TypingPracticeRecord } from "../../lib/mockData";
import {
  buildTypingAccuracyText,
  buildTypingPracticeCompletionMessage,
  buildTypingPracticeRetryHref,
  formatTypingSecondsText,
  TYPING_PRACTICE_POLICE_IMAGE,
  TYPING_PRACTICE_THIEF_IMAGE,
} from "./typingPracticeShared";
import { MockExamDesktopNotice, useMockExamDesktopGuard } from "./mockExamDesktopGuard";

const EMPTY_RECORD: TypingPracticeRecord = {
  id: "",
  textId: "",
  mode: "guided",
  modeLabel: "",
  difficulty: "medium",
  difficultyLabel: "",
  title: "",
  source: "",
  targetLength: 0,
  typedLength: 0,
  correctLength: 0,
  errorCount: 0,
  backspaceCount: 0,
  comboMax: 0,
  accuracyRate: 0,
  completionRate: 0,
  cpm: 0,
  score: 0,
  durationSeconds: 0,
  timeLimitSeconds: null,
  previewSeconds: null,
  createdAt: "",
  completedAt: "",
  targetPreview: "",
  typedPreview: "",
  contentSnapshot: "",
  typedContent: "",
};

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[10px] border border-[#8cb7cc] bg-white px-3 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
      <div className="text-xs text-[#4d7387]">{label}</div>
      <div className="mt-1 text-[24px] font-bold leading-none text-[#1f5168]">{value}</div>
    </div>
  );
}

export function TypingPracticeResult() {
  const { recordId = "" } = useParams();
  const navigate = useNavigate();
  const isMobileBlocked = useMockExamDesktopGuard();
  const [record, setRecord] = useState<TypingPracticeRecord>(EMPTY_RECORD);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isMobileBlocked) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const next = await mockApi.getTypingPracticeRecord(recordId);
        setRecord(next);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载练习结果失败");
        navigate("/user/typing-practice", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isMobileBlocked, navigate, recordId]);

  const retryHref = useMemo(() => buildTypingPracticeRetryHref(record), [record]);
  const isSuccess = record.completionRate >= 100;
  const policePosition = isSuccess ? 80 : Math.min(74, 12 + Math.round(record.completionRate * 0.68));
  const thiefPosition = 82;

  if (isMobileBlocked) {
    return <MockExamDesktopNotice />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#d7eef9] px-4 py-6">
        <div className="mx-auto max-w-[820px] rounded-[14px] border-2 border-[#6c95a8] bg-[#f8fcff] px-6 py-16 text-center text-[#4b7287]">
          页面加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#d7eef9] px-4 py-6">
      <div className="mx-auto max-w-[820px] overflow-hidden rounded-[12px] border-2 border-[#6c95a8] bg-[#f8fcff] shadow-[0_18px_40px_rgba(43,88,112,0.16)] md:rounded-[14px]">
        <div className={`border-b px-4 py-3 text-center text-[15px] ${isSuccess ? "border-[#d8c16b] bg-[#ffe38b] text-[#7c5d00]" : "border-[#e0b4b4] bg-[#ffd6d6] text-[#8f3434]"}`}>
          {buildTypingPracticeCompletionMessage(isSuccess)}
        </div>

        <div className="px-4 py-4 md:px-5 md:py-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            <StatBox label="得分" value={record.score} />
            <StatBox label="完成度" value={buildTypingAccuracyText(record.completionRate)} />
            <StatBox label="正确率" value={buildTypingAccuracyText(record.accuracyRate)} />
            <StatBox label="速度" value={`${record.cpm} CPM`} />
            <StatBox label="用时" value={formatTypingSecondsText(record.durationSeconds)} />
          </div>

          <div className="relative mt-4 h-[140px] overflow-hidden rounded-[10px] border border-[#b9d6e3] bg-[linear-gradient(180deg,#ccecff_0%,#ddf5ff_56%,#d8f3cf_56%,#bde6b0_100%)] px-3 md:h-[165px] md:px-4">
            <div className="absolute inset-x-5 top-[54%] h-[14px] -translate-y-1/2 rounded-full border border-[#8fb6c8] bg-[#f7fbfd]" />
            <div className="absolute inset-x-6 top-[54%] h-[4px] -translate-y-1/2 rounded-full bg-[repeating-linear-gradient(90deg,#c1d7e1_0_12px,transparent_12px_22px)]" />
            <img
              src={TYPING_PRACTICE_POLICE_IMAGE}
              alt=""
              className="absolute bottom-4 w-[78px] max-w-none -translate-x-1/2 md:bottom-5 md:w-[104px]"
              style={{ left: `${policePosition}%` }}
            />
            <img
              src={TYPING_PRACTICE_THIEF_IMAGE}
              alt=""
              className="absolute bottom-4 w-[78px] max-w-none -translate-x-1/2 md:bottom-5 md:w-[104px]"
              style={{ left: `${thiefPosition}%` }}
            />
          </div>

          <div className="mt-5 text-center">
            <div className="text-[28px] font-bold leading-none text-[#1f5168] md:text-[34px]">本局结算</div>
          </div>

          <div className="mt-4 rounded-[10px] border border-[#d7e7ef] bg-white px-4 py-5 text-center">
            <div className="text-lg font-semibold text-[#315e75]">{record.title}</div>
            <div className="mt-2 text-sm text-[#5d8093]">
              {record.modeLabel}
              {record.source ? ` · ${record.source}` : ""}
            </div>
            <div className="mt-2 text-sm text-[#5d8093]">{record.completedAt}</div>
            <div className="mt-4 space-y-2 text-sm text-[#4c7185]">
              <p>本局得分：{record.score}</p>
              <p>打字速度：{record.cpm} CPM</p>
              <p>正确率：{buildTypingAccuracyText(record.accuracyRate)}</p>
              <p>完成度：{buildTypingAccuracyText(record.completionRate)}</p>
              <p>错误字符：{record.errorCount}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/user/typing-practice")}
              className="h-11 rounded-[10px] border-[#c3d9e5] bg-white px-6 text-base text-[#4e7285]"
            >
              <ArrowLeft className="mr-2 size-4" />
              返回
            </Button>

            <Button
              type="button"
              onClick={() => retryHref && navigate(retryHref)}
              disabled={!retryHref}
              className="h-11 rounded-[10px] border border-[#d6931a] bg-[linear-gradient(180deg,#ffd15f_0%,#f3a72e_100%)] px-8 text-base font-semibold text-[#764800] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] hover:opacity-95 disabled:opacity-60"
            >
              <RotateCcw className="mr-2 size-4" />
              再玩一次
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-[10px] border border-[#d7e7ef] bg-white px-4 py-4">
              <div className="text-sm font-semibold text-[#315e75]">原文</div>
              <div className="mt-3 max-h-[260px] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-[#4c7185]">
                {record.contentSnapshot || record.targetPreview}
              </div>
            </div>

            <div className="rounded-[10px] border border-[#d7e7ef] bg-white px-4 py-4">
              <div className="text-sm font-semibold text-[#315e75]">你的输入</div>
              <div className="mt-3 max-h-[260px] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-[#4c7185]">
                {record.typedContent || "本次没有成功输入任何字符。"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
