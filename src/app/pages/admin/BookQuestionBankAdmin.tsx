import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";
import {
  type AdminBookQuestionBankPermissionRow,
  type BookQuestionBank,
  type BookQuestionBankStatus,
  type BookQuestionBankSubject,
  mockApi,
} from "../../lib/mockData";
import { BookQuestionBankItemWorkbench } from "./BookQuestionBankItemWorkbench";

type AdminTab = "book" | "subjects" | "items" | "permissions";

type BookFormState = {
  name: string;
  code: string;
  description: string;
  coverUrl: string;
  coverObjectKey: string;
  status: BookQuestionBankStatus;
  isVisible: boolean;
  sortOrder: string;
};

type SubjectFormState = {
  name: string;
  code: string;
  description: string;
  sortOrder: string;
};

const statusLabelMap: Record<BookQuestionBankStatus, string> = {
  draft: "草稿",
  published: "已发布",
  closed: "已关闭",
};

const statusToneMap: Record<BookQuestionBankStatus, string> = {
  draft: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-700",
};

const emptyBookForm = (): BookFormState => ({
  name: "",
  code: "",
  description: "",
  coverUrl: "",
  coverObjectKey: "",
  status: "draft",
  isVisible: true,
  sortOrder: "",
});

const emptySubjectForm = (): SubjectFormState => ({
  name: "",
  code: "",
  description: "",
  sortOrder: "",
});

const mapBookToForm = (book: BookQuestionBank): BookFormState => ({
  name: book.name,
  code: book.code,
  description: book.description || "",
  coverUrl: book.coverUrl || "",
  coverObjectKey: book.coverObjectKey || "",
  status: book.status,
  isVisible: book.isVisible,
  sortOrder: `${book.sortOrder ?? 0}`,
});

const mapSubjectToForm = (subject: BookQuestionBankSubject): SubjectFormState => ({
  name: subject.name,
  code: subject.code,
  description: subject.description || "",
  sortOrder: `${subject.sortOrder ?? 0}`,
});

