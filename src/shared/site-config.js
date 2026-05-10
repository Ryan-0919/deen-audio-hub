export const DEFAULT_PUBLIC_SITE_URL = "https://denlaw.cn";

export const getPublicSiteBaseUrl = () => {
  const value = `${import.meta.env?.VITE_SITE_URL ?? DEFAULT_PUBLIC_SITE_URL}`.trim();
  return value.replace(/\/+$/, "") || DEFAULT_PUBLIC_SITE_URL;
};

export const buildPublicSiteUrl = (pathname = "/") => {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, `${getPublicSiteBaseUrl()}/`).toString();
};
