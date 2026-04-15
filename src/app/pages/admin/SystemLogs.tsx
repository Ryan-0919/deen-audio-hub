import { History, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { AuditLogItem, LogSummary, WebhookLogItem, WebhookLogStatus, mockApi } from "../../lib/mockData";

const PAGE_SIZE = 20;

const entityTypeOptions = [
  { value: "all", label: "全部对象" },
  { value: "admin", label: "管理员" },
  { value: "user", label: "用户" },
  { value: "course", label: "课程" },
  { value: "tag", label: "标签" },
  { value: "audio", label: "音频" },
  { value: "audio_folder", label: "文件夹" },
  { value: "system_config", label: "系统配置" },
  { value: "system_summary", label: "系统汇总" },
] as const;

const webhookStatusMeta: Record<WebhookLogStatus, { label: string; className: string }> = {
  success: { label: "发送成功", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "发送失败", className: "bg-red-100 text-red-700" },
  skipped: { label: "已跳过", className: "bg-amber-100 text-amber-700" },
};

const emptySummary: LogSummary = {
  auditTotal: 0,
  auditToday: 0,
  webhookSuccess: 0,
  webhookFailed: 0,
  webhookSkipped: 0,
};

const getEntityTypeLabel = (value: string) => entityTypeOptions.find((item) => item.value === value)?.label ?? (value || "-");

const SummaryCard = ({
  title,
  value,
  description,
  tone = "default",
}: {
  title: string;
  value: number;
  description: string;
  tone?: "default" | "success" | "danger" | "warning";
}) => {
  const toneClassName =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "danger"
        ? "border-red-200 bg-red-50"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-white";

  return (
    <div className={`rounded-2xl border p-5 ${toneClassName}`}>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
};

export function SystemLogs() {
  const [summary, setSummary] = useState<LogSummary>(emptySummary);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditKeyword, setAuditKeyword] = useState("");
  const [auditEntityType, setAuditEntityType] = useState("all");
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);

  const [webhookLogs, setWebhookLogs] = useState<WebhookLogItem[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(true);
  const [webhookKeyword, setWebhookKeyword] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<"all" | WebhookLogStatus>("all");
  const [webhookPage, setWebhookPage] = useState(1);
  const [webhookTotalPages, setWebhookTotalPages] = useState(1);
  const [webhookTotal, setWebhookTotal] = useState(0);

  const deferredAuditKeyword = useDeferredValue(auditKeyword.trim());
  const deferredWebhookKeyword = useDeferredValue(webhookKeyword.trim());

  const loadSummary = async () => {
    try {
      setSummaryLoading(true);
      setSummary(await mockApi.getLogSummary());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载日志概览失败");
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const result = await mockApi.getAuditLogs({
        keyword: deferredAuditKeyword,
        entityType: auditEntityType,
        page: auditPage,
        pageSize: PAGE_SIZE,
      });
      setAuditLogs(result.items);
      setAuditTotal(result.total);
      setAuditTotalPages(result.totalPages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载操作日志失败");
    } finally {
      setAuditLoading(false);
    }
  };

  const loadWebhookLogs = async () => {
    try {
      setWebhookLoading(true);
      const result = await mockApi.getWebhookLogs({
        keyword: deferredWebhookKeyword,
        status: webhookStatus,
        page: webhookPage,
        pageSize: PAGE_SIZE,
      });
      setWebhookLogs(result.items);
      setWebhookTotal(result.total);
      setWebhookTotalPages(result.totalPages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载推送日志失败");
    } finally {
      setWebhookLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadSummary(), loadAuditLogs(), loadWebhookLogs()]);
  }, []);

  useEffect(() => {
    void loadAuditLogs();
  }, [auditPage, deferredAuditKeyword, auditEntityType]);

  useEffect(() => {
    void loadWebhookLogs();
  }, [webhookPage, deferredWebhookKeyword, webhookStatus]);

  const handleRefresh = async () => {
    await Promise.all([loadSummary(), loadAuditLogs(), loadWebhookLogs()]);
    toast.success("日志数据已刷新");
  };

  return (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">系统日志</h1>
              <p className="mt-2 text-sm text-slate-500">查看后台操作记录、Webhook 推送结果和今日日志概览，方便上线后的日常运营排查。</p>
            </div>
            <Button variant="outline" onClick={() => void handleRefresh()} disabled={summaryLoading || auditLoading || webhookLoading}>
              <RefreshCw className={`mr-2 size-4 ${summaryLoading || auditLoading || webhookLoading ? "animate-spin" : ""}`} />
              刷新日志
            </Button>
          </div>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="grid gap-4 xl:grid-cols-5">
            <SummaryCard title="操作日志总数" value={summary.auditTotal} description="累计记录的后台操作次数" />
            <SummaryCard title="今日新增日志" value={summary.auditToday} description="今天新增的操作日志数量" />
            <SummaryCard title="Webhook 成功" value={summary.webhookSuccess} description="企业微信推送成功次数" tone="success" />
            <SummaryCard title="Webhook 失败" value={summary.webhookFailed} description="企业微信推送失败次数" tone="danger" />
            <SummaryCard title="Webhook 跳过" value={summary.webhookSkipped} description="未配置或主动跳过次数" tone="warning" />
          </div>

          <Tabs defaultValue="audit" className="space-y-4">
            <TabsList className="w-full justify-start bg-slate-100 p-1">
              <TabsTrigger value="audit" className="flex-none px-4">
                <ShieldCheck className="size-4" />
                操作日志
              </TabsTrigger>
              <TabsTrigger value="webhook" className="flex-none px-4">
                <Send className="size-4" />
                Webhook 日志
              </TabsTrigger>
            </TabsList>

            <TabsContent value="audit" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
                <Input
                  placeholder="搜索操作人、动作、对象名称或详情"
                  value={auditKeyword}
                  onChange={(event) => {
                    setAuditKeyword(event.target.value);
                    setAuditPage(1);
                  }}
                />
                <Select
                  value={auditEntityType}
                  onValueChange={(value) => {
                    setAuditEntityType(value);
                    setAuditPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="对象类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {entityTypeOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAuditKeyword("");
                    setAuditEntityType("all");
                    setAuditPage(1);
                  }}
                >
                  重置
                </Button>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>共 {auditTotal} 条操作日志，本页 {auditLogs.length} 条</span>
                <span>{auditLoading ? "正在更新..." : "最近操作按时间倒序展示"}</span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">时间</TableHead>
                      <TableHead className="w-[180px]">操作人</TableHead>
                      <TableHead className="w-[180px]">动作</TableHead>
                      <TableHead>对象</TableHead>
                      <TableHead>详情</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-16 text-center text-slate-500">
                          操作日志加载中...
                        </TableCell>
                      </TableRow>
                    ) : auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-16 text-center text-slate-500">
                          暂无符合条件的操作日志
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.createdAt}</TableCell>
                          <TableCell className="whitespace-normal">
                            <div className="space-y-1">
                              <p className="font-medium text-slate-900">{item.operatorName}</p>
                              <p className="text-xs text-slate-500">{item.operatorAccount || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{item.action}</code>
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-slate-900">{item.entityName || item.entityId || "-"}</p>
                              <p className="text-xs text-slate-500">
                                {getEntityTypeLabel(item.entityType)}
                                {item.entityId ? ` · ${item.entityId}` : ""}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[380px] whitespace-normal text-sm leading-6 text-slate-600">
                            {item.detail || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-500">
                  第 {auditPage} / {auditTotalPages} 页，每页 {PAGE_SIZE} 条
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={auditPage <= 1 || auditLoading} onClick={() => setAuditPage((value) => Math.max(value - 1, 1))}>
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={auditPage >= auditTotalPages || auditLoading}
                    onClick={() => setAuditPage((value) => Math.min(value + 1, auditTotalPages))}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="webhook" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
                <Input
                  placeholder="搜索场景、标题、错误信息或消息内容"
                  value={webhookKeyword}
                  onChange={(event) => {
                    setWebhookKeyword(event.target.value);
                    setWebhookPage(1);
                  }}
                />
                <Select
                  value={webhookStatus}
                  onValueChange={(value: "all" | WebhookLogStatus) => {
                    setWebhookStatus(value);
                    setWebhookPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="发送状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="success">发送成功</SelectItem>
                    <SelectItem value="failed">发送失败</SelectItem>
                    <SelectItem value="skipped">已跳过</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setWebhookKeyword("");
                    setWebhookStatus("all");
                    setWebhookPage(1);
                  }}
                >
                  重置
                </Button>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>共 {webhookTotal} 条推送日志，本页 {webhookLogs.length} 条</span>
                <span>{webhookLoading ? "正在更新..." : "可用于排查群机器人推送问题"}</span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">时间</TableHead>
                      <TableHead className="w-[120px]">状态</TableHead>
                      <TableHead className="w-[220px]">场景</TableHead>
                      <TableHead>关联对象</TableHead>
                      <TableHead>响应</TableHead>
                      <TableHead>消息摘要</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhookLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-16 text-center text-slate-500">
                          Webhook 日志加载中...
                        </TableCell>
                      </TableRow>
                    ) : webhookLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-16 text-center text-slate-500">
                          暂无符合条件的 Webhook 日志
                        </TableCell>
                      </TableRow>
                    ) : (
                      webhookLogs.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.createdAt}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={webhookStatusMeta[item.status].className}>
                              {webhookStatusMeta[item.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <div className="space-y-1">
                              <p className="font-medium text-slate-900">{item.title || "-"}</p>
                              <p className="text-xs text-slate-500">{item.scene}</p>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {item.relatedEntityType || item.relatedEntityId ? (
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-900">{getEntityTypeLabel(item.relatedEntityType) || "-"}</p>
                                <p className="text-xs text-slate-500">{item.relatedEntityId || "-"}</p>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <div className="space-y-1 text-sm text-slate-600">
                              <p>返回码：{item.responseCode ?? "-"}</p>
                              <p className="break-all text-xs text-slate-500">{item.webhookUrl || "-"}</p>
                              {item.errorMessage ? <p className="text-xs text-red-600">{item.errorMessage}</p> : null}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[380px] whitespace-normal text-sm leading-6 text-slate-600">
                            {item.messagePreview || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-500">
                  第 {webhookPage} / {webhookTotalPages} 页，每页 {PAGE_SIZE} 条
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={webhookPage <= 1 || webhookLoading}
                    onClick={() => setWebhookPage((value) => Math.max(value - 1, 1))}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={webhookPage >= webhookTotalPages || webhookLoading}
                    onClick={() => setWebhookPage((value) => Math.min(value + 1, webhookTotalPages))}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <History className="size-4" />
              日志说明
            </div>
            <p className="mt-2">1. 操作日志记录管理员和系统任务的关键动作，方便追溯是谁在什么时间做了什么修改。</p>
            <p>2. Webhook 日志会记录推送成功、失败和跳过，便于排查企业微信群机器人配置问题。</p>
            <p>3. 这里展示的是运营排查视角，如需长期归档，可后续再做日志导出能力。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
