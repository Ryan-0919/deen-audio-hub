import { ArrowLeft, ExternalLink, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { createDefaultPortalConfig } from "../../../shared/portal-config.js";
import { buildPublicSiteUrl } from "../../../shared/site-config.js";
import { AppLogo } from "../../components/branding/AppLogo";
import { Button } from "../../components/ui/button";
import { type BrandingConfig, mockApi } from "../../lib/mockData";
import { getUserToken } from "../../lib/user-session";
import { PortalNotFound } from "./PortalNotFound";

const DEFAULT_PORTAL_CONFIG = createDefaultPortalConfig();

function toAbsoluteUrl(value: string) {
  try {
    return new URL(value || "/portal/founder-avatar.png", buildPublicSiteUrl("/")).toString();
  } catch {
    return value;
  }
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

export function PortalLegalPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const hasToken = Boolean(getUserToken());
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await mockApi.getBrandingConfig();
        if (!active) return;
        setBrandingConfig(data);
      } catch {
        if (!active) return;
        setBrandingConfig({
          brandLogoUrl: "",
          customerServiceUrl: "",
          playerDiscImageUrl: "",
          portalConfig: DEFAULT_PORTAL_CONFIG,
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const portalConfig = brandingConfig?.portalConfig ?? DEFAULT_PORTAL_CONFIG;
  const documentConfig = portalConfig.footer.legalDocuments.find((item) => item.slug === slug);
  const contactUrl = `${portalConfig.contact.url ?? brandingConfig?.customerServiceUrl ?? ""}`.trim();
  const brandName = portalConfig.seo.title.split("|")[0]?.trim() || "得恩法考";
  const authEntryLabel = hasToken ? portalConfig.actions.authLoggedInLabel : portalConfig.actions.authLoggedOutLabel;

  useEffect(() => {
    if (!documentConfig) return;
    const description = documentConfig.content[0] ?? portalConfig.seo.description;
    const canonicalUrl = buildPublicSiteUrl(`/legal/${documentConfig.slug}`);
    const ogImageUrl = toAbsoluteUrl(portalConfig.seo.ogImageUrl);
    document.title = `${documentConfig.title} | ${brandName}`;
    document.documentElement.lang = "zh-CN";
    setMetaContent("name", "description", description);
    setMetaContent("property", "og:title", `${documentConfig.title} | ${brandName}`);
    setMetaContent("property", "og:description", description);
    setMetaContent("property", "og:type", "article");
    setMetaContent("property", "og:url", canonicalUrl);
    setMetaContent("property", "og:image", ogImageUrl);
    setMetaContent("name", "twitter:card", "summary_large_image");
    setMetaContent("name", "twitter:title", `${documentConfig.title} | ${brandName}`);
    setMetaContent("name", "twitter:description", description);
    setMetaContent("name", "twitter:image", ogImageUrl);
    setCanonical(canonicalUrl);
  }, [brandName, documentConfig, portalConfig.seo.description, portalConfig.seo.ogImageUrl]);

  if (!loading && !documentConfig) {
    return <PortalNotFound />;
  }

  return (
    <div className="min-h-screen bg-[#07111d] text-white">
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-[#1b7cff]/18 blur-3xl" />
        <div className="absolute right-[-4rem] top-32 h-72 w-72 rounded-full bg-[#8b5cf6]/14 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-[28%] h-72 w-72 rounded-full bg-[#1dc7b8]/12 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_38%),linear-gradient(180deg,#07111d_0%,#081322_38%,#091827_72%,#0c1728_100%)]" />
      </div>

      <div className="relative">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07111d]/72 backdrop-blur-2xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-20 md:px-6 xl:px-8">
            <AppLogo className="[&_p:first-of-type]:text-white [&_p:last-of-type]:text-white/45" logoUrlOverride={brandingConfig?.brandLogoUrl ?? ""} />
            <div className="flex items-center gap-2">
              {contactUrl ? (
                <Button type="button" variant="outline" className="hidden rounded-full border-white/12 bg-white/6 text-white hover:bg-white/10 md:inline-flex" onClick={() => window.open(contactUrl, "_blank", "noopener,noreferrer")}>
                  {portalConfig.contact.buttonLabel}
                  <ExternalLink className="ml-2 size-4" />
                </Button>
              ) : null}
              <Button type="button" className="rounded-full bg-white text-slate-950 hover:bg-slate-100" onClick={() => navigate(hasToken ? "/user/courses" : "/login")}>
                {authEntryLabel}
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 pb-20 pt-6 md:px-6 md:pt-12 xl:px-8">
          <section className="mx-auto max-w-5xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,38,0.96),rgba(10,18,30,0.9))] p-5 md:rounded-[36px] md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-white/42">法律与协议</div>
                <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.05em] text-white md:text-[46px]">
                  {documentConfig?.title ?? "加载中"}
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60 md:leading-8">
                  {documentConfig?.content[0] ?? "正在加载协议内容，请稍候。"}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button type="button" variant="outline" className="w-full rounded-full border-white/12 bg-white/6 text-white hover:bg-white/10 sm:w-auto" onClick={() => navigate("/")}>
                  <Home className="mr-2 size-4" />
                  门户首页
                </Button>
                <Button type="button" variant="outline" className="w-full rounded-full border-white/12 bg-white/6 text-white hover:bg-white/10 sm:w-auto" onClick={() => navigate(-1)}>
                  <ArrowLeft className="mr-2 size-4" />
                  返回上一页
                </Button>
              </div>
            </div>
          </section>

          <section className="mx-auto mt-6 max-w-5xl rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur-2xl md:mt-8 md:rounded-[36px] md:p-8">
            <div className="space-y-5">
              {documentConfig?.content.map((paragraph, index) => (
                <div key={`${documentConfig.slug}-${index}`} className="rounded-[20px] border border-white/10 bg-black/16 px-4 py-4 text-[14px] leading-7 text-white/72 md:rounded-[24px] md:px-5 md:py-5 md:text-[15px] md:leading-8">
                  {paragraph}
                </div>
              ))}
            </div>
          </section>

          <footer className="mx-auto mt-6 max-w-5xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,38,0.96),rgba(8,16,28,0.94))] p-5 md:mt-8 md:rounded-[32px] md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm leading-7 text-white/58">{portalConfig.footer.description}</div>
              <div className="text-xs text-white/42">{portalConfig.footer.copyright}</div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
