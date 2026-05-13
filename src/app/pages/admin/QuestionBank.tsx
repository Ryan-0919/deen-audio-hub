import { useDeferredValue, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Download, FileText, FolderOpen, FolderPlus, Loader2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import {
  type AdminMockExamPaperStatus,
  type MockExamRubricPoint,
  type MockExamQuestionType,
  type QuestionBankFolder,
  type QuestionBankItem,
  type QuestionBankOption,
  type QuestionBankPaperType,
  type QuestionBankSubQuestion,
  type QuestionBankSummary,
  mockApi,
} from "../../lib/mockData";

const PAGE_SIZE = 20;
const objectiveQuestionTypes: MockExamQuestionType[] = ["single_choice", "multiple_choice", "uncertain_choice"];
const objectiveOptionKeys = ["A", "B", "C", "D", "E", "F"];
const reviewRequirementAccept = ".txt,.md,.text,.srt,.lrc,.doc,.docx";

const emptySummary: QuestionBankSummary = {
  totalFolders: 0,
  totalQuestions: 0,
  objectiveQuestions: 0,
  subjectiveQuestions: 0,
};

const paperTypeMeta: Record<QuestionBankPaperType, { label: string; description: string; defaultDuration: number }> = {
  objective: {
    label: "客观题",
    description: "适合批量维护单选、多选、不定项题目，并直接生成机考试卷。",
    defaultDuration: 90,
  },
  subjective: {
    label: "主观题",
    description: "适合维护案例分析题、问答题，并保留分问结构用于正式机考。",
    defaultDuration: 240,
  },
};

const questionTypeMeta: Record<MockExamQuestionType, { label: string; answerHint: string }> = {
  single_choice: { label: "单选题", answerHint: "只能选择一个正确答案" },
  multiple_choice: { label: "多选题", answerHint: "至少选择两个正确答案" },
  uncertain_choice: { label: "不定项选择题", answerHint: "可选择一个或多个正确答案" },
  subjective_case: { label: "主观题", answerHint: "支持分问答题区" },
};

type ItemFormState = {
  folderId: string;
  questionType: MockExamQuestionType;
  stem: string;
  material: string;
  analysis: string;
  lessonAudioUrl: string;
  lessonAudioObjectKey: string;
  lessonAudioDurationSeconds: number;
  score: string;
  correctAnswerKeys: string[];
  options: QuestionBankOption[];
  sectionLabel: string;
  sectionDescription: string;
  subjectiveSubQuestions: QuestionBankSubQuestion[];
};

type PaperFormState = {
  title: string;
  subtitle: string;
  year: string;
  phase: string;
  durationMinutes: string;
  maxAttempts: string;
  reviewEnabled: boolean;
  permissionRequired: boolean;
  passScore: string;
  description: string;
  status: AdminMockExamPaperStatus;
  sortOrder: string;
};

const normalizeAnswerKeys = (values: string[]) =>
  Array.from(new Set(values.map((item) => `${item ?? ""}`.trim().toUpperCase()).filter(Boolean))).sort();

const normalizeKeywordList = (value: string) =>
  Array.from(
    new Set(
      `${value ?? ""}`
        .split(/[\n,，、；;]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const createObjectiveOptions = (seed?: QuestionBankOption[]) =>
  objectiveOptionKeys.map((key) => ({
    key,
    content: seed?.find((item) => item.key === key)?.content ?? "",
  }));

const createEmptyRubricPoint = (index = 0): MockExamRubricPoint => ({
  id: `point_${index + 1}`,
  title: "",
  score: 0,
  description: "",
  keywords: [],
});

const createEmptySubQuestions = (): QuestionBankSubQuestion[] => [
  {
    id: "sub_1",
    title: "",
    abilityLabel: "",
    referenceAnswer: "",
    rubricGuidance: "",
    rubricPoints: [],
    placeholder: "请在此输入答案。",
  },
];

const createEmptyItemForm = (paperType: QuestionBankPaperType, folderId = ""): ItemFormState => ({
  folderId,
  questionType: paperType === "subjective" ? "subjective_case" : "single_choice",
  stem: "",
  material: "",
  analysis: "",
  lessonAudioUrl: "",
  lessonAudioObjectKey: "",
  lessonAudioDurationSeconds: 0,
  score: paperType === "subjective" ? "20" : "2",
  correctAnswerKeys: [],
  options: createObjectiveOptions(),
  sectionLabel: paperType === "subjective" ? "主观题" : "",
  sectionDescription: "",
  subjectiveSubQuestions: createEmptySubQuestions().map((item, index) => normalizeSubQuestionFormState(item, index)),
});

const createEmptySubjectiveSubQuestion = (index = 0): QuestionBankSubQuestion => ({
  id: `sub_${index + 1}`,
  title: "",
  placeholder: "请在此输入答案。",
  abilityLabel: "",
  referenceAnswer: "",
  rubricGuidance: "",
  rubricPoints: [],
});

const normalizeSubQuestionFormState = (subQuestion: QuestionBankSubQuestion | undefined, index: number): QuestionBankSubQuestion => ({
  ...createEmptySubjectiveSubQuestion(index),
  ...(subQuestion ?? {}),
  id: subQuestion?.id ?? `sub_${index + 1}`,
  title: subQuestion?.title ?? "",
  placeholder: subQuestion?.placeholder ?? "请在此输入答案。",
  abilityLabel: subQuestion?.abilityLabel ?? "",
  referenceAnswer: subQuestion?.referenceAnswer ?? "",
  rubricGuidance: subQuestion?.rubricGuidance ?? "",
  rubricPoints: (subQuestion?.rubricPoints ?? []).map((point, pointIndex) => ({
    id: point.id ?? `point_${pointIndex + 1}`,
    title: point.title ?? "",
    score: Number(point.score ?? 0),
    description: point.description ?? "",
    keywords: [...(point.keywords ?? [])],
  })),
});

const createItemFormFromItem = (item: QuestionBankItem): ItemFormState => ({
  folderId: item.folderId,
  questionType: item.questionType,
  stem: item.stem,
  material: item.material,
  analysis: item.analysis,
  lessonAudioUrl: item.lessonAudioUrl ?? "",
  lessonAudioObjectKey: item.lessonAudioObjectKey ?? "",
  lessonAudioDurationSeconds: Number(item.lessonAudioDurationSeconds ?? 0) || 0,
  score: `${item.score}`,
  correctAnswerKeys: item.correctAnswerKeys,
  options: createObjectiveOptions(item.options),
  sectionLabel: item.sectionLabel,
  sectionDescription: item.sectionDescription,
  subjectiveSubQuestions:
    item.subjectiveSubQuestions.length > 0
      ? item.subjectiveSubQuestions.map((subQuestion, index) => normalizeSubQuestionFormState(subQuestion, index))
      : createEmptySubQuestions().map((subQuestion, index) => normalizeSubQuestionFormState(subQuestion, index)),
});

const buildPaperForm = (paperType: QuestionBankPaperType, totalScore: number): PaperFormState => ({
  title: "",
  subtitle: "",
  year: `${new Date().getFullYear()}`,
  phase: paperType === "objective" ? "客观题" : "主观题",
  durationMinutes: `${paperTypeMeta[paperType].defaultDuration}`,
  maxAttempts: "0",
  reviewEnabled: paperType === "subjective",
  permissionRequired: false,
  passScore: `${Math.max(1, Math.round(totalScore * 0.6))}`,
  description: "",
  status: "draft",
  sortOrder: "",
});

const truncate = (text: string, maxLength = 180) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

const extractQuestionBankItemTitle = (item: QuestionBankItem) => {
  const stem = `${item.stem ?? ""}`.trim();
  const stemLines = stem
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const firstLine = stemLines[0] ?? "";
  const secondLine = stemLines[1] ?? "";
  if (firstLine && !/^案情[:：]?$/.test(firstLine)) {
    return firstLine;
  }

  if (item.questionType === "subjective_case") {
    const folderName = `${item.folderName ?? ""}`.trim();
    const firstSubQuestionTitle = `${item.subjectiveSubQuestions[0]?.title ?? ""}`.trim();

    if (folderName) {
      return `${folderName} · #${item.sortOrder}`;
    }

    if (secondLine) {
      return truncate(secondLine, 32);
    }

    if (firstSubQuestionTitle) {
      return truncate(firstSubQuestionTitle, 32);
    }
  }

  return firstLine || secondLine || `${item.questionTypeLabel} #${item.sortOrder}`;
};

const extractQuestionBankItemSummary = (item: QuestionBankItem) => {
  const stem = `${item.stem ?? ""}`.trim();
  const normalizedStem = stem.replace(/^案情[:：]?\s*/u, "").trim();

  if (normalizedStem) {
    return truncate(normalizedStem, 88);
  }

  const firstSubQuestionTitle = `${item.subjectiveSubQuestions[0]?.title ?? ""}`.trim();
  if (firstSubQuestionTitle) {
    return truncate(firstSubQuestionTitle, 88);
  }

  return "";
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const reviewSectionAliases = {
  referenceAnswer: ["参考答案", "标准答案", "答案示范", "示范答案", "参考答案及解析"],
  rubricGuidance: ["批改说明", "批改要求", "阅卷要求", "作答要求", "批改依据"],
  rubricPoints: ["评分点", "采分点", "给分点", "得分点", "评分要点", "采分要点", "评分标准"],
} as const;

type ReviewSectionKey = keyof typeof reviewSectionAliases;

const reviewSectionMatchers = (Object.entries(reviewSectionAliases) as [ReviewSectionKey, string[]][])
  .flatMap(([key, aliases]) =>
    aliases.map((alias) => ({
      key,
      regex: new RegExp(
        `^(?:(?:(?:第?[一二三四五六七八九十0-9]+)|(?:[（(][一二三四五六七八九十0-9]+[）)]))[、.．]?\\s*)?[【\\[]?${escapeRegExp(alias)}[】\\]]?\\s*(?:[:：]\\s*(.*))?$`,
      ),
    })),
  );

const stripLeadingListMarker = (value: string) =>
  `${value ?? ""}`
    .trim()
    .replace(/^(?:[-*•●·]|[（(]?\d+[)）.、]?|[一二三四五六七八九十]+[、.．)）])\s*/, "");

const matchReviewSection = (line: string): { key: ReviewSectionKey; inlineText: string } | null => {
  const trimmed = `${line ?? ""}`.trim();
  if (!trimmed) return null;

  for (const matcher of reviewSectionMatchers) {
    const matched = trimmed.match(matcher.regex);
    if (matched) {
      return {
        key: matcher.key,
        inlineText: `${matched[1] ?? ""}`.trim(),
      };
    }
  }

  return null;
};

const parseStructuredReviewSections = (text: string) => {
  const lines = `${text ?? ""}`.replace(/\r\n/g, "\n").split("\n");
  const sections: Record<ReviewSectionKey | "intro", string[]> = {
    intro: [],
    referenceAnswer: [],
    rubricGuidance: [],
    rubricPoints: [],
  };
  let currentSection: ReviewSectionKey | "intro" = "intro";

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    const matched = matchReviewSection(line);
    if (matched) {
      currentSection = matched.key;
      if (matched.inlineText) {
        sections[currentSection].push(matched.inlineText);
      }
      return;
    }

    if (!line) {
      if (sections[currentSection].length > 0 && sections[currentSection][sections[currentSection].length - 1] !== "") {
        sections[currentSection].push("");
      }
      return;
    }

    sections[currentSection].push(line);
  });

  return {
    referenceAnswer: sections.referenceAnswer.join("\n").trim(),
    rubricGuidance: [...sections.intro, ...sections.rubricGuidance].join("\n").trim(),
    rubricPointText: sections.rubricPoints.join("\n").trim(),
  };
};

const isRubricPointStart = (line: string) => {
  const trimmed = `${line ?? ""}`.trim();
  if (!trimmed || /^(?:关键词|关键字|命中词|核心词)\s*[:：]/.test(trimmed)) {
    return false;
  }

  return /^(?:[-*•●·]|\d+[.、)）]|[（(]\d+[)）]|[一二三四五六七八九十]+[、.．)）])\s*/.test(trimmed);
};

