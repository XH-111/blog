# 下一轮本地功能增强路线图

本文档用于新的 active goal。目标是在不处理部署事项、不做 AI 调用限流的前提下，继续补齐个人博客/CMS 的本地产品闭环。

## 总原则

- 不处理部署、服务器、Docker、Nginx、HTTPS、域名、安全组。
- 不做 AI 调用限流。
- 不提交 `.env`、日志、`dist/`、`node_modules/`、`public/uploads/` 或任何真实密钥。
- 每个阶段只做本阶段范围内改动，不做无关重构。
- 每个阶段完成后运行必要验证。
- 每个阶段验收成功后必须单独提交一次本地 git commit。
- 如果某阶段发现已有功能已经完成，只补充文档说明，不强行重复实现。
- 如果某阶段无法在本地合理完成，记录原因，继续下一个阶段。

## 阶段状态

| 阶段 | 名称 | 状态 | Commit |
| --- | --- | --- | --- |
| 1 | 站点基础设置模块 | Done | `618ccf7` |
| 2 | 密码文章访问闭环 | Done | `5f54c08` |
| 3 | 文章列表分页或加载更多 | Done | `c55dae0` |
| 4 | 媒体库服务端分页 | Done | `5df7871` |
| 5 | 后台全局搜索 | Done | `f02b1d6` |
| 6 | 文章详情相关文章推荐 | Done | `67551b3` |
| 7 | 文章版本历史和恢复 | Done | `1a450a0` |
| 8 | 评论和留言后台筛选增强 | Done | `d174f21` |
| 9 | SEO 和分享信息完善 | Done | `7ca250c` |
| 10 | 最终文档和本地验收 | Done | this commit |

## 完成记录

完成时间：2026-06-18

最终验收：

- `node --check backend\src\server.js` 通过。
- `npm.cmd run build` 通过。
- 未提交 `.env`、日志、`dist/`、`node_modules/`、`public/uploads/` 或真实密钥。

## 阶段 1：站点基础设置模块

### 任务

- 新增后台站点基础设置页或扩展现有设置页。
- 支持配置站点名称、站点副标题、Logo URL、SEO 默认标题、SEO 描述、ICP备案/页脚文案。
- 前台 Header、页面 title 或可见页脚使用这些配置。

### 验收目标

- 后台能保存配置。
- 刷新前台后配置生效。
- 配置为空时有合理默认值。

### 验证命令

```powershell
npm.cmd run build
node --check backend\src\server.js
```

### 停止条件

站点基础配置可保存、可读取、前台可展示后停止。

### 提交信息

```text
feat: add site settings module
```

## 阶段 2：密码文章访问闭环

### 任务

- 让 `visibility=password` 的文章支持前台密码访问。
- 后台编辑器支持填写访问密码或密码提示。
- 前台详情页遇到密码文章时显示输入框，密码正确后展示正文。
- 密码不要明文返回给前台。

### 验收目标

- 公开文章访问不受影响。
- 私密文章前台仍不可访问。
- 密码文章输入错误提示明确，输入正确能阅读。

### 验证命令

```powershell
npm.cmd run build
node --check backend\src\server.js
```

### 停止条件

密码文章从后台配置到前台访问完整闭环后停止。

### 提交信息

```text
feat: add password protected posts
```

## 阶段 3：文章列表分页或加载更多

### 任务

- 文章页“精选 / 全部 / 分类 / 搜索”支持分页或加载更多。
- 每页默认 10 条。
- 当前页码或加载状态清晰。
- 无更多数据时禁用按钮或显示提示。

### 验收目标

- 文章超过 10 条时不会一次性全部展示。
- 切换分类、搜索、排序时分页状态正确重置。
- 刷新后 URL 状态合理保留。

### 验证命令

```powershell
npm.cmd run build
node --check backend\src\server.js
```

### 停止条件

前台文章列表分页主流程可用后停止。

### 提交信息

```text
feat: add public post pagination
```

## 阶段 4：媒体库服务端分页

### 任务

- 后台媒体库支持 `page` / `pageSize`。
- 前端媒体库支持上一页/下一页或加载更多。
- 保留现有图片/视频筛选和搜索体验。

### 验收目标

- 媒体多时不会只依赖一次性前 50 条。
- 翻页后列表正确变化。
- 搜索和类型筛选行为明确。

