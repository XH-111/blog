# Remaining Feature Closure Goal

本文档用于新的 active goal。目标是在本地把个人博客/CMS 当前最影响体验、最关键的未闭环功能补齐到可上线前验收的状态。

## 总规则

- 每个阶段只做本阶段范围内的改动，不做无关重构。
- 每个阶段完成后运行必要验证。
- 每个阶段验收成功后必须单独提交一次本地 git commit。
- 提交前必须确认 `git status --short` 和相关 `git diff`。
- 不提交 `.env`、日志、`dist/`、`node_modules/`、`public/uploads/`。
- 如果发现某阶段已有功能已经完成，只补充文档说明并提交文档，不强行重复实现。
- 如果某阶段无法在本地合理完成，记录原因，继续下一个阶段。

## 阶段状态

| 阶段 | 名称 | 状态 | Commit |
| --- | --- | --- | --- |
| 1 | 登录、评论、留言限流 | Done | this commit |
| 2 | 生产配置和启动安全检查 | Done | this commit |
| 3 | 数据库和上传目录备份闭环 | Done | this commit |
| 4 | 移动端核心流程复验和修复 | Done | this commit |
| 5 | 前台 mock 兜底和未接入提示收敛 | Done | this commit |
| 6 | 媒体库视频基础信息增强 | Pending | - |
| 7 | AI 任务历史列表和结果复看 | Pending | - |
| 8 | 精选文章排序配置 | Pending | - |
| 9 | 文章目录和代码高亮阅读体验 | Pending | - |
| 10 | 文章搜索体验继续增强 | Pending | - |
| 11 | 作者卡片和关注残留处理 | Pending | - |
| 12 | 最终文档和本地验收 | Pending | - |

## 阶段 1：登录、评论、留言限流

### 目标

- 给后台登录增加基础限流，降低暴力尝试风险。
- 给评论提交和留言提交增加基础限流，降低刷接口风险。
- 本阶段不做 AI 调用限流。

### 范围

- 后端原生 Node HTTP 层实现轻量内存限流即可。
- 限流维度优先使用 IP，必要时结合路径。
- 返回明确错误码，例如 `rate_limited`。
- 前端把限流错误展示成中文提示。

### 验收目标

- 连续多次错误登录后，后端返回限流错误。
- 评论或留言短时间连续提交超过阈值后，返回限流错误。
- 正常频率下登录、评论、留言不受影响。
- `node --check backend\src\server.js` 通过。
- `npm.cmd run build` 通过。

### 停止条件

限流在登录、评论、留言三条路径都能触发且正常请求不误伤后停止。

### 验收记录

- `node --check backend\src\server.js`：通过。
- `npm.cmd run build`：通过。
- 后端健康检查：`GET /api/health` 返回 `ok: true`。
- 登录限流：使用测试 IP 连续错误登录，第 6 次返回 `429 rate_limited`。
- 留言限流：使用测试 IP 连续提交，第 4 次返回 `429 rate_limited`。
- 评论限流：使用测试 IP 连续提交，第 6 次返回 `429 rate_limited`。
- 正常频率请求：单次登录、留言、评论请求未被限流。

### 提交信息

```text
feat: add basic public and admin rate limits
```

## 阶段 2：生产配置和启动安全检查

### 目标

- 让后端支持 `HOST` 配置。
- 启动时对关键生产配置给出清晰提示。
- 避免默认密码、默认数据库密码、缺失密钥被悄悄带到生产环境。

### 范围

- 修改后端配置读取和监听逻辑。
- 更新 `.env.example`。
- 不部署到服务器。
- 不引入复杂配置中心。

### 验收目标

- `HOST=0.0.0.0` 时后端能监听指定 host。
- 未设置 `HOST` 时本地仍保持现有开发体验。
- `.env.example` 包含必要配置说明。
- `node --check backend\src\server.js` 通过。

### 停止条件

配置读取、默认值、启动日志都清晰可理解后停止。

### 验收记录

- `backend/src/config.js` 已支持 `HOST` 和 `NODE_ENV`。
- 后端监听地址从硬编码 `127.0.0.1` 改为 `config.host`。
- `backend/.env.example` 已补充 `NODE_ENV`、`HOST`、`ADMIN_DEFAULT_PASSWORD`、`ADMIN_SESSION_DAYS`。
- 生产环境启动时会对 localhost 绑定、默认后台密码、开发数据库密码、联网搜索缺 Key 给出配置警告。
- `node --check backend\src\server.js`：通过。
- 使用 `HOST=127.0.0.1 PORT=18080` 启动临时后端，`GET /api/health` 返回 `ok: true`。

### 提交信息

```text
chore: harden server runtime configuration
```

## 阶段 3：数据库和上传目录备份闭环

### 目标

- 给 PostgreSQL 数据和 `public/uploads` 增加本地备份方案。
- 让用户能按文档执行一次完整备份。

### 范围

- 增加脚本或文档，优先用 PowerShell 友好的命令。
- 备份输出目录不提交。
- 不做云端自动备份。

### 验收目标

