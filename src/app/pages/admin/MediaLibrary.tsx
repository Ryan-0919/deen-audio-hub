import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocation } from "react-router";
import { CheckCircle2, FileText, FolderOpen, FolderPlus, Loader2, MoveRight, Pencil, Plus, Search, Trash2, Upload, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
import type {
  Audio,
  AudioLibraryItem,
  AudioLibraryMeta,
  Course,
  CourseType,
  Folder,
  Tag,
  Video,
  VideoFolder,
  VideoLibraryItem,
  VideoLibraryMeta,
} from "../../lib/mockData";
import { mockApi } from "../../lib/mockData";

type SearchScope = "current" | "all";
type RefFilter = "all" | "referenced" | "unreferenced";
type ScriptFilter = "all" | "scripted" | "unscripted";
type SortMode = "uploaded-desc" | "name-asc";
type MediaFolder = Folder | VideoFolder;
type MediaItem = AudioLibraryItem | VideoLibraryItem;
type MediaMeta = AudioLibraryMeta | VideoLibraryMeta;

const PAGE_SIZE = 15;
const HANDOUT_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip";

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const isAudioItem = (item: MediaItem): item is AudioLibraryItem => "processStatus" in item;
const isAudioFolder = (folder: MediaFolder): folder is Folder => "audioCount" in folder;
const isVideoMeta = (meta: MediaMeta): meta is VideoLibraryMeta => "totalVideoCount" in meta;

const getProcessBadge = (status?: string, message?: string) => {
  if (status === "pending") {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
          <Loader2 className="size-3.5 animate-spin" />
          等待处理
        </span>
        {message ? <p className="text-xs text-slate-500">{message}</p> : null}
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
          <Loader2 className="size-3.5 animate-spin" />
          处理中
        </span>
        {message ? <p className="text-xs text-slate-500">{message}</p> : null}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">处理失败</span>
        {message ? <p className="text-xs text-red-500">{message}</p> : null}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="size-3.5" />
      可用
    </span>
  );
};

function UploadingNotice({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
          <Loader2 className="size-5 animate-spin" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-900">{title}</p>
          <p className="mt-1 text-sm leading-6 text-blue-700">{description}</p>
        </div>
      </div>
    </div>
  );
}

const modeMeta = {
  audio: {
    label: "音频",
    pluralLabel: "音频",
    libraryLabel: "音频库",
    folderLabel: "音频文件夹",
    countLabel: "音频数",
    uploadAccept: "audio/*",
    icon: Upload,
  },
  video: {
    label: "视频",
    pluralLabel: "视频",
    libraryLabel: "视频库",
    folderLabel: "视频文件夹",
    countLabel: "视频数",
    uploadAccept: ".mp4,.mov,.m4v,.webm,.avi,.mkv",
    icon: VideoIcon,
  },
} satisfies Record<CourseType, { label: string; pluralLabel: string; libraryLabel: string; folderLabel: string; countLabel: string; uploadAccept: string; icon: typeof Upload }>;

const emptyAudioMeta: AudioLibraryMeta = { totalAudioCount: 0, referencedCount: 0, pendingScriptCount: 0, tagOptions: [] };
const emptyVideoMeta: VideoLibraryMeta = { totalVideoCount: 0, referencedCount: 0, pendingScriptCount: 0, tagOptions: [] };

export function AudioLibrary() {
  const location = useLocation();
  const mode: CourseType = location.pathname.startsWith("/admin/video-library") ? "video" : "audio";
  const metaLabels = modeMeta[mode];
  const TitleIcon = metaLabels.icon;
  const handoutInputRef = useRef<HTMLInputElement | null>(null);

  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [meta, setMeta] = useState<MediaMeta>(mode === "video" ? emptyVideoMeta : emptyAudioMeta);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [refFilter, setRefFilter] = useState<RefFilter>("all");
  const [scriptFilter, setScriptFilter] = useState<ScriptFilter>("all");
  const [searchScope, setSearchScope] = useState<SearchScope>("current");
  const [sortMode, setSortMode] = useState<SortMode>("uploaded-desc");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showSingleUploadDialog, setShowSingleUploadDialog] = useState(false);
  const [showBatchUploadDialog, setShowBatchUploadDialog] = useState(false);
  const [showEditNameDialog, setShowEditNameDialog] = useState(false);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [showHandoutDialog, setShowHandoutDialog] = useState(false);
  const [showAddCourseDialog, setShowAddCourseDialog] = useState(false);
  const [showMoveFolderDialog, setShowMoveFolderDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<MediaFolder | null>(null);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [folderName, setFolderName] = useState("");
  const [itemName, setItemName] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [handoutUrl, setHandoutUrl] = useState("");
  const [handoutObjectKey, setHandoutObjectKey] = useState("");
  const [handoutName, setHandoutName] = useState("");
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [targetCourseId, setTargetCourseId] = useState("");
  const [targetTagId, setTargetTagId] = useState("");
  const [targetTags, setTargetTags] = useState<Tag[]>([]);
  const [targetFolderId, setTargetFolderId] = useState("");
  const [singleUploading, setSingleUploading] = useState(false);
  const [batchUploading, setBatchUploading] = useState(false);
  const [handoutUploading, setHandoutUploading] = useState(false);

  const deferredKeyword = useDeferredValue(keyword.trim());
  const selectedFolder = useMemo(() => folders.find((folder) => folder.id === selectedFolderId) ?? null, [folders, selectedFolderId]);
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);
  const selectedContainsUnscripted = selectedItems.some((item) => !item.hasScript);
  const selectedContainsUnready = mode === "audio" && selectedItems.some((item) => isAudioItem(item) && item.processStatus !== "ready");
  const hasProcessingItems = mode === "audio" && items.some((item) => isAudioItem(item) && item.processStatus !== "ready");
  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));
  const summary = useMemo(
    () => ({
      folderCount: folders.length,
      totalCount: isVideoMeta(meta) ? meta.totalVideoCount : meta.totalAudioCount,
      referencedCount: meta.referencedCount,
      pendingScriptCount: meta.pendingScriptCount,
    }),
    [folders.length, meta],
  );

  const loadFolders = async () => {
    const data = mode === "video" ? await mockApi.getVideoFolders() : await mockApi.getFolders();
    setFolders(data);
    return data;
  };

  const loadMeta = async () => {
    const data = mode === "video" ? await mockApi.getVideoLibraryMeta() : await mockApi.getAudioLibraryMeta();
    setMeta(data);
    return data;
  };

  const loadLibraryList = async (options?: { page?: number; folderId?: string; silent?: boolean }) => {
    const currentPage = options?.page ?? page;
    const currentFolderId = options?.folderId ?? selectedFolderId;
    if (!options?.silent) setListLoading(true);

    try {
      if (mode === "video") {
        const result = await mockApi.getVideoLibraryItems({
          folderId: searchScope === "current" ? currentFolderId : undefined,
          keyword: deferredKeyword,
          courseId: courseFilter,
          tagId: tagFilter,
          refFilter,
          scriptFilter,
          searchScope,
          sortMode,
          page: currentPage,
          pageSize: PAGE_SIZE,
        });
        setItems(result.items);
        setTotalItems(result.total);
        setTotalPages(result.totalPages);
        if (result.page !== currentPage) setPage(result.page);
        return;
      }

      const result = await mockApi.getAudioLibraryItems({
        folderId: searchScope === "current" ? currentFolderId : undefined,
        keyword: deferredKeyword,
        courseId: courseFilter,
        tagId: tagFilter,
        refFilter,
        scriptFilter,
        searchScope,
        sortMode,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotalItems(result.total);
      setTotalPages(result.totalPages);
      if (result.page !== currentPage) setPage(result.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `加载${metaLabels.libraryLabel}失败`);
    } finally {
      if (!options?.silent) setListLoading(false);
    }
  };

  const refreshLibrary = async (options?: { includeFolders?: boolean; includeMeta?: boolean; page?: number }) => {
    const tasks: Promise<unknown>[] = [loadLibraryList({ page: options?.page })];
    if (options?.includeFolders) tasks.push(loadFolders());
    if (options?.includeMeta) tasks.push(loadMeta());
    await Promise.all(tasks);
  };

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        const [folderData, courseData, metaData] = await Promise.all([loadFolders(), mockApi.getAllCourses(), loadMeta()]);
        setCourses(courseData.filter((course) => (course.courseType ?? "audio") === mode));
        setMeta(metaData);
        setSelectedFolderId((current) => (folderData.length === 0 ? "" : folderData.some((folder) => folder.id === current) ? current : folderData[0].id));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `加载${metaLabels.libraryLabel}失败`);
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, [mode]);

  useEffect(() => {
    if (loading) return;
    void loadLibraryList();
  }, [loading, mode, selectedFolderId, deferredKeyword, courseFilter, tagFilter, refFilter, scriptFilter, searchScope, sortMode, page]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  useEffect(() => {
    if (loading || !hasProcessingItems) return;
    const timer = window.setInterval(() => {
      void loadLibraryList({ page, silent: true });
      void loadMeta();
      void loadFolders();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [deferredKeyword, hasProcessingItems, loading, page, selectedFolderId, courseFilter, tagFilter, refFilter, scriptFilter, searchScope, sortMode]);

  const resetFilters = () => {
    setKeyword("");
    setCourseFilter("all");
    setTagFilter("all");
    setRefFilter("all");
    setScriptFilter("all");
    setSearchScope("current");
    setSortMode("uploaded-desc");
    setPage(1);
    setSelectedIds([]);
  };

  const loadScriptFromFile = async (file: File | null, applyText: (value: string) => void) => {
    if (!file) return;
    try {
      const result = await mockApi.extractScriptFile(file);
      applyText(result.text);
      toast.success(`文案文件已导入：${file.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "文案文件读取失败");
    }
  };

  const toggleSelectItem = (itemId: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, itemId])) : current.filter((id) => id !== itemId)));
  };

  const handleFolderSave = async () => {
    if (!folderName.trim()) return toast.error("请输入文件夹名称");

    try {
      if (editingFolder) {
        const updated = mode === "video" ? await mockApi.updateVideoFolder(editingFolder.id, folderName.trim()) : await mockApi.updateFolder(editingFolder.id, folderName.trim());
        setFolders((current) => current.map((folder) => (folder.id === updated.id ? updated : folder)));
        setItems((current) => current.map((item) => (item.folderId === updated.id ? { ...item, folderName: updated.name } : item)));
        toast.success("文件夹已更新");
      } else {
        const created = mode === "video" ? await mockApi.createVideoFolder(folderName.trim()) : await mockApi.createFolder(folderName.trim());
        setFolders((current) => [...current, created]);
        setSelectedFolderId(created.id);
        setPage(1);
        setSelectedIds([]);
        toast.success("文件夹已创建");
      }

      setShowFolderDialog(false);
      setEditingFolder(null);
      setFolderName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存文件夹失败");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      if (mode === "video") {
        await mockApi.deleteVideoFolder(folderId);
      } else {
        await mockApi.deleteFolder(folderId);
      }
      const folderData = await loadFolders();
      setSelectedFolderId(folderData.some((folder) => folder.id === selectedFolderId) ? selectedFolderId : (folderData[0]?.id ?? ""));
      setPage(1);
      setSelectedIds([]);
      toast.success("文件夹已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除文件夹失败");
    }
  };

  const handleSingleUpload = async () => {
    if (!singleFile || !selectedFolderId) return toast.error(`请选择${metaLabels.folderLabel}和${metaLabels.label}文件`);
    setSingleUploading(true);
    try {
      if (mode === "video") {
        await mockApi.uploadVideoToLibrary(selectedFolderId, [singleFile], scriptText);
      } else {
        await mockApi.uploadAudioToLibrary(selectedFolderId, [singleFile], scriptText);
      }
      setShowSingleUploadDialog(false);
      setSingleFile(null);
      setScriptText("");
      setPage(1);
      setSelectedIds([]);
      await refreshLibrary({ includeFolders: true, includeMeta: true, page: 1 });
      toast.success(`${metaLabels.label}已加入后台处理队列`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `上传${metaLabels.label}失败`);
    } finally {
      setSingleUploading(false);
    }
  };

  const handleBatchUpload = async () => {
    if (!batchFiles.length || !selectedFolderId) return toast.error(`请选择${metaLabels.folderLabel}和${metaLabels.label}文件`);
    setBatchUploading(true);
    try {
      if (mode === "video") {
        await mockApi.uploadVideoToLibrary(selectedFolderId, batchFiles);
      } else {
        await mockApi.uploadAudioToLibrary(selectedFolderId, batchFiles);
      }
      setShowBatchUploadDialog(false);
      setBatchFiles([]);
      setPage(1);
      setSelectedIds([]);
      await refreshLibrary({ includeFolders: true, includeMeta: true, page: 1 });
      toast.success(`${metaLabels.pluralLabel}已加入后台处理队列`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `批量上传${metaLabels.pluralLabel}失败`);
    } finally {
      setBatchUploading(false);
    }
  };

  const handleSaveItemName = async () => {
    if (!editingItem || !itemName.trim()) return toast.error(`请输入${metaLabels.label}名称`);
    try {
      if (mode === "video") {
        await mockApi.updateVideoName(editingItem.id, itemName.trim());
      } else {
        await mockApi.updateAudioName(editingItem.id, itemName.trim());
      }
      setShowEditNameDialog(false);
      setEditingItem(null);
      await loadLibraryList({ page });
      toast.success(`${metaLabels.label}名称已更新`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `更新${metaLabels.label}名称失败`);
    }
  };

  const handleSaveScript = async () => {
    if (!editingItem) return;
    try {
      if (mode === "video") {
        await mockApi.updateVideoScript(editingItem.id, scriptText);
      } else {
        await mockApi.updateAudioScript(editingItem.id, scriptText);
      }
      setShowScriptDialog(false);
      setEditingItem(null);
      setScriptText("");
      await refreshLibrary({ includeMeta: true, page });
      toast.success("文案已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存文案失败");
    }
  };

  const syncHandoutState = (updatedItem: {
    id: string;
    handoutUrl?: string;
    handoutObjectKey?: string;
    handoutName?: string;
    hasHandout?: boolean;
  }) => {
    setItems((current) =>
      current.map((item) =>
        item.id === updatedItem.id
          ? {
              ...item,
              handoutUrl: updatedItem.handoutUrl ?? "",
              handoutObjectKey: updatedItem.handoutObjectKey ?? "",
              handoutName: updatedItem.handoutName ?? "",
              hasHandout: Boolean(updatedItem.hasHandout),
            }
          : item,
      ),
    );

    setEditingItem((current) =>
      current && current.id === updatedItem.id
        ? {
            ...current,
            handoutUrl: updatedItem.handoutUrl ?? "",
            handoutObjectKey: updatedItem.handoutObjectKey ?? "",
            handoutName: updatedItem.handoutName ?? "",
            hasHandout: Boolean(updatedItem.hasHandout),
          }
        : current,
    );
  };

  const openHandoutDialog = (item: MediaItem) => {
    setEditingItem(item);
    setHandoutUrl(item.handoutUrl ?? "");
    setHandoutObjectKey(item.handoutObjectKey ?? "");
    setHandoutName(item.handoutName ?? "");
    setShowHandoutDialog(true);
  };

  const handleHandoutUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editingItem) return;
    setHandoutUploading(true);
    try {
      const uploaded = await mockApi.uploadAudioHandout(file);
      const updated =
        mode === "video"
          ? await mockApi.updateVideoHandout(editingItem.id, {
              handoutUrl: uploaded.url,
              handoutObjectKey: uploaded.objectKey,
              handoutName: file.name,
            })
          : await mockApi.updateAudioHandout(editingItem.id, {
              handoutUrl: uploaded.url,
              handoutObjectKey: uploaded.objectKey,
              handoutName: file.name,
            });

      setHandoutUrl(updated.handoutUrl ?? "");
      setHandoutObjectKey(updated.handoutObjectKey ?? "");
      setHandoutName(updated.handoutName ?? "");
      syncHandoutState(updated);
      toast.success("讲义已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "讲义上传失败");
    } finally {
      setHandoutUploading(false);
    }
  };

  const handleClearHandout = async () => {
    if (!editingItem || handoutUploading) return;
    try {
      const updated =
        mode === "video"
          ? await mockApi.updateVideoHandout(editingItem.id, { handoutUrl: null, handoutObjectKey: null, handoutName: null })
          : await mockApi.updateAudioHandout(editingItem.id, { handoutUrl: null, handoutObjectKey: null, handoutName: null });

      setHandoutUrl("");
      setHandoutObjectKey("");
      setHandoutName("");
      syncHandoutState(updated);
      toast.success("讲义已移除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除讲义失败");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm(`确定删除该${metaLabels.label}吗？未被引用的内容删除后不可恢复。`)) return;
    try {
      if (mode === "video") {
        await mockApi.deleteVideo(itemId);
      } else {
        await mockApi.deleteAudio(itemId);
      }
      setSelectedIds((current) => current.filter((id) => id !== itemId));
      await refreshLibrary({ includeFolders: true, includeMeta: true, page });
      toast.success(`${metaLabels.label}已删除`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `删除${metaLabels.label}失败`);
    }
  };

  const handleCourseChange = async (courseId: string) => {
    setTargetCourseId(courseId);
    setTargetTagId("");
    if (!courseId) {
      setTargetTags([]);
      return;
    }
    try {
      const detail = await mockApi.getCourseDetail(courseId);
      setTargetTags(detail.tags);
    } catch {
      setTargetTags([]);
      toast.error("加载课程标签失败");
    }
  };

  const handleAddToCourse = async () => {
    if (!targetCourseId || !targetTagId || selectedIds.length === 0) {
      toast.error("请选择课程、标签和待加入内容");
      return;
    }
    try {
      if (mode === "video") {
        await mockApi.addVideoToCourse(targetCourseId, targetTagId, selectedIds);
      } else {
        await mockApi.addAudioToCourse(targetCourseId, targetTagId, selectedIds);
      }
      setShowAddCourseDialog(false);
      setTargetCourseId("");
      setTargetTagId("");
      setTargetTags([]);
      setSelectedIds([]);
      await refreshLibrary({ includeMeta: true, page });
      toast.success(`${metaLabels.pluralLabel}已加入课程`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `加入课程失败`);
    }
  };

  const handleMoveFolder = async () => {
    if (!targetFolderId || selectedIds.length === 0) {
      toast.error("请选择目标文件夹");
      return;
    }
    try {
      if (mode === "video") {
        await mockApi.moveVideosToFolder(selectedIds, targetFolderId);
      } else {
        await mockApi.moveAudiosToFolder(selectedIds, targetFolderId);
      }
      setShowMoveFolderDialog(false);
      setTargetFolderId("");
      setSelectedIds([]);
      await refreshLibrary({ includeFolders: true, page });
      toast.success("文件夹已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移动文件夹失败");
    }
  };

  if (loading) return <div className="p-8 text-slate-500">{metaLabels.libraryLabel}加载中...</div>;

  return (
    <>
      <div className="p-8">
        <div className="rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <TitleIcon className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{metaLabels.libraryLabel}管理</h1>
                <p className="mt-2 text-sm text-slate-500">维护{metaLabels.folderLabel}、上传{metaLabels.pluralLabel}、补充文案与讲义，并可批量加入课程。</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-8 py-6">
            <div className="grid gap-4 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">文件夹数量</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.folderCount}</p>
                <p className="mt-2 text-sm text-slate-500">当前{metaLabels.libraryLabel}一级文件夹总数</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm text-emerald-700">{metaLabels.countLabel}</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-800">{summary.totalCount}</p>
                <p className="mt-2 text-sm text-emerald-700">全部已上传{metaLabels.pluralLabel}数量</p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-sm text-blue-700">已被课程引用</p>
                <p className="mt-2 text-3xl font-semibold text-blue-900">{summary.referencedCount}</p>
                <p className="mt-2 text-sm text-blue-700">至少被一个课程标签引用的内容数</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm text-amber-700">待补文案</p>
                <p className="mt-2 text-3xl font-semibold text-amber-900">{summary.pendingScriptCount}</p>
                <p className="mt-2 text-sm text-amber-800">尚未上传完整文案的内容数</p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">{metaLabels.folderLabel}</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">文件夹列表</h2>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingFolder(null);
                      setFolderName("");
                      setShowFolderDialog(true);
                    }}
                  >
                    <FolderPlus className="size-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => {
                        setSelectedFolderId(folder.id);
                        setPage(1);
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selectedFolderId === folder.id ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">{folder.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{isAudioFolder(folder) ? folder.audioCount : folder.videoCount} 条内容</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingFolder(folder);
                              setFolderName(folder.name);
                              setShowFolderDialog(true);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteFolder(folder.id);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </button>
                  ))}

                  {folders.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">暂无文件夹</div> : null}
                </div>
              </div>

              <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-blue-600">{metaLabels.libraryLabel}</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900">{selectedFolder?.name ?? "全部内容"}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setShowMoveFolderDialog(true)} disabled={selectedIds.length === 0}>
                      <MoveRight className="mr-2 size-4" />
                      移动文件夹
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddCourseDialog(true)} disabled={selectedIds.length === 0 || selectedContainsUnscripted || selectedContainsUnready}>
                      <Plus className="mr-2 size-4" />
                      加入课程
                    </Button>
                    <Button variant="outline" onClick={() => setShowBatchUploadDialog(true)} disabled={!selectedFolderId}>
                      <Upload className="mr-2 size-4" />
                      批量上传
                    </Button>
                    <Button onClick={() => setShowSingleUploadDialog(true)} disabled={!selectedFolderId}>
                      <Upload className="mr-2 size-4" />
                      单个上传
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <div className="relative xl:col-span-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input className="pl-9" placeholder={`搜索${metaLabels.label}名称`} value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} />
                  </div>
                  <Select value={courseFilter} onValueChange={(value) => { setCourseFilter(value); setPage(1); }}>
                    <SelectTrigger><SelectValue placeholder="课程筛选" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部课程</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={tagFilter} onValueChange={(value) => { setTagFilter(value); setPage(1); }}>
                    <SelectTrigger><SelectValue placeholder="标签筛选" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部标签</SelectItem>
                      {meta.tagOptions.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={refFilter} onValueChange={(value: RefFilter) => { setRefFilter(value); setPage(1); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部引用状态</SelectItem>
                      <SelectItem value="referenced">已引用</SelectItem>
                      <SelectItem value="unreferenced">未引用</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={scriptFilter} onValueChange={(value: ScriptFilter) => { setScriptFilter(value); setPage(1); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部文案状态</SelectItem>
                      <SelectItem value="scripted">已上传文案</SelectItem>
                      <SelectItem value="unscripted">未上传文案</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                  <Select value={searchScope} onValueChange={(value: SearchScope) => { setSearchScope(value); setPage(1); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">当前文件夹</SelectItem>
                      <SelectItem value="all">全库搜索</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortMode} onValueChange={(value: SortMode) => { setSortMode(value); setPage(1); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uploaded-desc">按上传时间倒序</SelectItem>
                      <SelectItem value="name-asc">按名称排序</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:col-span-2">
                    共 {totalItems} 条，已选择 {selectedIds.length} 条
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    重置筛选
                  </Button>
                  {selectedContainsUnscripted ? <span className="text-sm text-amber-600">已选内容中存在未上传文案项，暂不可加入课程。</span> : null}
                  {selectedContainsUnready ? <span className="text-sm text-amber-600">已选音频中存在未处理完成项，暂不可加入课程。</span> : null}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[56px]">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={(checked) => {
                                setSelectedIds(checked ? items.map((item) => item.id) : []);
                              }}
                            />
                          </TableHead>
                          <TableHead>{metaLabels.label}名称</TableHead>
                          <TableHead>文件夹</TableHead>
                          <TableHead>课程</TableHead>
                          <TableHead>标签</TableHead>
                          <TableHead>上传时间</TableHead>
                          <TableHead>时长</TableHead>
                          <TableHead>处理状态</TableHead>
                          <TableHead>文案</TableHead>
                          <TableHead>讲义</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listLoading ? (
                          <TableRow>
                            <TableCell colSpan={11} className="py-16 text-center text-slate-500">{metaLabels.libraryLabel}加载中...</TableCell>
                          </TableRow>
                        ) : null}

                        {!listLoading && items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={(checked) => toggleSelectItem(item.id, Boolean(checked))} />
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[280px]">
                                <div className="truncate font-medium text-slate-900">{item.name}</div>
                              </div>
                            </TableCell>
                            <TableCell>{item.folderName}</TableCell>
                            <TableCell>
                              <div className="flex max-w-[220px] flex-wrap gap-2 whitespace-normal">
                                {item.courseRefs.length === 0 ? (
                                  <span className="text-sm text-slate-400">未引用</span>
                                ) : (
                                  Array.from(new Set(item.courseRefs.map((ref) => ref.courseName))).map((name) => (
                                    <Badge key={name} variant="secondary" className="bg-blue-50 text-blue-700">{name}</Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex max-w-[220px] flex-wrap gap-2 whitespace-normal">
                                {item.courseRefs.length === 0 ? (
                                  <span className="text-sm text-slate-400">无标签</span>
                                ) : (
                                  Array.from(new Set(item.courseRefs.map((ref) => ref.tagName))).map((name) => (
                                    <Badge key={name} variant="outline" className="border-slate-200 text-slate-600">{name}</Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{item.uploadedAt}</TableCell>
                            <TableCell>{formatDuration(item.duration)}</TableCell>
                            <TableCell>{mode === "video" ? getProcessBadge("ready") : getProcessBadge((item as AudioLibraryItem).processStatus, (item as AudioLibraryItem).processMessage)}</TableCell>
                            <TableCell>
                              {item.hasScript ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                  <CheckCircle2 className="size-3.5" />
                                  已上传文案
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                                  <FileText className="size-3.5" />
                                  未上传文案
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.hasHandout ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                                  <FileText className="size-3.5" />
                                  已上传
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">未上传</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => { setEditingItem(item); setItemName(item.name); setShowEditNameDialog(true); }}>
                                  <Pencil className="mr-2 size-4" />
                                  改名
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setEditingItem(item); setScriptText(item.script ?? ""); setShowScriptDialog(true); }}>
                                  <FileText className="mr-2 size-4" />
                                  文案
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => openHandoutDialog(item)}>
                                  <FileText className="mr-2 size-4" />
                                  讲义
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => void handleDeleteItem(item.id)}>
                                  <Trash2 className="mr-2 size-4" />
                                  删除
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}

                        {!listLoading && items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="py-16 text-center text-slate-500">
                              {searchScope === "current" && !selectedFolderId ? "请先选择文件夹" : `暂无${metaLabels.pluralLabel}数据`}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-500">第 {page} / {totalPages} 页，每页 {PAGE_SIZE} 条</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1 || listLoading} onClick={() => setPage((current) => Math.max(current - 1, 1))}>上一页</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages || listLoading} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>下一页</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolder ? "编辑文件夹" : "新建文件夹"}</DialogTitle>
            <DialogDescription>{metaLabels.libraryLabel}仅支持一级文件夹，用于引用时快速定位内容。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>文件夹名称</Label>
            <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="请输入文件夹名称" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>取消</Button>
            <Button onClick={() => void handleFolderSave()}>{editingFolder ? "保存文件夹" : "创建文件夹"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSingleUploadDialog} onOpenChange={(open) => { if (singleUploading) return; setShowSingleUploadDialog(open); if (!open) { setSingleFile(null); setScriptText(""); } }}>
        <DialogContent className="grid max-h-[85vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <DialogHeader>
            <DialogTitle>单个上传{metaLabels.label}</DialogTitle>
            <DialogDescription>单个上传可同步上传文案，也可后续在{metaLabels.libraryLabel}继续编辑。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto py-1 pr-1">
            {singleUploading ? <UploadingNotice title={`${metaLabels.label}正在上传`} description={`系统正在处理${metaLabels.label}文件和文案，请稍等。`} /> : null}
            <div className="space-y-2">
              <Label>{metaLabels.label}文件</Label>
              <Input type="file" accept={metaLabels.uploadAccept} disabled={singleUploading} onChange={(event) => setSingleFile(event.target.files?.[0] ?? null)} />
              {singleFile ? <p className="text-xs text-slate-500">已选择：{singleFile.name}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>文案文件</Label>
              <Input type="file" accept=".txt,.md,.text,.srt,.lrc,.doc,.docx" disabled={singleUploading} onChange={(event) => void loadScriptFromFile(event.target.files?.[0] ?? null, setScriptText)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>文案内容</Label>
                <span className="text-xs text-slate-400">{scriptText.length} 字</span>
              </div>
              <Textarea value={scriptText} disabled={singleUploading} onChange={(event) => setScriptText(event.target.value)} rows={12} className="min-h-[320px] max-h-[45vh] overflow-y-auto [field-sizing:fixed]" placeholder="可先留空，后续再补录文案" />
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setShowSingleUploadDialog(false)} disabled={singleUploading}>取消</Button>
            <Button onClick={() => void handleSingleUpload()} disabled={singleUploading || !singleFile}>
              {singleUploading ? <><Loader2 className="mr-2 size-4 animate-spin" />上传中...</> : "开始上传"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBatchUploadDialog} onOpenChange={(open) => { if (batchUploading) return; setShowBatchUploadDialog(open); if (!open) setBatchFiles([]); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>批量上传{metaLabels.pluralLabel}</DialogTitle>
            <DialogDescription>批量上传后默认使用文件名作为名称，文案后续逐条补录。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {batchUploading ? <UploadingNotice title={`${metaLabels.pluralLabel}正在上传`} description="系统正在批量处理文件，上传完成后会自动关闭当前窗口。" /> : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">当前文件夹：{selectedFolder?.name ?? "未选择"} | 已选择 {batchFiles.length} 个文件</div>
            <div className="space-y-2">
              <Label>{metaLabels.label}文件</Label>
              <Input type="file" accept={metaLabels.uploadAccept} multiple disabled={batchUploading} onChange={(event) => setBatchFiles(Array.from(event.target.files ?? []))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchUploadDialog(false)} disabled={batchUploading}>取消</Button>
            <Button onClick={() => void handleBatchUpload()} disabled={batchUploading || batchFiles.length === 0}>
              {batchUploading ? <><Loader2 className="mr-2 size-4 animate-spin" />上传中...</> : "开始上传"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditNameDialog} onOpenChange={setShowEditNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑{metaLabels.label}名称</DialogTitle>
            <DialogDescription>上传后默认取文件名，此处可改为正式展示名称。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>{metaLabels.label}名称</Label>
            <Input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={`请输入${metaLabels.label}名称`} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditNameDialog(false)}>取消</Button>
            <Button onClick={() => void handleSaveItemName()}>保存名称</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showScriptDialog} onOpenChange={(open) => { setShowScriptDialog(open); if (!open) { setEditingItem(null); setScriptText(""); } }}>
        <DialogContent className="grid max-h-[85vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <DialogHeader>
            <DialogTitle>编辑文案</DialogTitle>
            <DialogDescription>没有文案的内容不能被课程引用。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto py-1 pr-1">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">当前内容：{editingItem?.name ?? "未选择内容"}</div>
            <div className="space-y-2">
              <Label>文案文件</Label>
              <Input type="file" accept=".txt,.md,.text,.srt,.lrc,.doc,.docx" onChange={(event) => void loadScriptFromFile(event.target.files?.[0] ?? null, setScriptText)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>文案内容</Label>
                <span className="text-xs text-slate-400">{scriptText.length} 字</span>
              </div>
              <Textarea value={scriptText} onChange={(event) => setScriptText(event.target.value)} rows={14} className="min-h-[360px] max-h-[50vh] overflow-y-auto [field-sizing:fixed]" placeholder="请输入完整文案" />
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setShowScriptDialog(false)}>取消</Button>
            <Button onClick={() => void handleSaveScript()}>保存文案</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHandoutDialog} onOpenChange={(open) => { if (handoutUploading) return; setShowHandoutDialog(open); if (!open) { setEditingItem(null); setHandoutUrl(""); setHandoutObjectKey(""); setHandoutName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{metaLabels.label}讲义</DialogTitle>
            <DialogDescription>当前讲义会显示在用户端播放页的下载入口中。</DialogDescription>
          </DialogHeader>
          <input ref={handoutInputRef} type="file" accept={HANDOUT_ACCEPT} className="hidden" onChange={handleHandoutUpload} />
          <div className="space-y-4 py-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">当前内容：{editingItem?.name ?? "未选择内容"}</div>
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
              {handoutName ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{handoutName}</p>
                    <p className="mt-1 text-xs text-slate-500">上传后，用户可在当前播放页直接下载。</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {handoutUrl ? <Button type="button" variant="outline" size="sm" asChild><a href={handoutUrl} target="_blank" rel="noreferrer">查看</a></Button> : null}
                    <Button type="button" variant="outline" size="sm" onClick={() => handoutInputRef.current?.click()} disabled={handoutUploading}>{handoutUploading ? "上传中..." : "更换"}</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void handleClearHandout()} disabled={handoutUploading}>移除</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <FileText className="mb-3 size-7 text-blue-600" />
                  <p className="text-sm font-medium text-slate-900">{handoutUploading ? "讲义上传中..." : "点击上传讲义"}</p>
                  <p className="mt-2 text-xs text-slate-500">支持 PDF、Word、PPT、Excel、TXT、ZIP。</p>
                  <Button type="button" variant="outline" className="mt-4" onClick={() => handoutInputRef.current?.click()} disabled={handoutUploading}>选择讲义文件</Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHandoutDialog(false)} disabled={handoutUploading}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddCourseDialog} onOpenChange={setShowAddCourseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加到课程</DialogTitle>
            <DialogDescription>可批量选择内容后，添加到指定课程和标签。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">已选择 {selectedIds.length} 条内容</div>
            <div className="space-y-2">
              <Label>课程</Label>
              <Select value={targetCourseId} onValueChange={(value) => void handleCourseChange(value)}>
                <SelectTrigger><SelectValue placeholder="请选择课程" /></SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>标签</Label>
              <Select value={targetTagId} onValueChange={setTargetTagId}>
                <SelectTrigger><SelectValue placeholder="请选择标签" /></SelectTrigger>
                <SelectContent>
                  {targetTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCourseDialog(false)}>取消</Button>
            <Button onClick={() => void handleAddToCourse()}>确认添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveFolderDialog} onOpenChange={setShowMoveFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移动文件夹</DialogTitle>
            <DialogDescription>可将已选内容移动到其他一级文件夹中，便于后续统一整理。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">已选择 {selectedIds.length} 条内容</div>
            <div className="space-y-2">
              <Label>目标文件夹</Label>
              <Select value={targetFolderId} onValueChange={setTargetFolderId}>
                <SelectTrigger><SelectValue placeholder="请选择目标文件夹" /></SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveFolderDialog(false)}>取消</Button>
            <Button onClick={() => void handleMoveFolder()}>确认移动</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
