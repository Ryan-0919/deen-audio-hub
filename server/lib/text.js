const hasLatinMojibake = (value = "") => /[À-ÿ]/.test(value);
const hasCjk = (value = "") => /[\u3400-\u9fff]/.test(value);

export const normalizeDisplayText = (value = "") => {
  const text = `${value}`.trim();
  if (!text) return "";

  if (!hasLatinMojibake(text) || hasCjk(text)) {
    return text.normalize("NFC");
  }

  try {
    const decoded = Buffer.from(text, "latin1").toString("utf8").trim();
    if (decoded && /[\u4e00-\u9fff]/.test(decoded)) {
      return decoded.normalize("NFC");
    }
    return text.normalize("NFC");
  } catch (error) {
    return text.normalize("NFC");
  }
};

export const getDisplayNameFromUpload = (fileName = "", fallbackName = "未命名文件") => {
  const normalized = normalizeDisplayText(fileName);
  const withoutExt = normalized.replace(/\.[^.]+$/, "").trim();
  return withoutExt || fallbackName;
};
