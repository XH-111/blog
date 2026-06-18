import http from "node:http";
import crypto from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { closePool, query, transaction } from "./db.js";

const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
const COMMENT_CONTENT_MAX_LENGTH = 1000;
const MESSAGE_CONTENT_MAX_LENGTH = 2000;
const ABOUT_SETTING_KEY = "about_page";
const HOME_SETTING_KEY = "home_page";
const SITE_SETTING_KEY = "site_basic";
const AI_INPUT_MAX_CHARS = 12000;
const AI_INSTRUCTION_MAX_CHARS = 800;
const AI_COMMENT_FOCUS_LABELS = {
  knowledge: "知识性错误、概念准确性和技术事实",
  structure: "文章结构、论证层次和段落组织",
  suggestions: "可执行的优化建议，但不要吹毛求疵",
  all: "知识性严谨性、结构性问题和关键优化建议",
};
const AI_TOOL_DEFINITIONS = {
  summary: {
    label: "AI 摘要",
    system: "你是个人博客的中文编辑助手，擅长把技术文章提炼成清晰、克制、适合展示在文章卡片里的摘要。",
    instruction: "请基于标题和正文生成一段中文摘要，控制在 120 到 180 个汉字内。只输出摘要正文，不要添加标题、列表或解释。",
  },
  polish: {
    label: "AI 润色",
    system: "你是个人博客的中文技术写作编辑，擅长优化表达、逻辑和可读性，同时尊重作者原意。",
    instruction: "请润色下面的 Markdown 正文，保留原有标题层级、代码块、表格和链接结构。请严格输出 JSON 对象，格式为：{\"polishedMarkdown\":\"润色后的 Markdown 正文\",\"notes\":\"用 2 到 4 条简要说明原文主要问题和本次润色做了什么\"}。不要输出 JSON 之外的解释。",
  },
  comment: {
    label: "AI 评论",
    system: "你是严谨但克制的技术文章事实校对助手，重点关注知识性、概念准确性、技术事实和逻辑严谨性。",
    instruction: "请检查这篇文章是否存在明显的知识性错误、概念混淆、技术事实不准确、因果逻辑不严谨或容易误导读者的表述。不要吹毛求疵，不要为了凑数量评价写作风格、措辞偏好或无关紧要的小问题。若发现问题，最多输出 3 到 5 条，每条包含：问题、原因、建议改法。若未发现明显知识性或严谨性问题，只输出：未发现明显知识性或严谨性问题。",
  },
};

const DEFAULT_ABOUT_PAGE = {
  title: "关于我",
  badge: "技术博主 / 开发者",
  subtitle: "热爱编程 · 热爱分享 · 持续学习 · 长期主义",
  introTitle: "个人简介",
  intro: "大家好，我是一名全栈开发者，喜欢用代码解决问题，也热衷于分享技术经验与思考。本站是我独立搭建并持续运营的个人博客，记录学习、工作与生活中的点滴。",
  location: "中国 · 杭州",
  email: "hello@example.com",
  phone: "17354410494",
  website: "https://example.com",
  githubUrl: "https://github.com",
  wechatQrUrl: "",
  portraitUrl: "/assets/about-portrait.png",
  safeDays: "567",
  safeSince: "自 2023-11-01 起",
  skills: ["TypeScript", "React", "Next.js", "Node.js", "Docker", "Git"],
  projects: [
    { title: "BlogCore 全栈博客系统", description: "基于 Node.js + React 的全栈博客系统，支持 Markdown、文章管理、评论、留言、统计与主题自定义。", imageUrl: "/assets/about-project-blogcore.png", projectUrl: "", demoUrl: "", tags: ["Node.js", "React", "TypeScript"], badge: "开源项目" },
  ],
  socials: [
    { label: "GitHub", url: "https://github.com" },
    { label: "微信", url: "" },
  ],
  writingTopics: ["后端开发", "前端开发", "全栈实践", "项目复盘", "工具推荐", "面试总结"].map((label) => ({ label, url: `/archive?tag=${encodeURIComponent(label)}` })),
  timeline: [
    { year: "2021", title: "计算机科学与技术 本科毕业", description: "在校期间参与多个项目开发。" },
    { year: "2022", title: "全栈开发工程师", description: "参与企业级系统开发，积累全栈开发经验。" },
    { year: "2023", title: "开始技术写作", description: "搭建个人博客，持续输出技术文章。" },
  ],
  cooperateTitle: "欢迎交流与合作",
  cooperateText: "如果你有任何问题、建议，或者想一起交流技术，欢迎在留言板给我留言。",
  cooperateButtonText: "去留言",
  cooperateUrl: "/messages",
};

const DEFAULT_HOME_PAGE = {
  title: "全栈博客创作平台",
  subtitle: "记录 · 分享 · 成长",
  description: "记录技术探索与项目经验，分享思考与实践，在代码与生活之间持续学习与成长。",
  primaryButtonText: "开始阅读",
  primaryButtonUrl: "/posts",
  secondaryButtonText: "了解我",
  secondaryButtonUrl: "/about",
  primaryButtonColor: "#079b95",
  secondaryButtonColor: "#ffffff",
  titleColor: "#081827",
  subtitleColor: "#173047",
  descriptionColor: "#405669",
  coverType: "image",
  coverUrl: "",
  coverVideoUrl: "",
  coverPositionX: 50,
  coverPositionY: 50,
  coverZoom: 100,
  coverOverlayOpacity: 0,
  entryCards: [
    { title: "精选文章", description: "保留少量高质量技术文章，适合从这里开始阅读。", actionText: "立即阅读", icon: "doc", href: "/posts", visible: true },
    { title: "项目作品", description: "沉淀全栈项目实践、开发复盘和可复用经验。", actionText: "查看项目", icon: "cube", href: "/about", visible: true },
    { title: "关于我", description: "了解我的技术栈与经历，也欢迎交流与合作。", actionText: "了解更多", icon: "user", href: "/about", visible: true },
  ],
};

const DEFAULT_SITE_SETTINGS = {
  siteName: "全栈博客创作平台",
  siteSubtitle: "记录 · 分享 · 成长",
  logoUrl: "",
  defaultSeoTitle: "全栈博客创作平台",
  defaultSeoDescription: "记录技术探索与项目经验，分享思考与实践。",
  icpText: "",
  footerText: "© 2026 全栈博客创作平台",
};

const rateLimitBuckets = new Map();

function checkRateLimit(req, { scope, max, windowMs }) {
  const now = Date.now();
  const ip = getClientIp(req) || "unknown";
  const key = `${scope}:${ip}`;
  const existing = rateLimitBuckets.get(key);
  const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);
  if (bucket.count > max) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  if (rateLimitBuckets.size > 1000) {
    for (const [bucketKey, value] of rateLimitBuckets.entries()) {
      if (value.resetAt <= now) rateLimitBuckets.delete(bucketKey);
    }
  }
  return { limited: false, retryAfterSeconds: 0 };
}

function enforceRateLimit(req, res, options) {
  const result = checkRateLimit(req, options);
  if (!result.limited) return false;
  sendJson(
    res,
    429,
    {
      error: "rate_limited",
      message: "操作太频繁，请稍后再试",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      ...corsHeaders(req),
      "retry-after": String(result.retryAfterSeconds),
    },
  );
  return true;
}

const scrypt = crypto.scrypt;

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, salt, hash] = String(storedHash || "").split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const key = await scryptAsync(password, salt);
  const expected = Buffer.from(hash, "hex");
  return expected.length === key.length && crypto.timingSafeEqual(expected, key);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(data));
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  const allowed = origin && config.corsOrigins.includes(origin) ? origin : config.corsOrigins[0];
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-visitor-id",
  };
}

async function ensureRuntimeSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS site_daily_visitors (
      id bigserial PRIMARY KEY,
      stat_date date NOT NULL,
      visitor_id varchar(120) NOT NULL,
      ip_address varchar(80),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (stat_date, visitor_id)
    )
  `);
  await query(`
    ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS access_password_hash text,
      ADD COLUMN IF NOT EXISTS password_hint text
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS post_versions (
      id bigserial PRIMARY KEY,
      post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      title varchar(220) NOT NULL,
      summary text,
      content_markdown text NOT NULL,
      cover_url text,
      category_name varchar(120),
      tags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_by bigint REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query("CREATE INDEX IF NOT EXISTS idx_post_versions_post_id_created_at ON post_versions(post_id, created_at DESC)");
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "";
}

function getVisitorId(req) {
  return String(req.headers["x-visitor-id"] || getClientIp(req) || "anonymous").slice(0, 120);
}