const splitRubricPointBlocks = (text: string) => {
  const lines = `${text ?? ""}`
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [] as string[][];
  }

  const blocks: string[][] = [];
  let currentBlock: string[] = [];
  let sawMarker = false;

  lines.forEach((line) => {
    if (isRubricPointStart(line)) {
      sawMarker = true;
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = [line];
      return;
    }

    currentBlock.push(line);
  });

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  if (!sawMarker && lines.length === 1) {
    const parts = lines[0]
      .split(/[；;]/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      return parts.map((part) => [part]);
    }
  }

  return blocks;
};

const parseRubricPointBlock = (lines: string[], index: number): MockExamRubricPoint | null => {
  if (lines.length === 0) return null;

  const keywordValues = lines
    .map((line) => line.match(/^(?:关键词|关键字|命中词|核心词)\s*[:：]\s*(.+)$/)?.[1] ?? "")
    .filter(Boolean)
    .flatMap((value) => normalizeKeywordList(value));
  const contentLines = lines.filter((line) => !/^(?:关键词|关键字|命中词|核心词)\s*[:：]/.test(line));
  const blockText = contentLines.join("\n").trim();
  if (!blockText) return null;

  const scoreMatch = blockText.match(/(\d+(?:\.\d+)?)\s*分/);
  const normalizedScore = scoreMatch ? Math.max(0, Math.round(Number(scoreMatch[1]))) : 0;
  const firstLine = stripLeadingListMarker(contentLines[0] ?? "");
  const title = firstLine
    .replace(/[（(]?\s*\d+(?:\.\d+)?\s*分[）)]?/g, "")
    .replace(/^(?:要点|评分点|采分点)\s*[:：]?\s*/, "")
    .trim();
  const description = contentLines
    .slice(1)
    .join("\n")
    .replace(/[（(]?\s*\d+(?:\.\d+)?\s*分[）)]?/g, "")
    .trim();

  if (!title) return null;

  return {
    id: `point_${index + 1}`,
    title,
    score: normalizedScore,
    description,
    keywords: Array.from(new Set(keywordValues)),
  };
};

const parseRubricPointsFromText = (text: string) =>
  splitRubricPointBlocks(text)
    .map((lines, index) => parseRubricPointBlock(lines, index))
    .filter((point): point is MockExamRubricPoint => Boolean(point));

