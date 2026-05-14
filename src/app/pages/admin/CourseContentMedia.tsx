import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  AudioLines,
  CheckCircle2,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Tags,
  Trash2,
  Upload,
  Video as VideoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import type { Audio, AudioLibraryItem, Course, CourseType, Tag, Video, VideoLibraryItem } from "../../lib/mockData";
import { mockApi } from "../../lib/mockData";

type CourseMediaItem = Audio | Video;
type LibraryMediaItem = AudioLibraryItem | VideoLibraryItem;

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const isAudioItem = (item: CourseMediaItem | LibraryMediaItem): item is Audio | AudioLibraryItem =>
  "processStatus" in item || "audioUrl" in item;

const getProcessBadge = (status?: string, message?: string) => {
  if (status === "pending") {
    return (
      <div className="space-y-1">
        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
          <Loader2 className="mr-1 size-3.5 animate-spin" />
          等待处理
        </Badge>
        {message ? <p className="text-xs text-slate-500">{message}</p> : null}
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="space-y-1">
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          <Loader2 className="mr-1 size-3.5 animate-spin" />
          处理中
        </Badge>
        {message ? <p className="text-xs text-slate-500">{message}</p> : null}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="space-y-1">
        <Badge variant="secondary" className="bg-red-100 text-red-700">
          处理失败
        </Badge>
        {message ? <p className="text-xs text-red-500">{message}</p> : null}
      </div>
    );
  }

  return (
    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
      <CheckCircle2 className="mr-1 size-3.5" />
      可用
    </Badge>
  );
};

const modeMeta: Record<
  CourseType,
  {
    label: string;
    pluralLabel: string;
    libraryLabel: string;
    countLabel: string;
    uploadAccept: string;
    uploadHint: string;
    icon: typeof AudioLines;
  }
> = {
  audio: {
    label: "音频",
    pluralLabel: "音频",
    libraryLabel: "音频库",
    countLabel: "课程音频数",
    uploadAccept: ".mp3,.wav,.m4a,.aac,.ogg,.flac",
    uploadHint: "单个音频不超过 200MB，文案文件不超过 10MB。",
    icon: AudioLines,
  },
  video: {
    label: "视频",
    pluralLabel: "视频",
    libraryLabel: "视频库",
    countLabel: "课程视频数",
    uploadAccept: ".mp4,.mov,.m4v,.webm,.avi,.mkv",
    uploadHint: "单个视频不超过 500MB，文案文件不超过 10MB。",
    icon: VideoIcon,
  },
};

