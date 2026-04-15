import { normalizeDisplayText } from "./text.js";

export const ok = (res, data = null, message = "ok") => {
  res.json({
    code: 0,
    message: normalizeDisplayText(message),
    data,
  });
};

export const fail = (res, message = "请求失败", status = 400, code = status) => {
  res.status(status).json({
    code,
    message: normalizeDisplayText(message),
    data: null,
  });
};