const parseReviewRequirementText = (text: string) => {
  const normalizedText = `${text ?? ""}`.replace(/\r\n/g, "\n").trim();
  const sections = parseStructuredReviewSections(normalizedText);
  const rubricPoints = parseRubricPointsFromText(sections.rubricPointText);

  if (!sections.referenceAnswer && !sections.rubricGuidance && rubricPoints.length === 0) {
    return {
      referenceAnswer: "",
      rubricGuidance: normalizedText,
      rubricPoints: [] as MockExamRubricPoint[],
      rawText: normalizedText,
    };
  }

  return {
    referenceAnswer: sections.referenceAnswer,
    rubricGuidance: sections.rubricGuidance,
    rubricPoints,
    rawText: normalizedText,
  };
};

const describeImportedReviewRequirement = (result: ReturnType<typeof parseReviewRequirementText>) => {
  const segments: string[] = [];
  if (result.referenceAnswer) {
    segments.push("参考答案已更新");
  }
  if (result.rubricGuidance) {
    segments.push("批改说明已更新");
  }
  if (result.rubricPoints.length > 0) {
    segments.push(`识别 ${result.rubricPoints.length} 个评分点`);
  }
  return segments.join("，") || "已导入批改要求文件";
};

export function QuestionBank() {
  const navigate = useNavigate();
  const [paperType, setPaperType] = useState<QuestionBankPaperType>("objective");
  const [summary, setSummary] = useState<QuestionBankSummary>(emptySummary);
  const [folders, setFolders] = useState<QuestionBankFolder[]>([]);
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [questionTypeFilter, setQuestionTypeFilter] = useState<MockExamQuestionType | "all">("all");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<QuestionBankFolder | null>(null);
  const [folderName, setFolderName] = useState("");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QuestionBankItem | null>(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [lessonAudioUploading, setLessonAudioUploading] = useState(false);
  const [rubricImportingIndex, setRubricImportingIndex] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(createEmptyItemForm("objective"));
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFolderId, setImportFolderId] = useState("");
  const [importing, setImporting] = useState(false);
  const [assembleDialogOpen, setAssembleDialogOpen] = useState(false);
  const [paperForm, setPaperForm] = useState<PaperFormState>(buildPaperForm("objective", 0));
  const [assembling, setAssembling] = useState(false);
  const deferredKeyword = useDeferredValue(keyword.trim());

  const selectedQuestions = useMemo(() => {
    const selectedSet = new Set(selectedItemIds);
    return items.filter((item) => selectedSet.has(item.id));
  }, [items, selectedItemIds]);
  const selectedScore = useMemo(() => selectedQuestions.reduce((sum, item) => sum + item.score, 0), [selectedQuestions]);
  const currentQuestionTotal = paperType === "objective" ? summary.objectiveQuestions : summary.subjectiveQuestions;
  const folderOptions = useMemo(() => folders.map((folder) => ({ label: folder.name, value: folder.id })), [folders]);
  const allSelected = items.length > 0 && items.every((item) => selectedItemIds.includes(item.id));
  const selectedImportFolderName = useMemo(
    () => folders.find((folder) => folder.id === importFolderId)?.name ?? "",
    [folders, importFolderId],
  );
  const importFileSizeLabel = useMemo(() => {
    if (!importFile) return "";
    if (importFile.size < 1024 * 1024) {
      return `${Math.max(1, Math.round(importFile.size / 1024))} KB`;
    }
    return `${(importFile.size / (1024 * 1024)).toFixed(1)} MB`;
  }, [importFile]);

  const loadSummary = async () => {
    const result = await mockApi.getQuestionBankSummary();
    setSummary(result);
  };

  const loadFolders = async () => {
    const result = await mockApi.getQuestionBankFolders(paperType);
    setFolders(result);
    setSelectedFolderId((current) => (current === "all" || result.some((folder) => folder.id === current) ? current : "all"));
    setImportFolderId((current) => {
      if (current && result.some((folder) => folder.id === current)) return current;
      return result[0]?.id ?? "";
    });
  };

  const loadItems = async (nextPage = page) => {
    setListLoading(true);
    try {
      const result = await mockApi.getQuestionBankItems({
        paperType,
        folderId: selectedFolderId === "all" ? undefined : selectedFolderId,
        keyword: deferredKeyword,
        questionType: questionTypeFilter,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotalItems(result.total);
      setTotalPages(result.totalPages);
      if (result.page !== nextPage) {
        setPage(result.page);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载题库题目失败");
    } finally {
      setListLoading(false);
    }
  };

  const refreshAll = async (options?: { resetPage?: boolean }) => {
    const nextPage = options?.resetPage ? 1 : page;
    if (options?.resetPage && page !== 1) {
      setPage(1);
    }
    await Promise.all([loadSummary(), loadFolders(), loadItems(nextPage)]);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        await Promise.all([loadSummary(), loadFolders()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载题库失败");
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, [paperType]);

  useEffect(() => {
    if (loading) return;
    void loadItems();
  }, [loading, paperType, selectedFolderId, deferredKeyword, questionTypeFilter, page]);

  useEffect(() => {
    setSelectedItemIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const openCreateFolder = () => {
    setEditingFolder(null);
    setFolderName("");
    setFolderDialogOpen(true);
  };

  const openEditFolder = (folder: QuestionBankFolder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderDialogOpen(true);
  };

  const saveFolder = async () => {
    const normalizedName = folderName.trim();
    if (!normalizedName) {
      toast.error("请输入文件夹名称");
      return;
    }

    try {
      const folder = editingFolder
        ? await mockApi.updateQuestionBankFolder(editingFolder.id, normalizedName)
        : await mockApi.createQuestionBankFolder(normalizedName, paperType);
      await loadSummary();
      await loadFolders();
      setSelectedFolderId(folder.id);
      setFolderDialogOpen(false);
      toast.success(editingFolder ? "文件夹已更新" : "文件夹已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存文件夹失败");
    }
  };

  const removeFolder = async (folder: QuestionBankFolder) => {
    if (!window.confirm(`确认删除文件夹“${folder.name}”？`)) {
      return;
    }

    try {
      await mockApi.deleteQuestionBankFolder(folder.id);
      toast.success("文件夹已删除");
      await refreshAll({ resetPage: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除文件夹失败");
    }
  };

  const openCreateItem = () => {
    if (folders.length === 0) {
      toast.error("请先创建文件夹");
      return;
    }

    const defaultFolderId = selectedFolderId !== "all" ? selectedFolderId : folders[0]?.id ?? "";
    setEditingItem(null);
    setItemForm(createEmptyItemForm(paperType, defaultFolderId));
    setItemDialogOpen(true);
  };

  const openEditItem = (item: QuestionBankItem) => {
    setEditingItem(item);
    setItemForm(createItemFormFromItem(item));
    setItemDialogOpen(true);
  };

  const updateFormOption = (key: string, content: string) => {
    setItemForm((current) => ({
      ...current,
      options: current.options.map((option) => (option.key === key ? { ...option, content } : option)),
    }));
  };

  const toggleCorrectAnswer = (key: string) => {
    setItemForm((current) => {
      const exists = current.correctAnswerKeys.includes(key);
      if (current.questionType === "single_choice") {
        return {
          ...current,
          correctAnswerKeys: exists ? [] : [key],
        };
      }

      return {
        ...current,
        correctAnswerKeys: exists ? current.correctAnswerKeys.filter((item) => item !== key) : [...current.correctAnswerKeys, key],
      };
    });
  };

  const addSubQuestion = () => {
    setItemForm((current) => ({
      ...current,
      subjectiveSubQuestions: [
        ...current.subjectiveSubQuestions,
        {
          id: `sub_${current.subjectiveSubQuestions.length + 1}`,
          title: "",
          abilityLabel: "",
          referenceAnswer: "",
          rubricGuidance: "",
          rubricPoints: [],
          placeholder: "请在此输入答案。",
        },
      ],
    }));
  };

  const updateSubQuestion = (
    index: number,
    key: "title" | "placeholder" | "abilityLabel" | "referenceAnswer" | "rubricGuidance",
    value: string,
  ) => {
    setItemForm((current) => ({
      ...current,
      subjectiveSubQuestions: current.subjectiveSubQuestions.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    }));
  };

  const addRubricPoint = (subQuestionIndex: number) => {
    setItemForm((current) => ({
      ...current,
      subjectiveSubQuestions: current.subjectiveSubQuestions.map((item, itemIndex) =>
        itemIndex === subQuestionIndex
          ? {
              ...item,
              rubricPoints: [...(item.rubricPoints ?? []), createEmptyRubricPoint((item.rubricPoints ?? []).length)],
            }
          : item,
      ),
    }));
  };

  const updateRubricPoint = (
    subQuestionIndex: number,
    pointIndex: number,
    key: "title" | "score" | "description" | "keywords",
    value: string,
  ) => {
    setItemForm((current) => ({
      ...current,
      subjectiveSubQuestions: current.subjectiveSubQuestions.map((item, itemIndex) => {
        if (itemIndex !== subQuestionIndex) {
          return item;
        }

        return {
          ...item,
          rubricPoints: (item.rubricPoints ?? []).map((point, currentPointIndex) => {
            if (currentPointIndex !== pointIndex) {
              return point;
            }

            if (key === "score") {
              return {
                ...point,
                score: Math.max(0, Number.parseInt(value || "0", 10) || 0),
              };
            }

            if (key === "keywords") {
              return {
                ...point,
                keywords: normalizeKeywordList(value),
              };
            }

            return {
              ...point,
              [key]: value,
            };
          }),
        };
      }),
    }));
  };

  const removeRubricPoint = (subQuestionIndex: number, pointIndex: number) => {
    setItemForm((current) => ({
      ...current,
      subjectiveSubQuestions: current.subjectiveSubQuestions.map((item, itemIndex) =>
        itemIndex === subQuestionIndex
          ? {
              ...item,
              rubricPoints: (item.rubricPoints ?? []).filter((_, currentPointIndex) => currentPointIndex !== pointIndex),
            }
          : item,
      ),
    }));
  };

  const removeSubQuestion = (index: number) => {
    setItemForm((current) => ({
      ...current,
      subjectiveSubQuestions:
        current.subjectiveSubQuestions.length <= 1
          ? createEmptySubQuestions().map((item, itemIndex) => normalizeSubQuestionFormState(item, itemIndex))
          : current.subjectiveSubQuestions.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleLessonAudioUpload = async (file: File | null) => {
    if (!file) return;

    try {
      setLessonAudioUploading(true);
      const uploaded = await mockApi.uploadQuestionBankLessonAudio(file);
      setItemForm((current) => ({
        ...current,
        lessonAudioUrl: uploaded.readableUrl ?? uploaded.url,
        lessonAudioObjectKey: uploaded.objectKey ?? "",
        lessonAudioDurationSeconds: Number(uploaded.durationSeconds ?? 0) || 0,
      }));
      toast.success("题目微课已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传题目微课失败");
    } finally {
      setLessonAudioUploading(false);
    }
  };

  const importReviewRequirementFile = async (subQuestionIndex: number, file: File | null) => {
    if (!file) return;

    try {
      setRubricImportingIndex(subQuestionIndex);
      const result = await mockApi.extractScriptFile(file);
      const imported = parseReviewRequirementText(result.text);

      setItemForm((current) => ({
        ...current,
        subjectiveSubQuestions: current.subjectiveSubQuestions.map((item, itemIndex) => {
          if (itemIndex !== subQuestionIndex) {
            return item;
          }

          return {
            ...item,
            referenceAnswer: imported.referenceAnswer || item.referenceAnswer || "",
            rubricGuidance: imported.rubricGuidance || item.rubricGuidance || imported.rawText || "",
            rubricPoints: imported.rubricPoints.length > 0 ? imported.rubricPoints : item.rubricPoints ?? [],
          };
        }),
      }));

      toast.success(`批改要求已导入：${describeImportedReviewRequirement(imported)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批改要求文件读取失败");
    } finally {
      setRubricImportingIndex(null);
    }
  };

  const handleQuestionTypeChange = (value: MockExamQuestionType) => {
    setItemForm((current) => ({
      ...current,
      questionType: value,
      score: value === "subjective_case" ? current.score || "20" : current.score || "2",
      correctAnswerKeys: value === "subjective_case" ? [] : current.correctAnswerKeys,
    }));
  };

  const renderSubjectiveSubQuestionCard = (rawSubQuestion: QuestionBankSubQuestion, index: number) => {
    const subQuestion = normalizeSubQuestionFormState(rawSubQuestion, index);

    return (
      <div key={subQuestion.id ?? index} className="rounded-2xl border border-white bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">小问 {index + 1}</p>
          <Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => removeSubQuestion(index)}>
            <Trash2 className="mr-2 size-4" />
            删除
          </Button>
        </div>

        <div className="mt-4 grid gap-4">
          <div className="space-y-2">
            <Label>标题</Label>
            <Input value={subQuestion.title} onChange={(event) => updateSubQuestion(index, "title", event.target.value)} placeholder="例如：问题(1)：合同是否成立？" />
          </div>

          <div className="space-y-2">
            <Label>答题提示</Label>
            <Input value={subQuestion.placeholder} onChange={(event) => updateSubQuestion(index, "placeholder", event.target.value)} placeholder="例如：请围绕合同成立要件作答" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>能力标签</Label>
              <Input value={subQuestion.abilityLabel ?? ""} onChange={(event) => updateSubQuestion(index, "abilityLabel", event.target.value)} placeholder="例如：法条识别、要件分析" />
            </div>

            <div className="space-y-2">
              <Label>参考答案</Label>
              <Textarea
                value={subQuestion.referenceAnswer ?? ""}
                onChange={(event) => updateSubQuestion(index, "referenceAnswer", event.target.value)}
                className="min-h-[88px]"
                placeholder="用于 AI / 人工批改的核心答案提示，可直接粘贴示范答案或由批改要求文件自动导入。"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <Label>批改说明 / AI 批改依据</Label>
                <p className="text-xs text-slate-500">支持导入批改要求文件，自动提取参考答案、批改说明和评分点。</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`review-requirement-file-${index}`}
                  type="file"
                  accept={reviewRequirementAccept}
                  className="hidden"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const file = event.target.files?.[0] ?? null;
                    void importReviewRequirementFile(index, file);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={rubricImportingIndex === index}
                  onClick={() => document.getElementById(`review-requirement-file-${index}`)?.click()}
                >
                  {rubricImportingIndex === index ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                  导入批改要求文件
                </Button>
              </div>
            </div>
            <Textarea
              value={subQuestion.rubricGuidance ?? ""}
              onChange={(event) => updateSubQuestion(index, "rubricGuidance", event.target.value)}
              className="min-h-[120px]"
              placeholder="说明本小问的批改逻辑，例如：先看结论，再看要件、法条依据和推理。这里也会作为 AI 批改的强约束依据。"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">评分点</p>
                <p className="text-xs text-slate-500">关键词支持逗号、顿号、分号或换行分隔。</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => addRubricPoint(index)}>
                <Plus className="mr-2 size-4" />
                添加评分点
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {(subQuestion.rubricPoints ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">暂未配置评分点</div>
              ) : (
                (subQuestion.rubricPoints ?? []).map((point, pointIndex) => (
                  <div key={point.id ?? pointIndex} className="rounded-2xl border border-white bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">评分点 {pointIndex + 1}</p>
                      <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => removeRubricPoint(index, pointIndex)}>
                        <Trash2 className="mr-2 size-4" />
                        删除
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
                      <div className="space-y-2">
                        <Label>要点名称</Label>
                        <Input value={point.title} onChange={(event) => updateRubricPoint(index, pointIndex, "title", event.target.value)} placeholder="例如：合同成立的要件" />
                      </div>

                      <div className="space-y-2">
                        <Label>分值</Label>
                        <Input type="number" min={0} value={point.score} onChange={(event) => updateRubricPoint(index, pointIndex, "score", event.target.value)} />
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label>要点说明</Label>
                      <Textarea
                        value={point.description ?? ""}
                        onChange={(event) => updateRubricPoint(index, pointIndex, "description", event.target.value)}
                        className="min-h-[72px]"
                        placeholder="说明该得分点应回答出的内容"
                      />
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label>关键词</Label>
                      <Input
                        value={(point.keywords ?? []).join("，")}
                        onChange={(event) => updateRubricPoint(index, pointIndex, "keywords", event.target.value)}
                        placeholder="例如：要约，承诺，法律拘束力"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderItemPreview = (item: QuestionBankItem | null) => {
    if (!item) {
      return (
        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          请选择左侧题目查看详情
        </div>
      );
    }

    const optionCount = item.options.filter((option) => option.content).length;
    const itemTitle = extractQuestionBankItemTitle(item);

    return (
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-slate-900 text-white">{item.questionTypeLabel}</Badge>
            <Badge className="bg-slate-100 text-slate-700">{item.score} 分</Badge>
            <Badge className="bg-slate-100 text-slate-600">{item.folderName}</Badge>
            <span className="text-xs text-slate-400">题目序号 #{item.sortOrder}</span>
            <span className="text-xs text-slate-400">更新于 {item.updatedAt}</span>
          </div>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-7 text-slate-900">{itemTitle}</h3>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.stem}</div>
              {item.sectionDescription ? <p className="mt-2 text-sm leading-6 text-slate-500">{item.sectionDescription}</p> : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => openEditItem(item)}>
                <Pencil className="mr-2 size-4" />
                编辑
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => void removeItem(item)}>
                <Trash2 className="mr-2 size-4" />
                删除
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {item.material ? (
              <section className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">题目材料</div>
                <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.material}</div>
              </section>
            ) : null}

            {item.questionType === "subjective_case" ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">分问结构</div>
                  <div className="text-xs text-slate-400">{item.subjectiveSubQuestions.length} 个答题区</div>
                </div>
                {item.subjectiveSubQuestions.map((subQuestion, index) => (
                  <div key={subQuestion.id ?? index} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{subQuestion.title || `问题 ${index + 1}`}</span>
                      {subQuestion.abilityLabel ? <Badge className="bg-white text-slate-600">{subQuestion.abilityLabel}</Badge> : null}
                    </div>
                    {subQuestion.placeholder ? <div className="mt-2 text-sm text-slate-500">答题提示：{subQuestion.placeholder}</div> : null}
                    {subQuestion.referenceAnswer ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs font-semibold text-slate-400">参考答案</div>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{subQuestion.referenceAnswer}</div>
                      </div>
                    ) : null}
                    {subQuestion.rubricGuidance ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs font-semibold text-slate-400">批改说明</div>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{subQuestion.rubricGuidance}</div>
                      </div>
                    ) : null}
                    {(subQuestion.rubricPoints ?? []).length > 0 ? (
                      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">评分点</div>
                        <div className="divide-y divide-slate-100">
                          {(subQuestion.rubricPoints ?? []).map((point, pointIndex) => (
                            <div key={point.id ?? pointIndex} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_90px]">
                              <div>
                                <div className="text-sm font-medium text-slate-900">{point.title}</div>
                                {point.description ? <div className="mt-1 text-sm leading-6 text-slate-500">{point.description}</div> : null}
                                {(point.keywords ?? []).length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {(point.keywords ?? []).map((keyword) => (
                                      <span key={keyword} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                        {keyword}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <div className="text-right text-sm font-semibold text-slate-700">{point.score} 分</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">客观题配置</div>
                  <div className="text-xs text-slate-400">{optionCount} 个选项</div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="grid grid-cols-[80px_minmax(0,1fr)] border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                    <div>选项</div>
                    <div>内容</div>
                  </div>
                  {item.options.filter((option) => option.content).map((option) => (
                    <div key={option.key} className="grid grid-cols-[80px_minmax(0,1fr)] border-b border-slate-100 px-4 py-3 last:border-b-0">
                      <div className="text-sm font-semibold text-slate-800">{option.key}</div>
                      <div className="text-sm leading-7 text-slate-700">{option.content}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="text-xs font-semibold text-slate-400">正确答案</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{item.correctAnswerKeys.join("、") || "-"}</div>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">解析</div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.analysis || "未填写解析"}</div>
            </section>
          </div>
        </div>
      </div>
    );
  };

  const saveItem = async () => {
    if (!itemForm.folderId) {
      toast.error("请选择文件夹");
      return;
    }

    const payload = {
      folderId: itemForm.folderId,
      questionType: itemForm.questionType,
      stem: itemForm.stem,
      material: itemForm.material,
      analysis: itemForm.analysis,
      lessonAudioUrl: itemForm.lessonAudioUrl,
      lessonAudioObjectKey: itemForm.lessonAudioObjectKey,
      lessonAudioDurationSeconds: itemForm.lessonAudioDurationSeconds,
      score: Number(itemForm.score || 0),
      correctAnswerKeys: normalizeAnswerKeys(itemForm.correctAnswerKeys),
      options: itemForm.options
        .map((option) => ({
          key: option.key,
          content: option.content.trim(),
        }))
        .filter((option) => option.content),
      sectionLabel: itemForm.sectionLabel,
      sectionDescription: itemForm.sectionDescription,
      subjectiveSubQuestions: itemForm.subjectiveSubQuestions
        .map((item) => ({
          id: item.id,
          title: item.title.trim(),
          placeholder: item.placeholder.trim(),
          abilityLabel: item.abilityLabel?.trim() ?? "",
          referenceAnswer: item.referenceAnswer?.trim() ?? "",
          rubricGuidance: item.rubricGuidance?.trim() ?? "",
          rubricPoints: (item.rubricPoints ?? [])
            .map((point) => ({
              id: point.id,
              title: point.title.trim(),
              score: Math.max(0, Number(point.score ?? 0)),
              description: point.description?.trim() ?? "",
              keywords: [...(point.keywords ?? [])],
            }))
            .filter((point) => point.title),
        }))
        .filter((item) => item.title),
    };

    try {
      setItemSaving(true);
      if (editingItem) {
        await mockApi.updateQuestionBankItem(editingItem.id, payload);
      } else {
        await mockApi.createQuestionBankItem(payload);
      }
      setItemDialogOpen(false);
      toast.success(editingItem ? "题目已更新" : "题目已加入题库");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存题目失败");
    } finally {
      setItemSaving(false);
    }
  };

  const removeItem = async (item: QuestionBankItem) => {
    if (!window.confirm("确认删除这道题目？")) {
      return;
    }

    try {
      await mockApi.deleteQuestionBankItem(item.id);
      toast.success("题目已删除");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除题目失败");
    }
  };

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  };

  const toggleSelectAll = () => {
    setSelectedItemIds(allSelected ? [] : items.map((item) => item.id));
  };

  const openImportDialog = () => {
    if (folders.length === 0) {
      toast.error("请先创建文件夹");
      return;
    }

    setImportFile(null);
    setImportFolderId(selectedFolderId !== "all" ? selectedFolderId : folders[0]?.id ?? "");
    setImportDialogOpen(true);
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error("请先选择 Excel 文件");
      return;
    }

    if (!importFolderId) {
      toast.error("请选择导入文件夹");
      return;
    }

    try {
      setImporting(true);
      const result = await mockApi.importQuestionBankItems(importFile, importFolderId, paperType);
      toast.success(`已导入 ${result.createdCount} 道题目`);
      setImportDialogOpen(false);
      await refreshAll({ resetPage: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量导入失败");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await mockApi.downloadQuestionBankTemplate(paperType);
      downloadBlob(blob, `题库上传模板-${paperTypeMeta[paperType].label}.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下载模板失败");
    }
  };

  const openAssembleDialog = () => {
    if (selectedQuestions.length === 0) {
      toast.error("请至少选择一道题目");
      return;
    }

    setPaperForm(buildPaperForm(paperType, selectedScore));
    setAssembleDialogOpen(true);
  };

  const handleAssemblePaper = async () => {
    if (!paperForm.title.trim()) {
      toast.error("请输入试卷标题");
      return;
    }

    try {
      setAssembling(true);
      await mockApi.createMockExamPaperFromQuestionBank({
        itemIds: selectedQuestions.map((item) => item.id),
        paper: {
          title: paperForm.title.trim(),
          subtitle: paperForm.subtitle.trim() || undefined,
          year: paperForm.year ? Number(paperForm.year) : undefined,
          phase: paperForm.phase.trim() || undefined,
          durationMinutes: paperForm.durationMinutes ? Number(paperForm.durationMinutes) : undefined,
          maxAttempts: paperForm.maxAttempts ? Number(paperForm.maxAttempts) : undefined,
          reviewEnabled: paperForm.reviewEnabled,
          permissionRequired: paperForm.permissionRequired,
          passScore: paperForm.passScore ? Number(paperForm.passScore) : undefined,
          description: paperForm.description.trim() || undefined,
          status: paperForm.status,
          sortOrder: paperForm.sortOrder ? Number(paperForm.sortOrder) : undefined,
        },
      });
      toast.success("试卷已生成");
      setAssembleDialogOpen(false);
      setSelectedItemIds([]);
      navigate("/admin/mock-exams/papers");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成试卷失败");
    } finally {
      setAssembling(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">题库加载中...</div>;
  }

  return (
    <div className="space-y-6 p-8">
      <Card className="rounded-3xl border-slate-200 bg-white">
        <CardContent className="p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {(Object.keys(paperTypeMeta) as QuestionBankPaperType[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
                      paperType === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    }`}
                    onClick={() => {
                      setPaperType(value);
                      setQuestionTypeFilter(value === "subjective" ? "subjective_case" : "all");
                      setSelectedItemIds([]);
                      setKeyword("");
                      setPage(1);
                    }}
                  >
                    {paperTypeMeta[value].label}
                  </button>
                ))}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">机考题库</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{paperTypeMeta[paperType].description}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:min-w-[420px] sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">批量导入</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">适合一次性导入整套题库，按模板整理后统一上传。</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                    <Download className="size-4" />
                    下载模板
                  </Button>
                  <Button size="sm" onClick={openImportDialog}>
                    <Upload className="size-4" />
                    批量上传
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">手动录题</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">适合零散补题、修题，先建文件夹再逐题录入。</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={openCreateFolder}>
                    <FolderPlus className="size-4" />
                    新建文件夹
                  </Button>
                  <Button size="sm" onClick={openCreateItem}>
                    <Plus className="size-4" />
                    新增题目
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">当前类型题量</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{currentQuestionTotal}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">全部题目</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalQuestions}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">文件夹数量</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{folders.length}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm text-blue-700">已选题目</p>
              <p className="mt-2 text-3xl font-semibold text-blue-800">{selectedQuestions.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start">
        <Card className="self-start rounded-2xl border-slate-200 bg-white xl:sticky xl:top-6 xl:max-h-[calc(100vh-7rem)] xl:overflow-hidden">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900">题库文件夹</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 xl:overflow-y-auto">
            <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${selectedFolderId === "all" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700"}`}>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSelectedFolderId("all")}>
                <FolderOpen className="size-4" />
                <span className="truncate text-sm font-medium">全部题目</span>
              </button>
              <span className={`rounded-full px-2 py-0.5 text-xs ${selectedFolderId === "all" ? "bg-white/15 text-white" : "bg-white text-slate-500"}`}>{currentQuestionTotal}</span>
            </div>

            {folders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">当前类型还没有文件夹</div>
            ) : (
              folders.map((folder) => {
                const active = selectedFolderId === folder.id;
                return (
                  <div
                    key={folder.id}
                    className={`rounded-2xl border px-4 py-3 transition ${
                      active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSelectedFolderId(folder.id)}>
                        <FolderOpen className="mt-0.5 size-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{folder.name}</p>
                          <p className={`mt-1 text-xs ${active ? "text-white/70" : "text-slate-400"}`}>{folder.questionCount} 题</p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant={active ? "secondary" : "ghost"} className="size-8" onClick={() => openEditFolder(folder)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant={active ? "secondary" : "ghost"}
                          className="size-8 text-red-500 hover:text-red-600"
                          onClick={() => void removeFolder(folder)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl border-slate-200 bg-white">
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="按题干、材料或文件夹搜索"
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Select
                value={questionTypeFilter}
                onValueChange={(value: MockExamQuestionType | "all") => {
                  setQuestionTypeFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="题型筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部题型</SelectItem>
                  {(paperType === "subjective" ? ["subjective_case"] : objectiveQuestionTypes).map((value) => (
                    <SelectItem key={value} value={value}>
                      {questionTypeMeta[value].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setKeyword("");
                  setQuestionTypeFilter(paperType === "subjective" ? "subjective_case" : "all");
                  setSelectedFolderId("all");
                  setPage(1);
                }}
              >
                重置筛选
              </Button>
            </div>

            {selectedQuestions.length > 0 ? (
              <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3 text-sm text-blue-900">
                  <CheckCircle2 className="size-4" />
                  已选择 {selectedQuestions.length} 题，共 {selectedScore} 分，可直接生成一套机考试卷
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setSelectedItemIds([])}>
                    取消选择
                  </Button>
                  <Button onClick={openAssembleDialog}>生成试卷</Button>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-sm text-slate-500">
              <div>
                共 {totalItems} 道题目
                {selectedFolderId !== "all" ? "，当前仅显示所选文件夹内容" : ""}
              </div>
              <div className="inline-flex items-center gap-2 text-slate-600">
                <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll()} />
                <span>本页全选</span>
              </div>
            </div>

            {listLoading ? (
              <div className="rounded-2xl border border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
                <Loader2 className="mx-auto mb-3 size-5 animate-spin" />
                题目加载中...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-16 text-center">
                <FileText className="mx-auto size-8 text-slate-300" />
                <p className="mt-4 text-sm font-medium text-slate-700">当前筛选下还没有题目</p>
                <p className="mt-2 text-sm text-slate-500">可以先新建题目，或者下载模板后批量上传。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const selected = selectedItemIds.includes(item.id);
                  const optionCount = item.options.filter((option) => option.content).length;
                  const itemTitle = extractQuestionBankItemTitle(item);
                  const itemSummary = extractQuestionBankItemSummary(item);
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openEditItem(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openEditItem(item);
                        }
                      }}
                      className={`w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-5 text-left transition hover:border-slate-300 hover:bg-slate-50 ${
                        selected ? "ring-2 ring-blue-100" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5" onClick={(event) => event.stopPropagation()}>
                          <Checkbox checked={selected} onCheckedChange={() => toggleItem(item.id)} />
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                              <span className="rounded-full bg-slate-900 px-2.5 py-1 font-semibold text-white">{item.questionTypeLabel}</span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{item.score} 分</span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">{item.folderName}</span>
                              <span className="text-slate-400">#{item.sortOrder}</span>
                            </div>
                            <div className="shrink-0 text-xs text-slate-400">{item.updatedAt}</div>
                          </div>
                          <h3 className="mt-4 line-clamp-1 text-base font-semibold leading-7 text-slate-900">{itemTitle}</h3>
                          {itemSummary ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">{itemSummary}</p> : null}
                          <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500">
                            <div className="rounded-lg bg-slate-50 px-2 py-2">{item.questionType === "subjective_case" ? `${item.subjectiveSubQuestions.length} 问` : `${optionCount} 选项`}</div>
                            <div className="rounded-lg bg-slate-50 px-2 py-2">{item.analysis ? "有解析" : "无解析"}</div>
                            <div className="rounded-lg bg-slate-50 px-2 py-2">{item.questionType === "subjective_case" ? "主观题" : item.correctAnswerKeys.join("、") || "-"}</div>
                          </div>
                          <div className="mt-4 flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                            <Button variant="outline" size="sm" onClick={() => openEditItem(item)}>
                              <Pencil className="mr-2 size-4" />
                              编辑
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => void removeItem(item)}>
                              <Trash2 className="mr-2 size-4" />
                              删除
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <div>
                第 {page} / {totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  上一页
                </Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFolder ? "编辑文件夹" : "新建文件夹"}</DialogTitle>
            <DialogDescription>文件夹用于区分不同专题、阶段或题源，右侧题目区会直接联动这里的分类。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="folder-name">文件夹名称</Label>
            <Input id="folder-name" value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="例如：民法总则 / 主观题第一套" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void saveFolder()}>{editingFolder ? "保存修改" : "创建文件夹"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "编辑题目" : "新增题目"}</DialogTitle>
            <DialogDescription>当前为{paperTypeMeta[paperType].label}题库，题型、文件夹和作答结构会直接用于后续组卷。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>文件夹</Label>
              <Select value={itemForm.folderId} onValueChange={(value) => setItemForm((current) => ({ ...current, folderId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择文件夹" />
                </SelectTrigger>
                <SelectContent>
                  {folderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>题型</Label>
              <Select value={itemForm.questionType} onValueChange={(value: MockExamQuestionType) => handleQuestionTypeChange(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择题型" />
                </SelectTrigger>
                <SelectContent>
                  {(paperType === "subjective" ? ["subjective_case"] : objectiveQuestionTypes).map((value) => (
                    <SelectItem key={value} value={value}>
                      {questionTypeMeta[value].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>分值</Label>
              <Input type="number" min={1} value={itemForm.score} onChange={(event) => setItemForm((current) => ({ ...current, score: event.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>题干</Label>
            <Textarea value={itemForm.stem} onChange={(event) => setItemForm((current) => ({ ...current, stem: event.target.value }))} className="min-h-[120px]" placeholder="请输入题干内容" />
          </div>

          <div className="space-y-2">
            <Label>材料</Label>
            <Textarea
              value={itemForm.material}
              onChange={(event) => setItemForm((current) => ({ ...current, material: event.target.value }))}
              className="min-h-[100px]"
              placeholder="可选，适合案例背景或题组材料"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">题目微课 / 讲解音频</p>
                <p className="mt-1 text-xs text-slate-500">录题时上传一次，后续组卷、批改、学生端自动继承，不需要批改老师重复上传。</p>
              </div>
              <label className="inline-flex cursor-pointer items-center">
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void handleLessonAudioUpload(file);
                    event.currentTarget.value = "";
                  }}
                />
                <span className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:border-slate-400">
                  {lessonAudioUploading ? "上传中..." : itemForm.lessonAudioUrl ? "重新上传微课" : "上传微课"}
                </span>
              </label>
            </div>

            {itemForm.lessonAudioUrl ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>已关联题目微课{itemForm.lessonAudioDurationSeconds ? ` · ${itemForm.lessonAudioDurationSeconds} 秒` : ""}</span>
                  <button
                    type="button"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() =>
                      setItemForm((current) => ({
                        ...current,
                        lessonAudioUrl: "",
                        lessonAudioObjectKey: "",
                        lessonAudioDurationSeconds: 0,
                      }))
                    }
                  >
                    清空
                  </button>
                </div>
                <audio controls src={itemForm.lessonAudioUrl} className="mt-3 w-full" />
              </div>
            ) : null}
          </div>

          {itemForm.questionType === "subjective_case" ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>题组名称</Label>
                  <Input value={itemForm.sectionLabel} onChange={(event) => setItemForm((current) => ({ ...current, sectionLabel: event.target.value }))} placeholder="例如：一、案例分析题" />
                </div>
                <div className="space-y-2">
                  <Label>题组说明</Label>
                  <Input
                    value={itemForm.sectionDescription}
                    onChange={(event) => setItemForm((current) => ({ ...current, sectionDescription: event.target.value }))}
                    placeholder="例如：请结合民法原理分点作答"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">答题区设置</p>
                    <p className="text-xs text-slate-500">每个小问都会生成一个独立答题区，和主观题机考页面保持一致。</p>
                  </div>
                  <Button variant="outline" onClick={addSubQuestion}>
                    <Plus className="mr-2 size-4" />
                    添加小问
                  </Button>
                </div>

                {itemForm.subjectiveSubQuestions.map((subQuestion, index) => renderSubjectiveSubQuestionCard(subQuestion, index))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">选项与答案</p>
                <p className="mt-1 text-xs text-slate-500">{questionTypeMeta[itemForm.questionType].answerHint}</p>
              </div>
              <div className="grid gap-3">
                {itemForm.options.map((option) => (
                  <div key={option.key} className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
                    <button
                      type="button"
                      className={`inline-flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-medium ${
                        itemForm.correctAnswerKeys.includes(option.key) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500"
                      }`}
                      onClick={() => toggleCorrectAnswer(option.key)}
                    >
                      {option.key}
                    </button>
                    <Input value={option.content} onChange={(event) => updateFormOption(option.key, event.target.value)} placeholder={`请输入选项 ${option.key} 内容`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>解析</Label>
            <Textarea
              value={itemForm.analysis}
              onChange={(event) => setItemForm((current) => ({ ...current, analysis: event.target.value }))}
              className="min-h-[120px]"
              placeholder="可选，供后台查看或后续复盘使用"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void saveItem()} disabled={itemSaving}>
              {itemSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {editingItem ? "保存修改" : "加入题库"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-4xl">
          <div className="grid md:grid-cols-[320px_minmax(0,1fr)]">
            <div className="border-b border-slate-200 bg-slate-950 px-6 py-6 text-white md:border-b-0 md:border-r">
              <DialogHeader className="space-y-3 text-left">
                <DialogTitle className="text-xl font-semibold text-white">批量上传题库</DialogTitle>
                <DialogDescription className="text-sm leading-6 text-slate-300">
                  按模板整理后一次性导入到当前题库，适合整套主观题或客观题集中录入。
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-3">
                {[
                  { index: "01", title: "下载模板", detail: "模板内已带示例题、字段说明和标准填写格式。" },
                  { index: "02", title: "选择文件夹", detail: "导入后的题目会直接归到你选中的题库文件夹中。" },
                  { index: "03", title: "上传 Excel", detail: `仅支持 xls / xlsx，题型需与当前${paperTypeMeta[paperType].label}题库一致。` },
                ].map((step) => (
                  <div key={step.index} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xs font-semibold tracking-[0.2em] text-slate-200">
                        {step.index}
                      </span>
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-300">{step.detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4">
                <p className="text-sm font-medium text-emerald-100">建议先用模板录第一批题</p>
                <p className="mt-1 text-xs leading-5 text-emerald-50/80">这样字段顺序和题型结构最稳，不容易导入失败。</p>
                <Button variant="outline" className="mt-4 border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={handleDownloadTemplate}>
                  <Download className="size-4" />
                  下载模板
                </Button>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">导入位置</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">先确定题目要落到哪个文件夹，后续筛选和组卷会更清晰。</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">当前题库类型</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{paperTypeMeta[paperType].label}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label>导入文件夹</Label>
                    <Select value={importFolderId} onValueChange={setImportFolderId}>
                      <SelectTrigger className="h-11 rounded-2xl bg-white">
                        <SelectValue placeholder="选择文件夹" />
                      </SelectTrigger>
                      <SelectContent>
                        {folderOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Excel 文件</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">支持 `.xls`、`.xlsx`，系统会按当前题库类型校验题目结构。</p>
                    </div>
                    {importFile ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">已选文件</span>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <Input
                      type="file"
                      accept=".xls,.xlsx"
                      className="border-0 bg-transparent px-0 py-0 shadow-none file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setImportFile(event.target.files?.[0] ?? null)}
                    />
                    <p className="mt-3 text-xs text-slate-500">表格内的题型、分值和分问结构会按模板字段自动识别。</p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">目标文件夹</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{selectedImportFolderName || "暂未选择"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">上传文件</p>
                      <p className="mt-2 truncate text-sm font-medium text-slate-900">{importFile?.name || "暂未选择 Excel"}</p>
                      {importFileSizeLabel ? <p className="mt-1 text-xs text-slate-500">{importFileSizeLabel}</p> : null}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t border-slate-100 px-0 pt-5">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={() => void handleImport()} disabled={importing}>
                  {importing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                  开始导入
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assembleDialogOpen} onOpenChange={setAssembleDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>根据题库生成试卷</DialogTitle>
            <DialogDescription>当前会基于已选题目直接创建一套新的机考试卷，避免改动已有考试记录。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-400">题目数量</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedQuestions.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-400">总分</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedScore}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-400">试卷类型</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{paperTypeMeta[paperType].label}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-400">默认时长</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{paperTypeMeta[paperType].defaultDuration} 分钟</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>试卷标题</Label>
              <Input value={paperForm.title} onChange={(event) => setPaperForm((current) => ({ ...current, title: event.target.value }))} placeholder="例如：2026 客观题模考卷三" />
            </div>
            <div className="space-y-2">
              <Label>副标题</Label>
              <Input value={paperForm.subtitle} onChange={(event) => setPaperForm((current) => ({ ...current, subtitle: event.target.value }))} placeholder="可选，用于补充学科或专题说明" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>年份</Label>
              <Input type="number" value={paperForm.year} onChange={(event) => setPaperForm((current) => ({ ...current, year: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>期次</Label>
              <Input value={paperForm.phase} onChange={(event) => setPaperForm((current) => ({ ...current, phase: event.target.value }))} placeholder="例如：客观题卷一" />
            </div>
            <div className="space-y-2">
              <Label>考试时长(分钟)</Label>
              <Input type="number" min={1} value={paperForm.durationMinutes} onChange={(event) => setPaperForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>考试次数限制</Label>
              <Input type="number" min={0} value={paperForm.maxAttempts} onChange={(event) => setPaperForm((current) => ({ ...current, maxAttempts: event.target.value }))} placeholder="0 表示不限" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>开启人工批改</Label>
                  <p className="mt-1 text-xs text-slate-500">开启后主观题交卷进入批改台；关闭后直接显示答案解析。</p>
                </div>
                <Switch checked={paperForm.reviewEnabled} onCheckedChange={(checked) => setPaperForm((current) => ({ ...current, reviewEnabled: checked }))} />
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>需要权限开通</Label>
                  <p className="mt-1 text-xs text-slate-500">开启后用户必须单独获权才看得到这套试卷；关闭后试卷发布后默认开放。</p>
                </div>
                <Switch checked={paperForm.permissionRequired} onCheckedChange={(checked) => setPaperForm((current) => ({ ...current, permissionRequired: checked }))} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>及格线</Label>
            <Input type="number" min={0} value={paperForm.passScore} onChange={(event) => setPaperForm((current) => ({ ...current, passScore: event.target.value }))} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={paperForm.status} onValueChange={(value: AdminMockExamPaperStatus) => setPaperForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>排序值</Label>
              <Input type="number" min={1} value={paperForm.sortOrder} onChange={(event) => setPaperForm((current) => ({ ...current, sortOrder: event.target.value }))} placeholder="不填则自动排在最后" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>试卷说明</Label>
            <Textarea value={paperForm.description} onChange={(event) => setPaperForm((current) => ({ ...current, description: event.target.value }))} placeholder="可选，前台模考列表可直接读取这里的说明内容" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssembleDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void handleAssemblePaper()} disabled={assembling}>
              {assembling ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              生成试卷
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
