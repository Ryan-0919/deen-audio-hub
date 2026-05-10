# 得宝平台阿里云上线手册（denlaw.cn）

更新时间：2026-05-10

## 1. 本次上线目标

将当前项目上线到阿里云服务器，并绑定正式域名：

- 正式域名：`denlaw.cn`
- HTTPS：使用你已经购买好的证书
- 运行方式：
  - `Nginx` 负责 HTTPS、静态文件和反向代理
  - 前端使用 `vite build` 后生成的 `dist`
  - 后端 Node 服务监听本机 `3001`
  - 数据库建议使用服务器本机 MySQL / MariaDB，或阿里云 RDS

## 2. 不要直接“全盘清空”服务器

如果服务器上还有旧项目，正确顺序不是直接删目录，而是：

1. 先确认旧项目现在到底占用了什么
2. 先备份旧项目目录和旧 Nginx 配置
3. 停掉旧服务
4. 再删除旧站点目录或替换为新项目

这样可以避免把以下东西一起误删：

- SSL 证书文件
- 旧 Nginx 配置
- 旧项目数据库
- 旧项目上传文件
- 你自己后面还要参考的环境变量

## 3. 建议的线上目录结构

建议统一使用下面的目录结构：

```bash
/srv/denlaw/
  app/                 # 项目代码
  current/             # 当前上线版本（可选软链接）
  shared/
    .env.production    # 生产环境变量
    uploads/           # 如果以后要做本地存储可放这里
  backups/             # 备份目录
```

如果你不想做多版本，也可以先简化成：

```bash
/srv/denlaw/app
```

## 4. 服务器上先做什么

先登录服务器后执行这些检查。

### 4.1 看旧站点和端口

```bash
pwd
ls -la
sudo nginx -t
sudo systemctl status nginx
sudo ss -lntp | grep -E '80|443|3001|5173'
ps -ef | grep node
pm2 list
```

重点看清楚：

- 旧项目目录在哪里
- 是否有 `pm2` 在跑旧 Node 服务
- `80` / `443` 被谁占用
- 是否已有旧的 `server_name denlaw.cn`

### 4.2 先备份

假设旧项目目录在 `/var/www/old-project`，先备份：

```bash
sudo mkdir -p /srv/denlaw/backups
sudo tar -czf /srv/denlaw/backups/old-project-$(date +%F-%H%M%S).tar.gz /var/www/old-project
sudo cp -r /etc/nginx /srv/denlaw/backups/nginx-$(date +%F-%H%M%S)
```

如果旧项目已经确定完全废弃，后面再删。

## 5. 建议的运行方式

本项目线上建议这样跑：

### 5.1 前端

- 本地或服务器执行 `npm run build`
- 产物在 `dist/`
- `Nginx` 直接托管 `dist/`

### 5.2 后端

- 用 `node server/index.js` 启动
- 对外不直接暴露 `3001`
- 只让 `Nginx` 反代 `/api`

### 5.3 为什么不用线上跑 Vite

因为 Vite 开发服务只适合开发环境。

线上必须使用：

- `vite build`
- `Nginx` 托管静态文件

## 6. 本项目生产环境变量

至少准备这些：

```env
PORT=3001
DATABASE_URL="mysql://root:你的密码@127.0.0.1:3306/audio_system"
JWT_SECRET="换成强随机字符串"
ADMIN_ACCOUNT="你的后台账号"
ADMIN_PASSWORD="你的后台密码"

CORS_ORIGIN="https://denlaw.cn,https://www.denlaw.cn"

OSS_REGION="你的 OSS 地域"
OSS_BUCKET="你的 OSS Bucket"
OSS_ACCESS_KEY_ID="你的 OSS AK"
OSS_ACCESS_KEY_SECRET="你的 OSS SK"
OSS_PUBLIC_BASE_URL=""

MOCK_EXAM_AI_PROVIDER="rules"
MOCK_EXAM_AI_BASE_URL=""
MOCK_EXAM_AI_API_KEY=""
MOCK_EXAM_AI_MODEL=""
MOCK_EXAM_AI_TIMEOUT_MS="120000"

PAY_SITE_BASE_URL="https://denlaw.cn"
PAY_NOTIFY_BASE_URL="https://denlaw.cn"
WECHAT_PAY_H5_APP_URL="https://denlaw.cn"

VITE_API_BASE_URL=""
VITE_SITE_URL="https://denlaw.cn"
```

说明：

- `VITE_API_BASE_URL` 线上建议留空
  - 因为前端走同域名 `/api`
  - 由 `Nginx` 转发到 `http://127.0.0.1:3001`
- 如果你暂时不接真实 AI，可以先保留 `rules`
- 如果你要上传封面、Logo、音频等，`OSS` 必须配好

## 7. 证书怎么放

假设你已经有：

