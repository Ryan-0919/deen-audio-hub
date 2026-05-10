const clone = (value) => JSON.parse(JSON.stringify(value));

const toTrimmedString = (value, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized || fallback;
};

const normalizeFixedArray = (value, fallback, mapper) => {
  const source = Array.isArray(value) ? value : [];
  return fallback.map((item, index) => mapper(source[index] && typeof source[index] === "object" ? source[index] : {}, item, index));
};

export const DEFAULT_TYPING_PRACTICE_HOME_CONFIG = {
  hero: {
    title: "打字练习",
    englishTitle: "Typing Practice",
    description: "保留警察抓小偷的游戏感，但把训练重点落回主观题输入速度、准确率和法律表达节奏。",
    topNotice: "请使用中文输入法进行练习，删除、剪切、粘贴均已禁用",
    policeImageUrl: "/typing-practice/police.png",
    policeImageObjectKey: "",
    thiefImageUrl: "/typing-practice/thief.png",
    thiefImageObjectKey: "",
  },
  modeHints: {
    guided: "开始后立即进入逐字跟打状态。",
    sprint: "开始后会基于当前选中文本截取片段，并立即进入限时追击。",
    memorize: "开始后会先进入短暂预览，再自动隐藏题面进入默写。",
  },
  rules: {
    paragraphs: [
      { text: "请使用中文输入法按原文逐字录入，系统会严格校验顺序和内容。" },
      { text: "每完成一段文本就会抓住一名小偷，并自动进入下一段追捕。" },
      { text: "如果当前段落在规定时间内没有打完，小偷会逃脱并扣除一条生命。" },
      { text: "删除、剪切、粘贴都已禁用，适合主观题与法条速录训练。" },
      { text: "生命值耗尽或总时间结束后自动结算，系统会保存本次练习成绩。" },
    ],
    cards: [
      { title: "中文输入法", description: "支持拼音上屏与实时显示" },
      { title: "逐字校验", description: "必须按原文顺序输入" },
      { title: "分段追捕", description: "每 60 字为一段关卡" },
      { title: "禁止删除", description: "更贴近正式机考训练" },
    ],
  },
};

export const createDefaultTypingPracticeHomeConfig = () => clone(DEFAULT_TYPING_PRACTICE_HOME_CONFIG);

export const normalizeTypingPracticeHomeConfig = (value) => {
  const fallback = createDefaultTypingPracticeHomeConfig();
  const source = value && typeof value === "object" ? value : {};
  const heroSource = source.hero && typeof source.hero === "object" ? source.hero : {};
  const modeHintsSource = source.modeHints && typeof source.modeHints === "object" ? source.modeHints : {};
  const rulesSource = source.rules && typeof source.rules === "object" ? source.rules : {};

  fallback.hero = {
    title: toTrimmedString(heroSource.title, fallback.hero.title),
    englishTitle: toTrimmedString(heroSource.englishTitle, fallback.hero.englishTitle),
    description: toTrimmedString(heroSource.description, fallback.hero.description),
    topNotice: toTrimmedString(heroSource.topNotice, fallback.hero.topNotice),
    policeImageUrl: toTrimmedString(heroSource.policeImageUrl, fallback.hero.policeImageUrl),
    policeImageObjectKey: toTrimmedString(heroSource.policeImageObjectKey, fallback.hero.policeImageObjectKey),
    thiefImageUrl: toTrimmedString(heroSource.thiefImageUrl, fallback.hero.thiefImageUrl),
    thiefImageObjectKey: toTrimmedString(heroSource.thiefImageObjectKey, fallback.hero.thiefImageObjectKey),
  };

  fallback.modeHints = {
    guided: toTrimmedString(modeHintsSource.guided, fallback.modeHints.guided),
    sprint: toTrimmedString(modeHintsSource.sprint, fallback.modeHints.sprint),
    memorize: toTrimmedString(modeHintsSource.memorize, fallback.modeHints.memorize),
  };

  fallback.rules = {
    paragraphs: normalizeFixedArray(rulesSource.paragraphs, fallback.rules.paragraphs, (item, paragraph) => ({
      text: toTrimmedString(item.text, paragraph.text),
    })),
    cards: normalizeFixedArray(rulesSource.cards, fallback.rules.cards, (item, card) => ({
      title: toTrimmedString(item.title, card.title),
      description: toTrimmedString(item.description, card.description),
    })),
  };

  return fallback;
};
