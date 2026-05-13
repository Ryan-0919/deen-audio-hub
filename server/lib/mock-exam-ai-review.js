import { config } from "./config.js";
import { normalizeDisplayText } from "./text.js";

const subjectiveQuestionType = "subjective_case";
const normalizeMultilineText = (value) => normalizeDisplayText(`${value ?? ""}`.replace(/\r\n/g, "\n")).trim();
const AI_REVIEW_COMMENT_MAX_LENGTH = 450;
const AI_REVIEW_MARK_COMMENT_MAX_LENGTH = 60;
const SUBJECTIVE_REVIEW_MIN_MEANINGFUL_LENGTH = 6;
const KEYWORD_SPLIT_PATTERN = /[\n,，、；;]/;
const SENTENCE_SPLIT_PATTERN = /[。；;！!？?\n]/;
const CLAUSE_SPLIT_PATTERN = /[，,、；;：:\n]/;
const REVIEW_COMMENT_ACTION_HINT_PATTERN = /(补上|补出|写明|写清楚|展开|落到|扣到|带回|对应到|单独起一句|改的时候|回去改|更稳的写法|别只停在|先把|再把|最后把)/;
const REVIEW_COMMENT_GENERIC_PATTERNS = [
  /理由不足/u,
  /展开不够/u,
  /论证不足/u,
  /分析不够/u,
  /分析不够全面/u,
  /有待提升/u,
  /还有提升空间/u,
  /需要继续完善/u,
  /还需继续完善/u,
  /作答不够完整/u,
  /表达不够完整/u,
  /没有充分展开/u,
  /建议进一步完善/u,
  /建议继续完善/u,
];
const SUBJECTIVE_REVIEW_LOW_QUALITY_PATTERNS = [
  /^无$/i,
  /^不会$/i,
  /^不?会答$/i,
  /^不作答$/i,
  /^我不作答$/i,
  /^不会写$/i,
  /^不会做$/i,
  /^不会答这题$/i,
  /^不知道$/i,
  /^不清楚$/i,
  /^怎么答$/i,
  /^不会怎么答$/i,
  /^不会写怎么答$/i,
  /^随便写$/i,
  /^乱写$/i,
  /^不会，?略?$/i,
  /^略$/i,
  /^不会写，?略?$/i,
  /^不知道怎么答$/i,
  /^不会做这题$/i,
  /^我不会$/i,
];
const SUBJECTIVE_REVIEW_CONCLUSION_WHITELIST = new Set([
  "能",
  "不能",
  "可以",
  "不可以",
  "可以追加",
  "不能追加",
  "能追加",
  "构成",
  "不构成",
  "成立",
  "不成立",
  "属于",
  "不属于",
  "违反",
  "不违反",
  "支持",
  "不支持",
  "应当",
  "不应当",
  "可以另行起诉",
  "不能另行起诉",
  "可以起诉",
  "不能起诉",
]);
const SUBJECTIVE_REVIEW_CONCLUSION_PREFIXES = [
  "能",
  "不能",
  "可以",
  "不可以",
  "构成",
  "不构成",
  "成立",
  "不成立",
  "属于",
  "不属于",
  "违反",
  "不违反",
  "支持",
  "不支持",
  "应当",
  "不应当",
  "无效",
  "有效",
  "可撤销",
  "不可撤销",
  "可以追加",
  "不能追加",
  "可以起诉",
  "不能起诉",
  "可以追偿",
  "不能追偿",
  "可以作为",
  "不能作为",
];
const getUnicodeLength = (value) => Array.from(`${value ?? ""}`).length;
const sliceUnicodeText = (value, maxLength) => Array.from(`${value ?? ""}`).slice(0, maxLength).join("");
const applyNaturalReviewCommentLineBreaks = (value) =>
  normalizeMultilineText(value)
    .replace(
      /([。！？；])\s*(核心失分点|采分点分析|思维诊断|可执行建议|你这道题主要缺的是|你这一问重点要展开的是|还有一个很明显的问题是|你下次可以这样答[:：]?)/g,
      "$1\n\n$2",
    )
    .replace(/\n{3,}/g, "\n\n");
const stripStepLabel = (value) =>
  normalizeText(value)
    .replace(/^(?:第[一二三123]步|先|再|最后)[，,:：\s]*/u, "")
    .replace(/[。；;，,\s]+$/u, "")
    .trim();
const hashReviewText = (value) =>
  Array.from(`${value ?? ""}`).reduce((result, char) => ((result * 33 + char.codePointAt(0)) >>> 0), 5381);
const pickReviewVariant = (variants, seed) => {
  if (!Array.isArray(variants) || variants.length === 0) {
    return "";
  }
  return variants[hashReviewText(seed) % variants.length] ?? variants[0];
};
const buildNaturalSuggestionClause = ({ stepOne, stepTwo, stepThree, seed }) => {
  const actions = [stepOne, stepTwo, stepThree]
    .map((item) => stripStepLabel(item))
    .filter(Boolean);

  const [first = "把主结论先写稳", second = "把采分点对应的依据和题干事实扣上", third = "回头检查有没有漏掉题目要求展开的层次"] = actions;
  return pickReviewVariant(
    [
      `先${first}，再${second}，最后${third}`,
      `把${first}写明白，再顺着题目的采分点去${second}，收尾时别忘了${third}`,
      `别一上来就堆概念，直接${first}，接着${second}，结尾再${third}`,
    ],
    `${seed}|suggestion`,
  );
};
const naturalizeMechanicalSuggestionParagraph = (value) => {
  const text = normalizeMultilineText(value);
  if (!text) {
    return "";
  }

  const stepMatches = Array.from(text.matchAll(/第([一二三123])步[，,:：\s]*([^。；;\n]+)/gu));
  if (stepMatches.length >= 2) {
    const orderedSteps = stepMatches
      .map((match) => ({
        order: ["一", "1", "二", "2", "三", "3"].includes(match[1]) ? { 一: 1, "1": 1, 二: 2, "2": 2, 三: 3, "3": 3 }[match[1]] : 99,
        text: match[2],
      }))
      .sort((left, right) => left.order - right.order)
      .map((item) => item.text);

    return `这题回去改时，${buildNaturalSuggestionClause({
      stepOne: orderedSteps[0],
      stepTwo: orderedSteps[1],
      stepThree: orderedSteps[2],
      seed: text,
    })}。`;
  }

  return text
    .replace(/^建议[:：]?\s*第一步[，,:：\s]*/u, "这题回去改时，先")
    .replace(/^第一步[，,:：\s]*/u, "这题回去改时，先")
    .replace(/(?:；|;|。)\s*第二步[，,:：\s]*/gu, "，再")
    .replace(/(?:；|;|。)\s*第三步[，,:：\s]*/gu, "，最后")
    .replace(/^建议[:：]?\s*/u, "更稳的写法是：")
    .replace(/\n{2,}/g, "\n")
    .trim();
};
const enrichReviewCommentWithActionableGuidance = (value) => {
  const text = normalizeMultilineText(value);
  if (!text) {
    return "";
  }

  const hasActionHint = REVIEW_COMMENT_ACTION_HINT_PATTERN.test(text);
  if (hasActionHint) {
    return text;
  }

  const missingMatch = text.match(/最欠的是([^。！？\n]+)/);
  const missingText = missingMatch?.[1]?.replace(/[，,；;。]+$/g, "").trim();
  if (!missingText) {
    return text;
  }

  return `${text}\n\n这题如果你现在回去修改，别只停在结论，把${missingText}单独补出来，每一点都尽量写成“结论 + 依据 + 结合本案”的样子。`;
};
const isWeakReviewComment = (value) => {
  const text = normalizeText(value);
  if (!text) {
    return true;
  }

  const textLength = getUnicodeLength(text);
  const sentenceCount = text.split(SENTENCE_SPLIT_PATTERN).map((item) => item.trim()).filter(Boolean).length;
  const hasActionHint = REVIEW_COMMENT_ACTION_HINT_PATTERN.test(text);
  const genericPatternHit = REVIEW_COMMENT_GENERIC_PATTERNS.some((pattern) => pattern.test(text));
  const mentionsConcreteMissingPoint = /你现在还缺|最该补上的其实是|真正失分就在|漏掉了|没有覆盖|没有体现|没有交代|没有写到/u.test(text);

  if (textLength < 55) {
    return true;
  }

  if (sentenceCount < 2) {
    return true;
  }

  if (genericPatternHit && !mentionsConcreteMissingPoint) {
    return true;
  }

  if (!hasActionHint && !mentionsConcreteMissingPoint) {
    return true;
  }

  return false;
};
const normalizeAiReviewComment = (value, maxLength = AI_REVIEW_COMMENT_MAX_LENGTH) => {
  const text = enrichReviewCommentWithActionableGuidance(applyNaturalReviewCommentLineBreaks(sanitizeReviewExposureText(value)));
  if (!text) {
    return "";
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean)
    .slice(0, 3);
  const normalized = paragraphs.join("\n\n").trim();
  if (!normalized) {
    return "";
  }

  if (getUnicodeLength(normalized) <= maxLength) {
    return normalized;
  }

  const clipped = sliceUnicodeText(normalized, maxLength);
  const cutoffMarkers = ["。", "；", "！", "？", "\n"];
  const bestCutoff = cutoffMarkers.reduce((result, marker) => {
    const index = clipped.lastIndexOf(marker);
    return index > result ? index : result;
  }, -1);

  if (bestCutoff >= Math.floor(maxLength * 0.6)) {
    return clipped.slice(0, bestCutoff + 1).trim();
  }

  return `${sliceUnicodeText(clipped, Math.max(0, maxLength - 1)).trim()}…`;
};
const truncateNormalizedReviewText = (value, maxLength, cutoffMarkers) => {
  const normalized = `${value ?? ""}`.trim();
  if (!normalized) {
    return "";
  }

  if (getUnicodeLength(normalized) <= maxLength) {
    return normalized;
  }

  const clipped = sliceUnicodeText(normalized, maxLength);
  const bestCutoff = cutoffMarkers.reduce((result, marker) => {
    const index = clipped.lastIndexOf(marker);
    return index > result ? index : result;
  }, -1);

  if (bestCutoff >= Math.floor(maxLength * 0.6)) {
    return clipped.slice(0, bestCutoff + 1).trim();
  }

  return `${sliceUnicodeText(clipped, Math.max(0, maxLength - 1)).trim()}…`;
};
const normalizeReturnedAiReviewComment = (value, maxLength = AI_REVIEW_COMMENT_MAX_LENGTH) => {
  const text = sanitizeReviewExposureText(normalizeMultilineText(value));
  if (!text) {
    return "";
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean)
    .slice(0, 3);

  return truncateNormalizedReviewText(paragraphs.join("\n\n"), maxLength, ["。", "；", "！", "？", "\n"]);
};
export const humanizeAiReviewComment = (value) => {
  const normalized = normalizeAiReviewComment(value);
  if (!normalized) {
    return "";
  }

  const humanized = normalized
    .replace(/^(虽然|尽管|结论上|结论方面|方向上|方向方面).{0,20}?[，。,；]\s*/g, "")
    .replace(/^(你虽然|你尽管).{0,24}?[，。,；]\s*/g, "")
    .replace(/^(能|不能|可以|不可以|构成|不构成)(这两个字|这一点)?(你)?(拿到了|答到了|写到了).{0,20}?[，。,；]\s*/g, "")
    .replace(/^(结论|方向)(是对的|没问题|正确).{0,20}?[，。,；]\s*/g, "")
    .replace(/^(你这个答案)?(结论|方向).{0,12}?(是对的|答对了|没偏).{0,20}?[，。,；]\s*/g, "")
    .replace(/核心失分点[:：]?\s*/g, "")
    .replace(/采分点分析[:：]?\s*/g, "你这道题主要缺的是")
    .replace(/思维诊断[:：]?\s*/g, "还有一个很明显的问题是")
    .replace(/可执行建议[:：]?\s*/g, "你下次可以这样答")
    .replace(/本题真正的失分核心是[:：]?\s*/g, "")
    .replace(/本题重点需要展开[:：]?\s*/g, "你这一问重点要展开的是")
    .replace(/而你的答案目前缺少/g, "你现在还缺")
    .replace(/你目前的答题习惯，存在/g, "你现在的答题习惯有")
    .replace(/这会导致你容易/g, "这样写很容易让你")
    .replace(/以后遇到这类题，建议你[:：]?\s*/g, "这道题回去改时，")
    .replace(/你这道题真正丢分的地方，我直接给你点出来[:：]?/g, "这道题你真正丢分的地方，其实就在")
    .replace(/你这一问重点要展开的是/g, "你这一问最该补上的其实是")
    .replace(/还有一个很明显的问题是/g, "还有一个问题你得留意")
    .replace(/你下次可以这样答/g, "这道题回去改时")
    .replace(/你后面答这类题时/g, "这道题回去改时")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return humanized
    .split(/\n{2,}/)
    .map((paragraph) => naturalizeMechanicalSuggestionParagraph(paragraph))
    .filter(Boolean)
    .join("\n\n")
    .trim();
};

