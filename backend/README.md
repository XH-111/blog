# Blog Backend MVP

This is the first database-backed backend for the current frontend prototype.

## Start local PostgreSQL

```powershell
docker compose up -d postgres
```

Default connection:

```text
postgres://blog:blog123456@127.0.0.1:5432/blog_dev
```

## Initialize database

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
```

## Start backend

```powershell
npm.cmd run backend:dev
```

Backend URL:

```text
http://127.0.0.1:8000
```

## Implemented APIs

```text
GET  /api/health
GET  /api/public/posts
GET  /api/public/posts/:id
GET  /api/public/categories
GET  /api/public/tags
GET  /api/public/archive
POST /api/public/posts/:id/like
POST /api/public/posts/:id/comments
POST /api/admin/auth/login
```

The first frontend area to connect is the article detail metadata row:

```text
category, tags, publishedAt, readingMinutes, viewsCount, likesCount
```
