import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  ExternalLink,
  FilePenLine,
  Headphones,
  Keyboard,
  Menu,
  MessageCircleMore,
  Phone,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { createDefaultPortalConfig } from "../../../shared/portal-config.js";
import { buildPublicSiteUrl } from "../../../shared/site-config.js";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import { type BrandingConfig, type PortalFeatureConfig, mockApi } from "../../lib/mockData";
import { getUserToken } from "../../lib/user-session";

const DEFAULT_PORTAL_CONFIG = createDefaultPortalConfig();

const featureVisuals: Record<
  string,
  {
    icon: LucideIcon;
    path: string;
    gradient: string;
    aura: string;
    metrics: Array<{ value: string; label: string }>;
    preview: string[];
  }
> = {
  audio: {
    icon: Headphones,
    path: "/user/courses",
    gradient: "from-[#38a6ff] via-[#1f6fff] to-[#5ed4ff]",
    aura: "bg-[#2d8fff]/30",
    metrics: [
      { value: "课程主页", label: "统一管理" },
      { value: "重点回听", label: "快速定位" },
      { value: "碎片学习", label: "高频触达" },
    ],
    preview: ["今日听课计划", "重点段落回放", "讲义定位同步"],
  },
  exam: {
    icon: FilePenLine,
    path: "/user/mock-exams",
    gradient: "from-[#37d2c1] via-[#14828a] to-[#74e9d8]",
    aura: "bg-[#22b7a5]/30",
    metrics: [
      { value: "客观题", label: "按卷训练" },
      { value: "主观题", label: "法条联动" },
      { value: "考试节奏", label: "接近实战" },
    ],
    preview: ["进入考试流程", "答题区与题号区", "交卷后成绩总览"],
  },
  laws: {
    icon: Scale,
    path: "/user/laws",
    gradient: "from-[#8e67ff] via-[#5547c9] to-[#c39cff]",
    aura: "bg-[#8462ff]/28",
    metrics: [
      { value: "法条窗口", label: "可放大全屏" },
      { value: "检索路径", label: "贴近实战" },
      { value: "主观题", label: "同步调用" },
    ],
    preview: ["检索词输入", "条文定位结果", "主观题联动查看"],
  },
  typing: {
    icon: Keyboard,
    path: "/user/typing-practice",
    gradient: "from-[#ffca57] via-[#d68616] to-[#ff9f43]",
    aura: "bg-[#f0a11b]/28",
    metrics: [
      { value: "速度训练", label: "字/分钟" },
      { value: "正确率", label: "实时反馈" },
      { value: "后台配置", label: "难度可控" },
    ],
    preview: ["原文逐字输入", "错误即时提示", "速度统计复盘"],
  },
};

type DisplayPortalFeature = PortalFeatureConfig & {
  icon: LucideIcon;
  path: string;
  gradient: string;
  aura: string;
  metrics: Array<{ value: string; label: string }>;
  preview: string[];
};

const heroStats = [
  { value: "4 大模块", label: "课程 / 机考 / 法条 / 打字" },
  { value: "门户 + 站内", label: "对外展示与学习使用完全分层" },
  { value: "PC / Mobile", label: "电脑学习、手机触达都保留入口" },
];

