const PHONE_PATTERN = /^1\d{10}$/;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 32;

const createBucketStore = () => {
  const buckets = new Map();

  const prune = (timestamps, now, windowMs) => timestamps.filter((timestamp) => now - timestamp < windowMs);

  return {
    consume(key, { windowMs, maxAttempts }) {
      if (!key) {
        return { ok: true, retryAfterSeconds: 0 };
      }

      const now = Date.now();
      const current = prune(buckets.get(key) ?? [], now, windowMs);

      if (current.length >= maxAttempts) {
        const retryAfterSeconds = Math.max(Math.ceil((windowMs - (now - current[0])) / 1000), 1);
        buckets.set(key, current);
        return { ok: false, retryAfterSeconds };
      }

      current.push(now);
      buckets.set(key, current);
      return { ok: true, retryAfterSeconds: 0 };
    },

    reset(key) {
      if (key) {
        buckets.delete(key);
      }
    },
  };
};

const userLoginStore = createBucketStore();
const userRegisterStore = createBucketStore();
const adminLoginStore = createBucketStore();

const normalizeDigits = (value = "") => `${value ?? ""}`.replace(/\D/g, "");

export const normalizePhone = (value = "") => normalizeDigits(value);

export const isValidPhone = (value = "") => PHONE_PATTERN.test(normalizePhone(value));

export const validatePhoneOrThrow = (value = "", label = "\u624b\u673a\u53f7") => {
  const normalized = normalizePhone(value);

  if (!PHONE_PATTERN.test(normalized)) {
    throw new Error(`\u8bf7\u8f93\u5165\u6b63\u786e\u7684${label}`);
  }

  return normalized;
};

export const validatePasswordOrThrow = (value = "", label = "\u5bc6\u7801") => {
  const password = `${value ?? ""}`.trim();

  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`${label}\u957f\u5ea6\u9700\u5728 ${PASSWORD_MIN_LENGTH} - ${PASSWORD_MAX_LENGTH} \u4f4d\u4e4b\u95f4`);
  }

  return password;
};

const consumeAttempt = (store, keys, options) => {
  let blocked = null;

  for (const key of keys.filter(Boolean)) {
    const result = store.consume(key, options);
    if (!result.ok) {
      blocked = result;
      break;
    }
  }

  return blocked ?? { ok: true, retryAfterSeconds: 0 };
};

const resetAttempt = (store, keys) => {
  keys.filter(Boolean).forEach((key) => store.reset(key));
};

export const consumeUserLoginAttempt = ({ ip = "", phone = "" }) =>
  consumeAttempt(userLoginStore, [`user-ip:${ip}`, `user-ip-phone:${ip}:${normalizePhone(phone)}`], {
    windowMs: 10 * 60 * 1000,
    maxAttempts: 10,
  });

export const resetUserLoginAttempts = ({ ip = "", phone = "" }) =>
  resetAttempt(userLoginStore, [`user-ip-phone:${ip}:${normalizePhone(phone)}`]);

export const consumeUserRegisterAttempt = ({ ip = "", phone = "" }) =>
  consumeAttempt(userRegisterStore, [`user-register-ip:${ip}`, `user-register-ip-phone:${ip}:${normalizePhone(phone)}`], {
    windowMs: 10 * 60 * 1000,
    maxAttempts: 6,
  });

export const resetUserRegisterAttempts = ({ ip = "", phone = "" }) =>
  resetAttempt(userRegisterStore, [`user-register-ip-phone:${ip}:${normalizePhone(phone)}`]);

export const consumeAdminLoginAttempt = ({ ip = "", account = "" }) =>
  consumeAttempt(adminLoginStore, [`admin-ip:${ip}`, `admin-ip-account:${ip}:${`${account ?? ""}`.trim().toLowerCase()}`], {
    windowMs: 10 * 60 * 1000,
    maxAttempts: 8,
  });

export const resetAdminLoginAttempts = ({ ip = "", account = "" }) =>
  resetAttempt(adminLoginStore, [`admin-ip-account:${ip}:${`${account ?? ""}`.trim().toLowerCase()}`]);