async function removeUploadedFile(storagePath) {
  if (!storagePath) return;
  const resolved = path.resolve(storagePath);
  if (!resolved.startsWith(`${uploadRoot}${path.sep}`)) return;
  try {
    await unlink(resolved);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function postListSql({ keyword, category, tag, year, sort, limit, offset, featured }) {
  const params = [];
  const where = ["p.status = 'published'", "p.visibility IN ('public', 'password')"];

  if (keyword) {
    params.push(`%${keyword.toLowerCase()}%`);
    where.push(`(lower(p.title) LIKE $${params.length} OR lower(p.excerpt) LIKE $${params.length} OR lower(p.summary) LIKE $${params.length})`);
  }
  if (category) {
    params.push(category);
    where.push(`c.name = $${params.length}`);
  }
  if (tag) {
    params.push(tag);
    where.push(`EXISTS (
      SELECT 1 FROM post_tags pt2
      JOIN tags t2 ON t2.id = pt2.tag_id
      WHERE pt2.post_id = p.id AND t2.name = $${params.length}
    )`);
  }
  if (year) {
    params.push(`${year}%`);
    where.push(`to_char(p.published_at, 'YYYY') LIKE $${params.length}`);
  }
  if (featured) {
    where.push("p.is_featured = true");
  }

  const orderBy = sort === "hot" ? "p.views_count DESC, p.published_at DESC" : "p.published_at DESC";
  params.push(limit, offset);

  return {
    text: `
      SELECT
        count(*) OVER()::integer AS total_count,
        p.id, p.title, p.slug, p.excerpt, p.summary, p.cover_url, p.status, p.visibility, p.password_hint,
        p.is_featured, p.allow_comment,
        p.reading_minutes, p.views_count, p.likes_count, p.comments_count, p.published_at,
        c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
        COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug) ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN post_tags pt ON pt.post_id = p.id
      LEFT JOIN tags t ON t.id = pt.tag_id
      WHERE ${where.join(" AND ")}
      GROUP BY p.id, c.id
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  };
}

function mapPost(row) {
  return {
    id: Number(row.id),
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    summary: row.summary,
    coverUrl: row.cover_url,
    allowComment: row.allow_comment,
    visibility: row.visibility,
    passwordRequired: row.visibility === "password",
    passwordHint: row.visibility === "password" ? row.password_hint || "" : "",
    hasAccessPassword: row.visibility === "password" ? Boolean(row.access_password_hash) : false,
    category: row.category_id ? { id: Number(row.category_id), name: row.category_name, slug: row.category_slug } : null,
    tags: row.tags ?? [],
    isFeatured: row.is_featured,
    readingMinutes: row.reading_minutes,
    viewsCount: row.views_count,
    likesCount: row.likes_count,
    commentsCount: row.comments_count,
    publishedAt: row.published_at,
  };
}

function slugify(input) {
  const base = String(input || "post")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `post-${Date.now()}`;
}

function estimateReadingMinutes(content) {
  const length = String(content || "").replace(/\s+/g, "").length;
  return Math.max(1, Math.ceil(length / 500));
}

function parseScheduledAt(value) {
  if (!value) return null;
  const scheduledAt = new Date(value);
  return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt;
}

function validatePostSchedule(payload) {
  if (payload.status !== "scheduled") return null;
  const scheduledAt = parseScheduledAt(payload.scheduledAt);
  if (!scheduledAt) {
    return { error: "invalid_scheduled_at", message: "瀹氭椂鍙戝竷蹇呴』濉啓鏈夋晥鍙戝竷鏃堕棿" };
  }
  if (scheduledAt.getTime() <= Date.now()) {
    return { error: "scheduled_at_in_past", message: "瀹氭椂鍙戝竷鏃堕棿蹇呴』鏅氫簬褰撳墠鏃堕棿" };
  }
  return null;
}

function validatePublishablePost(payload) {
  if (!["published", "scheduled"].includes(payload.status)) return null;
  const title = String(payload.title || "").trim();
  const content = String(payload.contentMarkdown || payload.content || "").trim();
  if (!title) return { error: "title_required", message: "鍙戝竷鏂囩珷蹇呴』濉啓鏍囬" };
  if (!content) return { error: "content_required", message: "鍙戝竷鏂囩珷蹇呴』濉啓姝ｆ枃鍐呭" };
  return null;
}

async function validatePostAccessPassword(payload, id = null) {
  if (!["published", "scheduled"].includes(payload.status)) return null;
  if (payload.visibility !== "password") return null;
  if (String(payload.accessPassword || payload.password || "").trim()) return null;
  if (id) {
    const existing = await query("SELECT access_password_hash FROM posts WHERE id = $1", [id]);
    if (existing.rows[0]?.access_password_hash) return null;
  }
  return { error: "post_password_required", message: "Password protected posts require an access password" };
}

function makeExcerpt(content, explicit) {
  if (explicit) return explicit;
  return String(content || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function parseSections(content) {
  const lines = String(content || "").split(/\r?\n/);
  const sections = [];
  let current = null;
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      if (current) sections.push(current);
      current = {
        anchor: slugify(match[2]),
        title: match[2].trim(),
        level: match[1].length,
        body: "",
      };
      continue;
    }
    if (current && line.trim()) {
      current.body = current.body ? `${current.body}\n${line.trim()}` : line.trim();
    }
  }
  if (current) sections.push(current);
  return sections.length ? sections : [{ anchor: "content", title: "姝ｆ枃", level: 2, body: makeExcerpt(content) }];
}

async function ensureCategory(client, name = "技术笔记") {
  const slug = slugify(name);
  const existing = await client.query("SELECT id FROM categories WHERE name = $1 OR slug = $2 LIMIT 1", [name, slug]);
  if (existing.rowCount) return existing.rows[0].id;
  const result = await client.query(
    `INSERT INTO categories(name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id`,
    [name, slug],
  );
  return result.rows[0].id;
}

async function ensureTag(client, name) {
  const slug = slugify(name);
  const existing = await client.query("SELECT id FROM tags WHERE name = $1 OR slug = $2 LIMIT 1", [name, slug]);
  if (existing.rowCount) return existing.rows[0].id;
  const result = await client.query(
    `INSERT INTO tags(name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id`,
    [name, slug],
  );
  return result.rows[0].id;
}

async function writePost(client, payload, id = null) {
  const title = String(payload.title || "未命名文章").trim();
  const contentMarkdown = String(payload.contentMarkdown || payload.content || "");
  const status = ["published", "scheduled", "draft"].includes(payload.status) ? payload.status : "draft";
  const visibility = ["public", "private", "password"].includes(payload.visibility) ? payload.visibility : "public";
  const existing = id ? await client.query("SELECT access_password_hash FROM posts WHERE id = $1", [id]) : null;
  const accessPassword = String(payload.accessPassword || payload.password || "").trim();
  const accessPasswordHash = visibility === "password"
    ? accessPassword ? await hashPassword(accessPassword) : existing?.rows[0]?.access_password_hash ?? null
    : null;
  const passwordHint = visibility === "password" ? String(payload.passwordHint || "").trim() : "";
  const baseSlug = payload.slug ? slugify(payload.slug) : slugify(title);
  const slug = id ? payload.slug ? baseSlug : null : `${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const excerpt = makeExcerpt(contentMarkdown, payload.excerpt);
  const summary = payload.summary || excerpt;
  const categoryId = await ensureCategory(client, payload.categoryName || payload.category || "技术笔记");
  const readingMinutes = payload.readingMinutes ?? estimateReadingMinutes(contentMarkdown);
  const publishedAt = status === "published" ? new Date() : null;
  const scheduledAt = parseScheduledAt(payload.scheduledAt);

  const values = [
    title,
    slug,
    excerpt,
    summary,
    contentMarkdown,
    payload.coverUrl || "/assets/article-cover.png",
    categoryId,
    status,
    Boolean(payload.isFeatured),
    visibility,
    accessPasswordHash,
    passwordHint,
    payload.allowComment !== false,
    payload.requireCommentReview !== false,
    readingMinutes,
    publishedAt,
    scheduledAt,
  ];

  const result = id
    ? await client.query(
        `UPDATE posts SET
          title = $1,
          slug = COALESCE(NULLIF($2, ''), slug),
          excerpt = $3,
          summary = $4,
          content_markdown = $5,
          cover_url = $6,
          category_id = $7,
          status = $8,
          is_featured = $9,
          visibility = $10,
          access_password_hash = $11,
          password_hint = $12,
          allow_comment = $13,
          require_comment_review = $14,
          reading_minutes = $15,
          published_at = COALESCE($16, published_at),
          scheduled_at = $17,
          updated_at = now()
         WHERE id = $18
         RETURNING id`,
        [...values, id],
      )
    : await client.query(
        `INSERT INTO posts(
          title, slug, excerpt, summary, content_markdown, cover_url, category_id, status,
          is_featured, visibility, access_password_hash, password_hint,
          allow_comment, require_comment_review, reading_minutes, published_at, scheduled_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING id`,
        values,
      );

  if (!result.rowCount) return null;
  const postId = Number(result.rows[0].id);
  await client.query("DELETE FROM post_tags WHERE post_id = $1", [postId]);
  await client.query("DELETE FROM post_sections WHERE post_id = $1", [postId]);

  for (const tag of payload.tags || ["AI", "自建项目"]) {
    const tagId = await ensureTag(client, tag);
    await client.query("INSERT INTO post_tags(post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [postId, tagId]);
  }

  for (const [index, section] of parseSections(contentMarkdown).entries()) {
    await client.query(
      `INSERT INTO post_sections(post_id, anchor, title, level, body, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [postId, section.anchor, section.title, section.level, section.body, index + 1],
    );
  }

  await client.query(
    `INSERT INTO post_versions(post_id, title, summary, content_markdown, cover_url, category_name, tags_json, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [
      postId,
      title,
      summary,
      contentMarkdown,
      payload.coverUrl || "/assets/article-cover.png",
      payload.categoryName || payload.category || "技术笔记",
      JSON.stringify(Array.isArray(payload.tags) ? payload.tags : []),
      payload.adminUserId ?? null,
    ],
  );

  await refreshTaxonomyCounts(client);

  return postId;
}

async function refreshTaxonomyCounts(client) {
  await client.query(`
    UPDATE categories
    SET posts_count = 0
  `);
  await client.query(`
    UPDATE categories c
    SET posts_count = sub.count
    FROM (
      SELECT category_id, count(*)::integer AS count
      FROM posts
      WHERE status = 'published' AND category_id IS NOT NULL
      GROUP BY category_id
    ) sub
    WHERE c.id = sub.category_id
  `);
  await client.query(`
    UPDATE tags
    SET posts_count = 0
  `);
  await client.query(`
    UPDATE tags t
    SET posts_count = sub.count
    FROM (
      SELECT tag_id, count(*)::integer AS count
      FROM post_tags
      JOIN posts p ON p.id = post_tags.post_id
      WHERE p.status = 'published'
      GROUP BY tag_id
    ) sub
    WHERE t.id = sub.tag_id
  `);
}

async function publishDueScheduledPosts() {
  return transaction(async (client) => {
    const result = await client.query(`
      UPDATE posts
      SET status = 'published',
          published_at = COALESCE(scheduled_at, now()),
          updated_at = now()
      WHERE status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= now()
      RETURNING id
    `);
    if (result.rowCount) await refreshTaxonomyCounts(client);
    return result.rows.map((row) => Number(row.id));
  });
}

async function runScheduledPostPublisher() {
  try {
    const publishedIds = await publishDueScheduledPosts();
    if (publishedIds.length) {
      console.log(`published scheduled posts: ${publishedIds.join(", ")}`);
    }
  } catch (error) {
    console.error("scheduled post publisher failed", error);
  }
}

function warnRuntimeConfig() {
  if (config.nodeEnv !== "production") return;
  const warnings = [];
  if (config.host === "127.0.0.1" || config.host === "localhost") {
    warnings.push("HOST is bound to localhost. Set HOST=0.0.0.0 when the server must accept external traffic.");
  }
  if (config.adminDefaultPassword === "password") {
    warnings.push("ADMIN_DEFAULT_PASSWORD is still the development default. Change it before production use.");
  }
  if (config.databaseUrl.includes("blog123456")) {
    warnings.push("DATABASE_URL appears to contain the development database password. Use a stronger production password.");
  }
  if (config.aiWebSearchEnabled && !config.qwenApiKey) {
    warnings.push("AI_WEB_SEARCH_ENABLED is true but DASHSCOPE_API_KEY/QWEN_API_KEY is missing.");
  }
  for (const warning of warnings) console.warn(`[config warning] ${warning}`);
}

async function refreshPublishedTaxonomyCounts() {
  await transaction(async (client) => {
    await refreshTaxonomyCounts(client);
  });
}

async function recordPostView(postId, req) {
  return transaction(async (client) => {
    const visitorId = getVisitorId(req);
    const ipAddress = getClientIp(req);
    const updated = await client.query(
      "UPDATE posts SET views_count = views_count + 1 WHERE id = $1 RETURNING views_count",
      [postId],
    );
    await client.query(
      `INSERT INTO post_daily_stats(post_id, stat_date, views_count)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (post_id, stat_date)
       DO UPDATE SET views_count = post_daily_stats.views_count + 1`,
      [postId],
    );
    await client.query(
      `INSERT INTO site_daily_stats(stat_date, pv)
       VALUES (CURRENT_DATE, 1)
       ON CONFLICT (stat_date)
       DO UPDATE SET pv = site_daily_stats.pv + 1
       RETURNING uv`,
    );
    const visit = await client.query(
      `INSERT INTO site_daily_visitors(stat_date, visitor_id, ip_address)
       VALUES (CURRENT_DATE, $1, $2)
       ON CONFLICT (stat_date, visitor_id) DO NOTHING`,
      [visitorId, ipAddress],
    );
    if (visit.rowCount) {
      await client.query(
        `UPDATE site_daily_stats
         SET uv = uv + 1
         WHERE stat_date = CURRENT_DATE`,
      );
    }
    return updated.rows[0]?.views_count ?? 0;
  });
}

async function recordPostLikeStats(client, postId) {
  await client.query(
    `INSERT INTO post_daily_stats(post_id, stat_date, likes_count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (post_id, stat_date)
     DO UPDATE SET likes_count = post_daily_stats.likes_count + 1`,
    [postId],
  );
  await recordSiteLikeStats(client);
}

async function recordSiteLikeStats(client) {
  await client.query(
    `INSERT INTO site_daily_stats(stat_date, likes_count)
     VALUES (CURRENT_DATE, 1)
     ON CONFLICT (stat_date)
     DO UPDATE SET likes_count = site_daily_stats.likes_count + 1`,
  );
}

async function recordApprovedCommentStats(client, postId) {
  await client.query(
    `INSERT INTO post_daily_stats(post_id, stat_date, comments_count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (post_id, stat_date)
     DO UPDATE SET comments_count = post_daily_stats.comments_count + 1`,
    [postId],
  );
  await client.query(
    `INSERT INTO site_daily_stats(stat_date, comments_count)
     VALUES (CURRENT_DATE, 1)
     ON CONFLICT (stat_date)
     DO UPDATE SET comments_count = site_daily_stats.comments_count + 1`,
  );
}

async function recordRootMessageStats(client) {
  await client.query(
    `INSERT INTO site_daily_stats(stat_date, messages_count)
     VALUES (CURRENT_DATE, 1)
     ON CONFLICT (stat_date)
     DO UPDATE SET messages_count = site_daily_stats.messages_count + 1`,
  );
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readBuffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function decodeMultipartText(value) {
  return Buffer.from(String(value || ""), "binary").toString("utf8");
}

function parseMultipart(req, body) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("missing_multipart_boundary");
  const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
  const raw = body.toString("binary");
  const parts = raw.split(boundary).slice(1, -1);
  const fields = {};
  const files = [];

  for (const part of parts) {
    const normalized = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const headerEnd = normalized.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;
    const headerText = normalized.slice(0, headerEnd);
    const content = normalized.slice(headerEnd + 4);
    const name = headerText.match(/name="([^"]+)"/)?.[1];
    const fileName = headerText.match(/filename="([^"]*)"/)?.[1];
    const mimeType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "application/octet-stream";
    if (!name) continue;
    if (fileName) {
      files.push({
        fieldName: name,
        originalName: path.basename(decodeMultipartText(fileName)),
        mimeType,
        buffer: Buffer.from(content, "binary"),
      });
    } else {
      fields[name] = Buffer.from(content, "binary").toString("utf8");
    }
  }

  return { fields, files };
}

function extensionForMime(mimeType) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "video/mp4") return ".mp4";
  if (mimeType === "video/webm") return ".webm";
  if (mimeType === "video/ogg") return ".ogv";
  return "";
}

function safeUploadBaseName(originalName) {
  const rawName = String(originalName || "image");
  const baseName = path.basename(rawName, path.extname(rawName));
  const safeName = baseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const hasNonAscii = /[^\x00-\x7F]/.test(baseName);
  const letterCount = (safeName.match(/[a-z]/g) ?? []).length;
  if (hasNonAscii && letterCount < 8) {
    const digits = (baseName.match(/\d+/g) ?? []).join("-");
    return digits ? `image-${digits}` : "image";
  }
  return safeName || "image";
}

function safeUploadExtension(file) {
  const originalExt = path.extname(file.originalName).toLowerCase();
  const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".ogv"]);
  if (allowed.has(originalExt)) return originalExt === ".jpeg" ? ".jpg" : originalExt;
  return extensionForMime(file.mimeType) || ".bin";
}

function uploadDateParts(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    String(date.getFullYear()),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ];
}

function contentTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".ogv" || ext === ".ogg") return "video/ogg";
  return "application/octet-stream";
}

