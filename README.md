# 全栈博客创作平台

一个面向个人创作者的全栈博客 / CMS 项目，支持文章创作、精选展示、留言互动、媒体管理、站点配置和 AI 写作辅助。项目使用 React + Vite + TypeScript 构建前端，Node.js 原生 HTTP Server 提供后端 API，PostgreSQL 持久化数据，并提供 Docker 化生产部署方案。

如果你也想搭建一个可长期维护、可配置、带后台管理和 AI 辅助能力的个人博客，这个项目可以作为完整参考。

## 在线预览

- 站点地址：[https://hechenxu.cn](https://hechenxu.cn)
- 后台入口：`/#/admin/login`

> 后台账号、API Key 等敏感信息请使用自己的环境变量或后台配置，不要提交到仓库。

## 项目亮点

- **前台完整闭环**：首页、文章页、文章详情、关于页、留言板、搜索、点赞、评论。
- **后台内容管理**：文章发布、草稿、回收站、精选文章、分类标签、媒体库、留言评论审核。
- **可配置首页**：支持首页封面图/视频、拖拽调整位置、缩放、遮罩、标题文案和入口卡片配置。
- **AI 写作辅助**：支持 AI 摘要、AI 评论、AI 润色、选中区域润色、润色撤销、AI 配置后台化。
- **媒体库优化**：上传图片自动生成 WebP 缩略图和展示图，浏览渲染更轻量。
- **生产部署友好**：Docker Compose + PostgreSQL + Caddy，支持 HTTPS、静态资源、上传目录持久化。

## 界面展示

### 首页

支持可配置图片/视频封面、主副按钮、入口卡片和前台导航。

![首页](picture/readme-home.png)

### 文章列表

默认展示精选文章，支持分类切换、搜索、排序和分页。

![文章列表](picture/readme-article-list.png)

### 留言板

支持访客留言、站长回复、审核状态、最新留言和关于我侧栏展示。

![留言板](picture/readme-message-board.png)

### 文章编辑器 + AI 助手

Markdown 编辑、实时预览、封面选择、分类标签、精选推荐、AI 润色 / 评论 / 摘要都在同一个编辑工作台完成。

![文章编辑器](picture/readme-editor-ai.png)

### 首页配置

后台可配置首页标题、按钮、介绍文案、封面图片/视频，并支持拖拽、缩放和保存前预览。

![首页配置](picture/readme-home-config.png)

### AI 设置

千问 API Key、模型、联网搜索开关都可以在后台配置。前端只显示脱敏 Key，实际调用由后端完成。

![AI 设置](picture/readme-ai-settings.png)

## 基本功能

### 前台

- 首页封面和入口卡片
- 精选文章和分类文章
- 文章详情 Markdown 渲染
- 文章点赞、评论、复制链接
- 留言板发布与展示
- 关于我页面
- 搜索文章
- 深色模式入口

### 后台

- 管理员登录
- 修改管理员密码
- 文章新建、编辑、发布、草稿、回收站
- 精选文章设置和排序
- 分类、标签管理
- 媒体上传、预览、删除保护
- 评论审核、显示/隐藏
- 留言审核、站长回复
- 批量导入文章和评论
- 站点基础设置
- 首页配置
- 关于页配置
- AI 设置

### AI 能力

- AI 摘要：生成文章卡片摘要
- AI 评论：检查知识性、结构性或优化建议
- AI 润色：优化全文或选中区域
- 润色撤销：保留上一次 AI 修改快照
- 联网核查：可通过百炼 web_search 工具开启
- 后台配置 Key：不把明文 Key 暴露给浏览器

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | React 19, Vite 7, TypeScript |
| 后端 | Node.js 原生 HTTP Server |
| 数据库 | PostgreSQL |
| 图片处理 | Sharp |
| 部署 | Docker, Docker Compose, Caddy |
| AI | 千问 / DashScope 兼容接口 |

## 本地启动

### 1. 安装依赖

```powershell
npm install
```

### 2. 启动 PostgreSQL

```powershell
docker compose up -d postgres
```

默认数据库连接：

```text
postgres://blog:blog123456@127.0.0.1:5432/blog_dev
```

### 3. 初始化数据库

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
```

### 4. 启动后端

```powershell
npm.cmd run backend:dev
```

后端地址：

```text
http://127.0.0.1:8000
```

### 5. 启动前端

```powershell
npm.cmd run dev
```

前端地址：

```text
http://127.0.0.1:5173
```

## 常用命令

```powershell
# 前端构建
npm.cmd run build

# 后端语法检查
node --check backend\src\server.js

# 数据库迁移
npm.cmd run db:migrate

# 初始化演示数据
npm.cmd run db:seed
```

## 生产部署

项目提供生产部署文件：

- `Dockerfile`
- `deploy/docker-compose.prod.yml`
- `deploy/Caddyfile`
- `deploy/remote-deploy.sh`

生产环境需要准备 `.env`，至少包含数据库、管理员密码、域名、AI Key 等配置。部署后由 Caddy 提供 HTTPS、静态前端、上传资源和 `/api` 反向代理。

## 目录结构

```text
.
├── backend/              # Node.js 后端、数据库脚本、迁移
├── deploy/               # 生产部署配置
├── picture/              # README 与设计展示图
├── public/               # 静态资源和上传目录
├── src/                  # React 前端源码
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 安全说明

- 不要提交 `.env`、API Key、服务器密码、上传文件。
- AI Key 只应由后端保存和调用，前端不应拿到明文。
- 生产环境请修改默认管理员密码。
- 数据库和上传目录需要定期备份。

## Star

如果这个项目对你搭建个人博客、学习全栈开发、实现后台 CMS 或接入 AI 写作辅助有帮助，欢迎点一个 Star。