const REVIEW_TEXT_EXPOSURE_REPLACEMENTS = [
  [/题库/gu, "批改依据"],
  [/AI报告/gu, "批改意见"],
  [/AI点评/gu, "点评"],
  [/AI批改/gu, "批改"],
  [/AI 批改/gu, "批改"],
  [/AI处理中/gu, "批改中"],
  [/AI待批改/gu, "待批改"],
  [/等待 AI 批改/gu, "待批改"],
  [/AI 批改中/gu, "批改中"],
  [/远程 AI/gu, "远程阅卷"],
  [/系统批改/gu, "批改结果"],
];

export const sanitizeReviewExposureText = (value) => {
  const text = `${value ?? ""}`;
  if (!text) {
    return "";
  }

  return REVIEW_TEXT_EXPOSURE_REPLACEMENTS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);
};
export const normalizeAiMarkComment = (value, maxLength = AI_REVIEW_MARK_COMMENT_MAX_LENGTH) => {
  const normalized = sanitizeReviewExposureText(normalizeText(value))
    .replace(/^建议后面的修改为[:：]?\s*/u, "这句直接改成")
    .replace(/^建议(?:修改为|改成)[:：]?\s*/u, "这句直接改成")
    .replace(/^建议你(?:把)?这句改成[:：]?\s*/u, "这句直接改成")
    .replace(/^建议你(?:把)?这里改成[:：]?\s*/u, "这里直接改成")
    .replace(/^建议你(?:把)?/u, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }
  if (getUnicodeLength(normalized) <= maxLength) {
    return normalized;
  }

  const clipped = sliceUnicodeText(normalized, maxLength);
  const cutoffMarkers = ["。", "；", "，"];
  const bestCutoff = cutoffMarkers.reduce((result, marker) => {
    const index = clipped.lastIndexOf(marker);
    return index > result ? index : result;
  }, -1);

  if (bestCutoff >= Math.floor(maxLength * 0.5)) {
    return clipped.slice(0, bestCutoff + 1).trim();
  }

  return `${sliceUnicodeText(clipped, Math.max(0, maxLength - 1)).trim()}…`;
};
const normalizeReturnedAiMarkComment = (value, maxLength = AI_REVIEW_MARK_COMMENT_MAX_LENGTH) =>
  truncateNormalizedReviewText(
    sanitizeReviewExposureText(normalizeText(value)).replace(/\s+/g, " ").trim(),
    maxLength,
    ["。", "；", "，"],
  );

const LEGACY_AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS = Object.freeze({
  gradingPrinciples: "{{æ‰¹æ”¹åŽŸåˆ™}}",
  outputRequirements: "{{è¾“å‡ºè¦æ±‚}}",
  questionData: "{{é¢˜ç›®æ•°æ®}}",
});

export const AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS = Object.freeze({
  gradingPrinciples: "{{批改原则}}",
  outputRequirements: "{{输出要求}}",
  questionData: "{{题目数据}}",
});

const AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDER_ALIASES = Object.freeze(
  Object.fromEntries(
    Object.keys(AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS).map((key) => [
      key,
      Array.from(
        new Set(
          [AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS[key], LEGACY_AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS[key]]
            .map((item) => `${item ?? ""}`.trim())
            .filter(Boolean),
        ),
      ),
    ]),
  ),
);

const normalizePromptTemplatePlaceholders = (value) =>
  Object.entries(AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDER_ALIASES).reduce(
    (result, [key, aliases]) =>
      aliases.reduce(
        (content, placeholder) => content.split(placeholder).join(AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS[key]),
        result,
      ),
    `${value ?? ""}`,
  );
const normalizeLegacyMechanicalPromptText = (value) =>
  `${value ?? ""}`
    .replace(
      /在[“"]?可执行建议[”"]?里要告诉学生以后遇到同类题第一步做什么、第二步做什么、第三步做什么，但语气仍然要像老师当面提醒，不要像说明书。?/g,
      "在建议部分要直接告诉学生下一次该怎么改、怎么补，但不要写成“第一步、第二步、第三步”这种流程卡片式话术。",
    )
    .replace(
      /在[“"]?可执行建议[”"]?里必须写出[“"]?第一步、第二步、第三步[”"]?，不能只写空泛建议。?/g,
      "建议部分要直接告诉学生下一次该怎么改、怎么补，但不要机械写成“第一步、第二步、第三步”这种流程模板。",
    )
    .replace(
      /reviewComment 在[“"]?可执行建议[”"]?部分必须明确写出[“"]?第一步、第二步、第三步[”"]?。?/g,
      "reviewComment 的建议部分要自然地告诉学生下一次该怎么改，但不要写成“第一步、第二步、第三步”这种说明书式结构。",
    )
    .replace(
      /reviewComment 在[“"]?可执行建议[”"]?部分要自然告诉学生第一步做什么、第二步做什么、第三步做什么。?/g,
      "reviewComment 在建议部分要自然告诉学生下一次该怎么改，但不要写成“第一步、第二步、第三步”这种模板话术。",
    );

export const DEFAULT_AI_REVIEW_SYSTEM_PROMPT = [
  "你是国家统一法律职业资格考试主观题阅卷老师。",
  "你必须严格依据我提供的参考答案、批改说明、采分点和分值批改，不得自行扩展评分标准。",
  "如果我提供的参考答案、批改说明或采分点与通用法学表述不一致，也必须以当前这道题提供的批改依据为准。",
  "你的评语风格要像老师在直接对学生说话，语言自然、明确、专业，不要使用冰冷的机器描述。",
  "你在指出问题时，必须明确说出学生漏了什么、错了什么，以及下一步应该怎么补、怎么改。",
  "你的总点评必须尽量写成老师阅卷后的完整反馈，不要只写一句结论。",
  "你的总点评不要复述学生原答案，不要一味重复学生写了什么。",
  "你的总点评可以有清晰结构，但不要写成生硬模板，不要像机器报告，也不要像公文。",
  "你的表达要像老师在给学生讲题，亲切、自然、有针对性，让学生一眼能看懂自己到底错在哪、下一次该怎么改。",
  "你的总点评请控制在 450 字以内，尽量写成 2 到 4 个自然短段落。",
  "你的总点评请围绕这几个层次自然展开：核心失分点、采分点分析、思维诊断、可执行建议。",
  "你可以用这些层次来组织内容，但不要机械套话，不要每一段都写得像固定表格。",
  "在建议部分要直接告诉学生下一次该怎么改、怎么补，但不要写成“第一步、第二步、第三步”这种流程卡片式话术。",
  "你只能返回合法 JSON，不要输出任何额外解释、前缀、Markdown 或代码块。",
].join("\n");

export const DEFAULT_AI_REVIEW_USER_PROMPT_TEMPLATE = [
  "你现在只批改 1 道主观大题，请一次性完成该大题下全部小问的评分。",
  "",
  "【批改原则】",
  AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS.gradingPrinciples,
  "",
  "【输出要求】",
  AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS.outputRequirements,
  "",
  "【题目与考生作答数据】",
  AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS.questionData,
  "",
  "请严格按照以上要求批改，并且只返回 JSON。",
].join("\n");

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseJsonSafely = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const normalizeText = (value) => normalizeDisplayText(`${value ?? ""}`.replace(/\r\n/g, "\n")).trim();
const normalizeSubjectiveAnswerForDetection = (value) =>
  normalizeText(value)
    .replace(/[，,。！？；、\s]+/g, "")
    .trim();
const buildTextRanges = (value, separatorPattern) => {
  const source = `${value ?? ""}`;
  if (!source) {
    return [];
  }

  const ranges = [];
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    if (!separatorPattern.test(source[index])) {
      continue;
    }

    const segment = source.slice(start, index);
    if (normalizeText(segment)) {
      ranges.push({ start, end: index, text: segment });
    }
    start = index + 1;
  }

  const tail = source.slice(start);
  if (normalizeText(tail)) {
    ranges.push({ start, end: source.length, text: tail });
  }

  return ranges.length > 0 ? ranges : normalizeText(source) ? [{ start: 0, end: source.length, text: source }] : [];
};
const findRangeIndexBySpan = (ranges, start, end) => ranges.findIndex((range) => start < range.end && end > range.start);
const sumRubricAwardedScores = (rubricPoints) =>
  (Array.isArray(rubricPoints) ? rubricPoints : []).reduce((sum, point) => sum + Math.max(0, Number(point?.awardedScore ?? 0) || 0), 0);
const compareHitEvidencePriority = (left, right) =>
  right.keywordStrength - left.keywordStrength ||
  right.evidenceLength - left.evidenceLength ||
  left.awardedScore - right.awardedScore ||
  left.sortOrder - right.sortOrder ||
  left.index - right.index;