async function serveUploadedFile(req, res, url) {
  const relative = decodeURIComponent(url.pathname.replace(/^\/uploads\//, ""));
  const absolute = path.resolve(uploadRoot, relative);
  if (!absolute.startsWith(`${uploadRoot}${path.sep}`)) return sendJson(res, 403, { error: "forbidden" }, corsHeaders(req));
  try {
    const file = await readFile(absolute);
    res.writeHead(200, {
      ...corsHeaders(req),
      "content-type": contentTypeForFile(absolute),
      "cache-control": "public, max-age=31536000, immutable",
    });
    res.end(file);
  } catch {
    sendJson(res, 404, { error: "file_not_found" }, corsHeaders(req));
  }
}

async function handleAdminLogin(req, res) {
  if (enforceRateLimit(req, res, { scope: "admin-login", max: 5, windowMs: 15 * 60 * 1000 })) return;
  const body = await readBody(req);
  const account = String(body.account || body.username || body.email || "").trim();
  const password = String(body.password || "");
  if (!account || !password) {
    return sendJson(res, 400, { error: "auth_required", message: "Admin account and password are required" }, corsHeaders(req));
  }

  const result = await query(
    `SELECT id, username, email, password_hash, role, status
     FROM admin_users
     WHERE username = $1 OR email = $1
     LIMIT 1`,
    [account],
  );
  const user = result.rows[0];
  const legacySeedLogin = user?.password_hash === "mock-password-hash" && password === config.adminDefaultPassword;
  const validPassword = user && user.status === "active" && (legacySeedLogin || await verifyPassword(password, user.password_hash));

  if (!validPassword) {
    return sendJson(res, 401, { error: "invalid_credentials", message: "Invalid account or password" }, corsHeaders(req));
  }

  if (legacySeedLogin) {
    const upgradedHash = await hashPassword(password);
    await query("UPDATE admin_users SET password_hash = $1, updated_at = now() WHERE id = $2", [upgradedHash, user.id]);
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.adminSessionDays * 24 * 60 * 60 * 1000);
  await transaction(async (client) => {
    await client.query("DELETE FROM admin_sessions WHERE admin_user_id = $1 OR expires_at <= now()", [user.id]);
    await client.query(
      `INSERT INTO admin_sessions(admin_user_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt],
    );
    await client.query("UPDATE admin_users SET last_login_at = now(), updated_at = now() WHERE id = $1", [user.id]);
  });

  return sendJson(res, 200, {
    token,
    expiresAt: expiresAt.toISOString(),
    user: { id: Number(user.id), username: user.username, email: user.email, role: user.role },
  }, corsHeaders(req));
}

async function requireAdmin(req, res) {
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    sendJson(res, 401, { error: "unauthorized", message: "璇峰厛鐧诲綍绠＄悊鍚庡彴" }, corsHeaders(req));
    return null;
  }
  const tokenHash = hashToken(match[1]);
  const result = await query(
    `SELECT s.id AS session_id, u.id, u.username, u.email, u.role, u.status
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.admin_user_id
     WHERE s.refresh_token_hash = $1 AND s.expires_at > now()
     LIMIT 1`,
    [tokenHash],
  );
  const user = result.rows[0];
  if (!user || user.status !== "active") {
    sendJson(res, 401, { error: "invalid_session", message: "Session expired, please login again" }, corsHeaders(req));
    return null;
  }
  req.adminUser = { id: Number(user.id), username: user.username, email: user.email, role: user.role };
  req.adminSessionId = Number(user.session_id);
  return req.adminUser;
}

async function handleAdminLogout(req, res) {
  if (req.adminSessionId) {
    await query("DELETE FROM admin_sessions WHERE id = $1", [req.adminSessionId]);
  }
  sendJson(res, 200, { ok: true }, corsHeaders(req));
}

async function handlePublicPosts(req, res, url) {
  await publishDueScheduledPosts();
  const limit = Math.min(Number(url.searchParams.get("pageSize") ?? 20), 100);
  const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
  const options = {
    keyword: url.searchParams.get("keyword") || url.searchParams.get("q") || "",
    category: url.searchParams.get("category") || "",
    tag: url.searchParams.get("tag") || "",
    year: url.searchParams.get("year") || "",
    sort: url.searchParams.get("sort") || "latest",
    featured: ["1", "true", "yes"].includes(String(url.searchParams.get("featured") || "").toLowerCase()),
    limit,
    offset: (page - 1) * limit,
  };

  const sql = postListSql(options);
  const result = await query(sql.text, sql.params);
  const total = Number(result.rows[0]?.total_count ?? 0);
  sendJson(res, 200, {
    items: result.rows.map(mapPost),
    page,
    pageSize: limit,
    total,
    hasMore: page * limit < total,
  }, corsHeaders(req));
}

async function handlePublicPostDetail(req, res, id) {
  await publishDueScheduledPosts();
  const result = await query(
    `
      SELECT
        p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN post_tags pt ON pt.post_id = p.id
      LEFT JOIN tags t ON t.id = pt.tag_id
      WHERE p.id = $1 AND p.status = 'published' AND p.visibility IN ('public', 'password')
      GROUP BY p.id, c.id
    `,
    [id],
  );
  if (!result.rowCount) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  const row = result.rows[0];
  if (row.visibility === "password") {
    return sendJson(res, 200, {
      ...mapPost(row),
      locked: true,
      contentMarkdown: "",
      contentHtml: "",
      sections: [],
    }, corsHeaders(req));
  }
  return sendPublicPostContent(req, res, row, id);
}

async function handlePublicRelatedPosts(req, res, id) {
  await publishDueScheduledPosts();
  const result = await query(
    `
      WITH current_post AS (
        SELECT category_id FROM posts WHERE id = $1
      ),
      current_tags AS (
        SELECT tag_id FROM post_tags WHERE post_id = $1
      )
      SELECT
        p.id, p.title, p.slug, p.excerpt, p.summary, p.cover_url, p.status, p.visibility, p.password_hint,
        p.is_featured, p.allow_comment,
        p.reading_minutes, p.views_count, p.likes_count, p.comments_count, p.published_at,
        c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        CASE WHEN p.category_id = (SELECT category_id FROM current_post) THEN 1 ELSE 0 END AS category_score,
        count(DISTINCT ct.tag_id)::integer AS tag_score
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN post_tags pt ON pt.post_id = p.id
      LEFT JOIN tags t ON t.id = pt.tag_id
      LEFT JOIN current_tags ct ON ct.tag_id = pt.tag_id
      WHERE p.id <> $1
        AND p.status = 'published'
        AND p.visibility IN ('public', 'password')
      GROUP BY p.id, c.id
      HAVING CASE WHEN p.category_id = (SELECT category_id FROM current_post) THEN 1 ELSE 0 END > 0
        OR count(DISTINCT ct.tag_id) > 0
      ORDER BY tag_score DESC, category_score DESC, p.published_at DESC NULLS LAST
      LIMIT 4
    `,
    [id],
  );
  sendJson(res, 200, { items: result.rows.map(mapPost) }, corsHeaders(req));
}

async function sendPublicPostContent(req, res, row, id) {
  const sections = await query(
    `SELECT anchor AS id, title, level, body FROM post_sections WHERE post_id = $1 ORDER BY sort_order ASC`,
    [id],
  );
  const [previousPost, nextPost] = await Promise.all([
    query(
      `SELECT id, title
       FROM posts
       WHERE status = 'published'
         AND visibility IN ('public', 'password')
         AND (published_at, id) < ($1, $2)
       ORDER BY published_at DESC, id DESC
       LIMIT 1`,
      [row.published_at, id],
    ),
    query(
      `SELECT id, title
       FROM posts
       WHERE status = 'published'
         AND visibility IN ('public', 'password')
         AND (published_at, id) > ($1, $2)
       ORDER BY published_at ASC, id ASC
       LIMIT 1`,
      [row.published_at, id],
    ),
  ]);
  row.views_count = await recordPostView(id, req);
  sendJson(res, 200, {
    ...mapPost(row),
    previousPost: previousPost.rows[0] ? { id: Number(previousPost.rows[0].id), title: previousPost.rows[0].title } : null,
    nextPost: nextPost.rows[0] ? { id: Number(nextPost.rows[0].id), title: nextPost.rows[0].title } : null,
    contentMarkdown: row.content_markdown,
    contentHtml: row.content_html,
    sections: sections.rows.map((item) => ({
      id: item.id,
      title: item.title,
      level: item.level,
      body: item.body,
    })),
  }, corsHeaders(req));
}

async function getPostDetail(id, publicOnly = false) {
  const result = await query(
    `
      SELECT
        p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN post_tags pt ON pt.post_id = p.id
      LEFT JOIN tags t ON t.id = pt.tag_id
      WHERE p.id = $1 ${publicOnly ? "AND p.status = 'published'" : ""}
      GROUP BY p.id, c.id
    `,
    [id],
  );
  if (!result.rowCount) return null;
  const sections = await query(
    `SELECT anchor AS id, title, level, body FROM post_sections WHERE post_id = $1 ORDER BY sort_order ASC`,
    [id],
  );
  const row = result.rows[0];
  return {
    ...mapPost(row),
    status: row.status,
    visibility: row.visibility,
    passwordHint: row.visibility === "password" ? row.password_hint || "" : "",
    hasAccessPassword: row.visibility === "password" ? Boolean(row.access_password_hash) : false,
    scheduledAt: row.scheduled_at,
    requireCommentReview: row.require_comment_review,
    contentMarkdown: row.content_markdown,
    contentHtml: row.content_html,
    sections: sections.rows.map((item) => ({
      id: item.id,
      title: item.title,
      level: item.level,
      body: item.body,
    })),
  };
}

async function handleArchive(req, res) {
  await publishDueScheduledPosts();
  const result = await query(`
    SELECT
      to_char(p.published_at, 'YYYY') AS year,
      to_char(p.published_at, 'MM') AS month,
      json_agg(json_build_object('id', p.id, 'title', p.title, 'publishedAt', p.published_at) ORDER BY p.published_at DESC) AS posts
    FROM posts p
    WHERE p.status = 'published'
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `);
  sendJson(res, 200, { groups: result.rows }, corsHeaders(req));
}

async function handlePublicStats(req, res) {
  await publishDueScheduledPosts();
  await refreshPublishedTaxonomyCounts();
  const result = await query(`
    SELECT
      (SELECT count(*)::integer FROM posts WHERE status = 'published' AND visibility = 'public') AS posts_count,
      (SELECT count(*)::integer FROM categories WHERE posts_count > 0) AS categories_count,
      (SELECT count(*)::integer FROM tags WHERE posts_count > 0) AS tags_count,
      (SELECT count(*)::integer FROM messages WHERE parent_id IS NULL AND status = 'approved') AS messages_count,
      (SELECT COALESCE(sum(views_count), 0)::integer FROM posts WHERE status = 'published' AND visibility = 'public') AS views_count,
      (SELECT COALESCE(sum(likes_count), 0)::integer FROM posts WHERE status = 'published' AND visibility = 'public') AS likes_count,
      (SELECT COALESCE(sum(comments_count), 0)::integer FROM posts WHERE status = 'published' AND visibility = 'public') AS comments_count
  `);
  const row = result.rows[0] ?? {};
  sendJson(res, 200, {
    postsCount: row.posts_count ?? 0,
    categoriesCount: row.categories_count ?? 0,
    tagsCount: row.tags_count ?? 0,
    messagesCount: row.messages_count ?? 0,
    viewsCount: row.views_count ?? 0,
    likesCount: row.likes_count ?? 0,
    commentsCount: row.comments_count ?? 0,
    posts_count: row.posts_count ?? 0,
    categories_count: row.categories_count ?? 0,
    tags_count: row.tags_count ?? 0,
    messages_count: row.messages_count ?? 0,
    views_count: row.views_count ?? 0,
    likes_count: row.likes_count ?? 0,
    comments_count: row.comments_count ?? 0,
  }, corsHeaders(req));
}

async function handleUnlockPublicPost(req, res, id) {
  await publishDueScheduledPosts();
  const body = await readBody(req);
  const password = String(body.password || "").trim();
  if (!password) return sendJson(res, 400, { error: "post_password_required", message: "Password is required" }, corsHeaders(req));
  const result = await query(
    `
      SELECT
        p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN post_tags pt ON pt.post_id = p.id
      LEFT JOIN tags t ON t.id = pt.tag_id
      WHERE p.id = $1 AND p.status = 'published' AND p.visibility = 'password'
      GROUP BY p.id, c.id
    `,
    [id],
  );
  if (!result.rowCount) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  const row = result.rows[0];
  if (!row.access_password_hash) return sendJson(res, 403, { error: "post_password_unavailable", message: "This post has no access password configured" }, corsHeaders(req));
  const valid = await verifyPassword(password, row.access_password_hash);
  if (!valid) return sendJson(res, 401, { error: "invalid_post_password", message: "Invalid post password" }, corsHeaders(req));
  return sendPublicPostContent(req, res, row, id);
}

function normalizeHomePage(value = {}) {
  const next = { ...DEFAULT_HOME_PAGE, ...(value && typeof value === "object" ? value : {}) };
  const text = (value, fallback = "") => value === undefined || value === null ? fallback : String(value).trim();
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).trim() : fallback;
  const list = (items, fallback) => Array.isArray(items) ? items : fallback;
  const clampPercent = (value, fallback = 50) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(100, Math.round(number)));
  };
  const clampZoom = (value, fallback = 100) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(100, Math.min(180, Math.round(number)));
  };
  const clampOverlay = (value, fallback = 0) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(70, Math.round(number)));
  };
  return {
    title: text(next.title, DEFAULT_HOME_PAGE.title),
    subtitle: text(next.subtitle, DEFAULT_HOME_PAGE.subtitle),
    description: text(next.description, DEFAULT_HOME_PAGE.description),
    primaryButtonText: String(next.primaryButtonText || DEFAULT_HOME_PAGE.primaryButtonText).trim(),
    primaryButtonUrl: String(next.primaryButtonUrl || DEFAULT_HOME_PAGE.primaryButtonUrl).trim(),
    secondaryButtonText: String(next.secondaryButtonText || DEFAULT_HOME_PAGE.secondaryButtonText).trim(),
    secondaryButtonUrl: String(next.secondaryButtonUrl || DEFAULT_HOME_PAGE.secondaryButtonUrl).trim(),
    primaryButtonColor: color(next.primaryButtonColor, DEFAULT_HOME_PAGE.primaryButtonColor),
    secondaryButtonColor: color(next.secondaryButtonColor, DEFAULT_HOME_PAGE.secondaryButtonColor),
    titleColor: color(next.titleColor, DEFAULT_HOME_PAGE.titleColor),
    subtitleColor: color(next.subtitleColor, DEFAULT_HOME_PAGE.subtitleColor),
    descriptionColor: color(next.descriptionColor, DEFAULT_HOME_PAGE.descriptionColor),
    coverType: next.coverType === "video" ? "video" : "image",
    coverUrl: String(next.coverUrl || "").trim(),
    coverVideoUrl: String(next.coverVideoUrl || "").trim(),
    coverPositionX: clampPercent(next.coverPositionX, DEFAULT_HOME_PAGE.coverPositionX),
    coverPositionY: clampPercent(next.coverPositionY, DEFAULT_HOME_PAGE.coverPositionY),
    coverZoom: clampZoom(next.coverZoom, DEFAULT_HOME_PAGE.coverZoom),
    coverOverlayOpacity: clampOverlay(next.coverOverlayOpacity, DEFAULT_HOME_PAGE.coverOverlayOpacity),
    entryCards: list(next.entryCards, DEFAULT_HOME_PAGE.entryCards).map((item, index) => ({
      title: text(item?.title, DEFAULT_HOME_PAGE.entryCards[index]?.title || "入口"),
      description: text(item?.description, DEFAULT_HOME_PAGE.entryCards[index]?.description || ""),
      actionText: text(item?.actionText, DEFAULT_HOME_PAGE.entryCards[index]?.actionText || "查看"),
      icon: ["doc", "cube", "user"].includes(item?.icon) ? item.icon : DEFAULT_HOME_PAGE.entryCards[index]?.icon || "doc",
      href: text(item?.href, DEFAULT_HOME_PAGE.entryCards[index]?.href || "/"),
      visible: item?.visible !== false,
    })).filter((item) => item.title || item.description || item.actionText),
  };
}

async function getHomePageSettings() {
  const result = await query("SELECT value_json FROM site_settings WHERE key = $1", [HOME_SETTING_KEY]);
  return normalizeHomePage(result.rows[0]?.value_json);
}

async function handlePublicHome(req, res) {
  const item = await getHomePageSettings();
  sendJson(res, 200, { item, source: "api" }, corsHeaders(req));
}

async function handleAdminHomeSettings(req, res) {
  const item = await getHomePageSettings();
  sendJson(res, 200, { item, source: "api" }, corsHeaders(req));
}

async function handleAdminUpdateHomeSettings(req, res) {
  const body = await readBody(req);
  const item = normalizeHomePage(body.item ?? body);
  const result = await query(
    `INSERT INTO site_settings(key, value_json, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key)
     DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now()
     RETURNING value_json`,
    [HOME_SETTING_KEY, JSON.stringify(item)],
  );
  sendJson(res, 200, { item: normalizeHomePage(result.rows[0]?.value_json), ok: true, source: "api" }, corsHeaders(req));
}

function normalizeSiteSettings(value = {}) {
  const next = { ...DEFAULT_SITE_SETTINGS, ...(value && typeof value === "object" ? value : {}) };
  const text = (input, fallback = "") => input === undefined || input === null ? fallback : String(input).trim();
  return {
    siteName: text(next.siteName, DEFAULT_SITE_SETTINGS.siteName) || DEFAULT_SITE_SETTINGS.siteName,
    siteSubtitle: text(next.siteSubtitle, DEFAULT_SITE_SETTINGS.siteSubtitle),
    logoUrl: text(next.logoUrl, DEFAULT_SITE_SETTINGS.logoUrl),
    defaultSeoTitle: text(next.defaultSeoTitle, DEFAULT_SITE_SETTINGS.defaultSeoTitle) || text(next.siteName, DEFAULT_SITE_SETTINGS.siteName),
    defaultSeoDescription: text(next.defaultSeoDescription, DEFAULT_SITE_SETTINGS.defaultSeoDescription),
    icpText: text(next.icpText, DEFAULT_SITE_SETTINGS.icpText),
    footerText: text(next.footerText, DEFAULT_SITE_SETTINGS.footerText),
  };
}

async function getSiteSettings() {
  const result = await query("SELECT value_json FROM site_settings WHERE key = $1", [SITE_SETTING_KEY]);
  return normalizeSiteSettings(result.rows[0]?.value_json);
}

async function handlePublicSiteSettings(req, res) {
  const item = await getSiteSettings();
  sendJson(res, 200, { item, source: "api" }, corsHeaders(req));
}

async function handleAdminSiteSettings(req, res) {
  const item = await getSiteSettings();
  sendJson(res, 200, { item, source: "api" }, corsHeaders(req));
}

async function handleAdminUpdateSiteSettings(req, res) {
  const body = await readBody(req);
  const item = normalizeSiteSettings(body.item ?? body);
  const result = await query(
    `INSERT INTO site_settings(key, value_json, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key)
     DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now()
     RETURNING value_json`,
    [SITE_SETTING_KEY, JSON.stringify(item)],
  );
  sendJson(res, 200, { item: normalizeSiteSettings(result.rows[0]?.value_json), ok: true, source: "api" }, corsHeaders(req));
}

function normalizeAboutPage(value = {}) {
  const next = { ...DEFAULT_ABOUT_PAGE, ...(value && typeof value === "object" ? value : {}) };
  const list = (items, fallback) => Array.isArray(items) ? items : fallback;
  return {
    ...next,
    phone: String(next.phone || DEFAULT_ABOUT_PAGE.phone || "").trim(),
    githubUrl: String(next.githubUrl || next.socials?.find?.((item) => String(item?.label || "").toLowerCase() === "github")?.url || DEFAULT_ABOUT_PAGE.githubUrl || "").trim(),
    wechatQrUrl: String(next.wechatQrUrl || "").trim(),
    skills: list(next.skills, DEFAULT_ABOUT_PAGE.skills).map((item) => String(item).trim()).filter(Boolean),
    projects: list(next.projects, DEFAULT_ABOUT_PAGE.projects).map((item, index) => ({
      title: String(item?.title || DEFAULT_ABOUT_PAGE.projects[index]?.title || "椤圭洰").trim(),
      description: String(item?.description || "").trim(),
      imageUrl: String(item?.imageUrl || "").trim(),
      projectUrl: String(item?.projectUrl || "").trim(),
      demoUrl: String(item?.demoUrl || "").trim(),
      tags: list(item?.tags, []).map((tag) => String(tag).trim()).filter(Boolean),
      badge: String(item?.badge || "").trim(),
    })).filter((item) => item.title),
    socials: list(next.socials, DEFAULT_ABOUT_PAGE.socials).map((item) => ({
      label: String(item?.label || "").trim(),
      url: String(item?.url || "").trim(),
    })).filter((item) => item.label),
    writingTopics: list(next.writingTopics, DEFAULT_ABOUT_PAGE.writingTopics).map((item) => typeof item === "string" ? { label: item.trim(), url: `/archive?tag=${encodeURIComponent(item.trim())}` } : { label: String(item?.label || "").trim(), url: String(item?.url || "").trim() }).filter((item) => item.label),
    timeline: list(next.timeline, DEFAULT_ABOUT_PAGE.timeline).map((item) => ({
      year: String(item?.year || "").trim(),
      title: String(item?.title || "").trim(),
      description: String(item?.description || "").trim(),
    })).filter((item) => item.year || item.title || item.description),
  };
}

async function getAboutPageSettings() {
  const result = await query("SELECT value_json FROM site_settings WHERE key = $1", [ABOUT_SETTING_KEY]);
  return normalizeAboutPage(result.rows[0]?.value_json);
}

async function handlePublicAbout(req, res) {
  const item = await getAboutPageSettings();
  sendJson(res, 200, { item, source: "api" }, corsHeaders(req));
}

async function handleAdminAboutSettings(req, res) {
  const item = await getAboutPageSettings();
  sendJson(res, 200, { item, source: "api" }, corsHeaders(req));
}

async function handleAdminUpdateAboutSettings(req, res) {
  const body = await readBody(req);
  const item = normalizeAboutPage(body.item ?? body);
  const result = await query(
    `INSERT INTO site_settings(key, value_json, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key)
     DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now()
     RETURNING value_json`,
    [ABOUT_SETTING_KEY, JSON.stringify(item)],
  );
  sendJson(res, 200, { item: normalizeAboutPage(result.rows[0]?.value_json), ok: true, source: "api" }, corsHeaders(req));
}

async function handleCreateSubscription(req, res) {
  const body = await readBody(req);
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendJson(res, 400, { error: "invalid_email", message: "Please enter a valid email" }, corsHeaders(req));
  }

  const token = crypto.randomBytes(24).toString("base64url");
  const result = await query(
    `INSERT INTO subscriptions(email, status, token)
     VALUES ($1, 'active', $2)
     ON CONFLICT (email)
     DO UPDATE SET status = 'active', token = EXCLUDED.token
     RETURNING id, email, status, created_at`,
    [email, token],
  );

  sendJson(res, 200, { ok: true, item: result.rows[0] }, corsHeaders(req));
}

async function handleLikePost(req, res, id) {
  const body = await readBody(req);
  const visitorId = String(body.visitorId || req.headers["x-visitor-id"] || req.socket.remoteAddress || "anonymous").slice(0, 120);
  const result = await transaction(async (client) => {
    const post = await client.query("SELECT id, likes_count FROM posts WHERE id = $1 AND status = 'published'", [id]);
    if (!post.rowCount) return null;
    const inserted = await client.query(
      `INSERT INTO likes(target_type, target_id, visitor_id, ip_address)
       VALUES ('post', $1, $2, $3)
       ON CONFLICT (target_type, target_id, visitor_id) DO NOTHING
       RETURNING id`,
      [id, visitorId, req.socket.remoteAddress],
    );
    if (inserted.rowCount) {
      const updated = await client.query("UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count", [id]);
      await recordPostLikeStats(client, id);
      return { liked: true, likesCount: updated.rows[0].likes_count };
    }
    return { liked: false, alreadyLiked: true, likesCount: post.rows[0].likes_count };
  });
  if (!result) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  sendJson(res, 200, result, corsHeaders(req));
}

async function handleLikeMessage(req, res, id) {
  const body = await readBody(req);
  const visitorId = String(body.visitorId || req.headers["x-visitor-id"] || req.socket.remoteAddress || "anonymous").slice(0, 120);
  const result = await transaction(async (client) => {
    const message = await client.query("SELECT id, likes_count FROM messages WHERE id = $1 AND status = 'approved'", [id]);
    if (!message.rowCount) return null;
    const inserted = await client.query(
      `INSERT INTO likes(target_type, target_id, visitor_id, ip_address)
       VALUES ('message', $1, $2, $3)
       ON CONFLICT (target_type, target_id, visitor_id) DO NOTHING
       RETURNING id`,
      [id, visitorId, req.socket.remoteAddress],
    );
    if (inserted.rowCount) {
      const updated = await client.query("UPDATE messages SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count", [id]);
      await recordSiteLikeStats(client);
      return { liked: true, likesCount: updated.rows[0].likes_count };
    }
    return { liked: false, alreadyLiked: true, likesCount: message.rows[0].likes_count };
  });
  if (!result) return sendJson(res, 404, { error: "message_not_found" }, corsHeaders(req));
  sendJson(res, 200, result, corsHeaders(req));
}

async function refreshPostCommentCount(client, postId) {
  await client.query(
    `UPDATE posts
     SET comments_count = (
       SELECT count(*)::integer
       FROM comments
       WHERE post_id = $1 AND status = 'approved'
     )
     WHERE id = $1`,
    [postId],
  );
}

async function handlePublicComments(req, res, id) {
  const post = await query("SELECT id FROM posts WHERE id = $1 AND status = 'published'", [id]);
  if (!post.rowCount) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  const result = await query(
    `SELECT id, parent_id, author_name, author_site, content, likes_count, status, created_at
     FROM comments
     WHERE post_id = $1 AND status = 'approved'
     ORDER BY created_at ASC
     LIMIT 100`,
    [id],
  );
  sendJson(res, 200, { items: result.rows }, corsHeaders(req));
}

async function handleCreateComment(req, res, id) {
  if (enforceRateLimit(req, res, { scope: "public-comment", max: 5, windowMs: 60 * 1000 })) return;
  const body = await readBody(req);
  const authorName = String(body.authorName || body.author || "").trim();
  const authorEmail = String(body.authorEmail || body.email || "").trim();
  const content = String(body.content || "").trim();
  if (!authorName) return sendJson(res, 400, { error: "author_required", message: "Comment author is required" }, corsHeaders(req));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail)) {
    return sendJson(res, 400, { error: "invalid_email", message: "Please enter a valid email" }, corsHeaders(req));
  }
  if (!content) return sendJson(res, 400, { error: "content_required", message: "Comment content is required" }, corsHeaders(req));
  if (content.length > COMMENT_CONTENT_MAX_LENGTH) {
    return sendJson(res, 400, { error: "content_too_long", message: `Comment content cannot exceed ${COMMENT_CONTENT_MAX_LENGTH} characters` }, corsHeaders(req));
  }
  const post = await query("SELECT allow_comment, require_comment_review FROM posts WHERE id = $1 AND status = 'published'", [id]);
  if (!post.rowCount) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  if (post.rows[0].allow_comment === false) return sendJson(res, 403, { error: "comments_disabled" }, corsHeaders(req));
  const commentStatus = post.rows[0].require_comment_review === false ? "approved" : "pending";
  const result = await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO comments(post_id, parent_id, author_name, author_email, author_site, content, status, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, author_name, content, likes_count, status, created_at`,
      [id, body.parentId ?? null, authorName, authorEmail, body.authorSite ?? body.site ?? null, content, commentStatus, req.socket.remoteAddress, req.headers["user-agent"] ?? ""],
    );
    await refreshPostCommentCount(client, id);
    if (commentStatus === "approved") await recordApprovedCommentStats(client, id);
    return inserted.rows[0];
  });
  sendJson(res, 201, { item: result }, corsHeaders(req));
}

async function handlePublicMessages(req, res) {
  const result = await query(`
    SELECT id, parent_id, author_name, author_site, role, content, likes_count, status, created_at
    FROM messages
    WHERE status = 'approved'
    ORDER BY created_at ASC
    LIMIT 50
  `);
  const byId = new Map();
  const roots = [];
  for (const row of result.rows) {
    const item = { ...row, replies: [] };
    byId.set(String(row.id), item);
  }
  for (const item of byId.values()) {
    if (item.parent_id && byId.has(String(item.parent_id))) {
      byId.get(String(item.parent_id)).replies.push(item);
    } else {
      roots.push(item);
    }
  }
  roots.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  sendJson(res, 200, { items: roots }, corsHeaders(req));
}

async function handleCreateMessage(req, res) {
  if (enforceRateLimit(req, res, { scope: "public-message", max: 3, windowMs: 60 * 1000 })) return;
  const body = await readBody(req);
  const authorName = String(body.authorName || body.author || "").trim();
  const authorEmail = String(body.authorEmail || body.email || "").trim();
  const content = String(body.content || "").trim();
  if (!authorName || !authorEmail || !content) return sendJson(res, 400, { error: "message_required_fields", message: "璇峰～鍐欐樀绉般€侀偖绠卞拰鐣欒█鍐呭" }, corsHeaders(req));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail)) {
    return sendJson(res, 400, { error: "invalid_email", message: "Please enter a valid email" }, corsHeaders(req));
  }
  if (content.length > MESSAGE_CONTENT_MAX_LENGTH) {
    return sendJson(res, 400, { error: "content_too_long", message: `Message content cannot exceed ${MESSAGE_CONTENT_MAX_LENGTH} characters` }, corsHeaders(req));
  }
  const parentId = body.parentId ?? body.parent_id ?? null;
  const result = await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO messages(parent_id, author_name, author_email, author_site, role, content, status, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,'visitor',$5,'pending',$6,$7)
       RETURNING id, parent_id, author_name, role, content, likes_count, status, created_at`,
      [parentId, authorName, authorEmail, body.authorSite ?? body.site ?? null, content, req.socket.remoteAddress, req.headers["user-agent"] ?? ""],
    );
    return inserted;
  });
  sendJson(res, 201, { item: result.rows[0] }, corsHeaders(req));
}

async function handleAdminPosts(req, res, url) {
  await publishDueScheduledPosts();
  const status = url.searchParams.get("status");
  const params = [];
  const where = [];
  if (status) {
    params.push(status);
    where.push(`p.status = $${params.length}`);
  } else {
    where.push("p.status <> 'archived'");
  }
  const result = await query(
    `
      SELECT
        p.id, p.title, p.slug, p.excerpt, p.summary, p.cover_url, p.status, p.visibility, p.password_hint,
        p.access_password_hash, p.is_featured, p.allow_comment,
        p.reading_minutes, p.views_count, p.likes_count, p.comments_count, p.published_at,
        c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
        COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug) ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN post_tags pt ON pt.post_id = p.id
      LEFT JOIN tags t ON t.id = pt.tag_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY p.id, c.id
      ORDER BY p.is_featured DESC, p.updated_at DESC
    `,
    params,
  );
  sendJson(res, 200, { items: result.rows.map((row) => ({ ...mapPost(row), status: row.status })) }, corsHeaders(req));
}

async function handleAdminPostDetail(req, res, id) {
  await publishDueScheduledPosts();
  const post = await getPostDetail(id);
  if (!post) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  sendJson(res, 200, post, corsHeaders(req));
}

async function handleAdminPostVersions(req, res, id) {
  const post = await query("SELECT id FROM posts WHERE id = $1", [id]);
  if (!post.rowCount) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  const versions = await query(
    `SELECT id, title, summary, content_markdown, cover_url, category_name, tags_json, created_at
     FROM post_versions
     WHERE post_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [id],
  );
  sendJson(res, 200, { items: versions.rows.map((item) => ({
    id: Number(item.id),
    title: item.title,
    summary: item.summary || "",
    contentMarkdown: item.content_markdown || "",
    coverUrl: item.cover_url || "",
    categoryName: item.category_name || "",
    tags: Array.isArray(item.tags_json) ? item.tags_json : [],
    createdAt: item.created_at,
  })) }, corsHeaders(req));
}