- 文档写清楚备份数据库、恢复数据库、备份上传目录的方法。
- 如增加脚本，脚本路径和用法写清楚。
- 备份产物被 `.gitignore` 排除。
- `git status --short` 不包含备份产物。

### 停止条件

按文档能完成一次本地备份流程，且不会误提交备份文件后停止。

### 验收记录

- 新增 `BACKUP.md`，写明数据库备份、数据库恢复、上传目录恢复方法。
- 新增 `backend/scripts/backup-local.ps1`，可备份 Docker PostgreSQL 和 `public/uploads`。
- 新增 `backend/scripts/restore-database.ps1`，可把 SQL 备份恢复到指定 Docker PostgreSQL。
- `.gitignore` 已忽略 `backups/`、`backup/`、`*.dump`、`*.sql.gz`。
- 使用 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\backend\scripts\backup-local.ps1` 完成一次本地备份。
- 备份产物包含 `blog_dev.sql` 和 `uploads.zip`。
- `git status --short --ignored backups ...` 显示 `backups/` 为 ignored，不会误提交。
- 两个 PowerShell 脚本均通过 `[scriptblock]::Create(...)` 解析检查。

### 提交信息

```text
docs: add local backup workflow
```

## 阶段 4：移动端核心流程复验和修复

### 目标

- 复验移动端首页、文章页、文章详情、留言板、关于页核心体验。
- 修复明显溢出、遮挡、按钮过小、横向滚动问题。

### 范围

- 只修前台核心路径。
- 后台移动端只保证不严重破版，不做完整移动后台。

### 验收目标

- 375px 宽度下首页首屏不横向滚动。
- 文章列表卡片、筛选、搜索可用。
- 文章详情正文、代码块、图片预览不撑破屏幕。
- 留言和评论输入框可正常提交。
- `npm.cmd run build` 通过。

### 停止条件

前台核心路径在窄屏可用，没有明显遮挡和横向滚动后停止。

### 验收记录

- Browser 插件访问 `127.0.0.1:5173` 被运行时网络策略拦截，错误为 `ERR_NETWORK_IO_SUSPENDED`；本阶段记录该 blocker，并使用系统 Chrome + Playwright fallback 验证。
- 375x812 视口复验：首页、文章页、文章详情、留言板、关于页均非空渲染。
- 修复关于页移动端 `.profile` 仍保留双列 `grid-template-areas` 导致整页横向滚动的问题；复验后关于页 `scrollWidth=375`。
- 文章详情代码块内部仍允许横向滚动，页面级 `scrollWidth=375`，不造成整页横向滚动。
- 修复评论和留言提交成功提示被数据刷新立即清空的问题。
- 移动端首页“开始阅读”按钮可跳转到 `/#/posts`。
- 移动端文章页搜索 `Transformer` 后进入 `/#/posts?q=Transformer`，显示 1 条搜索结果，且无横向滚动。
- 移动端留言和评论表单均可提交并显示成功提示；测试数据已通过后台 API 删除，数据库无 `mobile qa` 残留。
- `npm.cmd run build`：通过。
- 关于页仍有一条本地数据导致的 404 图片请求：`/uploads/1781419563675-c005ef93ddcb.png`，原因是数据库引用了未提交的上传文件；这是本地数据缺失，不是本阶段布局代码问题。

### 提交信息

```text
fix: improve mobile public experience
```

## 阶段 5：前台 mock 兜底和未接入提示收敛

### 目标

- 减少生产环境看到“mock”“未接入”“模拟”等开发提示。
- 后端不可用时展示更正式的空状态或错误状态。

### 范围

- 前台用户可见页面优先。
- 管理后台开发辅助提示可保留必要信息，但文案要专业。
- 不删除 mock 数据文件，避免开发兜底全部失效。

### 验收目标

- 前台首页、文章详情、留言板不出现生硬 mock 文案。
- “AI 思维导图未接入”等按钮隐藏或改成更合适的状态。
- 后端不可用时提示用户稍后重试，而不是展示假繁荣。
- `npm.cmd run build` 通过。

### 停止条件

前台用户视角不再看到明显开发态残留后停止。

### 验收记录

- 前台 `PublicDataNotice` 从 “mock 兜底数据” 改为正式的“离线预览数据”提示。
- 文章详情离线预览、点赞、评论禁用提示不再出现 `mock` 文案。
- 文章详情侧栏 `AI 摘要（模拟）` 改为 `文章摘要`，并隐藏不可用的 `AI 思维导图未接入` 按钮。
- 作者卡片移除未闭环的“粉丝”和“关注未接入”，改为可用的“了解作者”入口。
- 留言点赞离线状态提示不再出现 `mock` 文案。
- 375x812 视口检查首页、文章页、文章详情、留言板、关于页，公开页面文本未命中 `mock`、`模拟`、`未接入`、`AI 思维导图`。
- `npm.cmd run build`：通过。

### 提交信息

```text
fix: polish public fallback states
```

## 阶段 6：媒体库视频基础信息增强

### 目标

