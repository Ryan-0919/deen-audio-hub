import { ArrowLeft, FilePlus2, FolderOpen, ImagePlus, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import {
  type AdminMockExamPaperDetail,
  type AdminMockExamPaperPayload,
  type AdminMockExamPaperQuestion,
  type AdminMockExamPaperStatus,
  type AdminMockExamPaperType,
  type MockExamQuestionType,
  type QuestionBankFolder,
  type QuestionBankItem,
  mockApi,
} from "../../lib/mockData";

const QUESTION_PAGE_SIZE = 12;
const objectiveQuestionTypes: MockExamQuestionType[] = ["single_choice", "multiple_choice", "uncertain_choice"];

const paperTypeMeta: Record<AdminMockExamPaperType, { label: string; badgeClassName: string; defaultDuration: number; defaultPhase: string }> = {
  objective: {
    label: "客观题",
    badgeClassName: "bg-blue-50 text-blue-700",
    defaultDuration: 90,
    defaultPhase: "客观题",
  },
  subjective: {
    label: "主观题",
    badgeClassName: "bg-violet-50 text-violet-700",
    defaultDuration: 240,
    defaultPhase: "主观题",
  },
};

const paperStatusMeta: Record<AdminMockExamPaperStatus, { label: string; badgeClassName: string }> = {
  draft: { label: "草稿", badgeClassName: "bg-slate-100 text-slate-700" },
  published: { label: "已发布", badgeClassName: "bg-emerald-100 text-emerald-700" },
};

const questionTypeMeta: Record<MockExamQuestionType, { label: string }> = {
  single_choice: { label: "单选题" },
  multiple_choice: { label: "多选题" },
  uncertain_choice: { label: "不定项选择题" },
  subjective_case: { label: "主观题" },
};

type PaperFormState = {
  title: string;
  subtitle: string;
  code: string;
  coverUrl: string;
  coverObjectKey: string;
  year: string;
  phase: string;
  paperType: AdminMockExamPaperType;
  durationMinutes: string;
  maxAttempts: string;
  reviewEnabled: boolean;
  permissionRequired: boolean;
  passScore: string;
  description: string;
  status: AdminMockExamPaperStatus;
  sortOrder: string;
};

const createEmptyPaperForm = (paperType: AdminMockExamPaperType = "objective"): PaperFormState => ({
  title: "",
  subtitle: "",
  code: "",
  coverUrl: paperType === "subjective" ? "/mock-exam/default-subjective-cover.png" : "/mock-exam/default-objective-cover.png",
  coverObjectKey: "",
  year: `${new Date().getFullYear()}`,
  phase: paperTypeMeta[paperType].defaultPhase,
  paperType,
  durationMinutes: `${paperTypeMeta[paperType].defaultDuration}`,
  maxAttempts: "0",
  reviewEnabled: paperType === "subjective",
  permissionRequired: false,
  passScore: "0",
  description: "",
  status: "draft",
  sortOrder: "",
});

const mapPaperDetailToForm = (paper: AdminMockExamPaperDetail): PaperFormState => ({
  title: paper.title,
  subtitle: paper.subtitle,
  code: paper.code,
  coverUrl: paper.coverUrl,
  coverObjectKey: paper.coverObjectKey,
  year: paper.year > 0 ? `${paper.year}` : "",
  phase: paper.phase,
  paperType: paper.paperType,
  durationMinutes: `${paper.durationMinutes}`,
  maxAttempts: `${paper.maxAttempts ?? 0}`,
  reviewEnabled: paper.reviewEnabled,
  permissionRequired: paper.permissionRequired,
  passScore: `${paper.passScore}`,
  description: paper.description,
  status: paper.status,
  sortOrder: paper.sortOrder > 0 ? `${paper.sortOrder}` : "",
});

const buildPaperPayload = (form: PaperFormState): AdminMockExamPaperPayload => ({
  title: form.title.trim(),
  subtitle: form.subtitle.trim() || undefined,
  code: form.code.trim() || undefined,
  coverUrl: form.coverUrl.trim() || undefined,
  coverObjectKey: form.coverObjectKey.trim() || undefined,
  year: form.year.trim() || undefined,
  phase: form.phase.trim() || undefined,
  paperType: form.paperType,
  durationMinutes: form.durationMinutes.trim() || undefined,
  maxAttempts: form.maxAttempts.trim() || undefined,
  reviewEnabled: form.reviewEnabled,
  permissionRequired: form.permissionRequired,
  passScore: form.passScore.trim() || undefined,
  description: form.description.trim() || undefined,
  status: form.status,
  sortOrder: form.sortOrder.trim() || undefined,
});

const truncate = (text: string, maxLength = 160) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

const buildQuestionAnswerSummary = (question: AdminMockExamPaperQuestion) => {
  if (question.questionType === "subjective_case") {
    return `${question.subjectiveSubQuestions.length || 1} 个答题区`;
  }

  return question.correctAnswerKeys.join(" / ") || "-";
};

export function MockExamPaperEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { paperId } = useParams<{ paperId: string }>();
  const isEdit = Boolean(paperId);

  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [paper, setPaper] = useState<AdminMockExamPaperDetail | null>(null);
  const [form, setForm] = useState<PaperFormState>(createEmptyPaperForm);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [folders, setFolders] = useState<QuestionBankFolder[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [questionTypeFilter, setQuestionTypeFilter] = useState<MockExamQuestionType | "all">("all");
  const [bankItems, setBankItems] = useState<QuestionBankItem[]>([]);
  const [selectedBankMap, setSelectedBankMap] = useState<Record<string, QuestionBankItem>>({});
  const [questionPage, setQuestionPage] = useState(1);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [questionTotalPages, setQuestionTotalPages] = useState(1);
  const [addingQuestions, setAddingQuestions] = useState(false);
  const deferredKeyword = useDeferredValue(keyword.trim());

  const currentPaperType = paper?.paperType ?? form.paperType;
  const dialogQuestionTypeOptions: MockExamQuestionType[] = currentPaperType === "subjective" ? ["subjective_case"] : objectiveQuestionTypes;
  const selectedBankItems = useMemo(() => Object.values(selectedBankMap), [selectedBankMap]);
  const selectedBankIds = useMemo(() => Object.keys(selectedBankMap), [selectedBankMap]);
  const selectedBankScore = useMemo(() => selectedBankItems.reduce((sum, item) => sum + item.score, 0), [selectedBankItems]);
  const allCurrentPageSelected = bankItems.length > 0 && bankItems.every((item) => Boolean(selectedBankMap[item.id]));

  useEffect(() => {
    if (!isEdit || !paperId) {
      setLoading(false);
      setPaper(null);
      setForm(createEmptyPaperForm());
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const detail = await mockApi.getAdminMockExamPaperDetail(paperId);
        setPaper(detail);
        setForm(mapPaperDetailToForm(detail));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载试卷详情失败");
        navigate("/admin/mock-exams/papers", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isEdit, navigate, paperId]);

  useEffect(() => {
    if (!questionDialogOpen) {
      return;
    }

    const loadFolders = async () => {
      setFolderLoading(true);
      try {
        const nextFolders = await mockApi.getQuestionBankFolders(currentPaperType);
        setFolders(nextFolders);
        setSelectedFolderId((current) => (current === "all" || nextFolders.some((folder) => folder.id === current) ? current : "all"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载题库文件夹失败");
      } finally {
        setFolderLoading(false);
      }
    };

    void loadFolders();
  }, [currentPaperType, questionDialogOpen]);

  useEffect(() => {
    if (!questionDialogOpen) {
      return;
    }

    const loadItems = async () => {
      setBankLoading(true);
      try {
        const result = await mockApi.getQuestionBankItems({
          paperType: currentPaperType,
          folderId: selectedFolderId === "all" ? undefined : selectedFolderId,
          keyword: deferredKeyword || undefined,
          questionType: questionTypeFilter,
          page: questionPage,
          pageSize: QUESTION_PAGE_SIZE,
        });

        setBankItems(result.items);
        setQuestionTotal(result.total);
        setQuestionTotalPages(result.totalPages);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载题库题目失败");
      } finally {
        setBankLoading(false);
      }
    };

    void loadItems();
  }, [currentPaperType, deferredKeyword, questionDialogOpen, questionPage, questionTypeFilter, selectedFolderId]);

  useEffect(() => {
    if (!paper?.id) {
      return;
    }

    if (!(location.state as { autoOpenQuestionDialog?: boolean } | null)?.autoOpenQuestionDialog) {
      return;
    }

    resetQuestionDialogState();
    setQuestionDialogOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [currentPaperType, location.pathname, location.state, navigate, paper?.id]);

  const updateForm = (key: keyof PaperFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const getDefaultCoverByType = (paperType: AdminMockExamPaperType) =>
    paperType === "subjective" ? "/mock-exam/default-subjective-cover.png" : "/mock-exam/default-objective-cover.png";

  const resetQuestionDialogState = () => {
    setKeyword("");
    setSelectedFolderId("all");
    setQuestionTypeFilter(currentPaperType === "subjective" ? "subjective_case" : "all");
    setQuestionPage(1);
    setSelectedBankMap({});
  };

  const handlePaperTypeChange = (value: AdminMockExamPaperType) => {
    setForm((current) => {
      const previousType = current.paperType;
      const previousMeta = paperTypeMeta[previousType];
      const nextMeta = paperTypeMeta[value];

      return {
        ...current,
        paperType: value,
        coverUrl:
          !current.coverObjectKey && (!current.coverUrl || current.coverUrl.startsWith("/mock-exam/default-"))
            ? getDefaultCoverByType(value)
            : current.coverUrl,
        durationMinutes:
          !current.durationMinutes || current.durationMinutes === `${previousMeta.defaultDuration}` ? `${nextMeta.defaultDuration}` : current.durationMinutes,
        phase: !current.phase || current.phase === previousMeta.defaultPhase ? nextMeta.defaultPhase : current.phase,
      };
    });
  };

  const handleCoverUpload = async (file?: File | null) => {
    if (!file) return;

    try {
      setCoverUploading(true);
      const uploaded = await mockApi.uploadMockExamPaperCover(file);
      setForm((current) => ({
        ...current,
        coverUrl: uploaded.readableUrl ?? uploaded.url,
        coverObjectKey: uploaded.objectKey,
      }));
      toast.success("试卷封面上传成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传试卷封面失败");
    } finally {
      setCoverUploading(false);
    }
  };

  const validateBeforeSave = () => {
    if (!form.title.trim()) {
      toast.error("请先填写试卷标题，再加入题目。");
      titleInputRef.current?.focus();
      return false;
    }

    return true;
  };

  const handleSave = async (options?: {
    autoOpenQuestionDialogAfterCreate?: boolean;
    successMessage?: string;
    forceDraftStatus?: boolean;
  }) => {
    if (!validateBeforeSave()) {
      return null;
    }

    setSaving(true);
    try {
      const payload = buildPaperPayload({
        ...form,
        status: options?.forceDraftStatus ? "draft" : form.status,
      });
      const result = isEdit && paperId ? await mockApi.updateAdminMockExamPaper(paperId, payload) : await mockApi.createAdminMockExamPaper(payload);
      setPaper(result);
      setForm(mapPaperDetailToForm(result));
      toast.success(options?.successMessage ?? (isEdit ? "试卷已更新" : "试卷已创建"));

      if (!isEdit) {
        navigate(`/admin/mock-exams/papers/${result.id}/edit`, {
          replace: true,
          state: options?.autoOpenQuestionDialogAfterCreate ? { autoOpenQuestionDialog: true } : undefined,
        });
      }

      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存试卷失败");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openQuestionDialog = async () => {
    if (saving || coverUploading) {
      return;
    }

    if (!paper?.id) {
      const result = await handleSave({
        autoOpenQuestionDialogAfterCreate: true,
        forceDraftStatus: true,
        successMessage: "试卷已创建，正在打开题库",
      });
      if (!result?.id) {
        return;
      }
      return;
    }

    resetQuestionDialogState();
    setQuestionDialogOpen(true);
  };

  const toggleBankItem = (item: QuestionBankItem) => {
    setSelectedBankMap((current) => {
      if (current[item.id]) {
        const next = { ...current };
        delete next[item.id];
        return next;
      }

      return {
        ...current,
        [item.id]: item,
      };
    });
  };

  const toggleSelectCurrentPage = () => {
    setSelectedBankMap((current) => {
      const next = { ...current };
      if (allCurrentPageSelected) {
        bankItems.forEach((item) => {
          delete next[item.id];
        });
        return next;
      }

      bankItems.forEach((item) => {
        next[item.id] = item;
      });
      return next;
    });
  };

  const handleAddQuestions = async () => {
    if (!paper?.id || selectedBankIds.length === 0) {
      return;
    }

    setAddingQuestions(true);
    try {
      const detail = await mockApi.addAdminMockExamPaperQuestionsFromBank(paper.id, selectedBankIds);
      setPaper(detail);
      setForm(mapPaperDetailToForm(detail));
      setSelectedBankMap({});
      setQuestionDialogOpen(false);
      toast.success(`已加入 ${selectedBankIds.length} 道题目`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加入题目失败");
    } finally {
      setAddingQuestions(false);
    }
  };

  const handleRemoveQuestion = async (questionId: string) => {
    if (!paper?.id) {
      return;
    }

    try {
      const detail = await mockApi.removeAdminMockExamPaperQuestion(paper.id, questionId);
      setPaper(detail);
      setForm(mapPaperDetailToForm(detail));
      toast.success("题目已移除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除题目失败");
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-slate-500">
        <Loader2 className="mr-2 inline-flex size-4 animate-spin" />
        试卷信息加载中...
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-[1560px] space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-8 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Button asChild variant="ghost" className="h-auto px-0 text-slate-500 hover:bg-transparent hover:text-slate-900">
              <Link to="/admin/mock-exams/papers">
                <ArrowLeft className="size-4" />
                返回试卷列表
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{isEdit ? "编辑机考试卷" : "新建机考试卷"}</h1>
              <Badge className={paperTypeMeta[currentPaperType].badgeClassName}>{paperTypeMeta[currentPaperType].label}</Badge>
              <Badge className={paperStatusMeta[paper?.status ?? form.status].badgeClassName}>{paperStatusMeta[paper?.status ?? form.status].label}</Badge>
            </div>
            <p className="text-sm text-slate-500">
              填写试卷基本信息后可直接从题库加题；首次加题时系统会自动先保存试卷。试卷后续可直接修改，已有考试记录会保留当时的试卷快照，不受后续改动影响。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => void openQuestionDialog()} disabled={saving || coverUploading}>
              <Plus className="size-4" />
              从题库加题
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || coverUploading}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              保存试卷
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="rounded-3xl border-slate-200 bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-semibold text-slate-900">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleCoverUpload(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />

              <div className="space-y-2">
                <Label>试卷封面</Label>
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="group relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-[26px] border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-slate-400 hover:bg-white"
                >
                  <img src={form.coverUrl} alt="试卷封面" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04)_0%,rgba(15,23,42,0.2)_100%)]" />
                  <div className="absolute right-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                    {coverUploading ? "上传中..." : form.coverObjectKey ? "更换封面" : "上传封面"}
                  </div>
                  {!form.coverObjectKey ? (
                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-5 py-4 text-left text-white">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-white/18 backdrop-blur-sm">
                        <ImagePlus className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">上传机考试卷封面</p>
                        <p className="mt-1 text-xs text-white/78">不上传则使用系统默认封面</p>
                      </div>
                    </div>
                  ) : null}
                </button>
              </div>

              <div className="space-y-2">
                <Label>试卷标题</Label>
                <Input
                  ref={titleInputRef}
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="例如：2026 年客观题模拟卷一"
                />
              </div>

              <div className="space-y-2">
                <Label>副标题</Label>
                <Input value={form.subtitle} onChange={(event) => updateForm("subtitle", event.target.value)} placeholder="用于补充说明本套试卷来源或特点" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>试卷编号</Label>
                  <Input value={form.code} onChange={(event) => updateForm("code", event.target.value)} placeholder="留空则自动生成" />
                </div>
                <div className="space-y-2">
                  <Label>年份</Label>
                  <Input value={form.year} onChange={(event) => updateForm("year", event.target.value)} placeholder="2026" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>试卷类型</Label>
                  <Select value={form.paperType} onValueChange={(value: AdminMockExamPaperType) => handlePaperTypeChange(value)} disabled={Boolean(paper?.questions.length)}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择试卷类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="objective">客观题</SelectItem>
                      <SelectItem value="subjective">主观题</SelectItem>
                    </SelectContent>
                  </Select>
                  {paper?.questions.length ? <p className="text-xs text-slate-400">已有题目时不允许切换主客观类型。</p> : null}
                </div>
                <div className="space-y-2">
                  <Label>试卷状态</Label>
                  <Select value={form.status} onValueChange={(value: AdminMockExamPaperStatus) => setForm((current) => ({ ...current, status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="published">已发布</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>阶段名称</Label>
                  <Input value={form.phase} onChange={(event) => updateForm("phase", event.target.value)} placeholder="客观题 / 主观题 / 卷一" />
                </div>
                <div className="space-y-2">
                  <Label>排序值</Label>
                  <Input value={form.sortOrder} onChange={(event) => updateForm("sortOrder", event.target.value)} placeholder="数值越小越靠前" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>考试时长（分钟）</Label>
                  <Input value={form.durationMinutes} onChange={(event) => updateForm("durationMinutes", event.target.value)} placeholder="90" />
                </div>
                <div className="space-y-2">
                  <Label>考试次数限制</Label>
                  <Input value={form.maxAttempts} onChange={(event) => updateForm("maxAttempts", event.target.value)} placeholder="0 表示不限" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>开启人工批改</Label>
                      <p className="mt-1 text-xs text-slate-500">开启后主观题交卷进入批改台；关闭后直接显示答案解析。</p>
                    </div>
                    <Switch checked={form.reviewEnabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, reviewEnabled: checked }))} />
                  </div>
                </div>
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>需要权限开通</Label>
                      <p className="mt-1 text-xs text-slate-500">开启后用户必须单独获得这张试卷权限；关闭后已发布试卷默认所有用户可见。</p>
                    </div>
                    <Switch checked={form.permissionRequired} onCheckedChange={(checked) => setForm((current) => ({ ...current, permissionRequired: checked }))} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>及格线</Label>
                <Input value={form.passScore} onChange={(event) => updateForm("passScore", event.target.value)} placeholder="题目加入后可按总分调整" />
              </div>

              <div className="space-y-2">
                <Label>试卷说明</Label>
                <Textarea
                  className="min-h-[180px]"
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="这里填写考试说明、命题范围或提醒。"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">当前题量</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{paper?.questionCount ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">当前总分</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{paper?.totalScore ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-sm text-blue-700">及格线</p>
                <p className="mt-2 text-3xl font-semibold text-blue-800">{paper?.passScore ?? Number(form.passScore || 0)}</p>
              </div>
              <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
                <p className="text-sm text-violet-700">更新时间</p>
                <p className="mt-2 text-sm font-medium text-violet-900">{paper?.updatedAt ?? "尚未保存"}</p>
              </div>
            </div>

            <Card className="rounded-3xl border-slate-200 bg-white">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">题目列表</CardTitle>
                  <p className="mt-2 text-sm text-slate-500">试卷中的题目按加入顺序排列，支持继续从题库加题或移除已有题目。</p>
                </div>
                <Button onClick={() => void openQuestionDialog()} disabled={saving || coverUploading}>
                  <FilePlus2 className="size-4" />
                  加入题目
                </Button>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                {!paper?.id ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center">
                    <p className="text-sm font-medium text-slate-700">先填写基本信息，再加入题目</p>
                    <p className="mt-2 text-sm text-slate-500">点击右上角“加入题目”后，系统会自动先保存试卷，再打开题库供你选题。</p>
                  </div>
                ) : paper.questions.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center">
                    <p className="text-sm font-medium text-slate-700">这套试卷还没有题目</p>
                    <p className="mt-2 text-sm text-slate-500">点击右上角“加入题目”，从 {paperTypeMeta[currentPaperType].label}题库中批量选择内容。</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {paper.sections.map((section) => (
                        <Badge key={section.type} className="bg-slate-100 text-slate-700">
                          {section.label} {section.count} 题 / {section.totalScore} 分
                        </Badge>
                      ))}
                    </div>

                    {paper.questions.map((question) => (
                      <div key={question.id} className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1 space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="bg-slate-900 text-white">第 {question.sortOrder} 题</Badge>
                              <Badge className="bg-white text-slate-700">{question.questionTypeLabel}</Badge>
                              <Badge className="bg-white text-slate-700">{question.score} 分</Badge>
                              {question.sourceFolderName ? <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-500">题库：{question.sourceFolderName}</span> : null}
                            </div>

                            <div className="space-y-2">
                              <p className="whitespace-pre-wrap text-sm font-medium leading-7 text-slate-900">{question.stem}</p>
                              {question.material ? <div className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-600">{truncate(question.material)}</div> : null}
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <p className="text-xs text-slate-400">答案设置</p>
                                <p className="mt-2 text-sm font-medium text-slate-700">{buildQuestionAnswerSummary(question)}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <p className="text-xs text-slate-400">结构信息</p>
                                <p className="mt-2 text-sm font-medium text-slate-700">
                                  {question.questionType === "subjective_case"
                                    ? `${question.subjectiveSubQuestions.length || 1} 个答题区`
                                    : `${question.options.filter((option) => option.content).length} 个选项`}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <p className="text-xs text-slate-400">解析</p>
                                <p className="mt-2 text-sm font-medium text-slate-700">{question.analysis ? truncate(question.analysis, 56) : "未填写"}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 justify-end">
                            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => void handleRemoveQuestion(question.id)}>
                              <Trash2 className="size-4" />
                              移除
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="flex h-[min(92vh,880px)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[28px] border-slate-200 p-0 sm:max-w-[calc(100vw-5rem)] xl:max-w-[1240px]">
          <DialogHeader className="gap-3 border-b border-slate-100 px-6 py-5">
            <DialogTitle>从题库加入题目</DialogTitle>
            <DialogDescription>
              当前试卷为 {paperTypeMeta[currentPaperType].label}，这里只显示对应题库的题目。选择后会直接追加到当前试卷末尾。
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-b border-slate-100 bg-slate-50/60 xl:border-r xl:border-b-0">
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">题库文件夹</p>
                    <p className="mt-1 text-xs text-slate-500">先按文件夹缩小范围，再在右侧批量挑题。</p>
                  </div>
                  {folderLoading ? <Loader2 className="size-4 animate-spin text-slate-400" /> : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 px-4 py-4">
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                    selectedFolderId === "all" ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    setSelectedFolderId("all");
                    setQuestionPage(1);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="size-4" />
                    全部题目
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${selectedFolderId === "all" ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {questionTotal}
                  </span>
                </button>

                <ScrollArea className="mt-3 h-[min(42vh,520px)] pr-2 xl:h-full">
                  <div className="space-y-2 pb-2">
                    {folders.map((folder) => {
                      const active = folder.id === selectedFolderId;
                      return (
                        <button
                          key={folder.id}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                            active ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setSelectedFolderId(folder.id);
                            setQuestionPage(1);
                          }}
                        >
                          <span className="truncate pr-3">{folder.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>{folder.questionCount}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-col bg-white">
              <div className="space-y-4 border-b border-slate-100 px-6 py-5">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="pl-9"
                      value={keyword}
                      onChange={(event) => {
                        setKeyword(event.target.value);
                        setQuestionPage(1);
                      }}
                      placeholder="按题干、材料关键字搜索"
                    />
                  </div>

                  <Select
                    value={questionTypeFilter}
                    onValueChange={(value: MockExamQuestionType | "all") => {
                      setQuestionTypeFilter(value);
                      setQuestionPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="题型筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentPaperType === "objective" ? <SelectItem value="all">全部题型</SelectItem> : null}
                      {dialogQuestionTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {questionTypeMeta[type].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setKeyword("");
                      setQuestionTypeFilter(currentPaperType === "subjective" ? "subjective_case" : "all");
                      setSelectedFolderId("all");
                      setQuestionPage(1);
                    }}
                  >
                    重置
                  </Button>
                </div>

                <div className="grid gap-3 rounded-3xl border border-blue-200 bg-blue-50 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="text-xs text-slate-500">已选题目</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">{selectedBankIds.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="text-xs text-slate-500">累计分值</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">{selectedBankScore}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="text-xs text-slate-500">当前结果</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">{questionTotal}</p>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <Checkbox checked={allCurrentPageSelected} onCheckedChange={() => toggleSelectCurrentPage()} />
                    <span>本页全选</span>
                  </label>
                </div>
              </div>

              <div className="min-h-0 flex-1 px-6 py-5">
                {bankLoading ? (
                  <div className="rounded-3xl border border-slate-200 px-6 py-20 text-center text-sm text-slate-500">
                    <Loader2 className="mx-auto mb-3 size-5 animate-spin" />
                    题库题目加载中...
                  </div>
                ) : bankItems.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-20 text-center text-sm text-slate-500">当前筛选下没有可加入的题目</div>
                ) : (
                  <ScrollArea className="h-full pr-2">
                    <div className="space-y-3 pb-2 pr-3">
                      {bankItems.map((item) => {
                        const selected = Boolean(selectedBankMap[item.id]);
                        return (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            className={`rounded-3xl border p-5 text-left transition ${
                              selected ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                            }`}
                            onClick={() => toggleBankItem(item)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleBankItem(item);
                              }
                            }}
                          >
                            <div className="flex items-start gap-4">
                              <div className="pt-1" onClick={(event) => event.stopPropagation()}>
                                <Checkbox checked={selected} onCheckedChange={() => toggleBankItem(item)} />
                              </div>

                              <div className="min-w-0 flex-1 space-y-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className="bg-slate-900 text-white">{item.questionTypeLabel}</Badge>
                                  <Badge className="bg-slate-100 text-slate-700">{item.score} 分</Badge>
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{item.folderName}</span>
                                  <span className="text-xs text-slate-400">更新于 {item.updatedAt}</span>
                                  {selected ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">已选择</span> : null}
                                </div>

                                <p className="whitespace-pre-wrap text-base font-medium leading-7 text-slate-900">{item.stem}</p>

                                {item.material ? (
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{truncate(item.material, 140)}</div>
                                ) : null}

                                <div className="grid items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                                  <div className="self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                                    <p className="text-xs text-slate-400">答案设置</p>
                                    <p className="mt-2 text-sm font-medium text-slate-700">
                                      {item.questionType === "subjective_case" ? "主观题，人工阅卷" : item.correctAnswerKeys.join(" / ") || "-"}
                                    </p>
                                  </div>

                                  <div className="self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                                    <p className="text-xs text-slate-400">结构信息</p>
                                    <p className="mt-2 text-sm font-medium text-slate-700">
                                      {item.questionType === "subjective_case"
                                        ? `${item.subjectiveSubQuestions.length} 个答题区`
                                        : `${item.options.filter((option) => option.content).length} 个选项`}
                                    </p>
                                  </div>

                                  <div className="self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                                    <p className="text-xs text-slate-400">解析摘要</p>
                                    <p className="mt-2 text-sm font-medium leading-5 text-slate-700">{item.analysis ? truncate(item.analysis, 56) : "未填写"}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <DialogFooter className="border-t border-slate-100 px-6 py-4">
                <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>
                      第 {questionPage} / {Math.max(questionTotalPages, 1)} 页
                    </span>
                    <span>共 {questionTotal} 道题</span>
                    <span>已选 {selectedBankIds.length} 道</span>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" disabled={questionPage <= 1} onClick={() => setQuestionPage((current) => Math.max(1, current - 1))}>
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      disabled={questionPage >= questionTotalPages}
                      onClick={() => setQuestionPage((current) => Math.min(questionTotalPages, current + 1))}
                    >
                      下一页
                    </Button>
                    <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={() => void handleAddQuestions()} disabled={selectedBankIds.length === 0 || addingQuestions}>
                      {addingQuestions ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      加入试卷
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
