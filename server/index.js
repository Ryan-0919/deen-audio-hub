import express from "express";
import cors from "cors";
import multer from "multer";
import { resumePendingAudioProcessingJobs } from "./lib/audio-processing.js";
import { config } from "./lib/config.js";
import { ok, fail } from "./lib/response.js";
import { prisma } from "./lib/prisma.js";
import { bootstrap } from "./lib/bootstrap.js";
import { startScheduledCourseSync } from "./lib/scheduler.js";
import { authRouter } from "./routes/auth.js";
import { userRouter } from "./routes/user.js";
import { adminRouter } from "./routes/admin.js";
import { lawUserRouter } from "./routes/law-user.js";
import { lawAdminRouter } from "./routes/law-admin.js";
import { shopUserRouter } from "./routes/shop-user.js";
import { shopAdminRouter } from "./routes/shop-admin.js";
import { paymentRouter } from "./routes/payment.js";

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

const allowedOrigins = new Set(config.corsOrigins);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);
const captureRawBody = (req, _res, buf, encoding) => {
  if (!buf?.length) return;
  req.rawBody = buf.toString(encoding || "utf8");
};

app.use(express.json({ limit: "20mb", verify: captureRawBody }));
app.use(express.urlencoded({ extended: true, limit: "20mb", verify: captureRawBody }));

app.get("/api/health", (_req, res) => {
  ok(res, { status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/user/laws", lawUserRouter);
app.use("/api/admin/laws", lawAdminRouter);
app.use("/api/user/shop", shopUserRouter);
app.use("/api/admin/shop", shopAdminRouter);
app.use("/api/user", userRouter);
app.use("/api/admin", adminRouter);

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return fail(res, "上传文件过大，请压缩后重试", 400);
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      return fail(res, "本次上传文件数量超出限制，请分批上传", 400);
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return fail(res, "上传字段不正确，请刷新页面后重试", 400);
    }

    return fail(res, "上传文件失败，请检查文件后重试", 400);
  }

  if (error?.statusCode && Number.isInteger(error.statusCode)) {
    return fail(res, error.message || "请求失败", error.statusCode);
  }

  console.error(error);
  return fail(res, error.message || "服务异常", 500);
});

const start = async () => {
  try {
    await prisma.$connect();
    await bootstrap();
    await resumePendingAudioProcessingJobs();
    startScheduledCourseSync(config.schedulerIntervalMs);
    app.listen(config.port, () => {
      console.log(`API server listening on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error("Server start failed:", error);
    process.exit(1);
  }
};

void start();