- 让媒体库视频比“只存 URL”更好用。
- 展示视频类型、大小、上传时间和可播放预览。

### 范围

- 不做转码。
- 不做服务端截图。
- 可以使用 HTML5 video 做预览。

### 验收目标

- 上传视频后媒体库能识别为视频。
- 视频卡片或列表能直接预览播放。
- 筛选图片/视频时行为正确。
- 删除保护仍不破坏图片引用保护逻辑。
- `npm.cmd run build` 和 `node --check backend\src\server.js` 通过。

### 停止条件

视频在媒体库中可识别、可筛选、可预览后停止。

### 提交信息

```text
feat: improve video media previews
```

## 阶段 7：AI 任务历史列表和结果复看

### 目标

- 后台编辑器 AI 摘要、评论、润色产生的结果可在任务历史中查看。
- 支持重新打开历史输出和来源链接。

### 范围

- 复用已有 `ai_tasks` 数据。
- 不做 AI 限流。
- 不做复杂 diff 对比。

### 验收目标

- AI 调用成功后写入任务记录。
- 编辑器或后台能看到最近 AI 任务。
- 点击历史任务可以查看工具类型、要求、输出、来源。
- `npm.cmd run build` 和 `node --check backend\src\server.js` 通过。

### 停止条件

AI 历史能完成“生成 -> 记录 -> 复看”闭环后停止。

### 提交信息

```text
feat: add ai task history review
```

## 阶段 8：精选文章排序配置

### 目标

- 让精选文章不仅能开关，还能控制展示顺序。
- 前台精选列表按后台排序展示。

### 范围

- 后台文章列表或独立区域支持调整精选排序。
- 不做复杂拖拽也可以，数字排序或上移下移均可。

### 验收目标

- 后台可调整精选文章顺序。
- 前台首页/文章页精选展示顺序和后台一致。
- 非精选文章不受影响。
- `npm.cmd run build` 和 `node --check backend\src\server.js` 通过。

### 停止条件

精选顺序可配置、保存后刷新仍生效后停止。

### 提交信息

```text
feat: add featured post ordering
```

## 阶段 9：文章目录和代码高亮阅读体验

### 目标

- 长文阅读时有目录导航。
- 代码块有基础语法高亮或更清晰的语言展示。

### 范围

- 优先复用现有 sections 数据。
- 不引入过重依赖，除非收益明确。
- 代码高亮可以先做轻量主题和语言标签增强。

### 验收目标

- 有二级或三级标题的文章显示目录。
- 点击目录能跳到对应章节。
- 代码块语言名、复制按钮、横向滚动体验正常。
- 移动端目录不遮挡正文。
- `npm.cmd run build` 通过。

### 停止条件

文章详情长文目录和代码块阅读体验明显可用后停止。

### 提交信息

```text
feat: improve article reading navigation
```

## 阶段 10：文章搜索体验继续增强

### 目标

- 在现有轻量搜索基础上增强可用性。
- 搜索结果展示命中信息和更清楚的状态。

### 范围

- 不做外部搜索引擎。
- 可以优化后端查询字段、前端高亮、结果空状态。

### 验收目标

- 搜索标题、摘要、正文关键词能返回合理结果。
- 搜索结果能显示关键词或命中摘要。
- 清空搜索、切换分类、切换排序状态不混乱。
- `npm.cmd run build` 和 `node --check backend\src\server.js` 通过。

### 停止条件

文章搜索完成“输入 -> 命中 -> 查看 -> 清空”闭环后停止。

### 提交信息

```text
feat: improve public article search
```

## 阶段 11：作者卡片和关注残留处理

### 目标

- 处理前台作者卡片里的“关注未接入”“粉丝”等未闭环内容。
- 保持个人博客定位，不强行做社交系统。

### 范围

- 可以隐藏关注按钮和粉丝数。
- 或改为跳转关于页、GitHub、留言板等真实行为。

### 验收目标

- 前台不再出现无法使用的关注按钮。
- 作者信息来自关于页或站点配置，避免硬编码冲突。
- `npm.cmd run build` 通过。

### 停止条件

作者卡片没有未闭环社交功能残留后停止。

### 提交信息

```text
fix: close author card interaction gaps
```

## 阶段 12：最终文档和本地验收

### 目标

- 更新本文档阶段状态、commit hash 和验证结果。
- 记录仍延期事项。
- 做最终本地验收。

### 验收目标

- 本文档列出全部阶段状态。
- 每个完成阶段都有对应本地 git commit。
- `npm.cmd run build` 通过。
- `node --check backend\src\server.js` 通过。
- `Invoke-RestMethod http://127.0.0.1:8000/api/health` 通过。
- `git status --short` 干净，或只剩明确不提交文件。

### 停止条件

文档更新、最终验证通过、最后一次提交完成后停止。

### 提交信息

```text
docs: summarize remaining feature closure
```

## 最终输出要求

- 列出已完成阶段。
- 列出每个阶段 commit hash。
- 列出验证结果。
- 列出仍延期事项。
- 给出当前 `git status --short` 结果。
