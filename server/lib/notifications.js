import { prisma } from "./prisma.js";
import { formatDateTime } from "./time.js";
import { writeWebhookLog } from "./webhook-log.js";

const PREVIEW_LIMIT = 20;

const normalizeText = (value, fallback = "-") => {
  const text = `${value ?? ""}`.replace(/\s+/g, " ").trim();
  return text || fallback;
};

const normalizeList = (values = []) =>
  [...new Set((Array.isArray(values) ? values : [values]).map((item) => normalizeText(item, "")).filter(Boolean))];

const joinList = (values = [], fallback = "无") => {
  const list = normalizeList(values);
  return list.length ? list.join("、") : fallback;
};

const buildPreview = (values = [], fallback = "无") => {
  const list = normalizeList(values);
  if (!list.length) return fallback;
  const shown = list.slice(0, PREVIEW_LIMIT);
  return list.length > PREVIEW_LIMIT ? `${shown.join("、")} 等 ${list.length} 项` : shown.join("、");
};

const formatMoment = (value = new Date()) => formatDateTime(value);

const parseWebhookMeta = (label, meta = {}) => ({
  scene: `${meta.scene ?? label ?? "webhook"}`.trim().slice(0, 100),
  relatedEntityType: `${meta.relatedEntityType ?? ""}`.trim().slice(0, 50),
  relatedEntityId: `${meta.relatedEntityId ?? ""}`.trim().slice(0, 191),
});

const resolveWebhookUrl = async (inputWebhookUrl = "") => {
  const directUrl = `${inputWebhookUrl ?? ""}`.trim();
  if (directUrl) return directUrl;

  const current = await prisma.systemConfig.findUnique({
    where: { id: 1 },
    select: { webhookUrl: true },
  });

  return `${current?.webhookUrl ?? ""}`.trim();
};

const sendWebhookPayload = async (webhookUrl, payload) => {
  if (!webhookUrl) {
    throw new Error("请先配置企业微信 Webhook 地址");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = new Error(`企业微信通知发送失败，HTTP ${response.status}`);
    error.responseCode = response.status;
    throw error;
  }

  const result = await response.json().catch(() => null);
  if (!result || result.errcode !== 0) {
    const error = new Error(`企业微信通知发送失败：${result?.errmsg || "响应格式不正确"}`);
    error.responseCode = result?.errcode ?? response.status;
    throw error;
  }

  return {
    responseCode: result?.errcode ?? response.status,
    result,
  };
};

export const sendWecomMarkdown = async (webhookUrl, content) =>
  sendWebhookPayload(webhookUrl, {
    msgtype: "markdown",
    markdown: {
      content,
    },
  });

export const notifyMarkdownSafely = async (label, content, inputWebhookUrl = "", meta = {}) => {
  const webhookMeta = parseWebhookMeta(label, meta);
  const webhookUrl = await resolveWebhookUrl(inputWebhookUrl);

  if (!webhookUrl) {
    await writeWebhookLog({
      scene: webhookMeta.scene,
      status: "skipped",
      content,
      errorMessage: "Webhook 未配置",
      relatedEntityType: webhookMeta.relatedEntityType,
      relatedEntityId: webhookMeta.relatedEntityId,
    });
    return false;
  }

  try {
    const result = await sendWecomMarkdown(webhookUrl, content);
    await writeWebhookLog({
      scene: webhookMeta.scene,
      status: "success",
      content,
      webhookUrl,
      responseCode: result.responseCode,
      relatedEntityType: webhookMeta.relatedEntityType,
      relatedEntityId: webhookMeta.relatedEntityId,
    });
    return true;
  } catch (error) {
    console.error(`${label} webhook failed:`, error);
    await writeWebhookLog({
      scene: webhookMeta.scene,
      status: "failed",
      content,
      webhookUrl,
      responseCode: error?.responseCode ?? null,
      errorMessage: error instanceof Error ? error.message : "Webhook 发送失败",
      relatedEntityType: webhookMeta.relatedEntityType,
      relatedEntityId: webhookMeta.relatedEntityId,
    });
    return false;
  }
};

