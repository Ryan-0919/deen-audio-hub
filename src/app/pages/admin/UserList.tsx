import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { CircleAlert, KeyRound, Laptop, Loader2, Plus, ShieldCheck, ShieldOff, Trash2, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
import { Course, Device, MockExamPermissionOption, User, UserSummary, mockApi } from "../../lib/mockData";

type UserStatusFilter = "all" | "active" | "disabled";
type UserCourseFilter = "all" | string;
interface BatchImportResult { createdCount: number; appendedCount: number; failed: string[]; parsedCount?: number }

const DEVICE_LIMIT = 5;
const statusMeta = {
  active: { label: "启用", className: "bg-emerald-100 text-emerald-700" },
  disabled: { label: "停用", className: "bg-slate-100 text-slate-700" },
} as const;

const toggleCourse = (courseId: string, selected: string[], setter: Dispatch<SetStateAction<string[]>>) =>
  setter(selected.includes(courseId) ? selected.filter((item) => item !== courseId) : [...selected, courseId]);

export function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [mockExamPapers, setMockExamPapers] = useState<MockExamPermissionOption[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [summary, setSummary] = useState<UserSummary>({ total: 0, active: 0, disabled: 0, fullDevices: 0 });
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [courseFilter, setCourseFilter] = useState<UserCourseFilter>("all");
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showBatchPermissionDialog, setShowBatchPermissionDialog] = useState(false);
  const [showDeviceSheet, setShowDeviceSheet] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [singleSelectedCourses, setSingleSelectedCourses] = useState<string[]>([]);
  const [singleSelectedMockExamPapers, setSingleSelectedMockExamPapers] = useState<string[]>([]);
  const [batchPhones, setBatchPhones] = useState("");
  const [batchExcelFile, setBatchExcelFile] = useState<File | null>(null);
  const [batchSelectedCourses, setBatchSelectedCourses] = useState<string[]>([]);
  const [batchSelectedMockExamPapers, setBatchSelectedMockExamPapers] = useState<string[]>([]);
  const [batchPermissionCourses, setBatchPermissionCourses] = useState<string[]>([]);
  const [batchPermissionMockExamPapers, setBatchPermissionMockExamPapers] = useState<string[]>([]);
  const [batchImportResult, setBatchImportResult] = useState<BatchImportResult | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);
  const pageSize = 20;
  const deferredSearchPhone = useDeferredValue(searchPhone.trim());
  const courseNameMap = useMemo(() => new Map(courses.map((course) => [course.id, course.name])), [courses]);
  const mockExamPaperNameMap = useMemo(() => new Map(mockExamPapers.map((paper) => [paper.id, paper.title])), [mockExamPapers]);
  const allCurrentPageSelected = users.length > 0 && users.every((user) => selectedUserIds.includes(user.id));

  const loadSummary = async () => { try { setSummary(await mockApi.getUserSummary()); } catch (error) { toast.error(error instanceof Error ? error.message : "加载用户汇总失败"); } };
  const loadCourses = async () => { try { setCourses(await mockApi.getAllCourses()); } catch (error) { toast.error(error instanceof Error ? error.message : "加载课程失败"); } };
  const loadMockExamPapers = async () => { try { setMockExamPapers(await mockApi.getAllMockExamPermissionPapers()); } catch (error) { toast.error(error instanceof Error ? error.message : "加载试卷权限列表失败"); } };
  const loadUsers = async (initial = false) => {
    if (initial) setLoading(true); else setListLoading(true);
    try {
      const result = await mockApi.getAllUsers({ keyword: deferredSearchPhone, status: statusFilter, courseId: courseFilter, page, pageSize });
      setUsers(result.items); setTotalUsers(result.total); setTotalPages(result.totalPages);
      if (result.totalPages > 0 && page > result.totalPages) setPage(result.totalPages);
    } catch (error) { toast.error(error instanceof Error ? error.message : "加载用户列表失败"); }
    finally { setLoading(false); setListLoading(false); }
  };

  useEffect(() => { void Promise.all([loadCourses(), loadMockExamPapers(), loadSummary(), loadUsers(true)]); }, []);
  useEffect(() => { if (!loading) void loadUsers(); }, [page, deferredSearchPhone, statusFilter, courseFilter]);

  const patchUsers = (userIds: string[], updater: (user: User) => User) => {
    const set = new Set(userIds);
    setUsers((prev) => prev.map((item) => (set.has(item.id) ? updater(item) : item)));
    setSelectedUser((prev) => (prev && set.has(prev.id) ? updater(prev) : prev));
  };
  const renderCourseOptions = (selected: string[], setter: Dispatch<SetStateAction<string[]>>) => (
    <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
      {courses.map((course) => (
        <label key={course.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50">
          <Checkbox checked={selected.includes(course.id)} onCheckedChange={() => toggleCourse(course.id, selected, setter)} />
          <span className="text-sm text-slate-700">{course.name}</span>
        </label>
      ))}
      {courses.length === 0 ? <div className="py-4 text-center text-sm text-slate-400">暂无可选课程</div> : null}
    </div>
  );

  const renderMockExamPaperOptions = (selected: string[], setter: Dispatch<SetStateAction<string[]>>) => (
    <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
      {mockExamPapers.map((paper) => (
        <label key={paper.id} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">
          <Checkbox checked={selected.includes(paper.id)} onCheckedChange={() => setter(selected.includes(paper.id) ? selected.filter((item) => item !== paper.id) : [...selected, paper.id])} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">{paper.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {[paper.paperTypeLabel, paper.year > 0 ? `${paper.year}` : "", paper.phase, paper.reviewEnabled ? "需批改" : "直接解析"].filter(Boolean).join(" · ")}
            </p>
          </div>
        </label>
      ))}
      {mockExamPapers.length === 0 ? <div className="py-4 text-center text-sm text-slate-400">暂无可选试卷</div> : null}
    </div>
  );

  const handleAddUser = async () => {
    if (!newPhone.trim()) return toast.error("请输入手机号");
    if (singleSelectedCourses.length === 0 && singleSelectedMockExamPapers.length === 0) return toast.error("请至少选择一种权限");
    try { const result = await mockApi.createUser(newPhone.trim(), singleSelectedCourses, singleSelectedMockExamPapers); toast.success(result.isNew ? "用户已新增" : "已为现有用户追加课程权限"); setShowAddDialog(false); setNewPhone(""); setSingleSelectedCourses([]); setSingleSelectedMockExamPapers([]); await Promise.all([loadUsers(), loadSummary()]); }
    catch (error) { toast.error(error instanceof Error ? error.message : "新增用户失败"); }
  };

  const handleBatchImport = async () => {
    if (batchSelectedCourses.length === 0 && batchSelectedMockExamPapers.length === 0) return toast.error("请至少选择一种权限");
    const phones = batchPhones.split("\n").map((item) => item.trim()).filter(Boolean);
    if (!batchExcelFile && phones.length === 0) return toast.error("请输入手机号列表或上传 Excel");
    setBatchImporting(true); setBatchImportResult(null);
    try {
      const result = batchExcelFile ? await mockApi.batchCreateUsersByExcel(batchExcelFile, batchSelectedCourses, batchSelectedMockExamPapers) : await mockApi.batchCreateUsers(phones, batchSelectedCourses, batchSelectedMockExamPapers);
      setBatchImportResult(result);
      toast.success(result.parsedCount ? `导入完成，共解析 ${result.parsedCount} 条，新增 ${result.createdCount}，追加权限 ${result.appendedCount}` : `导入完成，新增 ${result.createdCount}，追加权限 ${result.appendedCount}`);
      await Promise.all([loadUsers(), loadSummary()]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "批量导入失败"); }
    finally { setBatchImporting(false); }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    const addCourses = singleSelectedCourses.filter((id) => !selectedUser.coursePermissions.includes(id));
    const removeCourses = selectedUser.coursePermissions.filter((id) => !singleSelectedCourses.includes(id));
    const currentMockExamPermissions = selectedUser.mockExamPermissions ?? [];
    const addMockExamPapers = singleSelectedMockExamPapers.filter((id) => !currentMockExamPermissions.includes(id));
    const removeMockExamPapers = currentMockExamPermissions.filter((id) => !singleSelectedMockExamPapers.includes(id));
    try {
      await mockApi.updateUserPermissions(selectedUser.id, addCourses, removeCourses, addMockExamPapers, removeMockExamPapers);
      patchUsers([selectedUser.id], (user) => ({ ...user, coursePermissions: [...singleSelectedCourses], mockExamPermissions: [...singleSelectedMockExamPapers] }));
      setShowPermissionDialog(false);
      toast.success("用户权限已更新");
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "更新课程权限失败"); }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword.trim()) return toast.error("请输入新密码");
    try { await mockApi.updateUserPassword(selectedUser.id, newPassword.trim()); setShowPasswordDialog(false); setNewPassword(""); toast.success("密码已修改"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "修改密码失败"); }
  };

  const handleBatchAddCourses = async () => {
    if (selectedUserIds.length === 0 || (batchPermissionCourses.length === 0 && batchPermissionMockExamPapers.length === 0)) return toast.error("请选择用户和权限");
    try {
      await mockApi.batchAddUserPermissions(selectedUserIds, batchPermissionCourses, batchPermissionMockExamPapers);
      patchUsers(selectedUserIds, (user) => ({
        ...user,
        coursePermissions: Array.from(new Set([...user.coursePermissions, ...batchPermissionCourses])),
        mockExamPermissions: Array.from(new Set([...(user.mockExamPermissions ?? []), ...batchPermissionMockExamPapers])),
      }));
      setShowBatchPermissionDialog(false);
      setBatchPermissionCourses([]);
      setBatchPermissionMockExamPapers([]);
      toast.success("批量加权限完成");
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "批量加课失败"); }
  };

  const handleBatchStatus = async (status: "active" | "disabled") => {
    if (selectedUserIds.length === 0) return toast.error("请先选择用户");
    try { await mockApi.batchToggleUserStatus(selectedUserIds, status); patchUsers(selectedUserIds, (user) => ({ ...user, status })); setSelectedUserIds([]); void loadSummary(); toast.success(status === "active" ? "批量启用完成" : "批量停用完成"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "批量状态更新失败"); }
  };

  const handleBatchDelete = async () => {
    if (selectedUserIds.length === 0) return toast.error("请先选择用户");
    if (!window.confirm("确定删除所选用户吗？删除后会清空该用户相关数据。")) return;
    try { await mockApi.batchDeleteUsers(selectedUserIds); setSelectedUserIds([]); await Promise.all([loadUsers(), loadSummary()]); toast.success("批量删除完成"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "批量删除失败"); }
  };

  const handleSingleStatus = async (user: User) => {
    const nextStatus = user.status === "active" ? "disabled" : "active";
    try { await mockApi.toggleUserStatus(user.id, nextStatus); patchUsers([user.id], (item) => ({ ...item, status: nextStatus })); void loadSummary(); toast.success(nextStatus === "active" ? "用户已启用" : "用户已停用"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "状态更新失败"); }
  };

  const handleSingleDelete = async (userId: string) => {
    if (!window.confirm("确定删除该用户吗？删除后会清空该用户相关数据。")) return;
    try { await mockApi.deleteUser(userId); await Promise.all([loadUsers(), loadSummary()]); toast.success("用户已删除"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "删除失败"); }
  };

  const handleViewDevices = async (user: User) => {
    setSelectedUser(user); setDevices([]); setShowDeviceSheet(true); setDeviceLoading(true);
    try { setDevices(await mockApi.getUserDevices(user.id)); } catch (error) { toast.error(error instanceof Error ? error.message : "加载设备失败"); } finally { setDeviceLoading(false); }
  };
  const handleRemoveDevice = async (deviceId: string) => {
    try { await mockApi.removeDevice(deviceId); if (!selectedUser) return; const nextDevices = await mockApi.getUserDevices(selectedUser.id); setDevices(nextDevices); patchUsers([selectedUser.id], (user) => ({ ...user, deviceCount: nextDevices.length })); toast.success("该设备已退出"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "设备退出失败"); }
  };
  const handleClearDevices = async () => {
    if (!selectedUser) return;
    if (!window.confirm("确定清空该用户的全部设备吗？")) return;
    try { await mockApi.clearUserDevices(selectedUser.id); setDevices([]); patchUsers([selectedUser.id], (user) => ({ ...user, deviceCount: 0 })); toast.success("设备已清空"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "清空设备失败"); }
  };

  if (loading) return <div className="p-8 text-slate-500">用户数据加载中...</div>;

  return <>
    <div className="p-8"><div className="rounded-3xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-8 py-6"><h1 className="text-2xl font-semibold text-slate-900">用户管理</h1><p className="mt-2 text-sm text-slate-500">管理账号、课程权限、试卷权限、登录设备和批量导入。</p></div>
      <div className="space-y-6 px-8 py-6">
        <div className="grid gap-4 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">总用户数</p><p className="mt-2 text-3xl font-semibold text-slate-900">{summary.total}</p></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm text-emerald-700">启用中</p><p className="mt-2 text-3xl font-semibold text-emerald-800">{summary.active}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-sm text-slate-600">停用中</p><p className="mt-2 text-3xl font-semibold text-slate-900">{summary.disabled}</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm text-amber-700">设备满额</p><p className="mt-2 text-3xl font-semibold text-amber-900">{summary.fullDevices}</p><p className="mt-2 text-sm text-amber-800">达到 {DEVICE_LIMIT} 台设备上限</p></div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_220px_260px_auto]">
          <Input placeholder="按手机号搜索" value={searchPhone} onChange={(event) => { setSearchPhone(event.target.value); setPage(1); }} />
          <Select value={statusFilter} onValueChange={(value: UserStatusFilter) => { setStatusFilter(value); setPage(1); }}><SelectTrigger><SelectValue placeholder="用户状态" /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="active">启用</SelectItem><SelectItem value="disabled">停用</SelectItem></SelectContent></Select>
          <Select value={courseFilter} onValueChange={(value: UserCourseFilter) => { setCourseFilter(value); setPage(1); }}><SelectTrigger><SelectValue placeholder="按课程筛选" /></SelectTrigger><SelectContent><SelectItem value="all">全部课程</SelectItem>{courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" onClick={() => { setSearchPhone(""); setStatusFilter("all"); setCourseFilter("all"); setPage(1); }}>重置</Button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">选择课程后，仅显示拥有该课程权限的用户。</div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">共 {totalUsers} 位用户，本页 {users.length} 位，当前选中 {selectedUserIds.length} 位{listLoading ? "，数据更新中..." : ""}</div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setNewPhone(""); setSingleSelectedCourses([]); setShowAddDialog(true); }}><UserPlus className="mr-2 size-4" />新增用户</Button>
            <Button variant="outline" onClick={() => { setBatchPhones(""); setBatchExcelFile(null); setBatchSelectedCourses([]); setBatchImportResult(null); setShowBatchDialog(true); }}><Upload className="mr-2 size-4" />批量导入</Button>
            <Button variant="outline" disabled={selectedUserIds.length === 0} onClick={() => setShowBatchPermissionDialog(true)}><Plus className="mr-2 size-4" />批量加课</Button>
            <Button variant="outline" disabled={selectedUserIds.length === 0} onClick={() => void handleBatchStatus("active")}><ShieldCheck className="mr-2 size-4" />批量启用</Button>
            <Button variant="outline" disabled={selectedUserIds.length === 0} onClick={() => void handleBatchStatus("disabled")}><ShieldOff className="mr-2 size-4" />批量停用</Button>
            <Button variant="destructive" disabled={selectedUserIds.length === 0} onClick={() => void handleBatchDelete()}><Trash2 className="mr-2 size-4" />批量删除</Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200"><Table>
          <TableHeader><TableRow><TableHead className="w-12"><Checkbox checked={allCurrentPageSelected} onCheckedChange={(checked) => checked === true ? setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...users.map((user) => user.id)]))) : setSelectedUserIds((prev) => prev.filter((id) => !users.some((user) => user.id === id)))} /></TableHead><TableHead>手机号</TableHead><TableHead>注册日期</TableHead><TableHead>上次登录</TableHead><TableHead>课程权限</TableHead><TableHead>试卷权限</TableHead><TableHead>设备数</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map((user) => <TableRow key={user.id}><TableCell><Checkbox checked={selectedUserIds.includes(user.id)} onCheckedChange={(checked) => setSelectedUserIds((prev) => checked === true ? Array.from(new Set([...prev, user.id])) : prev.filter((id) => id !== user.id))} /></TableCell><TableCell className="font-medium text-slate-900">{user.phone}</TableCell><TableCell>{user.registeredAt}</TableCell><TableCell>{user.lastLogin || "-"}</TableCell><TableCell><div className="flex max-w-[260px] flex-wrap gap-2 whitespace-normal">{user.coursePermissions.length === 0 ? <span className="text-sm text-slate-400">暂无权限</span> : user.coursePermissions.map((courseId) => <Badge key={courseId} variant="secondary" className="bg-blue-50 text-blue-700">{courseNameMap.get(courseId) ?? courseId}</Badge>)}</div></TableCell><TableCell><div className="flex max-w-[260px] flex-wrap gap-2 whitespace-normal">{(user.mockExamPermissions?.length ?? 0) === 0 ? <span className="text-sm text-slate-400">暂无权限</span> : user.mockExamPermissions.map((paperId) => <Badge key={paperId} variant="secondary" className="bg-violet-50 text-violet-700">{mockExamPaperNameMap.get(paperId) ?? paperId}</Badge>)}</div></TableCell><TableCell><Button variant="outline" size="sm" onClick={() => void handleViewDevices(user)}><Laptop className="mr-2 size-4" />{user.deviceCount}/{DEVICE_LIMIT}</Button></TableCell><TableCell><Badge variant="secondary" className={statusMeta[user.status].className}>{statusMeta[user.status].label}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setSelectedUser(user); setSingleSelectedCourses(user.coursePermissions); setSingleSelectedMockExamPapers(user.mockExamPermissions ?? []); setShowPermissionDialog(true); }}>编辑权限</Button><Button variant="outline" size="sm" onClick={() => { setSelectedUser(user); setNewPassword("den2024"); setShowPasswordDialog(true); }}><KeyRound className="mr-2 size-4" />改密码</Button><Button variant="outline" size="sm" onClick={() => void handleSingleStatus(user)}>{user.status === "active" ? "停用" : "启用"}</Button><Button variant="destructive" size="sm" onClick={() => void handleSingleDelete(user.id)}>删除</Button></div></TableCell></TableRow>)}
            {users.length === 0 ? <TableRow><TableCell colSpan={9} className="py-16 text-center text-slate-500">暂无符合条件的用户</TableCell></TableRow> : null}
          </TableBody>
        </Table></div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-slate-500">第 {page} / {totalPages} 页，每页 {pageSize} 条</div><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || listLoading} onClick={() => setPage((current) => Math.max(current - 1, 1))}>上一页</Button><Button variant="outline" size="sm" disabled={page >= totalPages || listLoading} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>下一页</Button></div></div>
      </div>
    </div></div>

    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>新增用户</DialogTitle><DialogDescription>默认密码为 den2024，可同时分配课程权限和试卷权限。</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div className="space-y-2"><Label htmlFor="new-phone">手机号</Label><Input id="new-phone" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="请输入手机号" /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-3"><Label>课程权限</Label>{renderCourseOptions(singleSelectedCourses, setSingleSelectedCourses)}</div><div className="space-y-3"><Label>试卷权限</Label>{renderMockExamPaperOptions(singleSelectedMockExamPapers, setSingleSelectedMockExamPapers)}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setShowAddDialog(false)}>取消</Button><Button onClick={() => void handleAddUser()}>确认新增</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={showBatchDialog} onOpenChange={(open) => { if (!batchImporting) setShowBatchDialog(open); }}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>批量导入用户</DialogTitle><DialogDescription>支持 Excel 导入或手动粘贴手机号，并同步分配课程权限、试卷权限。</DialogDescription></DialogHeader><div className="space-y-5 py-4"><div className="space-y-2"><Label htmlFor="batch-user-excel">Excel 文件</Label><Input id="batch-user-excel" key={batchExcelFile ? `${batchExcelFile.name}-${batchExcelFile.lastModified}` : "empty"} type="file" accept=".xls,.xlsx" disabled={batchImporting} onChange={(event) => { setBatchExcelFile(event.target.files?.[0] ?? null); setBatchImportResult(null); }} /><p className="text-xs leading-5 text-slate-500">只读取第 1 个工作表的第 1 列。</p>{batchExcelFile ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><p>已选文件：{batchExcelFile.name}</p><Button type="button" variant="ghost" disabled={batchImporting} className="mt-2 h-auto px-0 text-sm text-slate-500 hover:bg-transparent hover:text-slate-900" onClick={() => setBatchExcelFile(null)}>移除文件</Button></div> : null}</div><div className="space-y-2"><Label>手动粘贴手机号</Label><Textarea value={batchPhones} disabled={batchImporting} onChange={(event) => { setBatchPhones(event.target.value); setBatchImportResult(null); }} placeholder={"每行一个手机号\n13800138000\n13900139000"} rows={8} /></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-3"><Label>课程权限</Label>{renderCourseOptions(batchSelectedCourses, setBatchSelectedCourses)}</div><div className="space-y-3"><Label>试卷权限</Label>{renderMockExamPaperOptions(batchSelectedMockExamPapers, setBatchSelectedMockExamPapers)}</div></div>{batchImporting ? <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700"><Loader2 className="size-4 animate-spin" /><span>正在导入，请稍候...</span></div> : null}{batchImportResult ? <div className="space-y-3 rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><span>导入完成</span><span>{batchImportResult.parsedCount ? `共解析 ${batchImportResult.parsedCount} 条` : "结果已生成"}</span></div><div className={`grid gap-3 ${batchImportResult.parsedCount ? "md:grid-cols-4" : "md:grid-cols-3"}`}>{batchImportResult.parsedCount ? <div className="rounded-xl bg-white px-4 py-3"><p className="text-xs text-slate-500">解析条数</p><p className="mt-2 text-2xl font-semibold text-slate-900">{batchImportResult.parsedCount}</p></div> : null}<div className="rounded-xl bg-white px-4 py-3"><p className="text-xs text-slate-500">新增用户</p><p className="mt-2 text-2xl font-semibold text-slate-900">{batchImportResult.createdCount}</p></div><div className="rounded-xl bg-white px-4 py-3"><p className="text-xs text-slate-500">追加权限</p><p className="mt-2 text-2xl font-semibold text-slate-900">{batchImportResult.appendedCount}</p></div><div className="rounded-xl bg-white px-4 py-3"><p className="text-xs text-slate-500">失败数量</p><p className="mt-2 text-2xl font-semibold text-slate-900">{batchImportResult.failed.length}</p></div></div>{batchImportResult.failed.length > 0 ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><p className="font-medium">失败手机号</p><p className="mt-2 break-all leading-6">{batchImportResult.failed.join("、")}</p></div> : null}</div> : null}</div><DialogFooter><Button variant="outline" disabled={batchImporting} onClick={() => setShowBatchDialog(false)}>取消</Button><Button disabled={batchImporting} onClick={() => void handleBatchImport()}>{batchImporting ? <><Loader2 className="mr-2 size-4 animate-spin" />导入中...</> : "开始导入"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>编辑用户权限</DialogTitle><DialogDescription>{selectedUser?.phone ?? ""}</DialogDescription></DialogHeader><div className="grid gap-4 py-4 md:grid-cols-2"><div className="space-y-3"><Label>课程权限</Label>{renderCourseOptions(singleSelectedCourses, setSingleSelectedCourses)}</div><div className="space-y-3"><Label>试卷权限</Label>{renderMockExamPaperOptions(singleSelectedMockExamPapers, setSingleSelectedMockExamPapers)}</div></div><DialogFooter><Button variant="outline" onClick={() => setShowPermissionDialog(false)}>取消</Button><Button onClick={() => void handleSavePermissions()}>保存权限</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}><DialogContent><DialogHeader><DialogTitle>修改密码</DialogTitle><DialogDescription>用户默认密码为 den2024。</DialogDescription></DialogHeader><div className="space-y-2 py-4"><Label htmlFor="new-password">新密码</Label><Input id="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setShowPasswordDialog(false)}>取消</Button><Button onClick={() => void handleChangePassword()}>确认修改</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={showBatchPermissionDialog} onOpenChange={setShowBatchPermissionDialog}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>批量加权限</DialogTitle><DialogDescription>当前已选 {selectedUserIds.length} 位用户。</DialogDescription></DialogHeader><div className="grid gap-4 py-4 md:grid-cols-2"><div className="space-y-3"><Label>课程权限</Label>{renderCourseOptions(batchPermissionCourses, setBatchPermissionCourses)}</div><div className="space-y-3"><Label>试卷权限</Label>{renderMockExamPaperOptions(batchPermissionMockExamPapers, setBatchPermissionMockExamPapers)}</div></div><DialogFooter><Button variant="outline" onClick={() => setShowBatchPermissionDialog(false)}>取消</Button><Button onClick={() => void handleBatchAddCourses()}>确认加权限</Button></DialogFooter></DialogContent></Dialog>

    <Sheet open={showDeviceSheet} onOpenChange={setShowDeviceSheet}><SheetContent side="right" className="w-[560px] max-w-[560px] bg-white p-0"><SheetHeader className="border-b border-slate-200"><SheetTitle>{selectedUser?.phone ?? "设备管理"}</SheetTitle><SheetDescription>管理员可查看登录设备并清理设备。</SheetDescription></SheetHeader><div className="space-y-4 p-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">当前设备数</p><p className="mt-1 text-xl font-semibold text-slate-900">{selectedUser?.deviceCount ?? 0}/{DEVICE_LIMIT}</p></div><div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">说明</p><p className="mt-1 text-sm text-slate-700">同一台设备重复登录不占新名额。</p></div></div><div className="overflow-hidden rounded-2xl border border-slate-200"><Table><TableHeader><TableRow><TableHead>设备类型</TableHead><TableHead>设备型号</TableHead><TableHead>登录时间</TableHead><TableHead>IP</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{deviceLoading ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-slate-500">设备信息加载中...</TableCell></TableRow> : devices.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-slate-500">暂无设备</TableCell></TableRow> : devices.map((device) => <TableRow key={device.id}><TableCell>{device.type}</TableCell><TableCell>{device.model}</TableCell><TableCell>{device.loginTime}</TableCell><TableCell>{device.ip}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => void handleRemoveDevice(device.id)}>退出该设备</Button></TableCell></TableRow>)}</TableBody></Table></div></div><SheetFooter className="border-t border-slate-200"><Button variant="outline" onClick={() => setShowDeviceSheet(false)}>关闭</Button><Button variant="destructive" onClick={() => void handleClearDevices()}><CircleAlert className="mr-2 size-4" />清空全部设备</Button></SheetFooter></SheetContent></Sheet>
  </>;
}