### 验证命令

```powershell
npm.cmd run build
node --check backend\src\server.js
```

### 停止条件

媒体库分页可用，原有上传/预览/删除不被破坏后停止。

### 提交信息

```text
feat: paginate media library
```

## 阶段 5：后台全局搜索

### 任务

- 让后台顶部搜索框真正可用。
- 支持搜索文章标题、分类、标签、媒体文件名。
- 搜索结果可以跳转到对应管理页或编辑页。

### 验收目标

- 输入关键词后能看到结果。
- 点击文章结果进入编辑器。
- 无结果时显示友好空状态。

### 验证命令

```powershell
npm.cmd run build
node --check backend\src\server.js
```

### 停止条件

后台全局搜索能完成“输入关键词 -> 看到结果 -> 跳转处理”后停止。

### 提交信息

```text
feat: add admin global search
```

## 阶段 6：文章详情相关文章推荐

### 任务

- 文章详情页底部展示相关文章。
- 优先按同分类、同标签推荐。
- 不推荐当前文章。
- 无推荐时隐藏模块或显示轻量空状态。

### 验收目标

- 同分类/同标签文章能出现在推荐区。
- 点击推荐文章能跳转详情。
- 当前文章不会重复出现。

### 验证命令

```powershell
npm.cmd run build
node --check backend\src\server.js
```

### 停止条件

文章详情推荐阅读闭环可用后停止。

### 提交信息

```text
feat: add related posts
```

## 阶段 7：文章版本历史和恢复

### 任务

- 保存文章时记录版本快照。
- 后台编辑器可查看历史版本。
- 支持从某个历史版本恢复标题、摘要、正文等主要内容。

### 验收目标

- 多次保存后能看到多个版本。
- 点击恢复后编辑器内容变为历史内容。
- 恢复后需要再次保存才覆盖当前文章。

### 验证命令

```powershell
npm.cmd run build
node --check backend\src\server.js
```

### 停止条件

文章版本查看和恢复主流程可用后停止。

### 提交信息

```text
feat: add post version history
```

## 阶段 8：评论和留言后台筛选增强

### 任务

- 后台评论、留言支持按状态筛选：全部 / 待审核 / 已通过 / 已驳回。
- 支持关键词搜索作者和内容。
- 保留现有批量通过、驳回、删除功能。

### 验收目标

- 状态筛选结果正确。
- 搜索结果正确。
- 批量操作只作用于当前选中的行。

### 验证命令

```powershell
npm.cmd run build
node --check backend\src\server.js
```

### 停止条件

评论和留言审核列表筛选搜索可用后停止。

### 提交信息

```text
feat: improve comment message moderation filters
```

## 阶段 9：SEO 和分享信息完善

### 任务

- 文章详情页根据文章标题、摘要、封面设置 `document.title` 和 `meta description`。
- 站点默认 SEO 使用站点基础设置。
- 缺失摘要或封面时使用合理默认值。

### 验收目标

- 进入文章详情后浏览器 title 变为文章标题。
- 首页、文章页、关于页有合理 title。
- 不影响现有路由。

### 验证命令

```powershell
npm.cmd run build
```

### 停止条件

前台核心页面 SEO 元信息基础可用后停止。

### 提交信息

```text
feat: improve public seo metadata
```

## 阶段 10：最终文档和本地验收

### 任务

- 更新本文档 10 个阶段完成状态、commit hash、验证命令结果。
- 记录仍延期事项：部署、AI 限流、OSS/CDN、视频转码、多管理员权限等。
- 运行最终验证。

### 验收目标

- 文档列出全部阶段状态。
- `git log --oneline -10` 能看到阶段性提交。
- `git status --short` 干净，或只剩明确不提交文件。

### 验证命令

```powershell
npm.cmd run build
node --check backend\src\server.js
Invoke-RestMethod http://127.0.0.1:8000/api/health
git status --short
git log --oneline -10
```

### 停止条件

文档更新、最终验证通过、最后一次提交完成后停止。

### 提交信息

```text
docs: summarize next local feature roadmap
```

## 最终输出要求

- 列出已完成 10 个阶段。
- 列出每个阶段 commit hash。
- 列出验证结果。
- 列出延期事项。
- 给出当前 git status。
