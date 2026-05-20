import { ClipboardCheck, ImageUp, KeyRound, LogOut, PencilLine, Sparkles, Trophy, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppLogo } from "../../components/branding/AppLogo";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../components/ui/utils";
import { type User, type UserHomeConfig, mockApi } from "../../lib/mockData";
import {
  clearUserSession,
  getUserAvatarUrl,
  getUserDeviceKey,
  getUserDisplayName,
  getUserId,
  updateUserProfileSession,
} from "../../lib/user-session";

type ShortcutItem = {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  iconClassName: string;
  glowClassName: string;
  accentText: string;
};

type SettingsDialogMode = "profile" | "password" | null;

const EMPTY_HOME_CONFIG: UserHomeConfig = {
  memberHome: {
    hero: {
      badge: "快捷入口",
      title: "欢迎使用得宝",
      description: "课程学习、机考训练、法条检索和打字练习统一收口，直接进入今天的学习节奏。",
    },
    bannerImageUrl: "",
    bannerImageObjectKey: "",
    announcement: {
      title: "学习公告",
      subtitle: "Announcement",
      badge: "最新",
      items: [],
    },
    operations: {
      title: "快捷入口",
      subtitle: "DE EN FA KAO",
      items: [],
    },
  },
  examHome: {
    eyebrow: "Mock Exam",
    title: "我的试卷",
    objectiveModeLabel: "客观题专场",
    subjectiveModeLabel: "主观题专场",
    objectiveEmptyText: "当前还没有可进入的客观题试卷，请先在后台发布试卷。",
    subjectiveEmptyText: "当前还没有可进入的主观题试卷，请先在后台发布试卷。",
  },
  accountCenter: {
    eyebrow: "Account Center",
    description: "这里统一放课程学习外的个人操作入口。你可以查看考试记录、考试排行榜，也可以随时安全退出当前设备。",
    shortcutTitle: "DE EN FA KAO",
    shortcuts: [
      {
        title: "我的考试",
        description: "查看你参加过的考试记录与结果。",
        path: "/user/my-exams",
        accentText: "进入考试记录",
      },
      {
        title: "考试排行榜",
        description: "按试卷查看你已考过的考试排行榜。",
        path: "/user/exam-leaderboard",
        accentText: "进入排行榜",
      },
    ],
  },
};

const fallbackShortcutItems: ShortcutItem[] = [
  {
    title: "我的考试",
    description: "查看你参加过的考试记录与结果。",
    path: "/user/my-exams",
    icon: ClipboardCheck,
    iconClassName: "text-[#8fd6ff]",
    glowClassName: "from-[#38a6ff]/28 via-[#1f6fff]/16 to-transparent",
    accentText: "进入考试记录",
  },
  {
    title: "考试排行榜",
    description: "按试卷查看你已考过的考试排行榜。",
    path: "/user/exam-leaderboard",
    icon: Trophy,
    iconClassName: "text-[#ffd39a]",
    glowClassName: "from-[#ffca57]/28 via-[#d68616]/16 to-transparent",
    accentText: "进入排行榜",
  },
];

const getDisplayInitial = (name: string) => {
  const normalized = `${name ?? ""}`.trim();
  return normalized ? normalized.slice(0, 1).toUpperCase() : "U";
};

