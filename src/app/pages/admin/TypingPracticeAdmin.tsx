import { BookText, FilePenLine, FolderOpen, FolderPlus, ImageIcon, Loader2, Pencil, Plus, Save, Search, Trash2, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createDefaultTypingPracticeHomeConfig } from "../../../shared/typing-practice-home-config.js";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
  type TypingPracticeDifficulty,
  type TypingPracticeDifficultyConfig,
  type TypingPracticeFolder,
  type TypingPracticeHomeConfig,
  type TypingPracticeSummary,
  type TypingPracticeText,
  type TypingPracticeTextPayload,
  type TypingPracticeTextStatus,
  mockApi,
} from "../../lib/mockData";
import { cn } from "../../components/ui/utils";

const PAGE_SIZE = 18;

const EMPTY_SUMMARY: TypingPracticeSummary = {
  totalFolders: 0,
  totalTexts: 0,
  publishedTexts: 0,
  draftTexts: 0,
  totalRecords: 0,
};

const difficultyMeta: Record<TypingPracticeDifficulty, { label: string; className: string }> = {
  easy: { label: "入门", className: "bg-emerald-50 text-emerald-700" },
  medium: { label: "标准", className: "bg-sky-50 text-sky-700" },
  hard: { label: "挑战", className: "bg-rose-50 text-rose-700" },
};

const statusMeta: Record<TypingPracticeTextStatus, { label: string; className: string }> = {
  published: { label: "已发布", className: "bg-slate-900 text-white" },
  draft: { label: "草稿", className: "bg-slate-100 text-slate-700" },
};

type HomeImageTarget = "police" | "thief";

type EditableDifficultyField = Exclude<keyof TypingPracticeDifficultyConfig, "difficulty" | "label">;

const difficultyConfigFieldGroups: Array<{
  title: string;
  fields: Array<{ key: EditableDifficultyField; label: string; hint: string; min?: number }>;
}> = [
  {
    title: "节奏与闯关",
    fields: [
      { key: "initialLives", label: "初始生命", hint: "每局开始时可用的生命数", min: 1 },
      { key: "baseStageTimeSeconds", label: "基础关卡时长", hint: "每段关卡默认给出的秒数", min: 1 },
      { key: "extraTimePer20Chars", label: "每 20 字加时", hint: "文本变长后额外补的秒数", min: 0 },
      { key: "minStageTimeSeconds", label: "最少关卡时长", hint: "任何关卡都不会低于这个秒数", min: 1 },
      { key: "levelTimeReductionSeconds", label: "每关递减秒数", hint: "关卡越靠后，每关额外减少的秒数", min: 0 },
      { key: "thiefSpeedBase", label: "基础小偷速度", hint: "第一关显示的小偷速度值", min: 1 },
      { key: "thiefSpeedStepLevels", label: "几关加一次速", hint: "每经过多少关提升一次速度", min: 1 },
    ],
  },
  {
    title: "得分与默写",
    fields: [
      { key: "scorePerChar", label: "每字得分", hint: "每输入一个正确字符增加的分数", min: 1 },
      { key: "errorPenalty", label: "错误扣分", hint: "每个错误字符扣除的分数", min: 0 },
      { key: "captureBonus", label: "通关奖励", hint: "完成一段文本后额外奖励的分数", min: 0 },
      { key: "lifeBonus", label: "剩余生命奖励", hint: "结算时每条剩余生命对应的分数", min: 0 },
    ],
  },
];

type FolderFormState = {
  name: string;
  sortOrder: string;
};

type TextFormState = {
  folderId: string;
  title: string;
  difficulty: TypingPracticeDifficulty;
  source: string;
  tags: string;
  content: string;
  note: string;
  status: TypingPracticeTextStatus;
  sortOrder: string;
};

const createEmptyFolderForm = (): FolderFormState => ({
  name: "",
  sortOrder: "",
});

const createEmptyTextForm = (folderId = ""): TextFormState => ({
  folderId,
  title: "",
  difficulty: "medium",
  source: "",
  tags: "",
  content: "",
  note: "",
  status: "published",
  sortOrder: "",
});

