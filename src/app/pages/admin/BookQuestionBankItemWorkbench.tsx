import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  BookOpenText,
  Download,
  FileAudio,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
import {
  type BookQuestionBankItemSummary,
  type BookQuestionBankSubject,
  type MockExamQuestionType,
  type MockExamRubricPoint,
  type QuestionBankSubQuestion,
  mockApi,
} from "../../lib/mockData";

type ItemFilterQuestionType = MockExamQuestionType | "all";

type ObjectiveOptionForm = {
  id: string;
  key: string;
  content: string;
};

type RubricPointForm = {
  id: string;
  title: string;
  score: string;
  description: string;
  keywords: string;
};

type SubjectiveSubQuestionForm = {
  id: string;
  title: string;
  placeholder: string;
  abilityLabel: string;
  referenceAnswer: string;
  rubricGuidance: string;
  rubricPoints: RubricPointForm[];
};

type ItemFormState = {
  subjectId: string;
  title: string;
  questionType: MockExamQuestionType;
  questionNo: string;
  yearLabel: string;
  pageLabel: string;
  sortOrder: string;
  tags: string;
  status: boolean;
  score: string;
  sectionLabel: string;
  sectionDescription: string;
  material: string;
  stem: string;
  analysis: string;
  lessonAudioUrl: string;
  lessonAudioObjectKey: string;
  lessonAudioDurationSeconds: string;
  options: ObjectiveOptionForm[];
  correctAnswerKeys: string[];
  subjectiveSubQuestions: SubjectiveSubQuestionForm[];
};

interface BookQuestionBankItemWorkbenchProps {
  bookId: string;
  subjects: BookQuestionBankSubject[];
  onChanged?: () => void | Promise<void>;
}

const questionTypeOptions: Array<{ value: MockExamQuestionType; label: string }> = [
  { value: "single_choice", label: "单选题" },
  { value: "multiple_choice", label: "多选题" },
  { value: "uncertain_choice", label: "不定项选择题" },
  { value: "subjective_case", label: "主观题" },
];

const objectiveQuestionTypes = new Set<MockExamQuestionType>(["single_choice", "multiple_choice", "uncertain_choice"]);
const objectiveOptionKeys = ["A", "B", "C", "D", "E", "F"];

const defaultSectionLabelByType: Record<MockExamQuestionType, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  uncertain_choice: "不定项选择题",
  subjective_case: "主观题",
};

const createLocalId = (prefix: string) =>
  `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}`;

const paperTypeMeta = {
  objective: {
    label: "客观题",
    description: "单选、多选、不定项题目会直接写入独立题库结构。",
  },
  subjective: {
    label: "主观题",
    description: "分问、参考答案、采分点会一起导入到独立题库。",
  },
} as const;

const isObjectiveQuestionType = (questionType: MockExamQuestionType) => objectiveQuestionTypes.has(questionType);