export const sendTestWebhookMessage = async (inputWebhookUrl = "") => {
  const webhookUrl = await resolveWebhookUrl(inputWebhookUrl);
  const content = ["# 课程系统测试通知", "", "> 状态：<font color=\"info\">Webhook 配置可用</font>", `> 发送时间：${formatMoment()}`].join("\n");

  try {
    const result = await sendWecomMarkdown(webhookUrl, content);
    await writeWebhookLog({
      scene: "system-test-webhook",
      status: "success",
      content,
      webhookUrl,
      responseCode: result.responseCode,
    });
    return result;
  } catch (error) {
    await writeWebhookLog({
      scene: "system-test-webhook",
      status: "failed",
      content,
      webhookUrl,
      responseCode: error?.responseCode ?? null,
      errorMessage: error instanceof Error ? error.message : "Webhook 发送失败",
    });
    throw error;
  }
};

export const buildUserCreatedMarkdown = ({ phone, courseNames, operatorName, eventTime = new Date() }) =>
  [
    "# 学员开通通知",
    "",
    "> 状态：<font color=\"info\">开通成功</font>",
    `> 学员手机号：${normalizeText(phone)}`,
    `> 开通课程：${joinList(courseNames)}`,
    "> 开通方式：新建账户",
    `> 操作人：${normalizeText(operatorName)}`,
    `> 操作时间：${formatMoment(eventTime)}`,
  ].join("\n");

export const buildUserPermissionAddedMarkdown = ({ phone, courseNames, operatorName, eventTime = new Date() }) =>
  [
    "# 学员权限变更通知",
    "",
    "> 状态：<font color=\"info\">新增课程权限成功</font>",
    `> 学员手机号：${normalizeText(phone)}`,
    `> 新增课程：${joinList(courseNames)}`,
    `> 操作人：${normalizeText(operatorName)}`,
    `> 操作时间：${formatMoment(eventTime)}`,
  ].join("\n");

export const buildBatchImportCompletedMarkdown = ({
  courseNames,
  parsedCount,
  createdCount,
  appendedCount,
  failedPhones = [],
  operatorName,
  eventTime = new Date(),
}) => {
  const failedCount = normalizeList(failedPhones).length;

  return [
    "# 学员批量导入结果",
    "",
    "> 状态：<font color=\"info\">执行完成</font>",
    `> 关联课程：${joinList(courseNames)}`,
    `> 解析总数：${Number(parsedCount) || 0}`,
    `> 新增账户：${Number(createdCount) || 0}`,
    `> 追加权限：${Number(appendedCount) || 0}`,
    `> 失败数量：<font color=\"warning\">${failedCount}</font>`,
    `> 操作人：${normalizeText(operatorName)}`,
    `> 操作时间：${formatMoment(eventTime)}`,
    "",
    `> 失败手机号：${buildPreview(failedPhones)}`,
    `> 说明：仅展示前 ${PREVIEW_LIMIT} 条，其余请后台查看`,
  ].join("\n");
};

export const buildCourseCreatedMarkdown = ({ courseName, tagNames = [], operatorName, eventTime = new Date() }) =>
  [
    "# 新课程创建通知",
    "",
    "> 状态：<font color=\"info\">课程创建成功</font>",
    `> 课程名称：${normalizeText(courseName)}`,
    `> 科目标签：${joinList(tagNames)}`,
    `> 创建人：${normalizeText(operatorName)}`,
    `> 创建时间：${formatMoment(eventTime)}`,
  ].join("\n");

export const buildCourseManualOpenMarkdown = ({ courseName, operatorName, eventTime = new Date() }) =>
  [
    "# 课程状态通知",
    "",
    "> 状态：<font color=\"info\">课程已开放</font>",
    `> 课程名称：${normalizeText(courseName)}`,
    "> 开放方式：管理员手动开放",
    `> 操作人：${normalizeText(operatorName)}`,
    `> 操作时间：${formatMoment(eventTime)}`,
  ].join("\n");

export const buildCourseManualCloseMarkdown = ({ courseName, operatorName, eventTime = new Date() }) =>
  [
    "# 课程状态通知",
    "",
    "> 状态：<font color=\"warning\">课程已关闭</font>",
    `> 课程名称：${normalizeText(courseName)}`,
    `> 操作人：${normalizeText(operatorName)}`,
    `> 操作时间：${formatMoment(eventTime)}`,
    "",
    "> 请留意学员端将不再显示该课程。",
  ].join("\n");

