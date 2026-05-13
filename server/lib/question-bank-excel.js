import XLSX from "xlsx";
import { extname } from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".xls", ".xlsx"]);
const MAX_SUB_QUESTIONS = 6;

const QUESTION_TYPE_ALIASES = new Map([
  ["single_choice", "single_choice"],
  ["singlechoice", "single_choice"],
  ["单选", "single_choice"],
  ["单选题", "single_choice"],
  ["multiple_choice", "multiple_choice"],
  ["multiplechoice", "multiple_choice"],
  ["多选", "multiple_choice"],
  ["多选题", "multiple_choice"],
  ["uncertain_choice", "uncertain_choice"],
  ["uncertainchoice", "uncertain_choice"],
  ["不定项", "uncertain_choice"],
  ["不定项选择", "uncertain_choice"],
  ["不定项选择题", "uncertain_choice"],
  ["subjective_case", "subjective_case"],
  ["subjective", "subjective_case"],
  ["主观", "subjective_case"],
  ["主观题", "subjective_case"],
  ["案例分析", "subjective_case"],
  ["案例分析题", "subjective_case"],
]);

const QUESTION_TYPE_LABELS = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  uncertain_choice: "不定项选择题",
  subjective_case: "主观题",
};

const normalizeHeader = (value) =>
  `${value ?? ""}`
    .trim()
    .toLowerCase()
    .replace(/[\s_\-（）()【】[\]{}]/g, "");

const normalizeText = (value) => `${value ?? ""}`.replace(/\r\n/g, "\n").trim();

const normalizeAnswerKeys = (value) =>
  Array.from(
    new Set(
      normalizeText(value)
        .split(/[，,;；|/、\s]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  );

const normalizeRow = (row) =>
  Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [normalizeHeader(key), typeof value === "string" ? value.trim() : value]));

const getValue = (row, aliases) => {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value === undefined || value === null) continue;
    const text = `${value}`.trim();
    if (text) return text;
  }

  return "";
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isObjectiveType = (type) => type !== "subjective_case";

const parseQuestionType = (value, paperType) => {
  const normalized = normalizeHeader(value);
  if (!normalized) {
    return paperType === "subjective" ? "subjective_case" : "single_choice";
  }

  const matched = QUESTION_TYPE_ALIASES.get(normalized);
  if (!matched) {
    throw new Error(`题型“${value}”无法识别，请使用单选题、多选题、不定项选择题或主观题`);
  }

  if (paperType === "objective" && matched === "subjective_case") {
    throw new Error("客观题模板中不能导入主观题");
  }

  if (paperType === "subjective" && matched !== "subjective_case") {
    throw new Error("主观题模板中只能导入主观题");
  }

  return matched;
};

const buildSubjectiveMeta = (row, stem, rowIndex) => {
  const title = getValue(row, ["标题", "题目标题", "title"]);
  const sectionLabel = getValue(row, ["题组名称", "题组", "sectionLabel"]) || "主观题";
  const sectionDescription = getValue(row, ["题组说明", "作答说明", "sectionDescription"]);
  const subQuestions = [];

  for (let index = 1; index <= MAX_SUB_QUESTIONS; index += 1) {
    const title = getValue(row, [`小问${index}`, `问题${index}`, `subQuestion${index}`]);
    const placeholder = getValue(row, [`小问${index}提示`, `问题${index}提示`, `subQuestion${index}Placeholder`]) || "请在此输入答案。";
    if (!title) continue;

    subQuestions.push({
      id: `import_${rowIndex}_${index}`,
      title,
      placeholder,
      sortOrder: index,
    });
  }

  if (subQuestions.length === 0) {
    subQuestions.push({
      id: `import_${rowIndex}_1`,
      title: stem || `第 ${rowIndex} 题`,
      placeholder: "请在此输入答案。",
      sortOrder: 1,
    });
  }

  return {
    title,
    sectionLabel,
    sectionDescription,
    subQuestions,
  };
};

const parseOptions = (row) => {
  const optionKeys = ["A", "B", "C", "D", "E", "F", "G", "H"];
  return optionKeys
    .map((key, index) => {
      const content = getValue(row, [`选项${key}`, `选项 ${key}`, `option${key}`]);
      return content
        ? {
            key,
            content,
            sortOrder: index + 1,
          }
        : null;
    })
    .filter(Boolean);
};

const buildQuestionFromRow = ({ row, paperType, rowIndex }) => {
  const stem = getValue(row, ["题干", "问题", "stem"]);
  const material = getValue(row, ["材料", "题目材料", "material"]);
  const analysis = getValue(row, ["解析", "答案解析", "analysis"]);
  const type = parseQuestionType(getValue(row, ["题型", "questionType", "type"]), paperType);
  const score = toPositiveInt(getValue(row, ["分值", "分数", "score"]), type === "subjective_case" ? 20 : 2);

  if (!stem && !material) {
    return null;
  }

  if (!stem) {
    throw new Error("题干不能为空");
  }

  if (isObjectiveType(type)) {
    const options = parseOptions(row);
    const correctAnswerKeys = normalizeAnswerKeys(getValue(row, ["正确答案", "答案", "correctAnswer"]));

    if (options.length < 2) {
      throw new Error("客观题至少需要填写两个选项");
    }

    if (correctAnswerKeys.length === 0) {
      throw new Error("客观题必须填写正确答案");
    }

    const validKeys = new Set(options.map((option) => option.key));
    if (correctAnswerKeys.some((key) => !validKeys.has(key))) {
      throw new Error("正确答案中存在未填写的选项标记");
    }

    if (type === "single_choice" && correctAnswerKeys.length !== 1) {
      throw new Error("单选题必须且只能有一个正确答案");
    }

    if (type === "multiple_choice" && correctAnswerKeys.length < 2) {
      throw new Error("多选题至少需要两个正确答案");
    }

    return {
      type,
      stem,
      material,
      analysis,
      score,
      correctAnswerKeys,
      options,
      questionMeta: null,
    };
  }

  return {
    type,
    stem,
    material,
    analysis,
    score,
    correctAnswerKeys: [],
    options: [],
    questionMeta: buildSubjectiveMeta(row, stem, rowIndex),
  };
};