const normalizeTagInput = (value: string) =>
  value
    .split(/[\n,，、；;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeCorrectAnswerKeys = (keys: string[]) =>
  Array.from(
    new Set(
      keys
        .map((item) => `${item ?? ""}`.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).sort();

const normalizeObjectiveOptions = (options: ObjectiveOptionForm[]) =>
  options
    .map((option, index) => ({
      key: (option.key || objectiveOptionKeys[index] || `OPT${index + 1}`).trim().toUpperCase(),
      content: option.content.trim(),
      sortOrder: index + 1,
    }))
    .filter((option) => option.key && option.content);

const formatDuration = (seconds: number | string) => {
  const total = Math.max(0, Number.parseInt(`${seconds ?? ""}`, 10) || 0);
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${`${remain}`.padStart(2, "0")}`;
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

const truncate = (value: string, maxLength = 84) => {
  const text = `${value ?? ""}`.trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

const createDefaultOption = (key = "A"): ObjectiveOptionForm => ({
  id: createLocalId("option"),
  key,
  content: "",
});

const createDefaultObjectiveOptions = () => [createDefaultOption("A"), createDefaultOption("B")];

const createDefaultRubricPoint = (): RubricPointForm => ({
  id: createLocalId("point"),
  title: "",
  score: "1",
  description: "",
  keywords: "",
});

const createDefaultSubQuestion = (index = 1): SubjectiveSubQuestionForm => ({
  id: createLocalId("sub"),
  title: `第${index}问`,
  placeholder: "请在此输入答案。",
  abilityLabel: "",
  referenceAnswer: "",
  rubricGuidance: "",
  rubricPoints: [createDefaultRubricPoint()],
});

const createEmptyItemForm = (subjectId = "", questionType: MockExamQuestionType = "subjective_case"): ItemFormState => ({
  subjectId,
  title: "",
  questionType,
  questionNo: "",
  yearLabel: "",
  pageLabel: "",
  sortOrder: "",
  tags: "",
  status: true,
  score: questionType === "subjective_case" ? "20" : "2",
  sectionLabel: defaultSectionLabelByType[questionType],
  sectionDescription: "",
  material: "",
  stem: "",
  analysis: "",
  lessonAudioUrl: "",
  lessonAudioObjectKey: "",
  lessonAudioDurationSeconds: "0",
  options: isObjectiveQuestionType(questionType) ? createDefaultObjectiveOptions() : [],
  correctAnswerKeys: [],
  subjectiveSubQuestions: questionType === "subjective_case" ? [createDefaultSubQuestion()] : [],
});

const mapRubricPointToForm = (point: MockExamRubricPoint, index: number): RubricPointForm => ({
  id: point.id || createLocalId(`point_${index + 1}`),
  title: point.title || "",
  score: `${point.score ?? 0}`,
  description: point.description || "",
  keywords: (point.keywords ?? []).join("，"),
});

const mapSubQuestionToForm = (subQuestion: QuestionBankSubQuestion, index: number): SubjectiveSubQuestionForm => ({
  id: subQuestion.id || createLocalId(`sub_${index + 1}`),
  title: subQuestion.title || `第${index + 1}问`,
  placeholder: subQuestion.placeholder || "请在此输入答案。",
  abilityLabel: subQuestion.abilityLabel || "",
  referenceAnswer: subQuestion.referenceAnswer || "",
  rubricGuidance: subQuestion.rubricGuidance || "",
  rubricPoints:
    subQuestion.rubricPoints && subQuestion.rubricPoints.length > 0
      ? subQuestion.rubricPoints.map((point, pointIndex) => mapRubricPointToForm(point, pointIndex))
      : [createDefaultRubricPoint()],
});

const mapItemToForm = (item: BookQuestionBankItemSummary): ItemFormState => ({
  subjectId: item.subjectId,
  title: item.customTitle || "",
  questionType: item.questionType,
  questionNo: item.questionNo || "",
  yearLabel: item.yearLabel || "",
  pageLabel: item.pageLabel || "",
  sortOrder: `${item.sortOrder ?? 0}`,
  tags: item.tags.join("，"),
  status: item.status,
  score: `${item.score ?? 0}`,
  sectionLabel: item.sectionLabel || defaultSectionLabelByType[item.questionType],
  sectionDescription: item.sectionDescription || "",
  material: item.material || "",
  stem: item.stem || "",
  analysis: item.analysis || "",
  lessonAudioUrl: item.lessonAudioUrl || "",
  lessonAudioObjectKey: item.lessonAudioObjectKey || "",
  lessonAudioDurationSeconds: `${item.lessonAudioDurationSeconds ?? 0}`,
  options:
    item.options && item.options.length > 0
      ? item.options.map((option, index) => ({
          id: option.id || createLocalId(`option_${index + 1}`),
          key: option.key,
          content: option.content,
        }))
      : isObjectiveQuestionType(item.questionType)
        ? createDefaultObjectiveOptions()
        : [],
  correctAnswerKeys: [...(item.correctAnswerKeys ?? [])],
  subjectiveSubQuestions:
    item.subjectiveSubQuestions && item.subjectiveSubQuestions.length > 0
      ? item.subjectiveSubQuestions.map((subQuestion, index) => mapSubQuestionToForm(subQuestion, index))
      : item.questionType === "subjective_case"
        ? [createDefaultSubQuestion()]
        : [],
});

const buildItemPayload = (form: ItemFormState) => ({
  subjectId: form.subjectId,
  title: form.title.trim(),
  questionType: form.questionType,
  stem: form.stem.trim(),
  material: form.material.trim(),
  analysis: form.analysis.trim(),
  score: form.score,
  correctAnswerKeys: isObjectiveQuestionType(form.questionType) ? normalizeCorrectAnswerKeys(form.correctAnswerKeys) : [],
  options: isObjectiveQuestionType(form.questionType)
    ? normalizeObjectiveOptions(form.options).map((option) => ({
        key: option.key,
        content: option.content,
        sortOrder: option.sortOrder,
      }))
    : [],
  sectionLabel: form.sectionLabel.trim() || defaultSectionLabelByType[form.questionType],
  sectionDescription: form.sectionDescription.trim(),
  subjectiveSubQuestions:
    form.questionType === "subjective_case"
      ? form.subjectiveSubQuestions.map((subQuestion, index) => ({
          id: subQuestion.id || `sub_${index + 1}`,
          title: subQuestion.title.trim() || `第${index + 1}问`,
          placeholder: subQuestion.placeholder.trim() || "请在此输入答案。",
          abilityLabel: subQuestion.abilityLabel.trim(),
          referenceAnswer: subQuestion.referenceAnswer.trim(),
          rubricGuidance: subQuestion.rubricGuidance.trim(),
          rubricPoints: subQuestion.rubricPoints
            .map((point, pointIndex) => ({
              id: point.id || `point_${pointIndex + 1}`,
              title: point.title.trim(),
              score: Math.max(0, Number.parseInt(point.score, 10) || 0),
              description: point.description.trim(),
              keywords: normalizeTagInput(point.keywords),
            }))
            .filter((point) => point.title),
        }))
      : [],
  lessonAudioUrl: form.lessonAudioUrl.trim(),
  lessonAudioObjectKey: form.lessonAudioObjectKey.trim(),
  lessonAudioDurationSeconds: form.lessonAudioDurationSeconds,
  questionNo: form.questionNo.trim(),
  yearLabel: form.yearLabel.trim(),
  pageLabel: form.pageLabel.trim(),
  tags: normalizeTagInput(form.tags),
  sortOrder: form.sortOrder,
  status: form.status,
});

export function BookQuestionBankItemWorkbench({ bookId, subjects, onChanged }: BookQuestionBankItemWorkbenchProps) {
  const lessonAudioInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importAudioFiles, setImportAudioFiles] = useState<File[]>([]);
  const [importSubjectId, setImportSubjectId] = useState("");
  const [importPaperType, setImportPaperType] = useState<"objective" | "subjective">("subjective");
  const [items, setItems] = useState<BookQuestionBankItemSummary[]>([]);
  const [editingItemId, setEditingItemId] = useState("");
  const [itemFormMode, setItemFormMode] = useState<"create" | "edit">("create");
  const [itemForm, setItemForm] = useState<ItemFormState>(createEmptyItemForm());
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [questionTypeFilter, setQuestionTypeFilter] = useState<ItemFilterQuestionType>("all");
  const [keywordInput, setKeywordInput] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const subjectNameMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject.name])), [subjects]);
  const importFileSizeLabel = useMemo(() => {
    if (!importFile) return "";
    if (importFile.size < 1024 * 1024) {
      return `${Math.max(1, Math.round(importFile.size / 1024))} KB`;
    }

    return `${(importFile.size / (1024 * 1024)).toFixed(1)} MB`;
  }, [importFile]);
  const importAudioSummary = useMemo(() => {
    if (importAudioFiles.length <= 0) {
      return {
        count: 0,
        totalSizeLabel: "",
      };
    }

    const totalBytes = importAudioFiles.reduce((sum, file) => sum + file.size, 0);
    return {
      count: importAudioFiles.length,
      totalSizeLabel: totalBytes < 1024 * 1024 ? `${Math.max(1, Math.round(totalBytes / 1024))} KB` : `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`,
    };
  }, [importAudioFiles]);
  const itemStats = useMemo(
    () => ({
      total: items.length,
      objective: items.filter((item) => item.questionType !== "subjective_case").length,
      subjective: items.filter((item) => item.questionType === "subjective_case").length,
      withAudio: items.filter((item) => item.hasLessonAudio).length,
    }),
    [items],
  );

  const beginCreateItem = () => {
    setItemFormMode("create");
    setEditingItemId("");
    setItemForm(createEmptyItemForm(subjects[0]?.id ?? ""));
  };

  const openImportDialog = () => {
    if (subjects.length <= 0) {
      toast.error("请先创建科目");
      return;
    }

    setImportFile(null);
    setImportAudioFiles([]);
    setImportSubjectId(subjectFilter !== "all" && subjects.some((subject) => subject.id === subjectFilter) ? subjectFilter : subjects[0]?.id ?? "");
    setImportPaperType(questionTypeFilter === "all" || questionTypeFilter === "subjective_case" ? "subjective" : "objective");
    setImportDialogOpen(true);
  };

  const beginEditItem = (item: BookQuestionBankItemSummary) => {
    setItemFormMode("edit");
    setEditingItemId(item.id);
    setItemForm(mapItemToForm(item));
  };

  const loadItems = async () => {
    if (!bookId) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const nextItems = await mockApi.getAdminBookQuestionBankItems(bookId, {
        subjectId: subjectFilter,
        questionType: questionTypeFilter,
        keyword: appliedKeyword,
      });
      setItems(nextItems);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载题目失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, [bookId, subjectFilter, questionTypeFilter, appliedKeyword]);

  useEffect(() => {
    beginCreateItem();
  }, [bookId]);

  useEffect(() => {
    if (subjectFilter !== "all" && !subjects.some((subject) => subject.id === subjectFilter)) {
      setSubjectFilter("all");
    }

    if (itemForm.subjectId && subjects.some((subject) => subject.id === itemForm.subjectId)) {
      return;
    }

    setItemForm((current) => ({
      ...current,
      subjectId: subjects[0]?.id ?? "",
    }));
  }, [subjects, itemForm.subjectId, subjectFilter]);

  const notifyChanged = async () => {
    await onChanged?.();
    await loadItems();
  };

  const switchQuestionType = (questionType: MockExamQuestionType) => {
    setItemForm((current) => ({
      ...current,
      questionType,
      score: current.score || (questionType === "subjective_case" ? "20" : "2"),
      sectionLabel: current.sectionLabel || defaultSectionLabelByType[questionType],
      options: isObjectiveQuestionType(questionType) ? (current.options.length > 0 ? current.options : createDefaultObjectiveOptions()) : [],
      correctAnswerKeys: isObjectiveQuestionType(questionType) ? current.correctAnswerKeys : [],
      subjectiveSubQuestions:
        questionType === "subjective_case"
          ? current.subjectiveSubQuestions.length > 0
            ? current.subjectiveSubQuestions
            : [createDefaultSubQuestion()]
          : [],
    }));
  };

  const updateObjectiveOption = (optionId: string, patch: Partial<ObjectiveOptionForm>) => {
    setItemForm((current) => {
      const nextOptions = current.options.map((option) => {
        if (option.id !== optionId) return option;
        const nextKey = patch.key === undefined ? option.key : patch.key.toUpperCase();
        return {
          ...option,
          ...patch,
          key: nextKey,
        };
      });

      const previousOption = current.options.find((option) => option.id === optionId);
      const nextOption = nextOptions.find((option) => option.id === optionId);
      const nextCorrectAnswerKeys =
        previousOption && nextOption && previousOption.key !== nextOption.key
          ? current.correctAnswerKeys.map((key) => (key === previousOption.key ? nextOption.key : key))
          : current.correctAnswerKeys;

      return {
        ...current,
        options: nextOptions,
        correctAnswerKeys: normalizeCorrectAnswerKeys(nextCorrectAnswerKeys),
      };
    });
  };

  const addObjectiveOption = () => {
    setItemForm((current) => {
      if (current.options.length >= objectiveOptionKeys.length) {
        toast.error(`最多支持 ${objectiveOptionKeys.length} 个选项`);
        return current;
      }

      const fallbackKey = objectiveOptionKeys[current.options.length] ?? `OPT${current.options.length + 1}`;
      return {
        ...current,
        options: [...current.options, createDefaultOption(fallbackKey)],
      };
    });
  };

  const removeObjectiveOption = (optionId: string) => {
    setItemForm((current) => {
      if (current.options.length <= 2) {
        toast.error("客观题至少保留两个选项");
        return current;
      }

      const target = current.options.find((option) => option.id === optionId);
      return {
        ...current,
        options: current.options.filter((option) => option.id !== optionId),
        correctAnswerKeys: current.correctAnswerKeys.filter((key) => key !== target?.key),
      };
    });
  };

  const toggleCorrectAnswer = (key: string) => {
    setItemForm((current) => {
      if (current.questionType === "single_choice") {
        return {
          ...current,
          correctAnswerKeys: [key],
        };
      }

      const nextKeys = current.correctAnswerKeys.includes(key)
        ? current.correctAnswerKeys.filter((item) => item !== key)
        : [...current.correctAnswerKeys, key];

      return {
        ...current,
        correctAnswerKeys: normalizeCorrectAnswerKeys(nextKeys),
      };
    });
  };

  const updateSubQuestion = (subQuestionId: string, patch: Partial<SubjectiveSubQuestionForm>) => {
    setItemForm((current) => ({
      ...current,
      subjectiveSubQuestions: current.subjectiveSubQuestions.map((subQuestion) =>
        subQuestion.id === subQuestionId
          ? {
              ...subQuestion,
              ...patch,
            }
          : subQuestion,
      ),
    }));
  };

  const addSubQuestion = () => {
    setItemForm((current) => ({
      ...current,
      subjectiveSubQuestions: [...current.subjectiveSubQuestions, createDefaultSubQuestion(current.subjectiveSubQuestions.length + 1)],
    }));
  };

  const removeSubQuestion = (subQuestionId: string) => {
    setItemForm((current) => {
      if (current.subjectiveSubQuestions.length <= 1) {
        toast.error("主观题至少保留一个分问");
        return current;
      }

      return {
        ...current,
        subjectiveSubQuestions: current.subjectiveSubQuestions.filter((subQuestion) => subQuestion.id !== subQuestionId),
      };
    });
  };

  const updateRubricPoint = (subQuestionId: string, pointId: string, patch: Partial<RubricPointForm>) => {
    setItemForm((current) => ({
      ...current,
      subjectiveSubQuestions: current.subjectiveSubQuestions.map((subQuestion) =>
        subQuestion.id === subQuestionId
          ? {
              ...subQuestion,
              rubricPoints: subQuestion.rubricPoints.map((point) =>
                point.id === pointId
                  ? {
                      ...point,
                      ...patch,
                    }
                  : point,
              ),
            }
          : subQuestion,
      ),
    }));
  };

  const addRubricPoint = (subQuestionId: string) => {
    setItemForm((current) => ({
      ...current,
      subjectiveSubQuestions: current.subjectiveSubQuestions.map((subQuestion) =>
        subQuestion.id === subQuestionId
          ? {
              ...subQuestion,
              rubricPoints: [...subQuestion.rubricPoints, createDefaultRubricPoint()],
            }
          : subQuestion,
      ),
    }));
  };

  const removeRubricPoint = (subQuestionId: string, pointId: string) => {
    setItemForm((current) => ({
      ...current,
      subjectiveSubQuestions: current.subjectiveSubQuestions.map((subQuestion) =>
        subQuestion.id === subQuestionId
          ? {
              ...subQuestion,
              rubricPoints:
                subQuestion.rubricPoints.length <= 1
                  ? subQuestion.rubricPoints
                  : subQuestion.rubricPoints.filter((point) => point.id !== pointId),
            }
          : subQuestion,
      ),
    }));
  };

  const clearLessonAudio = () => {
    setItemForm((current) => ({
      ...current,
      lessonAudioUrl: "",
      lessonAudioObjectKey: "",
      lessonAudioDurationSeconds: "0",
    }));
  };

  const uploadLessonAudio = async (file: File) => {
    try {
      setUploadingAudio(true);
      const uploaded = await mockApi.uploadBookQuestionBankLessonAudio(file);
      setItemForm((current) => ({
        ...current,
        lessonAudioUrl: uploaded.readableUrl || uploaded.url || "",
        lessonAudioObjectKey: uploaded.objectKey || "",
        lessonAudioDurationSeconds: `${uploaded.durationSeconds ?? 0}`,
      }));
      toast.success("题目微课音频已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传题目微课音频失败");
    } finally {
      setUploadingAudio(false);
      if (lessonAudioInputRef.current) {
        lessonAudioInputRef.current.value = "";
      }
    }
  };

  const saveItem = async () => {
    if (!bookId) {
      toast.error("请先选择题库产品");
      return;
    }

    if (!itemForm.subjectId) {
      toast.error("请先选择科目");
      return;
    }

    if (!itemForm.stem.trim()) {
      toast.error("题干不能为空");
      return;
    }

    if (isObjectiveQuestionType(itemForm.questionType)) {
      const normalizedOptions = normalizeObjectiveOptions(itemForm.options);
      if (normalizedOptions.length < 2) {
        toast.error("客观题至少填写两个有效选项");
        return;
      }

      const optionKeys = normalizedOptions.map((option) => option.key);
      if (new Set(optionKeys).size !== optionKeys.length) {
        toast.error("客观题选项键不能重复");
        return;
      }

      const normalizedAnswerKeys = normalizeCorrectAnswerKeys(itemForm.correctAnswerKeys);
      if (normalizedAnswerKeys.length <= 0) {
        toast.error("请至少设置一个正确答案");
        return;
      }

      if (itemForm.questionType === "single_choice" && normalizedAnswerKeys.length !== 1) {
        toast.error("单选题只能有一个正确答案");
        return;
      }
    }

    try {
      setSaving(true);
      const payload = buildItemPayload(itemForm);
      if (itemFormMode === "edit" && editingItemId) {
        const updated = await mockApi.updateAdminBookQuestionBankItem(bookId, editingItemId, payload);
        setItemForm(mapItemToForm(updated));
        toast.success("题目已更新");
      } else {
        const created = await mockApi.createAdminBookQuestionBankItem(bookId, payload);
        setItemFormMode("edit");
        setEditingItemId(created.id);
        setItemForm(mapItemToForm(created));
        toast.success("题目已创建");
      }

      await notifyChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存题目失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async () => {
    if (!bookId || !editingItemId) return;
    if (!window.confirm("确认删除当前题目吗？删除后无法恢复。")) return;

    try {
      setSaving(true);
      await mockApi.deleteAdminBookQuestionBankItem(bookId, editingItemId);
      toast.success("题目已删除");
      beginCreateItem();
      await notifyChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除题目失败");
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (!bookId) {
      toast.error("请先选择题库产品");
      return;
    }

    if (!importSubjectId) {
      toast.error("请选择导入科目");
      return;
    }

    if (!importFile) {
      toast.error("请先选择 Excel 文件");
      return;
    }

    try {
      setImporting(true);
      const result = await mockApi.importAdminBookQuestionBankItems(bookId, importFile, importSubjectId, importPaperType, importAudioFiles);
      toast.success(`已导入 ${result.createdCount} 道题目`);
      setImportDialogOpen(false);
      await notifyChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量导入失败");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await mockApi.downloadAdminBookQuestionBankTemplate(importPaperType);
      downloadBlob(blob, `独立题库上传模板-${paperTypeMeta[importPaperType].label}.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下载模板失败");
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <input
        ref={lessonAudioInputRef}
        type="file"
        accept=".mp3,.m4a,.wav,.aac,.ogg,audio/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void uploadLessonAudio(file);
        }}
      />

      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>独立题目录入</CardTitle>
          <CardDescription>客观题、主观题和题目微课都直接写入独立题库自己的表，不复用批改题库录题链路。</CardDescription>
        </div>
        <Button variant="outline" onClick={beginCreateItem} disabled={subjects.length <= 0}>
          <Plus className="size-4" />
          新建题目
        </Button>
        <Button variant="outline" onClick={openImportDialog} disabled={subjects.length <= 0}>
          <Upload className="size-4" />
          批量导入
        </Button>
      </CardHeader>

      <CardContent className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">当前筛选</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{itemStats.total}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">含微课</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{itemStats.withAudio}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">客观题</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{itemStats.objective}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">主观题</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{itemStats.subjective}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label>科目筛选</Label>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部科目</SelectItem>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>题型筛选</Label>
                <Select value={questionTypeFilter} onValueChange={(value) => setQuestionTypeFilter(value as ItemFilterQuestionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部题型</SelectItem>
                    {questionTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>关键词</Label>
                <div className="flex gap-2">
                  <Input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="搜标题、题干、题号、材料" />
                  <Button variant="outline" onClick={() => setAppliedKeyword(keywordInput.trim())}>
                    <Search className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setKeywordInput("");
                      setAppliedKeyword("");
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <ScrollArea className="h-[640px] pr-2">
            <div className="space-y-3">
              {loading ? (
                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                  <Loader2 className="mx-auto mb-3 size-5 animate-spin" />
                  题目加载中...
                </div>
              ) : null}

              {!loading &&
                items.map((item) => {
                  const selected = item.id === editingItemId && itemFormMode === "edit";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => beginEditItem(item)}
                      className={`w-full rounded-[22px] border p-4 text-left transition ${
                        selected ? "border-slate-900 bg-slate-900 text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={selected ? "bg-white/14 text-white" : "bg-slate-100 text-slate-700"}>
                          {subjectNameMap.get(item.subjectId) || item.subjectName}
                        </Badge>
                        <Badge className={selected ? "bg-white/14 text-white" : "bg-slate-100 text-slate-700"}>{item.questionTypeLabel}</Badge>
                        <Badge className={selected ? "bg-white/14 text-white" : item.status ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                          {item.status ? "上架" : "下架"}
                        </Badge>
                        {item.hasLessonAudio ? <Badge className={selected ? "bg-white/14 text-white" : "bg-amber-100 text-amber-700"}>有微课</Badge> : null}
                      </div>

                      <div className="mt-3 text-base font-semibold leading-6">{item.title}</div>
                      <div className={`mt-2 text-xs leading-5 ${selected ? "text-white/72" : "text-slate-500"}`}>{truncate(item.stem || item.material || "未填写题干")}</div>
                      <div className={`mt-2 flex flex-wrap gap-3 text-xs ${selected ? "text-white/72" : "text-slate-500"}`}>
                        <span>{item.questionNo || "未设题号"}</span>
                        <span>{item.score} 分</span>
                        {item.yearLabel ? <span>{item.yearLabel}</span> : null}
                        {item.pageLabel ? <span>{item.pageLabel}</span> : null}
                      </div>
                    </button>
                  );
                })}

              {!loading && items.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                  当前筛选下还没有题目。
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-5">
          {subjects.length <= 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
              <BookOpenText className="mx-auto size-8 text-slate-300" />
              <div className="mt-4 text-lg font-medium text-slate-900">请先创建科目</div>
              <p className="mt-2 text-sm leading-7 text-slate-500">独立题库的题目必须归属于某个科目，先在科目管理里把结构建好。</p>
            </div>
          ) : (
            <>
              <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FileText className="size-4 text-slate-500" />
                  基础信息
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label>所属科目</Label>
                    <Select value={itemForm.subjectId || undefined} onValueChange={(value) => setItemForm((current) => ({ ...current, subjectId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择科目" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>题型</Label>
                    <Select value={itemForm.questionType} onValueChange={(value: MockExamQuestionType) => switchQuestionType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {questionTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>显示标题</Label>
                    <Input value={itemForm.title} onChange={(event) => setItemForm((current) => ({ ...current, title: event.target.value }))} placeholder="例如：民法案例 1" />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label>题号</Label>
                    <Input value={itemForm.questionNo} onChange={(event) => setItemForm((current) => ({ ...current, questionNo: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>年份标签</Label>
                    <Input value={itemForm.yearLabel} onChange={(event) => setItemForm((current) => ({ ...current, yearLabel: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>页码标签</Label>
                    <Input value={itemForm.pageLabel} onChange={(event) => setItemForm((current) => ({ ...current, pageLabel: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>排序</Label>
                    <Input value={itemForm.sortOrder} onChange={(event) => setItemForm((current) => ({ ...current, sortOrder: event.target.value }))} />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label>分值</Label>
                    <Input value={itemForm.score} onChange={(event) => setItemForm((current) => ({ ...current, score: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>章节标签</Label>
                    <Input
                      value={itemForm.sectionLabel}
                      onChange={(event) => setItemForm((current) => ({ ...current, sectionLabel: event.target.value }))}
                      placeholder={defaultSectionLabelByType[itemForm.questionType]}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3">
                      <span className="text-sm text-slate-700">前台上架</span>
                      <Switch checked={itemForm.status} onCheckedChange={(checked) => setItemForm((current) => ({ ...current, status: checked }))} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>标签</Label>
                    <Input value={itemForm.tags} onChange={(event) => setItemForm((current) => ({ ...current, tags: event.target.value }))} placeholder="支持逗号、空格、换行分隔" />
                  </div>
                  <div className="space-y-2">
                    <Label>章节说明</Label>
                    <Input value={itemForm.sectionDescription} onChange={(event) => setItemForm((current) => ({ ...current, sectionDescription: event.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FileText className="size-4 text-slate-500" />
                  题干与解析
                </div>
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>案情材料</Label>
                    <Textarea value={itemForm.material} onChange={(event) => setItemForm((current) => ({ ...current, material: event.target.value }))} className="min-h-[140px]" />
                  </div>
                  <div className="space-y-2">
                    <Label>题干 / 问题</Label>
                    <Textarea value={itemForm.stem} onChange={(event) => setItemForm((current) => ({ ...current, stem: event.target.value }))} className="min-h-[180px]" />
                  </div>
                  <div className="space-y-2">
                    <Label>{itemForm.questionType === "subjective_case" ? "总解析" : "解析"}</Label>
                    <Textarea value={itemForm.analysis} onChange={(event) => setItemForm((current) => ({ ...current, analysis: event.target.value }))} className="min-h-[150px]" />
                  </div>
                </div>
              </div>

              {isObjectiveQuestionType(itemForm.questionType) ? (
                <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">客观题设置</div>
                      <div className="mt-1 text-sm text-slate-500">这里录入真实选项和正确答案，不再使用占位数据。</div>
                    </div>
                    <Button variant="outline" onClick={addObjectiveOption}>
                      <Plus className="size-4" />
                      添加选项
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {itemForm.options.map((option, index) => {
                      const currentKey = (option.key || objectiveOptionKeys[index] || "").toUpperCase();
                      const checked = itemForm.correctAnswerKeys.includes(currentKey);
                      return (
                        <div key={option.id} className="rounded-[20px] border border-slate-200 bg-white p-4">
                          <div className="grid gap-4 xl:grid-cols-[96px_minmax(0,1fr)_auto]">
                            <div className="space-y-2">
                              <Label>选项键</Label>
                              <Input value={option.key} onChange={(event) => updateObjectiveOption(option.id, { key: event.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>选项内容</Label>
                              <Input value={option.content} onChange={(event) => updateObjectiveOption(option.id, { content: event.target.value })} />
                            </div>
                            <div className="flex items-end gap-2">
                              <Button type="button" variant={checked ? "default" : "outline"} onClick={() => toggleCorrectAnswer(currentKey)}>
                                {itemForm.questionType === "single_choice" ? "设为正确" : checked ? "取消正确" : "标为正确"}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => removeObjectiveOption(option.id)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    当前正确答案：{itemForm.correctAnswerKeys.length > 0 ? itemForm.correctAnswerKeys.join("、") : "未设置"}
                  </div>
                </div>
              ) : (
                <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">主观题设置</div>
                      <div className="mt-1 text-sm text-slate-500">每个分问都可以单独录参考答案、批改说明和采分点。</div>
                    </div>
                    <Button variant="outline" onClick={addSubQuestion}>
                      <Plus className="size-4" />
                      添加分问
                    </Button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {itemForm.subjectiveSubQuestions.map((subQuestion, subQuestionIndex) => (
                      <div key={subQuestion.id} className="rounded-[24px] border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-slate-900">{subQuestion.title || `第${subQuestionIndex + 1}问`}</div>
                            <div className="mt-1 text-sm text-slate-500">这部分会直接决定用户端小问展示与参考答案结构。</div>
                          </div>
                          <Button variant="outline" onClick={() => removeSubQuestion(subQuestion.id)}>
                            <Trash2 className="size-4" />
                            删除分问
                          </Button>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>分问标题</Label>
                            <Input value={subQuestion.title} onChange={(event) => updateSubQuestion(subQuestion.id, { title: event.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>能力标签</Label>
                            <Input
                              value={subQuestion.abilityLabel}
                              onChange={(event) => updateSubQuestion(subQuestion.id, { abilityLabel: event.target.value })}
                              placeholder="例如：结论判断、法条适用"
                            />
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <Label>答题框占位文案</Label>
                          <Input value={subQuestion.placeholder} onChange={(event) => updateSubQuestion(subQuestion.id, { placeholder: event.target.value })} />
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <div className="space-y-2">
                            <Label>参考答案</Label>
                            <Textarea
                              value={subQuestion.referenceAnswer}
                              onChange={(event) => updateSubQuestion(subQuestion.id, { referenceAnswer: event.target.value })}
                              className="min-h-[140px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>批改说明</Label>
                            <Textarea
                              value={subQuestion.rubricGuidance}
                              onChange={(event) => updateSubQuestion(subQuestion.id, { rubricGuidance: event.target.value })}
                              className="min-h-[140px]"
                            />
                          </div>
                        </div>

                        <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">采分点</div>
                              <div className="mt-1 text-sm text-slate-500">这批采分点属于独立题库自身的数据结构。</div>
                            </div>
                            <Button variant="outline" onClick={() => addRubricPoint(subQuestion.id)}>
                              <Plus className="size-4" />
                              添加采分点
                            </Button>
                          </div>

                          <div className="mt-4 space-y-3">
                            {subQuestion.rubricPoints.map((point, pointIndex) => (
                              <div key={point.id} className="rounded-[18px] border border-slate-200 bg-white p-4">
                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_120px_auto]">
                                  <div className="space-y-2">
                                    <Label>采分点标题</Label>
                                    <Input
                                      value={point.title}
                                      onChange={(event) => updateRubricPoint(subQuestion.id, point.id, { title: event.target.value })}
                                      placeholder={`采分点 ${pointIndex + 1}`}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>分值</Label>
                                    <Input value={point.score} onChange={(event) => updateRubricPoint(subQuestion.id, point.id, { score: event.target.value })} />
                                  </div>
                                  <div className="flex items-end">
                                    <Button variant="outline" onClick={() => removeRubricPoint(subQuestion.id, point.id)}>
                                      <Trash2 className="size-4" />
                                      删除
                                    </Button>
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>关键词</Label>
                                    <Input
                                      value={point.keywords}
                                      onChange={(event) => updateRubricPoint(subQuestion.id, point.id, { keywords: event.target.value })}
                                      placeholder="支持逗号、空格、换行分隔"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>说明</Label>
                                    <Input
                                      value={point.description}
                                      onChange={(event) => updateRubricPoint(subQuestion.id, point.id, { description: event.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FileAudio className="size-4 text-slate-500" />
                  微课音频
                </div>
                <div className="mt-1 text-sm text-slate-500">题目音频走独立题库自己的上传接口，不和批改题库共用。</div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="outline" disabled={uploadingAudio} onClick={() => lessonAudioInputRef.current?.click()}>
                    {uploadingAudio ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
                    上传微课音频
                  </Button>
                  {itemForm.lessonAudioUrl ? (
                    <Button variant="outline" onClick={clearLessonAudio}>
                      <X className="size-4" />
                      清空音频
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>音频地址</Label>
                    <Input value={itemForm.lessonAudioUrl} onChange={(event) => setItemForm((current) => ({ ...current, lessonAudioUrl: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>对象 Key</Label>
                    <Input
                      value={itemForm.lessonAudioObjectKey}
                      onChange={(event) => setItemForm((current) => ({ ...current, lessonAudioObjectKey: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>时长</Label>
                    <Input
                      value={itemForm.lessonAudioDurationSeconds}
                      onChange={(event) => setItemForm((current) => ({ ...current, lessonAudioDurationSeconds: event.target.value }))}
                    />
                  </div>
                </div>

                {itemForm.lessonAudioUrl ? (
                  <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <span>已绑定题目微课</span>
                      <Badge className="bg-amber-100 text-amber-700">{formatDuration(itemForm.lessonAudioDurationSeconds)}</Badge>
                    </div>
                    <audio controls src={itemForm.lessonAudioUrl} className="w-full" />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button disabled={saving} onClick={() => void saveItem()}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                  保存题目
                </Button>
                {itemFormMode === "edit" && editingItemId ? (
                  <Button variant="outline" onClick={deleteItem} disabled={saving}>
                    <Trash2 className="size-4" />
                    删除题目
                  </Button>
                ) : null}
                <Button variant="outline" onClick={beginCreateItem}>
                  重置
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-4xl">
          <div className="grid md:grid-cols-[320px_minmax(0,1fr)]">
            <div className="border-b border-slate-200 bg-slate-950 px-6 py-6 text-white md:border-b-0 md:border-r">
              <DialogHeader className="space-y-3 text-left">
                <DialogTitle className="text-xl font-semibold text-white">批量导入独立题库</DialogTitle>
                <DialogDescription className="text-sm leading-6 text-slate-300">
                  Excel 只会写入当前独立题库和所选科目，不会串到批改题库的数据表里。
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-3">
                {[
                  { index: "01", title: "选择题型模板", detail: "客观题和主观题模板分开下载，导入时也会按当前题型校验。" },
                  { index: "02", title: "选择归属科目", detail: "导入后的题目会直接挂到你选中的独立题库科目下面。" },
                  { index: "03", title: "上传 Excel", detail: "支持 xls / xlsx，模板内自带示例行和字段说明。" },
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
                <p className="text-sm font-medium text-emerald-100">建议先用模板导第一批</p>
                <p className="mt-1 text-xs leading-5 text-emerald-50/80">这样字段顺序、题型和分问结构最稳定，后续批量导题也更省事。</p>
                <Button
                  variant="outline"
                  className="mt-4 border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => void handleDownloadTemplate()}
                >
                  <Download className="size-4" />
                  下载模板
                </Button>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>导入题型</Label>
                      <Select value={importPaperType} onValueChange={(value) => setImportPaperType(value as "objective" | "subjective")}>
                        <SelectTrigger className="h-11 rounded-2xl bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="objective">{paperTypeMeta.objective.label}</SelectItem>
                          <SelectItem value="subjective">{paperTypeMeta.subjective.label}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs leading-5 text-slate-500">{paperTypeMeta[importPaperType].description}</p>
                    </div>

                    <div className="space-y-2">
                      <Label>归属科目</Label>
                      <Select value={importSubjectId} onValueChange={setImportSubjectId}>
                        <SelectTrigger className="h-11 rounded-2xl bg-white">
                          <SelectValue placeholder="选择科目" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Excel 文件</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">支持 `.xls`、`.xlsx`，系统会按独立题库模板结构进行校验。</p>
                    </div>
                    {importFile ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">已选文件</span> : null}
                  </div>

                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <Input
                      type="file"
                      accept=".xls,.xlsx"
                      className="border-0 bg-transparent px-0 py-0 shadow-none file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setImportFile(event.target.files?.[0] ?? null)}
                    />
                    <p className="mt-3 text-xs text-slate-500">题型、分值、分问、采分点会按模板字段自动识别。</p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">归属科目</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{subjectNameMap.get(importSubjectId) || "暂未选择"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">上传文件</p>
                      <p className="mt-2 truncate text-sm font-medium text-slate-900">{importFile?.name || "暂未选择 Excel"}</p>
                      {importFileSizeLabel ? <p className="mt-1 text-xs text-slate-500">{importFileSizeLabel}</p> : null}
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">配对音频</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">可选。可一次上传多条音频，系统会先按文件名尝试匹配，匹配不上时再按导入顺序一一对应。</p>
                    </div>
                    {importAudioSummary.count > 0 ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">已选 {importAudioSummary.count} 条</span>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <Input
                      type="file"
                      accept=".mp3,.m4a,.wav,.aac,.ogg,audio/*"
                      multiple
                      className="border-0 bg-transparent px-0 py-0 shadow-none file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setImportAudioFiles(Array.from(event.target.files ?? []))}
                    />
                    <p className="mt-3 text-xs text-slate-500">如果音频文件名本身能和题目标题接近，系统会优先自动匹配；否则会按顺序对应。</p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">音频数量</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{importAudioSummary.count > 0 ? `${importAudioSummary.count} 条` : "未上传音频"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">音频总大小</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{importAudioSummary.totalSizeLabel || "—"}</p>
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
    </Card>
  );
}
