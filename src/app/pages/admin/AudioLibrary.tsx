import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, FolderOpen, FolderPlus, Loader2, MoveRight, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
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
import { AudioLibraryItem, AudioLibraryMeta, Course, Folder, Tag, mockApi } from "../../lib/mockData";

type SearchScope = "current" | "all";
type RefFilter = "all" | "referenced" | "unreferenced";
type ScriptFilter = "all" | "scripted" | "unscripted";
type SortMode = "uploaded-desc" | "name-asc";

const PAGE_SIZE = 15;
const emptyMeta: AudioLibraryMeta = { totalAudioCount: 0, referencedCount: 0, pendingScriptCount: 0, tagOptions: [] };

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
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
          <div className="mt-4 flex items-center gap-2">
            <span className="h-2 flex-1 rounded-full bg-blue-200" />
            <span className="h-2 flex-1 animate-pulse rounded-full bg-blue-400 [animation-delay:120ms]" />
            <span className="h-2 flex-1 animate-pulse rounded-full bg-blue-300 [animation-delay:240ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AudioLibrary() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [items, setItems] = useState<AudioLibraryItem[]>([]);
  const [meta, setMeta] = useState<AudioLibraryMeta>(emptyMeta);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedAudioIds, setSelectedAudioIds] = useState<string[]>([]);
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
  const [showAddCourseDialog, setShowAddCourseDialog] = useState(false);
  const [showMoveFolderDialog, setShowMoveFolderDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editingAudio, setEditingAudio] = useState<AudioLibraryItem | null>(null);
  const [folderName, setFolderName] = useState("");
  const [audioName, setAudioName] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [targetCourseId, setTargetCourseId] = useState("");
  const [targetTagId, setTargetTagId] = useState("");
  const [targetTags, setTargetTags] = useState<Tag[]>([]);
  const [targetFolderId, setTargetFolderId] = useState("");
  const [singleUploading, setSingleUploading] = useState(false);
  const [batchUploading, setBatchUploading] = useState(false);
  const deferredKeyword = useDeferredValue(keyword.trim());

  const selectedFolder = useMemo(() => folders.find((folder) => folder.id === selectedFolderId) ?? null, [folders, selectedFolderId]);
  const selectedItems = useMemo(() => items.filter((item) => selectedAudioIds.includes(item.id)), [items, selectedAudioIds]);
  const selectedContainsUnscripted = selectedItems.some((item) => !item.hasScript);
  const allSelected = items.length > 0 && items.every((item) => selectedAudioIds.includes(item.id));
  const summary = useMemo(
    () => ({ folderCount: folders.length, totalAudioCount: meta.totalAudioCount, referencedCount: meta.referencedCount, pendingScriptCount: meta.pendingScriptCount }),
    [folders.length, meta.pendingScriptCount, meta.referencedCount, meta.totalAudioCount],
  );

  const loadFolders = async () => {
    const folderData = await mockApi.getFolders();
    setFolders(folderData);
    return folderData;
  };

  const loadMeta = async () => {
    const metaData = await mockApi.getAudioLibraryMeta();
    setMeta(metaData);
    return metaData;
  };

  const loadLibraryList = async (options?: { page?: number; folderId?: string; silent?: boolean }) => {
    const currentPage = options?.page ?? page;
    const currentFolderId = options?.folderId ?? selectedFolderId;
    if (!options?.silent) setListLoading(true);

    try {
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
      toast.error(error instanceof Error ? error.message : "加载音频库失败");
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
        const [folderData, courseData, metaData] = await Promise.all([mockApi.getFolders(), mockApi.getAllCourses(), mockApi.getAudioLibraryMeta()]);
        setFolders(folderData);
        setCourses(courseData);
        setMeta(metaData);
        setSelectedFolderId((prev) => (folderData.length === 0 ? "" : folderData.some((folder) => folder.id === prev) ? prev : folderData[0].id));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载音频库失败");
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, []);

  useEffect(() => {
    if (loading) return;
    void loadLibraryList();
  }, [loading, selectedFolderId, deferredKeyword, courseFilter, tagFilter, refFilter, scriptFilter, searchScope, sortMode, page]);

  useEffect(() => {
    setSelectedAudioIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const resetFilters = () => {
    setKeyword("");
    setCourseFilter("all");
    setTagFilter("all");
    setRefFilter("all");
    setScriptFilter("all");
    setSearchScope("current");
    setSortMode("uploaded-desc");
    setPage(1);
    setSelectedAudioIds([]);
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

  const toggleSelectAudio = (audioId: string, checked: boolean) => {
    setSelectedAudioIds((prev) => (checked ? Array.from(new Set([...prev, audioId])) : prev.filter((id) => id !== audioId)));
  };

  const handleFolderSave = async () => {
    if (!folderName.trim()) return toast.error("请输入文件夹名称");

    try {
      if (editingFolder) {
        const updatedFolder = await mockApi.updateFolder(editingFolder.id, folderName.trim());
        setFolders((prev) => prev.map((folder) => (folder.id === updatedFolder.id ? { ...folder, name: updatedFolder.name } : folder)));
        setItems((prev) => prev.map((item) => (item.folderId === updatedFolder.id ? { ...item, folderName: updatedFolder.name } : item)));
        toast.success("文件夹已更新");
      } else {
        const createdFolder = await mockApi.createFolder(folderName.trim());
        setFolders((prev) => [...prev, createdFolder]);
        setSelectedFolderId(createdFolder.id);
        setPage(1);
        setSelectedAudioIds([]);
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
      await mockApi.deleteFolder(folderId);
      const folderData = await loadFolders();
      setSelectedFolderId(folderData.some((folder) => folder.id === selectedFolderId) ? selectedFolderId : (folderData[0]?.id ?? ""));
      setPage(1);
      setSelectedAudioIds([]);
      toast.success("文件夹已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除文件夹失败");
    }
  };

  const handleSingleUpload = async () => {
    if (!singleFile || !selectedFolderId) return toast.error("请选择文件夹和音频文件");
    setSingleUploading(true);

    try {
      await mockApi.uploadAudioToLibrary(selectedFolderId, [singleFile], scriptText);
      setShowSingleUploadDialog(false);
      setSingleFile(null);
      setScriptText("");
      setPage(1);
      setSelectedAudioIds([]);
      await refreshLibrary({ includeFolders: true, includeMeta: true, page: 1 });
      toast.success("音频上传成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传音频失败");
    } finally {
      setSingleUploading(false);
    }
  };

  const handleBatchUpload = async () => {
    if (!batchFiles.length || !selectedFolderId) return toast.error("请选择文件夹和音频文件");
    setBatchUploading(true);

    try {
      await mockApi.uploadAudioToLibrary(selectedFolderId, batchFiles);
      setShowBatchUploadDialog(false);
      setBatchFiles([]);
      setPage(1);
      setSelectedAudioIds([]);
      await refreshLibrary({ includeFolders: true, includeMeta: true, page: 1 });
      toast.success("批量上传成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量上传失败");
    } finally {
      setBatchUploading(false);
    }
  };

  const handleSaveAudioName = async () => {
    if (!editingAudio || !audioName.trim()) return toast.error("请输入音频名称");

    try {
      await mockApi.updateAudioName(editingAudio.id, audioName.trim());
      setShowEditNameDialog(false);
      setEditingAudio(null);
      await loadLibraryList({ page });
      toast.success("音频名称已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新音频名称失败");
    }
  };

  const handleSaveScript = async () => {
    if (!editingAudio) return;

    try {
      await mockApi.updateAudioScript(editingAudio.id, scriptText);
      setShowScriptDialog(false);
      setEditingAudio(null);
      setScriptText("");
      await refreshLibrary({ includeMeta: true, page });
      toast.success("文案已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存文案失败");
    }
  };

  const handleDeleteAudio = async (audioId: string) => {
    if (!window.confirm("确定删除该音频吗？未被引用的音频删除后不可恢复。")) return;

    try {
      await mockApi.deleteAudio(audioId);
      setSelectedAudioIds((prev) => prev.filter((id) => id !== audioId));
      await refreshLibrary({ includeFolders: true, includeMeta: true, page });
      toast.success("音频已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除音频失败");
    }
  };

  const handleCourseChange = async (courseId: string) => {
    setTargetCourseId(courseId);
    setTargetTagId("");
    try {
      const detail = await mockApi.getCourseDetail(courseId);
      setTargetTags(detail.tags);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载课程标签失败");
    }
  };

  const handleAddToCourse = async () => {
    if (!targetCourseId || !targetTagId || selectedAudioIds.length === 0) return toast.error("请选择课程、标签和音频");
    if (selectedContainsUnscripted) return toast.error("没有文案的音频不能被引用");

    try {
      await mockApi.addAudioToCourse(targetCourseId, targetTagId, selectedAudioIds);
      setShowAddCourseDialog(false);
      setSelectedAudioIds([]);
      await refreshLibrary({ includeMeta: true, page });
      toast.success("音频已加入课程");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加到课程失败");
    }
  };

  const handleMoveFolder = async () => {
    if (!selectedAudioIds.length || !targetFolderId) return toast.error("请选择音频和目标文件夹");

    try {
      await mockApi.moveAudiosToFolder(selectedAudioIds, targetFolderId);
      setShowMoveFolderDialog(false);
      setTargetFolderId("");
      setSelectedAudioIds([]);
      await refreshLibrary({ includeFolders: true, page });
      toast.success("音频已移动");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移动文件夹失败");
    }
  };

  if (loading) return <div className="p-8 text-slate-500">音频库加载中...</div>;

  return (
    <>
      <div className="p-8">
        <div className="rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-8 py-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">音频库管理</h1>
                <p className="mt-2 text-sm text-slate-500">维护一级文件夹、音频文案、课程引用关系和批量整理操作。</p>
              </div>
              <div className="rounded-full bg-slate-50 px-4 py-2 text-sm text-slate-600">
                当前筛选 {totalItems} 条，本页 {items.length} 条，已选 {selectedAudioIds.length} 条{listLoading ? "，列表更新中..." : ""}
              </div>
            </div>
          </div>

          <div className="space-y-6 px-8 py-6">
            <div className="grid gap-4 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">一级文件夹</p><p className="mt-2 text-3xl font-semibold text-slate-900">{summary.folderCount}</p><p className="mt-2 text-sm text-slate-500">仅支持一级文件夹</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">音频总数</p><p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalAudioCount}</p><p className="mt-2 text-sm text-slate-500">默认按上传时间倒序</p></div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm text-emerald-700">已被引用</p><p className="mt-2 text-3xl font-semibold text-emerald-800">{summary.referencedCount}</p><p className="mt-2 text-sm text-emerald-700">已关联到课程的音频</p></div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5"><p className="text-sm text-red-700">待补文案</p><p className="mt-2 text-3xl font-semibold text-red-800">{summary.pendingScriptCount}</p><p className="mt-2 text-sm text-red-700">无文案不能被课程引用</p></div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="flex h-[calc(100vh-14rem)] min-h-[820px] max-h-[980px] flex-col gap-4 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-blue-600">一级文件夹</p><h2 className="mt-1 text-lg font-semibold text-slate-900">文件夹列表</h2></div>
                  <Button size="sm" onClick={() => { setEditingFolder(null); setFolderName(""); setShowFolderDialog(true); }}><FolderPlus className="mr-2 size-4" />新建</Button>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">空文件夹可删除；有音频的文件夹不能删除。音频可在各文件夹之间移动。</div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {folders.map((folder) => (
                    <button key={folder.id} type="button" onClick={() => { setSelectedFolderId(folder.id); setPage(1); setSelectedAudioIds([]); }} className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedFolderId === folder.id ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium text-slate-900">{folder.name}</p><p className="mt-1 text-sm text-slate-500">{folder.audioCount} 条音频</p></div><FolderOpen className="size-4 shrink-0 text-slate-400" /></div>
                    </button>
                  ))}
                </div>
                {selectedFolder ? <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { setEditingFolder(selectedFolder); setFolderName(selectedFolder.name); setShowFolderDialog(true); }}><Pencil className="mr-2 size-4" />重命名</Button><Button variant="destructive" className="flex-1" onClick={() => void handleDeleteFolder(selectedFolder.id)}><Trash2 className="mr-2 size-4" />删除</Button></div> : null}
              </div>

              <div className="flex h-[calc(100vh-14rem)] min-h-[820px] max-h-[980px] flex-col gap-4 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6">
                <div className="shrink-0 flex flex-col gap-4 rounded-2xl bg-slate-50 px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
                  <div><p className="text-sm font-medium text-blue-600">音频工作区</p><h2 className="mt-1 text-xl font-semibold text-slate-900">{selectedFolder?.name ?? "请选择文件夹"}</h2><p className="mt-2 text-sm text-slate-500">{searchScope === "current" ? "当前为当前文件夹搜索模式。" : "当前为全库搜索模式。"}</p></div>
                  <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowSingleUploadDialog(true)} disabled={!selectedFolderId}><Upload className="mr-2 size-4" />单个上传</Button><Button variant="outline" onClick={() => setShowBatchUploadDialog(true)} disabled={!selectedFolderId}><Upload className="mr-2 size-4" />批量上传</Button><Button variant="outline" onClick={() => setShowMoveFolderDialog(true)} disabled={!selectedAudioIds.length}><MoveRight className="mr-2 size-4" />移动文件夹</Button><Button onClick={() => { setTargetCourseId(""); setTargetTagId(""); setTargetTags([]); setShowAddCourseDialog(true); }} disabled={!selectedAudioIds.length}><Plus className="mr-2 size-4" />添加到课程</Button></div>
                </div>

                <div className="shrink-0 grid gap-3 xl:grid-cols-6">
                  <div className="xl:col-span-2"><Label className="mb-2 block">搜索</Label><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="按音频名称搜索" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); setSelectedAudioIds([]); }} /></div></div>
                  <div><Label className="mb-2 block">搜索范围</Label><Select value={searchScope} onValueChange={(value: SearchScope) => { setSearchScope(value); setPage(1); setSelectedAudioIds([]); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="current">当前文件夹</SelectItem><SelectItem value="all">全库搜索</SelectItem></SelectContent></Select></div>
                  <div><Label className="mb-2 block">所属课程</Label><Select value={courseFilter} onValueChange={(value) => { setCourseFilter(value); setPage(1); setSelectedAudioIds([]); }}><SelectTrigger><SelectValue placeholder="全部课程" /></SelectTrigger><SelectContent><SelectItem value="all">全部课程</SelectItem>{courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="mb-2 block">标签</Label><Select value={tagFilter} onValueChange={(value) => { setTagFilter(value); setPage(1); setSelectedAudioIds([]); }}><SelectTrigger><SelectValue placeholder="全部标签" /></SelectTrigger><SelectContent><SelectItem value="all">全部标签</SelectItem>{meta.tagOptions.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="mb-2 block">排序</Label><Select value={sortMode} onValueChange={(value: SortMode) => { setSortMode(value); setPage(1); setSelectedAudioIds([]); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="uploaded-desc">上传时间倒序</SelectItem><SelectItem value="name-asc">名称首字母</SelectItem></SelectContent></Select></div>
                </div>

                <div className="shrink-0 grid gap-3 xl:grid-cols-4">
                  <div><Label className="mb-2 block">是否被引用</Label><Select value={refFilter} onValueChange={(value: RefFilter) => { setRefFilter(value); setPage(1); setSelectedAudioIds([]); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="referenced">已引用</SelectItem><SelectItem value="unreferenced">未引用</SelectItem></SelectContent></Select></div>
                  <div><Label className="mb-2 block">文案状态</Label><Select value={scriptFilter} onValueChange={(value: ScriptFilter) => { setScriptFilter(value); setPage(1); setSelectedAudioIds([]); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="scripted">已上传文案</SelectItem><SelectItem value="unscripted">未上传文案</SelectItem></SelectContent></Select></div>
                  <div className="xl:col-span-2 flex items-end"><Button variant="outline" onClick={resetFilters}>重置筛选</Button></div>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">勾选后可批量添加到课程或移动文件夹。没有文案的音频不能被课程引用。</div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="h-full overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-slate-50">
                        <TableRow>
                          <TableHead className="w-12"><Checkbox checked={allSelected} onCheckedChange={(checked) => { if (checked) setSelectedAudioIds(Array.from(new Set([...selectedAudioIds, ...items.map((item) => item.id)]))); else setSelectedAudioIds((prev) => prev.filter((id) => !items.some((item) => item.id === id))); }} /></TableHead>
                          <TableHead>音频名称</TableHead>
                          <TableHead>所属课程</TableHead>
                          <TableHead>标签</TableHead>
                          <TableHead>上传时间</TableHead>
                          <TableHead>时长</TableHead>
                          <TableHead>文案状态</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell><Checkbox checked={selectedAudioIds.includes(item.id)} onCheckedChange={(checked) => toggleSelectAudio(item.id, Boolean(checked))} /></TableCell>
                            <TableCell><div className="min-w-[220px]"><div className="font-medium text-slate-900">{item.name}</div><div className="mt-1 text-xs text-slate-400">{item.folderName}</div></div></TableCell>
                            <TableCell><div className="flex max-w-[220px] flex-wrap gap-2 whitespace-normal">{item.courseRefs.length === 0 ? <span className="text-sm text-slate-400">未引用</span> : Array.from(new Set(item.courseRefs.map((ref) => ref.courseName))).map((name) => <Badge key={name} variant="secondary" className="bg-blue-50 text-blue-700">{name}</Badge>)}</div></TableCell>
                            <TableCell><div className="flex max-w-[220px] flex-wrap gap-2 whitespace-normal">{item.courseRefs.length === 0 ? <span className="text-sm text-slate-400">无标签</span> : Array.from(new Set(item.courseRefs.map((ref) => ref.tagName))).map((name) => <Badge key={name} variant="outline" className="border-slate-200 text-slate-600">{name}</Badge>)}</div></TableCell>
                            <TableCell>{item.uploadedAt}</TableCell>
                            <TableCell>{formatDuration(item.duration)}</TableCell>
                            <TableCell>{item.hasScript ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-3.5" />已上传文案</span> : <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700"><FileText className="size-3.5" />未上传文案</span>}</TableCell>
                            <TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setEditingAudio(item); setAudioName(item.name); setShowEditNameDialog(true); }}><Pencil className="mr-2 size-4" />改名</Button><Button variant="outline" size="sm" onClick={() => { setEditingAudio(item); setScriptText(item.script ?? ""); setShowScriptDialog(true); }}><FileText className="mr-2 size-4" />文案</Button><Button variant="destructive" size="sm" onClick={() => void handleDeleteAudio(item.id)}><Trash2 className="mr-2 size-4" />删除</Button></div></TableCell>
                          </TableRow>
                        ))}
                        {items.length === 0 ? <TableRow><TableCell colSpan={8} className="py-16 text-center text-slate-500">{searchScope === "current" && !selectedFolderId ? "请先选择文件夹" : "暂无音频数据"}</TableCell></TableRow> : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-500">第 {page} / {totalPages} 页，每页 {PAGE_SIZE} 条</div>
                  <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || listLoading} onClick={() => setPage((current) => Math.max(current - 1, 1))}>上一页</Button><Button variant="outline" size="sm" disabled={page >= totalPages || listLoading} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>下一页</Button></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}><DialogContent><DialogHeader><DialogTitle>{editingFolder ? "编辑文件夹" : "新建文件夹"}</DialogTitle><DialogDescription>音频库仅支持一级文件夹，用于引用时快速定位音频。</DialogDescription></DialogHeader><div className="space-y-2 py-4"><Label>文件夹名称</Label><Input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="请输入文件夹名称" /></div><DialogFooter><Button variant="outline" onClick={() => setShowFolderDialog(false)}>取消</Button><Button onClick={() => void handleFolderSave()}>{editingFolder ? "保存文件夹" : "创建文件夹"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={showSingleUploadDialog} onOpenChange={(open) => { if (singleUploading) return; setShowSingleUploadDialog(open); if (!open) { setSingleFile(null); setScriptText(""); } }}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden max-h-[85vh] max-w-3xl" onEscapeKeyDown={(event) => { if (singleUploading) event.preventDefault(); }} onInteractOutside={(event) => { if (singleUploading) event.preventDefault(); }}>
          <DialogHeader><DialogTitle>单个上传音频</DialogTitle><DialogDescription>单个上传可同步上传文案，也可后续在音频库继续编辑。</DialogDescription></DialogHeader>
          <div className="space-y-4 overflow-y-auto py-1 pr-1">
            {singleUploading ? <UploadingNotice title="音频正在上传" description="系统正在处理音频文件和文案，请稍等，上传完成后会自动关闭当前窗口。" /> : null}
            <div className="space-y-2"><Label>音频文件</Label><Input type="file" accept="audio/*" disabled={singleUploading} onChange={(event) => setSingleFile(event.target.files?.[0] ?? null)} />{singleFile ? <p className="text-xs text-slate-500">已选择：{singleFile.name}</p> : null}</div>
            <div className="space-y-2"><Label>文案文件</Label><Input type="file" accept=".txt,.md,.text,.srt,.lrc,.doc,.docx" disabled={singleUploading} onChange={(event) => void loadScriptFromFile(event.target.files?.[0] ?? null, setScriptText)} /><p className="text-xs leading-6 text-slate-500">支持 txt、md、srt、lrc、doc、docx，单个文案文件不超过 10MB，读取后会自动填入下方文案框。</p></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>音频文案</Label><span className="text-xs text-slate-400">{scriptText.length} 字</span></div><Textarea value={scriptText} disabled={singleUploading} onChange={(event) => setScriptText(event.target.value)} rows={12} className="min-h-[320px] max-h-[45vh] overflow-y-auto [field-sizing:fixed]" placeholder="可先留空，后续再补录文案" /></div>
          </div>
          <DialogFooter className="border-t border-slate-200 pt-4"><Button variant="outline" onClick={() => setShowSingleUploadDialog(false)} disabled={singleUploading}>取消</Button><Button onClick={() => void handleSingleUpload()} disabled={singleUploading || !singleFile}>{singleUploading ? <><Loader2 className="mr-2 size-4 animate-spin" />上传中...</> : "开始上传"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBatchUploadDialog} onOpenChange={(open) => { if (batchUploading) return; setShowBatchUploadDialog(open); if (!open) setBatchFiles([]); }}>
        <DialogContent className="max-w-2xl" onEscapeKeyDown={(event) => { if (batchUploading) event.preventDefault(); }} onInteractOutside={(event) => { if (batchUploading) event.preventDefault(); }}>
          <DialogHeader><DialogTitle>批量上传音频</DialogTitle><DialogDescription>批量上传后默认使用文件名作为音频名称，文案后续逐条补录。单次最多 50 个文件，单个音频不超过 200MB。</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            {batchUploading ? <UploadingNotice title="批量音频正在上传" description="系统正在批量处理音频文件，上传完成后会自动关闭当前窗口。" /> : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">当前文件夹：{selectedFolder?.name ?? "未选择"}<span className="mx-2 text-slate-300">|</span>已选择 {batchFiles.length} 个音频文件</div>
            <div className="space-y-2"><Label>音频文件</Label><Input type="file" accept="audio/*" multiple disabled={batchUploading} onChange={(event) => setBatchFiles(Array.from(event.target.files ?? []))} /><p className="text-xs leading-6 text-slate-500">支持 mp3、wav、m4a、aac、ogg、flac，上传后默认使用文件名作为音频名称。</p></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowBatchUploadDialog(false)} disabled={batchUploading}>取消</Button><Button onClick={() => void handleBatchUpload()} disabled={batchUploading || batchFiles.length === 0}>{batchUploading ? <><Loader2 className="mr-2 size-4 animate-spin" />上传中...</> : "开始上传"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditNameDialog} onOpenChange={setShowEditNameDialog}><DialogContent><DialogHeader><DialogTitle>编辑音频名称</DialogTitle><DialogDescription>上传后默认取文件名，此处可改为正式展示名称。</DialogDescription></DialogHeader><div className="space-y-2 py-4"><Label>音频名称</Label><Input value={audioName} onChange={(event) => setAudioName(event.target.value)} placeholder="请输入音频名称" /></div><DialogFooter><Button variant="outline" onClick={() => setShowEditNameDialog(false)}>取消</Button><Button onClick={() => void handleSaveAudioName()}>保存名称</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={showScriptDialog} onOpenChange={(open) => { setShowScriptDialog(open); if (!open) { setEditingAudio(null); setScriptText(""); } }}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden max-h-[85vh] max-w-3xl">
          <DialogHeader><DialogTitle>编辑音频文案</DialogTitle><DialogDescription>没有文案的音频不能被课程引用。</DialogDescription></DialogHeader>
          <div className="space-y-4 overflow-y-auto py-1 pr-1">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">当前音频：{editingAudio?.name ?? "未选择音频"}</div>
            <div className="space-y-2"><Label>文案文件</Label><Input type="file" accept=".txt,.md,.text,.srt,.lrc,.doc,.docx" onChange={(event) => void loadScriptFromFile(event.target.files?.[0] ?? null, setScriptText)} /><p className="text-xs leading-6 text-slate-500">支持 txt、md、srt、lrc、doc、docx，单个文案文件不超过 10MB，读取后会自动覆盖下方文案内容。</p></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>文案内容</Label><span className="text-xs text-slate-400">{scriptText.length} 字</span></div><Textarea value={scriptText} onChange={(event) => setScriptText(event.target.value)} rows={14} className="min-h-[360px] max-h-[50vh] overflow-y-auto [field-sizing:fixed]" placeholder="请输入完整音频文案" /></div>
          </div>
          <DialogFooter className="border-t border-slate-200 pt-4"><Button variant="outline" onClick={() => setShowScriptDialog(false)}>取消</Button><Button onClick={() => void handleSaveScript()}>保存文案</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddCourseDialog} onOpenChange={setShowAddCourseDialog}><DialogContent><DialogHeader><DialogTitle>添加到课程</DialogTitle><DialogDescription>可批量选择音频后，添加到指定课程和标签。</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">已选择 {selectedAudioIds.length} 条音频</div><div className="space-y-2"><Label>课程</Label><Select value={targetCourseId} onValueChange={(value) => void handleCourseChange(value)}><SelectTrigger><SelectValue placeholder="请选择课程" /></SelectTrigger><SelectContent>{courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>标签</Label><Select value={targetTagId} onValueChange={setTargetTagId}><SelectTrigger><SelectValue placeholder="请选择标签" /></SelectTrigger><SelectContent>{targetTags.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setShowAddCourseDialog(false)}>取消</Button><Button onClick={() => void handleAddToCourse()}>确认添加</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={showMoveFolderDialog} onOpenChange={setShowMoveFolderDialog}><DialogContent><DialogHeader><DialogTitle>移动文件夹</DialogTitle><DialogDescription>可将已选音频移动到其他一级文件夹中，便于后续统一整理。</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">已选择 {selectedAudioIds.length} 条音频</div><div className="space-y-2"><Label>目标文件夹</Label><Select value={targetFolderId} onValueChange={setTargetFolderId}><SelectTrigger><SelectValue placeholder="请选择目标文件夹" /></SelectTrigger><SelectContent>{folders.map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setShowMoveFolderDialog(false)}>取消</Button><Button onClick={() => void handleMoveFolder()}>确认移动</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
}