async function handleAdminCreatePost(req, res) {
  const body = await readBody(req);
  const publishError = validatePublishablePost(body);
  if (publishError) return sendJson(res, 400, publishError, corsHeaders(req));
  const passwordError = await validatePostAccessPassword(body);
  if (passwordError) return sendJson(res, 400, passwordError, corsHeaders(req));
  const scheduleError = validatePostSchedule(body);
  if (scheduleError) return sendJson(res, 400, scheduleError, corsHeaders(req));
  const id = await transaction((client) => writePost(client, { ...body, adminUserId: req.adminUser?.id ?? null }));
  const item = id ? await getPostDetail(id) : null;
  if (!item) return sendJson(res, 500, { error: "post_create_failed" }, corsHeaders(req));
  sendJson(res, 201, { id, ok: true, item }, corsHeaders(req));
}

async function handleAdminUpdatePost(req, res, id) {
  const body = await readBody(req);
  const publishError = validatePublishablePost(body);
  if (publishError) return sendJson(res, 400, publishError, corsHeaders(req));
  const passwordError = await validatePostAccessPassword(body, id);
  if (passwordError) return sendJson(res, 400, passwordError, corsHeaders(req));
  const scheduleError = validatePostSchedule(body);
  if (scheduleError) return sendJson(res, 400, scheduleError, corsHeaders(req));
  const postId = await transaction((client) => writePost(client, { ...body, adminUserId: req.adminUser?.id ?? null }, id));
  if (!postId) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  const item = await getPostDetail(postId);
  sendJson(res, 200, { id: postId, ok: true, item }, corsHeaders(req));
}

