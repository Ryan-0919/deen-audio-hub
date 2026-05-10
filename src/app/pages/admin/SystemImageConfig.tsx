import { ImageIcon, PlayCircle, Trash2, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createDefaultPortalConfig } from "../../../shared/portal-config.js";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";
import { type PortalConfig, mockApi } from "../../lib/mockData";

type UploadTarget = "logo" | "player" | "founder" | "homeBanner";

export function SystemImageConfig() {
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const homeBannerInputRef = useRef<HTMLInputElement | null>(null);
  const playerInputRef = useRef<HTMLInputElement | null>(null);
  const founderInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<UploadTarget | "">("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandLogoObjectKey, setBrandLogoObjectKey] = useState("");
  const [playerDiscImageUrl, setPlayerDiscImageUrl] = useState("");
  const [playerDiscImageObjectKey, setPlayerDiscImageObjectKey] = useState("");
  const [portalConfig, setPortalConfig] = useState<PortalConfig>(createDefaultPortalConfig());

  useEffect(() => {
    const load = async () => {
      try {
        const data = await mockApi.getSystemConfig();
        setBrandLogoUrl(data.brandLogoUrl ?? "");
        setBrandLogoObjectKey(data.brandLogoObjectKey ?? "");
        setPlayerDiscImageUrl(data.playerDiscImageUrl ?? "");
        setPlayerDiscImageObjectKey(data.playerDiscImageObjectKey ?? "");
        setPortalConfig(data.portalConfig ?? createDefaultPortalConfig());
      } catch {
        toast.error("加载系统图片配置失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>, target: UploadTarget) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingTarget(target);
    try {
      const uploaded = await mockApi.uploadSystemImage(file);

      if (target === "homeBanner") {
        setPortalConfig((current) => ({
          ...current,
          memberHome: {
            ...current.memberHome,
            bannerImageUrl: uploaded.readableUrl ?? uploaded.url,
            bannerImageObjectKey: uploaded.objectKey,
          },
        }));
        toast.success("站内首页 Banner 上传成功");
        return;
      }

      if (target === "logo") {
        setBrandLogoUrl(uploaded.url);
        setBrandLogoObjectKey(uploaded.objectKey);
        toast.success("Logo 上传成功");
      } else if (target === "player") {
        setPlayerDiscImageUrl(uploaded.url);
        setPlayerDiscImageObjectKey(uploaded.objectKey);
        toast.success("播放器圆圈图片上传成功");
      } else {
        setPortalConfig((current) => ({
          ...current,
          founder: {
            ...current.founder,
            imageUrl: uploaded.readableUrl ?? uploaded.url,
            imageObjectKey: uploaded.objectKey,
          },
        }));
        toast.success("创始人头像上传成功");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片上传失败");
    } finally {
      setUploadingTarget("");
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await mockApi.updateSystemConfig({
        brandLogoUrl,
        brandLogoObjectKey,
        playerDiscImageUrl,
        playerDiscImageObjectKey,
        portalConfig,
      });
      toast.success("系统图片配置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = (target: UploadTarget) => {
    if (target === "logo") {
      setBrandLogoUrl("");
      setBrandLogoObjectKey("");
      return;
    }

    if (target === "homeBanner") {
      setPortalConfig((current) => ({
        ...current,
        memberHome: {
          ...current.memberHome,
          bannerImageUrl: "",
          bannerImageObjectKey: "",
        },
      }));
      return;
    }

    if (target === "player") {
      setPlayerDiscImageUrl("");
      setPlayerDiscImageObjectKey("");
      return;
    }

    setPortalConfig((current) => ({
      ...current,
      founder: {
        ...current.founder,
        imageUrl: "",
        imageObjectKey: "",
      },
    }));
  };

  return (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <h1 className="text-2xl font-semibold text-slate-900">门户图片设置</h1>
          <p className="mt-2 text-sm text-slate-500">当前支持配置导航 Logo、播放器中间圆圈图片与门户创始人头像，保存后会同步到用户端展示。</p>
        </div>

        <div className="grid gap-8 px-8 py-8 xl:grid-cols-3">
          <div className="space-y-6 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div>
              <p className="text-base font-semibold text-slate-900">系统 Logo</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">用于登录页和“我的课程”左上角。建议上传透明底 PNG，推荐接近正方形，单个文件不超过 5MB。</p>
            </div>

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6">
              <div className="flex min-h-56 items-center justify-center rounded-2xl bg-slate-50 p-6">
                {brandLogoUrl ? (
                  <img src={brandLogoUrl} alt="系统 Logo" className="max-h-40 w-full object-contain" />
                ) : (
                  <div className="text-center text-slate-400">
                    <ImageIcon className="mx-auto size-10" />
                    <p className="mt-3 text-sm">暂无已配置 Logo</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-sm font-medium text-slate-900">导航栏效果预览</p>
              <div className="mt-4">
                <AppLogo logoUrlOverride={brandLogoUrl} />
              </div>
            </div>

            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleUpload(event, "logo")} />

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => logoInputRef.current?.click()} disabled={loading || uploadingTarget === "logo"}>
                <Upload className="mr-2 size-4" />
                {uploadingTarget === "logo" ? "上传中..." : "上传 Logo"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClear("logo")}
                disabled={loading || uploadingTarget === "logo" || (!brandLogoUrl && !brandLogoObjectKey)}
              >
                <Trash2 className="mr-2 size-4" />
                清空
              </Button>
            </div>
          </div>

          <div className="space-y-6 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div>
              <p className="text-base font-semibold text-slate-900">创始人头像</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">用于门户首页创始人区域。建议上传透明底 PNG，人物主体居中偏下，单个文件不超过 5MB。</p>
            </div>

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6">
              <div className="flex min-h-56 items-end justify-center rounded-2xl bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.12),transparent_42%),linear-gradient(180deg,#0f172a,#111827)] p-4">
                {portalConfig.founder.imageUrl ? (
                  <img src={portalConfig.founder.imageUrl} alt="创始人头像" className="max-h-52 w-auto object-contain object-bottom" />
                ) : (
                  <div className="pb-8 text-center text-slate-400">
                    <ImageIcon className="mx-auto size-10" />
                    <p className="mt-3 text-sm">暂无创始人头像</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-sm font-medium text-slate-900">门户卡片效果预览</p>
              <div className="mt-4 rounded-[24px] bg-[linear-gradient(180deg,#0e1b2d_0%,#09121d_100%)] p-3">
                <div className="rounded-[22px] bg-[linear-gradient(145deg,rgba(255,251,238,0.92)_0%,rgba(243,223,181,0.7)_12%,rgba(191,146,77,0.4)_26%,rgba(118,87,47,0.22)_42%,rgba(246,227,188,0.58)_56%,rgba(168,124,63,0.34)_76%,rgba(255,248,232,0.86)_100%)] p-[2px]">
                  <div className="flex h-52 items-end justify-center overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_top,rgba(126,213,255,0.12),transparent_38%),linear-gradient(180deg,rgba(12,24,40,0.98),rgba(7,14,24,1))] px-2 pt-2">
                    {portalConfig.founder.imageUrl ? (
                      <img src={portalConfig.founder.imageUrl} alt="创始人头像预览" className="h-full w-auto object-contain object-bottom" />
                    ) : (
                      <div className="pb-6 text-xs text-white/45">未配置头像</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <input ref={founderInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleUpload(event, "founder")} />

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => founderInputRef.current?.click()} disabled={loading || uploadingTarget === "founder"}>
                <Upload className="mr-2 size-4" />
                {uploadingTarget === "founder" ? "上传中..." : "上传创始人头像"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClear("founder")}
                disabled={loading || uploadingTarget === "founder" || (!portalConfig.founder.imageUrl && !portalConfig.founder.imageObjectKey)}
              >
                <Trash2 className="mr-2 size-4" />
                清空
              </Button>
            </div>
          </div>

          <div className="space-y-6 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div>
              <p className="text-base font-semibold text-slate-900">播放器圆圈图片</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                用于音频播放器中间圆圈区域。建议上传 1:1 正方形图片，推荐尺寸 1000 x 1000，单个文件不超过 5MB。
              </p>
            </div>

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6">
              <div className="flex min-h-56 items-center justify-center rounded-2xl bg-slate-50 p-6">
                {playerDiscImageUrl ? (
                  <div className="relative flex size-40 items-center justify-center overflow-hidden rounded-full border-4 border-blue-100 bg-white shadow-sm">
                    <img src={playerDiscImageUrl} alt="播放器圆圈图片" className="size-full object-cover" />
                    <div className="absolute inset-[18px] rounded-full border border-white/60" />
                    <div className="absolute flex size-8 items-center justify-center rounded-full bg-white/90 shadow-sm">
                      <div className="size-2.5 rounded-full bg-blue-600" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400">
                    <PlayCircle className="mx-auto size-10" />
                    <p className="mt-3 text-sm">暂无播放器圆圈图片</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-sm font-medium text-slate-900">播放器效果预览</p>
              <div className="mt-4 flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-blue-100 bg-white">
                  {playerDiscImageUrl ? (
                    <img src={playerDiscImageUrl} alt="圆圈预览" className="size-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-blue-50" />
                  )}
                  <div className="absolute inset-[14px] rounded-full border border-white/70" />
                  <div className="absolute flex size-5 items-center justify-center rounded-full bg-white/90">
                    <div className="size-1.5 rounded-full bg-blue-600" />
                  </div>
                </div>
                <div className="text-sm text-slate-500">
                  <p className="font-medium text-slate-900">播放时自动转动</p>
                  <p className="mt-1">未配置时，播放器会继续使用默认圆盘样式。</p>
                </div>
              </div>
            </div>

            <input
              ref={playerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleUpload(event, "player")}
            />

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => playerInputRef.current?.click()} disabled={loading || uploadingTarget === "player"}>
                <Upload className="mr-2 size-4" />
                {uploadingTarget === "player" ? "上传中..." : "上传播放器图片"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClear("player")}
                disabled={loading || uploadingTarget === "player" || (!playerDiscImageUrl && !playerDiscImageObjectKey)}
              >
                <Trash2 className="mr-2 size-4" />
                清空
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-8 py-8">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex flex-col gap-2">
              <p className="text-base font-semibold text-slate-900">站内首页 Banner</p>
              <p className="text-sm leading-7 text-slate-500">用于登录后的平台首页顶部大图。建议上传 16:9 横版图片，推荐尺寸 1920 x 1080。</p>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6">
                <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl bg-slate-50">
                  {portalConfig.memberHome.bannerImageUrl ? (
                    <img src={portalConfig.memberHome.bannerImageUrl} alt="站内首页 Banner" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <ImageIcon className="mx-auto size-10" />
                      <p className="mt-3 text-sm">暂无站内首页 Banner</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-sm font-medium text-slate-900">当前用途</p>
                  <p className="mt-2 text-sm leading-7 text-slate-500">该图片只用于站内首页 `/user/courses` 顶部，不会影响公开门户首页。</p>
                </div>

                <input ref={homeBannerInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleUpload(event, "homeBanner")} />

                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={() => homeBannerInputRef.current?.click()} disabled={loading || uploadingTarget === "homeBanner"}>
                    <Upload className="mr-2 size-4" />
                    {uploadingTarget === "homeBanner" ? "上传中..." : "上传首页 Banner"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleClear("homeBanner")}
                    disabled={loading || uploadingTarget === "homeBanner" || (!portalConfig.memberHome.bannerImageUrl && !portalConfig.memberHome.bannerImageObjectKey)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    清空
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-8 py-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
            <p className="font-medium text-slate-900">说明</p>
            <p className="mt-2">1. 图片上传后会先显示预览，点击“保存配置”后才会正式生效。</p>
            <p>2. 清空后保存，系统会恢复为默认展示样式。</p>
            <p>3. 当前支持 jpg、png、webp、gif、svg，单个文件不超过 5MB。</p>
            <p>4. 创始人头像建议使用透明底人物图，人物底部贴齐画面，更适合门户展示。</p>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={loading || saving || Boolean(uploadingTarget)}>
              {saving ? "保存中..." : "保存配置"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