- 证书公钥文件：`fullchain.pem`
- 私钥文件：`privkey.key`

建议放到：

```bash
/etc/nginx/ssl/denlaw.cn/fullchain.pem
/etc/nginx/ssl/denlaw.cn/privkey.key
```

并设置权限：

```bash
sudo mkdir -p /etc/nginx/ssl/denlaw.cn
sudo chmod 700 /etc/nginx/ssl/denlaw.cn
sudo chmod 600 /etc/nginx/ssl/denlaw.cn/*
```

## 8. Nginx 推荐配置

推荐站点配置文件：

`/etc/nginx/conf.d/denlaw.cn.conf`

```nginx
server {
    listen 80;
    server_name denlaw.cn www.denlaw.cn;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name denlaw.cn www.denlaw.cn;

    ssl_certificate     /etc/nginx/ssl/denlaw.cn/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/denlaw.cn/privkey.key;

    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /srv/denlaw/app/dist;
    index index.html;

    client_max_body_size 200m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

注意：

- 本项目是前端路由应用，`try_files ... /index.html` 必须有
- `proxy_read_timeout` 建议放大一点，避免某些接口超时过快

## 9. 后端常驻建议

建议使用 `systemd`，不要直接开着一个终端跑。

服务文件建议：

`/etc/systemd/system/denlaw-api.service`

```ini
[Unit]
Description=denlaw api service
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/denlaw/app
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/srv/denlaw/shared/.env.production
User=root

[Install]
WantedBy=multi-user.target
```

然后执行：

```bash
sudo systemctl daemon-reload
sudo systemctl enable denlaw-api
sudo systemctl restart denlaw-api
sudo systemctl status denlaw-api
```

## 10. 数据库准备

如果服务器本机已经有 MySQL / MariaDB：

```bash
mysql -uroot -p
CREATE DATABASE audio_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit
```

然后在项目目录执行：

```bash
npx prisma generate
npx prisma db push
```

注意：

- `db push` 会按当前 Prisma 结构落库
- 正式环境操作前，先确认是不是全新库

## 11. 上线步骤

### 第一步：把代码放上去

你可以：

- `git clone`
- 或本地打包后上传

推荐目录：

```bash
/srv/denlaw/app
```

### 第二步：安装依赖

```bash
cd /srv/denlaw/app
npm install
```

### 第三步：写生产环境变量

把环境变量写到：

```bash
/srv/denlaw/shared/.env.production
```

### 第四步：初始化数据库

```bash
cd /srv/denlaw/app
npx prisma generate
npx prisma db push
```

### 第五步：构建前端

```bash
cd /srv/denlaw/app
npm run build
```

### 第六步：启动后端

```bash
sudo systemctl restart denlaw-api
sudo systemctl status denlaw-api
```

### 第七步：启用 Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl status nginx
```

## 12. 如果要“清空旧项目”，正确删法

确认新项目已经能跑后，再删旧项目。

例如旧目录是：

```bash
/var/www/old-project
```

先再次确认路径：

```bash
readlink -f /var/www/old-project
ls -la /var/www/old-project
```

确认无误后再删：

```bash
sudo rm -rf /var/www/old-project
```

不要对不确定的路径直接执行 `rm -rf`。

## 13. 上线后检查项

至少检查这些：

- `https://denlaw.cn/` 可打开
- 门户首页静态资源正常
- 登录页正常
- 用户登录正常
- 后台登录正常
- `/api/health` 正常返回
- 课程列表、试卷列表、首页配置、门户配置接口正常
- 上传 Logo / 封面 / Banner 正常
- OSS 图片能正常回显

## 14. 当前最关键的现实问题

你现在马上要注意的不是“怎么删服务器”，而是这几个点：

1. 你要先确认服务器系统环境
   - 是否有 `Node`
   - 是否有 `Nginx`
   - 是否有 `MySQL`
   - 是否有 `pm2`

2. 你要先确认旧项目怎么跑的
   - 是 `pm2`
   - 是 `systemd`
   - 还是 Docker

3. 你要先确认证书文件在哪里
   - 不要删旧站的时候把证书一起删了

4. 你要先确认域名解析
   - `denlaw.cn`
   - `www.denlaw.cn`
   - 都要先指向这台阿里云服务器公网 IP

## 15. 当前建议的上线顺序

建议你按这个顺序来：

1. 上服务器查旧项目、端口、Nginx、证书位置
2. 做备份
3. 准备新项目目录和 `.env.production`
4. 建库并执行 `prisma db push`
5. 构建前端
6. 启动 Node 后端
7. 配 Nginx + 证书
8. 验证 `denlaw.cn`
9. 新站没问题后，再删除旧项目

如果你下一步要我继续，我建议直接进入：

- “生成你服务器实际可执行的命令清单”
- 或者“我根据你服务器信息，帮你出最终部署命令”