export function BookQuestionBankAdmin() {
  const [tabValue, setTabValue] = useState<AdminTab>("items");
  const [initialLoading, setInitialLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingBook, setSavingBook] = useState(false);
  const [savingSubject, setSavingSubject] = useState(false);
  const [grantingPermissions, setGrantingPermissions] = useState(false);

  const [books, setBooks] = useState<BookQuestionBank[]>([]);
  const [subjects, setSubjects] = useState<BookQuestionBankSubject[]>([]);
  const [permissions, setPermissions] = useState<AdminBookQuestionBankPermissionRow[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [bookFormMode, setBookFormMode] = useState<"create" | "edit">("edit");
  const [subjectFormMode, setSubjectFormMode] = useState<"create" | "edit">("create");
  const [editingBookId, setEditingBookId] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState("");
  const [bookForm, setBookForm] = useState<BookFormState>(emptyBookForm());
  const [subjectForm, setSubjectForm] = useState<SubjectFormState>(emptySubjectForm());
  const [permissionPhones, setPermissionPhones] = useState("");

  const selectedBook = useMemo(() => books.find((book) => book.id === selectedBookId) ?? null, [books, selectedBookId]);

  const loadBooks = async (preferredBookId = "") => {
    const list = await mockApi.getAdminBookQuestionBanks();
    setBooks(list);
    const nextBookId =
      [preferredBookId, selectedBookId, list[0]?.id ?? ""].find((candidate) => candidate && list.some((book) => book.id === candidate)) ?? "";
    setSelectedBookId(nextBookId);
    return nextBookId;
  };

  const loadBookDetail = async (bookId: string) => {
    if (!bookId) {
      setSubjects([]);
      setPermissions([]);
      return;
    }

    setDetailLoading(true);
    try {
      const [subjectList, permissionList] = await Promise.all([
        mockApi.getAdminBookQuestionBankSubjects(bookId),
        mockApi.getAdminBookQuestionBankPermissions(bookId),
      ]);
      setSubjects(subjectList);
      setPermissions(permissionList);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshCurrentBook = async (preferredBookId = selectedBookId) => {
    const nextBookId = await loadBooks(preferredBookId);
    await loadBookDetail(nextBookId);
  };

  useEffect(() => {
    void (async () => {
      try {
        const nextBookId = await loadBooks();
        await loadBookDetail(nextBookId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载独立题库产品失败");
      } finally {
        setInitialLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedBookId) {
      setSubjects([]);
      setPermissions([]);
      return;
    }

    void loadBookDetail(selectedBookId).catch((error) => {
      toast.error(error instanceof Error ? error.message : "加载题库详情失败");
    });
  }, [selectedBookId]);

  useEffect(() => {
    if (selectedBook && bookFormMode === "edit") {
      setEditingBookId(selectedBook.id);
      setBookForm(mapBookToForm(selectedBook));
    }
  }, [selectedBook, bookFormMode]);

  useEffect(() => {
    setSubjectFormMode("create");
    setEditingSubjectId("");
    setSubjectForm(emptySubjectForm());
    setPermissionPhones("");
  }, [selectedBookId]);

  const beginCreateBook = () => {
    setTabValue("book");
    setBookFormMode("create");
    setEditingBookId("");
    setBookForm(emptyBookForm());
  };

  const beginEditBook = (book: BookQuestionBank) => {
    setBookFormMode("edit");
    setEditingBookId(book.id);
    setBookForm(mapBookToForm(book));
  };

  const beginCreateSubject = () => {
    setTabValue("subjects");
    setSubjectFormMode("create");
    setEditingSubjectId("");
    setSubjectForm(emptySubjectForm());
  };

  const beginEditSubject = (subject: BookQuestionBankSubject) => {
    setTabValue("subjects");
    setSubjectFormMode("edit");
    setEditingSubjectId(subject.id);
    setSubjectForm(mapSubjectToForm(subject));
  };

  const saveBook = async () => {
    if (!bookForm.name.trim() || !bookForm.code.trim()) {
      toast.error("请填写题库产品名称和编码");
      return;
    }

    try {
      setSavingBook(true);
      let nextBookId = editingBookId;
      if (bookFormMode === "edit" && editingBookId) {
        await mockApi.updateAdminBookQuestionBank(editingBookId, bookForm);
      } else {
        const created = await mockApi.createAdminBookQuestionBank(bookForm);
        nextBookId = created.id;
        setBookFormMode("edit");
        setEditingBookId(created.id);
      }

      await refreshCurrentBook(nextBookId);
      toast.success("题库产品已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存题库产品失败");
    } finally {
      setSavingBook(false);
    }
  };

  const deleteBook = async () => {
    if (!editingBookId) return;
    if (!window.confirm("确认删除当前题库产品吗？删除后无法恢复。")) return;

    try {
      setSavingBook(true);
      await mockApi.deleteAdminBookQuestionBank(editingBookId);
      setBookFormMode("edit");
      setEditingBookId("");
      setBookForm(emptyBookForm());
      await refreshCurrentBook("");
      toast.success("题库产品已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除题库产品失败");
    } finally {
      setSavingBook(false);
    }
  };

  const saveSubject = async () => {
    if (!selectedBookId) {
      toast.error("请先选择题库产品");
      return;
    }

    if (!subjectForm.name.trim() || !subjectForm.code.trim()) {
      toast.error("请填写科目名称和编码");
      return;
    }

    try {
      setSavingSubject(true);
      if (subjectFormMode === "edit" && editingSubjectId) {
        const updated = await mockApi.updateAdminBookQuestionBankSubject(selectedBookId, editingSubjectId, subjectForm);
        setSubjectForm(mapSubjectToForm(updated));
      } else {
        const created = await mockApi.createAdminBookQuestionBankSubject(selectedBookId, subjectForm);
        setSubjectFormMode("edit");
        setEditingSubjectId(created.id);
        setSubjectForm(mapSubjectToForm(created));
      }

      await refreshCurrentBook(selectedBookId);
      toast.success("科目已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存科目失败");
    } finally {
      setSavingSubject(false);
    }
  };

  const deleteSubject = async () => {
    if (!selectedBookId || !editingSubjectId) return;
    if (!window.confirm("确认删除当前科目吗？科目下仍有题目时无法删除。")) return;

    try {
      setSavingSubject(true);
      await mockApi.deleteAdminBookQuestionBankSubject(selectedBookId, editingSubjectId);
      beginCreateSubject();
      await refreshCurrentBook(selectedBookId);
      toast.success("科目已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除科目失败");
    } finally {
      setSavingSubject(false);
    }
  };

  const grantPermissions = async () => {
    if (!selectedBookId) {
      toast.error("请先选择题库产品");
      return;
    }

    const phones = permissionPhones
      .split(/[\n,，、；;\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (phones.length <= 0) {
      toast.error("请至少输入一个手机号");
      return;
    }

    try {
      setGrantingPermissions(true);
      await mockApi.grantAdminBookQuestionBankPermissions(selectedBookId, phones);
      setPermissionPhones("");
      await loadBookDetail(selectedBookId);
      toast.success("题库权限已开通");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "开通题库权限失败");
    } finally {
      setGrantingPermissions(false);
    }
  };

  const revokePermission = async (userId: string) => {
    if (!selectedBookId) return;
    if (!window.confirm("确认移除这个用户的题库权限吗？")) return;

    try {
      await mockApi.revokeAdminBookQuestionBankPermission(selectedBookId, userId);
      await loadBookDetail(selectedBookId);
      toast.success("题库权限已移除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除题库权限失败");
    }
  };

  if (initialLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 size-5 animate-spin" />
        独立题库后台加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-[30px] border border-[#e9ddca] bg-[linear-gradient(135deg,#fffaf1_0%,#f8efe0_48%,#f4e6d5_100%)] px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#8d7053]">Independent Question Bank</div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">独立题库系统</div>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              这套题库和批改题库完全分开，只保留练题真正需要的数据。后台单独维护产品、科目、题目和权限，支持客观题、主观题以及题目专属微课音频。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={beginCreateBook}>
              <Plus className="size-4" />
              新建题库产品
            </Button>
            <Button variant="outline" onClick={() => void refreshCurrentBook()}>
              {detailLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              刷新当前产品
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">题库产品</CardTitle>
            <CardDescription>这里维护的是独立练题产品，不会进入考试或批改流程。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">产品数</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{books.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">当前科目</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{subjects.length}</div>
              </div>
            </div>

            <ScrollArea className="h-[520px] pr-2">
              <div className="space-y-3">
                {books.map((book) => {
                  const selected = book.id === selectedBookId;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => {
                        setSelectedBookId(book.id);
                        beginEditBook(book);
                      }}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        selected ? "border-slate-900 bg-slate-900 text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold">{book.name}</div>
                          <div className={`mt-1 truncate text-xs ${selected ? "text-white/70" : "text-slate-500"}`}>{book.code}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${selected ? "bg-white/14 text-white" : statusToneMap[book.status]}`}>
                          {statusLabelMap[book.status]}
                        </span>
                      </div>
                      <div className={`mt-3 flex flex-wrap gap-3 text-xs ${selected ? "text-white/72" : "text-slate-500"}`}>
                        <span>{book.subjectCount} 个科目</span>
                        <span>{book.itemCount} 道题</span>
                        <span>{book.isVisible ? "前台显示" : "前台隐藏"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="px-6 py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Current Product</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedBook?.name || "未选择题库产品"}</div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    {selectedBook?.description || "先在左侧选择一个独立题库产品，然后维护它的科目、题目和用户权限。"}
                  </p>
                </div>

                {selectedBook ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge className={statusToneMap[selectedBook.status]}>{statusLabelMap[selectedBook.status]}</Badge>
                    <Badge className={selectedBook.isVisible ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                      {selectedBook.isVisible ? "前台可见" : "前台隐藏"}
                    </Badge>
                    <Badge className="bg-slate-100 text-slate-700">{selectedBook.code}</Badge>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Tabs value={tabValue} onValueChange={(value) => setTabValue(value as AdminTab)} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-slate-100 p-1">
              <TabsTrigger value="book" className="rounded-xl">产品</TabsTrigger>
              <TabsTrigger value="subjects" className="rounded-xl" disabled={!selectedBookId}>科目</TabsTrigger>
              <TabsTrigger value="items" className="rounded-xl" disabled={!selectedBookId}>题目</TabsTrigger>
              <TabsTrigger value="permissions" className="rounded-xl" disabled={!selectedBookId}>权限</TabsTrigger>
            </TabsList>

            <TabsContent value="book">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>{bookFormMode === "edit" ? "编辑题库产品" : "新建题库产品"}</CardTitle>
                    <CardDescription>产品层只保留练题真正需要的展示信息、状态和排序。</CardDescription>
                  </div>
                  {bookFormMode === "edit" && editingBookId ? (
                    <Button variant="outline" onClick={deleteBook} disabled={savingBook}>
                      <Trash2 className="size-4" />
                      删除产品
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>产品名称</Label>
                      <Input value={bookForm.name} onChange={(event) => setBookForm((current) => ({ ...current, name: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>产品编码</Label>
                      <Input value={bookForm.code} onChange={(event) => setBookForm((current) => ({ ...current, code: event.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>产品简介</Label>
                    <Textarea value={bookForm.description} onChange={(event) => setBookForm((current) => ({ ...current, description: event.target.value }))} className="min-h-[110px]" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>封面地址</Label>
                      <Input value={bookForm.coverUrl} onChange={(event) => setBookForm((current) => ({ ...current, coverUrl: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>封面对象 Key</Label>
                      <Input value={bookForm.coverObjectKey} onChange={(event) => setBookForm((current) => ({ ...current, coverObjectKey: event.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>产品状态</Label>
                      <Select value={bookForm.status} onValueChange={(value: BookQuestionBankStatus) => setBookForm((current) => ({ ...current, status: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">草稿</SelectItem>
                          <SelectItem value="published">已发布</SelectItem>
                          <SelectItem value="closed">已关闭</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>排序</Label>
                      <Input value={bookForm.sortOrder} onChange={(event) => setBookForm((current) => ({ ...current, sortOrder: event.target.value }))} />
                    </div>
                    <div className="flex items-end">
                      <div className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 px-3">
                        <span className="text-sm text-slate-700">前台显示</span>
                        <Switch checked={bookForm.isVisible} onCheckedChange={(checked) => setBookForm((current) => ({ ...current, isVisible: checked }))} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button disabled={savingBook} onClick={() => void saveBook()}>
                      {savingBook ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                      保存产品
                    </Button>
                    <Button variant="outline" onClick={() => (selectedBook && bookFormMode === "edit" ? setBookForm(mapBookToForm(selectedBook)) : setBookForm(emptyBookForm()))}>
                      重置
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subjects">
              <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle>科目结构</CardTitle>
                      <CardDescription>一个产品下可以建多个科目，后续题目都挂在科目下面。</CardDescription>
                    </div>
                    <Button size="sm" onClick={beginCreateSubject}>
                      <Plus className="size-4" />
                      新建
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[560px] pr-2">
                      <div className="space-y-3">
                        {subjects.map((subject) => {
                          const selected = subject.id === editingSubjectId && subjectFormMode === "edit";
                          return (
                            <button
                              key={subject.id}
                              type="button"
                              onClick={() => beginEditSubject(subject)}
                              className={`w-full rounded-[20px] border p-4 text-left transition ${
                                selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate font-semibold">{subject.name}</div>
                                  <div className={`mt-1 truncate text-xs ${selected ? "text-white/70" : "text-slate-500"}`}>{subject.code}</div>
                                </div>
                                <Badge className={selected ? "bg-white/14 text-white" : "bg-slate-100 text-slate-700"}>{subject.itemCount} 题</Badge>
                              </div>
                              {subject.description ? <div className={`mt-3 text-xs leading-5 ${selected ? "text-white/72" : "text-slate-500"}`}>{subject.description}</div> : null}
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle>{subjectFormMode === "edit" ? "编辑科目" : "新建科目"}</CardTitle>
                      <CardDescription>建议直接按民法、刑法、商经等真实练题维度来建。</CardDescription>
                    </div>
                    {subjectFormMode === "edit" && editingSubjectId ? (
                      <Button variant="outline" onClick={deleteSubject} disabled={savingSubject}>
                        <Trash2 className="size-4" />
                        删除科目
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>科目名称</Label>
                        <Input value={subjectForm.name} onChange={(event) => setSubjectForm((current) => ({ ...current, name: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>科目编码</Label>
                        <Input value={subjectForm.code} onChange={(event) => setSubjectForm((current) => ({ ...current, code: event.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>科目描述</Label>
                      <Textarea value={subjectForm.description} onChange={(event) => setSubjectForm((current) => ({ ...current, description: event.target.value }))} />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>排序</Label>
                        <Input value={subjectForm.sortOrder} onChange={(event) => setSubjectForm((current) => ({ ...current, sortOrder: event.target.value }))} />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        当前产品下共有 <span className="font-semibold text-slate-900">{subjects.length}</span> 个科目。
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button disabled={savingSubject} onClick={() => void saveSubject()}>
                        {savingSubject ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                        保存科目
                      </Button>
                      <Button variant="outline" onClick={beginCreateSubject}>重置</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="items">
              <BookQuestionBankItemWorkbench bookId={selectedBookId} subjects={subjects} onChanged={() => refreshCurrentBook(selectedBookId)} />
            </TabsContent>

            <TabsContent value="permissions">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>权限管理</CardTitle>
                  <CardDescription>给购买该独立题库产品的用户开权限，用户端只会在“我的题库”里看到自己有权限的产品。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_200px]">
                    <div className="space-y-2">
                      <Label>手机号</Label>
                      <Textarea value={permissionPhones} onChange={(event) => setPermissionPhones(event.target.value)} className="min-h-[120px]" />
                    </div>
                    <div className="flex items-end">
                      <Button className="w-full" disabled={grantingPermissions} onClick={() => void grantPermissions()}>
                        {grantingPermissions ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                        开通权限
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    当前产品已开通 <span className="font-semibold text-slate-900">{permissions.length}</span> 个用户。
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>手机号</TableHead>
                        <TableHead>昵称</TableHead>
                        <TableHead>来源</TableHead>
                        <TableHead>开通时间</TableHead>
                        <TableHead className="w-[120px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissions.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-slate-900">{row.phone}</TableCell>
                          <TableCell>{row.displayName || row.nickname || "-"}</TableCell>
                          <TableCell>{row.sourceType || "manual"}</TableCell>
                          <TableCell>{row.createdAt}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => void revokePermission(row.userId)}>
                              移除
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