const floatingFeatureBadges = [
  { label: "机考流程", key: "exam", className: "-left-4 top-8 md:-left-10 md:top-12" },
  { label: "法条检索", key: "laws", className: "right-0 top-0 md:-right-8 md:top-10" },
  { label: "打字练习", key: "typing", className: "left-10 bottom-2 md:left-24 md:bottom-10" },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setMetaContent(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setCanonical(href: string) {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
}

function toAbsoluteUrl(value: string) {
  try {
    return new URL(value || "/portal/founder-avatar.png", buildPublicSiteUrl("/")).toString();
  } catch {
    return value;
  }
}

function buildPortalFeatures(features: PortalFeatureConfig[]) {
  return features.flatMap<DisplayPortalFeature>((feature) => {
    const visual = featureVisuals[feature.key];
    if (!visual) return [];
    return [{ ...feature, ...visual }];
  });
}

export function PortalHome() {
  const navigate = useNavigate();
  const hasToken = Boolean(getUserToken());
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig | null>(null);
  const [portalConfig, setPortalConfig] = useState(DEFAULT_PORTAL_CONFIG);
  const [activeFeatureKey, setActiveFeatureKey] = useState(DEFAULT_PORTAL_CONFIG.features[0]?.key ?? "audio");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const headerLinks = portalConfig.navigation.links;
  const features = buildPortalFeatures(portalConfig.features);
  const activeFeature = features.find((item) => item.key === activeFeatureKey) ?? features[0];
  const contactUrl = `${portalConfig.contact.url ?? brandingConfig?.customerServiceUrl ?? ""}`.trim();
  const brandName = portalConfig.seo.title.split("|")[0]?.trim() || "得恩法考";
  const authEntryLabel = hasToken ? portalConfig.actions.authLoggedInLabel : portalConfig.actions.authLoggedOutLabel;
  const authEntryShortLabel = hasToken ? portalConfig.actions.authLoggedInShortLabel : portalConfig.actions.authLoggedOutLabel;
  const journeyCards = portalConfig.journey.cards;
  const experienceCards = portalConfig.experience.cards;
  const startOptions = portalConfig.startOptions.items;
  const contactSteps = portalConfig.contact.steps;
  const legalDocuments = portalConfig.footer.legalDocuments;
  const productsLabel = headerLinks[0]?.label ?? "核心模块";
  const activeFeatureIndex = features.findIndex((item) => item.key === activeFeature.key);
  const startPanelTitle = hasToken ? portalConfig.startPanel.loggedInTitle : portalConfig.startPanel.loggedOutTitle;
  const portalDisplayTitle = `${brandName}学习门户`;
  const [experienceTitleLead, ...experienceTitleRest] = portalConfig.experience.title.split("，");
  const experienceTitleAccent = experienceTitleRest.join("，");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await mockApi.getBrandingConfig();
        if (!active) return;
        setBrandingConfig(data);
        setPortalConfig(data.portalConfig ?? DEFAULT_PORTAL_CONFIG);
      } catch {
        if (!active) return;
        setBrandingConfig(null);
        setPortalConfig(DEFAULT_PORTAL_CONFIG);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!features.some((item) => item.key === activeFeatureKey)) {
      setActiveFeatureKey(features[0]?.key ?? "audio");
    }
  }, [activeFeatureKey, features]);

  useEffect(() => {
    if (features.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveFeatureKey((current) => {
        const currentIndex = features.findIndex((item) => item.key === current);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % features.length : 0;
        return features[nextIndex]?.key ?? features[0]?.key ?? "audio";
      });
    }, 4800);
    return () => window.clearInterval(timer);
  }, [features]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const seo = portalConfig.seo;
    const ogImageUrl = toAbsoluteUrl(seo.ogImageUrl);
    const canonicalUrl = buildPublicSiteUrl("/");
    document.title = seo.title;
    document.documentElement.lang = "zh-CN";
    setMetaContent("name", "description", seo.description);
    setMetaContent("name", "keywords", seo.keywords);
    setMetaContent("name", "theme-color", "#07111d");
    setMetaContent("property", "og:type", "website");
    setMetaContent("property", "og:locale", "zh_CN");
    setMetaContent("property", "og:site_name", brandName);
    setMetaContent("property", "og:title", seo.title);
    setMetaContent("property", "og:description", seo.description);
    setMetaContent("property", "og:image", ogImageUrl);
    setMetaContent("property", "og:url", canonicalUrl);
    setMetaContent("name", "twitter:card", "summary_large_image");
    setMetaContent("name", "twitter:title", seo.title);
    setMetaContent("name", "twitter:description", seo.description);
    setMetaContent("name", "twitter:image", ogImageUrl);
    setCanonical(canonicalUrl);
  }, [brandName, portalConfig.seo]);

  const openContact = () => {
    if (!contactUrl) return;
    window.open(contactUrl, "_blank", "noopener,noreferrer");
  };

  const goFeature = (path: string) => {
    navigate(hasToken ? path : "/login");
  };

  return (
    <div className="min-h-screen bg-[#050915] text-white">
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#050915_0%,#07101f_16%,#0b1531_34%,#10182d_54%,#14233b_74%,#18263a_100%)]" />
        <motion.div
          aria-hidden="true"
          className="absolute -left-24 -top-12 h-[30rem] w-[30rem] rounded-full bg-[#2b8dff]/28 blur-[130px]"
          animate={{ x: [0, 26, 0], y: [0, 18, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute right-[-8rem] top-20 h-[26rem] w-[26rem] rounded-full bg-[#8f5cff]/22 blur-[120px]"
          animate={{ x: [0, -18, 0], y: [0, 28, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute left-[30%] top-[16rem] h-[22rem] w-[22rem] rounded-full bg-[#1dc7b8]/16 blur-[120px]"
          animate={{ x: [0, 18, 0], y: [0, -16, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(113,181,255,0.34),transparent_24%),radial-gradient(circle_at_82%_10%,rgba(152,111,255,0.24),transparent_22%),radial-gradient(circle_at_52%_28%,rgba(112,250,226,0.14),transparent_20%),radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1),transparent_32%)]" />
        <motion.div
          aria-hidden="true"
          className="absolute left-1/2 top-[56vh] h-[28rem] w-[92rem] -translate-x-1/2 rounded-full bg-white/18 blur-[150px] mix-blend-screen"
          animate={{ opacity: [0.14, 0.28, 0.18], scale: [0.92, 1.02, 0.96] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-x-[-8%] bottom-[-10rem] h-[26rem] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.34)_0%,rgba(255,255,255,0.16)_24%,rgba(255,255,255,0.07)_46%,transparent_72%)] blur-3xl mix-blend-screen" />
        <div className="absolute inset-x-0 bottom-0 h-[42vh] bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.02)_24%,rgba(255,255,255,0.08)_64%,rgba(255,255,255,0.14)_100%)]" />
      </div>

      <div className="relative">
        <header className="sticky top-0 z-50 border-b border-white/8 bg-[linear-gradient(180deg,rgba(6,12,24,0.84),rgba(7,14,27,0.6))] backdrop-blur-2xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-20 md:px-6 xl:px-8">
            <AppLogo className="[&_p:first-of-type]:text-white [&_p:last-of-type]:text-white/45" logoUrlOverride={brandingConfig?.brandLogoUrl ?? ""} />
            <nav className="hidden items-center gap-8 text-sm text-white/62 md:flex">
              {headerLinks.map((item) => (
                <a key={item.href} href={item.href} className="transition hover:text-white">
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              {contactUrl ? (
                <Button type="button" variant="outline" className="hidden rounded-full border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] text-white shadow-[0_14px_34px_rgba(0,0,0,0.12)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))] lg:inline-flex" onClick={openContact}>
                  {portalConfig.contact.buttonLabel}
                </Button>
              ) : null}
              <Button type="button" className="rounded-full bg-white text-slate-950 shadow-[0_18px_40px_rgba(255,255,255,0.12)] hover:bg-slate-100" onClick={() => navigate(hasToken ? "/user/courses" : "/login")}>
                {authEntryLabel}
              </Button>
              <button type="button" className="flex size-10 items-center justify-center rounded-full border border-white/12 bg-white/6 md:hidden" onClick={() => setMobileMenuOpen((current) => !current)}>
                {mobileMenuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
              </button>
            </div>
          </div>
          {mobileMenuOpen ? (
            <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(8,16,30,0.96),rgba(9,18,33,0.92))] px-4 py-4 md:hidden">
              <div className="space-y-2">
                {headerLinks.map((item) => (
                  <button key={item.href} type="button" className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left text-sm" onClick={() => { setMobileMenuOpen(false); scrollToId(item.href.replace("#", "")); }}>
                    {item.label}
                    <ArrowRight className="size-4 text-white/38" />
                  </button>
                ))}
                {contactUrl ? (
                  <Button type="button" variant="outline" className="mt-2 w-full rounded-full border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={openContact}>
                    {portalConfig.contact.buttonLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </header>

        <main>
          <section className="relative overflow-hidden px-4 pb-14 pt-8 md:px-6 md:pb-24 md:pt-14 xl:px-8">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.34),transparent)]" />
              <div className="absolute inset-x-[4%] top-5 h-28 rounded-full bg-white/8 blur-3xl" />
              <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:110px_110px] [mask-image:linear-gradient(180deg,rgba(0,0,0,1),rgba(0,0,0,0.5),transparent)]" />
              <div className="absolute left-[6%] top-20 h-44 w-44 rounded-full bg-[#86d7ff]/12 blur-[100px]" />
              <div className="absolute right-[18%] top-16 h-36 w-36 rounded-full bg-[#9878ff]/12 blur-[88px]" />
            </div>
            <div className="mx-auto grid max-w-7xl gap-6 md:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:items-center">
              <div className="relative z-10">
                <div className="pointer-events-none absolute -left-12 top-10 h-64 w-64 rounded-full bg-[#2c8dff]/10 blur-[110px]" />
                <div className="pointer-events-none absolute left-12 top-32 h-32 w-32 rounded-full border border-white/8 opacity-60" />
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, ease: "easeOut" }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))] px-4 py-2 text-xs font-medium text-white/78 shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl"
                >
                <Sparkles className="size-3.5 text-[#7ed5ff]" />
                {portalConfig.hero.badge}
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.72, delay: 0.05, ease: "easeOut" }}
                  className="mt-5 max-w-4xl text-[30px] font-semibold leading-[1.02] tracking-[-0.05em] text-white md:mt-6 md:text-[64px] md:leading-[0.98] md:tracking-[-0.07em] xl:text-[78px]"
                >
                {portalConfig.hero.title}
                <span className="block bg-[linear-gradient(90deg,#ffffff_0%,#9ed7ff_38%,#9ef7de_100%)] bg-clip-text text-transparent">{portalConfig.hero.highlight}</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.72, delay: 0.12, ease: "easeOut" }}
                  className="mt-5 max-w-2xl text-[15px] leading-7 text-white/66 md:mt-6 md:text-lg md:leading-8"
                >
                  {portalConfig.hero.description}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.72, delay: 0.2, ease: "easeOut" }}
                  className="mt-8 flex flex-col gap-3 sm:flex-row"
                >
                  <Button type="button" className="h-12 w-full rounded-full bg-white px-6 text-base text-slate-950 hover:bg-slate-100 sm:w-auto" onClick={() => navigate(hasToken ? "/user/courses" : "/login")}>
                  {authEntryLabel}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
                  <Button type="button" variant="outline" className="h-12 w-full rounded-full border-white/14 bg-white/6 px-6 text-base text-white hover:bg-white/10 sm:w-auto" onClick={() => scrollToId("products")}>
                  {portalConfig.actions.browseModulesLabel}
                </Button>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.72, delay: 0.24, ease: "easeOut" }}
                  className="mt-5 flex flex-wrap gap-2"
                >
                  {portalConfig.hero.quickTags.map((item, index) => (
                    <div key={item} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.14))] px-3.5 py-1.5 text-xs text-white/66 shadow-[0_16px_32px_rgba(0,0,0,0.14)] backdrop-blur-xl">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          index === 0 ? "bg-[#8fd6ff]" : index === 1 ? "bg-[#8ff1df]" : "bg-[#b69bff]",
                        )}
                      />
                      {item}
                    </div>
                  ))}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.72, delay: 0.28, ease: "easeOut" }}
                  className="mt-8 grid gap-3 sm:grid-cols-3 md:mt-10"
                >
                  {heroStats.map((item, index) => (
                    <div key={item.value} className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] px-4 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl md:rounded-[26px] md:px-5 md:py-5">
                      <div className={cn("absolute inset-x-0 top-0 h-px", index === 0 ? "bg-[linear-gradient(90deg,transparent,#89d5ff,transparent)]" : index === 1 ? "bg-[linear-gradient(90deg,transparent,#9d8cff,transparent)]" : "bg-[linear-gradient(90deg,transparent,#8ff0df,transparent)]")} />
                      <div className={cn("absolute -right-8 top-[-2rem] h-20 w-20 rounded-full blur-2xl transition duration-500 group-hover:scale-110", index === 0 ? "bg-[#3c94ff]/18" : index === 1 ? "bg-[#7c68ff]/16" : "bg-[#28c7b5]/16")} />
                      <div className="relative">
                        <div className="text-[11px] tracking-[0.26em] text-white/34">{`0${index + 1}`}</div>
                        <div className="mt-3 text-[18px] font-semibold tracking-[-0.04em] text-white md:text-[22px] md:tracking-[-0.05em]">{item.value}</div>
                        <div className="mt-2 text-sm leading-6 text-white/56">{item.label}</div>
                      </div>
                    </div>
                  ))}
                </motion.div>

                {contactUrl || portalConfig.contact.phone || portalConfig.contact.wechat ? (
                  <div className="mt-6 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.2)] backdrop-blur-xl md:rounded-[28px]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-white/42">{portalConfig.contact.badge}</div>
                        <div className="mt-2 text-lg font-semibold text-white">{portalConfig.contact.buttonLabel}</div>
                        <div className="mt-2 text-sm leading-7 text-white/56">{portalConfig.contact.description}</div>
                      </div>
                      {contactUrl ? (
                        <Button type="button" className="h-11 w-full rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100 sm:w-auto" onClick={openContact}>
                          {portalConfig.actions.consultNowLabel}
                          <ExternalLink className="ml-2 size-4" />
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {portalConfig.contact.phone ? <span className="rounded-full border border-white/10 bg-black/16 px-3 py-1 text-xs text-white/68">电话：{portalConfig.contact.phone}</span> : null}
                      {portalConfig.contact.wechat ? <span className="rounded-full border border-white/10 bg-black/16 px-3 py-1 text-xs text-white/68">微信：{portalConfig.contact.wechat}</span> : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, delay: 0.12, ease: "easeOut" }}
                className="relative mx-auto w-full max-w-[520px] lg:mr-0"
              >
                <motion.div
                  aria-hidden="true"
                  className="absolute -left-8 top-16 hidden h-28 w-28 rounded-full border border-white/10 md:block"
                  animate={{ rotate: [0, 8, 0], y: [0, -12, 0] }}
                  transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  aria-hidden="true"
                  className="absolute bottom-8 right-10 hidden h-24 w-24 rounded-full border border-white/8 md:block"
                  animate={{ rotate: [0, -10, 0], y: [0, 10, 0] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />
                {floatingFeatureBadges.map((item, index) => (
                  <motion.button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveFeatureKey(item.key)}
                    className={cn(
                      "absolute z-10 hidden rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] px-3.5 py-1.5 text-xs text-white/74 shadow-[0_16px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl md:block",
                      item.className,
                    )}
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 5 + index, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {item.label}
                  </motion.button>
                ))}
                <div className="absolute inset-[10%] hidden rounded-full border border-white/10 md:block" />
                <div className="absolute inset-[18%] hidden rounded-full border border-white/8 md:block" />
                <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))] p-3 shadow-[0_36px_120px_rgba(0,0,0,0.32)] backdrop-blur-2xl md:rounded-[38px] md:p-5">
                  <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.1),rgba(255,255,255,0.02))]" />
                  <div className="absolute inset-x-10 top-4 h-12 rounded-full bg-white/10 blur-2xl" />
                  <div className={cn("absolute -right-12 top-16 h-44 w-44 rounded-full blur-3xl", activeFeature.aura)} />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">Portal View</div>
                        <div className="mt-2 text-lg font-semibold tracking-[-0.04em] text-white md:text-[22px]">{portalDisplayTitle}</div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-white/54">
                        <span className="size-2 rounded-full bg-emerald-400" />
                        实时切换预览
                      </div>
                    </div>
                    <div className="-mx-1 mt-4 overflow-x-auto px-1">
                      <div className="flex min-w-max gap-2">
                        {features.map((item) => {
                          const isActive = item.key === activeFeature.key;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onMouseEnter={() => setActiveFeatureKey(item.key)}
                              onFocus={() => setActiveFeatureKey(item.key)}
                              onClick={() => setActiveFeatureKey(item.key)}
                              className={cn(
                                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition",
                                isActive
                                  ? "border-white/18 bg-white/12 text-white"
                                  : "border-white/8 bg-black/16 text-white/58 hover:border-white/12 hover:bg-white/8 hover:text-white",
                              )}
                            >
                              {item.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.04fr)_minmax(220px,0.96fr)]">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeFeature.key}
                          initial={{ opacity: 0, y: 18, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -12, scale: 0.985 }}
                          transition={{ duration: 0.32, ease: "easeOut" }}
                          className={cn("overflow-hidden rounded-[20px] bg-gradient-to-br p-[1px] md:rounded-[24px]", activeFeature.gradient)}
                        >
                          <div className="h-full rounded-[19px] bg-[linear-gradient(180deg,rgba(7,17,29,0.82),rgba(10,20,36,0.96))] p-4 md:rounded-[23px] md:p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-xs tracking-[0.24em] text-white/52">{activeFeature.eyebrow}</div>
                                <div className="mt-2.5 text-[20px] font-semibold tracking-[-0.04em] text-white md:text-[24px] md:tracking-[-0.05em]">{activeFeature.title}</div>
                                <p className="mt-3 max-w-md text-sm leading-6.5 text-white/70 md:text-[14px]">{activeFeature.description}</p>
                              </div>
                              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/10 text-white">
                                <activeFeature.icon className="size-5" />
                              </div>
                            </div>
                            <div className="mt-5 rounded-[22px] border border-white/10 bg-black/18 p-3.5 md:p-4">
                              <div className="text-xs tracking-[0.2em] text-white/42">当前界面重点</div>
                              <div className="mt-3.5 grid gap-2.5">
                                {activeFeature.preview.map((item, index) => (
                                  <div key={item} className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/6 px-3.5 py-2.5">
                                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white/78">
                                      {`0${index + 1}`}
                                    </div>
                                    <div className="text-sm text-white/76">{item}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="mt-5 flex flex-wrap gap-2">
                              {activeFeature.tags.map((item) => (
                                <span key={item} className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] text-white/70">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                      <div className="grid gap-4">
                        <div className="rounded-[24px] border border-white/10 bg-black/18 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs tracking-[0.2em] text-white/46">当前模块</div>
                            <div className="mt-2 text-base font-semibold text-white">{activeFeature.title}</div>
                          </div>
                            <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] text-white/60">{`0${activeFeatureIndex + 1} / 05`}</div>
                          </div>
                          <p className="mt-3.5 text-sm leading-6.5 text-white/62">{activeFeature.detail}</p>
                          <div className="mt-4 space-y-2.5">
                            {activeFeature.metrics.map((item) => (
                              <div key={item.value} className="flex items-center justify-between gap-4 rounded-[16px] border border-white/10 bg-white/6 px-3.5 py-2.5">
                                <div className="text-sm font-medium text-white">{item.value}</div>
                                <div className="text-[11px] tracking-[0.14em] text-white/46">{item.label}</div>
                              </div>
                            ))}
                          </div>
                          <Button type="button" className="mt-4 h-10 w-full rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100" onClick={() => goFeature(activeFeature.path)}>
                            {activeFeature.action}
                            <ArrowRight className="ml-2 size-4" />
                          </Button>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                          <div className="text-xs tracking-[0.2em] text-white/46">推荐路径</div>
                          <div className="mt-3.5 space-y-2.5">
                            {journeyCards.map((item) => (
                              <div key={item.step} className="rounded-[18px] border border-white/10 bg-black/14 px-3.5 py-3.5">
                                <div className="text-[11px] tracking-[0.18em] text-white/42">{item.step}</div>
                                <div className="mt-1.5 text-sm font-medium text-white">{item.title}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          <section id="products" className="relative px-4 py-16 md:px-6 md:py-20 xl:px-8">
            <div className="pointer-events-none absolute inset-x-0 top-6 h-24 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_68%)] blur-3xl" />
            <div className="mx-auto max-w-7xl">
              <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55, ease: "easeOut" }} className="max-w-3xl">
                <div className="text-sm font-medium tracking-[0.22em] text-[#7dbfff]">产品矩阵</div>
                <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.05em] text-white md:text-[48px]">{portalConfig.products.title}</h2>
                <p className="mt-4 text-[15px] leading-7 text-white/58 md:text-base md:leading-8">课程、机考、法条检索与打字练习不再只是平铺罗列的功能点，而是围绕备考节奏展开的完整工作区。用户能先看懂结构，再顺着入口直接进入下一步动作。</p>
              </motion.div>
              <div className="mt-8 grid gap-4 md:mt-10 md:gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
                <div className="grid gap-3">
                  {features.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = item.key === activeFeature.key;
                    return (
                      <motion.button
                        key={item.key}
                        type="button"
                        onMouseEnter={() => setActiveFeatureKey(item.key)}
                        onFocus={() => setActiveFeatureKey(item.key)}
                        onClick={() => setActiveFeatureKey(item.key)}
                        whileHover={{ y: -4, scale: 1.01 }}
                        className={cn(
                          "group relative overflow-hidden rounded-[22px] border p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition md:rounded-[28px]",
                          isActive ? "border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))]" : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))]",
                        )}
                      >
                        <div className={cn("absolute inset-0 opacity-0 transition duration-500", isActive ? "opacity-100" : "group-hover:opacity-100")}>
                          <div className={cn("absolute inset-x-0 top-0 h-px", item.key === "audio" ? "bg-[linear-gradient(90deg,transparent,#77ccff,transparent)]" : item.key === "exam" ? "bg-[linear-gradient(90deg,transparent,#7be8d6,transparent)]" : item.key === "laws" ? "bg-[linear-gradient(90deg,transparent,#b28cff,transparent)]" : item.key === "typing" ? "bg-[linear-gradient(90deg,transparent,#ffbf59,transparent)]" : "bg-[linear-gradient(90deg,transparent,#86e090,transparent)]")} />
                          <div className={cn("absolute -right-8 top-[-2rem] h-20 w-20 rounded-full blur-2xl", item.key === "audio" ? "bg-[#39a4ff]/16" : item.key === "exam" ? "bg-[#29c8b6]/16" : item.key === "laws" ? "bg-[#8f67ff]/16" : item.key === "typing" ? "bg-[#ffbf59]/16" : "bg-[#6edc82]/16")} />
                        </div>
                        <div className="relative flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={cn("flex size-12 items-center justify-center rounded-2xl border text-white", isActive ? "border-white/16 bg-white/12" : "border-white/8 bg-black/14")}>
                              <Icon className="size-5" />
                            </div>
                            <div>
                              <div className="text-xs tracking-[0.18em] text-white/42">{`0${index + 1}`}</div>
                              <div className="mt-1 text-lg font-semibold text-white">{item.title}</div>
                              <div className="mt-1 text-xs text-white/46">{item.eyebrow}</div>
                            </div>
                          </div>
                          <ArrowRight className="size-4 text-white/42 transition group-hover:translate-x-1" />
                        </div>
                        <div className="relative mt-4 text-sm leading-7 text-white/62">{item.detail}</div>
                        <div className="relative mt-4 flex flex-wrap gap-2">
                          {item.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="rounded-full border border-white/10 bg-black/16 px-3 py-1 text-xs text-white/56">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,26,44,0.82),rgba(15,24,40,0.72))] shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:rounded-[34px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeFeature.key}
                      initial={{ opacity: 0, y: 22 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -14 }}
                      transition={{ duration: 0.32, ease: "easeOut" }}
                      className="relative p-4 md:p-7"
                    >
                      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", activeFeature.gradient)} />
                      <div className={cn("absolute right-0 top-8 h-56 w-56 rounded-full blur-3xl", activeFeature.aura)} />
                      <div className="absolute left-8 top-8 h-24 w-40 rounded-full bg-white/10 blur-3xl" />
                      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                        <div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/62">
                            <Sparkles className="size-3.5 text-[#8fd6ff]" />
                            模块定位
                          </div>
                          <div className="mt-5 flex items-start justify-between gap-4">
                            <div>
                              <div className="text-xs tracking-[0.22em] text-white/42">{activeFeature.eyebrow}</div>
                              <h3 className="mt-3 text-[24px] font-semibold tracking-[-0.05em] text-white md:text-[38px]">{activeFeature.title}</h3>
                              <p className="mt-4 max-w-2xl text-[14px] leading-7 text-white/62 md:text-[15px] md:leading-8">{activeFeature.description}</p>
                            </div>
                            <div className="hidden rounded-2xl border border-white/10 bg-white/8 p-4 text-white md:flex">
                              <activeFeature.icon className="size-6" />
                            </div>
                          </div>
                          <div className="mt-6 grid gap-4 md:grid-cols-3">
                            {activeFeature.metrics.map((item) => (
                              <div key={item.value} className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4">
                                <div className="text-lg font-semibold text-white">{item.value}</div>
                                <div className="mt-2 text-xs tracking-[0.16em] text-white/46">{item.label}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-6 rounded-[28px] border border-white/10 bg-black/18 p-5">
                            <div className="text-xs tracking-[0.2em] text-white/42">进入后你会看到</div>
                            <div className="mt-4 grid gap-3">
                              {activeFeature.preview.map((item, index) => (
                                <div key={item} className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/6 px-4 py-4">
                                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/8 text-xs font-semibold text-white/74">
                                    {index + 1}
                                  </div>
                                  <div className="text-sm text-white/70">{item}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-4">
                          <div className="rounded-[28px] border border-white/10 bg-white/7 p-5">
                            <div className="text-xs tracking-[0.2em] text-white/44">适合阶段</div>
                            <div className="mt-3 text-base font-semibold text-white">{activeFeature.detail}</div>
                          </div>
                          <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
                            <div className="text-xs tracking-[0.2em] text-white/44">关键词</div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {activeFeature.tags.map((item) => (
                                <span key={item} className="rounded-full border border-white/10 bg-black/16 px-3 py-1 text-xs text-white/70">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
                            <div className="text-xs tracking-[0.2em] text-white/44">立即进入</div>
                            <div className="mt-3 text-sm leading-7 text-white/58">{hasToken ? "已登录可直接进入对应模块，继续你的学习进度。" : "未登录时先进入登录页，再跳转到对应模块。"}</div>
                            <Button type="button" className="mt-5 h-11 w-full rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100" onClick={() => goFeature(activeFeature.path)}>
                              {activeFeature.action}
                              <ArrowRight className="ml-2 size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </section>

          <section id="journey" className="relative px-4 py-16 md:px-6 md:py-20 xl:px-8">
            <div className="mx-auto max-w-7xl overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,31,52,0.74),rgba(14,24,40,0.58))] px-4 py-6 shadow-[0_28px_90px_rgba(0,0,0,0.26)] backdrop-blur-2xl md:rounded-[40px] md:px-8 md:py-10">
              <div className="pointer-events-none absolute inset-x-10 top-4 h-24 rounded-full bg-white/8 blur-3xl" />
              <div className="max-w-3xl">
                <div className="text-sm font-medium tracking-[0.22em] text-[#8ce8ff]">{portalConfig.journey.eyebrow}</div>
                <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.05em] text-white md:text-[46px]">{portalConfig.journey.title}</h2>
                <p className="mt-4 text-[15px] leading-7 text-white/56 md:text-base md:leading-8">你现在的结构已经是对的：首页介绍平台，登录进入个人学习首页。这里进一步把学习路径做成可视化，让门户从一开始就有产品节奏。</p>
              </div>
              <div className="relative mt-10 grid gap-4 lg:grid-cols-3">
                <div className="pointer-events-none absolute left-[17%] right-[17%] top-10 hidden h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.26),transparent)] lg:block" />
                {journeyCards.map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.45, delay: index * 0.08, ease: "easeOut" }}
                    whileHover={{ y: -4 }}
                    className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] px-4 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] backdrop-blur-xl md:rounded-[30px] md:px-5 md:py-6"
                  >
                    <div className={cn("absolute inset-x-0 top-0 h-px", index === 0 ? "bg-[linear-gradient(90deg,transparent,#7fd5ff,transparent)]" : index === 1 ? "bg-[linear-gradient(90deg,transparent,#8ff0df,transparent)]" : "bg-[linear-gradient(90deg,transparent,#a693ff,transparent)]")} />
                    <div className="flex size-12 items-center justify-center rounded-2xl border border-white/12 bg-white/10 text-sm font-semibold text-white">{item.step}</div>
                    <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white">{item.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-white/58">{item.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          <section id="experience" className="relative px-4 pb-20 pt-4 md:px-6 xl:px-8">
            <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.04fr_0.96fr]">
              <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,29,48,0.78),rgba(11,20,34,0.62))] p-5 shadow-[0_30px_90px_rgba(8,15,24,0.22)] backdrop-blur-2xl md:rounded-[40px] md:p-8">
                <div className="absolute -right-16 top-0 h-56 w-56 rounded-full bg-[#11355c] blur-3xl" />
                <div className="absolute bottom-[-5rem] left-[-4rem] h-52 w-52 rounded-full bg-[#123b47] blur-3xl" />
                <div className="absolute inset-x-12 top-6 h-24 rounded-full bg-white/8 blur-3xl" />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-medium text-white/64">
                    <ShieldCheck className="size-3.5 text-[#7ed5ff]" />
                    {portalConfig.experience.badge}
                  </div>
                  <h2 className="mt-5 max-w-3xl text-[28px] font-semibold leading-[1.06] tracking-[-0.05em] text-white md:text-[48px] md:leading-[1.02] md:tracking-[-0.06em]">
                    {experienceTitleAccent ? `${experienceTitleLead}，` : experienceTitleLead}
                    {experienceTitleAccent ? <span className="block bg-[linear-gradient(90deg,#ffffff_0%,#9ed7ff_35%,#91f6d8_100%)] bg-clip-text text-transparent">{experienceTitleAccent}</span> : null}
                  </h2>
                  <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/58 md:text-base md:leading-8">公开首页承担品牌表达、招生转化与咨询承接，站内首页承担学习、训练与运营推进。两层结构拆清楚之后，后续继续扩模块也不会乱，整体气质也会更像成熟产品。</p>
                  <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {experienceCards.map((item) => (
                      <div key={item.title} className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] px-5 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl">
                        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.42),transparent)]" />
                        <div className="text-lg font-semibold tracking-[-0.03em] text-white">{item.title}</div>
                        <div className="mt-3 text-sm leading-7 text-white/58">{item.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5">
                <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,30,49,0.78),rgba(11,20,34,0.6))] shadow-[0_26px_80px_rgba(8,15,24,0.2)] backdrop-blur-2xl md:rounded-[34px]">
                  <div className="h-1 bg-[linear-gradient(90deg,#7fd5ff_0%,#7a7cff_48%,#7ef5d9_100%)]" />
                  <div className="p-5">
                    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] p-5 backdrop-blur-xl">
                      <div className="text-xs tracking-[0.22em] text-white/42">{portalConfig.startPanel.eyebrow}</div>
                      <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{startPanelTitle}</div>
                      <p className="mt-3 text-sm leading-7 text-white/58">{portalConfig.startPanel.description}</p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[22px] border border-white/10 bg-black/18 px-4 py-4">
                          <div className="text-[11px] tracking-[0.18em] text-white/40">访问层</div>
                          <div className="mt-2 text-sm font-semibold text-white">门户官网 + 登录后站内首页</div>
                        </div>
                        <div className="rounded-[22px] border border-white/10 bg-black/18 px-4 py-4">
                          <div className="text-[11px] tracking-[0.18em] text-white/40">当前覆盖</div>
                          <div className="mt-2 text-sm font-semibold text-white">{`${features.length} 个学习模块已就位`}</div>
                        </div>
                      </div>
                      <Button type="button" className="mt-5 h-11 rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100" onClick={() => navigate(hasToken ? "/user/courses" : "/login")}>
                        {authEntryLabel}
                        <ArrowRight className="ml-2 size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,30,49,0.76),rgba(11,20,34,0.58))] px-4 py-4 shadow-[0_26px_80px_rgba(8,15,24,0.2)] backdrop-blur-2xl md:rounded-[34px] md:px-5 md:py-5">
                  <div className="text-xs tracking-[0.22em] text-white/42">{portalConfig.startOptions.eyebrow}</div>
                  <div className="mt-4 space-y-3">
                    {startOptions.map((item, index) => (
                      <button key={item.path} type="button" className="group flex w-full items-center justify-between rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] px-4 py-4 text-left transition hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))]" onClick={() => goFeature(item.path)}>
                        <div className="flex items-center gap-3">
                          <div className={cn("flex size-10 items-center justify-center rounded-2xl", index === 0 ? "bg-[#10233c] text-[#81c7ff]" : "bg-[#0c2a2a] text-[#8af2e7]")}>
                            {index === 0 ? <Headphones className="size-5" /> : <FilePenLine className="size-5" />}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{item.title}</div>
                            <div className="text-xs text-white/46">{item.description}</div>
                          </div>
                        </div>
                        <ArrowRight className="size-4 text-white/38 transition group-hover:translate-x-1" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative px-4 py-16 md:px-6 md:py-20 xl:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="mx-auto grid max-w-7xl gap-4 md:gap-5 lg:grid-cols-[340px_minmax(0,1fr)]"
            >
              <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(126,213,255,0.18),transparent_42%),linear-gradient(180deg,rgba(18,32,52,0.82)_0%,rgba(10,18,30,0.66)_100%)] p-3 shadow-[0_28px_100px_rgba(0,0,0,0.3)] backdrop-blur-2xl md:rounded-[38px] md:p-4">
                <div className="absolute inset-x-10 top-6 h-24 rounded-full bg-[#2a5a8d]/30 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.42),transparent)]" />
                <div className="rounded-[24px] bg-[linear-gradient(145deg,rgba(255,251,238,0.92)_0%,rgba(243,223,181,0.7)_12%,rgba(191,146,77,0.4)_26%,rgba(118,87,47,0.22)_42%,rgba(246,227,188,0.58)_56%,rgba(168,124,63,0.34)_76%,rgba(255,248,232,0.86)_100%)] p-[2px] shadow-[0_32px_90px_rgba(0,0,0,0.28)] md:rounded-[34px]">
                  <div className="relative flex h-[280px] items-end justify-center overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_top,rgba(126,213,255,0.12),transparent_38%),linear-gradient(180deg,rgba(12,24,40,0.98),rgba(7,14,24,1))] px-2 pt-2 md:h-[392px] md:rounded-[32px]">
                    <motion.div
                      aria-hidden="true"
                      className="absolute inset-y-0 left-[-30%] w-[38%] skew-x-[-18deg] bg-white/16 blur-2xl"
                      animate={{ x: ["0%", "265%"] }}
                      transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <img src={portalConfig.founder.imageUrl} alt="创始人头像" className="relative h-[280px] w-auto max-w-none object-contain object-bottom drop-shadow-[0_28px_80px_rgba(0,0,0,0.55)] md:h-[392px]" />
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,30,49,0.8),rgba(11,20,34,0.62))] p-5 shadow-[0_30px_90px_rgba(8,15,24,0.22)] backdrop-blur-2xl md:rounded-[40px] md:p-8">
                <div className="absolute -right-14 top-0 h-56 w-56 rounded-full bg-[#153a62] blur-3xl" />
                <div className="absolute bottom-[-6rem] left-[-4rem] h-52 w-52 rounded-full bg-[#0f3a45] blur-3xl" />
                <div className="absolute inset-x-12 top-6 h-24 rounded-full bg-white/8 blur-3xl" />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-medium text-white/64">
                    <Sparkles className="size-3.5 text-[#7ed5ff]" />
                    {portalConfig.founder.sectionBadge}
                  </div>
                  <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <div className="text-sm uppercase tracking-[0.24em] text-white/42">{portalConfig.founder.perspectiveLabel}</div>
                      <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.05em] text-white md:text-[42px]">{portalConfig.founder.name}</h2>
                      <div className="mt-2 text-base text-[#8fd6ff]">{portalConfig.founder.role}</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/56">{portalConfig.founder.methodLabel}</div>
                  </div>
                  <div className="mt-6 lg:relative lg:min-h-[196px] lg:pr-[300px]">
                    <div className="max-w-3xl">
                      <p className="text-[15px] leading-7 text-white/62 md:text-base md:leading-8">{portalConfig.founder.intro}</p>
                      <p className="mt-4 text-[15px] leading-7 text-white/58 md:text-base md:leading-8">{portalConfig.founder.statement}</p>
                    </div>
                    <div className="mt-5 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] p-4 backdrop-blur-xl lg:absolute lg:right-0 lg:top-0 lg:mt-0 lg:w-[280px]">
                      <div className="text-xs tracking-[0.22em] text-white/42">核心关键词</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {portalConfig.founder.tags.map((item) => (
                          <span key={item} className="rounded-full border border-white/10 bg-black/16 px-3 py-1 text-xs text-white/68">{item}</span>
                        ))}
                      </div>
                      <div className="mt-4 rounded-[22px] border border-white/10 bg-black/16 px-4 py-3.5">
                        <div className="text-xs tracking-[0.2em] text-white/42">创始人视角</div>
                        <div className="mt-3 text-sm leading-6 text-white/62">{portalConfig.founder.perspective}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          <section id="contact" className="relative px-4 pb-20 pt-4 md:px-6 xl:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.06fr_0.94fr]"
            >
              <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,30,49,0.82),rgba(11,20,34,0.64))] p-5 shadow-[0_30px_90px_rgba(8,15,24,0.22)] backdrop-blur-2xl md:rounded-[40px] md:p-8">
                <div className="absolute -right-16 top-0 h-56 w-56 rounded-full bg-[#174564] blur-3xl" />
                <div className="absolute bottom-[-5rem] left-[-4rem] h-48 w-48 rounded-full bg-[#153445] blur-3xl" />
                <div className="absolute inset-x-12 top-6 h-24 rounded-full bg-white/8 blur-3xl" />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-medium text-white/64">
                    <MessageCircleMore className="size-3.5 text-[#7ed5ff]" />
                    {portalConfig.contact.badge}
                  </div>
                  <h2 className="mt-5 text-[28px] font-semibold tracking-[-0.05em] text-white md:text-[46px]">{portalConfig.contact.title}</h2>
                  <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/58 md:text-base md:leading-8">{portalConfig.contact.description}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {portalConfig.contact.phone ? <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/72"><Phone className="size-4 text-[#8fd6ff]" />{portalConfig.contact.phone}</div> : null}
                    {portalConfig.contact.wechat ? <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/72"><MessageCircleMore className="size-4 text-[#8fd6ff]" />微信：{portalConfig.contact.wechat}</div> : null}
                  </div>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    {contactUrl ? <Button type="button" className="h-12 rounded-full bg-white px-6 text-slate-950 hover:bg-slate-100" onClick={openContact}>{portalConfig.contact.buttonLabel}<ExternalLink className="ml-2 size-4" /></Button> : null}
                    <Button type="button" variant="outline" className="h-12 rounded-full border-white/12 bg-white/6 px-6 text-white hover:bg-white/10" onClick={() => navigate(hasToken ? "/user/courses" : "/login")}>{authEntryLabel}</Button>
                  </div>
                  <p className="mt-4 max-w-xl text-xs leading-6 text-white/40">{portalConfig.contact.buttonHint}</p>
                </div>
              </div>
              <div className="grid gap-4">
                {contactSteps.map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, x: 18 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.42, delay: index * 0.08, ease: "easeOut" }}
                    className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] md:rounded-[30px] md:p-5"
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.36),transparent)]" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex size-12 items-center justify-center rounded-2xl border border-white/12 bg-white/10 text-sm font-semibold text-white">{item.step}</div>
                      <ArrowRight className="mt-1 size-4 text-white/30 transition group-hover:translate-x-1 group-hover:text-white/56" />
                    </div>
                    <div className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white">{item.title}</div>
                    <div className="mt-3 text-sm leading-7 text-white/58">{item.detail}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>

          <footer className="mx-auto mt-10 max-w-7xl rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,31,50,0.82),rgba(12,21,35,0.66))] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl md:mt-16 md:rounded-[36px] md:p-8">
            <div className="pointer-events-none absolute inset-x-12 top-6 h-24 rounded-full bg-white/8 blur-3xl" />
            <div className="grid gap-8 lg:grid-cols-[1.06fr_0.84fr_1.1fr]">
              <div>
                <AppLogo className="[&_p:first-of-type]:text-white [&_p:last-of-type]:text-white/45" logoUrlOverride={brandingConfig?.brandLogoUrl ?? ""} />
                <p className="mt-5 max-w-md text-sm leading-7 text-white/58">{portalConfig.footer.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/62">{portalConfig.hero.badge}</span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/62">{`${features.length} 大核心模块`}</span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/62">支持 PC / 手机双端触达</span>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button type="button" className="rounded-full bg-white text-slate-950 hover:bg-slate-100" onClick={() => navigate(hasToken ? "/user/courses" : "/login")}>{authEntryLabel}</Button>
                  {contactUrl ? <Button type="button" variant="outline" className="rounded-full border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={openContact}>{portalConfig.contact.buttonLabel}</Button> : null}
                  <Button type="button" variant="outline" className="rounded-full border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={() => scrollToId("products")}>{portalConfig.actions.footerBrowseLabel}</Button>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-white/42">{portalConfig.navigation.footerNavTitle}</div>
                <div className="mt-4 space-y-2">
                  {headerLinks.map((item) => (
                    <button key={item.href} type="button" className="flex w-full items-center justify-between rounded-[18px] border border-white/10 bg-white/6 px-4 py-3 text-left text-sm text-white/74" onClick={() => scrollToId(item.href.replace("#", ""))}>
                      {item.label}
                      <ArrowRight className="size-4 text-white/38" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-white/42">{portalConfig.navigation.footerFeatureTitle}</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {features.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.key} type="button" className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] p-4 text-left transition hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))]" onClick={() => goFeature(item.path)}>
                        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.32),transparent)]" />
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-black/18 text-white"><Icon className="size-4.5" /></div>
                        <div className="mt-4 text-sm font-semibold text-white">{item.title}</div>
                        <div className="mt-1 text-xs text-white/46">{item.eyebrow}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-8 border-t border-white/10 pt-5">
              <div className="flex flex-col gap-3 text-xs text-white/42 lg:flex-row lg:items-center lg:justify-between">
                <div>{portalConfig.footer.copyright}</div>
                <div className="flex flex-wrap gap-3">
                  {legalDocuments.map((item) => (
                    <button key={item.slug} type="button" className="rounded-full border border-white/10 bg-white/6 px-3 py-1 transition hover:bg-white/10" onClick={() => navigate(`/legal/${item.slug}`)}>
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </footer>

          <div className="pointer-events-none fixed inset-x-3 bottom-3 z-40 md:hidden">
            <div className="pointer-events-auto rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,31,50,0.84),rgba(11,19,33,0.72))] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
              <div className="mb-2 flex items-center justify-between px-1 text-[11px] text-white/42">
                <span>{portalConfig.navigation.quickEntryLabel}</span>
                <span>{brandName}</span>
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5 px-1">
                {portalConfig.hero.quickTags.slice(0, 2).map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] text-white/54">
                    {item}
                  </span>
                ))}
              </div>
              <div className={cn("grid gap-2", contactUrl ? "grid-cols-1" : "grid-cols-2")}>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" className="h-11 rounded-full bg-white text-slate-950 hover:bg-slate-100" onClick={() => navigate(hasToken ? "/user/courses" : "/login")}>
                    {authEntryShortLabel}
                  </Button>
                  <Button type="button" variant="outline" className="h-11 rounded-full border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={() => scrollToId("products")}>
                    {productsLabel}
                  </Button>
                </div>
                {contactUrl ? (
                  <Button type="button" variant="outline" className="h-11 rounded-full border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={openContact}>
                    {portalConfig.contact.buttonLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
