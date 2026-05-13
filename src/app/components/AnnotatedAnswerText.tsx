import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import type { MockExamSubjectiveAnswerMark } from "../lib/mockData";

type AnnotatedAnswerTextProps = {
  answer: string;
  marks?: MockExamSubjectiveAnswerMark[];
  emptyText?: string;
  className?: string;
  paragraphClassName?: string;
  plainTextClassName?: string;
};

type ResolvedMark = {
  id: string;
  highlight: string;
  comment: string;
  status: "correct" | "wrong" | "score" | "neutral";
  score?: number;
  originalIndex: number;
  start?: number;
  end?: number;
};

type PositionedMark = ResolvedMark & {
  start: number;
  end: number;
};

type TrackedMark = PositionedMark & {
  trackIndex: number;
};

type Segment =
  | {
      type: "text";
      key: string;
      value: string;
    }
  | {
      type: "mark";
      key: string;
      value: string;
      marks: TrackedMark[];
      endingMarks: TrackedMark[];
    };

const REVIEW_ASSETS = {
  underlineWrong: "https://hd-correct.oss-cn-beijing.aliyuncs.com/common/xcx-icons/%E4%B8%8B%E5%88%92%E7%BA%BF%E7%BA%A2.png",
  underlineRight: "https://hd-correct.oss-cn-beijing.aliyuncs.com/common/xcx-icons/%E8%93%9D%E4%B8%8B%E5%88%92%E7%BA%BF.png",
  cross: "https://hd-correct.oss-cn-beijing.aliyuncs.com/common/xcx-icons/%E5%8F%89%E5%8F%B7.png",
  check: "https://hd-correct.oss-cn-beijing.aliyuncs.com/common/xcx-icons/%E5%AF%B9%E5%8B%BE.png",
  plus: "https://hd-correct.oss-cn-beijing.aliyuncs.com/common/xcx-icons/blue/%E5%8A%A0%E5%8F%B7.png",
  digit: (digit: string) =>
    `https://hd-correct.oss-cn-beijing.aliyuncs.com/common/xcx-icons/blue/${digit}.png`,
  pointCommentBg: "https://hd-correct.oss-cn-beijing.aliyuncs.com/common/xcx-icons/%E8%AF%84%E8%AF%AD%E8%83%8C%E6%99%AF.png",
} as const;

const normalizeMarks = (marks?: MockExamSubjectiveAnswerMark[]) =>
  (marks ?? [])
    .map((item, index) => {
      const highlight = item.highlight?.trim() ?? "";
      if (!highlight) return null;
      return {
        id: item.id || `mark_${index + 1}`,
        highlight,
        comment: item.comment ?? "",
        status: item.status === "wrong" ? "wrong" : item.status === "neutral" ? "neutral" : "correct",
        score: Number.isFinite(Number(item.score)) ? Number(item.score) : undefined,
        originalIndex: index,
        start: Number.isInteger(Number(item.start)) && Number(item.start) >= 0 ? Number(item.start) : undefined,
        end: Number.isInteger(Number(item.end)) && Number(item.end) > Number(item.start) ? Number(item.end) : undefined,
      } satisfies ResolvedMark;
    })
    .filter((item): item is ResolvedMark => Boolean(item));

const statusPriority = (status: ResolvedMark["status"]) => {
  if (status === "correct" || status === "score") return 0;
  if (status === "neutral") return 2;
  return 3;
};

