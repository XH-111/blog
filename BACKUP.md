# 本地备份与恢复

本文档用于本地开发和上线前手动备份演练。当前博客需要备份两类数据：

- PostgreSQL 数据库：文章、分类、标签、评论、留言、媒体记录、站点配置等。
- 上传目录：`public/uploads/` 下的图片、视频和其他上传文件。

备份产物默认放在 `backups/`，该目录已加入 `.gitignore`，不要提交到 Git。

## 前置条件

- Docker 中 PostgreSQL 容器名为 `blog-postgres`。
- 数据库名为 `blog_dev`。
- 数据库用户为 `blog`。
- 当前命令在项目根目录 `D:\project\blog` 执行。

如果服务器上的容器名、数据库名或用户不同，执行脚本时传入参数覆盖默认值。

## 一键本地备份

```powershell
.\backend\scripts\backup-local.ps1
```

如果 Windows 提示禁止运行脚本，可以使用：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\backend\scripts\backup-local.ps1
```

默认会生成类似目录：

```text
backups/
└─ 20260618-235959/
   ├─ blog_dev.sql
   └─ uploads.zip
```

可选参数：

```powershell
.\backend\scripts\backup-local.ps1 `
  -OutputRoot backups `
  -Container blog-postgres `
  -Database blog_dev `
  -User blog `
  -UploadsPath public\uploads
```

## 恢复数据库

恢复前建议先确认目标数据库就是你要覆盖的数据库。恢复 SQL 会把备份文件中的语句重新导入到目标数据库。

```powershell
.\backend\scripts\restore-database.ps1 -DbBackupPath .\backups\20260618-235959\blog_dev.sql
```

如果 Windows 提示禁止运行脚本，可以使用：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\backend\scripts\restore-database.ps1 -DbBackupPath .\backups\20260618-235959\blog_dev.sql
```

可选参数：

```powershell
.\backend\scripts\restore-database.ps1 `
  -DbBackupPath .\backups\20260618-235959\blog_dev.sql `
  -Container blog-postgres `
  -Database blog_dev `
  -User blog
```

## 恢复上传目录

上传目录恢复建议先备份当前目录，然后再解压旧备份：

```powershell
Rename-Item public\uploads uploads-before-restore
New-Item -ItemType Directory -Force public\uploads
Expand-Archive .\backups\20260618-235959\uploads.zip -DestinationPath public\uploads -Force
```

如果你只是想补回部分图片或视频，可以手动打开 `uploads.zip`，只复制需要的日期目录。

## 上线前建议

- 每次上线前做一次数据库和上传目录备份。
- 每次大批量修改文章、媒体、分类前做一次备份。
- 服务器部署后，把 `backups/` 放到项目目录外或挂载到单独数据盘。
- 重要备份不要只放服务器本机，至少再复制到本地电脑或对象存储。
- 定期做一次恢复演练，确认备份文件真的可用。