const tightenAiRubricPointHits = ({ rubricPoints, answerText }) => {
  const normalizedAnswer = normalizeText(answerText);
  const normalizedPoints = Array.isArray(rubricPoints) ? rubricPoints : [];
  if (!normalizedAnswer || normalizedPoints.length === 0) {
    return normalizedPoints;
  }

  const sentenceRanges = buildTextRanges(normalizedAnswer, SENTENCE_SPLIT_PATTERN);
  const clauseRanges = buildTextRanges(normalizedAnswer, CLAUSE_SPLIT_PATTERN);
  const compactAnswerLength = getUnicodeLength(normalizeSubjectiveAnswerForDetection(normalizedAnswer));
  const positiveCandidates = normalizedPoints
    .map((point, index) => {
      if (!point?.hit || !(Number(point?.awardedScore ?? 0) > 0)) {
        return null;
      }

      const evidence =
        findAnswerHighlight(
          normalizedAnswer,
          point?.matchedText ||
            normalizeKeywords(point?.keywords).sort((left, right) => right.length - left.length)[0] ||
            point?.title ||
            "",
        ) || "";
      if (!evidence) {
        return {
          index,
          keepable: false,
        };
      }

      const evidenceStart = normalizedAnswer.indexOf(evidence);
      const evidenceEnd = evidenceStart >= 0 ? evidenceStart + evidence.length : -1;
      const keywordStrength = Math.max(
        0,
        ...normalizeKeywords(point?.keywords).map((keyword) => getUnicodeLength(findAnswerHighlight(normalizedAnswer, keyword))),
      );

      return {
        index,
        keepable: evidenceStart >= 0 && evidenceEnd > evidenceStart,
        evidence,
        evidenceKey: normalizeSubjectiveAnswerForDetection(evidence),
        evidenceLength: getUnicodeLength(evidence),
        awardedScore: Math.max(0, Number(point?.awardedScore ?? 0) || 0),
        sortOrder: Number(point?.sortOrder ?? index + 1),
        keywordStrength,
        clauseIndex: evidenceStart >= 0 ? findRangeIndexBySpan(clauseRanges, evidenceStart, evidenceEnd) : -1,
      };
    })
    .filter(Boolean);

  const keepByEvidence = new Map();
  positiveCandidates.forEach((candidate) => {
    if (!candidate.keepable || !candidate.evidenceKey) {
      return;
    }

    const previous = keepByEvidence.get(candidate.evidenceKey);
    if (!previous || compareHitEvidencePriority(candidate, previous) < 0) {
      keepByEvidence.set(candidate.evidenceKey, candidate);
    }
  });

  const dedupedCandidates = Array.from(keepByEvidence.values());
  const maxPositiveHitCount =
    sentenceRanges.length <= 1
      ? clauseRanges.length <= 1 && compactAnswerLength <= 36
        ? 1
        : clauseRanges.length <= 2 && compactAnswerLength <= 72
          ? 2
          : Number.POSITIVE_INFINITY
      : Number.POSITIVE_INFINITY;

  const keepIndexes = new Set();
  if (Number.isFinite(maxPositiveHitCount)) {
    const bestCandidateByClause = new Map();
    dedupedCandidates.forEach((candidate) => {
      const clauseKey = candidate.clauseIndex >= 0 ? `clause_${candidate.clauseIndex}` : `index_${candidate.index}`;
      const previous = bestCandidateByClause.get(clauseKey);
      if (!previous || compareHitEvidencePriority(candidate, previous) < 0) {
        bestCandidateByClause.set(clauseKey, candidate);
      }
    });

    const prioritizedCandidates = Array.from(bestCandidateByClause.values()).sort((left, right) => {
      if (left.clauseIndex !== right.clauseIndex) {
        return left.clauseIndex - right.clauseIndex;
      }
      return compareHitEvidencePriority(left, right);
    });

    prioritizedCandidates.slice(0, maxPositiveHitCount).forEach((candidate) => {
      keepIndexes.add(candidate.index);
    });
  } else {
    dedupedCandidates.forEach((candidate) => {
      keepIndexes.add(candidate.index);
    });
  }

  return normalizedPoints.map((point, index) => {
    const candidate = positiveCandidates.find((item) => item.index === index) ?? null;
    if (!candidate) {
      return point;
    }

    if (!candidate.keepable || !keepIndexes.has(index)) {
      return {
        ...point,
        hit: false,
        awardedScore: 0,
        matchedText: "",
      };
    }

    return {
      ...point,
      matchedText: candidate.evidence,
    };
  });
};
const isConclusionLikeSubjectiveAnswer = (value) => {
  const raw = normalizeText(value);
  if (!raw) {
    return false;
  }

  const compact = normalizeSubjectiveAnswerForDetection(raw);
  if (!compact) {
    return false;
  }

  if (SUBJECTIVE_REVIEW_CONCLUSION_WHITELIST.has(compact)) {
    return true;
  }

  const segments = raw
    .split(/[。！？；;\n]/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  if (segments.length > 1 || compact.length > 18) {
    return false;
  }

  return SUBJECTIVE_REVIEW_CONCLUSION_PREFIXES.some((prefix) => compact.startsWith(prefix));
};
const normalizeProvider = (value) => `${value ?? ""}`.trim().toLowerCase();
const normalizeReviewProvider = (value) => {
  const provider = normalizeProvider(value);
  if (provider === "openai-compatible") {
    return "openai-compatible";
  }
  if (provider === "rules") {
    return "rules";
  }
  return "";
};
const clampInteger = (value, min, max) => {
  const normalized = Number.parseInt(`${value ?? ""}`, 10);
  if (!Number.isFinite(normalized)) {
    return min;
  }
  return Math.max(min, Math.min(max, normalized));
};

const isOpenAiCompatibleProvider = (runtimeConfig) => normalizeProvider(runtimeConfig?.provider) === "openai-compatible";
const isOpenAiCompatibleReady = (runtimeConfig) =>
  isOpenAiCompatibleProvider(runtimeConfig) &&
  Boolean(`${runtimeConfig?.baseUrl ?? ""}`.trim()) &&
  Boolean(`${runtimeConfig?.apiKey ?? ""}`.trim()) &&
  Boolean(`${runtimeConfig?.model ?? ""}`.trim());

export const normalizeAiReviewSystemPrompt = (value) =>
  normalizeMultilineText(normalizeLegacyMechanicalPromptText(value)) || DEFAULT_AI_REVIEW_SYSTEM_PROMPT;
export const normalizeAiReviewUserPromptTemplate = (value) =>
  normalizePromptTemplatePlaceholders(
    normalizeMultilineText(normalizeLegacyMechanicalPromptText(value)) || DEFAULT_AI_REVIEW_USER_PROMPT_TEMPLATE,
  );
export const getAiReviewPromptTemplateMissingPlaceholders = (value) =>
  Object.values(AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS).filter((placeholder) => !normalizeAiReviewUserPromptTemplate(value).includes(placeholder));

const extractCompletionText = (payload) => {
  const messageContent = payload?.choices?.[0]?.message?.content;
  if (typeof messageContent === "string") {
    return messageContent.trim();
  }
  if (Array.isArray(messageContent)) {
    return messageContent
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.content === "string") return item.content;
        return "";
      })
      .join("")
      .trim();
  }
  if (typeof payload?.output_text === "string") {
    return payload.output_text.trim();
  }
  return "";
};

const repairJsonLikeText = (value) => {
  const source = `${value ?? ""}`;
  let result = "";
  let inString = false;
  let escaping = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (escaping) {
      result += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaping = true;
      continue;
    }

    if (char === "\"") {
      if (!inString) {
        inString = true;
        result += char;
        continue;
      }

      let lookAhead = index + 1;
      while (lookAhead < source.length && /\s/.test(source[lookAhead])) {
        lookAhead += 1;
      }
      const nextChar = source[lookAhead] ?? "";

      if (nextChar === ":" || nextChar === "," || nextChar === "}" || nextChar === "]" || nextChar === "") {
        inString = false;
        result += char;
      } else {
        result += "\\\"";
      }
      continue;
    }

    if (inString && (char === "\n" || char === "\r")) {
      result += char === "\r" ? "\\r" : "\\n";
      continue;
    }

    result += char;
  }

  return result;
};

const extractJsonPayload = (text) => {
  const normalized = `${text ?? ""}`.trim();
  if (!normalized) {
    return null;
  }

  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || normalized;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  const jsonText = firstBrace >= 0 && lastBrace >= firstBrace ? candidate.slice(firstBrace, lastBrace + 1) : candidate;
  const directParsed = parseJsonSafely(jsonText, null);
  if (directParsed) {
    return directParsed;
  }

  const repairedJsonText = jsonText
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const repairedParsed = parseJsonSafely(repairedJsonText, null);
  if (repairedParsed) {
    return repairedParsed;
  }

  return parseJsonSafely(repairJsonLikeText(repairedJsonText), null);
};

const truncateText = (value, maxLength = 1000) => {
  const normalized = `${value ?? ""}`.trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...(truncated)` : normalized;
};

const buildAiResponseDebugPreview = ({ payload, content, parsed }) =>
  truncateText(
    JSON.stringify(
      {
        contentPreview: truncateText(content, 600),
        parsedKeys: parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 20) : [],
        parsedSubQuestionCount: Array.isArray(parsed?.subQuestions) ? parsed.subQuestions.length : null,
        parsedPreview: parsed,
        payloadChoiceCount: Array.isArray(payload?.choices) ? payload.choices.length : null,
      },
      null,
      2,
    ),
    1600,
  );

const withAiDebugMessage = (message, debugPreview) => (debugPreview ? `${message}。AI 原始返回：${debugPreview}` : message);
const stripHtmlTags = (value) =>
  `${value ?? ""}`
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const looksLikeHtmlDocument = (value) => {
  const text = `${value ?? ""}`.trim().toLowerCase();
  if (!text) {
    return false;
  }
  return text.startsWith("<!doctype html") || text.startsWith("<html") || text.includes("<head") || text.includes("<body");
};
const extractRemoteErrorMessage = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const directCandidates = [
    payload?.error?.message,
    payload?.error?.msg,
    payload?.message,
    payload?.msg,
    payload?.detail,
    payload?.error_description,
  ];
  for (const item of directCandidates) {
    const normalized = normalizeText(item);
    if (normalized) {
      return normalized;
    }
  }

  if (Array.isArray(payload?.errors)) {
    const joined = payload.errors
      .map((item) => normalizeText(item?.message ?? item?.msg ?? item?.detail ?? item))
      .filter(Boolean)
      .join("；");
    if (joined) {
      return joined;
    }
  }

  return "";
};

const toSubQuestionSequenceId = (value) => {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }

  if (/^sub_\d+$/i.test(text)) {
    return text.toLowerCase();
  }

  const numericMatch = text.match(/^\d+$/);
  if (numericMatch?.[0]) {
    return `sub_${numericMatch[0]}`;
  }

  const subMatch = text.match(/(?:^|[_-])sub[_-]?(\d+)$/i);
  return subMatch?.[1] ? `sub_${subMatch[1]}` : "";
};

const getReturnedSubQuestionIdentifiers = (item) =>
  Array.from(
    new Set(
      [
        normalizeText(item?.id),
        normalizeText(item?.subQuestionId),
        normalizeText(item?.sub_question_id),
        normalizeText(item?.questionId),
        normalizeText(item?.question_id),
        toSubQuestionSequenceId(item?.id),
        toSubQuestionSequenceId(item?.subQuestionId),
        toSubQuestionSequenceId(item?.sub_question_id),
        toSubQuestionSequenceId(item?.questionId),
        toSubQuestionSequenceId(item?.question_id),
      ].filter(Boolean),
    ),
  );

const getAllocationSubQuestionIdentifiers = (allocation, index) =>
  Array.from(
    new Set(
      [normalizeText(allocation?.id), toSubQuestionSequenceId(allocation?.id), `sub_${index + 1}`].filter(Boolean),
    ),
  );

const normalizeAiReviewResponsePayload = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const rawSubQuestions = Array.isArray(value?.subQuestions)
    ? value.subQuestions
    : Array.isArray(value?.sub_questions)
      ? value.sub_questions
      : [];

  return {
    ...value,
    subQuestions: rawSubQuestions.map((item) => ({
      ...item,
      id:
        normalizeText(item?.id) ||
        normalizeText(item?.subQuestionId) ||
        normalizeText(item?.sub_question_id) ||
        toSubQuestionSequenceId(item?.questionId) ||
        toSubQuestionSequenceId(item?.question_id) ||
        "",
      score: item?.score ?? item?.awardedScore ?? item?.awarded_score ?? 0,
      reviewComment: item?.reviewComment ?? item?.review_comment ?? item?.totalComment ?? item?.total_comment ?? item?.comment ?? "",
      referenceAnswer: item?.referenceAnswer ?? item?.reference_answer ?? "",
      abilityLabel: item?.abilityLabel ?? item?.ability_label ?? "",
      rubricGuidance: item?.rubricGuidance ?? item?.rubric_guidance ?? "",
      rubricPoints: Array.isArray(item?.rubricPoints) ? item.rubricPoints : item?.rubric_points,
      missedPoints: Array.isArray(item?.missedPoints) ? item.missedPoints : item?.missed_points,
      answerMarks: Array.isArray(item?.answerMarks) ? item.answerMarks : item?.answer_marks,
    })),
  };
};

const normalizeKeywords = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : `${value ?? ""}`.split(KEYWORD_SPLIT_PATTERN))
        .map((item) => `${item ?? ""}`.trim())
        .filter(Boolean),
    ),
  );

const normalizeRubricPoints = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item, index) => ({
      id: `${item?.id ?? `point_${index + 1}`}`.trim(),
      title: normalizeText(item?.title),
      score: Math.max(0, Number.parseInt(`${item?.score ?? ""}`, 10) || 0),
      description: normalizeText(item?.description),
      keywords: normalizeKeywords(item?.keywords),
      sortOrder: Number(item?.sortOrder ?? index + 1),
    }))
    .filter((item) => item.title)
    .sort((left, right) => left.sortOrder - right.sortOrder);

const normalizeAiRubricPoints = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item, index) => {
      const normalized = normalizeRubricPoints([item])[0] ?? {
        id: `${item?.id ?? item?.pointId ?? item?.point_id ?? `point_${index + 1}`}`.trim(),
        title: normalizeText(item?.title),
        score: Math.max(0, Number.parseInt(`${item?.score ?? ""}`, 10) || 0),
        description: normalizeText(item?.description),
        keywords: normalizeKeywords(item?.keywords),
        sortOrder: Number(item?.sortOrder ?? item?.sort_order ?? index + 1),
      };

      return {
        ...normalized,
        hit: Boolean(item?.hit),
        awardedScore: clampInteger(item?.awardedScore ?? item?.awarded_score ?? 0, 0, Number(normalized.score ?? 0)),
        matchedText: normalizeText(item?.matchedText ?? item?.matched_text),
      };
    })
    .filter((item) => item.title)
    .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0));

const isPlaceholderMissedPointTitle = (value) => {
  const compact = normalizeText(value).replace(/\s+/g, "");
  if (!compact) {
    return true;
  }

  if (compact === "遗漏点") {
    return true;
  }

  return /^遗漏点(?:[0-9一二三四五六七八九十]+|[（(][0-9一二三四五六七八九十]+[）)])$/.test(compact);
};

const normalizeMissedPoints = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item, index) => {
      const title = sanitizeReviewExposureText(normalizeText(item?.title));
      const description = sanitizeReviewExposureText(normalizeText(item?.description));

      if (!title || !description || isPlaceholderMissedPointTitle(title)) {
        return null;
      }

      return {
        id: `${item?.id ?? `missed_${index + 1}`}`.trim(),
        title,
        description,
        score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
        sortOrder: Number(item?.sortOrder ?? index + 1),
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      score: item.score,
    }));

const normalizeAnswerMarks = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const rawStatus = `${item?.status ?? item?.type ?? ""}`.trim().toLowerCase();
      const normalizedStatus = ["correct", "wrong", "score", "neutral"].includes(rawStatus)
        ? rawStatus
        : ["positive", "hit", "award"].includes(rawStatus)
          ? "score"
          : ["neutral", "missed", "omit"].includes(rawStatus)
            ? "neutral"
          : ["incorrect", "error", "negative"].includes(rawStatus)
            ? "wrong"
            : "wrong";
      const rawScore = Number(item?.score ?? item?.awardedScore ?? item?.awarded_score);
      const rawStart = Number(item?.start);
      const rawEnd = Number(item?.end);
      return {
        id: `${item?.id ?? item?.markId ?? item?.mark_id ?? `mark_${index + 1}`}`.trim(),
        highlight: `${item?.highlight ?? item?.selectedText ?? item?.selected_text ?? item?.text ?? ""}`.trim(),
        comment: normalizeReturnedAiMarkComment(item?.comment ?? item?.reviewComment ?? item?.review_comment ?? item?.remark ?? ""),
        status: normalizedStatus,
        score: (normalizedStatus === "score" || normalizedStatus === "correct") && Number.isFinite(rawScore) ? rawScore : null,
        start: Number.isInteger(rawStart) && rawStart >= 0 ? rawStart : null,
        end: Number.isInteger(rawEnd) && rawEnd > rawStart ? rawEnd : null,
      };
    })
    .filter((item) => item.highlight);
};

const hasPositiveMarkWithScore = (marks) =>
  (Array.isArray(marks) ? marks : []).some(
    (mark) =>
      (mark?.status === "score" || mark?.status === "correct") &&
      Number.isFinite(Number(mark?.score)) &&
      Number(mark?.score ?? 0) > 0,
  );
const syncPositiveAnswerMarkScoresWithRubricPoints = ({ answerMarks, rubricPoints }) => {
  const normalizedMarks = Array.isArray(answerMarks) ? answerMarks : [];
  const positiveMarks = normalizedMarks.filter((mark) => mark?.status === "score" || mark?.status === "correct");

  if (positiveMarks.length === 0) {
    return normalizedMarks;
  }

  const awardedScores = (Array.isArray(rubricPoints) ? rubricPoints : [])
    .filter((point) => point?.hit && Number(point?.awardedScore ?? 0) > 0)
    .map((point) => Math.max(0, Number(point?.awardedScore ?? 0) || 0));
  const totalAwardedScore = awardedScores.reduce((sum, score) => sum + score, 0);
  const totalPositiveScore = positiveMarks.reduce((sum, mark) => sum + Math.max(0, Number(mark?.score ?? 0) || 0), 0);

  if (positiveMarks.length === 0 || totalPositiveScore === totalAwardedScore) {
    return normalizedMarks;
  }

  const nextPositiveScores = [...awardedScores];
  return normalizedMarks.map((mark) => {
    if (mark?.status !== "score" && mark?.status !== "correct") {
      return mark;
    }

    const nextScore = nextPositiveScores.length > 0 ? nextPositiveScores.shift() : 0;
    return {
      ...mark,
      status: "score",
      score: nextScore,
    };
  });
};

const escapeRegExp = (value) => `${value ?? ""}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findAnswerHighlight = (answerText, candidate) => {
  const normalizedAnswer = `${answerText ?? ""}`;
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedAnswer.trim() || !normalizedCandidate) {
    return "";
  }

  if (normalizedAnswer.includes(normalizedCandidate)) {
    return normalizedCandidate;
  }

  const compactCandidate = normalizedCandidate.replace(/\s+/g, "");
  if (!compactCandidate) {
    return "";
  }

  const directRegex = new RegExp(compactCandidate.split("").map((char) => escapeRegExp(char)).join("\\s*"));
  const directMatch = normalizedAnswer.match(directRegex);
  if (directMatch?.[0]) {
    return directMatch[0];
  }

  const sentenceCandidates = normalizedAnswer
    .split(SENTENCE_SPLIT_PATTERN)
    .map((item) => item.trim())
    .filter(Boolean);

  const bestSentence = sentenceCandidates.find((sentence) => {
    const compactSentence = sentence.replace(/\s+/g, "");
    return compactSentence && (compactSentence.includes(compactCandidate) || compactCandidate.includes(compactSentence));
  });
  if (bestSentence) {
    return bestSentence;
  }

  const keywordHit = compactCandidate.length >= 2
    ? Array.from(new Set(compactCandidate.match(/.{2,6}/g) ?? []))
        .sort((left, right) => right.length - left.length)
        .find((part) => part && normalizedAnswer.includes(part))
    : "";
  if (keywordHit) {
    return keywordHit;
  }

  return "";
};

