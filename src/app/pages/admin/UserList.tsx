import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { CircleAlert, KeyRound, Laptop, Loader2, Plus, RefreshCcw, ShieldCheck, ShieldOff, Trash2, Upload, UserPlus } from "lucide-react";
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
import { Course, Device, MockExamSeriesPermissionOption, User, UserSummary, type AdminMockExamPaperSummary, mockApi } from "../../lib/mockData";

type UserStatusFilter = "all" | "active" | "disabled";
type UserCourseFilter = "all" | string;

interface BatchImportResult {
  createdCount: number;
  appendedCount: number;
  failed: string[];
  parsedCount?: number;
}

const DEVICE_LIMIT = 5;

const statusMeta = {
  active: { label: "启用", className: "bg-emerald-100 text-emerald-700" },
  disabled: { label: "停用", className: "bg-slate-100 text-slate-700" },
} as const;

const toggleSelectedValue = (
  value: string,
  selected: string[],
  setter: Dispatch<SetStateAction<string[]>>,
) => setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);

const buildSeriesMeta = (series: MockExamSeriesPermissionOption) => {
  const parts = [`${series.paperCount} 套试卷`];
  if (series.description.trim()) {
    parts.push(series.description.trim());
  }
  return parts.join(" · ");
};

export function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [mockExamSeries, setMockExamSeries] = useState<MockExamSeriesPermissionOption[]>([]);
  const [paperSummaries, setPaperSummaries] = useState<AdminMockExamPaperSummary[]>([]);
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
  const [showMockExamResetDialog, setShowMockExamResetDialog] = useState(false);
  const [showDeviceSheet, setShowDeviceSheet] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [singleSelectedCourses, setSingleSelectedCourses] = useState<string[]>([]);
  const [singleSelectedMockExamSeries, setSingleSelectedMockExamSeries] = useState<string[]>([]);
  const [batchPhones, setBatchPhones] = useState("");
  const [batchExcelFile, setBatchExcelFile] = useState<File | null>(null);
  const [batchSelectedCourses, setBatchSelectedCourses] = useState<string[]>([]);
  const [batchSelectedMockExamSeries, setBatchSelectedMockExamSeries] = useState<string[]>([]);
  const [batchPermissionCourses, setBatchPermissionCourses] = useState<string[]>([]);
  const [batchPermissionMockExamSeries, setBatchPermissionMockExamSeries] = useState<string[]>([]);
  const [batchImportResult, setBatchImportResult] = useState<BatchImportResult | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);
  const [resettingPaperId, setResettingPaperId] = useState("");
  const pageSize = 20;
  const deferredSearchPhone = useDeferredValue(searchPhone.trim());

  const courseNameMap = useMemo(() => new Map(courses.map((course) => [course.id, course.name])), [courses]);
  const seriesNameMap = useMemo(() => new Map(mockExamSeries.map((series) => [series.id, series.title])), [mockExamSeries]);
  const paperSummaryMap = useMemo(() => new Map(paperSummaries.map((paper) => [paper.id, paper])), [paperSummaries]);
  const selectedUserMockExamConfigMap = useMemo(
    () => new Map((selectedUser?.mockExamPermissionConfigs ?? []).map((item) => [item.paperId, item])),
    [selectedUser],
  );
  const allCurrentPageSelected = users.length > 0 && users.every((user) => selectedUserIds.includes(user.id));

  const loadSummary = async () => {
    try {
      setSummary(await mockApi.getUserSummary());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载用户汇总失败");
    }
  };

  const loadCourses = async () => {
    try {
      setCourses(await mockApi.getAllCourses());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载课程失败");
    }
  };

  const loadMockExamSeries = async () => {
    try {
      setMockExamSeries(await mockApi.getUserMockExamSeriesOptions());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载机考课程权限失败");
    }
  };

  const loadPaperSummaries = async () => {
    try {
      const payload = await mockApi.getAdminMockExamPapers();
      setPaperSummaries(payload.list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载机考试卷失败");
    }
  };

  const loadUsers = async (initial = false) => {
    if (initial) {
      setLoading(true);
    } else {
      setListLoading(true);
    }

    try {
      const result = await mockApi.getAllUsers({
        keyword: deferredSearchPhone,
        status: statusFilter,
        courseId: courseFilter,
        page,
        pageSize,
      });
      setUsers(result.items);
      setTotalUsers(result.total);
      setTotalPages(result.totalPages);
      if (result.totalPages > 0 && page > result.totalPages) {
        setPage(result.totalPages);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载用户列表失败");
    } finally {
      setLoading(false);
      setListLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadCourses(), loadMockExamSeries(), loadPaperSummaries(), loadSummary(), loadUsers(true)]);
  }, []);

  useEffect(() => {
    if (!loading) {
      void loadUsers();
    }
  }, [page, deferredSearchPhone, statusFilter, courseFilter]);

  const patchUsers = (userIds: string[], updater: (user: User) => User) => {
    const idSet = new Set(userIds);
    setUsers((prev) => prev.map((item) => (idSet.has(item.id) ? updater(item) : item)));
    setSelectedUser((prev) => (prev && idSet.has(prev.id) ? updater(prev) : prev));
  };

  const renderCourseOptions = (selected: string[], setter: Dispatch<SetStateAction<string[]>>) => (
    <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
      {courses.map((course) => (
        <label key={course.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50">
          <Checkbox checked={selected.includes(course.id)} onCheckedChange={() => toggleSelectedValue(course.id, selected, setter)} />
          <span className="text-sm text-slate-700">{course.name}</span>
        </label>
      ))}
      {courses.length === 0 ? <div className="py-4 text-center text-sm text-slate-400">暂无可选课程</div> : null}
    </div>
  );

  const renderMockExamSeriesOptions = (selected: string[], setter: Dispatch<SetStateAction<string[]>>) => (
    <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
      {mockExamSeries.map((series) => (
        <label key={series.id} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">
          <Checkbox checked={selected.includes(series.id)} onCheckedChange={() => toggleSelectedValue(series.id, selected, setter)} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">{series.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{buildSeriesMeta(series)}</p>
            {series.paperTitles.length > 0 ? <p className="mt-1 text-xs leading-5 text-slate-400">{series.paperTitles.join(" / ")}</p> : null}
          </div>
        </label>
      ))}
      {mockExamSeries.length === 0 ? <div className="py-4 text-center text-sm text-slate-400">暂无可授权机考课程</div> : null}
    </div>
  );

  const handleAddUser = async () => {
    if (!newPhone.trim()) {
      toast.error("请输入手机号");
      return;
    }
    if (singleSelectedCourses.length === 0 && singleSelectedMockExamSeries.length === 0) {
      toast.error("请至少选择一种权限");
      return;
    }

    try {
      const result = await mockApi.createUser(newPhone.trim(), singleSelectedCourses, singleSelectedMockExamSeries);
      toast.success(result.isNew ? "用户已新增" : "已为现有用户追加权限");
      setShowAddDialog(false);
      setNewPhone("");
      setSingleSelectedCourses([]);
      setSingleSelectedMockExamSeries([]);
      await Promise.all([loadUsers(), loadSummary()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "新增用户失败");
    }
  };

  const handleBatchImport = async () => {
    if (batchSelectedCourses.length === 0 && batchSelectedMockExamSeries.length === 0) {
      toast.error("请至少选择一种权限");
      return;
    }

    const phones = batchPhones
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!batchExcelFile && phones.length === 0) {
      toast.error("请输入手机号列表或上传 Excel");
      return;
    }

    setBatchImporting(true);
    setBatchImportResult(null);
    try {
      const result = batchExcelFile
        ? await mockApi.batchCreateUsersByExcel(batchExcelFile, batchSelectedCourses, batchSelectedMockExamSeries)
        : await mockApi.batchCreateUsers(phones, batchSelectedCourses, batchSelectedMockExamSeries);
      setBatchImportResult(result);
      toast.success(
        result.parsedCount
          ? `导入完成，共解析 ${result.parsedCount} 条，新增 ${result.createdCount}，追加权限 ${result.appendedCount}`
          : `导入完成，新增 ${result.createdCount}，追加权限 ${result.appendedCount}`,
      );
      await Promise.all([loadUsers(), loadSummary()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量导入失败");
    } finally {
      setBatchImporting(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) {
      return;
    }

    const addCourses = singleSelectedCourses.filter((id) => !selectedUser.coursePermissions.includes(id));
    const removeCourses = selectedUser.coursePermissions.filter((id) => !singleSelectedCourses.includes(id));
    const currentSeriesPermissions = selectedUser.mockExamPermissions ?? [];
    const addMockExamSeries = singleSelectedMockExamSeries.filter((id) => !currentSeriesPermissions.includes(id));
    const removeMockExamSeries = currentSeriesPermissions.filter((id) => !singleSelectedMockExamSeries.includes(id));

    try {
      await mockApi.updateUserPermissions(selectedUser.id, addCourses, removeCourses, addMockExamSeries, removeMockExamSeries);
      await Promise.all([loadUsers(), loadPaperSummaries()]);
      setShowPermissionDialog(false);
      toast.success("权限已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存权限失败");
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword.trim()) {
      toast.error("请输入新密码");
      return;
    }

    try {
      await mockApi.updateUserPassword(selectedUser.id, newPassword.trim());
      setShowPasswordDialog(false);
      setNewPassword("");
      toast.success("密码已修改");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改密码失败");
    }
  };

  const handleBatchAddPermissions = async () => {
    if (selectedUserIds.length === 0 || (batchPermissionCourses.length === 0 && batchPermissionMockExamSeries.length === 0)) {
      toast.error("请选择用户并至少勾选一种权限");
      return;
    }

    try {
      await mockApi.batchAddUserPermissions(selectedUserIds, batchPermissionCourses, batchPermissionMockExamSeries);
      await Promise.all([loadUsers(), loadPaperSummaries()]);
      setShowBatchPermissionDialog(false);
      setBatchPermissionCourses([]);
      setBatchPermissionMockExamSeries([]);
      toast.success("批量加权完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量加权失败");
    }
  };

  const handleBatchStatus = async (status: "active" | "disabled") => {
    if (selectedUserIds.length === 0) {
      toast.error("请先选择用户");
      return;
    }

    try {
      await mockApi.batchToggleUserStatus(selectedUserIds, status);
      patchUsers(selectedUserIds, (user) => ({ ...user, status }));
      setSelectedUserIds([]);
      void loadSummary();
      toast.success(status === "active" ? "批量启用完成" : "批量停用完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量状态更新失败");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedUserIds.length === 0) {
      toast.error("请先选择用户");
      return;
    }
    if (!window.confirm("确定删除所选用户吗？删除后会清空该用户相关数据。")) {
      return;
    }

    try {
      await mockApi.batchDeleteUsers(selectedUserIds);
      setSelectedUserIds([]);
      await Promise.all([loadUsers(), loadSummary()]);
      toast.success("批量删除完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量删除失败");
    }
  };

  const handleSingleStatus = async (user: User) => {
    const nextStatus = user.status === "active" ? "disabled" : "active";
    try {
      await mockApi.toggleUserStatus(user.id, nextStatus);
      patchUsers([user.id], (item) => ({ ...item, status: nextStatus }));
      void loadSummary();
      toast.success(nextStatus === "active" ? "用户已启用" : "用户已停用");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "状态更新失败");
    }
  };

  const handleSingleDelete = async (userId: string) => {
    if (!window.confirm("确定删除该用户吗？删除后会清空该用户相关数据。")) {
      return;
    }

    try {
      await mockApi.deleteUser(userId);
      await Promise.all([loadUsers(), loadSummary()]);
      toast.success("用户已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleViewDevices = async (user: User) => {
    setSelectedUser(user);
    setDevices([]);
    setShowDeviceSheet(true);
    setDeviceLoading(true);
    try {
      setDevices(await mockApi.getUserDevices(user.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载设备失败");
    } finally {
      setDeviceLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    try {
      await mockApi.removeDevice(deviceId);
      if (!selectedUser) {
        return;
      }
      const nextDevices = await mockApi.getUserDevices(selectedUser.id);
      setDevices(nextDevices);
      patchUsers([selectedUser.id], (user) => ({ ...user, deviceCount: nextDevices.length }));
      toast.success("该设备已退出");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "设备退出失败");
    }
  };

  const handleClearDevices = async () => {
    if (!selectedUser) {
      return;
    }
    if (!window.confirm("确定清空该用户的全部设备吗？")) {
      return;
    }

    try {
      await mockApi.clearUserDevices(selectedUser.id);
      setDevices([]);
      patchUsers([selectedUser.id], (user) => ({ ...user, deviceCount: 0 }));
      toast.success("设备已清空");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "清空设备失败");
    }
  };

  const handleResetMockExamAttempts = async (paperId: string) => {
    if (!selectedUser) {
      return;
    }

    setResettingPaperId(`attempts:${paperId}`);
    try {
      const result = await mockApi.resetUserMockExamAttempts(selectedUser.id, paperId);
      patchUsers([selectedUser.id], (user) => ({
        ...user,
        mockExamPermissionConfigs: (() => {
          const current = user.mockExamPermissionConfigs ?? [];
          const existed = current.some((item) => item.paperId === paperId);
          if (existed) {
            return current.map((item) =>
              item.paperId === paperId
                ? {
                    ...item,
                    manualAttemptLimit: result.manualAttemptLimit,
                    manualAttemptUsed: result.manualAttemptUsed,
                  }
                : item,
            );
          }
          return [
            ...current,
            {
              paperId,
              manualAttemptLimit: result.manualAttemptLimit,
              manualAttemptUsed: result.manualAttemptUsed,
              currentRecordStartedAt: "",
            },
          ];
        })(),
      }));
      toast.success("考试次数已重置");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重置考试次数失败");
    } finally {
      setResettingPaperId("");
    }
  };

  const handleResetMockExamTime = async (paperId: string) => {
    if (!selectedUser) {
      return;
    }

    setResettingPaperId(`time:${paperId}`);
    try {
      const result = await mockApi.resetUserMockExamTime(selectedUser.id, paperId);
      patchUsers([selectedUser.id], (user) => ({
        ...user,
        mockExamPermissionConfigs: (() => {
          const current = user.mockExamPermissionConfigs ?? [];
          const existed = current.some((item) => item.paperId === paperId);
          if (existed) {
            return current.map((item) =>
              item.paperId === paperId
                ? {
                    ...item,
                    currentRecordStartedAt: result.currentRecordStartedAt,
                  }
                : item,
            );
          }
          return [
            ...current,
            {
              paperId,
              manualAttemptLimit: null,
              manualAttemptUsed: 0,
              currentRecordStartedAt: result.currentRecordStartedAt,
            },
          ];
        })(),
      }));
      toast.success("考试时间已重置");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重置考试时间失败");
    } finally {
      setResettingPaperId("");
    }
  };

  const selectedUserResetPapers = useMemo(() => {
    if (!selectedUser) {
      return [];
    }

    const paperIds = Array.from(
      new Set([
        ...(selectedUser.mockExamAccessiblePaperIds ?? []),
        ...((selectedUser.mockExamPermissionConfigs ?? []).map((item) => item.paperId)),
      ]),
    );

    return paperIds.map((paperId) => ({
      paperId,
      summary: paperSummaryMap.get(paperId),
      config: selectedUserMockExamConfigMap.get(paperId),
    }));
  }, [paperSummaryMap, selectedUser, selectedUserMockExamConfigMap]);

  const renderMainContent = () => (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <h1 className="text-2xl font-semibold text-slate-900">用户管理</h1>
          <p className="mt-2 text-sm text-slate-500">管理账号、课程权限、机考课程权限、登录设备和批量导入。</p>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">总用户数</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm text-emerald-700">启用中</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-800">{summary.active}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-600">停用中</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.disabled}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm text-amber-700">设备满额</p>
              <p className="mt-2 text-3xl font-semibold text-amber-900">{summary.fullDevices}</p>
              <p className="mt-2 text-sm text-amber-800">达到 {DEVICE_LIMIT} 台设备上限</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_220px_260px_auto]">
            <Input
              placeholder="按手机号搜索"
              value={searchPhone}
              onChange={(event) => {
                setSearchPhone(event.target.value);
                setPage(1);
              }}
            />
            <Select
              value={statusFilter}
              onValueChange={(value: UserStatusFilter) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="用户状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">启用</SelectItem>
                <SelectItem value="disabled">停用</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={courseFilter}
              onValueChange={(value: UserCourseFilter) => {
                setCourseFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="按课程筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部课程</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSearchPhone("");
                setStatusFilter("all");
                setCourseFilter("all");
                setPage(1);
              }}
            >
              重置
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            课程筛选仅影响课程权限。机考权限现在按机考课程系列统一授权，系列下新增试卷会自动继承给已有授权用户。
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              共 {totalUsers} 位用户，本页 {users.length} 位，当前选中 {selectedUserIds.length} 位
              {listLoading ? "，数据更新中..." : ""}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setNewPhone("");
                  setSingleSelectedCourses([]);
                  setSingleSelectedMockExamSeries([]);
                  setShowAddDialog(true);
                }}
              >
                <UserPlus className="mr-2 size-4" />
                新增用户
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setBatchPhones("");
                  setBatchExcelFile(null);
                  setBatchSelectedCourses([]);
                  setBatchSelectedMockExamSeries([]);
                  setBatchImportResult(null);
                  setShowBatchDialog(true);
                }}
              >
                <Upload className="mr-2 size-4" />
                批量导入
              </Button>
              <Button variant="outline" disabled={selectedUserIds.length === 0} onClick={() => setShowBatchPermissionDialog(true)}>
                <Plus className="mr-2 size-4" />
                批量加权
              </Button>
              <Button variant="outline" disabled={selectedUserIds.length === 0} onClick={() => void handleBatchStatus("active")}>
                <ShieldCheck className="mr-2 size-4" />
                批量启用
              </Button>
              <Button variant="outline" disabled={selectedUserIds.length === 0} onClick={() => void handleBatchStatus("disabled")}>
                <ShieldOff className="mr-2 size-4" />
                批量停用
              </Button>
              <Button variant="destructive" disabled={selectedUserIds.length === 0} onClick={() => void handleBatchDelete()}>
                <Trash2 className="mr-2 size-4" />
                批量删除
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allCurrentPageSelected}
                      onCheckedChange={(checked) =>
                        checked === true
                          ? setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...users.map((user) => user.id)])))
                          : setSelectedUserIds((prev) => prev.filter((id) => !users.some((user) => user.id === id)))
                      }
                    />
                  </TableHead>
                  <TableHead>手机号</TableHead>
                  <TableHead>注册日期</TableHead>
                  <TableHead>上次登录</TableHead>
                  <TableHead>课程权限</TableHead>
                  <TableHead>机考课程权限</TableHead>
                  <TableHead>设备数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={(checked) =>
                          setSelectedUserIds((prev) =>
                            checked === true ? Array.from(new Set([...prev, user.id])) : prev.filter((id) => id !== user.id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{user.phone}</TableCell>
                    <TableCell>{user.registeredAt}</TableCell>
                    <TableCell>{user.lastLogin || "-"}</TableCell>
                    <TableCell>
                      <div className="flex max-w-[260px] flex-wrap gap-2 whitespace-normal">
                        {user.coursePermissions.length === 0 ? (
                          <span className="text-sm text-slate-400">暂无权限</span>
                        ) : (
                          user.coursePermissions.map((courseId) => (
                            <Badge key={courseId} variant="secondary" className="bg-blue-50 text-blue-700">
                              {courseNameMap.get(courseId) ?? courseId}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[320px] flex-wrap gap-2 whitespace-normal">
                        {(user.mockExamPermissions?.length ?? 0) === 0 ? (
                          <span className="text-sm text-slate-400">暂无权限</span>
                        ) : (
                          user.mockExamPermissions.map((seriesId) => (
                            <Badge key={seriesId} variant="secondary" className="bg-violet-50 text-violet-700">
                              {seriesNameMap.get(seriesId) ?? seriesId}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => void handleViewDevices(user)}>
                        <Laptop className="mr-2 size-4" />
                        {user.deviceCount}/{DEVICE_LIMIT}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusMeta[user.status].className}>
                        {statusMeta[user.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setSingleSelectedCourses(user.coursePermissions);
                            setSingleSelectedMockExamSeries(user.mockExamPermissions ?? []);
                            setShowPermissionDialog(true);
                          }}
                        >
                          编辑权限
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowMockExamResetDialog(true);
                          }}
                        >
                          <RefreshCcw className="mr-2 size-4" />
                          重置机考
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setNewPassword("den2024");
                            setShowPasswordDialog(true);
                          }}
                        >
                          <KeyRound className="mr-2 size-4" />
                          改密码
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void handleSingleStatus(user)}>
                          {user.status === "active" ? "停用" : "启用"}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => void handleSingleDelete(user.id)}>
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-16 text-center text-slate-500">
                      暂无符合条件的用户
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              第 {page} / {totalPages} 页，每页 {pageSize} 条
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || listLoading} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
                上一页
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || listLoading} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>
                下一页
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDialogs = () => (
    <>
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>新增用户</DialogTitle>
            <DialogDescription>默认密码为 den2024，可同时分配课程权限和机考课程权限。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-phone">手机号</Label>
              <Input id="new-phone" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="请输入手机号" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label>课程权限</Label>
                {renderCourseOptions(singleSelectedCourses, setSingleSelectedCourses)}
              </div>
              <div className="space-y-3">
                <Label>机考课程权限</Label>
                {renderMockExamSeriesOptions(singleSelectedMockExamSeries, setSingleSelectedMockExamSeries)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              取消
            </Button>
            <Button onClick={() => void handleAddUser()}>确认新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showBatchDialog}
        onOpenChange={(open) => {
          if (!batchImporting) {
            setShowBatchDialog(open);
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>批量导入用户</DialogTitle>
            <DialogDescription>支持 Excel 导入或手动粘贴手机号，并同步分配课程权限、机考课程权限。</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-user-excel">Excel 文件</Label>
              <Input
                id="batch-user-excel"
                key={batchExcelFile ? `${batchExcelFile.name}-${batchExcelFile.lastModified}` : "empty"}
                type="file"
                accept=".xls,.xlsx"
                disabled={batchImporting}
                onChange={(event) => {
                  setBatchExcelFile(event.target.files?.[0] ?? null);
                  setBatchImportResult(null);
                }}
              />
              <p className="text-xs leading-5 text-slate-500">只读取第 1 个工作表的第 1 列。</p>
            </div>
            <div className="space-y-2">
              <Label>手动粘贴手机号</Label>
              <Textarea
                value={batchPhones}
                disabled={batchImporting}
                onChange={(event) => {
                  setBatchPhones(event.target.value);
                  setBatchImportResult(null);
                }}
                placeholder={"每行一个手机号\n13800138000\n13900139000"}
                rows={8}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label>课程权限</Label>
                {renderCourseOptions(batchSelectedCourses, setBatchSelectedCourses)}
              </div>
              <div className="space-y-3">
                <Label>机考课程权限</Label>
                {renderMockExamSeriesOptions(batchSelectedMockExamSeries, setBatchSelectedMockExamSeries)}
              </div>
            </div>
            {batchImporting ? (
              <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <Loader2 className="size-4 animate-spin" />
                <span>正在导入，请稍候...</span>
              </div>
            ) : null}
            {batchImportResult ? (
              <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <span>导入完成</span>
                  <span>{batchImportResult.parsedCount ? `共解析 ${batchImportResult.parsedCount} 条` : "结果已生成"}</span>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={batchImporting} onClick={() => setShowBatchDialog(false)}>
              取消
            </Button>
            <Button disabled={batchImporting} onClick={() => void handleBatchImport()}>
              {batchImporting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  导入中...
                </>
              ) : (
                "开始导入"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>编辑用户权限</DialogTitle>
            <DialogDescription>{selectedUser?.phone ?? ""}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="space-y-3">
              <Label>课程权限</Label>
              {renderCourseOptions(singleSelectedCourses, setSingleSelectedCourses)}
            </div>
            <div className="space-y-3">
              <Label>机考课程权限</Label>
              {renderMockExamSeriesOptions(singleSelectedMockExamSeries, setSingleSelectedMockExamSeries)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionDialog(false)}>
              取消
            </Button>
            <Button onClick={() => void handleSavePermissions()}>保存权限</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMockExamResetDialog} onOpenChange={setShowMockExamResetDialog}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>重置机考试卷状态</DialogTitle>
            <DialogDescription>{selectedUser?.phone ?? ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedUserResetPapers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                该用户当前没有可重置的机考试卷记录
              </div>
            ) : (
              selectedUserResetPapers.map(({ paperId, summary: paper, config }) => {
                const resettingAttempts = resettingPaperId === `attempts:${paperId}`;
                const resettingTime = resettingPaperId === `time:${paperId}`;
                return (
                  <div key={paperId} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{paper?.title ?? paperId}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[paper?.seriesName, paper?.phase, paper?.year ? `${paper.year}年` : ""].filter(Boolean).join(" · ") || "未绑定系列"}
                        </p>
                        <p className="mt-2 text-xs leading-6 text-slate-500">
                          已用次数：{config?.manualAttemptUsed ?? 0}
                          {config?.manualAttemptLimit ? ` / ${config.manualAttemptLimit}` : ""}
                          {config?.currentRecordStartedAt ? ` · 当前开考时间：${config.currentRecordStartedAt}` : " · 当前没有进行中的考试"}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center sm:w-auto"
                          disabled={resettingAttempts || !!resettingPaperId}
                          onClick={() => void handleResetMockExamAttempts(paperId)}
                        >
                          {resettingAttempts ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCcw className="mr-2 size-4" />}
                          重置次数
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center sm:w-auto"
                          disabled={resettingTime || !!resettingPaperId}
                          onClick={() => void handleResetMockExamTime(paperId)}
                        >
                          {resettingTime ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCcw className="mr-2 size-4" />}
                          重置时间
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMockExamResetDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>用户默认密码为 den2024。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="new-password">新密码</Label>
            <Input id="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              取消
            </Button>
            <Button onClick={() => void handleChangePassword()}>确认修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBatchPermissionDialog} onOpenChange={setShowBatchPermissionDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>批量加权限</DialogTitle>
            <DialogDescription>当前已选 {selectedUserIds.length} 位用户。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="space-y-3">
              <Label>课程权限</Label>
              {renderCourseOptions(batchPermissionCourses, setBatchPermissionCourses)}
            </div>
            <div className="space-y-3">
              <Label>机考课程权限</Label>
              {renderMockExamSeriesOptions(batchPermissionMockExamSeries, setBatchPermissionMockExamSeries)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchPermissionDialog(false)}>
              取消
            </Button>
            <Button onClick={() => void handleBatchAddPermissions()}>确认加权限</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={showDeviceSheet} onOpenChange={setShowDeviceSheet}>
        <SheetContent side="right" className="w-[560px] max-w-[560px] bg-white p-0">
          <SheetHeader className="border-b border-slate-200">
            <SheetTitle>{selectedUser?.phone ?? "设备管理"}</SheetTitle>
            <SheetDescription>管理员可查看登录设备并清理设备。</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">当前设备数</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {selectedUser?.deviceCount ?? 0}/{DEVICE_LIMIT}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">说明</p>
                <p className="mt-1 text-sm text-slate-700">同一台设备重复登录不占新名额。</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备类型</TableHead>
                    <TableHead>设备型号</TableHead>
                    <TableHead>登录时间</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deviceLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                        设备信息加载中...
                      </TableCell>
                    </TableRow>
                  ) : devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                        暂无设备
                      </TableCell>
                    </TableRow>
                  ) : (
                    devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>{device.type}</TableCell>
                        <TableCell>{device.model}</TableCell>
                        <TableCell>{device.loginTime}</TableCell>
                        <TableCell>{device.ip}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => void handleRemoveDevice(device.id)}>
                            退出该设备
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <SheetFooter className="border-t border-slate-200">
            <Button variant="outline" onClick={() => setShowDeviceSheet(false)}>
              关闭
            </Button>
            <Button variant="destructive" onClick={() => void handleClearDevices()}>
              <CircleAlert className="mr-2 size-4" />
              清空全部设备
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );

  if (loading) {
    return <div className="p-8 text-slate-500">用户数据加载中...</div>;
  }

  return (
    <>
      {renderMainContent()}
      {renderDialogs()}
    </>
  );
}