async function handleAdminDuplicatePost(req, res, id) {
  const source = await getPostDetail(id);
  if (!source) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  const newId = await transaction((client) => writePost(client, {
    title: `${source.title} 副本`,
    contentMarkdown: source.contentMarkdown,
    summary: source.summary,
    coverUrl: source.coverUrl,
    categoryName: source.category?.name,
    tags: source.tags?.map((tag) => tag.name) ?? [],
    status: "draft",
    visibility: source.visibility,
    isFeatured: false,
    allowComment: source.allowComment,
    requireCommentReview: source.requireCommentReview,
    readingMinutes: source.readingMinutes,
  }));
  const item = newId ? await getPostDetail(newId) : null;
  if (!item) return sendJson(res, 500, { error: "post_duplicate_failed", message: "Post duplicate failed" }, corsHeaders(req));
  sendJson(res, 201, { id: newId, ok: true, item }, corsHeaders(req));
}

async function handleAdminPublishPost(req, res, id) {
  const result = await transaction(async (client) => {
    const current = await client.query("SELECT id, title, content_markdown, visibility, access_password_hash FROM posts WHERE id = $1", [id]);
    if (!current.rowCount) return { missing: true, rowCount: 0 };
    if (!String(current.rows[0].title || "").trim() || !String(current.rows[0].content_markdown || "").trim()) {
      return { invalid: true, rowCount: 0 };
    }
    if (current.rows[0].visibility === "password" && !current.rows[0].access_password_hash) {
      return { passwordMissing: true, rowCount: 0 };
    }
    const updated = await client.query(
      `UPDATE posts
       SET status = 'published', published_at = COALESCE(published_at, now()), updated_at = now()
       WHERE id = $1
       RETURNING id`,
      [id],
    );
    if (updated.rowCount) await refreshTaxonomyCounts(client);
    return updated;
  });
  if (result.missing) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  if (result.invalid) return sendJson(res, 400, { error: "post_not_publishable", message: "Post title and content are required" }, corsHeaders(req));
  if (result.passwordMissing) return sendJson(res, 400, { error: "post_password_required", message: "Password protected posts require an access password" }, corsHeaders(req));
  if (!result.rowCount) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  const item = await getPostDetail(id);
  sendJson(res, 200, { id, ok: true, status: "published", item }, corsHeaders(req));
}

async function handleAdminStatusPost(req, res, id) {
  const body = await readBody(req);
  const status = ["published", "scheduled", "draft", "archived"].includes(body.status) ? body.status : "";
  if (!status) return sendJson(res, 400, { error: "invalid_status" }, corsHeaders(req));
  if (status === "scheduled") {
    return sendJson(res, 400, { error: "scheduled_requires_editor", message: "瀹氭椂鍙戝竷闇€瑕佸湪缂栬緫鍣ㄥ～鍐欏彂甯冩椂闂村悗淇濆瓨" }, corsHeaders(req));
  }
  const result = await transaction(async (client) => {
    if (status === "published") {
      const current = await client.query("SELECT title, content_markdown, visibility, access_password_hash FROM posts WHERE id = $1", [id]);
      if (!current.rowCount) return { missing: true, rowCount: 0 };
      if (!String(current.rows[0].title || "").trim() || !String(current.rows[0].content_markdown || "").trim()) {
        return { invalid: true, rowCount: 0 };
      }
      if (current.rows[0].visibility === "password" && !current.rows[0].access_password_hash) {
        return { passwordMissing: true, rowCount: 0 };
      }
    }
    const updated = await client.query(
      `UPDATE posts
       SET status = $1::varchar,
           published_at = CASE WHEN $1::varchar = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
           scheduled_at = CASE WHEN $1::varchar = 'scheduled' THEN scheduled_at ELSE NULL END,
           updated_at = now()
       WHERE id = $2
       RETURNING id`,
      [status, id],
    );
    if (updated.rowCount) await refreshTaxonomyCounts(client);
    return updated;
  });
  if (result.missing) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  if (result.invalid) return sendJson(res, 400, { error: "post_not_publishable", message: "Post title and content are required" }, corsHeaders(req));
  if (result.passwordMissing) return sendJson(res, 400, { error: "post_password_required", message: "Password protected posts require an access password" }, corsHeaders(req));
  if (!result.rowCount) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  const item = await getPostDetail(id);
  sendJson(res, 200, { id, ok: true, status, item }, corsHeaders(req));
}

async function handleAdminFeaturedPost(req, res, id) {
  const body = await readBody(req);
  const rawFeatured = body.isFeatured ?? body.featured;
  const isFeatured = rawFeatured === true || rawFeatured === "true" || rawFeatured === 1 || rawFeatured === "1";
  const result = await query(
    `UPDATE posts
     SET is_featured = $1,
         updated_at = now()
     WHERE id = $2
     RETURNING id`,
    [isFeatured, id],
  );
  if (!result.rowCount) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  const item = await getPostDetail(id);
  sendJson(res, 200, { id, ok: true, isFeatured, item }, corsHeaders(req));
}

async function handleAdminDeletePost(req, res, id) {
  const result = await transaction(async (client) => {
    const current = await client.query("SELECT status FROM posts WHERE id = $1", [id]);
    if (!current.rowCount) return null;
    if (current.rows[0].status === "archived") {
      const deleted = await client.query("DELETE FROM posts WHERE id = $1 RETURNING id", [id]);
      if (deleted.rowCount) await refreshTaxonomyCounts(client);
      return { id: deleted.rows[0].id, ok: true, deleted: true };
    }
    const archived = await client.query(
      "UPDATE posts SET status = 'archived', scheduled_at = NULL, updated_at = now() WHERE id = $1 RETURNING id",
      [id],
    );
    if (archived.rowCount) await refreshTaxonomyCounts(client);
    return { id: archived.rows[0].id, ok: true, status: "archived", deleted: false };
  });
  if (!result) return sendJson(res, 404, { error: "post_not_found" }, corsHeaders(req));
  sendJson(res, 200, result, corsHeaders(req));
}

