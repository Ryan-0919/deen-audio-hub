
# 音频系统

当前项目已从纯前端原型扩展为前后端一体化开发骨架：

- 前端：`React + Vite`
- 后端：`Express`
- 数据库：`MySQL`
- ORM：`Prisma 7`
- 文件存储：`阿里云 OSS`

## 启动前准备

1. 复制 `.env.example` 内容到 `.env`，填入 MySQL 和 OSS 配置。
2. 首次启动前请在 `.env` 中配置 `JWT_SECRET`、`ADMIN_ACCOUNT`、`ADMIN_PASSWORD`。
3. 执行 `npm install`
4. 执行 `npm run prisma:generate`
5. 执行 `npm run prisma:db-push`

## 启动命令

- 前端：`npm run dev:client`
- 后端：`npm run dev:server`

Vite 已配置 `/api` 代理到 `http://localhost:3001`。

## 环境说明

- `JWT_SECRET` 必填，不能继续使用示例占位值。
- `ADMIN_ACCOUNT` / `ADMIN_PASSWORD` 用于首次启动时自动创建管理员。
- `CORS_ORIGIN` 支持配置多个来源，使用英文逗号分隔。
- 用户账号需在后台用户管理中创建，默认密码为 `den2024`。
