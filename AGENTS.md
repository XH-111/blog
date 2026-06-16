# AGENTS.md

本文件是给 Codex / AI agent 的项目工作规约。开始修改本仓库前，请先阅读本文件和 `PROJECT_CONTEXT.md`。

## 项目概况

这是一个全栈博客/CMS 项目。

- 前端：React + Vite + TypeScript
- 后端：Node.js 原生 HTTP server
- 数据库：PostgreSQL
- Docker 服务：`blog-postgres`
- 前端开发地址：`http://127.0.0.1:5173`
- 后端 API 地址：`http://127.0.0.1:8000`
- 默认后台账号：`admin`
- 默认后台密码：`password`

## 开始工作前

动手改代码前，先阅读：

- `PROJECT_CONTEXT.md`
- `package.json`
- 与任务相关的 `src/` 文件
- 与任务相关的 `backend/src/` 文件

搜索代码优先使用：

```powershell
rg "关键词"
```

## 常用验证命令

前端构建：

```powershell
npm.cmd run build
```

后端语法检查：

```powershell
node --check backend\src\server.js
```

后端健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

数据库连接：

```powershell
docker exec blog-postgres psql -U blog -d blog_dev
```

## Git 规则

- 修改前先执行 `git status --short`。
- 不要执行 `git reset --hard`，除非用户明确要求。
- 不要执行大范围 `git restore .`，除非用户明确要求。
- 每次提交只提交相关改动。
- 提交前确认 `git diff` 或 `git diff --cached`。
- 当前本地提交：
  - `bd1d34c Initial local project baseline`
  - `f60678c Add project context handoff notes`

## 编辑规则

- 优先做小而清晰的改动。
- 遵循项目已有写法，不要随意引入新框架。
- 手动编辑文件优先使用 `apply_patch`。
- 不要编辑或提交这些目录：
  - `node_modules/`
  - `dist/`
  - `public/uploads/`
- 不要提交 `.env`、日志文件、运行时上传文件。

## 前端说明

主要文件：

- `src/App.tsx`
- `src/services/api.ts`
- `src/styles.css`
- `public/assets/`

路由使用 hash，例如：

- `/#/`
- `/#/about`
- `/#/admin/editor`

前端改动后至少执行：

```powershell
npm.cmd run build
```

涉及 UI 行为时，用浏览器验证：

```text
http://127.0.0.1:5173
```

## 后端说明

主要文件：

- `backend/src/server.js`
- `backend/src/config.js`
- `backend/src/db.js`
- `backend/db/migrations/001_init.sql`
- `backend/scripts/seed.js`

后端改动后执行：

```powershell
node --check backend\src\server.js
```

如果后端逻辑变了，需要重启后端开发服务。

## 当前重要业务规则

- 新建文章默认应为空白。
- 媒体上传保存到 `public/uploads/yyyy/mm/dd`。
- 媒体记录保存到 `media_assets`。
- 如果图片被文章封面或正文引用，媒体库不能删除该图片。
- 关于页关注区只保留 GitHub 和微信。
- 微信二维码从关于页配置里通过媒体库选择。
- 邮箱和手机号在关于页是纯文本，不是可点击链接。
- 文章编辑器支持正文图片上传、媒体库插入、表格预览和文章表格展示。

## 沟通要求

- 使用中文回复用户。
- 解释要清楚，让用户能学会自己操作。
- 有风险的操作先说明风险。
- 不要为了重构而重构，优先解决当前需求。
