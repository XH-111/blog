# Project Context

This file is a handoff note for continuing the project in a new Codex thread or when returning later.

## Project

- Workspace: `D:\project\blog`
- Stack: React/Vite frontend, Node.js native HTTP backend, PostgreSQL
- Shell: Windows PowerShell
- Frontend dev URL: `http://127.0.0.1:5173`
- Backend API URL: `http://127.0.0.1:8000`
- Database: Docker container `blog-postgres`, database `blog_dev`
- Default admin login: `admin` / `password`
- Local Git baseline: `bd1d34c Initial local project baseline`
- No remote repository is configured yet.

## Working Rules

- Read code before editing.
- Prefer `rg` for searching.
- Use `apply_patch` for manual code edits.
- Do not use `git reset --hard` or broad restore commands unless explicitly requested.
- Before committing, run `git status`.
- After frontend changes, run `npm.cmd run build`.
- After backend changes, run `node --check backend\src\server.js`.

## Completed Changes

### Media Library

- Media library supports selecting and uploading multiple images at once.
- Backend upload naming was improved:
  - Files are stored under `public/uploads/yyyy/mm/dd`.
  - Chinese and WeChat-style filenames are converted into safer filenames.
  - Uploaded files are written to `media_assets`.
- Media library display was cleaned up:
  - It no longer prominently shows messy UUID/mojibake names.
  - Rows show cleaner display names, metadata, and compact URLs.

### About Page

- Contact area keeps location, email, and phone.
- Email and phone are plain text, not clickable links.
- Website link was removed.
- "Follow me" only keeps GitHub and WeChat.
- WeChat opens a personal QR-code modal.
- Admin About settings support:
  - Phone
  - GitHub URL
  - WeChat QR URL
  - Selecting WeChat QR image from the media library
- Tech stack chips were made smaller.
- The useless "View all projects" button beside project portfolio was removed.

### Article Editor

- Removed unused toolbar buttons: `◎`, `□`, `?`.
- New article editor is blank by default:
  - Empty title
  - Empty markdown body
  - Empty summary
  - No default selected tags
- Empty title and empty summary no longer render empty preview blocks.
- Markdown table insertion was fixed:
  - It now inserts real newlines instead of literal `\n`.
- Markdown table rendering now works in:
  - Editor realtime preview
  - Public article detail rendering
- Body image insertion supports:
  - Clicking `▧` to upload an image into the media library and insert Markdown image syntax.
  - Clicking `库` to choose an existing media-library image and insert it into the article body.
  - Pasting image files into the textarea. In a real browser, clipboard image files are uploaded through `api.uploadMedia` and inserted into Markdown.

### Backend Media Protection

- `DELETE /api/admin/media/:id` now checks whether the media URL is used by:
  - `posts.cover_url`
  - `posts.content_markdown`
- If the media is in use, the backend returns `409 media_in_use`.
- In-use media is not deleted from the database and the local file is not removed.

### Admin Account Security

- Admin login password inputs support show/hide toggling.
- Admin backend includes `PUT /api/admin/auth/password` for changing the current administrator password.
- The password change flow verifies the current password, requires a new password of at least 8 characters, hashes the new password, and invalidates other active sessions for that administrator.
- The current password cannot be viewed because only the password hash is stored.
- Admin UI route: `/#/admin/security`.
- Admin login rate limiting was relaxed to 20 attempts per 5 minutes per client IP, and a successful login clears that client's login rate-limit bucket.
- This was verified with temporary test data, then the temporary data was deleted.

### Media Rendering Performance

- Image uploads now keep the original file and generate lightweight WebP variants:
  - `thumbnail_url` for media lists and picker grids.
  - `display_url` for cover-style rendering such as article cards, homepage cover, logo/share image selection, and about/project display images.
- Existing image media can be backfilled with `backend/scripts/generate-media-variants.js`.
- Production deploy runs the media variant backfill after seed.
- Production Caddy serves `/uploads/*` directly from the mounted uploads directory instead of proxying uploaded media through Node.

### Backend Encoding Repair

- `DEFAULT_ABOUT_PAGE` in `backend/src/server.js` was rewritten with stable normal Chinese/ASCII strings after old mojibake strings caused syntax problems.
- Several backend error `message` fields were changed to stable English strings.
- `node --check backend\src\server.js` passed afterward.

### Pagination And List Loading

- Admin article lists now use backend pagination:
  - Published article list
  - Draft list
  - Trash/archived list
  - Default page size is 10.
  - The footer shows current page and total article count.
- Admin media library page size was changed to 10.
- Admin comments and messages now support backend pagination, status filtering, and keyword search together.
- Public article comments now load the first 10 comments and expose a `加载更多评论` button when more data exists.
- Public message board now loads the first 10 root messages and exposes a `加载更多留言` button when more data exists.
- Backend pagination parsing is centralized through `readPagination(...)` so invalid `page` or `pageSize` query values fall back to safe defaults instead of producing invalid SQL limits.
- After restarting the backend, the admin article pagination endpoint was verified with:
  - `items=10`
  - `page=1`
  - `pageSize=10`
  - `total=11`
  - `hasMore=True`

