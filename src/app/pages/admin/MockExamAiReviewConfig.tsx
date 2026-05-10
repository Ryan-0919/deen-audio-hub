import { Bot, BrainCircuit, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { mockApi, type MockExamAiReviewConfig, type MockExamAiReviewProvider } from "../../lib/mockData";

const PLACEHOLDERS = ["{{批改原则}}", "{{输出要求}}", "{{题目数据}}"] as const;

const createDefaultConfig = (): MockExamAiReviewConfig => ({
  provider: "rules",
  baseUrl: "",
  apiKey: "",
  model: "",
  timeoutMs: 120000,
  systemPrompt: "",
  userPromptTemplate: "",
});

const normalizeTimeoutMs = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 120000;
  }
  return Math.floor(parsed);
};

const formatProviderText = (provider: MockExamAiReviewProvider) => (provider === "rules" ? "规则批改" : "远程 AI");

export function MockExamAiReviewConfig() {
  const [form, setForm] = useState<MockExamAiReviewConfig>(createDefaultConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await mockApi.getAdminMockExamAiReviewConfig();
        setForm({
          provider: data.provider,
          baseUrl: data.baseUrl ?? "",
          apiKey: data.apiKey ?? "",
          model: data.model ?? "",
          timeoutMs: normalizeTimeoutMs(data.timeoutMs ?? 120000),
          systemPrompt: data.systemPrompt ?? "",
          userPromptTemplate: data.userPromptTemplate ?? "",
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载 AI 批改配置失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const remoteMode = form.provider === "openai-compatible";
  const remoteReady = Boolean(form.baseUrl.trim() && form.apiKey.trim() && form.model.trim());
  const saveDisabled = loading || saving;

  const effectiveModeText = useMemo(() => {
    if (form.provider === "rules") {
      return "当前为规则批改模式";
    }
    if (remoteReady) {
      return form.timeoutMs === 0 ? "当前使用远程 AI 批改，超时已关闭" : "当前使用远程 AI 批改";
    }
    return "当前已切换到远程 AI 批改，但配置还不完整";
  }, [form.provider, remoteReady, form.timeoutMs]);

  const placeholderPreview = useMemo(() => PLACEHOLDERS.join("、"), []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: MockExamAiReviewConfig = {
        provider: form.provider,
        baseUrl: form.baseUrl.trim(),
        apiKey: form.apiKey.trim(),
        model: form.model.trim(),
        timeoutMs: normalizeTimeoutMs(form.timeoutMs),
        systemPrompt: form.systemPrompt,
        userPromptTemplate: form.userPromptTemplate,
      };
      const result = await mockApi.updateAdminMockExamAiReviewConfig(payload);
      setForm({
        provider: result.provider,
        baseUrl: result.baseUrl ?? "",
        apiKey: result.apiKey ?? "",
        model: result.model ?? "",
        timeoutMs: normalizeTimeoutMs(result.timeoutMs ?? 120000),
        systemPrompt: result.systemPrompt ?? "",
        userPromptTemplate: result.userPromptTemplate ?? "",
      });
      toast.success("AI 批改配置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存 AI 批改配置失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-8 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900">AI 批改设置</h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-500">
                这里控制主观题批改后台的 AI 批改方式。只有主观题会读取这里的配置，客观题不会进入 AI 批改流程。
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 lg:min-w-[280px]">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Effective Mode</div>
              <div className="mt-2 text-sm font-medium leading-6 text-slate-900">{effectiveModeText}</div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl space-y-8 px-8 py-8">
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <Bot className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">批改模式</h2>
                <p className="mt-1 text-sm text-slate-500">可以使用本地规则批改，也可以切换到兼容 OpenAI 接口规范的远程模型。</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label htmlFor="provider">批改模式</Label>
                <Select
                  value={form.provider}
                  onValueChange={(value: MockExamAiReviewProvider) => setForm((current) => ({ ...current, provider: value }))}
                  disabled={saveDisabled}
                >
                  <SelectTrigger id="provider" className="bg-white">
                    <SelectValue placeholder="请选择批改模式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rules">规则批改</SelectItem>
                    <SelectItem value="openai-compatible">远程 AI 批改</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
                <p>规则批改：按题目中的参考答案、采分点、关键词和分值规则直接判分。</p>
                <p>远程 AI 批改：调用兼容 OpenAI Chat Completions 的模型接口，按小问生成分数、点评、标注和采分点命中情况。</p>
                <p>当前逻辑：远程 AI 返回不完整、超时或失败时，会直接报错，不再自动回退到规则批改。</p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <BrainCircuit className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">远程模型配置</h2>
                <p className="mt-1 text-sm text-slate-500">只有在选择“远程 AI 批改”时，下面这组参数才会真正生效。</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  placeholder="例如：https://api.openai.com/v1"
                  value={form.baseUrl}
                  onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
                  disabled={saveDisabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">模型名称</Label>
                <Input
                  id="model"
                  placeholder="例如：gpt-4.1-mini 或 qwen-max"
                  value={form.model}
                  onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                  disabled={saveDisabled}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="请输入远程模型的 API Key"
                  value={form.apiKey}
                  onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
                  disabled={saveDisabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout">超时时间（毫秒）</Label>
                <Input
                  id="timeout"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.timeoutMs}
                  onChange={(event) => setForm((current) => ({ ...current, timeoutMs: normalizeTimeoutMs(event.target.value) }))}
                  disabled={saveDisabled}
                />
                <p className="text-xs leading-6 text-slate-500">填 0 表示不限时，系统会一直等待远程 AI 返回结果。</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
                <p>接口要求：必须兼容 OpenAI Chat Completions 规范。</p>
                <p>
                  调用路径：
                  <code className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[12px] text-slate-700">
                    {"{baseUrl}/chat/completions"}
                  </code>
                </p>
                <p>如果远程模型较慢，可以直接把超时设为 0，不再中途打断请求。</p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <BrainCircuit className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">批改提示词</h2>
                <p className="mt-1 text-sm text-slate-500">
                  可以直接改系统提示词和用户提示词模板。用户模板里必须保留这 3 个占位符，否则后端不会允许保存。
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-7 text-blue-900">
              <div className="font-medium">必留占位符</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PLACEHOLDERS.map((item) => (
                  <code key={item} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs text-blue-700">
                    {item}
                  </code>
                ))}
              </div>
              <p className="mt-3 text-xs leading-6 text-blue-800">
                当前模板校验项：
                <span className="ml-1">{placeholderPreview}</span>
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="system-prompt">系统提示词</Label>
                <Textarea
                  id="system-prompt"
                  rows={6}
                  className="min-h-[160px] bg-white [field-sizing:fixed]"
                  value={form.systemPrompt}
                  onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))}
                  disabled={saveDisabled}
                  placeholder="请输入系统提示词"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-prompt-template">用户提示词模板</Label>
                <Textarea
                  id="user-prompt-template"
                  rows={16}
                  className="min-h-[360px] bg-white font-mono text-[13px] leading-6 [field-sizing:fixed]"
                  value={form.userPromptTemplate}
                  onChange={(event) => setForm((current) => ({ ...current, userPromptTemplate: event.target.value }))}
                  disabled={saveDisabled}
                  placeholder="请输入用户提示词模板"
                />
                <p className="text-xs leading-6 text-slate-500">
                  必须保留： <code>{PLACEHOLDERS[0]}</code>、<code>{PLACEHOLDERS[1]}</code>、<code>{PLACEHOLDERS[2]}</code>
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">当前生效状态</h2>
                <p className="mt-1 text-sm text-slate-500">这里只显示配置是否完整，不会主动发起联网测试。</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Provider</div>
                <div className="mt-2 text-base font-semibold text-slate-900">{formatProviderText(form.provider)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Base URL</div>
                <div className="mt-2 text-base font-semibold text-slate-900">{form.baseUrl.trim() ? "已配置" : "未配置"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">API Key</div>
                <div className="mt-2 text-base font-semibold text-slate-900">{form.apiKey.trim() ? "已配置" : "未配置"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Model</div>
                <div className="mt-2 text-base font-semibold text-slate-900">{form.model.trim() ? "已配置" : "未配置"}</div>
              </div>
            </div>

            {remoteMode && !remoteReady ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
                远程 AI 模式下，<code>Base URL</code>、<code>API Key</code>、<code>模型名称</code> 三项必须完整，否则无法发起 AI 批改。
              </div>
            ) : null}
          </section>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saveDisabled}>
              {saving ? "保存中..." : "保存配置"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
