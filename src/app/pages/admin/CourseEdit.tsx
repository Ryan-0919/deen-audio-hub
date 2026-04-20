import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, FileText, ImagePlus, Plus, Rows2, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { mockApi, Tag } from "../../lib/mockData";

type CourseMode = "open" | "closed" | "scheduled";

const HANDOUT_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip";

const modeMeta: Record<CourseMode, { label: string; desc: string }> = {
  open: {
    label: "已开放",
    desc: "用户拥有课程权限后可以立即看到本课程。",
  },
  closed: {
    label: "未开放",
    desc: "课程暂时不会在用户端显示。",
  },
  scheduled: {
    label: "定时开放",
    desc: "到达设定时间后自动开放。",
  },
};

const getDefaultOpenTime = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = `${now.getMonth() + 1}`.padStart(2, "0");
  const dd = `${now.getDate()}`.padStart(2, "0");
  const hh = `${now.getHours()}`.padStart(2, "0");
  const min = `${now.getMinutes()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:00`;
};

export function CourseEdit() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const isEdit = Boolean(courseId);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const handoutInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [handoutUploading, setHandoutUploading] = useState(false);
  const [name, setName] = useState("");
  const [cover, setCover] = useState("");
  const [coverObjectKey, setCoverObjectKey] = useState("");
  const [handoutUrl, setHandoutUrl] = useState("");
  const [handoutObjectKey, setHandoutObjectKey] = useState("");
  const [handoutName, setHandoutName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CourseMode>("closed");
  const [openTime, setOpenTime] = useState("");
  const [currentTags, setCurrentTags] = useState<Tag[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const normalizedOpenTime = useMemo(() => (openTime ? openTime.replace(" ", "T").slice(0, 16) : ""), [openTime]);
  const displayedTags = isEdit ? currentTags.map((tag) => ({ id: tag.id, name: tag.name })) : draftTags.map((tag) => ({ name: tag }));

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const detail = await mockApi.getCourseDetail(courseId);
        setName(detail.course.name);
        setCover(detail.course.cover);
        setCoverObjectKey(detail.course.coverObjectKey ?? "");
        setHandoutUrl(detail.course.handoutUrl ?? "");
        setHandoutObjectKey(detail.course.handoutObjectKey ?? "");
        setHandoutName(detail.course.handoutName ?? "");
        setDescription(detail.course.description);
        setStatus(detail.course.status);
        setOpenTime(detail.course.openTime);
        setCurrentTags(detail.tags);
      } catch {
        toast.error("加载课程信息失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [courseId]);

  const handleCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setCoverUploading(true);
    try {
      const uploaded = await mockApi.uploadCoverImage(file);
      setCover(uploaded.url);
      setCoverObjectKey(uploaded.objectKey);
      toast.success("课程封面已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "课程封面上传失败");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleHandoutUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setHandoutUploading(true);
    try {
      const uploaded = await mockApi.uploadCourseHandout(file);
      setHandoutUrl(uploaded.url);
      setHandoutObjectKey(uploaded.objectKey);
      setHandoutName(file.name);
      toast.success("课程讲义已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "课程讲义上传失败");
    } finally {
      setHandoutUploading(false);
    }
  };

  const handleAddTag = async () => {
    const nextTag = tagInput.trim();
    if (!nextTag) return;

    if (isEdit && courseId) {
      try {
        const created = await mockApi.createTag(courseId, nextTag);
        setCurrentTags((previous) => [...previous, created].sort((a, b) => a.order - b.order));
        setTagInput("");
        toast.success("标签已新增");
      } catch {
        toast.error("新增标签失败");
      }
      return;
    }

    setDraftTags((previous) => Array.from(new Set([...previous, nextTag])));
    setTagInput("");
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleAddTag();
    }
  };

  const handleRemoveTag = async (tagId?: string, tagName?: string) => {
    if (isEdit && tagId) {
      try {
        await mockApi.deleteTag(tagId);
        setCurrentTags((previous) => previous.filter((tag) => tag.id !== tagId));
        toast.success("标签已删除");
      } catch {
        toast.error("删除标签失败");
      }
      return;
    }

    if (tagName) {
      setDraftTags((previous) => previous.filter((tag) => tag !== tagName));
    }
  };

  const handleClearHandout = () => {
    setHandoutUrl("");
    setHandoutObjectKey("");
    setHandoutName("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim() || !cover || !description.trim()) {
      toast.error("请填写完整的课程名称、课程封面和课程简介");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        cover,
        coverObjectKey,
        handoutUrl: handoutUrl || null,
        handoutObjectKey: handoutObjectKey || null,
        handoutName: handoutName || null,
        description: description.trim(),
        status,
        openTime: openTime || getDefaultOpenTime(),
      };

      if (isEdit && courseId) {
        await mockApi.updateCourse(courseId, payload);
        toast.success("课程已更新");
      } else {
        await mockApi.createCourse({
          ...payload,
          tags: draftTags,
        });
        toast.success("课程已创建");
      }

      navigate("/admin/courses");
    } catch {
      toast.error("保存课程失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">课程信息加载中...</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/courses")}
            className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <p className="text-sm font-medium text-blue-600">{isEdit ? "编辑课程" : "新建课程"}</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">{isEdit ? "课程设置" : "创建课程"}</h1>
            <p className="mt-2 text-sm text-slate-500">维护课程名称、封面、讲义、简介、开放方式和课程标签。</p>
          </div>
        </div>

        {isEdit && courseId ? (
          <Button variant="outline" onClick={() => navigate(`/admin/courses/${courseId}/content`)}>
            <Rows2 className="mr-2 size-4" />
            进入内容管理
          </Button>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">基础信息</h2>
              <p className="mt-2 text-sm text-slate-500">课程封面必传，讲义选传。讲义上传后会在用户端课程详情显示下载悬浮球。</p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">课程名称</Label>
                  <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入课程名称" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">课程简介</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={8}
                    placeholder="请输入课程简介"
                    className="min-h-[180px]"
                  />
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="size-5 text-blue-600" />
                        <h3 className="text-base font-semibold text-slate-900">配套讲义</h3>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">支持 PDF、Word、PPT、Excel、TXT、ZIP，可上传也可以不上传。</p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">选传</span>
                  </div>

                  <input ref={handoutInputRef} type="file" accept={HANDOUT_ACCEPT} className="hidden" onChange={handleHandoutUpload} />

                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                    {handoutName ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <FileText className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{handoutName}</p>
                            <p className="mt-1 text-xs text-slate-500">用户端会显示下载讲义的悬浮球</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {handoutUrl ? (
                            <Button type="button" variant="outline" size="sm" asChild>
                              <a href={handoutUrl} target="_blank" rel="noreferrer">
                                查看
                              </a>
                            </Button>
                          ) : null}
                          <Button type="button" variant="outline" size="sm" onClick={() => handoutInputRef.current?.click()} disabled={handoutUploading}>
                            <UploadCloud className="mr-2 size-4" />
                            {handoutUploading ? "上传中..." : "更换"}
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={handleClearHandout} disabled={handoutUploading}>
                            <X className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <UploadCloud className="mb-3 size-7 text-blue-600" />
                        <p className="text-sm font-medium text-slate-900">{handoutUploading ? "讲义上传中..." : "点击上传课程讲义"}</p>
                        <p className="mt-2 text-xs text-slate-500">上传后用户可在课程详情一键下载</p>
                        <Button type="button" variant="outline" className="mt-4" onClick={() => handoutInputRef.current?.click()} disabled={handoutUploading}>
                          选择讲义文件
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>课程封面</Label>
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">必传</span>
                </div>
                <p className="text-xs leading-6 text-slate-500">建议比例 3:2，推荐尺寸 1200 x 800。</p>

                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />

                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-slate-500"
                >
                  {cover ? (
                    <img src={cover} alt="课程封面" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <ImagePlus className="mx-auto mb-3 size-7 text-blue-600" />
                      <p>{coverUploading ? "上传中..." : "点击上传课程封面"}</p>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">开放设置</h2>
              <p className="mt-2 text-sm text-slate-500">支持手动开放、关闭，以及定时开放。</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {(Object.keys(modeMeta) as CourseMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStatus(mode)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    status === mode ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-base font-semibold text-slate-900">{modeMeta[mode].label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{modeMeta[mode].desc}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              <Label htmlFor="openTime">开放时间</Label>
              <Input
                id="openTime"
                type="datetime-local"
                value={normalizedOpenTime}
                onChange={(event) => setOpenTime(event.target.value ? `${event.target.value}:00` : "")}
              />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">课程标签</h2>
              <p className="mt-2 text-sm text-slate-500">例如刑法、民法、真题、冲刺，管理员可以自行定义。</p>
            </div>

            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="输入标签后回车或点击新增"
              />
              <Button type="button" onClick={() => void handleAddTag()}>
                <Plus className="mr-2 size-4" />
                新增
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {displayedTags.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">暂无标签</div>
              ) : (
                displayedTags.map((tag) => (
                  <div key={tag.id ?? tag.name} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">
                    <span>{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveTag(tag.id, tag.name)}
                      className="text-slate-400 transition hover:text-red-500"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">保存说明</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-500">
              <p>课程保存后，可继续在内容管理中引用音频或直接上传音频。</p>
              <p>讲义为可选项，不上传时用户端不会显示下载按钮。</p>
              <p>课程删除后，仅移除课程内关联，不删除音频库中的音频。</p>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/admin/courses")}>
              返回
            </Button>
            <Button type="submit" disabled={saving || coverUploading || handoutUploading}>
              {saving ? "保存中..." : isEdit ? "保存课程" : "创建课程"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