async function handleAdminDashboard(req, res) {
  await publishDueScheduledPosts();
  const [statusCounts, totals, pending, mediaCount, categoryCount, tagCount, hotPosts, pendingComments, pendingMessages, latestPosts, dailyStats] = await Promise.all([
    query("SELECT status, count(*)::integer AS count FROM posts GROUP BY status"),
    query(`
      SELECT
        count(*)::integer AS total_posts,
        COALESCE(sum(views_count), 0)::integer AS total_views,
        COALESCE(sum(likes_count), 0)::integer AS total_likes,
        COALESCE(sum(comments_count), 0)::integer AS total_comments
      FROM posts
      WHERE status <> 'archived'
    `),
    query(`
      SELECT
        (SELECT count(*)::integer FROM comments WHERE status = 'pending') AS pending_comments,
        (SELECT count(*)::integer FROM messages WHERE status = 'pending') AS pending_messages
    `),
    query("SELECT count(*)::integer AS count FROM media_assets"),
    query("SELECT count(*)::integer AS count FROM categories WHERE NOT (posts_count = 0 AND name ~ '^\\?+$')"),
    query("SELECT count(*)::integer AS count FROM tags"),
    query(`
      SELECT id, title, views_count, likes_count, comments_count
      FROM posts
      WHERE status = 'published'
      ORDER BY views_count DESC, likes_count DESC, published_at DESC NULLS LAST
      LIMIT 5
    `),
    query(`
      SELECT cm.id, cm.author_name, cm.content, cm.status, cm.created_at, p.title AS post_title
      FROM comments cm
      LEFT JOIN posts p ON p.id = cm.post_id
      WHERE cm.status = 'pending'
      ORDER BY cm.created_at DESC
      LIMIT 5
    `),
    query(`
      SELECT id, author_name, content, status, created_at
      FROM messages
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT 5
    `),
    query(`
      SELECT id, title, status, updated_at, published_at
      FROM posts
      ORDER BY updated_at DESC
      LIMIT 5
    `),
    query(`
      SELECT
        to_char(stat_date, 'YYYY-MM-DD') AS date,
        pv::integer AS pv,
        uv::integer AS uv,
        comments_count::integer AS comments_count,
        messages_count::integer AS messages_count,
        likes_count::integer AS likes_count
      FROM site_daily_stats
      WHERE stat_date >= CURRENT_DATE - INTERVAL '6 days'
      ORDER BY stat_date ASC
    `),
  ]);

  const counts = { published: 0, draft: 0, scheduled: 0, archived: 0 };
  for (const row of statusCounts.rows) {
    if (Object.prototype.hasOwnProperty.call(counts, row.status)) counts[row.status] = row.count;
  }
  const totalRow = totals.rows[0] ?? {};
  const pendingRow = pending.rows[0] ?? {};

  sendJson(res, 200, {
    counts: {
      posts: totalRow.total_posts ?? 0,
      published: counts.published,
      draft: counts.draft,
      scheduled: counts.scheduled,
      archived: counts.archived,
      pendingComments: pendingRow.pending_comments ?? 0,
      pendingMessages: pendingRow.pending_messages ?? 0,
      media: mediaCount.rows[0]?.count ?? 0,
      categories: categoryCount.rows[0]?.count ?? 0,
      tags: tagCount.rows[0]?.count ?? 0,
      views: totalRow.total_views ?? 0,
      likes: totalRow.total_likes ?? 0,
      comments: totalRow.total_comments ?? 0,
    },
    hotPosts: hotPosts.rows,
    pendingComments: pendingComments.rows,
    pendingMessages: pendingMessages.rows,
    latestPosts: latestPosts.rows,
    dailyStats: dailyStats.rows,
  }, corsHeaders(req));
}

async function handleAdminSearch(req, res, url) {
  const keyword = String(url.searchParams.get("q") || "").trim().toLowerCase();
  if (!keyword) return sendJson(res, 200, { items: [] }, corsHeaders(req));
  const pattern = `%${keyword}%`;
  const [posts, categoriesResult, tagsResult, mediaResult] = await Promise.all([
    query(
      `SELECT id, title, status, updated_at
       FROM posts
       WHERE lower(title) LIKE $1 OR lower(COALESCE(excerpt, '')) LIKE $1 OR lower(COALESCE(summary, '')) LIKE $1
       ORDER BY updated_at DESC
       LIMIT 6`,
      [pattern],
    ),
    query(
      `SELECT id, name, posts_count
       FROM categories
       WHERE lower(name) LIKE $1 OR lower(COALESCE(description, '')) LIKE $1
       ORDER BY posts_count DESC, name ASC
       LIMIT 4`,
      [pattern],
    ),
    query(
      `SELECT id, name, posts_count
       FROM tags
       WHERE lower(name) LIKE $1
       ORDER BY posts_count DESC, name ASC
       LIMIT 4`,
      [pattern],
    ),
    query(
      `SELECT id, original_name, file_name, mime_type, created_at
       FROM media_assets
       WHERE lower(original_name) LIKE $1 OR lower(file_name) LIKE $1 OR lower(COALESCE(alt_text, '')) LIKE $1 OR lower(mime_type) LIKE $1
       ORDER BY created_at DESC
       LIMIT 6`,
      [pattern],
    ),
  ]);
  const items = [
    ...posts.rows.map((item) => ({ kind: "post", title: item.title, subtitle: `文章 · ${item.status} · ${String(item.updated_at || "").slice(0, 10)}`, href: `/admin/editor?id=${item.id}` })),
    ...categoriesResult.rows.map((item) => ({ kind: "category", title: item.name, subtitle: `分类 · ${item.posts_count ?? 0} 篇文章`, href: "/admin/categories" })),
    ...tagsResult.rows.map((item) => ({ kind: "tag", title: item.name, subtitle: `标签 · ${item.posts_count ?? 0} 篇文章`, href: "/admin/tags" })),
    ...mediaResult.rows.map((item) => ({ kind: "media", title: item.original_name || item.file_name, subtitle: `媒体 · ${item.mime_type}`, href: "/admin/media" })),
  ];
  sendJson(res, 200, { items }, corsHeaders(req));
}

