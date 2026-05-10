import { ExternalLink, Globe, Image as ImageIcon, LayoutPanelTop, Link2, MessageCircleMore, Send, Share2, Trash2, Upload, UserRound } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { type PortalConfig, mockApi } from "../../lib/mockData";
import { createDefaultPortalConfig } from "../../../shared/portal-config.js";
import { buildPublicSiteUrl } from "../../../shared/site-config.js";

const featureLabels: Record<string, string> = {
  audio: "音频课程",
  exam: "机考系统",
  laws: "法条检索",
  typing: "打字练习",
};

const parseLines = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseParagraphs = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const joinLines = (items: string[]) => items.join("\n");

const resolvePreviewUrl = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";

  if (typeof window === "undefined") {
    return normalized;
  }

  try {
    return new URL(normalized, window.location.origin).toString();
  } catch {
    return normalized;
  }
};

export function SystemConfig() {
  const shareImageInputRef = useRef<HTMLInputElement | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [customerServiceUrl, setCustomerServiceUrl] = useState("");
  const [portalConfig, setPortalConfig] = useState<PortalConfig>(createDefaultPortalConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [uploadingShareImage, setUploadingShareImage] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await mockApi.getSystemConfig();
        setWebhookUrl(data.webhookUrl);
        setCustomerServiceUrl(data.customerServiceUrl ?? "");
        setPortalConfig(data.portalConfig ?? createDefaultPortalConfig());
      } catch {
        toast.error("加载系统配置失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  function updatePortalSection<TSection extends keyof PortalConfig, TKey extends keyof PortalConfig[TSection]>(
    section: TSection,
    key: TKey,
    value: PortalConfig[TSection][TKey],
  ) {
    setPortalConfig((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  }

  const updatePortalFeature = (key: string, field: keyof PortalConfig["features"][number], value: string | string[]) => {
    setPortalConfig((current) => ({
      ...current,
      features: current.features.map((feature) =>
        feature.key === key
          ? {
              ...feature,
              [field]: value,
            }
          : feature,
      ),
    }));
  };

  const updateNavigationLink = (index: number, field: "label" | "href", value: string) => {
    setPortalConfig((current) => ({
      ...current,
      navigation: {
        ...current.navigation,
        links: current.navigation.links.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item,
        ),
      },
    }));
  };

  const updateJourneyCard = (index: number, field: "step" | "title" | "description", value: string) => {
    setPortalConfig((current) => ({
      ...current,
      journey: {
        ...current.journey,
        cards: current.journey.cards.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item,
        ),
      },
    }));
  };

  const updateExperienceCard = (index: number, field: "title" | "description", value: string) => {
    setPortalConfig((current) => ({
      ...current,
      experience: {
        ...current.experience,
        cards: current.experience.cards.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item,
        ),
      },
    }));
  };

  const updateStartOption = (index: number, field: "title" | "description" | "path", value: string) => {
    setPortalConfig((current) => ({
      ...current,
      startOptions: {
        ...current.startOptions,
        items: current.startOptions.items.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item,
        ),
      },
    }));
  };

  const updateContactStep = (index: number, field: "step" | "title" | "detail", value: string) => {
    setPortalConfig((current) => ({
      ...current,
      contact: {
        ...current.contact,
        steps: current.contact.steps.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item,
        ),
      },
    }));
  };

  const updateLegalDocument = (index: number, field: "title" | "slug" | "content", value: string | string[]) => {
    setPortalConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        legalDocuments: current.footer.legalDocuments.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item,
        ),
      },
    }));
  };

  const normalizedWebhookUrl = webhookUrl.trim();
  const normalizedCustomerServiceUrl = customerServiceUrl.trim();
  const resolvedContactUrl = (portalConfig.contact.url?.trim() || normalizedCustomerServiceUrl).trim();
  const resolvedOgImageUrl = resolvePreviewUrl(portalConfig.seo.ogImageUrl);
  const portalUrlPreview = buildPublicSiteUrl("/");
  const brandName = portalConfig.seo.title.split("|")[0]?.trim() || "得恩法考";
  const shareTitlePreview =
    portalConfig.seo.title.trim() || [portalConfig.hero.title, portalConfig.hero.highlight].filter(Boolean).join(" ");
  const shareDescriptionPreview = portalConfig.seo.description.trim() || portalConfig.hero.description.trim();

  const handleShareImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingShareImage(true);
    try {
      const uploaded = await mockApi.uploadSystemImage(file);
      setPortalConfig((current) => ({
        ...current,
        seo: {
          ...current.seo,
          ogImageUrl: uploaded.readableUrl ?? uploaded.url,
          ogImageObjectKey: uploaded.objectKey,
        },
      }));
      toast.success("分享图上传成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分享图上传失败");
    } finally {
      setUploadingShareImage(false);
      event.target.value = "";
    }
  };

  const handleClearShareImage = () => {
    setPortalConfig((current) => ({
      ...current,
      seo: {
        ...current.seo,
        ogImageUrl: "",
        ogImageObjectKey: "",
      },
    }));
  };

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
        portalConfig,
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
          <h1 className="text-2xl font-semibold text-slate-900">门户内容设置</h1>
          <p className="mt-2 text-sm text-slate-500">
            统一维护企业微信通知、客服入口、门户 SEO、首页文案与咨询转化信息，正式上线后不再反复改代码。
          </p>
        </div>

        <div className="max-w-5xl space-y-8 px-8 py-8">
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
              <LayoutPanelTop className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">站内首页与个人页文案</h2>
                <p className="mt-1 text-sm text-slate-500">统一维护站内首页横幅、我的试卷页头部，以及我的页面的说明与快捷入口。</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-medium text-slate-900">站内首页横幅</div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="member-home-hero-badge">横幅角标</Label>
                  <Input
                    id="member-home-hero-badge"
                    value={portalConfig.memberHome.hero.badge}
                    onChange={(event) =>
                      updatePortalSection("memberHome", "hero", {
                        ...portalConfig.memberHome.hero,
                        badge: event.target.value,
                      })
                    }
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="member-home-hero-title">横幅标题</Label>
                  <Input
                    id="member-home-hero-title"
                    value={portalConfig.memberHome.hero.title}
                    onChange={(event) =>
                      updatePortalSection("memberHome", "hero", {
                        ...portalConfig.memberHome.hero,
                        title: event.target.value,
                      })
                    }
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="member-home-hero-description">横幅说明</Label>
                  <Textarea
                    id="member-home-hero-description"
                    rows={3}
                    value={portalConfig.memberHome.hero.description}
                    onChange={(event) =>
                      updatePortalSection("memberHome", "hero", {
                        ...portalConfig.memberHome.hero,
                        description: event.target.value,
                      })
                    }
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-medium text-slate-900">我的试卷页</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="exam-home-eyebrow">页眉英文角标</Label>
                  <Input id="exam-home-eyebrow" value={portalConfig.examHome.eyebrow} onChange={(event) => updatePortalSection("examHome", "eyebrow", event.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-home-title">页面标题</Label>
                  <Input id="exam-home-title" value={portalConfig.examHome.title} onChange={(event) => updatePortalSection("examHome", "title", event.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-home-objective-mode">客观题模式文案</Label>
                  <Input id="exam-home-objective-mode" value={portalConfig.examHome.objectiveModeLabel} onChange={(event) => updatePortalSection("examHome", "objectiveModeLabel", event.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-home-subjective-mode">主观题模式文案</Label>
                  <Input id="exam-home-subjective-mode" value={portalConfig.examHome.subjectiveModeLabel} onChange={(event) => updatePortalSection("examHome", "subjectiveModeLabel", event.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-home-objective-empty">客观题空态文案</Label>
                  <Textarea id="exam-home-objective-empty" rows={3} value={portalConfig.examHome.objectiveEmptyText} onChange={(event) => updatePortalSection("examHome", "objectiveEmptyText", event.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-home-subjective-empty">主观题空态文案</Label>
                  <Textarea id="exam-home-subjective-empty" rows={3} value={portalConfig.examHome.subjectiveEmptyText} onChange={(event) => updatePortalSection("examHome", "subjectiveEmptyText", event.target.value)} disabled={loading} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-medium text-slate-900">我的页面</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="account-center-eyebrow">页眉英文角标</Label>
                  <Input id="account-center-eyebrow" value={portalConfig.accountCenter.eyebrow} onChange={(event) => updatePortalSection("accountCenter", "eyebrow", event.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-center-shortcut-title">快捷入口标题</Label>
                  <Input id="account-center-shortcut-title" value={portalConfig.accountCenter.shortcutTitle} onChange={(event) => updatePortalSection("accountCenter", "shortcutTitle", event.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2 md:col-span-2 xl:col-span-1">
                  <Label htmlFor="account-center-description">页面说明</Label>
                  <Textarea id="account-center-description" rows={3} value={portalConfig.accountCenter.description} onChange={(event) => updatePortalSection("accountCenter", "description", event.target.value)} disabled={loading} />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {portalConfig.accountCenter.shortcuts.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="space-y-2">
                      <Label htmlFor={`account-shortcut-title-${index}`}>快捷入口标题 {index + 1}</Label>
                      <Input id={`account-shortcut-title-${index}`} value={item.title} onChange={(event) => updatePortalSection("accountCenter", "shortcuts", portalConfig.accountCenter.shortcuts.map((currentItem, itemIndex) => itemIndex === index ? { ...currentItem, title: event.target.value } : currentItem))} disabled={loading} />
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`account-shortcut-description-${index}`}>快捷入口说明 {index + 1}</Label>
                      <Textarea id={`account-shortcut-description-${index}`} rows={3} value={item.description} onChange={(event) => updatePortalSection("accountCenter", "shortcuts", portalConfig.accountCenter.shortcuts.map((currentItem, itemIndex) => itemIndex === index ? { ...currentItem, description: event.target.value } : currentItem))} disabled={loading} />
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`account-shortcut-path-${index}`}>跳转路径 {index + 1}</Label>
                      <Input id={`account-shortcut-path-${index}`} value={item.path} onChange={(event) => updatePortalSection("accountCenter", "shortcuts", portalConfig.accountCenter.shortcuts.map((currentItem, itemIndex) => itemIndex === index ? { ...currentItem, path: event.target.value } : currentItem))} disabled={loading} />
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`account-shortcut-accent-${index}`}>底部强调文案 {index + 1}</Label>
                      <Input id={`account-shortcut-accent-${index}`} value={item.accentText} onChange={(event) => updatePortalSection("accountCenter", "shortcuts", portalConfig.accountCenter.shortcuts.map((currentItem, itemIndex) => itemIndex === index ? { ...currentItem, accentText: event.target.value } : currentItem))} disabled={loading} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <MessageCircleMore className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">客服与转化入口</h2>
                <p className="mt-1 text-sm text-slate-500">登录页和门户页都会读取这里的客服链接，保证咨询入口一致。</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-service">企微客服 / 预约链接</Label>
              <Input
                id="customer-service"
                placeholder="请输入企微客服、试学预约或外部表单链接"
                value={customerServiceUrl}
                onChange={(event) => setCustomerServiceUrl(event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-phone">咨询电话</Label>
                <Input
                  id="contact-phone"
                  placeholder="例如：400-000-0000"
                  value={portalConfig.contact.phone}
                  onChange={(event) => updatePortalSection("contact", "phone", event.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-wechat">咨询微信</Label>
                <Input
                  id="contact-wechat"
                  placeholder="例如：denfakao001"
                  value={portalConfig.contact.wechat}
                  onChange={(event) => updatePortalSection("contact", "wechat", event.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-badge">咨询区标签</Label>
                <Input
                  id="contact-badge"
                  value={portalConfig.contact.badge}
                  onChange={(event) => updatePortalSection("contact", "badge", event.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-button">咨询按钮文案</Label>
                <Input
                  id="contact-button"
                  value={portalConfig.contact.buttonLabel}
                  onChange={(event) => updatePortalSection("contact", "buttonLabel", event.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-title">咨询区标题</Label>
              <Input
                id="contact-title"
                value={portalConfig.contact.title}
                onChange={(event) => updatePortalSection("contact", "title", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-description">咨询区说明</Label>
              <Textarea
                id="contact-description"
                rows={4}
                value={portalConfig.contact.description}
                onChange={(event) => updatePortalSection("contact", "description", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-hint">咨询区提示</Label>
              <Textarea
                id="contact-hint"
                rows={3}
                value={portalConfig.contact.buttonHint}
                onChange={(event) => updatePortalSection("contact", "buttonHint", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-medium text-slate-900">咨询流程卡片</div>
              {portalConfig.contact.steps.map((item, index) => (
                <div key={item.step + index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label htmlFor={`contact-step-${index}`}>步骤编号</Label>
                      <Input
                        id={`contact-step-${index}`}
                        value={item.step}
                        onChange={(event) => updateContactStep(index, "step", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`contact-step-title-${index}`}>步骤标题</Label>
                      <Input
                        id={`contact-step-title-${index}`}
                        value={item.title}
                        onChange={(event) => updateContactStep(index, "title", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`contact-step-detail-${index}`}>步骤说明</Label>
                    <Textarea
                      id={`contact-step-detail-${index}`}
                      rows={3}
                      value={item.detail}
                      onChange={(event) => updateContactStep(index, "detail", event.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_320px]">
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-white/45">Portal Contact Preview</div>
                    <div className="mt-2 text-xl font-semibold text-white">{portalConfig.contact.title}</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/68">
                    {portalConfig.contact.badge}
                  </div>
                </div>

                <p className="mt-4 max-w-xl text-sm leading-7 text-white/62">{portalConfig.contact.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {portalConfig.contact.phone ? (
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/70">
                      电话：{portalConfig.contact.phone}
                    </span>
                  ) : null}
                  {portalConfig.contact.wechat ? (
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/70">
                      微信：{portalConfig.contact.wechat}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    className="h-11 rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100"
                    onClick={() => resolvedContactUrl && window.open(resolvedContactUrl, "_blank", "noopener,noreferrer")}
                    disabled={!resolvedContactUrl}
                  >
                    {portalConfig.contact.buttonLabel}
                    <ExternalLink className="ml-2 size-4" />
                  </Button>
                  <div className="text-xs leading-6 text-white/40">{portalConfig.contact.buttonHint}</div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">运营检查</div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">最终客服链接</div>
                    <div className="mt-2 break-all text-sm text-slate-700">
                      {resolvedContactUrl || "未配置，公开页按钮不会跳转"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">会读取的位置</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1">门户页顶部按钮</span>
                      <span className="rounded-full bg-white px-3 py-1">门户页咨询区</span>
                      <span className="rounded-full bg-white px-3 py-1">登录页客服按钮</span>
                      <span className="rounded-full bg-white px-3 py-1">页脚 CTA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <Share2 className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">SEO 与分享信息</h2>
                <p className="mt-1 text-sm text-slate-500">公开门户首页会自动读取这些信息生成标题、描述和分享卡片。</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-title">SEO 标题</Label>
              <Input
                id="seo-title"
                value={portalConfig.seo.title}
                onChange={(event) => updatePortalSection("seo", "title", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-description">SEO 描述</Label>
              <Textarea
                id="seo-description"
                rows={4}
                value={portalConfig.seo.description}
                onChange={(event) => updatePortalSection("seo", "description", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-keywords">SEO 关键词</Label>
              <Input
                id="seo-keywords"
                value={portalConfig.seo.keywords}
                onChange={(event) => updatePortalSection("seo", "keywords", event.target.value)}
                placeholder="多个关键词请用英文逗号分隔"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-og-image">分享图地址</Label>
              <Input
                id="seo-og-image"
                value={portalConfig.seo.ogImageUrl}
                readOnly
                onChange={(event) => updatePortalSection("seo", "ogImageUrl", event.target.value)}
                placeholder="支持完整 URL 或 /portal/xxx.png 这样的相对路径"
                disabled={loading}
              />
            </div>
            <input
              ref={shareImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleShareImageUpload(event)}
            />
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-900">门户分享卡封面</div>
                  <div className="text-sm leading-6 text-slate-500">
                    建议上传横版图片，推荐尺寸 1200 x 630。保存后首页 SEO 与分享卡会自动读取，不需要手填 URL。
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => shareImageInputRef.current?.click()}
                    disabled={loading || uploadingShareImage}
                  >
                    <Upload className="mr-2 size-4" />
                    {uploadingShareImage ? "上传中..." : "上传分享图"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearShareImage}
                    disabled={loading || uploadingShareImage || (!portalConfig.seo.ogImageUrl && !portalConfig.seo.ogImageObjectKey)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    清空
                  </Button>
                </div>
              </div>
              {portalConfig.seo.ogImageObjectKey ? (
                <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  对象键：{portalConfig.seo.ogImageObjectKey}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.22em] text-white/45">
                  <span>OG Image</span>
                  <ImageIcon className="size-4" />
                </div>
                {resolvedOgImageUrl ? (
                  <div className="aspect-[1.91/1] bg-slate-900">
                    <img src={resolvedOgImageUrl} alt="OG 预览图" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex aspect-[1.91/1] items-center justify-center bg-slate-900 text-sm text-white/40">
                    未配置分享图
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                  <Link2 className="size-4" />
                  分享卡预览
                </div>

                <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 shadow-sm">
                  {resolvedOgImageUrl ? (
                    <div className="aspect-[1.91/1] bg-slate-100">
                      <img src={resolvedOgImageUrl} alt="分享卡封面" className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                  <div className="p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{brandName}</div>
                    <div className="mt-2 text-lg font-semibold leading-7 text-slate-900">{shareTitlePreview}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">{shareDescriptionPreview}</div>
                    <div className="mt-4 break-all text-xs text-slate-400">{portalUrlPreview}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <LayoutPanelTop className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">门户首屏文案</h2>
                <p className="mt-1 text-sm text-slate-500">这里控制门户首页首屏的标题、亮点和简介。</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hero-badge">首屏标签</Label>
                <Input
                  id="hero-badge"
                  value={portalConfig.hero.badge}
                  onChange={(event) => updatePortalSection("hero", "badge", event.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hero-highlight">高亮标题</Label>
                <Input
                  id="hero-highlight"
                  value={portalConfig.hero.highlight}
                  onChange={(event) => updatePortalSection("hero", "highlight", event.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero-title">主标题前半句</Label>
              <Input
                id="hero-title"
                value={portalConfig.hero.title}
                onChange={(event) => updatePortalSection("hero", "title", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero-description">首屏说明</Label>
              <Textarea
                id="hero-description"
                rows={4}
                value={portalConfig.hero.description}
                onChange={(event) => updatePortalSection("hero", "description", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero-tags">首屏快捷标签</Label>
              <Textarea
                id="hero-tags"
                rows={3}
                value={joinLines(portalConfig.hero.quickTags)}
                onChange={(event) => updatePortalSection("hero", "quickTags", parseLines(event.target.value))}
                placeholder={"每行一条\n公开门户展示\n登录直达首页"}
                disabled={loading}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <MessageCircleMore className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">站内首页公告</h2>
                <p className="mt-1 text-sm text-slate-500">登录后的平台首页会读取这里的公告标题、角标和两条提示内容。</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="member-home-announcement-title">公告标题</Label>
                <Input
                  id="member-home-announcement-title"
                  value={portalConfig.memberHome.announcement.title}
                  onChange={(event) =>
                    updatePortalSection("memberHome", "announcement", {
                      ...portalConfig.memberHome.announcement,
                      title: event.target.value,
                    })
                  }
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-home-announcement-subtitle">英文副标题</Label>
                <Input
                  id="member-home-announcement-subtitle"
                  value={portalConfig.memberHome.announcement.subtitle}
                  onChange={(event) =>
                    updatePortalSection("memberHome", "announcement", {
                      ...portalConfig.memberHome.announcement,
                      subtitle: event.target.value,
                    })
                  }
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-home-announcement-badge">右侧角标</Label>
                <Input
                  id="member-home-announcement-badge"
                  value={portalConfig.memberHome.announcement.badge}
                  onChange={(event) =>
                    updatePortalSection("memberHome", "announcement", {
                      ...portalConfig.memberHome.announcement,
                      badge: event.target.value,
                    })
                  }
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {portalConfig.memberHome.announcement.items.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="space-y-2">
                    <Label htmlFor={`member-home-announcement-item-title-${index}`}>公告标题 {index + 1}</Label>
                    <Input
                      id={`member-home-announcement-item-title-${index}`}
                      value={item.title}
                      onChange={(event) =>
                        updatePortalSection("memberHome", "announcement", {
                          ...portalConfig.memberHome.announcement,
                          items: portalConfig.memberHome.announcement.items.map((currentItem, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...currentItem,
                                  title: event.target.value,
                                }
                              : currentItem,
                          ),
                        })
                      }
                      disabled={loading}
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`member-home-announcement-item-description-${index}`}>公告说明 {index + 1}</Label>
                    <Textarea
                      id={`member-home-announcement-item-description-${index}`}
                      rows={4}
                      value={item.description}
                      onChange={(event) =>
                        updatePortalSection("memberHome", "announcement", {
                          ...portalConfig.memberHome.announcement,
                          items: portalConfig.memberHome.announcement.items.map((currentItem, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...currentItem,
                                  description: event.target.value,
                                }
                              : currentItem,
                          ),
                        })
                      }
                      disabled={loading}
                    />
                  </div>
                </div>
                ))}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <ExternalLink className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">站内首页推荐位</h2>
                <p className="mt-1 text-sm text-slate-500">登录后的首页推荐卡片从这里读取，适合放课程入口、机考入口和专项训练入口。</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="member-home-operations-title">推荐区标题</Label>
                <Input
                  id="member-home-operations-title"
                  value={portalConfig.memberHome.operations.title}
                  onChange={(event) =>
                    updatePortalSection("memberHome", "operations", {
                      ...portalConfig.memberHome.operations,
                      title: event.target.value,
                    })
                  }
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-home-operations-subtitle">推荐区副标题</Label>
                <Input
                  id="member-home-operations-subtitle"
                  value={portalConfig.memberHome.operations.subtitle}
                  onChange={(event) =>
                    updatePortalSection("memberHome", "operations", {
                      ...portalConfig.memberHome.operations,
                      subtitle: event.target.value,
                    })
                  }
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {portalConfig.memberHome.operations.items.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="space-y-2">
                    <Label htmlFor={`member-home-operation-eyebrow-${index}`}>卡片标签 {index + 1}</Label>
                    <Input
                      id={`member-home-operation-eyebrow-${index}`}
                      value={item.eyebrow}
                      onChange={(event) =>
                        updatePortalSection("memberHome", "operations", {
                          ...portalConfig.memberHome.operations,
                          items: portalConfig.memberHome.operations.items.map((currentItem, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...currentItem,
                                  eyebrow: event.target.value,
                                }
                              : currentItem,
                          ),
                        })
                      }
                      disabled={loading}
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`member-home-operation-title-${index}`}>卡片标题 {index + 1}</Label>
                    <Input
                      id={`member-home-operation-title-${index}`}
                      value={item.title}
                      onChange={(event) =>
                        updatePortalSection("memberHome", "operations", {
                          ...portalConfig.memberHome.operations,
                          items: portalConfig.memberHome.operations.items.map((currentItem, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...currentItem,
                                  title: event.target.value,
                                }
                              : currentItem,
                          ),
                        })
                      }
                      disabled={loading}
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`member-home-operation-description-${index}`}>卡片说明 {index + 1}</Label>
                    <Textarea
                      id={`member-home-operation-description-${index}`}
                      rows={4}
                      value={item.description}
                      onChange={(event) =>
                        updatePortalSection("memberHome", "operations", {
                          ...portalConfig.memberHome.operations,
                          items: portalConfig.memberHome.operations.items.map((currentItem, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...currentItem,
                                  description: event.target.value,
                                }
                              : currentItem,
                          ),
                        })
                      }
                      disabled={loading}
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`member-home-operation-path-${index}`}>跳转路径 {index + 1}</Label>
                    <Input
                      id={`member-home-operation-path-${index}`}
                      value={item.path}
                      onChange={(event) =>
                        updatePortalSection("memberHome", "operations", {
                          ...portalConfig.memberHome.operations,
                          items: portalConfig.memberHome.operations.items.map((currentItem, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...currentItem,
                                  path: event.target.value,
                                }
                              : currentItem,
                          ),
                        })
                      }
                      disabled={loading}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <Globe className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">导航与入口标签</h2>
                <p className="mt-1 text-sm text-slate-500">顶部导航、移动端快捷入口和页脚标题都在这里维护。</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {portalConfig.navigation.links.map((item, index) => (
                <div key={item.href + index} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="space-y-2">
                    <Label htmlFor={`nav-link-label-${index}`}>导航文案 {index + 1}</Label>
                    <Input
                      id={`nav-link-label-${index}`}
                      value={item.label}
                      onChange={(event) => updateNavigationLink(index, "label", event.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`nav-link-href-${index}`}>锚点地址</Label>
                    <Input
                      id={`nav-link-href-${index}`}
                      value={item.href}
                      onChange={(event) => updateNavigationLink(index, "href", event.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="nav-quick-entry">移动端快捷入口标题</Label>
                <Input
                  id="nav-quick-entry"
                  value={portalConfig.navigation.quickEntryLabel}
                  onChange={(event) => updatePortalSection("navigation", "quickEntryLabel", event.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nav-footer-title">页脚导航标题</Label>
                <Input
                  id="nav-footer-title"
                  value={portalConfig.navigation.footerNavTitle}
                  onChange={(event) => updatePortalSection("navigation", "footerNavTitle", event.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nav-footer-feature-title">页脚模块标题</Label>
                <Input
                  id="nav-footer-feature-title"
                  value={portalConfig.navigation.footerFeatureTitle}
                  onChange={(event) => updatePortalSection("navigation", "footerFeatureTitle", event.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-medium text-slate-900">门户按钮文案</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="action-auth-logged-in">登录后按钮文案</Label>
                  <Input
                    id="action-auth-logged-in"
                    value={portalConfig.actions.authLoggedInLabel}
                    onChange={(event) => updatePortalSection("actions", "authLoggedInLabel", event.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action-auth-logged-out">未登录按钮文案</Label>
                  <Input
                    id="action-auth-logged-out"
                    value={portalConfig.actions.authLoggedOutLabel}
                    onChange={(event) => updatePortalSection("actions", "authLoggedOutLabel", event.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action-auth-short">移动端短按钮文案</Label>
                  <Input
                    id="action-auth-short"
                    value={portalConfig.actions.authLoggedInShortLabel}
                    onChange={(event) => updatePortalSection("actions", "authLoggedInShortLabel", event.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action-browse-modules">浏览模块按钮文案</Label>
                  <Input
                    id="action-browse-modules"
                    value={portalConfig.actions.browseModulesLabel}
                    onChange={(event) => updatePortalSection("actions", "browseModulesLabel", event.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action-consult-now">快捷咨询按钮文案</Label>
                  <Input
                    id="action-consult-now"
                    value={portalConfig.actions.consultNowLabel}
                    onChange={(event) => updatePortalSection("actions", "consultNowLabel", event.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action-footer-browse">页脚模块按钮文案</Label>
                  <Input
                    id="action-footer-browse"
                    value={portalConfig.actions.footerBrowseLabel}
                    onChange={(event) => updatePortalSection("actions", "footerBrowseLabel", event.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="products-title">模块区主标题</Label>
                <Input
                  id="products-title"
                  value={portalConfig.products.title}
                  onChange={(event) => updatePortalSection("products", "title", event.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <Globe className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">备考路径与开始方式</h2>
                <p className="mt-1 text-sm text-slate-500">首页路径卡、平台价值卡和开始入口说明都在这里统一维护。</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label htmlFor="journey-eyebrow">备考路径标签</Label>
                  <Input
                    id="journey-eyebrow"
                    value={portalConfig.journey.eyebrow}
                    onChange={(event) => updatePortalSection("journey", "eyebrow", event.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="journey-title">备考路径标题</Label>
                  <Input
                    id="journey-title"
                    value={portalConfig.journey.title}
                    onChange={(event) => updatePortalSection("journey", "title", event.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {portalConfig.journey.cards.map((item, index) => (
                  <div key={item.step + index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <Label htmlFor={`journey-step-${index}`}>步骤编号</Label>
                        <Input
                          id={`journey-step-${index}`}
                          value={item.step}
                          onChange={(event) => updateJourneyCard(index, "step", event.target.value)}
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`journey-title-${index}`}>卡片标题</Label>
                        <Input
                          id={`journey-title-${index}`}
                          value={item.title}
                          onChange={(event) => updateJourneyCard(index, "title", event.target.value)}
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`journey-description-${index}`}>卡片说明</Label>
                      <Textarea
                        id={`journey-description-${index}`}
                        rows={3}
                        value={item.description}
                        onChange={(event) => updateJourneyCard(index, "description", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <UserRound className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">平台价值、开始方式与创始人区域</h2>
                <p className="mt-1 text-sm text-slate-500">平台价值卡、开始方式和创始人区域会统一从这里读取配置。</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label htmlFor="experience-badge">平台价值标签</Label>
                  <Input
                    id="experience-badge"
                    value={portalConfig.experience.badge}
                    onChange={(event) => updatePortalSection("experience", "badge", event.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience-title">平台价值标题</Label>
                  <Input
                    id="experience-title"
                    value={portalConfig.experience.title}
                    onChange={(event) => updatePortalSection("experience", "title", event.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {portalConfig.experience.cards.map((item, index) => (
                  <div key={item.title + index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="space-y-2">
                      <Label htmlFor={`experience-card-title-${index}`}>卡片标题</Label>
                      <Input
                        id={`experience-card-title-${index}`}
                        value={item.title}
                        onChange={(event) => updateExperienceCard(index, "title", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`experience-card-description-${index}`}>卡片说明</Label>
                      <Textarea
                        id={`experience-card-description-${index}`}
                        rows={4}
                        value={item.description}
                        onChange={(event) => updateExperienceCard(index, "description", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label htmlFor="start-panel-eyebrow">开始区标签</Label>
                  <Input
                    id="start-panel-eyebrow"
                    value={portalConfig.startPanel.eyebrow}
                    onChange={(event) => updatePortalSection("startPanel", "eyebrow", event.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start-panel-logged-out">未登录标题</Label>
                  <Input
                    id="start-panel-logged-out"
                    value={portalConfig.startPanel.loggedOutTitle}
                    onChange={(event) => updatePortalSection("startPanel", "loggedOutTitle", event.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start-panel-logged-in">已登录标题</Label>
                  <Input
                    id="start-panel-logged-in"
                    value={portalConfig.startPanel.loggedInTitle}
                    onChange={(event) => updatePortalSection("startPanel", "loggedInTitle", event.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="start-panel-description">开始区说明</Label>
                <Textarea
                  id="start-panel-description"
                  rows={3}
                  value={portalConfig.startPanel.description}
                  onChange={(event) => updatePortalSection("startPanel", "description", event.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="mt-6 space-y-2">
                <Label htmlFor="start-options-eyebrow">开始方式标题</Label>
                <Input
                  id="start-options-eyebrow"
                  value={portalConfig.startOptions.eyebrow}
                  onChange={(event) => updatePortalSection("startOptions", "eyebrow", event.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {portalConfig.startOptions.items.map((item, index) => (
                  <div key={item.path + index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="space-y-2">
                      <Label htmlFor={`start-option-title-${index}`}>入口标题</Label>
                      <Input
                        id={`start-option-title-${index}`}
                        value={item.title}
                        onChange={(event) => updateStartOption(index, "title", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`start-option-description-${index}`}>入口说明</Label>
                      <Textarea
                        id={`start-option-description-${index}`}
                        rows={3}
                        value={item.description}
                        onChange={(event) => updateStartOption(index, "description", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`start-option-path-${index}`}>跳转路径</Label>
                      <Input
                        id={`start-option-path-${index}`}
                        value={item.path}
                        onChange={(event) => updateStartOption(index, "path", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="founder-section-badge">创始人区域标签</Label>
                <Input
                  id="founder-section-badge"
                  value={portalConfig.founder.sectionBadge}
                  onChange={(event) => updatePortalSection("founder", "sectionBadge", event.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="founder-perspective-label">视角标签</Label>
                <Input
                  id="founder-perspective-label"
                  value={portalConfig.founder.perspectiveLabel}
                  onChange={(event) => updatePortalSection("founder", "perspectiveLabel", event.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="founder-name">姓名</Label>
                <Input
                  id="founder-name"
                  value={portalConfig.founder.name}
                  onChange={(event) => updatePortalSection("founder", "name", event.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="founder-role">头衔</Label>
                <Input
                  id="founder-role"
                  value={portalConfig.founder.role}
                  onChange={(event) => updatePortalSection("founder", "role", event.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="founder-intro">简介第一段</Label>
              <Textarea
                id="founder-intro"
                rows={4}
                value={portalConfig.founder.intro}
                onChange={(event) => updatePortalSection("founder", "intro", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="founder-statement">简介第二段</Label>
              <Textarea
                id="founder-statement"
                rows={4}
                value={portalConfig.founder.statement}
                onChange={(event) => updatePortalSection("founder", "statement", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="founder-method">方法论标签</Label>
              <Input
                id="founder-method"
                value={portalConfig.founder.methodLabel}
                onChange={(event) => updatePortalSection("founder", "methodLabel", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="founder-perspective">创始人视角</Label>
              <Textarea
                id="founder-perspective"
                rows={4}
                value={portalConfig.founder.perspective}
                onChange={(event) => updatePortalSection("founder", "perspective", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="founder-tags">关键词</Label>
              <Textarea
                id="founder-tags"
                rows={3}
                value={joinLines(portalConfig.founder.tags)}
                onChange={(event) => updatePortalSection("founder", "tags", parseLines(event.target.value))}
                placeholder={"每行一条\n学习闭环\n数字机考"}
                disabled={loading}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <Globe className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">模块文案</h2>
                <p className="mt-1 text-sm text-slate-500">每个模块的标题、副标题、简介、阶段说明、按钮和标签都可以后台维护。</p>
              </div>
            </div>

            <div className="space-y-5">
              {portalConfig.features.map((feature) => (
                <div key={feature.key} className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 text-base font-semibold text-slate-900">{featureLabels[feature.key] ?? feature.key}</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${feature.key}-title`}>模块标题</Label>
                      <Input
                        id={`${feature.key}-title`}
                        value={feature.title}
                        onChange={(event) => updatePortalFeature(feature.key, "title", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${feature.key}-eyebrow`}>模块副标题</Label>
                      <Input
                        id={`${feature.key}-eyebrow`}
                        value={feature.eyebrow}
                        onChange={(event) => updatePortalFeature(feature.key, "eyebrow", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`${feature.key}-description`}>模块简介</Label>
                    <Textarea
                      id={`${feature.key}-description`}
                      rows={4}
                      value={feature.description}
                      onChange={(event) => updatePortalFeature(feature.key, "description", event.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-2">
                      <Label htmlFor={`${feature.key}-detail`}>阶段说明</Label>
                      <Textarea
                        id={`${feature.key}-detail`}
                        rows={3}
                        value={feature.detail}
                        onChange={(event) => updatePortalFeature(feature.key, "detail", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${feature.key}-action`}>按钮文案</Label>
                      <Input
                        id={`${feature.key}-action`}
                        value={feature.action}
                        onChange={(event) => updatePortalFeature(feature.key, "action", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`${feature.key}-tags`}>模块标签</Label>
                    <Textarea
                      id={`${feature.key}-tags`}
                      rows={3}
                      value={joinLines(feature.tags)}
                      onChange={(event) => updatePortalFeature(feature.key, "tags", parseLines(event.target.value))}
                      placeholder={"每行一条\n讲义联动\n倍速回听"}
                      disabled={loading}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex items-center gap-3">
              <Share2 className="size-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">页脚与协议文档</h2>
                <p className="mt-1 text-sm text-slate-500">门户底部介绍、版权声明和协议页内容在这里集中维护。</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer-description">页脚描述</Label>
              <Textarea
                id="footer-description"
                rows={4}
                value={portalConfig.footer.description}
                onChange={(event) => updatePortalSection("footer", "description", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer-copyright">版权说明</Label>
              <Textarea
                id="footer-copyright"
                rows={3}
                value={portalConfig.footer.copyright}
                onChange={(event) => updatePortalSection("footer", "copyright", event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-5">
              {portalConfig.footer.legalDocuments.map((item, index) => (
                <div key={item.slug + index} className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-2">
                      <Label htmlFor={`legal-title-${index}`}>协议名称</Label>
                      <Input
                        id={`legal-title-${index}`}
                        value={item.title}
                        onChange={(event) => updateLegalDocument(index, "title", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`legal-slug-${index}`}>路由标识</Label>
                      <Input
                        id={`legal-slug-${index}`}
                        value={item.slug}
                        onChange={(event) => updateLegalDocument(index, "slug", event.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`legal-content-${index}`}>正文内容</Label>
                    <Textarea
                      id={`legal-content-${index}`}
                      rows={8}
                      value={joinLines(item.content)}
                      onChange={(event) => updateLegalDocument(index, "content", parseParagraphs(event.target.value))}
                      placeholder={"每行一段\n第一段内容\n第二段内容"}
                      disabled={loading}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            <p>当前说明：</p>
            <p>1. 课程状态为“定时开放中”并达到开放时间后，系统会自动推送企业微信通知。</p>
            <p>2. 登录页客服按钮和门户页咨询按钮都会直接读取这里配置的客服链接。</p>
            <p>3. 门户首页的 SEO、分享图、创始人简介、模块文案、协议页与页脚内容都会直接读取这里的配置。</p>
            <p>4. 如果客服链接未配置，门户仍可展示电话和微信，但咨询按钮不会跳转。</p>
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
