import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import {
  type AdminBookQuestionBankPermissionRow,
  type BookQuestionBank,
  type BookQuestionBankAvailableItem,
  type BookQuestionBankItemSummary,
  type BookQuestionBankStatus,
  type BookQuestionBankSubject,
  type QuestionBankFolder,
  type QuestionBankPaperType,
  mockApi,
} from "../../lib/mockData";

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

type ItemFormState = {
  subjectId: string;
  questionBankItemId: string;
  customTitle: string;
  questionNo: string;
  yearLabel: string;
  pageLabel: string;
  tags: string;
  sortOrder: string;
  status: boolean;
};

const PAGE_SIZE = 20;

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

const emptyItemForm = (): ItemFormState => ({
  subjectId: "",
  questionBankItemId: "",
  customTitle: "",
  questionNo: "",
  yearLabel: "",
  pageLabel: "",
  tags: "",
  sortOrder: "",
  status: true,
});

const statusLabelMap: Record<BookQuestionBankStatus, string> = {
  draft: "草稿",
  published: "已发布",
  closed: "已关闭",
};

const normalizeTags = (value: string) =>
  value
    .split(/[\n,，、；;]/)
    .map((item) => item.trim())
    .filter(Boolean);

export function BookQuestionBankAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [books, setBooks] = useState<BookQuestionBank[]>([]);
  const [subjects, setSubjects] = useState<BookQuestionBankSubject[]>([]);
  const [bookItems, setBookItems] = useState<BookQuestionBankItemSummary[]>([]);
  const [permissions, setPermissions] = useState<AdminBookQuestionBankPermissionRow[]>([]);
  const [objectiveFolders, setObjectiveFolders] = useState<QuestionBankFolder[]>([]);
  const [subjectiveFolders, setSubjectiveFolders] = useState<QuestionBankFolder[]>([]);
  const [availableItems, setAvailableItems] = useState<BookQuestionBankAvailableItem[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("all");
  const [selectedAvailableItemId, setSelectedAvailableItemId] = useState("");
  const [availablePaperType, setAvailablePaperType] = useState<QuestionBankPaperType>("subjective");
  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [availableKeyword, setAvailableKeyword] = useState("");
  const [availablePage, setAvailablePage] = useState(1);
  const [availableTotalPages, setAvailableTotalPages] = useState(1);
  const [availableTotal, setAvailableTotal] = useState(0);
  const [permissionPhones, setPermissionPhones] = useState("");
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState("");
  const [editingItemId, setEditingItemId] = useState("");
  const [bookForm, setBookForm] = useState<BookFormState>(emptyBookForm());
  const [subjectForm, setSubjectForm] = useState<SubjectFormState>(emptySubjectForm());
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm());

  const selectedBook = useMemo(() => books.find((item) => item.id === selectedBookId) ?? null, [books, selectedBookId]);
  const folderOptions = availablePaperType === "subjective" ? subjectiveFolders : objectiveFolders;
  const selectedAvailableItem = useMemo(
    () => availableItems.find((item) => item.id === selectedAvailableItemId) ?? null,
    [availableItems, selectedAvailableItemId],
  );

  const loadAvailableItems = async (overrides?: Partial<{ paperType: QuestionBankPaperType; folderId: string; keyword: string; page: number }>) => {
    const nextPaperType = overrides?.paperType ?? availablePaperType;
    const nextFolderId = overrides?.folderId ?? selectedFolderId;
    const nextKeyword = overrides?.keyword ?? availableKeyword;
    const nextPage = overrides?.page ?? availablePage;
    setAvailableLoading(true);
    try {
      const result = await mockApi.getAdminBookQuestionBankAvailableItems({
        paperType: nextPaperType,
        folderId: nextFolderId === "all" ? "" : nextFolderId,
        keyword: nextKeyword.trim(),
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setAvailablePaperType(nextPaperType);
      setSelectedFolderId(nextFolderId);
      setAvailableKeyword(nextKeyword);
      setAvailablePage(result.page);
      setAvailableTotalPages(result.totalPages);
      setAvailableTotal(result.total);
      setAvailableItems(result.items);
      if (result.items.every((item) => item.id !== selectedAvailableItemId)) {
        setSelectedAvailableItemId(result.items[0]?.id ?? "");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载可选题目失败");
    } finally {
      setAvailableLoading(false);
    }
  };

  const loadBookDetails = async (bookId: string, subjectFilter = selectedSubjectFilter) => {
    if (!bookId) {
      setSubjects([]);
      setBookItems([]);
      setPermissions([]);
      return;
    }
    const [subjectResult, itemResult, permissionResult] = await Promise.all([
      mockApi.getAdminBookQuestionBankSubjects(bookId),
      mockApi.getAdminBookQuestionBankItems(bookId, { subjectId: subjectFilter !== "all" ? subjectFilter : undefined }),
      mockApi.getAdminBookQuestionBankPermissions(bookId),
    ]);
    setSubjects(subjectResult);
    setBookItems(itemResult);
    setPermissions(permissionResult);
  };

  const loadBooks = async (preferredId = "") => {
    const list = await mockApi.getAdminBookQuestionBanks();
    setBooks(list);
    const nextId = preferredId && list.some((item) => item.id === preferredId) ? preferredId : list[0]?.id ?? "";
    setSelectedBookId(nextId);
    return nextId;
  };

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [objectiveResult, subjectiveResult] = await Promise.all([
        mockApi.getQuestionBankFolders("objective"),
        mockApi.getQuestionBankFolders("subjective"),
      ]);
      setObjectiveFolders(objectiveResult);
      setSubjectiveFolders(subjectiveResult);
      const bookId = await loadBooks();
      await Promise.all([loadBookDetails(bookId, "all"), loadAvailableItems({ page: 1, folderId: "all", keyword: "" })]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载书籍型题库管理失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (!loading && selectedBookId) {
      void loadBookDetails(selectedBookId, selectedSubjectFilter);
    }
  }, [selectedBookId, selectedSubjectFilter]);

  const openCreateBookDialog = () => {
    setEditingBookId("");
    setBookForm(emptyBookForm());
    setBookDialogOpen(true);
  };

  const openCreateSubjectDialog = () => {
    setEditingSubjectId("");
    setSubjectForm(emptySubjectForm());
    setSubjectDialogOpen(true);
  };

  const openCreateItemDialog = () => {
    if (!selectedBookId) {
      toast.error("请先选择题库产品");
      return;
    }
    if (subjects.length <= 0) {
      toast.error("请先创建科目");
      return;
    }
    setEditingItemId("");
    setItemForm({
      ...emptyItemForm(),
      subjectId: selectedSubjectFilter !== "all" ? selectedSubjectFilter : subjects[0]?.id ?? "",
      questionBankItemId: selectedAvailableItemId,
    });
    setItemDialogOpen(true);
  };

  const saveBook = async () => {
    if (!bookForm.name.trim() || !bookForm.code.trim()) {
      toast.error("请填写题库产品名称和编码");
      return;
    }
    try {
      setSaving(true);
      let targetBookId = editingBookId;
      if (editingBookId) {
        await mockApi.updateAdminBookQuestionBank(editingBookId, bookForm);
      } else {
        const created = await mockApi.createAdminBookQuestionBank(bookForm);
        targetBookId = created.id;
      }
      setBookDialogOpen(false);
      const bookId = await loadBooks(targetBookId || selectedBookId);
      await loadBookDetails(bookId, selectedSubjectFilter);
      toast.success("题库产品已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存题库产品失败");
    } finally {
      setSaving(false);
    }
  };

  const saveSubject = async () => {
    if (!selectedBookId) return;
    if (!subjectForm.name.trim() || !subjectForm.code.trim()) {
      toast.error("请填写科目名称和编码");
      return;
    }
    try {
      setSaving(true);
      if (editingSubjectId) {
        await mockApi.updateAdminBookQuestionBankSubject(selectedBookId, editingSubjectId, subjectForm);
      } else {
        await mockApi.createAdminBookQuestionBankSubject(selectedBookId, subjectForm);
      }
      setSubjectDialogOpen(false);
      await loadBookDetails(selectedBookId, selectedSubjectFilter);
      toast.success("科目已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存科目失败");
    } finally {
      setSaving(false);
    }
  };

  const saveItem = async () => {
    if (!selectedBookId) return;
    if (!itemForm.subjectId || !itemForm.questionBankItemId.trim()) {
      toast.error("请选择科目和题目");
      return;
    }
    const payload = {
      subjectId: itemForm.subjectId,
      title: itemForm.customTitle.trim(),
      questionNo: itemForm.questionNo.trim(),
      yearLabel: itemForm.yearLabel.trim(),
      pageLabel: itemForm.pageLabel.trim(),
      tags: normalizeTags(itemForm.tags),
      sortOrder: itemForm.sortOrder,
      status: itemForm.status,
    };
    try {
      setSaving(true);
      if (editingItemId) {
        await mockApi.updateAdminBookQuestionBankItem(selectedBookId, editingItemId, payload);
      } else {
        await mockApi.createAdminBookQuestionBankItem(selectedBookId, {
          ...payload,
          questionBankItemId: itemForm.questionBankItemId.trim(),
        });
      }
      setItemDialogOpen(false);
      await loadBookDetails(selectedBookId, selectedSubjectFilter);
      toast.success("题目映射已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存题目映射失败");
    } finally {
      setSaving(false);
    }
  };

  const grantPermissions = async () => {
    if (!selectedBookId) return;
    const phones = permissionPhones
      .split(/[\n,，、；;\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (phones.length <= 0) {
      toast.error("请至少输入一个手机号");
      return;
    }
    try {
      setSaving(true);
      await mockApi.grantAdminBookQuestionBankPermissions(selectedBookId, phones);
      setPermissionPhones("");
      await loadBookDetails(selectedBookId, selectedSubjectFilter);
      toast.success("题库权限已开通");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "开通题库权限失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteBook = async (bookId: string, bookName: string) => {
    if (!window.confirm(`确认删除题库产品“${bookName}”？`)) {
      return;
    }
    try {
      setSaving(true);
      await mockApi.deleteAdminBookQuestionBank(bookId);
      const remainingBooks = books.filter((item) => item.id !== bookId);
      const nextSelectedId = selectedBookId === bookId ? remainingBooks[0]?.id ?? "" : selectedBookId;
      await loadBooks(nextSelectedId);
      await loadBookDetails(nextSelectedId, "all");
      setSelectedSubjectFilter("all");
      toast.success("题库产品已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除题库产品失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteSubject = async (subjectId: string, subjectName: string) => {
    if (!selectedBookId) return;
    if (!window.confirm(`确认删除科目“${subjectName}”？`)) {
      return;
    }
    try {
      setSaving(true);
      await mockApi.deleteAdminBookQuestionBankSubject(selectedBookId, subjectId);
      const nextFilter = selectedSubjectFilter === subjectId ? "all" : selectedSubjectFilter;
      setSelectedSubjectFilter(nextFilter);
      await loadBookDetails(selectedBookId, nextFilter);
      toast.success("科目已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除科目失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (bookItemId: string) => {
    if (!selectedBookId) return;
    if (!window.confirm("确认移除这道题目？")) {
      return;
    }
    try {
      setSaving(true);
      await mockApi.deleteAdminBookQuestionBankItem(selectedBookId, bookItemId);
      await loadBookDetails(selectedBookId, selectedSubjectFilter);
      toast.success("题目已移除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除题目失败");
    } finally {
      setSaving(false);
    }
  };

  const revokePermission = async (userId: string, phone: string) => {
    if (!selectedBookId) return;
    if (!window.confirm(`确认移除手机号 ${phone} 的题库权限？`)) {
      return;
    }
    try {
      setSaving(true);
      await mockApi.revokeAdminBookQuestionBankPermission(selectedBookId, userId);
      await loadBookDetails(selectedBookId, selectedSubjectFilter);
      toast.success("题库权限已移除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除题库权限失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 size-5 animate-spin" />
        加载书籍型题库管理中...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">题库产品</CardTitle>
              <p className="mt-1 text-sm text-slate-500">管理书籍型题库产品。</p>
            </div>
            <Button size="sm" onClick={openCreateBookDialog}>
              <Plus className="mr-2 size-4" />
              新建
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {books.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => {
                  setSelectedBookId(book.id);
                  setSelectedSubjectFilter("all");
                }}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  book.id === selectedBookId ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-slate-900">{book.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{book.code}</div>
                  </div>
                  <span className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600">{statusLabelMap[book.status]}</span>
                </div>
                <div className="mt-3 flex gap-3 text-xs text-slate-500">
                  <span>{book.subjectCount} 个科目</span>
                  <span>{book.itemCount} 道题</span>
                </div>
                <div className="mt-3">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingBookId(book.id);
                        setBookForm({
                          name: book.name,
                          code: book.code,
                          description: book.description,
                          coverUrl: book.coverUrl,
                          coverObjectKey: book.coverObjectKey,
                          status: book.status,
                          isVisible: book.isVisible,
                          sortOrder: `${book.sortOrder || 0}`,
                        });
                        setBookDialogOpen(true);
                      }}
                    >
                      <Pencil className="mr-1 size-3.5" />
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={saving}
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteBook(book.id, book.name);
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">{selectedBook?.name || "请选择题库产品"}</CardTitle>
              <p className="text-sm text-slate-500">{selectedBook?.description || "先选一本书，再维护科目、挂题和授权。"}</p>
            </CardHeader>
          </Card>

          <Tabs defaultValue="subjects" className="space-y-4">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="subjects">科目</TabsTrigger>
              <TabsTrigger value="items">挂题</TabsTrigger>
              <TabsTrigger value="permissions">权限</TabsTrigger>
            </TabsList>

            <TabsContent value="subjects">
              <Card className="border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>科目管理</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">一本书按科目分组。</p>
                  </div>
                  <Button size="sm" onClick={openCreateSubjectDialog} disabled={!selectedBookId}>
                    <Plus className="mr-2 size-4" />
                    新建科目
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>科目</TableHead>
                        <TableHead>编码</TableHead>
                        <TableHead>题目数</TableHead>
                        <TableHead>排序</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjects.map((subject) => (
                        <TableRow key={subject.id}>
                          <TableCell className="font-medium">{subject.name}</TableCell>
                          <TableCell>{subject.code}</TableCell>
                          <TableCell>{subject.itemCount}</TableCell>
                          <TableCell>{subject.sortOrder}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingSubjectId(subject.id);
                                  setSubjectForm({
                                    name: subject.name,
                                    code: subject.code,
                                    description: subject.description,
                                    sortOrder: `${subject.sortOrder || 0}`,
                                  });
                                  setSubjectDialogOpen(true);
                                }}
                              >
                                编辑
                              </Button>
                              <Button size="sm" variant="destructive" disabled={saving} onClick={() => void deleteSubject(subject.id, subject.name)}>
                                删除
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="items">
              <div className="space-y-4">
                <Card className="border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>可选题目</CardTitle>
                      <p className="mt-1 text-sm text-slate-500">从现有题库中选题。</p>
                    </div>
                    <Button size="sm" onClick={openCreateItemDialog} disabled={!selectedBookId}>
                      <Plus className="mr-2 size-4" />
                      加入题目
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="space-y-2">
                        <Label>题库类型</Label>
                        <Select value={availablePaperType} onValueChange={(value: QuestionBankPaperType) => void loadAvailableItems({ paperType: value, folderId: "all", page: 1 })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="subjective">主观题</SelectItem>
                            <SelectItem value="objective">客观题</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>文件夹</Label>
                        <Select value={selectedFolderId} onValueChange={(value) => void loadAvailableItems({ folderId: value, page: 1 })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部文件夹</SelectItem>
                            {folderOptions.map((folder) => (
                              <SelectItem key={folder.id} value={folder.id}>
                                {folder.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>关键词</Label>
                        <div className="flex gap-2">
                          <Input value={availableKeyword} onChange={(event) => setAvailableKeyword(event.target.value)} placeholder="按标题、题干、解析搜索" />
                          <Button variant="outline" onClick={() => void loadAvailableItems({ keyword: availableKeyword, page: 1 })}>
                            查询
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>题目</TableHead>
                          <TableHead>题型</TableHead>
                          <TableHead>文件夹</TableHead>
                          <TableHead>选择</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableLoading ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                              <Loader2 className="mr-2 inline size-4 animate-spin" />
                              加载中...
                            </TableCell>
                          </TableRow>
                        ) : (
                          availableItems.map((item) => (
                            <TableRow key={item.id} className={selectedAvailableItemId === item.id ? "bg-slate-50" : ""}>
                              <TableCell className="max-w-[480px] whitespace-normal">
                                <div className="font-medium text-slate-900">{item.title}</div>
                                <div className="mt-1 text-xs text-slate-500">{(item.material || item.stem || item.analysis || "").slice(0, 72) || "暂无摘要"}</div>
                              </TableCell>
                              <TableCell>{item.questionTypeLabel}</TableCell>
                              <TableCell>{item.folderName}</TableCell>
                              <TableCell>
                                <Button size="sm" variant={selectedAvailableItemId === item.id ? "default" : "outline"} onClick={() => setSelectedAvailableItemId(item.id)}>
                                  {selectedAvailableItemId === item.id ? "已选" : "选择"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>

                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>
                        共 {availableTotal} 道题，第 {availablePage}/{availableTotalPages} 页
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={availablePage <= 1} onClick={() => void loadAvailableItems({ page: availablePage - 1 })}>
                          <ChevronLeft className="mr-1 size-4" />
                          上一页
                        </Button>
                        <Button variant="outline" size="sm" disabled={availablePage >= availableTotalPages} onClick={() => void loadAvailableItems({ page: availablePage + 1 })}>
                          下一页
                          <ChevronRight className="ml-1 size-4" />
                        </Button>
                      </div>
                    </div>

                    {selectedAvailableItem ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">当前选中：{selectedAvailableItem.title}</div> : null}
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>已挂题目</CardTitle>
                    <div className="w-[220px]">
                      <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部科目</SelectItem>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>标题</TableHead>
                          <TableHead>科目</TableHead>
                          <TableHead>题号</TableHead>
                          <TableHead>年份/页码</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="max-w-[340px] whitespace-normal">
                              <div className="font-medium text-slate-900">{item.title}</div>
                              <div className="mt-1 text-xs text-slate-500">来源题目 ID: {item.questionBankItemId}</div>
                            </TableCell>
                            <TableCell>{item.subjectName}</TableCell>
                            <TableCell>{item.questionNo || "-"}</TableCell>
                            <TableCell>
                              {item.yearLabel || "-"}
                              {item.pageLabel ? ` / ${item.pageLabel}` : ""}
                            </TableCell>
                            <TableCell>{item.status ? "已上架" : "已下架"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingItemId(item.id);
                                    setItemForm({
                                      subjectId: item.subjectId,
                                      questionBankItemId: item.questionBankItemId,
                                      customTitle: item.customTitle,
                                      questionNo: item.questionNo,
                                      yearLabel: item.yearLabel,
                                      pageLabel: item.pageLabel,
                                      tags: item.tags.join("，"),
                                      sortOrder: `${item.sortOrder || 0}`,
                                      status: item.status,
                                    });
                                    setItemDialogOpen(true);
                                  }}
                                >
                                  编辑
                                </Button>
                                <Button size="sm" variant="destructive" disabled={saving} onClick={() => void deleteItem(item.id)}>
                                  删除
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="permissions">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>权限管理</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                    <div className="space-y-2">
                      <Label>手机号</Label>
                      <Textarea value={permissionPhones} onChange={(event) => setPermissionPhones(event.target.value)} placeholder="支持换行、逗号、空格分隔多个手机号" className="min-h-[108px]" />
                    </div>
                    <div className="flex items-end">
                      <Button className="w-full" disabled={!selectedBookId || saving} onClick={() => void grantPermissions()}>
                        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        开通权限
                      </Button>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>手机号</TableHead>
                        <TableHead>昵称</TableHead>
                        <TableHead>来源</TableHead>
                        <TableHead>开通时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissions.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.phone}</TableCell>
                          <TableCell>{row.displayName || row.nickname || "-"}</TableCell>
                          <TableCell>{row.sourceType || "manual"}</TableCell>
                          <TableCell>{row.createdAt}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="destructive" disabled={saving} onClick={() => void revokePermission(row.userId, row.phone)}>
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

      <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBookId ? "编辑题库产品" : "新建题库产品"}</DialogTitle>
            <DialogDescription>第一版先支持手动创建和维护。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={bookForm.name} onChange={(event) => setBookForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>编码</Label>
              <Input value={bookForm.code} onChange={(event) => setBookForm((current) => ({ ...current, code: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>简介</Label>
            <Textarea value={bookForm.description} onChange={(event) => setBookForm((current) => ({ ...current, description: event.target.value }))} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>封面 URL</Label>
              <Input value={bookForm.coverUrl} onChange={(event) => setBookForm((current) => ({ ...current, coverUrl: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>封面 Object Key</Label>
              <Input value={bookForm.coverObjectKey} onChange={(event) => setBookForm((current) => ({ ...current, coverObjectKey: event.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>状态</Label>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookDialogOpen(false)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void saveBook()}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSubjectId ? "编辑科目" : "新建科目"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={subjectForm.name} onChange={(event) => setSubjectForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>编码</Label>
              <Input value={subjectForm.code} onChange={(event) => setSubjectForm((current) => ({ ...current, code: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>描述</Label>
            <Textarea value={subjectForm.description} onChange={(event) => setSubjectForm((current) => ({ ...current, description: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>排序</Label>
            <Input value={subjectForm.sortOrder} onChange={(event) => setSubjectForm((current) => ({ ...current, sortOrder: event.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectDialogOpen(false)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void saveSubject()}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItemId ? "编辑挂题信息" : "加入题目"}</DialogTitle>
            <DialogDescription>不填写自定义标题时，前台会自动使用原题标题。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>科目</Label>
              <Select value={itemForm.subjectId} onValueChange={(value) => setItemForm((current) => ({ ...current, subjectId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择科目" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>题目 ID</Label>
              <Input value={itemForm.questionBankItemId} onChange={(event) => setItemForm((current) => ({ ...current, questionBankItemId: event.target.value }))} disabled={Boolean(editingItemId)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>自定义标题</Label>
            <Input value={itemForm.customTitle} onChange={(event) => setItemForm((current) => ({ ...current, customTitle: event.target.value }))} placeholder="不填则自动取原题标题" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>题号</Label>
              <Input value={itemForm.questionNo} onChange={(event) => setItemForm((current) => ({ ...current, questionNo: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>年份标签</Label>
              <Input value={itemForm.yearLabel} onChange={(event) => setItemForm((current) => ({ ...current, yearLabel: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>页码标签</Label>
              <Input value={itemForm.pageLabel} onChange={(event) => setItemForm((current) => ({ ...current, pageLabel: event.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>标签</Label>
              <Input value={itemForm.tags} onChange={(event) => setItemForm((current) => ({ ...current, tags: event.target.value }))} placeholder="多个标签用逗号分隔" />
            </div>
            <div className="space-y-2">
              <Label>排序</Label>
              <Input value={itemForm.sortOrder} onChange={(event) => setItemForm((current) => ({ ...current, sortOrder: event.target.value }))} />
            </div>
          </div>
          <div className="flex h-10 items-center justify-between rounded-xl border border-slate-200 px-3">
            <span className="text-sm text-slate-700">上架状态</span>
            <Switch checked={itemForm.status} onCheckedChange={(checked) => setItemForm((current) => ({ ...current, status: checked }))} />
          </div>
          {selectedAvailableItem && !editingItemId ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{selectedAvailableItem.title}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void saveItem()}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
