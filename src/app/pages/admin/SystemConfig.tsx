import { MessageCircleMore, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { mockApi } from "../../lib/mockData";

export function SystemConfig() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [customerServiceUrl, setCustomerServiceUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await mockApi.getSystemConfig();
        setWebhookUrl(data.webhookUrl);
        setCustomerServiceUrl(data.customerServiceUrl ?? "");
      } catch {
        toast.error("加载系统配置失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const normalizedWebhookUrl = webhookUrl.trim();
  const normalizedCustomerServiceUrl = customerServiceUrl.trim();

  const handleSave = async () => {
    if (!normalizedWebhookUrl) {
      toast.error("请输入企业微信 Webhook 地址");
      return;
    }

    setSaving(true);
    try {
      await mockApi.updateSystemConfig({
        webhookUrl: normalizedWebhookUrl,
        customerServiceUrl: normalizedCustomerServiceUrl,
      });
      toast.success("系统配置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!normalizedWebhookUrl) {
      toast.error("请先填写企业微信 Webhook 地址");
      return;
    }

    setTesting(true);
    try {
      await mockApi.testWebhook(normalizedWebhookUrl);
      toast.success("测试通知已发送，请到企业微信群查看");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "测试通知发送失败");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <h1 className="text-2xl font-semibold text-slate-900">系统配置</h1>
          <p className="mt-2 text-sm text-slate-500">配置企业微信通知和登录页客服入口，方便正式上线后统一维护。</p>
        </div>

        <div className="max-w-4xl space-y-8 px-8 py-8">
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <Send className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">企业微信 Webhook</h2>
                <p className="mt-1 text-sm text-slate-500">用于课程开放、批量导入、日活汇总等消息推送。</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook">Webhook 地址</Label>
              <Input
                id="webhook"
                placeholder="请输入企业微信群机器人的 Webhook 地址"
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                disabled={loading}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <MessageCircleMore className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">登录页客服入口</h2>
                <p className="mt-1 text-sm text-slate-500">学员点击“联系客服”后，将直接跳转到你配置的企业微信客服链接。</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-service">企业微信客服链接</Label>
              <Input
                id="customer-service"
                placeholder="请输入企业微信客服链接"
                value={customerServiceUrl}
                onChange={(event) => setCustomerServiceUrl(event.target.value)}
                disabled={loading}
              />
            </div>
          </section>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            <p>当前说明：</p>
            <p>1. 课程状态为“定时开放中”并达到开放时间后，系统会自动推送企业微信通知。</p>
            <p>2. 登录页客服按钮会直接读取这里配置的企业微信客服链接。</p>
            <p>3. 如果客服链接未配置，登录页点击客服按钮时会提示管理员先完成配置。</p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={handleTest} disabled={loading || saving || testing}>
              {testing ? "发送中..." : "发送测试通知"}
            </Button>
            <Button onClick={handleSave} disabled={saving || loading || testing}>
              {saving ? "保存中..." : "保存配置"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
