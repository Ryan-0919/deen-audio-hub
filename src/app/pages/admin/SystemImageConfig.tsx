import { ImageIcon, PlayCircle, Trash2, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";
import { mockApi } from "../../lib/mockData";

type UploadTarget = "logo" | "player";

export function SystemImageConfig() {
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const playerInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<UploadTarget | "">("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandLogoObjectKey, setBrandLogoObjectKey] = useState("");
  const [playerDiscImageUrl, setPlayerDiscImageUrl] = useState("");
  const [playerDiscImageObjectKey, setPlayerDiscImageObjectKey] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await mockApi.getSystemConfig();
        setBrandLogoUrl(data.brandLogoUrl ?? "");
        setBrandLogoObjectKey(data.brandLogoObjectKey ?? "");
        setPlayerDiscImageUrl(data.playerDiscImageUrl ?? "");
        setPlayerDiscImageObjectKey(data.playerDiscImageObjectKey ?? "");
      } catch (error) {
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

      if (target === "logo") {
        setBrandLogoUrl(uploaded.url);
        setBrandLogoObjectKey(uploaded.objectKey);
        toast.success("Logo 上传成功");
      } else {
        setPlayerDiscImageUrl(uploaded.url);
        setPlayerDiscImageObjectKey(uploaded.objectKey);
        toast.success("播放器圆圈图片上传成功");
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

    setPlayerDiscImageUrl("");
    setPlayerDiscImageObjectKey("");
  };

  return (
    <div className="p-8">
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <h1 className="text-2xl font-semibold text-slate-900">系统图片配置</h1>
          <p className="mt-2 text-sm text-slate-500">当前支持配置导航 Logo 和播放器中间圆圈图片，保存后会同步到用户端展示。</p>
        </div>

        <div className="grid gap-8 px-8 py-8 xl:grid-cols-2">
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

        <div className="border-t border-slate-200 px-8 py-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
            <p className="font-medium text-slate-900">说明</p>
            <p className="mt-2">1. 图片上传后会先显示预览，点击“保存配置”后才会正式生效。</p>
            <p>2. 清空后保存，系统会恢复为默认展示样式。</p>
            <p>3. 当前支持 jpg、png、webp、gif、svg，单个文件不超过 5MB。</p>
            <p>4. 当前版本支持导航 Logo 和播放器圆圈图片，后续其他系统图片可继续在这里扩展。</p>
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
