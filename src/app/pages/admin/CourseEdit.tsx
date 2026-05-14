import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, ImagePlus, Plus, Rows2, Trash2, Video, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { CourseType, mockApi, Tag } from "../../lib/mockData";

type CourseMode = "open" | "closed" | "scheduled";

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

const typeMeta: Record<CourseType, { label: string; desc: string; icon: typeof Volume2 }> = {
  audio: {
    label: "音频课程",
    desc: "用户端以音频目录和音频播放器的方式学习。",
    icon: Volume2,
  },
  video: {
    label: "视频课程",
    desc: "用户端以视频目录和视频播放器的方式学习。",
    icon: Video,
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
  const location = useLocation();
  const { courseId } = useParams<{ courseId: string }>();
  const isEdit = Boolean(courseId);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const initialType: CourseType = new URLSearchParams(location.search).get("type") === "video" ? "video" : "audio";

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [name, setName] = useState("");
  const [cover, setCover] = useState("");
  const [coverObjectKey, setCoverObjectKey] = useState("");
  const [description, setDescription] = useState("");
  const [courseType, setCourseType] = useState<CourseType>(initialType);
  const [status, setStatus] = useState<CourseMode>("closed");
  const [openTime, setOpenTime] = useState("");
  const [currentTags, setCurrentTags] = useState<Tag[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const normalizedOpenTime = useMemo(() => (openTime ? openTime.replace(" ", "T").slice(0, 16) : ""), [openTime]);
  const displayedTags = isEdit ? currentTags.map((tag) => ({ id: tag.id, name: tag.name })) : draftTags.map((tag) => ({ name: tag }));
  const currentTypeMeta = typeMeta[courseType];

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
        setDescription(detail.course.description);
        setCourseType(detail.course.courseType ?? "audio");
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
        description: description.trim(),
        courseType,
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

      navigate(`/admin/courses?type=${courseType}`);
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
            onClick={() => navigate(`/admin/courses?type=${courseType}`)}
            className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <p className="text-sm font-medium text-blue-600">{isEdit ? "编辑课程" : "新建课程"}</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">{isEdit ? "课程设置" : `创建${currentTypeMeta.label}`}</h1>
            <p className="mt-2 text-sm text-slate-500">维护课程名称、封面、简介、课程类型、开放方式和课程标签。</p>
          </div>
        </div>

        {isEdit && courseId ? (
          <Button variant="outline" onClick={() => navigate(`/admin/courses/${courseId}/content?type=${courseType}`)}>
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
              <p className="mt-2 text-sm text-slate-500">维护课程名称、封面、简介以及课程类型。</p>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-2">
              {(Object.keys(typeMeta) as CourseType[]).map((type) => {
                const meta = typeMeta[type];
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCourseType(type)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      courseType === type ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-900">{meta.label}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{meta.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">课程名称</Label>
                  <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder={`请输入${currentTypeMeta.label}名称`} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">课程简介</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={8}
                    placeholder={`请输入${currentTypeMeta.label}简介`}
                    className="min-h-[180px]"
                  />
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
              <p className="mt-2 text-sm text-slate-500">例如民法、刑法、冲刺、基础课，管理员可以自行定义。</p>
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
              <p>课程保存后，可继续在内容管理中引用课程库内容，或直接上传到当前课程标签下。</p>
              <p>课程删除后，仅移除课程内关联，不删除课程库中的原始内容。</p>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(`/admin/courses?type=${courseType}`)}>
              返回
            </Button>
            <Button type="submit" disabled={saving || coverUploading}>
              {saving ? "保存中..." : isEdit ? "保存课程" : `创建${currentTypeMeta.label}`}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