export const parseQuestionBankExcel = async ({ fileName, buffer, paperType }) => {
  const extension = extname(fileName).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("仅支持 xls、xlsx Excel 文件");
  }

  try {
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      cellNF: false,
      cellText: false,
    });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return [];
    }

    const firstSheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      raw: false,
      defval: "",
      blankrows: false,
    });

    return rows.reduce((accumulator, sourceRow, index) => {
      const row = normalizeRow(sourceRow);
      const hasContent = Object.values(row).some((value) => `${value ?? ""}`.trim());
      if (!hasContent) {
        return accumulator;
      }

      try {
        const item = buildQuestionFromRow({
          row,
          paperType,
          rowIndex: index + 2,
        });

        if (item) accumulator.push(item);
        return accumulator;
      } catch (error) {
        throw new Error(`第 ${index + 2} 行：${error instanceof Error ? error.message : "数据格式错误"}`);
      }
    }, []);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("题库模板解析失败，请检查 Excel 内容后重试");
  }
};

const createInstructionRows = (paperType) => {
  if (paperType === "subjective") {
    return [
      ["字段", "填写说明"],
      ["题型", "固定填写“主观题”或 subjective_case，留空也会自动按主观题处理。"],
      ["标题", "可选，题库列表展示标题，例：民法案例1。"],
      ["分值", "可选，默认 20。"],
      ["题干", "必填。"],
      ["材料", "可选，用于案例材料、背景说明。"],
      ["解析", "可选，供后台查看。"],
      ["题组名称", "可选，例如：一、案例分析题。"],
      ["题组说明", "可选，例如：请分点作答。"],
      ["小问1~小问6", "可选，不填时系统会自动生成一个默认答题区。"],
      ["小问1提示~小问6提示", "可选，用于答题框占位提示。"],
    ];
  }

  return [
    ["字段", "填写说明"],
    ["题型", "填写单选题、多选题、不定项选择题，或 single_choice / multiple_choice / uncertain_choice。"],
    ["分值", "可选，默认 2。"],
    ["题干", "必填。"],
    ["材料", "可选。"],
    ["解析", "可选。"],
    ["正确答案", "必填。多个答案可用 A|B|C 或 A,B,C。"],
    ["选项A~选项H", "至少填写两个选项。"],
  ];
};

const buildTemplateRows = (paperType) => {
  if (paperType === "subjective") {
    return [
      {
        题型: "主观题",
        标题: "民法案例1",
        分值: 28,
        题干: "一、民法案例分析题。",
        材料: "甲公司与乙公司签订设备买卖合同，后因交付与瑕疵责任发生争议。",
        解析: "参考要点：围绕合同效力、违约责任、瑕疵担保责任展开。",
        题组名称: "一、案例分析题",
        题组说明: "请分点作答，结合民法基本原理说明理由。",
        小问1: "问题(1)：买卖合同是否成立并生效？请说明理由。",
        小问1提示: "请从合同成立、生效要件角度作答。",
        小问2: "问题(2)：乙公司可以主张哪些救济？",
        小问2提示: "请从违约责任、解除、赔偿等角度作答。",
      },
    ];
  }

  return [
    {
      题型: "单选题",
      分值: 2,
      题干: "关于合同成立，下列哪一说法是正确的？",
      材料: "",
      解析: "要约承诺一致时合同成立。",
      正确答案: "B",
      选项A: "合同必须书面签订才成立",
      选项B: "当事人意思表示一致时合同可以成立",
      选项C: "合同成立必须经过公证",
      选项D: "合同成立必须即时履行",
    },
    {
      题型: "多选题",
      分值: 3,
      题干: "下列哪些属于民事责任承担方式？",
      材料: "",
      解析: "停止侵害、赔偿损失、消除影响等均属于民事责任承担方式。",
      正确答案: "A|C|D",
      选项A: "停止侵害",
      选项B: "行政拘留",
      选项C: "赔偿损失",
      选项D: "消除影响、恢复名誉",
    },
  ];
};

export const createQuestionBankTemplate = (paperType) => {
  const workbook = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.json_to_sheet(buildTemplateRows(paperType));
  const instructionSheet = XLSX.utils.aoa_to_sheet(createInstructionRows(paperType));

  XLSX.utils.book_append_sheet(workbook, dataSheet, "题库模板");
  XLSX.utils.book_append_sheet(workbook, instructionSheet, "填写说明");

  return {
    fileName: `question-bank-${paperType}-template.xlsx`,
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
};

export const questionTypeLabelMap = QUESTION_TYPE_LABELS;