### Site Settings

- Site settings now cover more public-site basics:
  - Logo URL
  - Favicon URL
  - Default SEO title and description
  - Default Open Graph/share image URL
  - ICP text and link
  - Police filing text and link
  - Footer text
- Admin site settings support selecting or uploading image assets for:
  - Logo
  - Favicon
  - Default share image
- The site settings page includes a save-before-preview area for:
  - Navigation brand block
  - Browser title/favicon preview
  - Share-card preview
  - Footer preview
- Public pages apply the configured favicon and Open Graph metadata when site settings load.
- Public footer renders ICP and police filing text as links when URLs are configured.

### Article Import And Comment Visibility

- Admin now has a `批量导入` page at `/#/admin/import`.
- Article import supports JSON paste/import with:
  - Template loading
  - Preview/dry-run validation
  - Commit/import confirmation
  - Slug conflict strategy: skip existing slugs or auto-rename
- Import payload can include article fields such as:
  - `title`, `slug`, `summary`, `contentMarkdown`, `category`, `tags`
  - `coverUrl`, `status`, `publishedAt`, `createdAt`
  - `viewsCount`, `likesCount`, `readingMinutes`, `isFeatured`, `allowComment`
- Import payload can include comments with:
  - `authorName`, `authorEmail`, `content`, `status`, `isVisible`
  - `likesCount`, `createdAt`, `parentIndex`
- Database fields added:
  - `posts.source`
  - `comments.is_visible`
  - `comments.source`
- Public article comments only show rows where:
  - `status = 'approved'`
  - `is_visible = true`
- Admin comment management can now show/hide comments without deleting them.

### Production Deployment

- Production domain: `https://hechenxu.cn`
- Server IP: `47.114.127.226`
- Server app directory: `/opt/blog/app`
- Production stack:
  - Docker Compose
  - PostgreSQL 16 container
  - Node backend container
  - Caddy 2 container for HTTPS, static frontend, `/api` reverse proxy, and `/uploads` reverse proxy
- Production files added locally:
  - `Dockerfile`
  - `.dockerignore`
  - `deploy/Caddyfile`
  - `deploy/docker-compose.prod.yml`
  - `deploy/remote-deploy.sh`
- Docker Hub access from the server timed out, so production images use `docker.m.daocloud.io` mirror prefixes.
- Old host nginx was stopped and disabled during deployment so Caddy can bind ports 80 and 443.
- Production deploy command on the server:

```bash
cd /opt/blog/app
DOMAIN=hechenxu.cn bash deploy/remote-deploy.sh
```

- Production status command:

```bash
cd /opt/blog/app
docker compose -f deploy/docker-compose.prod.yml ps
```

- Production logs:

```bash
cd /opt/blog/app
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 app
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 caddy
```

## Verification Already Done

- `npm.cmd run build` passed.
- `node --check backend\src\server.js` passed.
- `GET http://127.0.0.1:8000/api/health` passed.
- `GET /api/admin/posts?page=1&pageSize=10` returned 10 items and a total count of 11 after backend restart.
- `GET/PUT /api/admin/site-settings` was used to verify the new site settings fields can be saved and restored.
- `GET /api/admin/import/articles/template`, `POST /api/admin/import/articles/preview`, and `POST /api/admin/import/articles/commit` were verified with a temporary imported article, then the temporary article was permanently deleted.
- Production deployment verified:
  - `https://hechenxu.cn` returned HTTP 200.
  - `https://www.hechenxu.cn` returned HTTP 200.
  - `http://hechenxu.cn` redirected with HTTP 308.
  - `https://hechenxu.cn/api/health` returned `{ ok: true }`.
  - `https://hechenxu.cn/api/public/site-settings` returned public site settings.
- Browser verification confirmed article editor toolbar buttons:
  - `B`, `I`, `H`, `≡`, `</>`, `❞`, `🔗`, `▦`, `▧`, `库`
- Table button insertion produced a `preview-table`.
- Media-library body image modal title was `插入正文图片`.
- New article editor after refresh had:
  - `titleValue=""`
  - `markdownValueLength=0`
  - `summaryValue=""`
  - `selectedTags=[]`

## Git Notes

- `.gitignore` excludes:
  - `node_modules/`
  - `dist/`
  - Logs
  - `.env`
  - `backend/.env`
  - `public/uploads/`
- `public/assets` and `picture` are tracked.
- Recommended workflow:

```powershell
git status
git diff
npm.cmd run build
node --check backend\src\server.js
git add .
git commit -m "Describe the change"
```

## User Preference

- Communicate in Chinese.
- Explain changes clearly enough that the user can learn to do them without relying on an agent.
