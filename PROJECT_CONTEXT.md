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
- This was verified with temporary test data, then the temporary data was deleted.

### Backend Encoding Repair

- `DEFAULT_ABOUT_PAGE` in `backend/src/server.js` was rewritten with stable normal Chinese/ASCII strings after old mojibake strings caused syntax problems.
- Several backend error `message` fields were changed to stable English strings.
- `node --check backend\src\server.js` passed afterward.

## Verification Already Done

- `npm.cmd run build` passed.
- `node --check backend\src\server.js` passed.
- `GET http://127.0.0.1:8000/api/health` passed.
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