async function handleAdminMedia(req, res, url) {
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || 20), 1), 100);
  const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
  const type = String(url.searchParams.get("type") || "all");
  const keyword = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const params = [];
  const where = [];
  if (type === "image" || type === "video") {
    params.push(`${type}/%`);
    where.push(`mime_type LIKE $${params.length}`);
  }
  if (keyword) {
    params.push(`%${keyword}%`);
    where.push(`(lower(file_name) LIKE $${params.length} OR lower(original_name) LIKE $${params.length} OR lower(COALESCE(alt_text, '')) LIKE $${params.length} OR lower(mime_type) LIKE $${params.length})`);
  }
  params.push(pageSize, (page - 1) * pageSize);
  const existing = await query(
    `SELECT count(*) OVER()::integer AS total_count,
            id, file_name, original_name, mime_type, file_size, url, width, height, alt_text, created_at
     FROM media_assets
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = Number(existing.rows[0]?.total_count ?? 0);
  sendJson(res, 200, { items: existing.rows, page, pageSize, total, hasMore: page * pageSize < total }, corsHeaders(req));
}

async function handleAdminUploadMedia(req, res) {
  const body = await readBuffer(req);
  const { fields, files } = parseMultipart(req, body);
  const file = files.find((item) => item.fieldName === "file") ?? files[0];
  if (!file) return sendJson(res, 400, { error: "file_required", message: "Please choose an image or video file" }, corsHeaders(req));
  const isImage = file.mimeType.startsWith("image/");
  const isVideo = file.mimeType.startsWith("video/");
  if (!isImage && !isVideo) {
    return sendJson(res, 400, { error: "invalid_file_type", message: "Only image or video files are supported" }, corsHeaders(req));
  }
  const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.buffer.length > maxSize) {
    return sendJson(res, 413, { error: "file_too_large", message: isVideo ? "Video files cannot exceed 50MB" : "Image files cannot exceed 5MB" }, corsHeaders(req));
  }

  const [year, month, day] = uploadDateParts();
  const uploadDir = path.join(uploadRoot, year, month, day);
  await mkdir(uploadDir, { recursive: true });
  const ext = safeUploadExtension(file);
  const baseName = safeUploadBaseName(file.originalName);
  const randomId = crypto.randomBytes(4).toString("hex");
  const fileName = `${baseName}-${randomId}${ext}`;
  const storagePath = path.join(uploadDir, fileName);
  await writeFile(storagePath, file.buffer);
  const storageName = [year, month, day, fileName].join("/");
  const url = `/uploads/${storageName}`;

  const result = await query(
    `INSERT INTO media_assets(file_name, original_name, mime_type, file_size, url, storage_path, alt_text, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, file_name, original_name, mime_type, file_size, url, storage_path, width, height, alt_text, created_at`,
    [storageName, file.originalName, file.mimeType, file.buffer.length, url, storagePath, fields.altText || file.originalName, req.adminUser?.id ?? null],
  );

  sendJson(res, 201, { item: result.rows[0], ok: true }, corsHeaders(req));
}

async function handleAdminUpdateMedia(req, res, id) {
  const body = await readBody(req);
  const altText = String(body.altText ?? body.alt_text ?? "").trim();
  const result = await query(
    `UPDATE media_assets
     SET alt_text = $1
     WHERE id = $2
     RETURNING id, file_name, original_name, mime_type, file_size, url, storage_path, width, height, alt_text, created_at`,
    [altText, id],
  );
  if (!result.rowCount) return sendJson(res, 404, { error: "media_not_found", message: "媒体文件不存在" }, corsHeaders(req));
  sendJson(res, 200, { item: result.rows[0], ok: true }, corsHeaders(req));
}

function escapeLikePattern(value) {
  return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
}

async function handleAdminDeleteMedia(req, res, id) {
  const media = await query(
    `SELECT id, url, storage_path
     FROM media_assets
     WHERE id = $1`,
    [id],
  );
  if (!media.rowCount) return sendJson(res, 404, { error: "media_not_found", message: "媒体文件不存在" }, corsHeaders(req));
  const mediaUrl = media.rows[0].url;
  const usage = await query(
    `SELECT id, title, status
     FROM posts
     WHERE cover_url = $1
        OR content_markdown LIKE $2 ESCAPE '\\'
     ORDER BY updated_at DESC
     LIMIT 5`,
    [mediaUrl, `%${escapeLikePattern(mediaUrl)}%`],
  );
  if (usage.rowCount) {
    return sendJson(res, 409, {
      error: "media_in_use",
      message: "Media is currently used by existing posts. Remove it from post content or cover before deleting.",
      posts: usage.rows.map((item) => ({ id: Number(item.id), title: item.title, status: item.status })),
    }, corsHeaders(req));
  }

  await query("DELETE FROM media_assets WHERE id = $1", [id]);
  await removeUploadedFile(media.rows[0].storage_path);
  sendJson(res, 200, { id, ok: true, deleted: true }, corsHeaders(req));
}

async function handleAdminCategories(req, res) {
  const result = await query(`
    SELECT id, name, slug, description, icon, sort_order, posts_count, created_at, updated_at
    FROM categories
    WHERE NOT (posts_count = 0 AND name ~ '^\\?+$')
    ORDER BY sort_order ASC, name ASC
  `);
  sendJson(res, 200, { items: result.rows }, corsHeaders(req));
}

async function handleAdminCreateCategory(req, res) {
  const body = await readBody(req);
  const name = String(body.name || "").trim();
  if (!name) return sendJson(res, 400, { error: "name_required", message: "Category name is required" }, corsHeaders(req));
  const slug = slugify(body.slug || name);
  const result = await query(
    `INSERT INTO categories(name, slug, description, icon, sort_order)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, name, slug, description, icon, sort_order, posts_count, created_at, updated_at`,
    [name, slug, body.description ?? null, body.icon ?? null, Number(body.sortOrder ?? body.sort_order ?? 0) || 0],
  );
  sendJson(res, 201, { item: result.rows[0], ok: true }, corsHeaders(req));
}

async function handleAdminUpdateCategory(req, res, id) {
  const body = await readBody(req);
  const name = String(body.name || "").trim();
  if (!name) return sendJson(res, 400, { error: "name_required", message: "Category name is required" }, corsHeaders(req));
  const slug = slugify(body.slug || name);
  const result = await query(
    `UPDATE categories
     SET name = $1,
         slug = $2,
         description = $3,
         icon = $4,
         sort_order = $5,
         updated_at = now()
     WHERE id = $6
     RETURNING id, name, slug, description, icon, sort_order, posts_count, created_at, updated_at`,
    [name, slug, body.description ?? null, body.icon ?? null, Number(body.sortOrder ?? body.sort_order ?? 0) || 0, id],
  );
  if (!result.rowCount) return sendJson(res, 404, { error: "category_not_found", message: "Category not found" }, corsHeaders(req));
  sendJson(res, 200, { item: result.rows[0], ok: true }, corsHeaders(req));
}

async function handleAdminDeleteCategory(req, res, id) {
  const used = await query("SELECT count(*)::integer AS count FROM posts WHERE category_id = $1", [id]);
  if ((used.rows[0]?.count ?? 0) > 0) {
    return sendJson(res, 409, { error: "category_in_use", message: "Category still has posts" }, corsHeaders(req));
  }
  const result = await query("DELETE FROM categories WHERE id = $1 RETURNING id", [id]);
  if (!result.rowCount) return sendJson(res, 404, { error: "category_not_found", message: "Category not found" }, corsHeaders(req));
  sendJson(res, 200, { id, ok: true, deleted: true }, corsHeaders(req));
}

async function handleAdminTags(req, res) {
  const result = await query(`
    SELECT id, name, slug, color, posts_count, created_at, updated_at
    FROM tags
    ORDER BY posts_count DESC, name ASC
  `);
  sendJson(res, 200, { items: result.rows }, corsHeaders(req));
}

async function handleAdminCreateTag(req, res) {
  const body = await readBody(req);
  const name = String(body.name || "").trim();
  if (!name) return sendJson(res, 400, { error: "name_required", message: "Tag name is required" }, corsHeaders(req));
  const slug = slugify(body.slug || name);
  const result = await query(
    `INSERT INTO tags(name, slug, color)
     VALUES ($1,$2,$3)
     RETURNING id, name, slug, color, posts_count, created_at, updated_at`,
    [name, slug, body.color ?? null],
  );
  sendJson(res, 201, { item: result.rows[0], ok: true }, corsHeaders(req));
}

async function handleAdminUpdateTag(req, res, id) {
  const body = await readBody(req);
  const name = String(body.name || "").trim();
  if (!name) return sendJson(res, 400, { error: "name_required", message: "Tag name is required" }, corsHeaders(req));
  const slug = slugify(body.slug || name);
  const result = await query(
    `UPDATE tags
     SET name = $1,
         slug = $2,
         color = $3,
         updated_at = now()
     WHERE id = $4
     RETURNING id, name, slug, color, posts_count, created_at, updated_at`,
    [name, slug, body.color ?? null, id],
  );
  if (!result.rowCount) return sendJson(res, 404, { error: "tag_not_found", message: "Tag not found" }, corsHeaders(req));
  sendJson(res, 200, { item: result.rows[0], ok: true }, corsHeaders(req));
}

async function handleAdminDeleteTag(req, res, id) {
  const used = await query("SELECT count(*)::integer AS count FROM post_tags WHERE tag_id = $1", [id]);
  if ((used.rows[0]?.count ?? 0) > 0) {
    return sendJson(res, 409, { error: "tag_in_use", message: "璇ユ爣绛句粛琚枃绔犱娇鐢紝涓嶈兘鍒犻櫎" }, corsHeaders(req));
  }
  const result = await query("DELETE FROM tags WHERE id = $1 RETURNING id", [id]);
  if (!result.rowCount) return sendJson(res, 404, { error: "tag_not_found", message: "Tag not found" }, corsHeaders(req));
  sendJson(res, 200, { id, ok: true, deleted: true }, corsHeaders(req));
}

async function handleAdminComments(req, res) {
  const result = await query(`
    SELECT
      cm.id, cm.author_name, cm.author_email, cm.author_site, cm.content, cm.likes_count,
      cm.status, cm.created_at, p.id AS post_id, p.title AS post_title
    FROM comments cm
    LEFT JOIN posts p ON p.id = cm.post_id
    ORDER BY cm.created_at DESC
    LIMIT 100
  `);
  sendJson(res, 200, { items: result.rows }, corsHeaders(req));
}

async function handleAdminUpdateComment(req, res, id) {
  const body = await readBody(req);
  const status = body.status === "rejected" ? "rejected" : body.status === "approved" ? "approved" : "";
  if (!status) return sendJson(res, 400, { error: "invalid_status" }, corsHeaders(req));
  const result = await transaction(async (client) => {
    const current = await client.query("SELECT id, post_id, status FROM comments WHERE id = $1 FOR UPDATE", [id]);
    if (!current.rowCount) return current;
    const updated = await client.query(
      `UPDATE comments SET status = $1, updated_at = now() WHERE id = $2
       RETURNING id, post_id, author_name, content, likes_count, status, created_at`,
      [status, id],
    );
    if (updated.rowCount) {
      await refreshPostCommentCount(client, updated.rows[0].post_id);
      if (current.rows[0].status !== "approved" && updated.rows[0].status === "approved") {
        await recordApprovedCommentStats(client, updated.rows[0].post_id);
      }
    }
    return updated;
  });
  if (!result.rowCount) return sendJson(res, 404, { error: "comment_not_found" }, corsHeaders(req));
  sendJson(res, 200, { item: result.rows[0], ok: true }, corsHeaders(req));
}

async function handleAdminDeleteComment(req, res, id) {
  const result = await transaction(async (client) => {
    const deleted = await client.query("DELETE FROM comments WHERE id = $1 RETURNING id, post_id", [id]);
    if (deleted.rowCount) await refreshPostCommentCount(client, deleted.rows[0].post_id);
    return deleted;
  });
  if (!result.rowCount) return sendJson(res, 404, { error: "comment_not_found", message: "Comment not found" }, corsHeaders(req));
  sendJson(res, 200, { id, ok: true, deleted: true }, corsHeaders(req));
}

async function handleAdminMessages(req, res) {
  const result = await query(`
    SELECT id, parent_id, author_name, author_email, author_site, role, content, likes_count, status, created_at
    FROM messages
    ORDER BY created_at DESC
    LIMIT 100
  `);
  sendJson(res, 200, { items: result.rows }, corsHeaders(req));
}

async function handleAdminUpdateMessage(req, res, id) {
  const body = await readBody(req);
  const status = body.status === "rejected" ? "rejected" : body.status === "approved" ? "approved" : "";
  if (!status) return sendJson(res, 400, { error: "invalid_status" }, corsHeaders(req));
  const result = await transaction(async (client) => {
    const current = await client.query("SELECT id, parent_id, status FROM messages WHERE id = $1 FOR UPDATE", [id]);
    if (!current.rowCount) return current;
    const updated = await client.query(
      `UPDATE messages SET status = $1, updated_at = now() WHERE id = $2
       RETURNING id, parent_id, author_name, role, content, likes_count, status, created_at`,
      [status, id],
    );
    if (updated.rowCount && !updated.rows[0].parent_id && current.rows[0].status !== "approved" && updated.rows[0].status === "approved") {
      await recordRootMessageStats(client);
    }
    return updated;
  });
  if (!result.rowCount) return sendJson(res, 404, { error: "message_not_found" }, corsHeaders(req));
  sendJson(res, 200, { item: result.rows[0], ok: true }, corsHeaders(req));
}

async function handleAdminDeleteMessage(req, res, id) {
  const result = await query("DELETE FROM messages WHERE id = $1 RETURNING id", [id]);
  if (!result.rowCount) return sendJson(res, 404, { error: "message_not_found", message: "Message not found" }, corsHeaders(req));
  sendJson(res, 200, { id, ok: true, deleted: true }, corsHeaders(req));
}

async function handleAdminReplyMessage(req, res, id) {
  const body = await readBody(req);
  const content = String(body.content || "").trim();
  if (!content) return sendJson(res, 400, { error: "content_required", message: "Reply content is required" }, corsHeaders(req));
  const parent = await query("SELECT id FROM messages WHERE id = $1", [id]);
  if (!parent.rowCount) return sendJson(res, 404, { error: "message_not_found" }, corsHeaders(req));
  const result = await query(
    `INSERT INTO messages(parent_id, author_name, author_email, role, content, status, ip_address, user_agent)
     VALUES ($1,$2,$3,'owner',$4,'approved',$5,$6)
     RETURNING id, parent_id, author_name, role, content, likes_count, status, created_at`,
    [id, req.adminUser?.username || "绔欓暱", req.adminUser?.email || null, content, req.socket.remoteAddress, req.headers["user-agent"] ?? ""],
  );
  sendJson(res, 201, { item: result.rows[0], ok: true }, corsHeaders(req));
}

function trimAiInput(value) {
  const text = String(value || "").trim();
  return text.length > AI_INPUT_MAX_CHARS ? `${text.slice(0, AI_INPUT_MAX_CHARS)}\n\n[内容过长，已截断后续部分]` : text;
}

function trimAiInstruction(value) {
  const text = String(value || "").trim();
  return text.length > AI_INSTRUCTION_MAX_CHARS ? text.slice(0, AI_INSTRUCTION_MAX_CHARS) : text;
}

function buildAiMessages(tool, body) {
  const definition = AI_TOOL_DEFINITIONS[tool];
  const title = String(body.title || "").trim() || "未命名文章";
  const summary = String(body.summary || "").trim();
  const scope = body.scope === "selection" ? "选中片段" : "全文";
  const userInstruction = trimAiInstruction(body.userInstruction || body.instruction);
  const reviewFocus = AI_COMMENT_FOCUS_LABELS[body.reviewFocus] || AI_COMMENT_FOCUS_LABELS.knowledge;
  const content = trimAiInput(body.content);
  const userParts = [
    `任务：${definition.label}`,
    tool === "polish" ? `润色范围：${scope}` : "",
    tool === "comment" ? `评论重点：${reviewFocus}` : "",
    tool === "comment" && body.enableWebSearch ? "已启用联网核查：请优先基于搜索到的最新资料判断可变事实；如果资料不足，请明确说明不确定；输出末尾请列出可用的参考来源链接。" : "",
    userInstruction ? `本次补充要求：${userInstruction}` : "",
    `标题：${title}`,
    summary ? `当前摘要：${summary}` : "",
    `正文：\n${content}`,
    definition.instruction,
  ].filter(Boolean);
  return [
    { role: "system", content: definition.system },
    { role: "user", content: userParts.join("\n\n") },
  ];
}

async function callQwenChat(messages) {
  const apiKey = config.qwenApiKey.trim();
  if (!apiKey) {
    const error = new Error("Qwen API key is not configured");
    error.code = "ai_not_configured";
    throw error;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.qwenTimeoutMs);
  try {
    const response = await fetch(`${config.qwenBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.qwenModel,
        messages,
        temperature: 0.35,
      }),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `Qwen request failed (${response.status})`;
      const error = new Error(message);
      error.code = "ai_provider_error";
      error.details = data;
      throw error;
    }
    const result = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!result) {
      const error = new Error("Qwen returned empty content");
      error.code = "ai_empty_result";
      throw error;
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const pieces = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object") return;
    if (typeof value.text === "string" && value.text.trim()) pieces.push(value.text.trim());
    if (typeof value.content === "string" && value.content.trim()) pieces.push(value.content.trim());
    if (value.content && typeof value.content !== "string") visit(value.content);
    if (value.output) visit(value.output);
  };
  visit(data?.output);
  visit(data?.choices?.[0]?.message?.content);
  return pieces.join("\n").trim();
}

function extractResponseSources(data) {
  const sources = [];
  const seen = new Set();
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object") return;
    const url = typeof value.url === "string" ? value.url : typeof value.link === "string" ? value.link : "";
    if (url && /^https?:\/\//i.test(url) && !seen.has(url)) {
      seen.add(url);
      sources.push({
        title: String(value.title || value.name || value.text || url).slice(0, 120),
        url,
      });
    }
    Object.values(value).forEach(visit);
  };
  visit(data);
  return sources.slice(0, 8);
}

function parsePolishResult(text) {
  const raw = String(text || "").trim();
  if (!raw) return { result: "", notes: "" };
  const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(jsonText);
    const result = String(parsed.polishedMarkdown || parsed.result || "").trim();
    const notes = Array.isArray(parsed.notes) ? parsed.notes.join("\n") : String(parsed.notes || "").trim();
    if (result) return { result, notes };
  } catch {
    // Fall back to treating the full response as polished markdown.
  }
  return { result: raw, notes: "模型未返回结构化说明，已保留润色后的正文结果。" };
}

async function callQwenResponses(messages) {
  const apiKey = config.qwenApiKey.trim();
  if (!apiKey) {
    const error = new Error("Qwen API key is not configured");
    error.code = "ai_not_configured";
    throw error;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.qwenResponsesTimeoutMs);
  try {
    const response = await fetch(`${config.qwenBaseUrl.replace(/\/+$/, "")}/responses`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.qwenResponsesModel,
        input: messages,
        tools: [
          { type: "web_search" },
        ],
      }),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `Qwen responses request failed (${response.status})`;
      const error = new Error(message);
      error.code = "ai_provider_error";
      error.details = data;
      throw error;
    }
    const result = extractResponseText(data);
    if (!result) {
      const error = new Error("Qwen responses returned empty content");
      error.code = "ai_empty_result";
      throw error;
    }
    return { result, sources: extractResponseSources(data), raw: data };
  } finally {
    clearTimeout(timer);
  }
}

async function createAiTask(req, tool, body) {
  try {
    const result = await query(
      `INSERT INTO ai_tasks(task_type, source_type, source_id, input_text, result_json, status, created_by)
       VALUES ($1,$2,$3,$4,$5,'running',$6)
       RETURNING id`,
      [
        tool,
        "post",
        Number(body.postId || body.post_id || 0) || null,
        trimAiInput(body.content),
        JSON.stringify({ title: body.title || "", summary: body.summary || "", provider: "qwen", model: body.enableWebSearch ? config.qwenResponsesModel : config.qwenModel, enableWebSearch: Boolean(body.enableWebSearch), userInstruction: trimAiInstruction(body.userInstruction || body.instruction), reviewFocus: body.reviewFocus || null }),
        req.adminUser?.id ?? null,
      ],
    );
    return result.rows[0]?.id;
  } catch (error) {
    console.warn("Failed to create ai task", error);
    return undefined;
  }
}

async function finishAiTask(taskId, status, resultJson) {
  if (!taskId) return;
  try {
    await query(
      `UPDATE ai_tasks SET status = $1, result_json = $2, updated_at = now() WHERE id = $3`,
      [status, JSON.stringify(resultJson), taskId],
    );
  } catch (error) {
    console.warn("Failed to update ai task", error);
  }
}

