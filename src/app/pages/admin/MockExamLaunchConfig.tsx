import { ImageIcon, Loader2, Save, Trash2, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createDefaultMockExamLaunchConfig } from "../../../shared/mock-exam-launch-config.js";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { type MockExamLaunchConfig, mockApi } from "../../lib/mockData";

type UploadTarget = "avatar";

export function MockExamLaunchConfig() {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<MockExamLaunchConfig>(createDefaultMockExamLaunchConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<UploadTarget | "">("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await mockApi.getAdminMockExamLaunchConfig();
        setForm(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载机考启动页配置失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const updateLoginField = (field: keyof MockExamLaunchConfig["login"], value: string) => {
    setForm((current) => ({
      ...current,
      login: {
        ...current.login,
        [field]: value,
      },
    }));
  };

  const updateNoticeField = (field: keyof MockExamLaunchConfig["notice"], value: string | number) => {
    setForm((current) => ({
      ...current,
      notice: {
        ...current.notice,
        [field]: value,
      },
    }));
  };

  const updateTab = (key: MockExamLaunchConfig["tabs"][number]["key"], field: "label" | "html", value: string) => {
    setForm((current) => ({
      ...current,
      tabs: current.tabs.map((tab) => (tab.key === key ? { ...tab, [field]: value } : tab)),
    }));
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>, target: UploadTarget) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingTarget(target);
    try {
      const uploaded = await mockApi.uploadSystemImage(file);
      setForm((current) => ({
        ...current,
        notice: {
          ...current.notice,
          avatarUrl: uploaded.readableUrl ?? uploaded.url,
          avatarObjectKey: uploaded.objectKey,
        },
      }));
      toast.success("考生头像已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传头像失败");
    } finally {
      setUploadingTarget("");
      event.target.value = "";
    }
  };

  const handleClearAvatar = () => {
    setForm((current) => ({
      ...current,
      notice: {
        ...current.notice,
        avatarUrl: "",
        avatarObjectKey: "",
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await mockApi.updateAdminMockExamLaunchConfig({ config: form });
      setForm(result);
      toast.success("机考启动页配置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存机考启动页配置失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">机考启动页配置加载中...</div>;
  }

  return (
    <div className="space-y-6 p-8">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-8 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">机考启动页设置</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
                这里统一维护机考试卷启动页的登录文案、须知页弹窗文案、考生信息展示和三组说明内容。
              </p>
            </div>
            <Button className="rounded-2xl" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              保存配置
            </Button>
          </div>
        </div>

        <div className="space-y-8 px-8 py-8">
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <h2 className="text-lg font-semibold text-slate-900">登录页</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>准考证号字段名</Label>
                <Input value={form.login.ticketLabel} onChange={(event) => updateLoginField("ticketLabel", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>身份证字段名</Label>
                <Input value={form.login.idCardLabel} onChange={(event) => updateLoginField("idCardLabel", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>登录按钮文案</Label>
                <Input value={form.login.loginButtonText} onChange={(event) => updateLoginField("loginButtonText", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>重置按钮文案</Label>
                <Input value={form.login.resetButtonText} onChange={(event) => updateLoginField("resetButtonText", event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>全屏提示文案</Label>
                <Input value={form.login.fullscreenTip} onChange={(event) => updateLoginField("fullscreenTip", event.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <h2 className="text-lg font-semibold text-slate-900">须知页基础文案</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>阅读倒计时（秒）</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.notice.readSeconds}
                  onChange={(event) => updateNoticeField("readSeconds", Number.parseInt(event.target.value || "0", 10) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>提示弹窗延迟（毫秒）</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.notice.beginPromptDelayMs}
                  onChange={(event) => updateNoticeField("beginPromptDelayMs", Number.parseInt(event.target.value || "0", 10) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>进入考试按钮文案</Label>
                <Input value={form.notice.startButtonText} onChange={(event) => updateNoticeField("startButtonText", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>进入中按钮文案</Label>
                <Input value={form.notice.startingButtonText} onChange={(event) => updateNoticeField("startingButtonText", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>倒计时前缀</Label>
                <Input value={form.notice.countdownPrefix} onChange={(event) => updateNoticeField("countdownPrefix", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>勾选同意文案</Label>
                <Input value={form.notice.agreementText} onChange={(event) => updateNoticeField("agreementText", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>确认按钮文案</Label>
                <Input value={form.notice.confirmButtonText} onChange={(event) => updateNoticeField("confirmButtonText", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>返回按钮文案</Label>
                <Input value={form.notice.backButtonText} onChange={(event) => updateNoticeField("backButtonText", event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>开场提示弹窗文案</Label>
                <Textarea value={form.notice.beginPromptMessage} onChange={(event) => updateNoticeField("beginPromptMessage", event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>未勾选同意提示文案</Label>
                <Textarea value={form.notice.agreePromptMessage} onChange={(event) => updateNoticeField("agreePromptMessage", event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>考试结束文案</Label>
                <Textarea value={form.notice.examOverMessage} onChange={(event) => updateNoticeField("examOverMessage", event.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <h2 className="text-lg font-semibold text-slate-900">考生信息区</h2>
            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-4">
                  {form.notice.avatarUrl ? (
                    <img src={form.notice.avatarUrl} alt="考生头像" className="h-full w-auto rounded-2xl object-cover" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <ImageIcon className="mx-auto size-10" />
                      <p className="mt-3 text-sm">未上传头像</p>
                    </div>
                  )}
                </div>

                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleUpload(event, "avatar")} />

                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={uploadingTarget === "avatar"}>
                    <Upload className="mr-2 size-4" />
                    {uploadingTarget === "avatar" ? "上传中..." : "上传头像"}
                  </Button>
                  <Button type="button" variant="outline" className="text-red-500 hover:text-red-600" onClick={handleClearAvatar}>
                    <Trash2 className="mr-2 size-4" />
                    清空
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>姓名字段名</Label>
                  <Input value={form.notice.candidateNameLabel} onChange={(event) => updateNoticeField("candidateNameLabel", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>默认姓名</Label>
                  <Input value={form.notice.defaultCandidateName} onChange={(event) => updateNoticeField("defaultCandidateName", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>性别字段名</Label>
                  <Input value={form.notice.candidateGenderLabel} onChange={(event) => updateNoticeField("candidateGenderLabel", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>默认性别</Label>
                  <Input value={form.notice.defaultCandidateGender} onChange={(event) => updateNoticeField("defaultCandidateGender", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>准考证字段名</Label>
                  <Input value={form.notice.ticketLabel} onChange={(event) => updateNoticeField("ticketLabel", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>身份证字段名</Label>
                  <Input value={form.notice.idCardLabel} onChange={(event) => updateNoticeField("idCardLabel", event.target.value)} />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <h2 className="text-lg font-semibold text-slate-900">三组说明内容</h2>
            <p className="text-sm leading-7 text-slate-500">这里直接维护 HTML 内容，保留当前旧版样式结构。可以从现有内容出发局部替换，不需要整块重写。</p>
            <div className="space-y-6">
              {form.tabs.map((tab) => (
                <div key={tab.key} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="space-y-2">
                    <Label>{tab.key} 标签名称</Label>
                    <Input value={tab.label} onChange={(event) => updateTab(tab.key, "label", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{tab.label} HTML 内容</Label>
                    <Textarea value={tab.html} onChange={(event) => updateTab(tab.key, "html", event.target.value)} className="min-h-[320px] font-mono text-xs leading-6" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