export function UserMe() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [homeConfig, setHomeConfig] = useState<UserHomeConfig>(EMPTY_HOME_CONFIG);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [dialogMode, setDialogMode] = useState<SettingsDialogMode>(null);
  const [nickname, setNickname] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const displayName = currentUser?.displayName || getUserDisplayName() || "已登录用户";
  const avatarUrl = currentUser?.avatarUrl || getUserAvatarUrl() || "";
  const deviceKey = getUserDeviceKey();

  useEffect(() => {
    void mockApi
      .getUserHomeConfig()
      .then((config) => setHomeConfig(config))
      .catch(() => setHomeConfig(EMPTY_HOME_CONFIG));

    void mockApi
      .getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        updateUserProfileSession({
          displayName: user.displayName || user.nickname || "",
          avatarUrl: user.avatarUrl || "",
        });
        setNickname(user.nickname || user.displayName || "");
      })
      .catch(() => undefined);
  }, []);

  const shortcutItems = useMemo(() => {
    const sourceItems =
      homeConfig.accountCenter.shortcuts.length > 0 ? homeConfig.accountCenter.shortcuts : EMPTY_HOME_CONFIG.accountCenter.shortcuts;
    const nextItems = sourceItems.filter((item) => item.path !== "/user/book-question-banks");
    const ensuredItems = nextItems.some((item) => item.path === "/user/exam-leaderboard")
      ? nextItems
      : [...nextItems, EMPTY_HOME_CONFIG.accountCenter.shortcuts[1]];

    return ensuredItems.map((item, index) => ({
      title: item.title,
      description: item.description,
      path: item.path,
      accentText: item.accentText,
      icon: fallbackShortcutItems[index]?.icon ?? ClipboardCheck,
      iconClassName: fallbackShortcutItems[index]?.iconClassName ?? "text-[#8fd6ff]",
      glowClassName: fallbackShortcutItems[index]?.glowClassName ?? "from-[#38a6ff]/28 via-[#1f6fff]/16 to-transparent",
    }));
  }, [homeConfig.accountCenter.shortcuts]);

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    const userId = getUserId();

    try {
      setLoggingOut(true);
      if (userId) {
        await mockApi.logout(userId, deviceKey || undefined);
      }
    } catch {
      // Ignore logout request failures and always clear local session.
    } finally {
      clearUserSession();
      navigate("/");
    }
  };

  const handleProfileSave = async () => {
    const nextNickname = nickname.trim();
    if (!nextNickname) {
      toast.error("昵称不能为空");
      return;
    }

    try {
      setSavingProfile(true);
      const updated = await mockApi.updateCurrentUserProfile({ nickname: nextNickname });
      setCurrentUser(updated);
      updateUserProfileSession({
        displayName: updated.displayName || updated.nickname || "",
        avatarUrl: updated.avatarUrl || "",
      });
      setNickname(updated.nickname || updated.displayName || "");
      toast.success("昵称已更新");
      setDialogMode(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "昵称更新失败");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error("请填写完整的密码信息");
      return;
    }

    try {
      setSavingPassword(true);
      await mockApi.updateCurrentUserPassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
        confirmPassword: confirmPassword.trim(),
      });
      toast.success("密码已修改");
      resetPasswordForm();
      setDialogMode(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "密码修改失败");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarUpload = async (file?: File) => {
    if (!file) return;

    try {
      setUploadingAvatar(true);
      const result = await mockApi.uploadCurrentUserAvatar(file);
      setCurrentUser(result.user);
      updateUserProfileSession({
        displayName: result.user.displayName || result.user.nickname || "",
        avatarUrl: result.user.avatarUrl || "",
      });
      toast.success("头像已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "头像上传失败");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040816] pb-24 text-white selection:bg-[#dff8ff] selection:text-[#061120]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,166,255,0.18),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(120,255,235,0.12),transparent_18%),linear-gradient(180deg,#07111d_0%,#040816_48%,#0a1629_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[320px] h-[420px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-3xl" />

      <div className="relative mx-auto max-w-[1320px] px-4 pb-10 pt-4 md:px-8 md:pt-8 xl:px-10">
        <div className="mb-5 flex items-center justify-between md:hidden">
          <AppLogo compact className="text-white" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="rounded-full border border-white/10 bg-white/[0.05] px-3 text-white hover:bg-white/[0.10] hover:text-white"
          >
            <LogOut className="size-4" />
            {loggingOut ? "退出中..." : "退出"}
          </Button>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="space-y-5">
            <div className="space-y-5">
              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[30px] md:p-6">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/38">
                  <Sparkles className="size-3.5 text-[#8fd6ff]" />
                  {homeConfig.accountCenter.eyebrow || "Account Center"}
                </div>

                <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="relative">
                    <Avatar className="size-16 rounded-[24px] border border-white/10 bg-white/[0.06] shadow-[0_18px_50px_rgba(0,0,0,0.2)] md:size-20 md:rounded-[28px]">
                      <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
                      <AvatarFallback className="bg-white/[0.08] text-white">
                        <UserRound className="size-9 md:size-10" />
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full border border-white/15 bg-[#0d1d31] text-[#8fd6ff] shadow-[0_18px_32px_rgba(0,0,0,0.28)] transition hover:bg-[#122641] hover:text-white disabled:opacity-60"
                    >
                      <ImageUp className="size-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => void handleAvatarUpload(event.target.files?.[0])}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="truncate text-[24px] font-semibold tracking-[-0.05em] text-white md:text-[36px]">{displayName}</h1>
                      <Badge className="rounded-full border-0 bg-emerald-400/14 text-emerald-200 shadow-none">已登录</Badge>
                    </div>

                    <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58 md:text-[15px]">
                      {homeConfig.accountCenter.description || "这里统一放课程学习外的个人操作入口。你可以查看考试记录、考试排行榜，也可以随时安全退出当前设备。"}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={() => setDialogMode("profile")}
                        className="rounded-2xl bg-white text-slate-950 hover:bg-white/92"
                      >
                        <PencilLine className="size-4" />
                        修改昵称
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          resetPasswordForm();
                          setDialogMode("password");
                        }}
                        className="rounded-2xl border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.10] hover:text-white"
                      >
                        <KeyRound className="size-4" />
                        修改密码
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.20)] backdrop-blur-[20px] md:rounded-[28px] md:p-5">
                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/36">{homeConfig.accountCenter.shortcutTitle || "DE EN FA KAO"}</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {shortcutItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <motion.button
                        key={item.path}
                        type="button"
                        onClick={() => navigate(item.path)}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.08 + index * 0.05 }}
                        className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-black/16 p-4 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/18 hover:bg-black/20"
                      >
                        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", item.glowClassName)} />
                        <div className="relative z-10 flex h-full flex-col">
                          <div className="flex size-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.06]">
                            <Icon className={cn("size-5", item.iconClassName)} />
                          </div>
                          <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.04em] text-white md:text-[20px]">{item.title}</h3>
                          <p className="mt-2 text-[13px] leading-6 text-white/58">{item.description}</p>
                          <div className={cn("mt-auto pt-4 text-[13px] font-medium", item.iconClassName)}>{item.accentText}</div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                className="hidden h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-6 text-white hover:bg-white/[0.10] hover:text-white md:inline-flex"
              >
                <LogOut className="mr-2 size-4" />
                {loggingOut ? "退出中..." : "退出登录"}
              </Button>
            </div>
          </div>
        </motion.section>
      </div>

      <Dialog open={dialogMode === "profile"} onOpenChange={(open) => setDialogMode(open ? "profile" : null)}>
        <DialogContent className="border-white/10 bg-[#08111d] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修改昵称</DialogTitle>
            <DialogDescription className="text-white/55">昵称会同步显示在用户端顶部和个人中心。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nickname" className="text-white/76">
              昵称
            </Label>
            <Input
              id="nickname"
              value={nickname}
              maxLength={20}
              onChange={(event) => setNickname(event.target.value)}
              className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/28"
              placeholder="请输入昵称"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogMode(null)} className="border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.10] hover:text-white">
              取消
            </Button>
            <Button type="button" onClick={() => void handleProfileSave()} disabled={savingProfile} className="bg-white text-slate-950 hover:bg-white/92">
              {savingProfile ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "password"} onOpenChange={(open) => setDialogMode(open ? "password" : null)}>
        <DialogContent className="border-white/10 bg-[#08111d] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription className="text-white/55">请输入原密码，并设置新的登录密码。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-white/76">
                原密码
              </Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/28"
                placeholder="请输入原密码"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-white/76">
                新密码
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/28"
                placeholder="请输入新密码"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-white/76">
                确认新密码
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/28"
                placeholder="请再次输入新密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogMode(null)} className="border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.10] hover:text-white">
              取消
            </Button>
            <Button type="button" onClick={() => void handlePasswordSave()} disabled={savingPassword} className="bg-white text-slate-950 hover:bg-white/92">
              {savingPassword ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