async function handleAdminAiStatus(req, res) {
  const tasks = await query("SELECT count(*)::integer AS count FROM ai_tasks");
  const enabled = Boolean(config.qwenApiKey.trim());
  sendJson(res, 200, {
    enabled,
    mode: enabled ? "api" : "mock",
    provider: enabled ? "qwen" : null,
    model: enabled ? config.qwenModel : null,
    responsesModel: enabled ? config.qwenResponsesModel : null,
    webSearchEnabled: enabled && config.aiWebSearchEnabled,
    tasksTableReady: true,
    tasksCount: tasks.rows[0]?.count ?? 0,
    message: enabled ? `千问已接入，当前模型：${config.qwenModel}` : "请在 backend/.env 配置 DASHSCOPE_API_KEY 后重启后端，AI 功能才会调用千问。",
  }, corsHeaders(req));
}

async function handleAdminAiRun(req, res) {
  const body = await readBody(req);
  const tool = String(body.tool || "").trim();
  const definition = AI_TOOL_DEFINITIONS[tool];
  if (!definition) return sendJson(res, 400, { error: "invalid_ai_tool", message: "Unsupported AI tool" }, corsHeaders(req));

  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  if (!title && !content) {
    return sendJson(res, 400, { error: "ai_content_required", message: "Title or content is required" }, corsHeaders(req));
  }
  if (!config.qwenApiKey.trim()) {
    return sendJson(res, 400, { error: "ai_not_configured", message: "请在 backend/.env 配置 DASHSCOPE_API_KEY 后重启后端。" }, corsHeaders(req));
  }

  const useWebSearch = tool === "comment" && body.enableWebSearch === true;
  if (useWebSearch && !config.aiWebSearchEnabled) {
    return sendJson(res, 400, { error: "ai_web_search_disabled", message: "AI web search is disabled on the backend." }, corsHeaders(req));
  }

  const taskId = await createAiTask(req, tool, body);
  try {
    const response = useWebSearch
      ? await callQwenResponses(buildAiMessages(tool, body))
      : { result: await callQwenChat(buildAiMessages(tool, body)), sources: [] };
    const polishResult = tool === "polish" ? parsePolishResult(response.result) : { result: response.result, notes: "" };
    const model = useWebSearch ? config.qwenResponsesModel : config.qwenModel;
    await finishAiTask(taskId, "succeeded", { result: polishResult.result, notes: polishResult.notes, sources: response.sources, provider: "qwen", model, enableWebSearch: useWebSearch });
    sendJson(res, 200, {
      ok: true,
      tool,
      label: definition.label,
      result: polishResult.result,
      notes: polishResult.notes,
      sources: response.sources,
      provider: "qwen",
      model,
      enableWebSearch: useWebSearch,
      taskId,
    }, corsHeaders(req));
  } catch (error) {
    const code = error?.code === "ai_not_configured" ? "ai_not_configured" : error?.name === "AbortError" ? "ai_timeout" : "ai_provider_error";
    await finishAiTask(taskId, "failed", { error: code, message: error.message });
    sendJson(res, code === "ai_not_configured" ? 400 : 502, { error: code, message: error.message }, corsHeaders(req));
  }
}

async function handleRequest(req, res) {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname.startsWith("/uploads/")) return serveUploadedFile(req, res, url);
    if (req.method === "GET" && url.pathname === "/api/health") return sendJson(res, 200, { ok: true }, headers);
    if (req.method === "GET" && url.pathname === "/api/public/categories") {
      await publishDueScheduledPosts();
      await refreshPublishedTaxonomyCounts();
      const result = await query("SELECT id, name, slug, description, icon, posts_count FROM categories WHERE posts_count > 0 ORDER BY sort_order ASC, name ASC");
      return sendJson(res, 200, { items: result.rows }, headers);
    }
    if (req.method === "GET" && url.pathname === "/api/public/tags") {
      await publishDueScheduledPosts();
      await refreshPublishedTaxonomyCounts();
      const result = await query("SELECT id, name, slug, color, posts_count FROM tags WHERE posts_count > 0 ORDER BY posts_count DESC, name ASC");
      return sendJson(res, 200, { items: result.rows }, headers);
    }
    if (req.method === "GET" && url.pathname === "/api/public/posts") return handlePublicPosts(req, res, url);
    if (req.method === "GET" && url.pathname === "/api/public/stats") return handlePublicStats(req, res);
    if (req.method === "GET" && url.pathname === "/api/public/site-settings") return handlePublicSiteSettings(req, res);
    if (req.method === "GET" && url.pathname === "/api/public/home") return handlePublicHome(req, res);
    if (req.method === "GET" && url.pathname === "/api/public/about") return handlePublicAbout(req, res);
    if (req.method === "GET" && url.pathname === "/api/public/archive") return handleArchive(req, res);
    if (req.method === "GET" && url.pathname === "/api/public/messages") return handlePublicMessages(req, res);
    if (req.method === "POST" && url.pathname === "/api/public/messages") return handleCreateMessage(req, res);
    if (req.method === "POST" && url.pathname === "/api/public/subscriptions") return handleCreateSubscription(req, res);

    const likeMessage = url.pathname.match(/^\/api\/public\/messages\/(\d+)\/like$/);
    if (req.method === "POST" && likeMessage) return handleLikeMessage(req, res, Number(likeMessage[1]));

    const postDetail = url.pathname.match(/^\/api\/public\/posts\/(\d+)$/);
    if (req.method === "GET" && postDetail) return handlePublicPostDetail(req, res, Number(postDetail[1]));

    const relatedPosts = url.pathname.match(/^\/api\/public\/posts\/(\d+)\/related$/);
    if (req.method === "GET" && relatedPosts) return handlePublicRelatedPosts(req, res, Number(relatedPosts[1]));

    const unlockPost = url.pathname.match(/^\/api\/public\/posts\/(\d+)\/unlock$/);
    if (req.method === "POST" && unlockPost) return handleUnlockPublicPost(req, res, Number(unlockPost[1]));

    const likePost = url.pathname.match(/^\/api\/public\/posts\/(\d+)\/like$/);
    if (req.method === "POST" && likePost) return handleLikePost(req, res, Number(likePost[1]));

    const publicComments = url.pathname.match(/^\/api\/public\/posts\/(\d+)\/comments$/);
    if (req.method === "GET" && publicComments) return handlePublicComments(req, res, Number(publicComments[1]));

    const createComment = url.pathname.match(/^\/api\/public\/posts\/(\d+)\/comments$/);
    if (req.method === "POST" && createComment) return handleCreateComment(req, res, Number(createComment[1]));

    if (req.method === "POST" && url.pathname === "/api/admin/auth/login") return handleAdminLogin(req, res);
    if (url.pathname.startsWith("/api/admin/")) {
      const adminUser = await requireAdmin(req, res);
      if (!adminUser) return;
    }
    if (req.method === "POST" && url.pathname === "/api/admin/auth/logout") return handleAdminLogout(req, res);

    if (req.method === "GET" && url.pathname === "/api/admin/posts") return handleAdminPosts(req, res, url);
    if (req.method === "POST" && url.pathname === "/api/admin/posts") return handleAdminCreatePost(req, res);

    const adminPost = url.pathname.match(/^\/api\/admin\/posts\/(\d+)$/);
    if (req.method === "GET" && adminPost) return handleAdminPostDetail(req, res, Number(adminPost[1]));
    if (req.method === "PUT" && adminPost) return handleAdminUpdatePost(req, res, Number(adminPost[1]));
    if (req.method === "DELETE" && adminPost) return handleAdminDeletePost(req, res, Number(adminPost[1]));

    const adminPostVersions = url.pathname.match(/^\/api\/admin\/posts\/(\d+)\/versions$/);
    if (req.method === "GET" && adminPostVersions) return handleAdminPostVersions(req, res, Number(adminPostVersions[1]));

    const adminPublish = url.pathname.match(/^\/api\/admin\/posts\/(\d+)\/publish$/);
    if (req.method === "POST" && adminPublish) return handleAdminPublishPost(req, res, Number(adminPublish[1]));

    const adminDuplicate = url.pathname.match(/^\/api\/admin\/posts\/(\d+)\/duplicate$/);
    if (req.method === "POST" && adminDuplicate) return handleAdminDuplicatePost(req, res, Number(adminDuplicate[1]));

    const adminStatus = url.pathname.match(/^\/api\/admin\/posts\/(\d+)\/status$/);
    if (req.method === "PUT" && adminStatus) return handleAdminStatusPost(req, res, Number(adminStatus[1]));

    const adminFeatured = url.pathname.match(/^\/api\/admin\/posts\/(\d+)\/featured$/);
    if (req.method === "PUT" && adminFeatured) return handleAdminFeaturedPost(req, res, Number(adminFeatured[1]));

    if (req.method === "GET" && url.pathname === "/api/admin/dashboard") return handleAdminDashboard(req, res);
    if (req.method === "GET" && url.pathname === "/api/admin/search") return handleAdminSearch(req, res, url);
    if (req.method === "GET" && url.pathname === "/api/admin/site-settings") return handleAdminSiteSettings(req, res);
    if (req.method === "PUT" && url.pathname === "/api/admin/site-settings") return handleAdminUpdateSiteSettings(req, res);
    if (req.method === "GET" && url.pathname === "/api/admin/home-settings") return handleAdminHomeSettings(req, res);
    if (req.method === "PUT" && url.pathname === "/api/admin/home-settings") return handleAdminUpdateHomeSettings(req, res);
    if (req.method === "GET" && url.pathname === "/api/admin/about-settings") return handleAdminAboutSettings(req, res);
    if (req.method === "PUT" && url.pathname === "/api/admin/about-settings") return handleAdminUpdateAboutSettings(req, res);
    if (req.method === "GET" && url.pathname === "/api/admin/media") return handleAdminMedia(req, res, url);
    if (req.method === "POST" && url.pathname === "/api/admin/media") return handleAdminUploadMedia(req, res);
    const adminMedia = url.pathname.match(/^\/api\/admin\/media\/(\d+)$/);
    if (req.method === "PUT" && adminMedia) return handleAdminUpdateMedia(req, res, Number(adminMedia[1]));
    if (req.method === "DELETE" && adminMedia) return handleAdminDeleteMedia(req, res, Number(adminMedia[1]));
    if (req.method === "GET" && url.pathname === "/api/admin/categories") return handleAdminCategories(req, res);
    if (req.method === "POST" && url.pathname === "/api/admin/categories") return handleAdminCreateCategory(req, res);
    const adminCategory = url.pathname.match(/^\/api\/admin\/categories\/(\d+)$/);
    if (req.method === "PUT" && adminCategory) return handleAdminUpdateCategory(req, res, Number(adminCategory[1]));
    if (req.method === "DELETE" && adminCategory) return handleAdminDeleteCategory(req, res, Number(adminCategory[1]));
    if (req.method === "GET" && url.pathname === "/api/admin/tags") return handleAdminTags(req, res);
    if (req.method === "POST" && url.pathname === "/api/admin/tags") return handleAdminCreateTag(req, res);
    const adminTag = url.pathname.match(/^\/api\/admin\/tags\/(\d+)$/);
    if (req.method === "PUT" && adminTag) return handleAdminUpdateTag(req, res, Number(adminTag[1]));
    if (req.method === "DELETE" && adminTag) return handleAdminDeleteTag(req, res, Number(adminTag[1]));
    if (req.method === "GET" && url.pathname === "/api/admin/comments") return handleAdminComments(req, res);
    if (req.method === "GET" && url.pathname === "/api/admin/messages") return handleAdminMessages(req, res);
    if (req.method === "GET" && url.pathname === "/api/admin/ai/status") return handleAdminAiStatus(req, res);
    if (req.method === "POST" && url.pathname === "/api/admin/ai/run") return handleAdminAiRun(req, res);

    const adminComment = url.pathname.match(/^\/api\/admin\/comments\/(\d+)$/);
    if (req.method === "PUT" && adminComment) return handleAdminUpdateComment(req, res, Number(adminComment[1]));
    if (req.method === "DELETE" && adminComment) return handleAdminDeleteComment(req, res, Number(adminComment[1]));

    const adminMessage = url.pathname.match(/^\/api\/admin\/messages\/(\d+)$/);
    if (req.method === "PUT" && adminMessage) return handleAdminUpdateMessage(req, res, Number(adminMessage[1]));
    if (req.method === "DELETE" && adminMessage) return handleAdminDeleteMessage(req, res, Number(adminMessage[1]));

    const adminMessageReply = url.pathname.match(/^\/api\/admin\/messages\/(\d+)\/replies$/);
    if (req.method === "POST" && adminMessageReply) return handleAdminReplyMessage(req, res, Number(adminMessageReply[1]));

    sendJson(res, 404, { error: "not_found" }, headers);
  } catch (error) {
    console.error(error);
    if (error?.code === "23505") {
      return sendJson(res, 409, { error: "duplicate_key", message: "Name or slug already exists" }, headers);
    }
    if (error?.code === "23503") {
      return sendJson(res, 409, { error: "record_in_use", message: "璇ヨ褰曚粛琚叾浠栨暟鎹紩鐢紝涓嶈兘鍒犻櫎" }, headers);
    }
    sendJson(res, 500, { error: "internal_error", message: error.message }, headers);
  }
}

await ensureRuntimeSchema();
await runScheduledPostPublisher();
warnRuntimeConfig();

const server = http.createServer(handleRequest);
const scheduledPublisherTimer = setInterval(runScheduledPostPublisher, 60 * 1000);

server.listen(config.port, config.host, () => {
  console.log(`blog backend listening on http://${config.host}:${config.port}`);
});

process.on("SIGINT", async () => {
  clearInterval(scheduledPublisherTimer);
  await closePool();
  server.close(() => process.exit(0));
});