const MARK_EDGE_TRIM_PATTERN = /[\s，,。！？；;、：:“”"'‘’（）()【】《》]/u;

const trimRange = (value: string, start: number, end: number) => {
  let nextStart = start;
  let nextEnd = end;

  while (nextStart < nextEnd && MARK_EDGE_TRIM_PATTERN.test(value[nextStart] ?? "")) {
    nextStart += 1;
  }

  while (nextEnd > nextStart && MARK_EDGE_TRIM_PATTERN.test(value[nextEnd - 1] ?? "")) {
    nextEnd -= 1;
  }

  return { start: nextStart, end: nextEnd };
};

const rangesOverlap = (left: { start: number; end: number }, right: { start: number; end: number }) => left.start < right.end && right.start < left.end;

const findAllOccurrences = (value: string, highlight: string) => {
  if (!highlight) {
    return [];
  }

  const matches: Array<{ start: number; end: number }> = [];
  let searchStart = 0;

  while (searchStart < value.length) {
    const matchIndex = value.indexOf(highlight, searchStart);
    if (matchIndex < 0) {
      break;
    }

    matches.push({ start: matchIndex, end: matchIndex + highlight.length });
    searchStart = matchIndex + 1;
  }

  return matches;
};

const getPositiveHighlightMinLength = (highlight: string) => {
  const compactHighlight = highlight.replace(/\s+/g, "");
  return compactHighlight.length <= 1 ? 1 : 2;
};

const carveNonOverlappingRange = ({
  value,
  candidate,
  usedRanges,
}: {
  value: string;
  candidate: { start: number; end: number };
  usedRanges: Array<{ start: number; end: number }>;
}) => {
  const overlaps = usedRanges
    .filter((range) => rangesOverlap(range, candidate))
    .sort((left, right) => left.start - right.start || left.end - right.end);

  if (overlaps.length === 0) {
    return trimRange(value, candidate.start, candidate.end);
  }

  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = candidate.start;

  for (const overlap of overlaps) {
    if (overlap.start > cursor) {
      gaps.push({ start: cursor, end: Math.min(overlap.start, candidate.end) });
    }
    cursor = Math.max(cursor, overlap.end);
    if (cursor >= candidate.end) {
      break;
    }
  }

  if (cursor < candidate.end) {
    gaps.push({ start: cursor, end: candidate.end });
  }

  return gaps
    .map((gap) => trimRange(value, gap.start, gap.end))
    .filter((gap) => gap.end - gap.start >= 2)
    .sort((left, right) => right.end - right.start - (left.end - left.start))[0] ?? null;
};

const resolveMarkPositions = (value: string, marks: ResolvedMark[]) => {
  if (!value || marks.length === 0) {
    return [];
  }

  const usedRanges: Array<{ start: number; end: number }> = [];
  const positionedMarks: PositionedMark[] = [];
  const usedPositiveOccurrenceCount = new Map<string, number>();
  const directPositionMarks = marks
    .filter(
      (mark) =>
        Number.isInteger(mark.start) &&
        Number.isInteger(mark.end) &&
        Number(mark.start) >= 0 &&
        Number(mark.end) > Number(mark.start) &&
        Number(mark.end) <= value.length,
    )
    .sort((left, right) => Number(left.start) - Number(right.start) || Number(left.end) - Number(right.end) || left.originalIndex - right.originalIndex);
  const marksWithCandidates = marks
    .filter((mark) => !(Number.isInteger(mark.start) && Number.isInteger(mark.end) && Number(mark.end) > Number(mark.start)))
    .map((mark) => ({
      mark,
      candidates: findAllOccurrences(value, mark.highlight),
    }))
    .filter((item) => item.candidates.length > 0)
    .sort((left, right) => {
      const statusDiff = statusPriority(left.mark.status) - statusPriority(right.mark.status);
      if (statusDiff !== 0) return statusDiff;

      const candidateDiff = left.candidates.length - right.candidates.length;
      if (candidateDiff !== 0) return candidateDiff;

      if (left.mark.status === "wrong" && right.mark.status === "wrong") {
        const lengthDiff = left.mark.highlight.length - right.mark.highlight.length;
        if (lengthDiff !== 0) return lengthDiff;
      } else {
        const lengthDiff = right.mark.highlight.length - left.mark.highlight.length;
        if (lengthDiff !== 0) return lengthDiff;
      }

      return left.mark.originalIndex - right.mark.originalIndex;
    });

  for (const mark of directPositionMarks) {
    const start = Number(mark.start);
    const end = Number(mark.end);
    positionedMarks.push({
      ...mark,
      highlight: value.slice(start, end),
      start,
      end,
    });
    usedRanges.push({ start, end });
  }

  for (const item of marksWithCandidates) {
    const isPositiveMark = item.mark.status === "score" || item.mark.status === "correct";
    let resolvedCandidate = null;

    if (isPositiveMark) {
      const minHighlightLength = getPositiveHighlightMinLength(item.mark.highlight);
      const trimmedCandidates = item.candidates
        .map((candidate) => trimRange(value, candidate.start, candidate.end))
        .filter((candidate) => candidate.end - candidate.start >= minHighlightLength);
      const occurrenceIndex = usedPositiveOccurrenceCount.get(item.mark.highlight) ?? 0;
      resolvedCandidate = trimmedCandidates[occurrenceIndex] ?? trimmedCandidates[trimmedCandidates.length - 1] ?? null;
      usedPositiveOccurrenceCount.set(item.mark.highlight, occurrenceIndex + 1);
    } else {
      const exactCandidate = item.candidates.find((candidate) => !usedRanges.some((range) => rangesOverlap(range, candidate)));
      resolvedCandidate = exactCandidate ? trimRange(value, exactCandidate.start, exactCandidate.end) : null;
    }

    if ((!resolvedCandidate || resolvedCandidate.end - resolvedCandidate.start < 2) && item.mark.status === "wrong") {
      resolvedCandidate =
        item.candidates
          .map((candidate) => carveNonOverlappingRange({ value, candidate, usedRanges }))
          .find((candidate) => candidate && candidate.end - candidate.start >= 1) ?? null;
    }

    if (!resolvedCandidate || resolvedCandidate.end - resolvedCandidate.start < 1) {
      continue;
    }

    const positionedMark: PositionedMark = {
      ...item.mark,
      highlight: value.slice(resolvedCandidate.start, resolvedCandidate.end),
      start: resolvedCandidate.start,
      end: resolvedCandidate.end,
    };

    positionedMarks.push(positionedMark);
    usedRanges.push({ start: resolvedCandidate.start, end: resolvedCandidate.end });
  }

  return positionedMarks.sort((left, right) => left.start - right.start || left.end - right.end || left.originalIndex - right.originalIndex);
};

const assignMarkTracks = (sourceMarks: PositionedMark[]): TrackedMark[] => {
  const sortedMarks = [...sourceMarks].sort((left, right) => {
    const startDiff = left.start - right.start;
    if (startDiff !== 0) return startDiff;

    const endDiff = right.end - left.end;
    if (endDiff !== 0) return endDiff;

    const statusDiff = statusPriority(left.status) - statusPriority(right.status);
    if (statusDiff !== 0) return statusDiff;

    return left.originalIndex - right.originalIndex;
  });

  const trackedMarks: TrackedMark[] = [];
  let activeMarks: TrackedMark[] = [];

  for (const mark of sortedMarks) {
    activeMarks = activeMarks.filter((activeMark) => activeMark.end > mark.start);
    const occupiedTracks = new Set(activeMarks.map((activeMark) => activeMark.trackIndex));

    let trackIndex = 0;
    while (occupiedTracks.has(trackIndex)) {
      trackIndex += 1;
    }

    const trackedMark: TrackedMark = {
      ...mark,
      trackIndex,
    };

    activeMarks.push(trackedMark);
    activeMarks.sort((left, right) => left.end - right.end || left.trackIndex - right.trackIndex);
    trackedMarks.push(trackedMark);
  }

  return trackedMarks.sort((left, right) => left.start - right.start || left.end - right.end || left.originalIndex - right.originalIndex);
};

const buildSegmentsFromPositionedMarks = (value: string, sourceMarks: TrackedMark[]): Segment[] => {
  if (sourceMarks.length === 0) {
    return [{ type: "text", key: "text_0", value }];
  }

  const boundaries = Array.from(
    new Set([0, value.length, ...sourceMarks.flatMap((mark) => [mark.start, mark.end])]),
  ).sort((left, right) => left - right);

  const segments: Segment[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (end <= start) {
      continue;
    }

    const segmentValue = value.slice(start, end);
    const overlappingMarks = sourceMarks.filter((mark) => mark.start < end && mark.end > start);

    if (overlappingMarks.length === 0) {
      segments.push({
        type: "text",
        key: `text_${index}_${start}`,
        value: segmentValue,
      });
      continue;
    }

    const endingMarks = overlappingMarks.filter((mark) => mark.end === end);
    segments.push({
      type: "mark",
      key: `mark_${index}_${start}`,
      value: segmentValue,
      marks: overlappingMarks,
      endingMarks,
    });
  }

  return segments;
};

const getMarkMeta = (marks: ResolvedMark[]) => {
  const wrongMarks = marks.filter((item) => item.status === "wrong");
  const positiveMarks = marks.filter((item) => item.status === "correct" || item.status === "score");
  const neutralMarks = marks.filter((item) => item.status === "neutral");

  return {
    status:
      wrongMarks.length > 0 && (positiveMarks.length > 0 || neutralMarks.length > 0)
        ? "mixed"
        : wrongMarks.length > 0
          ? "wrong"
          : positiveMarks.length > 0
            ? "correct"
            : "neutral",
    wrongMarks,
    positiveMarks,
    neutralMarks,
  };
};

const scoreImageWidth = (digit: string) => {
  if (digit === "1") return 9;
  return 14;
};

const getScoreImagesWidth = (scoreText: string) =>
  scoreText.split("").reduce((sum, digit) => sum + (/\d/.test(digit) ? scoreImageWidth(digit) : 16), 0) + 24;

const getPositiveScoreText = (mark: ResolvedMark) =>
  Number.isFinite(mark.score) && Number(mark.score ?? 0) > 0 ? `${Number(mark.score ?? 0)}` : "";

const getPositiveIndicatorWidth = (mark: ResolvedMark) => {
  const hasScore = Boolean(getPositiveScoreText(mark));
  return 20 + (hasScore ? 8 + getScoreImagesWidth(`${Number(mark.score ?? 0)}`) : 0);
};

const getPositiveIndicatorsWidth = (positiveMarks: ResolvedMark[]) =>
  positiveMarks.reduce((sum, mark, index) => sum + getPositiveIndicatorWidth(mark) + (index > 0 ? 6 : 0), 0);

const getNeutralIndicatorsWidth = (neutralMarks: ResolvedMark[]) =>
  neutralMarks.reduce((sum, _mark, index) => sum + 20 + (index > 0 ? 6 : 0), 0);

const buildUnderlineLayers = ({
  marks,
}: {
  marks: TrackedMark[];
}) => {
  const layers: Array<{ id: string; src: string; offset: number }> = [];
  const step = 4;

  for (const mark of [...marks].sort((left, right) => left.trackIndex - right.trackIndex || left.originalIndex - right.originalIndex)) {
    layers.push({
      id: mark.id,
      src: mark.status === "wrong" ? REVIEW_ASSETS.underlineWrong : REVIEW_ASSETS.underlineRight,
      offset: mark.trackIndex * step,
    });
  }

  return layers;
};

const getTrailingReservedWidth = ({
  status,
  wrongMarks,
  positiveMarks,
  neutralMarks,
}: ReturnType<typeof getMarkMeta>) => {
  if (status === "wrong") {
    return wrongMarks.length > 0 ? 30 : 0;
  }
  const positiveWidth = positiveMarks.length > 0 ? getPositiveIndicatorsWidth(positiveMarks) : 0;
  const neutralWidth = neutralMarks.length > 0 ? getNeutralIndicatorsWidth(neutralMarks) : 0;
  if (status === "mixed") {
    return (wrongMarks.length > 0 ? 30 : 0) + neutralWidth + positiveWidth;
  }
  if (neutralMarks.length > 0) {
    return neutralWidth;
  }
  if (positiveMarks.length > 0) {
    return positiveWidth;
  }
  return 0;
};

function ScoreImages({ scoreText }: { scoreText: string }) {
  if (!scoreText) {
    return null;
  }

  const digits = scoreText.split("");

  return (
    <span className="ml-[8px] inline-flex items-end gap-[1px] align-baseline">
      <img
        src={REVIEW_ASSETS.plus}
        alt=""
        aria-hidden="true"
        className="h-[20px] w-[20px] shrink-0 object-contain"
      />
      {digits.map((digit, index) =>
        /\d/.test(digit) ? (
          <img
            key={`${digit}_${index}`}
            src={REVIEW_ASSETS.digit(digit)}
            alt=""
            aria-hidden="true"
            className="h-[20px] shrink-0 object-contain"
            style={{ width: `${scoreImageWidth(digit)}px` }}
          />
        ) : (
          <span
            key={`${digit}_${index}`}
            className="text-[16px] font-semibold leading-none text-[#45a5d8]"
            style={{ fontFamily: '"KaiTi","STKaiti","Kaiti SC",serif' }}
          >
            {digit}
          </span>
        ),
      )}
    </span>
  );
}

const getMarkTrackOffset = (mark: ResolvedMark) => ("trackIndex" in mark && typeof mark.trackIndex === "number" ? mark.trackIndex * 4 : 0);

function PositiveMarkIndicators({ positiveMarks }: { positiveMarks: ResolvedMark[] }) {
  if (positiveMarks.length === 0) {
    return null;
  }

  return (
    <span className="inline-flex items-end gap-[6px] align-baseline">
      {positiveMarks.map((mark) => {
        const scoreText = getPositiveScoreText(mark);
        return (
          <span
            key={mark.id}
            className="inline-flex items-end gap-[2px] align-baseline"
            style={{ marginBottom: `${getMarkTrackOffset(mark)}px` }}
          >
            <img
              src={REVIEW_ASSETS.check}
              alt=""
              aria-hidden="true"
              className="h-[20px] w-[20px] shrink-0 object-contain"
            />
            {scoreText ? <ScoreImages scoreText={scoreText} /> : null}
          </span>
        );
      })}
    </span>
  );
}

function NeutralMarkIndicators({ neutralMarks }: { neutralMarks: ResolvedMark[] }) {
  if (neutralMarks.length === 0) {
    return null;
  }

  return (
    <span className="inline-flex items-end gap-[6px] align-baseline">
      {neutralMarks.map((mark) => (
        <span
          key={mark.id}
          className="inline-flex items-end align-baseline"
          style={{ marginBottom: `${getMarkTrackOffset(mark)}px` }}
        >
          <span className="inline-flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#f0a52b] text-[16px] font-semibold leading-none text-white">
            -
          </span>
        </span>
      ))}
    </span>
  );
}

function MarkedComment({ commentText }: { commentText: string }) {
  const paragraphs = commentText
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="relative w-[min(100vw-120px,1120px)] max-w-[1120px]">
      <div
        className="w-full bg-cover bg-no-repeat shadow-[0_12px_28px_rgba(226,72,90,0.06)]"
        style={{ backgroundImage: `url(${REVIEW_ASSETS.pointCommentBg})` }}
      >
        <div
          className="whitespace-pre-wrap px-[24px] py-[18px] text-[17px] leading-[32px] text-[#e2485a]"
          style={{ fontFamily: '"KaiTi","STKaiti","Kaiti SC",serif' }}
        >
          <span>{"\u8001\u5e08\u8bc4\u8bed\uff1a"}</span>
          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph, index) => (
              <p key={`comment_${index}`} className={index === 0 ? "inline" : "mt-[10px] block"}>
                {index === 0 ? paragraph : paragraph}
              </p>
            ))
          ) : (
            <span>{commentText}</span>
          )}
        </div>
      </div>
      <div className="absolute left-[56px] top-full h-0 w-0 border-l-[14px] border-r-[14px] border-t-[16px] border-l-transparent border-r-transparent border-t-[#f4f1ee]" />
      <div className="absolute left-[56px] top-full translate-y-[-1px] h-0 w-0 border-l-[14px] border-r-[14px] border-t-[16px] border-l-transparent border-r-transparent border-t-white/60 opacity-70" />
    </div>
  );
}

