const USER_TOKEN_KEY = "userToken";
const USER_ID_KEY = "userId";
const USER_PHONE_KEY = "userPhone";
const USER_DISPLAY_NAME_KEY = "userDisplayName";
const USER_DEVICE_KEY = "userDeviceKey";

const USER_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const USER_DEVICE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

const readLocalStorage = (key: string) => {
  if (!isBrowser()) return "";

  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const writeLocalStorage = (key: string, value: string) => {
  if (!isBrowser()) return;

  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Ignore storage write failures in restricted browsers.
  }
};

const readCookie = (key: string) => {
  if (!isBrowser()) return "";

  const encodedKey = encodeURIComponent(key);
  const segments = document.cookie ? document.cookie.split("; ") : [];
  const matched = segments.find((segment) => segment.startsWith(`${encodedKey}=`));
  if (!matched) return "";

  return decodeURIComponent(matched.slice(encodedKey.length + 1));
};

const getCookieDomain = () => {
  if (!isBrowser()) return "";

  const hostname = window.location.hostname.trim();
  if (!hostname || hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return "";
  }

  const segments = hostname.split(".").filter(Boolean);
  if (segments.length < 2) return "";

  return `.${segments.slice(-2).join(".")}`;
};

const buildCookieAttributes = (maxAgeSeconds: number) => {
  const attrs = [`Path=/`, `Max-Age=${maxAgeSeconds}`, `SameSite=Lax`];
  const domain = getCookieDomain();

  if (domain) {
    attrs.push(`Domain=${domain}`);
  }

  if (isBrowser() && window.location.protocol === "https:") {
    attrs.push("Secure");
  }

  return attrs.join("; ");
};

const writeCookie = (key: string, value: string, maxAgeSeconds: number) => {
  if (!isBrowser()) return;

  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; ${buildCookieAttributes(maxAgeSeconds)}`;
};

const clearCookie = (key: string) => {
  if (!isBrowser()) return;

  document.cookie = `${encodeURIComponent(key)}=; ${buildCookieAttributes(0)}`;
};

const getMaxAge = (key: string) => (key === USER_DEVICE_KEY ? USER_DEVICE_MAX_AGE_SECONDS : USER_SESSION_MAX_AGE_SECONDS);

const readPersistedValue = (key: string) => {
  const localValue = readLocalStorage(key);
  if (localValue) {
    if (!readCookie(key)) {
      writeCookie(key, localValue, getMaxAge(key));
    }
    return localValue;
  }

  const cookieValue = readCookie(key);
  if (cookieValue) {
    writeLocalStorage(key, cookieValue);
    return cookieValue;
  }

  return "";
};

const persistValue = (key: string, value: string) => {
  writeLocalStorage(key, value);

  if (value) {
    writeCookie(key, value, getMaxAge(key));
  } else {
    clearCookie(key);
  }
};

const createRandomDeviceKey = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `device-${crypto.randomUUID()}`;
  }

  return `device-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
};

const isManagedDisplayName = (value: string) =>
  /^(?:den|得宝|å¾—å®)_/i.test(value) ||
  value === "得宝用户" ||
  value === "den用户" ||
  value === "å¾—å®ç”¨æˆ·";

export const buildDefaultUserDisplayName = (phone: string) => {
  const digits = `${phone ?? ""}`.replace(/\D/g, "");
  if (digits.length >= 6) {
    return `得宝_${digits.slice(-6)}`;
  }
  if (digits) {
    return `得宝_${digits}`;
  }
  return "得宝用户";
};

export const getUserToken = () => readPersistedValue(USER_TOKEN_KEY);

export const getUserId = () => readPersistedValue(USER_ID_KEY);

export const getUserPhone = () => readPersistedValue(USER_PHONE_KEY);

export const getUserDisplayName = () => {
  const phone = getUserPhone();
  const defaultDisplayName = buildDefaultUserDisplayName(phone);
  const storedDisplayName = readPersistedValue(USER_DISPLAY_NAME_KEY);

  if (!storedDisplayName) {
    return defaultDisplayName;
  }

  if (isManagedDisplayName(storedDisplayName)) {
    if (storedDisplayName !== defaultDisplayName) {
      persistValue(USER_DISPLAY_NAME_KEY, defaultDisplayName);
    }
    return defaultDisplayName;
  }

  return storedDisplayName;
};

export const getUserDeviceKey = () => readPersistedValue(USER_DEVICE_KEY);

export const ensureUserDeviceKey = () => {
  const existingKey = getUserDeviceKey();
  if (existingKey) return existingKey;

  const nextKey = createRandomDeviceKey();
  persistValue(USER_DEVICE_KEY, nextKey);
  return nextKey;
};

export const saveUserSession = ({
  token,
  userId,
  phone,
  displayName,
}: {
  token: string;
  userId: string;
  phone: string;
  displayName?: string;
}) => {
  persistValue(USER_TOKEN_KEY, token);
  persistValue(USER_ID_KEY, userId);
  persistValue(USER_PHONE_KEY, phone);
  persistValue(USER_DISPLAY_NAME_KEY, displayName || buildDefaultUserDisplayName(phone));
};

export const clearUserSession = () => {
  persistValue(USER_TOKEN_KEY, "");
  persistValue(USER_ID_KEY, "");
  persistValue(USER_PHONE_KEY, "");
  persistValue(USER_DISPLAY_NAME_KEY, "");
};