export function CourseContent() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();

  const [course, setCourse] = useState<Course | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [items, setItems] = useState<CourseMediaItem[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryMediaItem[]>([]);

  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const [tagName, setTagName] = useState("");
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadScript, setUploadScript] = useState("");
  const [libraryKeyword, setLibraryKeyword] = useState("");
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [libraryTotalPages, setLibraryTotalPages] = useState(1);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [draggingTagId, setDraggingTagId] = useState("");
  const [draggingItemId, setDraggingItemId] = useState("");

  const mode: CourseType = course?.courseType === "video" ? "video" : "audio";
  const meta = modeMeta[mode];
  const MediaIcon = meta.icon;
  const deferredLibraryKeyword = useDeferredValue(libraryKeyword.trim());
  const selectedTag = useMemo(() => tags.find((tag) => tag.id === selectedTagId) ?? null, [selectedTagId, tags]);
  const currentTagScriptedCount = useMemo(() => items.filter((item) => item.hasScript).length, [items]);
  const hasProcessingItems = useMemo(
    () => mode === "audio" && items.some((item) => isAudioItem(item) && item.processStatus !== "ready"),
    [items, mode],
  );

  const loadCourse = async () => {
    if (!courseId) return;
    try {
      const detail = await mockApi.getCourseDetail(courseId);
      setCourse(detail.course);
      setTags(detail.tags);
      setSelectedTagId((current) => {
        if (detail.tags.length === 0) return "";
        return detail.tags.some((tag) => tag.id === current) ? current : detail.tags[0].id;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载课程内容失败");
    }
  };

  const loadTagItems = async (tagId: string, forcedMode?: CourseType) => {
    const currentMode = forcedMode ?? mode;
    if (!tagId) {
      setItems([]);
      return;
    }

    try {
      if (currentMode === "video") {
        const data = await mockApi.getTagVideos(tagId, "admin-preview");
        setItems(data.videos);
      } else {
        const data = await mockApi.getTagAudios(tagId, "admin-preview");
        setItems(data.audios);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `加载${modeMeta[currentMode].pluralLabel}失败`);
    }
  };

  const loadLibraryItems = async (forcedMode?: CourseType) => {
    const currentMode = forcedMode ?? mode;
    if (!courseId) return;

    try {
      setLibraryLoading(true);
      if (currentMode === "video") {
        const result = await mockApi.getVideoLibraryItems({
          keyword: deferredLibraryKeyword,
          excludeCourseId: courseId,
          scriptFilter: "scripted",
          searchScope: "all",
          sortMode: "uploaded-desc",
          page: libraryPage,
          pageSize: 12,
        });
        setLibraryItems(result.items);
        setLibraryTotal(result.total);
        setLibraryTotalPages(result.totalPages);
        if (result.page !== libraryPage) setLibraryPage(result.page);
        return;
      }

      const result = await mockApi.getAudioLibraryItems({
        keyword: deferredLibraryKeyword,
        excludeCourseId: courseId,
        scriptFilter: "scripted",
        processFilter: "ready",
        searchScope: "all",
        sortMode: "uploaded-desc",
        page: libraryPage,
        pageSize: 12,
      });
      setLibraryItems(result.items);
      setLibraryTotal(result.total);
      setLibraryTotalPages(result.totalPages);
      if (result.page !== libraryPage) setLibraryPage(result.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `加载${modeMeta[currentMode].libraryLabel}失败`);
    } finally {
      setLibraryLoading(false);
    }
  };

  useEffect(() => {
    void loadCourse();
  }, [courseId]);

  useEffect(() => {
    if (!selectedTagId) {
      setItems([]);
      return;
    }
    void loadTagItems(selectedTagId);
  }, [mode, selectedTagId]);

  useEffect(() => {
    if (!showLibraryDialog) return;
    void loadLibraryItems();
  }, [courseId, deferredLibraryKeyword, libraryPage, mode, showLibraryDialog]);

  useEffect(() => {
    if (!selectedTagId || !hasProcessingItems) return;
    const timer = window.setInterval(() => {
      void loadTagItems(selectedTagId, "audio");
    }, 4000);
    return () => window.clearInterval(timer);
  }, [hasProcessingItems, selectedTagId]);

  const loadScriptFromFile = async (file: File | null) => {
    if (!file) return;
    try {
      const result = await mockApi.extractScriptFile(file);
      setUploadScript(result.text);
      toast.success(`文案文件已导入：${file.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "文案文件读取失败");
    }
  };

  const persistTagOrder = async (nextTags: Tag[]) => {
    if (!courseId) return;
    const normalized = nextTags.map((tag, order) => ({ ...tag, order }));
    setTags(normalized);
    try {
      await mockApi.updateTagOrder(courseId, normalized.map((tag) => ({ id: tag.id, order: tag.order })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "标签排序更新失败");
      await loadCourse();
    }
  };

  const persistItemOrder = async (nextItems: CourseMediaItem[]) => {
    if (!courseId || !selectedTagId) return;
    setItems(nextItems);
    const payload = nextItems.map((item, order) => ({ id: item.id, order }));
    try {
      if (mode === "video") {
        await mockApi.updateVideoOrder(courseId, selectedTagId, payload);
      } else {
        await mockApi.updateAudioOrder(courseId, selectedTagId, payload);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${meta.pluralLabel}排序更新失败`);
      await loadTagItems(selectedTagId);
    }
  };

  const moveTag = async (tagId: string, direction: "up" | "down") => {
    const index = tags.findIndex((tag) => tag.id === tagId);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tags.length) return;

    const nextTags = [...tags];
    [nextTags[index], nextTags[targetIndex]] = [nextTags[targetIndex], nextTags[index]];
    await persistTagOrder(nextTags);
  };

  const moveItem = async (itemId: string, direction: "up" | "down") => {
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const nextItems = [...items];
    [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];
    await persistItemOrder(nextItems);
  };

  const handleTagDrop = async (targetTagId: string) => {
    if (!draggingTagId || draggingTagId === targetTagId) {
      setDraggingTagId("");
      return;
    }

    const sourceIndex = tags.findIndex((tag) => tag.id === draggingTagId);
    const targetIndex = tags.findIndex((tag) => tag.id === targetTagId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingTagId("");
      return;
    }

    const nextTags = [...tags];
    const [draggedTag] = nextTags.splice(sourceIndex, 1);
    nextTags.splice(targetIndex, 0, draggedTag);
    setDraggingTagId("");
    await persistTagOrder(nextTags);
  };

  const handleItemDrop = async (targetItemId: string) => {
    if (!draggingItemId || draggingItemId === targetItemId) {
      setDraggingItemId("");
      return;
    }

    const sourceIndex = items.findIndex((item) => item.id === draggingItemId);
    const targetIndex = items.findIndex((item) => item.id === targetItemId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingItemId("");
      return;
    }

    const nextItems = [...items];
    const [draggedItem] = nextItems.splice(sourceIndex, 1);
    nextItems.splice(targetIndex, 0, draggedItem);
    setDraggingItemId("");
    await persistItemOrder(nextItems);
  };

  const handleSaveTag = async () => {
    if (!courseId || !tagName.trim()) {
      toast.error("请输入标签名称");
      return;
    }

    try {
      if (editingTag) {
        await mockApi.updateTag(editingTag.id, tagName.trim());
        toast.success("标签已更新");
      } else {
        await mockApi.createTag(courseId, tagName.trim());
        toast.success("标签已新增");
      }

      setShowTagDialog(false);
      setEditingTag(null);
      setTagName("");
      await loadCourse();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存标签失败");
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await mockApi.deleteTag(tagId);
      toast.success("标签已删除");
      await loadCourse();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除标签失败");
    }
  };

  const handleAddFromLibrary = async () => {
    if (!courseId || !selectedTagId || selectedLibraryIds.length === 0) {
      toast.error(`请选择要引用的${meta.label}`);
      return;
    }

    try {
      if (mode === "video") {
        await mockApi.addVideoToCourse(courseId, selectedTagId, selectedLibraryIds);
      } else {
        await mockApi.addAudioToCourse(courseId, selectedTagId, selectedLibraryIds);
      }
      toast.success(`${meta.pluralLabel}已加入当前课程`);
      setSelectedLibraryIds([]);
      setShowLibraryDialog(false);
      setLibraryKeyword("");
      setLibraryPage(1);
      await Promise.all([loadCourse(), loadTagItems(selectedTagId)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `引用${meta.pluralLabel}失败`);
    }
  };

  const handleDirectUpload = async () => {
    if (!courseId || !selectedTagId || !uploadFile) {
      toast.error(`请选择${meta.label}文件`);
      return;
    }

    try {
      if (mode === "video") {
        await mockApi.uploadVideoDirectlyToCourse(courseId, selectedTagId, [uploadFile], uploadScript);
      } else {
        await mockApi.uploadAudioDirectlyToCourse(courseId, selectedTagId, [uploadFile], uploadScript);
      }
      toast.success(`${meta.pluralLabel}已加入后台处理队列`);
      setUploadFile(null);
      setUploadScript("");
      setShowUploadDialog(false);
      await Promise.all([loadCourse(), loadTagItems(selectedTagId)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `上传${meta.pluralLabel}失败`);
    }
  };

  const handleMoveItemTag = async (itemId: string, nextTagId: string) => {
    if (!courseId || !selectedTagId || nextTagId === selectedTagId) return;

    try {
      if (mode === "video") {
        await mockApi.updateVideoTag(courseId, itemId, nextTagId);
      } else {
        await mockApi.updateAudioTag(courseId, itemId, nextTagId);
      }
      toast.success("所属标签已更新");
      setItems((current) => current.filter((item) => item.id !== itemId));
      if (showLibraryDialog) void loadLibraryItems();
      await loadCourse();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改所属标签失败");
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!courseId) return;

    try {
      if (mode === "video") {
        await mockApi.removeVideoFromCourse(courseId, itemId);
      } else {
        await mockApi.removeAudioFromCourse(courseId, itemId);
      }
      toast.success(`${meta.label}已从课程中移除`);
      setItems((current) => current.filter((item) => item.id !== itemId));
      if (showLibraryDialog) void loadLibraryItems();
      await loadCourse();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `移除${meta.label}失败`);
    }
  };

  if (!course) {
    return <div className="p-8 text-slate-500">课程内容加载中...</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/admin/courses?type=${mode}`)}
            className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <p className="text-sm font-medium text-blue-600">课程内容管理</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">{course.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{course.description}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowLibraryDialog(true)} disabled={!selectedTagId}>
            <Plus className="mr-2 size-4" />
            引用{meta.label}
          </Button>
          <Button onClick={() => setShowUploadDialog(true)} disabled={!selectedTagId}>
            <Upload className="mr-2 size-4" />
            直接上传
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">标签数量</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{tags.length}</p>
          <p className="mt-2 text-sm text-slate-500">支持上下移动和拖拽排序</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">{meta.countLabel}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{course.contentCount}</p>
          <p className="mt-2 text-sm text-slate-500">当前课程已关联的{meta.pluralLabel}总数</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm text-emerald-700">当前标签已上传文案</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-800">{currentTagScriptedCount}</p>
          <p className="mt-2 text-sm text-emerald-700">没有文案的内容不能被课程引用</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm text-blue-700">当前标签</p>
          <p className="mt-2 text-xl font-semibold text-blue-900">{selectedTag?.name ?? "未选择标签"}</p>
          <p className="mt-2 text-sm text-blue-700">默认展示第一个标签的内容</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">标签列表</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">课程标签</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingTag(null);
                setTagName("");
                setShowTagDialog(true);
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            标签删除后，只会清空本课程内该标签下的内容归类，不会删除{meta.libraryLabel}里的{meta.pluralLabel}。
          </div>

          <div className="space-y-2">
            {tags.map((tag, index) => (
              <div
                key={tag.id}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={() => setDraggingTagId(tag.id)}
                onDragOver={(event) => {
                  if (draggingTagId) event.preventDefault();
                }}
                onDrop={() => void handleTagDrop(tag.id)}
                onDragEnd={() => setDraggingTagId("")}
                onClick={() => setSelectedTagId(tag.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedTagId(tag.id);
                  }
                }}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  selectedTagId === tag.id ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
                } ${draggingTagId === tag.id ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <GripVertical className="size-4 shrink-0 cursor-move text-slate-400" />
                    <span className="truncate text-sm font-medium text-slate-900">{tag.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void moveTag(tag.id, "up");
                      }}
                      disabled={index === 0}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void moveTag(tag.id, "down");
                      }}
                      disabled={index === tags.length - 1}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingTag(tag);
                        setTagName(tag.name);
                        setShowTagDialog(true);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteTag(tag.id);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {tags.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">暂无标签</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-600">{meta.pluralLabel}列表</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{selectedTag?.name ?? "请选择标签"}</h2>
                <p className="mt-2 text-sm text-slate-500">可调整标签内排序、修改所属标签，或从课程中移除{meta.pluralLabel}。</p>
              </div>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                共 {items.length} 条
              </Badge>
            </div>
          </div>

          <div className="p-6">
            {!selectedTagId ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-14 text-center text-sm text-slate-500">请先创建并选择课程标签</div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-14 text-center text-sm text-slate-500">当前标签下暂无{meta.pluralLabel}</div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggingItemId(item.id)}
                    onDragOver={(event) => {
                      if (draggingItemId) event.preventDefault();
                    }}
                    onDrop={() => void handleItemDrop(item.id)}
                    onDragEnd={() => setDraggingItemId("")}
                    className={`rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 ${draggingItemId === item.id ? "opacity-60" : ""}`}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <GripVertical className="mt-2 size-4 shrink-0 cursor-move text-slate-400" />
                          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <MediaIcon className="size-4 text-blue-600" />
                              <h3 className="truncate text-base font-semibold text-slate-900">{item.name}</h3>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                              <span className="inline-flex items-center gap-1.5">
                                <Tags className="size-4" />
                                时长 {formatDuration(item.duration)}
                              </span>
                              <span>上传时间 {item.uploadedAt || "--"}</span>
                              {mode === "audio" ? getProcessBadge((item as Audio).processStatus, (item as Audio).processMessage) : getProcessBadge("ready")}
                              <Badge variant="secondary" className={item.hasScript ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                                {item.hasScript ? "已上传文案" : "未上传文案"}
                              </Badge>
                              {item.hasHandout ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                  已上传讲义
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-[190px_auto]">
                        <Select value={selectedTagId} onValueChange={(value) => void handleMoveItemTag(item.id, value)}>
                          <SelectTrigger className="w-[190px] bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {tags.map((tag) => (
                              <SelectItem key={tag.id} value={tag.id}>
                                {tag.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => void moveItem(item.id, "up")} disabled={index === 0}>
                            <ArrowUp className="size-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => void moveItem(item.id, "down")} disabled={index === items.length - 1}>
                            <ArrowDown className="size-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => void handleRemoveItem(item.id)}>
                            移除
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? "编辑标签" : "新增标签"}</DialogTitle>
            <DialogDescription>标签名称支持后台自定义，例如民法、刑法、2018、2019。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>标签名称</Label>
            <Input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="请输入标签名称" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>
              取消
            </Button>
            <Button onClick={() => void handleSaveTag()}>{editingTag ? "保存标签" : "创建标签"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showLibraryDialog}
        onOpenChange={(open) => {
          setShowLibraryDialog(open);
          if (!open) {
            setLibraryKeyword("");
            setLibraryPage(1);
            setSelectedLibraryIds([]);
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>从{meta.libraryLabel}引用{meta.label}</DialogTitle>
            <DialogDescription>仅显示已上传文案且未被当前课程引用的{meta.pluralLabel}，可批量选择后加入当前标签。</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                value={libraryKeyword}
                onChange={(event) => {
                  setLibraryKeyword(event.target.value);
                  setLibraryPage(1);
                }}
                placeholder={`按${meta.label}名称搜索`}
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                共 {libraryTotal} 条，已选择 {selectedLibraryIds.length} 条
              </div>
            </div>

            <div className="max-h-[520px] space-y-2 overflow-y-auto">
              {libraryLoading ? <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">{meta.libraryLabel}加载中...</div> : null}
              {libraryItems.map((item) => (
                <label key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-4">
                  <Checkbox
                    checked={selectedLibraryIds.includes(item.id)}
                    onCheckedChange={(checked) => {
                      setSelectedLibraryIds((current) =>
                        checked ? Array.from(new Set([...current, item.id])) : current.filter((value) => value !== item.id),
                      );
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{item.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.folderName} · 时长 {formatDuration(item.duration)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                        已上传文案
                      </Badge>
                    </div>

                    {item.courseRefs.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.courseRefs.map((ref) => (
                          <Badge key={`${item.id}-${ref.courseId}-${ref.tagId}`} variant="secondary" className="bg-blue-50 text-blue-700">
                            {ref.courseName} / {ref.tagName}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </label>
              ))}

              {!libraryLoading && libraryItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">暂无可引用{meta.pluralLabel}</div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <div>
                第 {libraryPage} / {libraryTotalPages} 页，每页 12 条
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={libraryPage <= 1 || libraryLoading} onClick={() => setLibraryPage((current) => Math.max(current - 1, 1))}>
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={libraryPage >= libraryTotalPages || libraryLoading}
                  onClick={() => setLibraryPage((current) => Math.min(current + 1, libraryTotalPages))}
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLibraryDialog(false)}>
              取消
            </Button>
            <Button onClick={() => void handleAddFromLibrary()}>确认引用</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showUploadDialog}
        onOpenChange={(open) => {
          setShowUploadDialog(open);
          if (!open) {
            setUploadFile(null);
            setUploadScript("");
          }
        }}
      >
        <DialogContent className="grid max-h-[85vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <DialogHeader>
            <DialogTitle>直接上传到课程</DialogTitle>
            <DialogDescription>
              上传到当前课程后，会默认归入当前标签。{meta.uploadHint}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto py-1 pr-1">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              当前所属标签：{selectedTag?.name ?? "未选择标签"}
            </div>
            <div className="space-y-2">
              <Label>{meta.label}文件</Label>
              <Input type="file" accept={meta.uploadAccept} onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            </div>
            {uploadFile ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">已选择文件：{uploadFile.name}</div> : null}
            <div className="space-y-2">
              <Label>文案文件</Label>
              <Input type="file" accept=".txt,.md,.text,.srt,.lrc,.doc,.docx" onChange={(event) => void loadScriptFromFile(event.target.files?.[0] ?? null)} />
              <p className="text-xs leading-6 text-slate-500">支持 txt、md、srt、lrc、doc、docx，读取后会自动填入下方文案框。</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{meta.label}文案</Label>
                <span className="text-xs text-slate-400">{uploadScript.length} 字</span>
              </div>
              <Textarea
                rows={12}
                value={uploadScript}
                onChange={(event) => setUploadScript(event.target.value)}
                className="min-h-[320px] max-h-[45vh] overflow-y-auto [field-sizing:fixed]"
                placeholder={`可先留空，后续在${meta.libraryLabel}或课程中继续编辑文案`}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              取消
            </Button>
            <Button onClick={() => void handleDirectUpload()}>开始上传</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
