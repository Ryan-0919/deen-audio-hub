import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Pencil, Plus, Rows2, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Course, CourseType, mockApi } from "../../lib/mockData";

type CourseStatusFilter = "all" | "open" | "closed" | "scheduled";

const statusMeta: Record<Exclude<CourseStatusFilter, "all">, { label: string; className: string; hint: string }> = {
  open: { label: "已开放", className: "bg-emerald-100 text-emerald-700", hint: "用户端可直接看到" },
  closed: { label: "未开放", className: "bg-slate-100 text-slate-700", hint: "用户端不显示" },
  scheduled: { label: "定时开放中", className: "bg-amber-100 text-amber-700", hint: "到时间自动开放并通知" },
};

const getCourseTypeMeta = (courseType: CourseType) =>
  courseType === "video"
    ? { label: "视频课程", countLabel: "视频数", queryValue: "video" as const }
    : { label: "音频课程", countLabel: "音频数", queryValue: "audio" as const };

export function CourseList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<CourseStatusFilter>("all");
  const [draggingCourseId, setDraggingCourseId] = useState("");
  const deferredKeyword = useDeferredValue(keyword.trim());

  const searchParams = new URLSearchParams(location.search);
  const mode: CourseType = searchParams.get("type") === "video" ? "video" : "audio";
  const modeMeta = getCourseTypeMeta(mode);

  const loadCourses = async () => {
    try {
      const list = await mockApi.getAllCourses();
      setCourses(list);
    } catch {
      toast.error("加载课程失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCourses();
  }, []);

  const modeCourses = useMemo(() => courses.filter((course) => (course.courseType ?? "audio") === mode), [courses, mode]);

  const summary = useMemo(
    () => ({
      total: modeCourses.length,
      open: modeCourses.filter((course) => course.status === "open").length,
      scheduled: modeCourses.filter((course) => course.status === "scheduled").length,
      closed: modeCourses.filter((course) => course.status === "closed").length,
    }),
    [modeCourses],
  );

  const sortingEnabled = !deferredKeyword && statusFilter === "all";

  const filteredCourses = useMemo(() => {
    return modeCourses.filter((course) => {
      const matchesKeyword = deferredKeyword ? course.name.includes(deferredKeyword) : true;
      const matchesStatus = statusFilter === "all" ? true : course.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [modeCourses, deferredKeyword, statusFilter]);

  const persistCourseOrder = async (nextCourses: Course[]) => {
    const untouchedCourses = courses.filter((course) => (course.courseType ?? "audio") !== mode);
    const normalizedModeCourses = nextCourses.map((course, index) => ({ ...course, sortOrder: index }));
    const merged = [...untouchedCourses, ...normalizedModeCourses];
    setCourses(merged);
    try {
      await mockApi.updateCourseOrder(normalizedModeCourses.map((course) => ({ id: course.id, order: course.sortOrder })));
      toast.success("课程顺序已更新");
    } catch {
      toast.error("课程顺序更新失败");
      await loadCourses();
    }
  };

  const handleMoveCourse = async (courseId: string, direction: "up" | "down") => {
    if (!sortingEnabled) {
      toast.error("请先清空筛选条件后再调整课程顺序");
      return;
    }

    const index = filteredCourses.findIndex((course) => course.id === courseId);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredCourses.length) return;

    const nextCourses = [...filteredCourses];
    [nextCourses[index], nextCourses[targetIndex]] = [nextCourses[targetIndex], nextCourses[index]];
    await persistCourseOrder(nextCourses);
  };

  const handleDragStart = (courseId: string) => {
    if (!sortingEnabled) return;
    setDraggingCourseId(courseId);
  };

  const handleDropCourse = async (targetCourseId: string) => {
    if (!sortingEnabled || !draggingCourseId || draggingCourseId === targetCourseId) {
      setDraggingCourseId("");
      return;
    }

    const sourceIndex = filteredCourses.findIndex((course) => course.id === draggingCourseId);
    const targetIndex = filteredCourses.findIndex((course) => course.id === targetCourseId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingCourseId("");
      return;
    }

    const nextCourses = [...filteredCourses];
    const [draggedCourse] = nextCourses.splice(sourceIndex, 1);
    nextCourses.splice(targetIndex, 0, draggedCourse);
    setDraggingCourseId("");
    await persistCourseOrder(nextCourses);
  };

  const handleToggleStatus = async (course: Course) => {
    try {
      await mockApi.updateCourse(course.id, {
        status: course.status === "open" ? "closed" : "open",
      });
      toast.success(course.status === "open" ? "课程已关闭" : "课程已开放");
      await loadCourses();
    } catch {
      toast.error("课程状态更新失败");
    }
  };

  const handleDelete = async (courseId: string) => {
    try {
      await mockApi.deleteCourse(courseId);
      toast.success("课程已删除");
      await loadCourses();
    } catch {
      toast.error("删除课程失败");
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">课程列表加载中...</div>;
  }

  return (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Video className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{modeMeta.label}管理</h1>
              <p className="mt-2 text-sm text-slate-500">维护{modeMeta.label}基础信息、开放状态、排序以及进入内容管理的入口。</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">全部课程</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.total}</p>
              <p className="mt-2 text-sm text-slate-500">当前后台可管理{modeMeta.label}总数</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm text-emerald-700">已开放</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-800">{summary.open}</p>
              <p className="mt-2 text-sm text-emerald-700">用户端可直接看到</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm text-amber-700">定时开放中</p>
              <p className="mt-2 text-3xl font-semibold text-amber-900">{summary.scheduled}</p>
              <p className="mt-2 text-sm text-amber-800">到开放时间自动生效</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-600">未开放</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.closed}</p>
              <p className="mt-2 text-sm text-slate-500">仅后台可见和编辑</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_220px_auto_auto]">
            <Input placeholder={`按${modeMeta.label}名称搜索`} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <Select value={statusFilter} onValueChange={(value: CourseStatusFilter) => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="课程状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="open">已开放</SelectItem>
                <SelectItem value="closed">未开放</SelectItem>
                <SelectItem value="scheduled">定时开放中</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setKeyword("");
                setStatusFilter("all");
              }}
            >
              重置
            </Button>
            <Button onClick={() => navigate(`/admin/courses/new?type=${modeMeta.queryValue}`)}>
              <Plus className="mr-2 size-4" />
              新建{modeMeta.label}
            </Button>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {sortingEnabled ? "当前支持后台拖拽排序，也可以使用上下按钮调整课程顺序。" : "存在搜索或筛选条件时，暂不允许排序，请先重置。"}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>排序</TableHead>
                  <TableHead>封面</TableHead>
                  <TableHead>课程名称</TableHead>
                  <TableHead>课程类型</TableHead>
                  <TableHead>课程简介</TableHead>
                  <TableHead>课程状态</TableHead>
                  <TableHead>开放时间</TableHead>
                  <TableHead>{modeMeta.countLabel}</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCourses.map((course, index) => (
                  <TableRow
                    key={course.id}
                    draggable={sortingEnabled}
                    onDragStart={() => handleDragStart(course.id)}
                    onDragOver={(event) => {
                      if (sortingEnabled && draggingCourseId) {
                        event.preventDefault();
                      }
                    }}
                    onDrop={() => void handleDropCourse(course.id)}
                    onDragEnd={() => setDraggingCourseId("")}
                    className={draggingCourseId === course.id ? "opacity-60" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-700">
                          {index + 1}
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <GripVertical className="size-4" />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => void handleMoveCourse(course.id, "up")}
                              disabled={!sortingEnabled || index === 0}
                              className="rounded p-0.5 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <ArrowUp className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleMoveCourse(course.id, "down")}
                              disabled={!sortingEnabled || index === filteredCourses.length - 1}
                              className="rounded p-0.5 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <ArrowDown className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <img src={course.cover} alt={course.name} className="h-16 w-24 rounded-xl object-cover" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{course.name}</p>
                        <p className="text-xs text-slate-400">后台顺序 #{course.sortOrder + 1}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={(course.courseType ?? "audio") === "video" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}>
                        {(course.courseType ?? "audio") === "video" ? "视频课程" : "音频课程"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="line-clamp-3 max-w-[320px] whitespace-normal text-sm leading-6 text-slate-600">{course.description}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Badge variant="secondary" className={statusMeta[course.status].className}>
                          {statusMeta[course.status].label}
                        </Badge>
                        <p className="text-xs whitespace-normal text-slate-400">{statusMeta[course.status].hint}</p>
                      </div>
                    </TableCell>
                    <TableCell>{course.openTime}</TableCell>
                    <TableCell>{mode === "video" ? course.videoCount : course.audioCount}</TableCell>
                    <TableCell>{course.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/courses/${course.id}/edit`)}>
                          <Pencil className="mr-2 size-4" />
                          编辑
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/courses/${course.id}/content`)}>
                          <Rows2 className="mr-2 size-4" />
                          内容管理
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void handleToggleStatus(course)}>
                          {course.status === "open" ? (
                            <>
                              <EyeOff className="mr-2 size-4" />
                              关闭
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 size-4" />
                              开放
                            </>
                          )}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => void handleDelete(course.id)}>
                          <Trash2 className="mr-2 size-4" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCourses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-14 text-center text-slate-500">
                      暂无课程
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