const createTextFormFromItem = (text: TypingPracticeText): TextFormState => ({
  folderId: text.folderId,
  title: text.title,
  difficulty: text.difficulty,
  source: text.source,
  tags: text.tags.join("，"),
  content: text.content,
  note: text.note,
  status: text.status,
  sortOrder: text.sortOrder > 0 ? `${text.sortOrder}` : "",
});

export function TypingPracticeAdmin() {
  const policeImageInputRef = useRef<HTMLInputElement | null>(null);
  const thiefImageInputRef = useRef<HTMLInputElement | null>(null);
  const [summary, setSummary] = useState<TypingPracticeSummary>(EMPTY_SUMMARY);
  const [folders, setFolders] = useState<TypingPracticeFolder[]>([]);
  const [texts, setTexts] = useState<TypingPracticeText[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TypingPracticeTextStatus>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TypingPracticeFolder | null>(null);
  const [folderForm, setFolderForm] = useState<FolderFormState>(createEmptyFolderForm());
  const [folderSaving, setFolderSaving] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [editingText, setEditingText] = useState<TypingPracticeText | null>(null);
  const [textForm, setTextForm] = useState<TextFormState>(createEmptyTextForm());
  const [textSaving, setTextSaving] = useState(false);
  const [homeConfig, setHomeConfig] = useState<TypingPracticeHomeConfig>(createDefaultTypingPracticeHomeConfig());
  const [homeConfigLoading, setHomeConfigLoading] = useState(false);
  const [homeConfigSaving, setHomeConfigSaving] = useState(false);
  const [uploadingHomeImage, setUploadingHomeImage] = useState<HomeImageTarget | "">("");
  const [difficultyConfigs, setDifficultyConfigs] = useState<TypingPracticeDifficultyConfig[]>([]);
  const [difficultyLoading, setDifficultyLoading] = useState(false);
  const [difficultySaving, setDifficultySaving] = useState(false);
  const deferredKeyword = useDeferredValue(keyword.trim());

  const folderNameMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder.name])), [folders]);
  const selectedFolder = selectedFolderId !== "all" ? folders.find((folder) => folder.id === selectedFolderId) ?? null : null;

  const loadSummary = async () => {
    const nextSummary = await mockApi.getAdminTypingPracticeSummary();
    setSummary(nextSummary);
  };

  const loadFolders = async () => {
    const nextFolders = await mockApi.getAdminTypingPracticeFolders();
    setFolders(nextFolders);
    setSelectedFolderId((current) => (current === "all" || nextFolders.some((folder) => folder.id === current) ? current : "all"));
  };

  const loadDifficultyConfigs = async () => {
    setDifficultyLoading(true);
    try {
      const nextConfigs = await mockApi.getAdminTypingPracticeDifficultyConfigs();
      setDifficultyConfigs(nextConfigs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载难度配置失败");
    } finally {
      setDifficultyLoading(false);
    }
  };

  const loadHomeConfig = async () => {
    setHomeConfigLoading(true);
    try {
      const nextConfig = await mockApi.getAdminTypingPracticeHomeConfig();
      setHomeConfig(nextConfig);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载首页配置失败");
    } finally {
      setHomeConfigLoading(false);
    }
  };

  const loadTexts = async (nextPage = page) => {
    setListLoading(true);
    try {
      const result = await mockApi.getAdminTypingPracticeTexts({
        folderId: selectedFolderId,
        keyword: deferredKeyword,
        status: statusFilter,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setTexts(result.items);
      setTotalItems(result.total);
      setTotalPages(result.totalPages);
      if (result.page !== nextPage) {
        setPage(result.page);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载练习文本失败");
    } finally {
      setListLoading(false);
    }
  };

  const refreshAll = async (options?: { resetPage?: boolean }) => {
    const nextPage = options?.resetPage ? 1 : page;
    if (options?.resetPage) {
      setPage(1);
    }
    await Promise.all([loadSummary(), loadFolders(), loadTexts(nextPage)]);
  };

  const updateDifficultyConfigField = (difficulty: TypingPracticeDifficulty, field: EditableDifficultyField, value: string) => {
    const parsed = Number.parseInt(value, 10);
    setDifficultyConfigs((current) =>
      current.map((item) =>
        item.difficulty === difficulty
          ? {
              ...item,
              [field]: Number.isFinite(parsed) ? parsed : 0,
            }
          : item,
      ),
    );
  };

  const saveDifficultyConfigs = async () => {
    try {
      setDifficultySaving(true);
      const nextConfigs = await mockApi.updateAdminTypingPracticeDifficultyConfigs({
        items: difficultyConfigs,
      });
      setDifficultyConfigs(nextConfigs);
      toast.success("难度配置已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存难度配置失败");
    } finally {
      setDifficultySaving(false);
    }
  };

  const updateHomeHeroField = (field: keyof TypingPracticeHomeConfig["hero"], value: string) => {
    setHomeConfig((current) => ({
      ...current,
      hero: {
        ...current.hero,
        [field]: value,
      },
    }));
  };

  const updateModeHint = (field: keyof TypingPracticeHomeConfig["modeHints"], value: string) => {
    setHomeConfig((current) => ({
      ...current,
      modeHints: {
        ...current.modeHints,
        [field]: value,
      },
    }));
  };

  const updateRuleParagraph = (index: number, value: string) => {
    setHomeConfig((current) => ({
      ...current,
      rules: {
        ...current.rules,
        paragraphs: current.rules.paragraphs.map((item, itemIndex) => (itemIndex === index ? { ...item, text: value } : item)),
      },
    }));
  };

  const updateRuleCard = (index: number, field: "title" | "description", value: string) => {
    setHomeConfig((current) => ({
      ...current,
      rules: {
        ...current.rules,
        cards: current.rules.cards.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
      },
    }));
  };

  const saveHomeConfig = async () => {
    try {
      setHomeConfigSaving(true);
      const saved = await mockApi.updateAdminTypingPracticeHomeConfig({ config: homeConfig });
      setHomeConfig(saved);
      toast.success("首页配置已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存首页配置失败");
    } finally {
      setHomeConfigSaving(false);
    }
  };

  const handleHomeImageUpload = async (event: ChangeEvent<HTMLInputElement>, target: HomeImageTarget) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingHomeImage(target);
    try {
      const uploaded = await mockApi.uploadSystemImage(file);
      setHomeConfig((current) => ({
        ...current,
        hero: {
          ...current.hero,
          ...(target === "police"
            ? {
                policeImageUrl: uploaded.readableUrl ?? uploaded.url,
                policeImageObjectKey: uploaded.objectKey,
              }
            : {
                thiefImageUrl: uploaded.readableUrl ?? uploaded.url,
                thiefImageObjectKey: uploaded.objectKey,
              }),
        },
      }));
      toast.success(target === "police" ? "警察图片已上传" : "小偷图片已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片上传失败");
    } finally {
      setUploadingHomeImage("");
      event.target.value = "";
    }
  };

  const clearHomeImage = (target: HomeImageTarget) => {
    setHomeConfig((current) => ({
      ...current,
      hero: {
        ...current.hero,
        ...(target === "police"
          ? {
              policeImageUrl: "",
              policeImageObjectKey: "",
            }
          : {
              thiefImageUrl: "",
              thiefImageObjectKey: "",
            }),
      },
    }));
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        await Promise.all([loadSummary(), loadFolders(), loadDifficultyConfigs(), loadHomeConfig()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载打字练习后台失败");
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, []);

  useEffect(() => {
    if (loading) return;
    void loadTexts();
  }, [loading, selectedFolderId, deferredKeyword, statusFilter, page]);

  const openCreateFolder = () => {
    setEditingFolder(null);
    setFolderForm(createEmptyFolderForm());
    setFolderDialogOpen(true);
  };

  const openEditFolder = (folder: TypingPracticeFolder) => {
    setEditingFolder(folder);
    setFolderForm({
      name: folder.name,
      sortOrder: folder.sortOrder > 0 ? `${folder.sortOrder}` : "",
    });
    setFolderDialogOpen(true);
  };

  const saveFolder = async () => {
    if (!folderForm.name.trim()) {
      toast.error("请输入文件夹名称");
      return;
    }

    try {
      setFolderSaving(true);
      const payload = {
        name: folderForm.name.trim(),
        sortOrder: folderForm.sortOrder.trim(),
      };
      const folder = editingFolder
        ? await mockApi.updateAdminTypingPracticeFolder(editingFolder.id, payload)
        : await mockApi.createAdminTypingPracticeFolder(payload);
      setFolderDialogOpen(false);
      await Promise.all([loadSummary(), loadFolders()]);
      setSelectedFolderId(folder.id);
      toast.success(editingFolder ? "文件夹已更新" : "文件夹已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存文件夹失败");
    } finally {
      setFolderSaving(false);
    }
  };

  const removeFolder = async (folder: TypingPracticeFolder) => {
    if (!window.confirm(`确认删除文件夹“${folder.name}”？`)) {
      return;
    }

    try {
      await mockApi.deleteAdminTypingPracticeFolder(folder.id);
      toast.success("文件夹已删除");
      await refreshAll({ resetPage: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除文件夹失败");
    }
  };

  const openCreateText = () => {
    if (folders.length === 0) {
      toast.error("请先创建文件夹");
      return;
    }

    const defaultFolderId = selectedFolderId !== "all" ? selectedFolderId : folders[0]?.id ?? "";
    setEditingText(null);
    setTextForm(createEmptyTextForm(defaultFolderId));
    setTextDialogOpen(true);
  };

  const openEditText = (text: TypingPracticeText) => {
    setEditingText(text);
    setTextForm(createTextFormFromItem(text));
    setTextDialogOpen(true);
  };

  const saveText = async () => {
    if (!textForm.folderId) {
      toast.error("请选择文件夹");
      return;
    }

    if (!textForm.title.trim()) {
      toast.error("请输入文本标题");
      return;
    }

    if (!textForm.content.trim()) {
      toast.error("请输入练习文本内容");
      return;
    }

    const payload: TypingPracticeTextPayload = {
      folderId: textForm.folderId,
      title: textForm.title.trim(),
      difficulty: textForm.difficulty,
      source: textForm.source.trim(),
      tags: textForm.tags,
      content: textForm.content,
      note: textForm.note,
      status: textForm.status,
      sortOrder: textForm.sortOrder.trim(),
    };

    try {
      setTextSaving(true);
      if (editingText) {
        await mockApi.updateAdminTypingPracticeText(editingText.id, payload);
      } else {
        await mockApi.createAdminTypingPracticeText(payload);
      }

      setTextDialogOpen(false);
      toast.success(editingText ? "练习文本已更新" : "练习文本已创建");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存练习文本失败");
    } finally {
      setTextSaving(false);
    }
  };

  const removeText = async (text: TypingPracticeText) => {
    if (!window.confirm(`确认删除“${text.title}”？`)) {
      return;
    }

    try {
      await mockApi.deleteAdminTypingPracticeText(text.id);
      toast.success("练习文本已删除");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除练习文本失败");
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">打字练习后台加载中...</div>;
  }

  return (
    <div className="space-y-6 p-8">
      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="rounded-3xl border-slate-200 shadow-none">
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">文件夹</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalFolders}</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-slate-200 shadow-none">
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">全部文本</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalTexts}</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-sky-200 bg-sky-50/70 shadow-none">
          <CardContent className="p-6">
            <p className="text-sm text-sky-700">已发布</p>
            <p className="mt-2 text-3xl font-semibold text-sky-900">{summary.publishedTexts}</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-amber-200 bg-amber-50/70 shadow-none">
          <CardContent className="p-6">
            <p className="text-sm text-amber-700">练习记录</p>
            <p className="mt-2 text-3xl font-semibold text-amber-900">{summary.totalRecords}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-slate-200 shadow-none">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-2xl text-slate-900">首页配置</CardTitle>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                这里统一维护打字练习首页的标题、公告、模式说明、规则文案和人物图片。保存后，用户端首页会直接同步最新内容。
              </p>
            </div>

            <Button className="rounded-2xl" onClick={() => void saveHomeConfig()} disabled={homeConfigLoading || homeConfigSaving}>
              {homeConfigSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              保存首页
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {homeConfigLoading ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-slate-200 text-slate-500">
              <Loader2 className="mr-2 size-4 animate-spin" />
              正在加载首页配置...
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <Label className="text-sm text-slate-700">主标题</Label>
                  <Input
                    value={homeConfig.hero.title}
                    onChange={(event) => updateHomeHeroField("title", event.target.value)}
                    className="h-11 rounded-2xl border-slate-200 bg-white"
                    placeholder="例如：打字练习"
                  />
                </div>

                <div className="space-y-2 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <Label className="text-sm text-slate-700">英文标题</Label>
                  <Input
                    value={homeConfig.hero.englishTitle}
                    onChange={(event) => updateHomeHeroField("englishTitle", event.target.value)}
                    className="h-11 rounded-2xl border-slate-200 bg-white"
                    placeholder="例如：Typing Practice"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                <Label className="text-sm text-slate-700">顶部公告</Label>
                <Input
                  value={homeConfig.hero.topNotice}
                  onChange={(event) => updateHomeHeroField("topNotice", event.target.value)}
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                  placeholder="例如：请使用中文输入法进行练习，删除、剪切、粘贴均已禁用"
                />
              </div>

              <div className="space-y-2 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                <Label className="text-sm text-slate-700">首页说明</Label>
                <Textarea
                  value={homeConfig.hero.description}
                  onChange={(event) => updateHomeHeroField("description", event.target.value)}
                  className="min-h-[120px] rounded-2xl border-slate-200 bg-white"
                  placeholder="填写首页顶部说明文案"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <Label className="text-sm text-slate-700">跟打练习提示</Label>
                  <Textarea
                    value={homeConfig.modeHints.guided}
                    onChange={(event) => updateModeHint("guided", event.target.value)}
                    className="min-h-[120px] rounded-2xl border-slate-200 bg-white"
                  />
                </div>
                <div className="space-y-2 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <Label className="text-sm text-slate-700">限时冲刺提示</Label>
                  <Textarea
                    value={homeConfig.modeHints.sprint}
                    onChange={(event) => updateModeHint("sprint", event.target.value)}
                    className="min-h-[120px] rounded-2xl border-slate-200 bg-white"
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">警察图片</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-400">用于首页主视觉左侧角色。</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="rounded-2xl" onClick={() => policeImageInputRef.current?.click()} disabled={uploadingHomeImage === "police"}>
                        <Upload className="mr-2 size-4" />
                        {uploadingHomeImage === "police" ? "上传中..." : "上传"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl text-red-500 hover:text-red-600"
                        onClick={() => clearHomeImage("police")}
                        disabled={uploadingHomeImage === "police" || (!homeConfig.hero.policeImageUrl && !homeConfig.hero.policeImageObjectKey)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        清空
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex h-52 items-end justify-center rounded-[22px] border border-dashed border-slate-200 bg-[linear-gradient(180deg,#dff5ff_0%,#bfeaff_60%,#d9f2ce_60%,#c0e6ad_100%)] p-4">
                    {homeConfig.hero.policeImageUrl ? (
                      <img src={homeConfig.hero.policeImageUrl} alt="警察图片" className="h-full w-auto object-contain object-bottom" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <ImageIcon className="mx-auto size-10" />
                        <p className="mt-3 text-sm">未上传警察图片</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">小偷图片</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-400">用于首页主视觉右侧角色。</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="rounded-2xl" onClick={() => thiefImageInputRef.current?.click()} disabled={uploadingHomeImage === "thief"}>
                        <Upload className="mr-2 size-4" />
                        {uploadingHomeImage === "thief" ? "上传中..." : "上传"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl text-red-500 hover:text-red-600"
                        onClick={() => clearHomeImage("thief")}
                        disabled={uploadingHomeImage === "thief" || (!homeConfig.hero.thiefImageUrl && !homeConfig.hero.thiefImageObjectKey)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        清空
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex h-52 items-end justify-center rounded-[22px] border border-dashed border-slate-200 bg-[linear-gradient(180deg,#dff5ff_0%,#bfeaff_60%,#d9f2ce_60%,#c0e6ad_100%)] p-4">
                    {homeConfig.hero.thiefImageUrl ? (
                      <img src={homeConfig.hero.thiefImageUrl} alt="小偷图片" className="h-full w-auto object-contain object-bottom" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <ImageIcon className="mx-auto size-10" />
                        <p className="mt-3 text-sm">未上传小偷图片</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <input ref={policeImageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleHomeImageUpload(event, "police")} />
              <input ref={thiefImageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleHomeImageUpload(event, "thief")} />

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">规则段落</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-400">对应首页说明区的 6 条文字说明。</p>
                  </div>
                  {homeConfig.rules.paragraphs.map((item, index) => (
                    <div key={`paragraph-${index}`} className="space-y-2">
                      <Label className="text-sm text-slate-700">规则 {index + 1}</Label>
                      <Textarea
                        value={item.text}
                        onChange={(event) => updateRuleParagraph(index, event.target.value)}
                        className="min-h-[92px] rounded-2xl border-slate-200 bg-white"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">规则卡片</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-400">对应首页下方的 4 个规则标签卡片。</p>
                  </div>
                  {homeConfig.rules.cards.map((item, index) => (
                    <div key={`card-${index}`} className="rounded-[20px] border border-slate-200 bg-white p-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-700">卡片标题 {index + 1}</Label>
                        <Input
                          value={item.title}
                          onChange={(event) => updateRuleCard(index, "title", event.target.value)}
                          className="h-11 rounded-2xl border-slate-200"
                        />
                      </div>
                      <div className="mt-3 space-y-2">
                        <Label className="text-sm text-slate-700">卡片说明 {index + 1}</Label>
                        <Textarea
                          value={item.description}
                          onChange={(event) => updateRuleCard(index, "description", event.target.value)}
                          className="min-h-[92px] rounded-2xl border-slate-200"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-slate-200 shadow-none">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-2xl text-slate-900">难度配置</CardTitle>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                这里统一配置入门、标准、挑战三档的节奏、得分规则和默写预览时长。保存后，新开局会立即使用最新配置。
              </p>
            </div>

            <Button className="rounded-2xl" onClick={() => void saveDifficultyConfigs()} disabled={difficultyLoading || difficultySaving || difficultyConfigs.length === 0}>
              {difficultySaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              保存配置
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {difficultyLoading ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-slate-200 text-slate-500">
              <Loader2 className="mr-2 size-4 animate-spin" />
              正在加载难度配置...
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              {difficultyConfigs.map((config) => (
                <div key={config.difficulty} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{difficultyMeta[config.difficulty].label}</h3>
                      <p className="mt-1 text-xs text-slate-400">该配置会应用到所有同难度的练习文本。</p>
                    </div>
                    <Badge className={difficultyMeta[config.difficulty].className}>{config.label}</Badge>
                  </div>

                  <div className="mt-5 space-y-5">
                    {difficultyConfigFieldGroups.map((group) => (
                      <div key={`${config.difficulty}-${group.title}`} className="space-y-3">
                        <div className="text-sm font-medium text-slate-700">{group.title}</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {group.fields.map((field) => (
                            <div key={`${config.difficulty}-${field.key}`} className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                              <Label className="text-sm text-slate-700">{field.label}</Label>
                              <Input
                                type="number"
                                min={field.min ?? 0}
                                value={config[field.key]}
                                onChange={(event) => updateDifficultyConfigField(config.difficulty, field.key, event.target.value)}
                                className="h-11 rounded-2xl border-slate-200 bg-white"
                              />
                              <p className="text-xs leading-5 text-slate-400">{field.hint}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="rounded-[28px] border-slate-200 shadow-none">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-slate-900">练习文件夹</CardTitle>
                <p className="mt-2 text-sm leading-6 text-slate-500">左侧管理专题，右侧直接维护对应的练习文本。</p>
              </div>
              <Button variant="outline" size="icon" className="rounded-2xl" onClick={openCreateFolder}>
                <FolderPlus className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition",
                selectedFolderId === "all" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100",
              )}
              onClick={() => setSelectedFolderId("all")}
            >
              <div>
                <p className="text-sm font-medium">全部文本</p>
                <p className={cn("mt-1 text-xs", selectedFolderId === "all" ? "text-white/70" : "text-slate-400")}>{summary.totalTexts} 篇文本</p>
              </div>
              <FolderOpen className="size-4" />
            </button>

            {folders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">还没有文件夹，先新建一个。</div>
            ) : (
              folders.map((folder) => {
                const active = selectedFolderId === folder.id;

                return (
                  <div
                    key={folder.id}
                    className={cn(
                      "rounded-2xl border px-4 py-3 transition",
                      active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <button type="button" className="w-full text-left" onClick={() => setSelectedFolderId(folder.id)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{folder.name}</p>
                          <p className={cn("mt-1 text-xs", active ? "text-white/70" : "text-slate-400")}>
                            {folder.publishedTextCount}/{folder.textCount} 已发布
                          </p>
                        </div>
                        <Badge className={active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}>{folder.textCount}</Badge>
                      </div>
                    </button>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-8 rounded-xl px-2", active ? "text-white hover:bg-white/10 hover:text-white" : "text-slate-500")}
                        onClick={() => openEditFolder(folder)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-8 rounded-xl px-2", active ? "text-white hover:bg-white/10 hover:text-white" : "text-red-500 hover:text-red-600")}
                        onClick={() => void removeFolder(folder)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 shadow-none">
          <CardHeader className="border-b border-slate-100 pb-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <CardTitle className="text-2xl text-slate-900">{selectedFolder?.name ?? "全部练习文本"}</CardTitle>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  每条文本都可以直接给前台的跟打练习、限时冲刺、法条默写复用。建议一篇文本控制在 200 到 1200 字之间。
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-2xl" onClick={openCreateFolder}>
                  <FolderPlus className="mr-2 size-4" />
                  新建文件夹
                </Button>
                <Button className="rounded-2xl" onClick={openCreateText}>
                  <Plus className="mr-2 size-4" />
                  新建文本
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  className="h-12 rounded-2xl border-slate-200 pl-10"
                  placeholder="按标题、来源、内容关键词搜索"
                />
              </div>

              <Select value={statusFilter} onValueChange={(value: "all" | TypingPracticeTextStatus) => setStatusFilter(value)}>
                <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                  <SelectValue placeholder="状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>共 {totalItems} 篇文本</span>
              <span>第 {page} / {totalPages} 页</span>
            </div>

            {listLoading ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-dashed border-slate-200 text-slate-500">
                <Loader2 className="mr-2 size-4 animate-spin" />
                文本加载中...
              </div>
            ) : texts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                  <BookText className="size-6" />
                </div>
                <p className="mt-4 text-lg font-medium text-slate-900">还没有练习文本</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">先从法条、案例分析或主观题高频语句里挑一段录入进去。</p>
              </div>
            ) : (
              texts.map((text) => (
                <div key={text.id} className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={statusMeta[text.status].className}>{statusMeta[text.status].label}</Badge>
                        <Badge className={difficultyMeta[text.difficulty].className}>{difficultyMeta[text.difficulty].label}</Badge>
                        <Badge variant="secondary">{folderNameMap.get(text.folderId) ?? text.folderName}</Badge>
                        <span className="text-xs text-slate-400">{text.contentLength} 字符</span>
                      </div>

                      <h3 className="mt-3 text-lg font-semibold text-slate-900">{text.title}</h3>
                      {text.source ? <p className="mt-2 text-sm text-slate-500">来源：{text.source}</p> : null}
                      <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{text.preview}</p>

                      {text.tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {text.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {text.note ? <p className="mt-3 line-clamp-2 text-xs leading-6 text-slate-400">备注：{text.note}</p> : null}
                    </div>

                    <div className="flex items-center gap-2 xl:pl-6">
                      <Button variant="outline" className="rounded-2xl" onClick={() => openEditText(text)}>
                        <Pencil className="mr-2 size-4" />
                        编辑
                      </Button>
                      <Button variant="outline" className="rounded-2xl text-red-500 hover:text-red-600" onClick={() => void removeText(text)}>
                        <Trash2 className="mr-2 size-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" className="rounded-2xl" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                上一页
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                下一页
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFolder ? "编辑文件夹" : "新建文件夹"}</DialogTitle>
            <DialogDescription>文件夹用于区分练习专题，比如民法法条、案例分析、主观题高频句式。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>文件夹名称</Label>
              <Input value={folderForm.name} onChange={(event) => setFolderForm((current) => ({ ...current, name: event.target.value }))} placeholder="例如：刑法法条 / 主观题表达" />
            </div>
            <div className="space-y-2">
              <Label>排序值</Label>
              <Input
                type="number"
                min={1}
                value={folderForm.sortOrder}
                onChange={(event) => setFolderForm((current) => ({ ...current, sortOrder: event.target.value }))}
                placeholder="不填则使用当前顺序"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void saveFolder()} disabled={folderSaving}>
              {folderSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {editingFolder ? "保存修改" : "创建文件夹"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingText ? "编辑练习文本" : "新建练习文本"}</DialogTitle>
            <DialogDescription>一篇文本录入后，前台会同时支持跟打练习、限时冲刺和法条默写三种模式。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>文件夹</Label>
              <Select value={textForm.folderId} onValueChange={(value) => setTextForm((current) => ({ ...current, folderId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择文件夹" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>难度</Label>
              <Select value={textForm.difficulty} onValueChange={(value: TypingPracticeDifficulty) => setTextForm((current) => ({ ...current, difficulty: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择难度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">入门</SelectItem>
                  <SelectItem value="medium">标准</SelectItem>
                  <SelectItem value="hard">挑战</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={textForm.status} onValueChange={(value: TypingPracticeTextStatus) => setTextForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>排序值</Label>
              <Input
                type="number"
                min={1}
                value={textForm.sortOrder}
                onChange={(event) => setTextForm((current) => ({ ...current, sortOrder: event.target.value }))}
                placeholder="不填则自动排在后面"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>文本标题</Label>
              <Input value={textForm.title} onChange={(event) => setTextForm((current) => ({ ...current, title: event.target.value }))} placeholder="例如：民法典合同编总则节选" />
            </div>

            <div className="space-y-2">
              <Label>来源</Label>
              <Input value={textForm.source} onChange={(event) => setTextForm((current) => ({ ...current, source: event.target.value }))} placeholder="例如：民法典 / 民诉案例分析 / 主观题模板" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>标签</Label>
            <Input value={textForm.tags} onChange={(event) => setTextForm((current) => ({ ...current, tags: event.target.value }))} placeholder="多个标签可用逗号分隔，例如：民法，合同，主观题表达" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>练习文本</Label>
              <span className="text-xs text-slate-400">{textForm.content.trim().length} 字符</span>
            </div>
            <Textarea
              value={textForm.content}
              onChange={(event) => setTextForm((current) => ({ ...current, content: event.target.value }))}
              className="min-h-[260px]"
              placeholder="请直接粘贴法条、案例分析正文或主观题高频表达。前台会严格按原文逐字校验。"
            />
          </div>

          <div className="space-y-2">
            <Label>备注</Label>
            <Textarea
              value={textForm.note}
              onChange={(event) => setTextForm((current) => ({ ...current, note: event.target.value }))}
              className="min-h-[120px]"
              placeholder="可选，例如：建议用于 5 分钟冲刺，或搭配某门课程一起练。"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTextDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void saveText()} disabled={textSaving}>
              {textSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FilePenLine className="mr-2 size-4" />}
              {editingText ? "保存修改" : "创建文本"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