export const buildCourseAutoOpenSuccessMarkdown = ({ courseName, scheduledOpenTime, eventTime = new Date() }) =>
  [
    "# 课程自动开放通知",
    "",
    "> 状态：<font color=\"info\">自动开放成功</font>",
    `> 课程名称：${normalizeText(courseName)}`,
    `> 计划开放时间：${formatMoment(scheduledOpenTime)}`,
    `> 实际开放时间：${formatMoment(eventTime)}`,
  ].join("\n");

export const buildCourseAutoOpenFailureMarkdown = ({ courseName, scheduledOpenTime, errorMessage, eventTime = new Date() }) =>
  [
    "# 课程自动开放异常",
    "",
    "> 状态：<font color=\"warning\">自动开放失败</font>",
    `> 课程名称：${normalizeText(courseName)}`,
    `> 计划开放时间：${formatMoment(scheduledOpenTime)}`,
    `> 失败原因：${normalizeText(errorMessage)}`,
    `> 检测时间：${formatMoment(eventTime)}`,
    "",
    "> 请管理员尽快进入后台处理。",
  ].join("\n");

export const buildAudioUploadCompletedMarkdown = ({
  folderName,
  courseName,
  tagName,
  totalCount,
  successCount,
  failedNames = [],
  operatorName,
  eventTime = new Date(),
}) => {
  const failedCount = normalizeList(failedNames).length;

  return [
    "# 音频上传结果",
    "",
    "> 状态：<font color=\"info\">上传完成</font>",
    `> 上传位置：${normalizeText(folderName, "未分类")}`,
    `> 关联课程：${normalizeText(courseName, "音频库")}`,
    `> 默认标签：${normalizeText(tagName, "-")}`,
    `> 上传总数：${Number(totalCount) || 0}`,
    `> 成功数量：${Number(successCount) || 0}`,
    `> 失败数量：<font color=\"warning\">${failedCount}</font>`,
    `> 操作人：${normalizeText(operatorName)}`,
    `> 操作时间：${formatMoment(eventTime)}`,
    "",
    `> 失败音频：${buildPreview(failedNames)}`,
    `> 说明：仅展示前 ${PREVIEW_LIMIT} 条，其余请后台查看`,
  ].join("\n");
};

export const buildAudioUploadFailedMarkdown = ({
  folderName,
  courseName,
  tagName,
  fileNames = [],
  errorMessage,
  operatorName,
  eventTime = new Date(),
}) =>
  [
    "# 音频上传异常",
    "",
    "> 状态：<font color=\"warning\">上传失败</font>",
    `> 上传位置：${normalizeText(folderName, "未分类")}`,
    `> 关联课程：${normalizeText(courseName, "音频库")}`,
    `> 默认标签：${normalizeText(tagName, "-")}`,
    `> 音频文件：${buildPreview(fileNames)}`,
    `> 失败原因：${normalizeText(errorMessage)}`,
    `> 操作人：${normalizeText(operatorName)}`,
    `> 操作时间：${formatMoment(eventTime)}`,
  ].join("\n");

export const buildDailyActiveSummaryMarkdown = ({
  reportDate,
  totalUsers,
  activeUsersToday,
  courseStats = [],
  eventTime = new Date(),
}) => {
  const normalizedStats = Array.isArray(courseStats) ? courseStats : [];
  const visibleStats = normalizedStats.slice(0, 50);
  const remainingCount = Math.max(normalizedStats.length - visibleStats.length, 0);
  const courseLines = visibleStats.length
    ? visibleStats.map((item, index) => `> ${index + 1}. ${normalizeText(item.courseName)}：${Number(item.activeUsers) || 0} 人`).join("\n")
    : "> 暂无课程";

  return [
    "# 每日活跃汇总",
    "",
    `> 统计日期：${normalizeText(reportDate)}`,
    `> 发送时间：${formatMoment(eventTime)}`,
    `> 今日总活跃：<font color=\"info\">${Number(activeUsersToday) || 0}</font>`,
    `> 总用户数：${Number(totalUsers) || 0}`,
    "",
    "## 各课程活跃",
    courseLines,
    ...(remainingCount > 0 ? ["", `> 其余 ${remainingCount} 个课程请后台查看`] : []),
    "",
    "> 统计口径：今日 00:00 至当前时刻；总活跃按登录或播放行为去重，课程活跃按课程内播放行为去重。",
  ].join("\n");
};
