import { KeyRound, Pencil, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { getAdminSessionKeys } from "../../lib/admin-session";
import { AdminAccount, mockApi } from "../../lib/mockData";

const ADMIN_ROLE_OPTIONS = [
  { value: "super_admin", label: "超级管理员" },
  { value: "operations_admin", label: "总后台管理员" },
  { value: "user_admin", label: "用户权限管理员" },
  { value: "review_admin", label: "批改管理员" },
] as const;

const formatAdminRoleLabel = (role: AdminAccount["role"]) =>
  ADMIN_ROLE_OPTIONS.find((item) => item.value === role)?.label ?? "总后台管理员";

export function AdminAccountList() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminAccount | null>(null);
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminAccount["role"]>("operations_admin");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const currentAdminId = localStorage.getItem("adminId") ?? "";
  const currentAdminAccount = localStorage.getItem("adminAccount") ?? "";

  const loadData = async () => {
    try {
      setLoading(true);
      setAdmins(await mockApi.getAllAdmins());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载管理员账号失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const summary = useMemo(
    () => ({
      total: admins.length,
      currentName: admins.find((item) => item.id === currentAdminId)?.name ?? "当前账号",
    }),
    [admins, currentAdminId],
  );

  const resetEditForm = () => {
    setEditingAdmin(null);
    setAccount("");
    setName("");
    setRole("operations_admin");
    setPassword("");
  };

  const openCreateDialog = () => {
    resetEditForm();
    setShowEditDialog(true);
  };

  const openEditDialog = (admin: AdminAccount) => {
    setEditingAdmin(admin);
    setAccount(admin.account);
    setName(admin.name);
    setRole(admin.role);
    setPassword("");
    setShowEditDialog(true);
  };

  const openPasswordDialog = (admin: AdminAccount) => {
    setEditingAdmin(admin);
    setPassword("");
    setShowPasswordDialog(true);
  };

  const handleSaveAdmin = async () => {
    if (!account.trim() || !name.trim()) {
      toast.error("请填写管理员账号和姓名");
      return;
    }

    if (!editingAdmin && !password.trim()) {
      toast.error("新增管理员时请填写登录密码");
      return;
    }

    setSaving(true);
    try {
      const result = editingAdmin
        ? await mockApi.updateAdminAccount(editingAdmin.id, {
            account: account.trim(),
            name: name.trim(),
            role,
          })
        : await mockApi.createAdminAccount({
            account: account.trim(),
            name: name.trim(),
            password: password.trim(),
            role,
          });

      if (result.id === currentAdminId) {
        localStorage.setItem("adminAccount", result.account);
        localStorage.setItem(getAdminSessionKeys("admin").role, result.role);
      }

      toast.success(editingAdmin ? "管理员信息已更新" : "管理员账号已创建");
      setShowEditDialog(false);
      resetEditForm();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存管理员信息失败");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!editingAdmin || !password.trim()) {
      toast.error("请输入新的管理员密码");
      return;
    }

    setSaving(true);
    try {
      await mockApi.updateAdminPassword(editingAdmin.id, password.trim());
      toast.success("管理员密码已更新");
      setShowPasswordDialog(false);
      setPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新管理员密码失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (admin: AdminAccount) => {
    if (admin.id === currentAdminId) {
      toast.error("当前登录的管理员账号不能删除");
      return;
    }

    if (!window.confirm(`确定删除管理员账号“${admin.account}”吗？`)) return;

    try {
      await mockApi.deleteAdminAccount(admin.id);
      toast.success("管理员账号已删除");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除管理员账号失败");
    }
  };

  return (
    <>
      <div className="p-8">
        <div className="rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-8 py-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">管理员账号管理</h1>
                <p className="mt-2 text-sm text-slate-500">管理后台登录账号，可新增管理员、编辑账号信息、重置密码或删除账号。</p>
              </div>
              <Button onClick={openCreateDialog}>
                <UserPlus className="mr-2 size-4" />
                新增管理员
              </Button>
            </div>
          </div>

          <div className="space-y-6 px-8 py-6">
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">管理员总数</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.total}</p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-sm text-blue-700">当前登录账号</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{currentAdminAccount || "-"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">当前管理员姓名</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.currentName}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>管理员姓名</TableHead>
                    <TableHead>登录账号</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>最近更新</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium text-slate-900">{admin.name}</TableCell>
                      <TableCell>{admin.account}</TableCell>
                      <TableCell>{formatAdminRoleLabel(admin.role)}</TableCell>
                      <TableCell>{admin.createdAt}</TableCell>
                      <TableCell>{admin.updatedAt}</TableCell>
                      <TableCell>
                        {admin.id === currentAdminId ? (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                            当前登录
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(admin)}>
                            <Pencil className="mr-2 size-4" />
                            编辑
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openPasswordDialog(admin)}>
                            <KeyRound className="mr-2 size-4" />
                            重置密码
                          </Button>
                          <Button variant="destructive" size="sm" disabled={admin.id === currentAdminId} onClick={() => void handleDelete(admin)}>
                            <Trash2 className="mr-2 size-4" />
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {admins.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center text-slate-500">
                        暂无管理员账号
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) resetEditForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAdmin ? "编辑管理员" : "新增管理员"}</DialogTitle>
            <DialogDescription>管理员账号用于后台登录，请填写姓名、登录账号和密码信息。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">管理员姓名</Label>
              <Input id="admin-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入管理员姓名" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-account">登录账号</Label>
              <Input id="admin-account" value={account} onChange={(event) => setAccount(event.target.value)} placeholder="请输入后台登录账号" />
            </div>

            <div className="space-y-2">
              <Label>权限角色</Label>
              <Select value={role} onValueChange={(value: AdminAccount["role"]) => setRole(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_ROLE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!editingAdmin && (
              <div className="space-y-2">
                <Label htmlFor="admin-password">登录密码</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入后台登录密码"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={() => void handleSaveAdmin()} disabled={saving}>
              {saving ? "保存中..." : editingAdmin ? "保存修改" : "确认新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPasswordDialog}
        onOpenChange={(open) => {
          setShowPasswordDialog(open);
          if (!open) {
            setEditingAdmin(null);
            setPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置管理员密码</DialogTitle>
            <DialogDescription>{editingAdmin ? `正在为账号 ${editingAdmin.account} 设置新的登录密码。` : "请输入新的管理员密码。"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="reset-admin-password">新密码</Label>
            <Input
              id="reset-admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入新的管理员密码"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              取消
            </Button>
            <Button onClick={() => void handleUpdatePassword()} disabled={saving}>
              {saving ? "保存中..." : "确认更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