const mergeWrongMarkComments = (wrongMarks: ResolvedMark[]) =>
  Array.from(
    new Set(
      wrongMarks
        .map((item) => item.comment?.trim() ?? "")
        .filter(Boolean),
    ),
  ).join("\n\n");

function WrongMarkIcons({
  wrongMarks,
}: {
  wrongMarks: ResolvedMark[];
}) {
  if (wrongMarks.length === 0) {
    return null;
  }

  const mergedComment = mergeWrongMarkComments(wrongMarks);
  const icon = (
    <img
      src={REVIEW_ASSETS.cross}
      alt=""
      aria-hidden="true"
      className="h-[20px] w-[20px] shrink-0 object-contain"
    />
  );

  if (!mergedComment) {
    return (
      <span
        className="inline-flex items-center align-baseline"
        style={{ marginBottom: `${Math.max(...wrongMarks.map((mark) => getMarkTrackOffset(mark)), 0)}px` }}
      >
        {icon}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-[2px] align-baseline"
      style={{ marginBottom: `${Math.max(...wrongMarks.map((mark) => getMarkTrackOffset(mark)), 0)}px` }}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="inline appearance-none bg-transparent p-0 align-baseline">
            {icon}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={18}
          collisionPadding={24}
          className="w-auto max-w-none rounded-none border-0 bg-transparent p-0 shadow-none"
        >
          <MarkedComment commentText={mergedComment} />
        </PopoverContent>
      </Popover>
    </span>
  );
}

const renderMarkedCore = ({
  segment,
}: {
  segment: Extract<Segment, { type: "mark" }>;
}) => {
  const endingMarkIds = new Set(segment.endingMarks.map((mark) => mark.id));
  const { status, wrongMarks, positiveMarks, neutralMarks } = getMarkMeta(segment.marks);
  const endingWrongMarks = wrongMarks
    .filter((mark) => endingMarkIds.has(mark.id))
    .sort((left, right) => (left as TrackedMark).trackIndex - (right as TrackedMark).trackIndex || left.originalIndex - right.originalIndex);
  const endingPositiveMarks = positiveMarks
    .filter((mark) => endingMarkIds.has(mark.id))
    .sort((left, right) => (left as TrackedMark).trackIndex - (right as TrackedMark).trackIndex || left.originalIndex - right.originalIndex);
  const endingNeutralMarks = neutralMarks
    .filter((mark) => endingMarkIds.has(mark.id))
    .sort((left, right) => (left as TrackedMark).trackIndex - (right as TrackedMark).trackIndex || left.originalIndex - right.originalIndex);
  const underlineLayers = buildUnderlineLayers({
    marks: segment.marks,
  });
  const maxTrackIndex = segment.marks.reduce((max, mark) => Math.max(max, mark.trackIndex), -1);
  const underlinePaddingBottom = maxTrackIndex >= 0 ? 2 + maxTrackIndex * 4 : 2;
  const trailingReservedWidth = getTrailingReservedWidth({
    status:
      endingWrongMarks.length > 0 && (endingPositiveMarks.length > 0 || endingNeutralMarks.length > 0)
        ? "mixed"
        : endingWrongMarks.length > 0
          ? "wrong"
          : endingPositiveMarks.length > 0
            ? "correct"
            : "neutral",
    wrongMarks: endingWrongMarks,
    positiveMarks: endingPositiveMarks,
    neutralMarks: endingNeutralMarks,
  });
  const wrongMarkerOffset = 4 - trailingReservedWidth;

  if (status === "wrong") {
    return (
      <span className="inline align-baseline">
        <span
          className="relative inline align-baseline"
          style={{
            lineHeight: "inherit",
            paddingBottom: `${underlinePaddingBottom}px`,
            paddingRight: `${trailingReservedWidth}px`,
            backgroundImage: underlineLayers.map((layer) => `url(${layer.src})`).join(", "),
            backgroundRepeat: underlineLayers.map(() => "repeat-x").join(", "),
            backgroundPosition: underlineLayers
              .map((layer) => `left calc(100% - ${1 + layer.offset}px)`)
              .join(", "),
            backgroundSize: underlineLayers.map(() => "18px 2px").join(", "),
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
          }}
        >
          {segment.value}
        </span>
        <span className="relative inline-block w-0 align-baseline">
          <span
            className="absolute bottom-0 inline-flex items-end"
            style={{
              left: `${wrongMarkerOffset}px`,
            }}
          >
            <WrongMarkIcons wrongMarks={endingWrongMarks} />
          </span>
        </span>
      </span>
    );
  }

  return (
    <span
      className="relative inline-block max-w-full align-baseline"
      style={{
        paddingRight: trailingReservedWidth > 0 ? `${trailingReservedWidth}px` : undefined,
      }}
    >
      <span
        className="relative inline align-baseline"
        style={{
          lineHeight: "inherit",
          paddingBottom: `${underlinePaddingBottom}px`,
          backgroundImage: underlineLayers.map((layer) => `url(${layer.src})`).join(", "),
          backgroundRepeat: underlineLayers.map(() => "repeat-x").join(", "),
          backgroundPosition: underlineLayers
            .map((layer) => `left calc(100% - ${1 + layer.offset}px)`)
            .join(", "),
          backgroundSize: underlineLayers.map(() => "18px 2px").join(", "),
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        }}
      >
        {segment.value}
      </span>
      {trailingReservedWidth > 0 ? (
        <span className="absolute bottom-0 right-0 inline-flex items-end gap-[2px] align-baseline">
          {endingWrongMarks.length > 0 ? <WrongMarkIcons wrongMarks={endingWrongMarks} /> : null}
          {endingNeutralMarks.length > 0 ? <NeutralMarkIndicators neutralMarks={endingNeutralMarks} /> : null}
          {endingPositiveMarks.length > 0 ? <PositiveMarkIndicators positiveMarks={endingPositiveMarks} /> : null}
        </span>
      ) : null}
    </span>
  );
};

const renderMarkedSegment = ({
  segment,
}: {
  segment: Extract<Segment, { type: "mark" }>;
}): ReactNode => (
  <span key={segment.key} className="inline align-baseline">
    {renderMarkedCore({ segment })}
  </span>
);

export function AnnotatedAnswerText({
  answer,
  marks,
  emptyText = "\u672a\u4f5c\u7b54",
  className,
  paragraphClassName,
  plainTextClassName,
}: AnnotatedAnswerTextProps) {
  const text = answer?.trim() || emptyText;
  const normalizedMarks = normalizeMarks(marks);
  const positionedMarks = assignMarkTracks(resolveMarkPositions(text, normalizedMarks));
  const paragraphMatches = Array.from(text.matchAll(/[^\n]+/g));
  const paragraphs =
    paragraphMatches.length > 0
      ? paragraphMatches.map((match, index) => ({
          key: `paragraph_${index}`,
          value: match[0],
          start: match.index ?? 0,
          end: (match.index ?? 0) + match[0].length,
        }))
      : [{ key: "paragraph_0", value: text, start: 0, end: text.length }];

  return (
    <div className={className}>
      {paragraphs.map((paragraph) => {
        const paragraphMarks = positionedMarks
          .filter((mark) => mark.start >= paragraph.start && mark.end <= paragraph.end)
          .map((mark) => ({
            ...mark,
            start: mark.start - paragraph.start,
            end: mark.end - paragraph.start,
            highlight: paragraph.value.slice(mark.start - paragraph.start, mark.end - paragraph.start),
          }));
        const segments = buildSegmentsFromPositionedMarks(paragraph.value, paragraphMarks);
        return (
          <p key={paragraph.key} className={paragraphClassName ?? "whitespace-pre-wrap"}>
            {segments.map((segment) => {
              if (segment.type === "text") {
                return (
                  <span key={segment.key} className={plainTextClassName}>
                    {segment.value}
                  </span>
                );
              }
              return renderMarkedSegment({ segment });
            })}
          </p>
        );
      })}
    </div>
  );
}