const dedupeAnswerMarks = (marks) => {
  const seen = new Set();
  return marks.filter((mark) => {
    const key = [mark.highlight, mark.status, mark.score ?? "", mark.comment ?? "", mark.start ?? "", mark.end ?? ""].join("::");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const shouldRelaxWrongMarkRequirement = ({ marks, answerText, score, maxScore }) => {
  const safeScore = Number(score ?? 0);
  const safeMaxScore = Number(maxScore ?? 0);
  if (!(safeScore > 0) || !(safeMaxScore > safeScore)) {
    return false;
  }

  if (!isConclusionLikeSubjectiveAnswer(answerText)) {
    return false;
  }

  return marks.some((item) => item.status === "score" || item.status === "correct");
};

const reconcileConclusionLikeAnswerMarks = ({ marks, answerText, score, maxScore }) => {
  const dedupedMarks = dedupeAnswerMarks(marks);
  if (!shouldRelaxWrongMarkRequirement({ marks: dedupedMarks, answerText, score, maxScore })) {
    return dedupedMarks;
  }

  const positiveHighlights = new Set(
    dedupedMarks
      .filter((item) => item.status === "score" || item.status === "correct")
      .map((item) => normalizeSubjectiveAnswerForDetection(item.highlight))
      .filter(Boolean),
  );
  const answerKey = normalizeSubjectiveAnswerForDetection(answerText);

  return dedupeAnswerMarks(
    dedupedMarks.filter((item) => {
      if (item.status !== "wrong") {
        return true;
      }

      const highlightKey = normalizeSubjectiveAnswerForDetection(item.highlight);
      if (!highlightKey) {
        return true;
      }

      if (positiveHighlights.has(highlightKey)) {
        return false;
      }

      if (answerKey && highlightKey === answerKey) {
        return false;
      }

      return true;
    }),
  );
};

const normalizeAnswerMarksAgainstAnswer = (value, answerText) =>
  dedupeAnswerMarks(
    normalizeAnswerMarks(value)
      .map((item, index) => {
        const normalizedHighlight = findAnswerHighlight(answerText, item.highlight);
        if (!normalizedHighlight) {
          return null;
        }

        return {
          ...item,
          id: item.id || `mark_${index + 1}`,
          highlight: normalizedHighlight,
        };
      })
      .filter(Boolean),
  );

const isSubjectiveQuestion = (question) => `${question?.type ?? ""}`.trim() === subjectiveQuestionType;

const parseSubjectiveAnswerMap = (answerJson, question) => {
  const raw = parseJsonSafely(answerJson, {});
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const meta = parseJsonSafely(question?.questionMetaJson, {});
  const subQuestions = Array.isArray(meta?.subQuestions) ? meta.subQuestions : [];
  return Object.fromEntries(
    subQuestions.map((item, index) => {
      const id = `${item?.id ?? `${question.id}_sub_${index + 1}`}`.trim();
      return [id, normalizeText(source[id])];
    }),
  );
};

const isLowQualitySubjectiveAnswer = (value) => {
  const raw = normalizeText(value);
  if (!raw) {
    return true;
  }

  const compact = normalizeSubjectiveAnswerForDetection(raw);
  if (!compact) {
    return true;
  }

  if (SUBJECTIVE_REVIEW_CONCLUSION_WHITELIST.has(compact)) {
    return false;
  }

  if (SUBJECTIVE_REVIEW_LOW_QUALITY_PATTERNS.some((pattern) => pattern.test(compact))) {
    return true;
  }

  if (compact.length <= 2 && !/[\u4e00-\u9fa5a-z0-9]/i.test(compact)) {
    return true;
  }

  return false;
};

const getQuestionMeta = (question) => {
  const raw = parseJsonSafely(question?.questionMetaJson, {});
  const subQuestions = Array.isArray(raw?.subQuestions)
    ? raw.subQuestions
        .map((item, index) => ({
          id: `${item?.id ?? `${question.id}_sub_${index + 1}`}`.trim(),
          title: normalizeText(item?.title) || `Question(${index + 1})`,
          placeholder: normalizeText(item?.placeholder) || "Please enter your answer here.",
          abilityLabel: normalizeText(item?.abilityLabel),
          referenceAnswer: normalizeText(item?.referenceAnswer),
          rubricGuidance: normalizeText(item?.rubricGuidance),
          rubricPoints: normalizeRubricPoints(item?.rubricPoints),
          sortOrder: Number(item?.sortOrder ?? index + 1),
        }))
        .filter((item) => item.id && item.title)
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : [];

  if (subQuestions.length > 0) {
    return subQuestions;
  }

  return [
    {
      id: `${question.id}_default`,
      title: normalizeText(question?.stem) || "Question(1)",
      placeholder: "Please enter your answer here.",
      abilityLabel: "",
      referenceAnswer: "",
      rubricGuidance: "",
      rubricPoints: [],
      sortOrder: 1,
    },
  ];
};

const buildAllocations = (question) => {
  const subQuestions = getQuestionMeta(question);
  const totalScore = Math.max(0, Number(question?.score ?? 0));
  const count = subQuestions.length || 1;
  const baseScore = count > 0 ? Math.floor(totalScore / count) : totalScore;
  const remainder = count > 0 ? totalScore % count : 0;

  return subQuestions.map((subQuestion, index) => ({
    ...subQuestion,
    maxScore: Math.max(0, baseScore + (index < remainder ? 1 : 0)),
  }));
};

const buildSkippedSubjectiveSubQuestionReview = ({ allocation, answerText, reviewProvider }) => ({
  id: allocation.id,
  title: allocation.title,
  answer: answerText,
  score: 0,
  maxScore: Number(allocation.maxScore ?? 0),
  reviewComment: "",
  referenceAnswer: allocation.referenceAnswer || "",
  reviewSource: reviewProvider === "rules" ? "rule" : "ai",
  reviewProvider,
  abilityLabel: allocation.abilityLabel || allocation.title,
  missedPoints: [],
  answerMarks: [],
  rubricGuidance: allocation.rubricGuidance || "",
  rubricPoints: normalizeAiRubricPoints(allocation.rubricPoints),
  skippedReview: true,
  skippedReviewReason: "未作答或作答无效，已直接提供参考答案。",
});

const getMissedRubricPoints = (rubricPoints) => (Array.isArray(rubricPoints) ? rubricPoints.filter((point) => !point?.hit) : []);

const buildGenericWrongPointComment = () => "你这里还没答到关键点，回去修改时要把对应结论、依据和本案分析单独补出来。";

const buildWrongPointComment = (point) => {
  const title = normalizeText(point?.title);
  const description = normalizeText(point?.description);
  const keyword = normalizeKeywords(point?.keywords)?.[0] || "";

  if (title && description) {
    return normalizeAiMarkComment(`你这里漏掉了“${title}”。回去改答案时，把这一点单独起一句写清楚，直接说明${description}。`);
  }
  if (title) {
    return normalizeAiMarkComment(`你这里没有体现“${title}”。更稳的写法是单独起一句，把这层判断写明，再往题干事实上扣。`);
  }
  if (description) {
    return normalizeAiMarkComment(`你这里${description}。回去改的时候，别只停在结论，要把对应理由和题干事实一起补上。`);
  }
  if (keyword) {
    return normalizeAiMarkComment(`你这里没有交代“${keyword}”相关内容。回去补一句，把这个关键词对应的结论或依据明确写出来。`);
  }
  return normalizeAiMarkComment(buildGenericWrongPointComment());
};

const buildFallbackWrongMarkComment = ({ rubricPoints = [] }) => {
  const firstMissedPoint = getMissedRubricPoints(rubricPoints)[0];
  const title = normalizeText(firstMissedPoint?.title);
  const description = normalizeText(firstMissedPoint?.description);

  if (title && description) {
    return normalizeAiMarkComment(`这句没有把“${title}”答出来。回去改时把这层判断单独写明，再把${description}落回本案。`);
  }
  if (title) {
    return normalizeAiMarkComment(`这句没把“${title}”落准。回去改时把这一层判断写清楚，再把依据和本案分析补上。`);
  }
  if (description) {
    return normalizeAiMarkComment(`这句没有把关键判断落到位。回去改时直接把${description}写出来，再把理由扣回本案。`);
  }
  return normalizeAiMarkComment("这句判断没有落到本题采分点上，结论要写准，对应依据和本案分析也要补出来。");
};

const buildReviewCommentTemplate = ({
  coreLossPoint,
  keyPoints = [],
  missingPoints = [],
  thinkingIssue,
  consequence,
  stepOne,
  stepTwo,
  stepThree,
}) => {
  const seed = `${coreLossPoint}|${missingPoints.join("|")}|${thinkingIssue}|${consequence}|${keyPoints.join("|")}`;
  const focusText =
    missingPoints.length > 0 ? missingPoints.slice(0, 3).join("、") : (keyPoints.length > 0 ? keyPoints.slice(0, 3).join("、") : "结论、依据和本案分析");

  const diagnosis = pickReviewVariant(
    [
      `这题真正失分就在${coreLossPoint || "核心得分点没展开"}。你现在掉分，不是因为没写字，而是${focusText}这些点没有落稳。`,
      `这题问题不在于你完全没思路，而在于${coreLossPoint || "该展开的得分点没有展开"}。${focusText}一旦没写实，后面的分就拿不满。`,
      `这题目前最影响得分的，就是${coreLossPoint || "关键判断没写透"}。你卷面上看着有内容，但${focusText}没有真正落到得分点上。`,
    ],
    `${seed}|diagnosis`,
  );

  const issue = pickReviewVariant(
    [
      `${thinkingIssue || "你现在更像是在写一个笼统意思"}，所以容易${consequence || "把本来能拿到的展开分丢掉"}。`,
      `${thinkingIssue || "你现在下笔时没有顺着题目要的层次往下拆"}，这样写下去就会${consequence || "出现有结论、没论证的失分"}。`,
      `${thinkingIssue || "你现在的写法还停在大概意思上"}，所以最后往往会${consequence || "把关键判断和依据写虚了"}。`,
    ],
    `${seed}|issue`,
  );

  const action = pickReviewVariant(
    [
      `这题如果现在回去改，${buildNaturalSuggestionClause({ stepOne, stepTwo, stepThree, seed })}，这样答案就能真正落到分点上。`,
      `你现在最直接的补法就是：${buildNaturalSuggestionClause({ stepOne, stepTwo, stepThree, seed })}，别再只停在一个笼统结论上。`,
      `要把这题分数往上拉，改答案时就按这个思路补：${buildNaturalSuggestionClause({ stepOne, stepTwo, stepThree, seed })}。`,
    ],
    `${seed}|action`,
  );

  return humanizeAiReviewComment([`${diagnosis}${issue}`, action].join("\n\n"));
};

const hasHighScoreUpgradeHint = (value) => {
  const text = normalizeText(value);
  if (!text) {
    return false;
  }

  return /(更稳|更完整|更利落|更扎实|更像高分卷|还能再|还可以把|如果想把答案写得更稳|限定词|本案落点|收尾|压紧|扣紧|提一档)/.test(text);
};

const buildHighScoreUpgradeSuggestion = ({ title, rubricPoints = [], score, maxScore }) => {
  const hitLabels = (Array.isArray(rubricPoints) ? rubricPoints : [])
    .filter((point) => point?.hit)
    .map((point) => normalizeText(point?.title) || normalizeText(point?.description))
    .filter(Boolean)
    .slice(0, 2);
  const focusText =
    hitLabels.length > 0
      ? `把“${hitLabels.join("”“")}”这几层之间的衔接再扣紧`
      : "把结论、依据和本案落点之间的衔接再扣紧";
  const scoreSeed = `${title || ""}|${score || 0}|${maxScore || 0}|${hitLabels.join("|")}`;

  return pickReviewVariant(
    [
      `如果想把这一问写得更稳，${focusText}，收尾最好再补一句回到本案的总判断。`,
      `这题你已经答得比较顺了，再往高分卷靠一步的话，可以把关键判断写得更满一点，尤其是${focusText}。`,
      `要让这份答案更像高分卷，除了现在这些点之外，还可以把表述顺序再压一压：先结论，再依据，最后把本案落点收住。`,
    ],
    `${scoreSeed}|high_score_upgrade`,
  );
};

const enrichHighScoreReviewComment = ({ reviewComment, score, maxScore, title, rubricPoints }) => {
  const text = humanizeAiReviewComment(reviewComment);
  if (!text) {
    return "";
  }

  const safeScore = Number(score ?? 0);
  const safeMaxScore = Number(maxScore ?? 0);
  if (!(safeMaxScore > 0) || safeScore / safeMaxScore < 0.8) {
    return text;
  }

  if (hasHighScoreUpgradeHint(text)) {
    return text;
  }

  const suggestion = buildHighScoreUpgradeSuggestion({
    title,
    rubricPoints,
    score: safeScore,
    maxScore: safeMaxScore,
  });
  if (!suggestion) {
    return text;
  }

  if (AI_REVIEW_COMMENT_MAX_LENGTH - getUnicodeLength(text) < 20) {
    return text;
  }

  return normalizeAiReviewComment(`${text}\n\n${suggestion}`);
};

const finalizeAiReviewComment = ({ reviewComment, score, maxScore, title, rubricPoints }) => {
  const humanized = humanizeAiReviewComment(reviewComment);
  const enriched = enrichHighScoreReviewComment({
    reviewComment: humanized,
    score,
    maxScore,
    title,
    rubricPoints,
  });

  if (!isWeakReviewComment(enriched)) {
    return enriched;
  }

  return buildSubQuestionSummaryComment({
    score,
    maxScore,
    title,
    rubricPoints,
  });
};

const buildSubQuestionSummaryComment = ({ score, maxScore, title, rubricPoints }) => {
  const missedPoints = getMissedRubricPoints(rubricPoints);
  if (missedPoints.length === 0) {
    return buildDefaultComment({ score, maxScore, title });
  }

  const labels = missedPoints
    .map((point) => normalizeText(point?.title) || normalizeText(point?.description))
    .filter(Boolean);
  const summaryText = labels.slice(0, 3).join("、");
  const suffix = labels.length > 3 ? "等关键内容" : "等内容";
  const hitPoints = (Array.isArray(rubricPoints) ? rubricPoints : []).filter((point) => point?.hit);
  const hitLabels = hitPoints
    .map((point) => normalizeText(point?.title) || normalizeText(point?.description))
    .filter(Boolean);
  const keyPoints = Array.from(new Set([...hitLabels, ...labels])).filter(Boolean);
  const missingPointText = labels.length > 0 ? labels : ["关键采分点"];

  if (Number(score ?? 0) <= 0) {
    return buildReviewCommentTemplate({
      coreLossPoint: summaryText ? `完全没有覆盖${summaryText}${suffix}` : "结论、依据和论证都没有落到本题采分点上",
      keyPoints,
      missingPoints: missingPointText,
      thinkingIssue: "没有先对照题目采分点组织答案，写出来的内容和题目要求不对应",
      consequence: "整道题看着写了不少，但真正命中的得分点很少，分数就上不去",
      stepOne: "先把题目要求回答的主结论写准，不要一上来就先背概念",
      stepTwo: "把每个采分点在本案中的对应事实、法律关系和判断标准逐项写出来",
      stepThree: "按“结论 + 依据 + 本案分析”补完整，不要只停在抽象表述上",
    });
  }

  return buildReviewCommentTemplate({
    coreLossPoint: summaryText ? `还漏了${summaryText}${suffix}` : `围绕“${title || "本小问"}”的关键论证没有展开完整`,
    keyPoints,
    missingPoints: missingPointText,
    thinkingIssue: "方向可能没偏，但还没有把采分点拆开逐层作答",
    consequence: "结论分能拿到一些，可理由分和展开分会持续丢掉",
    stepOne: "先看清本题到底要求你展开哪几个层次，不要只写一个笼统结论",
    stepTwo: "把漏掉的采分点逐项补出来，每一项都和本案事实对应起来",
    stepThree: "最后检查关键法律关系、判断标准和结论链条有没有真正写完整",
  });
};

const buildMissedPoints = (rubricPoints, reviewComment = "") =>
  (Array.isArray(rubricPoints) ? rubricPoints : [])
    .filter((point) => !point?.hit)
    .map((point, index) => ({
      id: `${point?.id ?? `missed_${index + 1}`}`.trim(),
      title: normalizeText(point?.title) || `遗漏点 ${index + 1}`,
      description: normalizeText(point?.description) || reviewComment || "",
      score: Number(point?.score ?? 0) || 0,
    }))
    .filter((point) => point.title || point.description);

const isGenericWrongMarkComment = (comment, reviewComment) => {
  const normalizedComment = normalizeText(comment);
  const normalizedReviewComment = normalizeText(reviewComment);

  if (!normalizedComment) {
    return true;
  }

  if (normalizedReviewComment && normalizedComment === normalizedReviewComment) {
    return true;
  }

  return ["失分点未覆盖", "需要结合评分点继续完善", "未覆盖得分点", "论证仍需补强"].some((keyword) =>
    normalizedComment.includes(keyword),
  );
};

const normalizeWrongMarkComments = ({ marks, rubricPoints, reviewComment }) => {
  return marks.map((mark) => {
    if (mark.status !== "wrong") {
      return mark;
    }

    return {
      ...mark,
      comment: isGenericWrongMarkComment(mark.comment, reviewComment)
        ? buildFallbackWrongMarkComment({ rubricPoints })
        : normalizeText(mark.comment),
    };
  });
};

const buildDefaultComment = ({ score, maxScore, title }) => {
  if (maxScore > 0 && score >= maxScore) {
    return buildReviewCommentTemplate({
      coreLossPoint: "没有明显失分点，主要是表述细节还可以继续打磨",
      keyPoints: [title || "本问采分点", "结论", "依据", "本案分析"],
      missingPoints: ["明显遗漏不多，更多是表达精度和完整度还可以再抬一档"],
      thinkingIssue: "容易在已经答对时放松对表达完整性的要求",
      consequence: "碰到更严格的阅卷标准时，可能会因为细节不够扎实被扣掉边缘分",
      stepOne: "继续保持先结论、再依据、再落回本案的写法",
      stepTwo: "把容易省掉的限定语、比较点和结论依据写得更明确一些",
      stepThree: "答完后回看一遍，专门检查还有没有能再压实的表述细节",
    });
  }
  if (score <= 0) {
    return buildReviewCommentTemplate({
      coreLossPoint: "结论、依据和本案分析都没有真正对应到本题要求",
      keyPoints: [title || "本问采分点", "结论", "依据", "本案分析"],
      missingPoints: ["核心得分点", "对应依据", "针对本案的展开"],
      thinkingIssue: "下笔前没有先拆题，导致写出来的内容和题目要求错位",
      consequence: "篇幅不一定短，但有效得分很少，容易整问失分",
      stepOne: "先把本题要回答的核心结论单独写出来",
      stepTwo: "围绕题干和采分点逐项补依据，不要泛泛而谈",
      stepThree: "把每一层依据都落回本案事实，形成完整得分链条",
    });
  }
  return buildReviewCommentTemplate({
    coreLossPoint: `围绕“${title || "本问"}”的关键论证还不够完整`,
    keyPoints: [title || "本问采分点", "结论", "依据", "本案分析"],
    missingPoints: ["部分关键得分点", "论证展开", "本案对应分析"],
    thinkingIssue: "会写结论，但不会把理由拆成可得分的层次",
    consequence: "基础分能拿到一些，但展开分和完整性分长期拿不满",
    stepOne: "先确认本题至少要展开几个采分点，再决定答案结构",
    stepTwo: "每个采分点至少写出一句依据和一句本案分析",
    stepThree: "最后补一层收束，把零散观点整理成完整结论",
  });
};

const scoreByRubric = (answerText, rubricPoints, maxScore) => {
  if (!answerText.trim()) {
    return {
      score: 0,
      pointResults: rubricPoints.map((point) => ({
        ...point,
        hit: false,
        awardedScore: 0,
        matchedText: "",
      })),
    };
  }

  let score = 0;
  const pointResults = rubricPoints.map((point) => {
    const hitKeyword = point.keywords.find((keyword) => keyword && answerText.includes(keyword)) || "";
    const hit = Boolean(hitKeyword) || (!point.keywords.length && point.title && answerText.includes(point.title));
    const awardedScore = hit ? Math.min(point.score, maxScore) : 0;
    score += awardedScore;
    return {
      ...point,
      hit,
      awardedScore,
      matchedText: hitKeyword,
    };
  });

  return {
    score: Math.min(maxScore, score),
    pointResults,
  };
};

const buildAnswerMarks = (pointResults, answerText, reviewComment = "") => {
  const marks = pointResults
    .filter((point) => point.hit && point.matchedText)
    .map((point, index) => ({
      id: `ai_mark_${index + 1}`,
      highlight: point.matchedText,
      comment: point.title,
      status: "score",
      score: point.awardedScore,
    }));

  return dedupeAnswerMarks(marks);
};

const finalizeReviewComments = ({ answerMarks, rubricPoints, reviewComment, score, maxScore, title }) => {
  const finalReviewComment = buildSubQuestionSummaryComment({
    score,
    maxScore,
    title,
    rubricPoints,
  });

  return {
    answerMarks: normalizeWrongMarkComments({
      marks: dedupeAnswerMarks(answerMarks),
      rubricPoints,
      reviewComment: reviewComment || finalReviewComment,
    }),
    reviewComment: finalReviewComment,
    missedPoints: buildMissedPoints(rubricPoints, finalReviewComment),
  };
};

const buildRuleBasedReviewJson = ({ question, answer, currentReviewJson }) => {
  const allocations = buildAllocations(question);
  const answerMap = parseSubjectiveAnswerMap(answer?.answerJson, question);

  const subQuestions = allocations.map((subQuestion) => {
    const answerText = answerMap[subQuestion.id] ?? "";
    if (isLowQualitySubjectiveAnswer(answerText)) {
      return buildSkippedSubjectiveSubQuestionReview({
        allocation: subQuestion,
        answerText,
        reviewProvider: "rules",
      });
    }

    const rubricPoints = normalizeRubricPoints(subQuestion.rubricPoints);
    const scored = rubricPoints.length > 0
      ? scoreByRubric(answerText, rubricPoints, Number(subQuestion.maxScore ?? 0))
      : {
          score: answerText ? Math.max(0, Math.min(Number(subQuestion.maxScore ?? 0), Math.round((answerText.length / 120) * Number(subQuestion.maxScore ?? 0)))) : 0,
          pointResults: [],
        };

    const baseReviewComment = buildDefaultComment({ score: scored.score, maxScore: Number(subQuestion.maxScore ?? 0), title: subQuestion.title });
    const finalizedReview = finalizeReviewComments({
      answerMarks: buildAnswerMarks(scored.pointResults, answerText, baseReviewComment),
      rubricPoints: scored.pointResults,
      reviewComment: baseReviewComment,
      score: scored.score,
      maxScore: Number(subQuestion.maxScore ?? 0),
      title: subQuestion.title,
    });

    return {
      id: subQuestion.id,
      title: subQuestion.title,
      answer: answerText,
      score: scored.score,
      maxScore: Number(subQuestion.maxScore ?? 0),
      reviewComment: finalizedReview.reviewComment,
      referenceAnswer: subQuestion.referenceAnswer || scored.pointResults.map((point) => point.title).join("；"),
      reviewSource: "rule",
      reviewProvider: "rules",
      abilityLabel: subQuestion.abilityLabel || subQuestion.title,
      missedPoints: buildMissedPoints(scored.pointResults, finalizedReview.reviewComment),
      answerMarks: finalizedReview.answerMarks,
      rubricGuidance: subQuestion.rubricGuidance || "",
      rubricPoints: scored.pointResults.map((point) => ({
        id: point.id,
        title: point.title,
        score: point.score,
        description: point.description,
        keywords: point.keywords,
        hit: point.hit,
        awardedScore: point.awardedScore,
        matchedText: point.matchedText,
      })),
    };
  });

  const totalScore = subQuestions.reduce((sum, item) => sum + Number(item.score ?? 0), 0);

  return {
    source: "rule",
    reviewSource: "rule",
    reviewProvider: "rules",
    totalScore,
    maxScore: Number(question?.score ?? 0),
    reviewVoiceUrl: `${currentReviewJson?.reviewVoiceUrl ?? ""}`.trim(),
    reviewVoiceObjectKey: `${currentReviewJson?.reviewVoiceObjectKey ?? ""}`.trim(),
    reviewVoiceDurationSeconds: Number(currentReviewJson?.reviewVoiceDurationSeconds ?? 0) || 0,
    feedbackStars: Number(currentReviewJson?.feedbackStars ?? 0) || 0,
    feedbackSubmittedAt: currentReviewJson?.feedbackSubmittedAt ?? null,
    subQuestions,
  };
};

const buildAiPromptV2 = ({ question, answer, allocations, runtimeConfig }) => {
  const answerMap = parseSubjectiveAnswerMap(answer?.answerJson, question);

  const gradingPrinciples = [
    "1. 必须严格依据本题提供的参考答案、批改说明、采分点和分值批改，不得自行扩展评分标准。",
    "2. 只按当前这一道主观大题批改，并一次性覆盖该大题下全部小问。",
    "3. 每个小问都要单独给出分数、总点评、采分点命中情况以及对答案局部的标注。",
    "4. 评语语气必须像老师在直接对学生说话，可以使用“你这里”“你已经答到”“建议你补上”这类表达。",
    "5. reviewComment 必须是对该小问整体作答的总结性点评，要说明整体缺了什么、错了什么、论证哪里不足，并明确告诉学生接下来应该怎么补。",
    "5.1 你不能只指出问题，还必须告诉学生如果现在回去修改这道题，具体应该往答案里补什么内容、补到哪一层、怎么写会更稳。",
    "5.2 写总点评前，先判断这份答案更接近哪一种作答状态，再决定点评重点，但不要把这种分类名直接写给学生看。",
    "5.3 常见状态可以灵活参考：整体判断错误、只写了结论几乎没展开、结论方向大体对但理由薄弱或漏层次、整体较完整接近满分。",
    "5.4 如果属于整体判断错误，点评重点要放在“为什么会判断错”：是考点识别错了、规则适用错了，还是把自己原有知识套偏了。",
    "5.5 如果属于只写结论或只有一句话，点评重点要放在“结论后面该补什么理由、规则和本案落点”，不要只说理由不足。",
    "5.6 如果属于结论方向基本对但论证薄弱，点评重点要放在“还差哪几个层次、哪几个采分点没有展开、怎样补成稳妥答案”。",
    "5.7 如果属于整体较完整或接近满分，不要为了凑模板硬找问题；可以重点点出学生已经答对的关键思路、命中的考点，以及继续保持的答题节奏。",
    "5.7.1 但也不要只停在表扬上。即使是高分或接近满分，也最好顺手告诉学生：如果想把答案写得更稳、更像高分卷，还可以把哪一句写得更完整、把哪一层依据扣得更紧、或者把哪一个表达顺序调整得更利落。",
    "5.8 上面这些只是帮助你调整点评重心，不是固定模板。最终评语仍然要贴着这道题和这份答案本身去写，不能生搬硬套。",
    "5.9 对局部标注也要区分“结论对”和“理由弱”这两件事：如果学生短短一句话已经把本问核心结论答对了，就不要把这句正确结论本身标成 wrong；这时更适合保留正向标注，并另外指出理由、依据或本案分析没有展开。",
    "5.10 只有在结论本身判断错误、方向错误或结论与本题批改依据相反时，才应直接把该结论句标成 wrong。",
    "6. reviewComment 不要复述学生原答案，也不要一味重复学生写了什么。",
    "7. reviewComment 必须控制在 450 字以内，尽量写到 260 到 450 字这一档，确有必要时可以略短，但不能只写七八十个字的空泛点评；尽量写成 2 到 4 个自然短段落。",
    "8. reviewComment 不要按固定模板一段一段去套，也不要每次都用完全一样的句式，要像老师顺着学生这道题的实际问题往下讲，而且必须点到这道题具体漏了哪一层、错在哪一层。",
    "9. 建议部分要直接告诉学生下一次该怎么改、怎么补，最好明确写到应该往答案里补什么内容、补哪个层次、如何落回本案，但不要机械写成“第一步、第二步、第三步”这种流程模板。",
    "10. 不要先写“虽然你得出了正确结论”“方向是对的”“能/不能这两个字拿到了分”这类话，直接指出遗漏点、问题和改法。",
    "10.1 不要只写“理由不足”“展开不够”“分析不全面”这种空话，必须继续写清楚到底缺的是哪个采分点、哪层理由、哪段本案分析。",
    "11. answerMarks 中 status=wrong 的 comment 必须针对该段局部内容指出具体错误、遗漏或表达不足，不能把整道小问的总评写在这里，同时要写出修改建议。",
    "11.1 局部评语不要写成“建议后面的修改为……”“建议改成……”这类固定模板，直接指出这一处哪里错了、漏了什么、该往哪一层补。",
    "12. 只要某小问得了分，answerMarks 中就必须出现正向标注，不能只给 wrong。",
    "12.1 所有正向标注都必须使用 status=score，不允许使用不带分值的 correct 或其他正向占位状态。",
    "12.2 只要某条 answerMark 是正向得分标注，它就必须填写整数 score，且该分值必须对应这条局部命中的实际得分，不能省略。",
    "13. 如果命中了多个采分点，必须分别标出多个正向命中位置，让前端可以显示多个对号/加分点；不能只给一条笼统正向标注后把其余得分点省略。",
    "13.0 但不能把一句非常笼统、没有展开层次的短句，同时判成多个彼此独立的理由采分点。尤其是“只写一句结论”或“只写一句概括性判断”时，通常只能覆盖结论点，不能顺带拿到多个理由点。",
    "13.1 answerMarks 的 highlight 必须尽量短、尽量准，优先截取能直接承载该采分点或错误点的最小必要原文片段，一般以词组、短句为主，不要动不动整句整段都划进去。",
    "13.2 一个 answerMark 只表达一个局部判断：要么对应一个命中的采分点，要么对应一个具体错误/遗漏，不要把两个以上的得分点或错误点合并到同一条划线里。",
    "13.3 如果学生一句话里同时写了多个层次，只有其中一部分命中采分点时，只截取命中的那一小段原文，不要把前后无关内容一起划进去。",
    "13.4 如果学生某一处表述错误，wrong 标注要尽量落在出错的那个词、短语或就近短句上，不要为了方便直接划整句或整段。",
    "13.5 不要把 answerMarks.highlight 写成概括后的意思、标准答案里的说法，必须是学生原答案里肉眼能直接找到的连续原文。",
    "13.6 能用 matchedText 精准对应的，就优先围绕 matchedText 附近取 highlight；不要把 matchedText 扩成很长一段话。",
    "13.7 如果两个 rubricPoint 实际引用的是同一句、同一短语、同一小段原文，而这段原文本身并没有分别展开两个独立理由，则只能保留其中最核心、最直接的那个得分点，不能重复给分。",
    "13.8 同一小问里，所有 status=score 的 answerMarks.score 之和必须严格等于该小问最终 score；不能出现小问有分，但局部正向标注不带分或分值合计对不上的情况。",
    "14. referenceAnswer、rubricGuidance、rubricPoints 返回时应尽量与本题批改依据保持一致，便于人工复核。",
    "15. missedPoints 必须由你根据本小问实际失分情况直接输出，不允许让前端自己根据 rubricPoints 再去推算。",
    "16. missedPoints 只表示学生没有答到的点；如果学生写了但写错、答偏、论证错误，这属于错误点，不属于遗漏点。",
    "17. missedPoints 的 title 不能写成“遗漏点 1”“遗漏点 2”这种占位名字，必须写成具体遗漏点名称；description 也不能空，必须用一句话说明本案里到底漏了什么。",
    "18. 如果某个 missedPoint 对应题目中的某个采分点，请尽量直接使用该采分点的标题或同义的准确表述，不要只写编号。",
    "19. 你返回的 subQuestions.id 必须严格使用题目数据里给出的原始小问 ID，例如 sub_1、sub_2、sub_3，不能改写，不能省略，不能自造其他 ID。",
  ].join("\n");

  const outputRequirements = [
    "只允许返回 JSON，顶层必须包含 subQuestions 数组。",
    "subQuestions 必须一次性覆盖当前大题下全部小问，每个小问只能返回 1 次。",
    "每个小问的 score 必须是整数，且范围只能在 0 到该小问 maxScore 之间。",
    "rubricPoints 中每个 awardedScore 必须是整数，且不能超过该采分点分值。",
    "每个小问都必须返回 missedPoints 数组；这个数组必须由你直接判断并输出，不允许留给前端根据 rubricPoints 自行推算。",
    "如果本小问存在遗漏采分点、缺失论证或本该写但完全没写到的结论，missedPoints 必须列出这些遗漏点；如果没有遗漏，则返回空数组。",
    "如果学生已经写了相关内容，只是写错、答偏、论证错误或表述错误，不要把它放进 missedPoints，而要作为错误点写进 wrong 标注和总点评。",
    "命中采分点时，hit 必须为 true，并尽量填写 matchedText。",
    "answerMarks 中的 highlight 必须直接截取自考生原答案，不能改写、不能概括、不能杜撰。",
    "answerMarks 中的 highlight 必须尽量短、尽量准，优先截取能直接承载该采分点或错误点的最小必要原文片段，不要大段划线。",
    "一个 answerMark 只能对应一个局部判断，不要把多个得分点、多个错误点或一整段意思合并到同一条划线里。",
    "如果一句话里只有局部内容命中采分点或局部内容出错，只截取那一小段连续原文，不要把整句都划进去。",
    "wrong 标注应尽量落在出错词语、出错短句或最靠近错误的那一段原文上，不要用很长的 highlight 去笼统表示“这段有问题”。",
    "能用 matchedText 精准定位的，highlight 就围绕 matchedText 取最小必要原文，不要额外扩写前后无关文字。",
    "如果学生只是写了一句很短的概括性结论、身份事实或抽象判断，而没有分别展开多个理由层次，这一句通常只能支持 1 个最直接的得分点，不能同时命中多个彼此独立的理由点。",
    "正向命中采分点时必须使用 status=score，并填写对应得分。",
    "每一条正向 answerMark 都必须单独带有整数 score，不允许省略 score，不允许返回只有对勾但没有分值的正向标注。",
    "如果只是漏写了某个采分点、理由层次或本案分析，没有在答案里出现对应错误表述，则不要为了提示遗漏而强行生成 wrong 标注；这类内容只写进 missedPoints 和 reviewComment。",
    "只有当学生原答案里出现了明确的错误结论、错误判断、错误表述或答偏内容时，才生成 status=wrong 的 answerMarks，并在 comment 里指出错在哪里。",
    "如果某小问 score > 0，则该小问 answerMarks 中必须包含与实际命中采分点相对应的 status=score 标注；如果命中了几个独立得分点，就必须返回几条带分值的正向标注，不能只返回 1 条笼统正向标注。",
    "如果命中了多个采分点，answerMarks 中必须分别标出多个正向命中位置，并且每一条都要单独带分。",
    "同一小问里，所有 status=score 的 answerMarks.score 相加后，必须严格等于该小问 score。",
    "如果学生只写了一个很短的结论句，但这个结论本身与本题采分点一致，可以给该结论句正向标注；缺少的理由、依据或本案分析只放进 missedPoints 和 reviewComment，不要把正确结论本身打成 wrong。",
    "如果学生写出的结论句本身就是错的，或者方向和本题标准答案相反，则应直接对该结论句给 wrong 标注。",
    "reviewComment 不要复述学生原答案。",
    "reviewComment 要根据学生这道题的实际作答状态调整语气和重点：全错时重在指出错因，只写结论时重在告诉他该补什么，方向对但理由弱时重在指出缺失层次，接近满分时既要点出答得好的地方，也要告诉他怎样写会更稳、更完整。",
    "不要把总点评写成固定四段或固定句型，也不要把同一套开头结尾机械套给所有学生。",
    "reviewComment 必须控制在 450 字以内，尽量写到 260 到 450 字这一档，确有必要时可以略短，但不能写成只有七八十个字的空泛点评；尽量分成 2 到 4 个自然短段落。",
    "reviewComment 不要按固定模板去套，不要每次都重复同一组句式，也不要先肯定一句再转折。",
    "reviewComment 必须给出可执行的修改办法，让学生看完就知道这道题现在该往答案里补什么、补到哪一步，而不是只知道自己错了。",
    "reviewComment 的建议部分要自然地告诉学生下一次该怎么改，但不要写成“第一步、第二步、第三步”这种说明书式结构。",
    "status=wrong 的 answerMarks.comment 要写成老师对该片段的局部提醒，必须同时包含：这里哪里不对或漏了什么、建议怎么改。",
    "局部评语不要写“建议后面的修改为……”这类模板句，直接告诉学生这一句哪里有问题、该补什么、该怎么改。",
    "subQuestions 中每个对象都必须包含 id，且 id 必须与题目数据中的 subQuestionId 完全一致。",
    "除了 JSON 以外，不允许输出任何解释、前缀、Markdown 或代码块。",
  ].join("\n");

  const questionData = JSON.stringify(
    {
      questionId: question.id,
      stem: normalizeText(question.stem),
      material: normalizeText(question.material),
      totalScore: Math.max(0, Number(question.score ?? 0)),
      subQuestions: allocations.map((item) => ({
        subQuestionId: item.id,
        title: item.title,
        maxScore: Math.max(0, Number(item.maxScore ?? 0)),
        studentAnswer: answerMap[item.id] ?? "",
        abilityLabel: item.abilityLabel || "",
        referenceAnswer: item.referenceAnswer || "",
        rubricGuidance: item.rubricGuidance || "",
        rubricPoints: (item.rubricPoints ?? []).map((point) => ({
          pointId: point.id,
          title: point.title,
          score: point.score,
          description: point.description,
          keywords: point.keywords,
        })),
      })),
    },
    null,
    2,
  );

  const template = normalizeAiReviewUserPromptTemplate(runtimeConfig?.userPromptTemplate);
  const missingPlaceholders = getAiReviewPromptTemplateMissingPlaceholders(template);
  if (missingPlaceholders.length > 0) {
    throw createHttpError(`批改提示词模板缺少必要占位符：${missingPlaceholders.join("、")}`, 400);
  }

  const prompt = template
    .split(AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS.gradingPrinciples)
    .join(gradingPrinciples)
    .split(AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS.outputRequirements)
    .join(outputRequirements)
    .split(AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS.questionData)
    .join(questionData);

  const hasUnreplacedPlaceholder = Object.values(AI_REVIEW_PROMPT_TEMPLATE_PLACEHOLDERS).some((placeholder) => prompt.includes(placeholder));
  if (hasUnreplacedPlaceholder) {
    throw createHttpError("批改提示词模板占位符替换失败，请检查模板配置", 500);
  }

  return prompt;
};

const requestOpenAiCompatibleReviewOnce = async ({ runtimeConfig, question, answer, allocations }) => {
  const endpoint = `${runtimeConfig.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const rawTimeoutMs = Number(runtimeConfig.timeoutMs ?? 120000);
  const timeoutMs = Number.isFinite(rawTimeoutMs) ? Math.max(0, rawTimeoutMs) : 120000;
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runtimeConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: runtimeConfig.model,
        temperature: 0.2,
        response_format: {
          type: "json_object",
        },
        messages: [
          {
            role: "system",
            content: normalizeAiReviewSystemPrompt(runtimeConfig?.systemPrompt),
          },
          {
            role: "user",
            content: buildAiPromptV2({ question, answer, allocations, runtimeConfig }),
          },
        ],
      }),
      signal: controller.signal,
    });

    const contentType = `${response.headers?.get?.("content-type") ?? ""}`.toLowerCase();
    let rawText = "";
    let parsedPayload = null;
    if (typeof response.text === "function") {
      rawText = await response.text();
      parsedPayload = parseJsonSafely(rawText, null);
    } else if (typeof response.json === "function") {
      parsedPayload = await response.json().catch(() => null);
      rawText = parsedPayload ? JSON.stringify(parsedPayload) : "";
    }
    const remoteErrorMessage = extractRemoteErrorMessage(parsedPayload);
    const htmlPreview = stripHtmlTags(rawText).slice(0, 160);

    if (!response.ok) {
      if (remoteErrorMessage) {
        throw createHttpError(`批改请求失败：${response.status}，${remoteErrorMessage}`, 502);
      }
      if (looksLikeHtmlDocument(rawText) || contentType.includes("text/html")) {
        throw createHttpError(
          `批改请求失败：${response.status}，远程接口返回了 HTML 页面，请检查 AI 厂商的 Base URL 是否填写成了站点页面而不是 API 地址。${htmlPreview ? `返回内容：${htmlPreview}` : ""}`,
          502,
        );
      }
      throw createHttpError(`批改请求失败：${response.status}`, 502);
    }

    if (looksLikeHtmlDocument(rawText) || contentType.includes("text/html")) {
      throw createHttpError(
        `远程批改返回了 HTML 页面，请检查 AI 厂商的 Base URL 是否填写成了站点页面而不是 API 地址。${htmlPreview ? `返回内容：${htmlPreview}` : ""}`,
        502,
      );
    }

    const payload = parsedPayload;
    if (!payload || typeof payload !== "object") {
      throw createHttpError(
        `远程批改返回的不是合法 JSON，请检查当前厂商接口是否兼容 OpenAI Chat Completions。${rawText ? `返回片段：${rawText.slice(0, 160)}` : ""}`,
        502,
      );
    }

    const content = extractCompletionText(payload);
    const parsed = normalizeAiReviewResponsePayload(extractJsonPayload(content));
    const debugPreview = buildAiResponseDebugPreview({ payload, content, parsed });
    if (!parsed || !Array.isArray(parsed.subQuestions)) {
      throw createHttpError(withAiDebugMessage("批改返回结果不是有效 JSON", debugPreview), 502);
    }
    return parsed;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createHttpError(`远程批改超时，当前超时设置为 ${timeoutMs}ms，请调大超时时间后重试`, 504);
    }
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const requestOpenAiCompatibleReview = async ({ runtimeConfig, question, answer, allocations }) => {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await requestOpenAiCompatibleReviewOnce({ runtimeConfig, question, answer, allocations });
    } catch (error) {
      lastError = error;
      const message = `${error instanceof Error ? error.message : String(error)}`.toLowerCase();
      const retriable =
        message.includes("json") ||
        message.includes("unexpected end") ||
        message.includes("fetch failed") ||
        message.includes("terminated");

      if (!retriable || attempt >= 1) {
        throw error;
      }
    }
  }

  throw lastError || createHttpError("远程批改调用失败", 502);
};

const getReturnedSubQuestionIdentifier = (item) => getReturnedSubQuestionIdentifiers(item)[0] || "";

const assertValidAiSubQuestionResult = ({ item, allocation, fallbackTitle, fallbackAnswerText }) => {
  if (!item || typeof item !== "object") {
    throw createHttpError(`批改返回缺少小问结果：${fallbackTitle || allocation?.id || "unknown"}`, 502);
  }

  const rawScore = Number(item?.score);
  const maxScore = Number(allocation?.maxScore ?? 0);
  if (!Number.isInteger(rawScore) || rawScore < 0 || rawScore > maxScore) {
    throw createHttpError(`批改返回的小问分数不合法：${fallbackTitle || allocation?.id || "unknown"}`, 502);
  }

  const reviewComment = normalizeReturnedAiReviewComment(item?.reviewComment);
  if (!reviewComment) {
    throw createHttpError(`批改返回缺少小问总点评：${fallbackTitle || allocation?.id || "unknown"}`, 502);
  }

  if (!Array.isArray(item?.rubricPoints) || item.rubricPoints.length === 0) {
    throw createHttpError(`批改返回缺少采分点结果：${fallbackTitle || allocation?.id || "unknown"}`, 502);
  }
  if (!Array.isArray(item?.missedPoints)) {
    throw createHttpError(`批改返回缺少遗漏点结果：${fallbackTitle || allocation?.id || "unknown"}`, 502);
  }
  const rawMissedPoints = item?.missedPoints;
  const normalizedMissedPoints = normalizeMissedPoints(rawMissedPoints);
  if (rawMissedPoints.length > 0 && normalizedMissedPoints.length === 0) {
    throw createHttpError(`批改返回的遗漏点不具体或为占位内容：${fallbackTitle || allocation?.id || "unknown"}`, 502);
  }
  if (rawScore >= maxScore && normalizedMissedPoints.length > 0) {
    throw createHttpError(`批改返回的遗漏点与满分结果不一致：${fallbackTitle || allocation?.id || "unknown"}`, 502);
  }
  if (!Array.isArray(item?.answerMarks)) {
    throw createHttpError(`批改返回缺少局部标注：${fallbackTitle || allocation?.id || "unknown"}`, 502);
  }
  const rawAnswerMarks = normalizeAnswerMarks(item?.answerMarks);
  const hasPositiveMark = hasPositiveMarkWithScore(rawAnswerMarks);

  if (rawScore > 0 && !hasPositiveMark) {
    throw createHttpError(`批改返回缺少正向标注：${fallbackTitle || allocation?.id || "unknown"}`, 502);
  }
};

const normalizeAiSubQuestionResult = ({ item, allocation, fallbackAnswerText, fallbackTitle }) => {
  assertValidAiSubQuestionResult({ item, allocation, fallbackTitle, fallbackAnswerText });
  const normalizedRubricPoints = tightenAiRubricPointHits({
    rubricPoints: normalizeAiRubricPoints(item?.rubricPoints),
    answerText: fallbackAnswerText,
  });
  const normalizedScore = clampInteger(sumRubricAwardedScores(normalizedRubricPoints), 0, Number(allocation.maxScore ?? 0));
  const normalizedMissedPoints = normalizeMissedPoints(item?.missedPoints);
  const normalizedReviewComment = normalizeReturnedAiReviewComment(item?.reviewComment);
  const rawAnswerMarks = normalizeAnswerMarks(item?.answerMarks);
  const normalizedAnswerMarksAgainstAnswer = normalizeAnswerMarksAgainstAnswer(item?.answerMarks, fallbackAnswerText);
  if (normalizedAnswerMarksAgainstAnswer.length !== rawAnswerMarks.length) {
    throw createHttpError(`批改返回的局部标注无法完整对应到考生原文：${fallbackTitle || allocation?.id || "unknown"}`, 502);
  }
  const normalizedAnswerMarks = syncPositiveAnswerMarkScoresWithRubricPoints({
    answerMarks: normalizedAnswerMarksAgainstAnswer,
    rubricPoints: normalizedRubricPoints,
  });

  return {
    id: allocation.id,
    title: allocation.title,
    answer: fallbackAnswerText,
    score: normalizedScore,
    maxScore: Number(allocation.maxScore ?? 0),
    reviewComment: normalizedReviewComment,
    referenceAnswer:
      sanitizeReviewExposureText(normalizeText(item?.referenceAnswer)) ||
      sanitizeReviewExposureText(allocation.referenceAnswer) ||
      normalizedRubricPoints.map((point) => point.title).join("；"),
    reviewSource: "ai",
    reviewProvider: "openai-compatible",
    abilityLabel: sanitizeReviewExposureText(normalizeText(item?.abilityLabel)) || sanitizeReviewExposureText(allocation.abilityLabel) || fallbackTitle,
    missedPoints: normalizedMissedPoints,
    answerMarks: normalizedAnswerMarks,
    rubricGuidance: sanitizeReviewExposureText(normalizeText(item?.rubricGuidance)) || sanitizeReviewExposureText(allocation.rubricGuidance) || "",
    rubricPoints: normalizedRubricPoints,
    skippedReview: false,
    skippedReviewReason: "",
  };
};

const buildOpenAiCompatibleReviewJson = async ({ runtimeConfig, question, answer, currentReviewJson }) => {
  const allocations = buildAllocations(question);
  const answerMap = parseSubjectiveAnswerMap(answer?.answerJson, question);
  const aiAllocations = allocations.filter((allocation) => !isLowQualitySubjectiveAnswer(answerMap[allocation.id] ?? ""));
  const skippedSubQuestionMap = new Map(
    allocations
      .filter((allocation) => isLowQualitySubjectiveAnswer(answerMap[allocation.id] ?? ""))
      .map((allocation) => [
        allocation.id,
        buildSkippedSubjectiveSubQuestionReview({
          allocation,
          answerText: answerMap[allocation.id] ?? "",
          reviewProvider: "openai-compatible",
        }),
      ]),
  );
  const parsed =
    aiAllocations.length > 0
      ? await requestOpenAiCompatibleReview({
          runtimeConfig,
          question,
          answer: {
            ...answer,
            answerJson: JSON.stringify(
              Object.fromEntries(aiAllocations.map((allocation) => [allocation.id, answerMap[allocation.id] ?? ""])),
            ),
          },
          allocations: aiAllocations,
        })
      : { subQuestions: [] };
  const returnedSubQuestionIds = Array.isArray(parsed?.subQuestions)
    ? parsed.subQuestions.flatMap((item) => getReturnedSubQuestionIdentifiers(item)).filter(Boolean)
    : [];
  const debugPreview = truncateText(
    JSON.stringify(
      {
        returnedSubQuestionIds,
        parsedSubQuestions: parsed?.subQuestions,
      },
      null,
      2,
    ),
    1600,
  );

  const subQuestions = allocations.map((allocation, index) => {
    const skipped = skippedSubQuestionMap.get(allocation.id);
    if (skipped) {
      return skipped;
    }

    const allocationIdentifiers = new Set(getAllocationSubQuestionIdentifiers(allocation, index));
    const rawItem = parsed.subQuestions.find((item) =>
      getReturnedSubQuestionIdentifiers(item).some((identifier) => allocationIdentifiers.has(identifier)),
    );
    if (!rawItem) {
      throw createHttpError(
        withAiDebugMessage(`批改返回缺少小问结果：${allocation.title || `Question(${index + 1})`}`, debugPreview),
        502,
      );
    }
    return normalizeAiSubQuestionResult({
      item: rawItem,
      allocation,
      fallbackAnswerText: answerMap[allocation.id] ?? "",
      fallbackTitle: allocation.title || `Question(${index + 1})`,
    });
  });

  const totalScore = subQuestions.reduce((sum, item) => sum + Number(item.score ?? 0), 0);

  return {
    source: "ai",
    reviewSource: "ai",
    reviewProvider: "openai-compatible",
    totalScore,
    maxScore: Number(question?.score ?? 0),
    reviewVoiceUrl: `${currentReviewJson?.reviewVoiceUrl ?? ""}`.trim(),
    reviewVoiceObjectKey: `${currentReviewJson?.reviewVoiceObjectKey ?? ""}`.trim(),
    reviewVoiceDurationSeconds: Number(currentReviewJson?.reviewVoiceDurationSeconds ?? 0) || 0,
    feedbackStars: Number(currentReviewJson?.feedbackStars ?? 0) || 0,
    feedbackSubmittedAt: currentReviewJson?.feedbackSubmittedAt ?? null,
    subQuestions,
  };
};

const buildReviewJson = async ({
  question,
  answer,
  currentReviewJson,
  runtimeConfig = config.mockExamAiReview,
  allowRuleFallback = false,
}) => {
  if (!isOpenAiCompatibleReady(runtimeConfig)) {
    throw createHttpError("远程批改配置不完整，无法执行批改", 400);
  }

  try {
    return await buildOpenAiCompatibleReviewJson({ runtimeConfig, question, answer, currentReviewJson });
  } catch (_error) {
    if (!allowRuleFallback) {
      throw _error;
    }
    return buildRuleBasedReviewJson({ question, answer, currentReviewJson });
  }
};

export const aiReviewMockExamRecord = async ({
  db,
  recordId,
  adminId = "",
  currentTime = new Date(),
  runtimeConfig = config.mockExamAiReview,
  allowRuleFallback = false,
}) => {
  const restoreWorkflowStatus = (value) => {
    const status = `${value ?? ""}`.trim();
    if (status === "ai_pending" || status === "manual_pending" || status === "published" || status === "not_required") {
      return status;
    }
    return "ai_pending";
  };

  const readRecord = async () => {
    const query = {
      where: { id: recordId },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
          },
        },
        paper: {
          include: {
            questions: {
              where: {
                isActive: true,
              },
              orderBy: { sortOrder: "asc" },
              include: {
                options: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
        answers: true,
      },
    };

    if (db?.mockExamRecord?.findUnique) {
      return db.mockExamRecord.findUnique(query);
    }

    return db.$transaction((tx) => tx.mockExamRecord.findUnique(query));
  };

  const record = await readRecord();
  const initialWorkflowStatus = restoreWorkflowStatus(record?.reviewWorkflowStatus);

  if (!record) {
    throw createHttpError("考试记录不存在", 404);
  }

  if (record.status !== "submitted") {
    throw createHttpError("该考试记录尚未交卷", 409);
  }

  const subjectiveQuestions = (record.paper?.questions ?? []).filter((question) => isSubjectiveQuestion(question));
  if (subjectiveQuestions.length === 0) {
    throw createHttpError("该考试记录不需要主观题批改", 400);
  }

  try {
    await db.$transaction(async (tx) => {
      const latestRecord = await tx.mockExamRecord.findUnique({
        where: { id: record.id },
        select: {
          id: true,
          status: true,
          manualReviewerId: true,
          manualReviewLockToken: true,
        },
      });

      if (!latestRecord) {
        throw createHttpError("考试记录不存在", 404);
      }

      if (latestRecord.status !== "submitted") {
        throw createHttpError("该考试记录状态已变化，请刷新后重试", 409);
      }

      const lockToken = `${latestRecord.manualReviewLockToken ?? ""}`.trim();
      const reviewerId = `${latestRecord.manualReviewerId ?? ""}`.trim();
      if (lockToken && reviewerId && reviewerId !== `${adminId}`.trim()) {
        throw createHttpError("该试卷已被人工领取，本次自动批改已终止", 409);
      }

      await tx.mockExamRecord.update({
        where: { id: record.id },
        data: {
          reviewWorkflowStatus: "ai_processing",
          aiReviewStartedAt: currentTime,
          lastAiReviewError: null,
        },
      });
    });

    const answerMap = new Map((record.answers ?? []).map((item) => [item.questionId, item]));
    const reviewUpdates = [];
    let subjectiveTotal = 0;

    for (const question of subjectiveQuestions) {
      const answer = answerMap.get(question.id);
      if (!answer) {
        continue;
      }

      const currentReviewJson = parseJsonSafely(answer.reviewJson, null);
      const reviewJson = await buildReviewJson({ question, answer, currentReviewJson, runtimeConfig, allowRuleFallback });
      const totalScore = Number(reviewJson.totalScore ?? 0);

      subjectiveTotal += totalScore;
      reviewUpdates.push({
        answerId: answer.id,
        score: totalScore,
        reviewJson: JSON.stringify(reviewJson),
      });
    }

    const objectiveScore = (record.paper?.questions ?? []).reduce((sum, question) => {
      if (isSubjectiveQuestion(question)) {
        return sum;
      }
      return sum + Number(answerMap.get(question.id)?.score ?? 0);
    }, 0);

    await db.$transaction(async (tx) => {
      const latestRecord = await tx.mockExamRecord.findUnique({
        where: { id: record.id },
        select: {
          id: true,
          status: true,
          manualReviewerId: true,
          manualReviewLockToken: true,
        },
      });

      if (!latestRecord) {
        throw createHttpError("考试记录不存在", 404);
      }

      if (latestRecord.status !== "submitted") {
        throw createHttpError("该考试记录状态已变化，请刷新后重试", 409);
      }

      const lockToken = `${latestRecord.manualReviewLockToken ?? ""}`.trim();
      const reviewerId = `${latestRecord.manualReviewerId ?? ""}`.trim();
      if (lockToken && reviewerId && reviewerId !== `${adminId}`.trim()) {
        throw createHttpError("该试卷已被人工领取，本次自动批改已终止", 409);
      }

      for (const item of reviewUpdates) {
        await tx.mockExamAnswer.update({
          where: { id: item.answerId },
          data: {
            score: item.score,
            reviewJson: item.reviewJson,
          },
        });
      }

      await tx.mockExamRecord.update({
        where: { id: record.id },
        data: {
          totalScore: objectiveScore + subjectiveTotal,
          reviewedAt: currentTime,
          reviewWorkflowStatus: "manual_pending",
          aiReviewFinishedAt: currentTime,
          lastAiReviewError: null,
          publishedAt: null,
        },
      });
    });

    return readRecord();
  } catch (error) {
    if (typeof db?.mockExamRecord?.update === "function") {
      await db.mockExamRecord.update({
        where: { id: record.id },
        data: {
          reviewWorkflowStatus: initialWorkflowStatus,
          aiReviewFinishedAt: null,
          lastAiReviewError: error instanceof Error ? error.message : "AI批改失败",
        },
      });
    }
    throw error;
  }
};

export const normalizeAiReviewReport = (reviewJson) => {
  const raw = reviewJson && typeof reviewJson === "object" ? reviewJson : {};
  const reviewProvider = normalizeReviewProvider(raw.reviewProvider ?? raw.provider ?? "");
  return {
    ...raw,
    reviewProvider,
    subQuestions: Array.isArray(raw.subQuestions)
      ? raw.subQuestions.map((item) => ({
          ...item,
          reviewProvider: normalizeReviewProvider(item?.reviewProvider ?? reviewProvider),
          missedPoints: Array.isArray(item?.missedPoints) ? item.missedPoints : [],
          answerMarks: normalizeAnswerMarks(item?.answerMarks),
          rubricPoints: normalizeAiRubricPoints(item?.rubricPoints),
        }))
      : [],
  };
};


