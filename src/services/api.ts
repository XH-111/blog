import { articles, categories, messages, tags } from "../data/mockData";
import type { Article, Message } from "../types";

const wait = <T,>(data: T, ms = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(data), ms);
  });

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const API_ORIGIN = /^https?:\/\//i.test(API_BASE) ? new URL(API_BASE).origin : "";
const ADMIN_TOKEN_KEY = "blog-admin-token";
const VISITOR_ID_KEY = "blog-visitor-id";
const ADMIN_AUTH_CHANGED_EVENT = "admin-auth-changed";
type DbId = number | string;

function getAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

function emitAuthChanged() {
  window.dispatchEvent(new Event(ADMIN_AUTH_CHANGED_EVENT));
}

function clearAdminSession() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(`${ADMIN_TOKEN_KEY}-expires-at`);
  emitAuthChanged();
}

function getVisitorId() {
  const existing = window.localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;
  const next = `visitor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(VISITOR_ID_KEY, next);
  return next;
}

function resolveBackendAssetUrl(url?: string) {
  if (!url) return url;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return url.startsWith("/uploads/") ? `${API_ORIGIN}${url}` : url;
}

function adminHeaders() {
  const token = getAdminToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

function requestHeaders(path: string, init?: RequestInit): HeadersInit {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) {
    headers.set("content-type", headers.get("content-type") ?? "application/json");
  }
  if (path.startsWith("/admin/")) {
    const token = getAdminToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }
  return headers;
}

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const API_ERROR_MESSAGES: Record<string, string> = {
  auth_required: "请输入管理员账号和密码",
  unauthorized: "账号或密码错误",
  invalid_session: "登录已失效，请重新登录",
  post_not_found: "文章不存在或已被删除",
  post_not_publishable: "发布文章必须填写标题和正文内容",
  scheduled_requires_editor: "定时发布需要在编辑器填写发布时间后保存",
  media_not_found: "媒体文件不存在",
  category_not_found: "分类不存在",
  category_in_use: "该分类下仍有文章，不能删除",
  tag_not_found: "标签不存在",
  tag_in_use: "该标签仍被文章使用，不能删除",
  comment_not_found: "评论不存在",
  message_not_found: "留言不存在",
  duplicate_key: "名称或 slug 已存在，请换一个名称",
  record_in_use: "该记录仍被其他数据引用，不能删除",
  invalid_email: "请输入有效邮箱",
  author_required: "请输入评论昵称",
  message_required_fields: "请填写昵称、邮箱和留言内容",
  comments_disabled: "这篇文章已关闭评论",
  content_too_long: "内容超过长度限制",
  content_required: "请输入内容",
  name_required: "请输入名称",
  invalid_status: "状态不合法",
  invalid_ai_tool: "AI 功能类型不支持",
  ai_content_required: "请先填写标题或正文内容",
  ai_not_configured: "请先在 backend/.env 配置千问 API Key，并重启后端",
  ai_provider_error: "AI 模型调用失败，请稍后重试或检查 Key 配置",
  ai_timeout: "AI 模型响应超时，请稍后重试",
  ai_empty_result: "AI 没有返回内容，请稍后重试",
  ai_web_search_disabled: "后端未启用 AI 联网核查，请检查 AI_WEB_SEARCH_ENABLED 配置",
};

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 20) return true;
  if (error instanceof Error && /aborted/i.test(error.message)) return true;
  return false;
}

async function requestJson<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: requestHeaders(path, init),
    });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    return fallback;
  } finally {
    window.clearTimeout(timer);
  }
}

type ApiRequestInit = RequestInit & { timeoutMs?: number };

async function requestStrictJson<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const { timeoutMs = 5000, ...requestInit } = init ?? {};
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...requestInit,
      signal: controller.signal,
      headers: requestHeaders(path, requestInit),
    });
    const text = await response.text();
    const body = (text ? JSON.parse(text) : {}) as T & { message?: string; error?: string; code?: string };
    if (!response.ok) {
      const code = body.code ?? body.error;
      const message = body.message ?? (code ? API_ERROR_MESSAGES[code] : undefined) ?? body.error ?? `请求失败 (${response.status})`;
      throw new ApiError(message, response.status, code, body);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isAbortError(error)) {
      throw new ApiError("请求超时或被中断，请稍后重试");
    }
    throw new ApiError("无法连接后端服务，请确认本地后端已启动");
  } finally {
    window.clearTimeout(timer);
  }
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (isAbortError(error)) return "请求超时或被中断，请稍后重试";
  if (error instanceof Error) return error.message;
  return "操作失败，请稍后重试";
}

function toNumberId(value: DbId | null | undefined) {
  return Number(value ?? 0);
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

let currentDraftId: number | undefined;

type EditorPostMeta = {
  categoryName?: string;
  tags?: string[];
  isFeatured?: boolean;
  coverUrl?: string;
  status?: "draft" | "published" | "scheduled";
  visibility?: "public" | "private" | "password";
  scheduledAt?: string;
  seoTitle?: string;
  allowComment?: boolean;
  requireCommentReview?: boolean;
};

type BackendPost = {
  id: DbId;
  title: string;
  excerpt?: string;
  summary?: string;
  contentMarkdown?: string;
  status?: "draft" | "published" | "scheduled" | "archived";
  visibility?: "public" | "private" | "password";
  scheduledAt?: string;
  requireCommentReview?: boolean;
  category?: { name: string } | null;
  tags?: Array<{ name: string }>;
  publishedAt?: string;
  readingMinutes?: number | string;
  viewsCount?: number | string;
  likesCount?: number | string;
  commentsCount?: number | string;
  coverUrl?: string;
  allowComment?: boolean;
  isFeatured?: boolean;
  sections?: Array<{ id: string; title: string; level: 2 | 3; body: string }>;
  previousPost?: { id: DbId; title: string } | null;
  nextPost?: { id: DbId; title: string } | null;
};

export type AdminPostListItem = Article & {
  status?: "draft" | "published" | "scheduled" | "archived";
};

export type EditorPostDetail = {
  id: number;
  title: string;
  markdown: string;
  summary: string;
  coverUrl?: string;
  categoryName?: string;
  tags: string[];
  status?: "draft" | "published" | "scheduled" | "archived";
  visibility?: "public" | "private" | "password";
  scheduledAt?: string;
  isFeatured?: boolean;
  allowComment?: boolean;
  requireCommentReview?: boolean;
};

export type AdminMediaItem = {
  id: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  url: string;
  width?: number;
  height?: number;
  altText?: string;
  createdAt?: string;
};

export type AdminCategoryItem = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  postsCount: number;
  updatedAt?: string;
};

export type AdminTagItem = {
  id: number;
  name: string;
  slug: string;
  color?: string;
  postsCount: number;
  updatedAt?: string;
};

export type AdminCommentItem = {
  id: number;
  authorName: string;
  content: string;
  status: string;
  postTitle?: string;
  likesCount: number;
  createdAt?: string;
};

export type PublicCommentItem = {
  id: number;
  parentId?: number | null;
  authorName: string;
  content: string;
  status: string;
  likesCount: number;
  createdAt?: string;
  localPending?: boolean;
};

export type AdminMessageItem = {
  id: number;
  parentId?: number | null;
  authorName: string;
  role: string;
  content: string;
  status: string;
  likesCount: number;
  createdAt?: string;
};

export type AdminDashboardData = {
  counts: {
    posts: number;
    published: number;
    draft: number;
    scheduled: number;
    archived: number;
    pendingComments: number;
    pendingMessages: number;
    media: number;
    categories: number;
    tags: number;
    views: number;
    likes: number;
    comments: number;
  };
  hotPosts: Array<{ id: number; title: string; viewsCount: number; likesCount: number; commentsCount: number }>;
  pendingComments: Array<{ id: number; authorName: string; content: string; status: string; postTitle?: string; createdAt?: string }>;
  pendingMessages: Array<{ id: number; authorName: string; content: string; status: string; createdAt?: string }>;
  latestPosts: Array<{ id: number; title: string; status: string; updatedAt?: string; publishedAt?: string }>;
  dailyStats: Array<{ date: string; pv: number; uv: number; commentsCount: number; messagesCount: number; likesCount: number }>;
  source: "api" | "mock";
};

export type PublicSiteStats = {
  posts: number;
  categories: number;
  tags: number;
  messages: number;
  views: number;
  likes: number;
  comments: number;
  source: "api" | "mock";
};

export type AboutProjectItem = {
  title: string;
  description: string;
  imageUrl?: string;
  projectUrl?: string;
  demoUrl?: string;
  tags: string[];
  badge?: string;
};

export type AboutSocialItem = {
  label: string;
  url?: string;
};

export type AboutTimelineItem = {
  year: string;
  title: string;
  description: string;
};

export type AboutTopicItem = {
  label: string;
  url?: string;
};

export type AboutPageSettings = {
  title: string;
  badge: string;
  subtitle: string;
  introTitle: string;
  intro: string;
  location: string;
  email: string;
  phone: string;
  website: string;
  githubUrl: string;
  wechatQrUrl: string;
  portraitUrl: string;
  safeDays: string;
  safeSince: string;
  skills: string[];
  projects: AboutProjectItem[];
  socials: AboutSocialItem[];
  writingTopics: AboutTopicItem[];
  timeline: AboutTimelineItem[];
  cooperateTitle: string;
  cooperateText: string;
  cooperateButtonText: string;
  cooperateUrl: string;
};

export type HomePageSettings = {
  title: string;
  subtitle: string;
  description: string;
  primaryButtonText: string;
  primaryButtonUrl: string;
  secondaryButtonText: string;
  secondaryButtonUrl: string;
  primaryButtonColor: string;
  secondaryButtonColor: string;
  titleColor: string;
  subtitleColor: string;
  descriptionColor: string;
  coverType: "image" | "video";
  coverUrl: string;
  coverVideoUrl: string;
  coverPositionX: number;
  coverPositionY: number;
  coverZoom: number;
  coverOverlayOpacity: number;
  entryCards: HomeEntryCardSetting[];
};

export type HomeEntryCardSetting = {
  title: string;
  description: string;
  actionText: string;
  icon: "doc" | "cube" | "user";
  href: string;
  visible: boolean;
};

export type PublicSubscriptionItem = {
  id: number;
  email: string;
  status: string;
  createdAt?: string;
};

export type AdminAiStatus = {
  enabled: boolean;
  mode: "mock" | "api";
  provider: string | null;
  model?: string | null;
  responsesModel?: string | null;
  webSearchEnabled?: boolean;
  tasksTableReady: boolean;
  tasksCount: number;
  message: string;
};

export type AdminAiTool = "summary" | "polish" | "comment";
export type AdminAiReviewFocus = "knowledge" | "structure" | "suggestions" | "all";

export type AdminAiRunResult = {
  ok: boolean;
  tool: AdminAiTool;
  label?: string;
  result: string;
  notes?: string;
  sources?: Array<{ title: string; url: string }>;
  provider: string;
  model: string;
  enableWebSearch?: boolean;
  taskId?: number;
};

type BackendMedia = {
  id: DbId;
  file_name?: string;
  original_name?: string;
  mime_type?: string;
  url: string;
  width?: number;
  height?: number;
  alt_text?: string;
  created_at?: string;
};

type BackendCategory = {
  id: DbId;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  posts_count?: number | string;
  updated_at?: string;
};

type BackendTag = {
  id: DbId;
  name: string;
  slug: string;
  color?: string;
  posts_count?: number | string;
  updated_at?: string;
};

type BackendComment = {
  id: DbId;
  parent_id?: DbId | null;
  author_name: string;
  content: string;
  status: string;
  post_title?: string;
  likes_count?: number | string;
  created_at?: string;
};

type BackendMessage = {
  id: DbId;
  parent_id?: DbId | null;
  author_name: string;
  role: string;
  content: string;
  status: string;
  likes_count?: number | string;
  created_at?: string;
  replies?: BackendMessage[];
};

type BackendDashboard = {
  counts?: AdminDashboardData["counts"];
  hotPosts?: Array<{ id: DbId; title: string; views_count?: number | string; viewsCount?: number | string; likes_count?: number | string; likesCount?: number | string; comments_count?: number | string; commentsCount?: number | string }>;
  pendingComments?: BackendComment[];
  pendingMessages?: BackendMessage[];
  latestPosts?: Array<{ id: DbId; title: string; status: string; updated_at?: string; updatedAt?: string; published_at?: string; publishedAt?: string }>;
  dailyStats?: Array<{ date?: string; stat_date?: string; pv?: number | string; uv?: number | string; comments_count?: number | string; commentsCount?: number | string; messages_count?: number | string; messagesCount?: number | string; likes_count?: number | string; likesCount?: number | string }>;
  source?: "mock";
};

type BackendPublicStats = {
  postsCount?: number | string;
  categoriesCount?: number | string;
  tagsCount?: number | string;
  messagesCount?: number | string;
  viewsCount?: number | string;
  likesCount?: number | string;
  commentsCount?: number | string;
  posts_count?: number | string;
  categories_count?: number | string;
  tags_count?: number | string;
  messages_count?: number | string;
  views_count?: number | string;
  likes_count?: number | string;
  comments_count?: number | string;
  source?: "mock";
};

type BackendSubscription = {
  id: DbId;
  email: string;
  status: string;
  created_at?: string;
  createdAt?: string;
};

function formatReads(value = 0) {
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(".0", "")}k` : String(value);
}

function formatCount(value = 0) {
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(".0", "")}k` : String(value);
}

function inferImage(post: BackendPost): Article["image"] {
  const text = `${post.title} ${post.tags?.map((tag) => tag.name).join(" ") ?? ""}`.toLowerCase();
  if (text.includes("docker")) return "docker";
  if (text.includes("vue")) return "vue";
  if (text.includes("linux")) return "linux";
  if (text.includes("next")) return "next";
  return "code";
}

function mapBackendPost(post: BackendPost): Article {
  return {
    id: toNumberId(post.id),
    title: post.title,
    excerpt: post.excerpt ?? "",
    summary: post.summary ?? post.excerpt ?? "",
    date: post.publishedAt?.slice(0, 10) ?? "",
    category: post.category?.name ?? "未分类",
    tags: post.tags?.map((tag) => tag.name) ?? [],
    reads: formatReads(toNumber(post.viewsCount)),
    viewsCount: toNumber(post.viewsCount),
    likes: toNumber(post.likesCount),
    comments: toNumber(post.commentsCount),
    readingMinutes: toNumber(post.readingMinutes) || 1,
    image: inferImage(post),
    coverUrl: resolveBackendAssetUrl(post.coverUrl),
    allowComment: post.allowComment ?? true,
    featured: post.isFeatured ?? false,
    sections: post.sections?.length ? post.sections : [{ id: "content", title: "正文", level: 2, body: post.summary ?? post.excerpt ?? "" }],
    previousId: post.previousPost ? toNumberId(post.previousPost.id) : undefined,
    previousTitle: post.previousPost?.title,
    nextId: post.nextPost ? toNumberId(post.nextPost.id) : undefined,
    nextTitle: post.nextPost?.title,
  };
}

function mapAdminPost(post: BackendPost & { status?: AdminPostListItem["status"] }): AdminPostListItem {
  return {
    ...mapBackendPost(post),
    status: post.status,
  };
}

function mapEditorPost(post: BackendPost): EditorPostDetail {
  return {
    id: toNumberId(post.id),
    title: post.title,
    markdown: post.contentMarkdown ?? "",
    summary: post.summary ?? post.excerpt ?? "",
    coverUrl: resolveBackendAssetUrl(post.coverUrl),
    categoryName: post.category?.name,
    tags: post.tags?.map((item) => item.name) ?? [],
    status: post.status,
    visibility: post.visibility,
    scheduledAt: post.scheduledAt,
    isFeatured: post.isFeatured ?? true,
    allowComment: post.allowComment ?? true,
    requireCommentReview: post.requireCommentReview ?? true,
  };
}

function mapBackendMedia(item: BackendMedia): AdminMediaItem {
  return {
    id: toNumberId(item.id),
    fileName: item.file_name ?? item.original_name ?? `media-${item.id}`,
    originalName: item.original_name ?? item.file_name ?? `media-${item.id}`,
    mimeType: item.mime_type ?? "application/octet-stream",
    url: resolveBackendAssetUrl(item.url) ?? item.url,
    width: item.width,
    height: item.height,
    altText: item.alt_text,
    createdAt: item.created_at,
  };
}

function mapBackendCategory(item: BackendCategory): AdminCategoryItem {
  return {
    id: toNumberId(item.id),
    name: item.name,
    slug: item.slug,
    description: item.description,
    icon: item.icon,
    postsCount: toNumber(item.posts_count),
    updatedAt: item.updated_at,
  };
}

function mapBackendTag(item: BackendTag): AdminTagItem {
  return {
    id: toNumberId(item.id),
    name: item.name,
    slug: item.slug,
    color: item.color,
    postsCount: toNumber(item.posts_count),
    updatedAt: item.updated_at,
  };
}

function mapBackendComment(item: BackendComment): AdminCommentItem {
  return {
    id: toNumberId(item.id),
    authorName: item.author_name,
    content: item.content,
    status: item.status,
    postTitle: item.post_title,
    likesCount: toNumber(item.likes_count),
    createdAt: item.created_at,
  };
}

function mapPublicComment(item: BackendComment): PublicCommentItem {
  return {
    id: toNumberId(item.id),
    parentId: item.parent_id == null ? null : toNumberId(item.parent_id),
    authorName: item.author_name,
    content: item.content,
    status: item.status,
    likesCount: toNumber(item.likes_count),
    createdAt: item.created_at,
  };
}

function mapBackendMessage(item: BackendMessage): AdminMessageItem {
  return {
    id: toNumberId(item.id),
    parentId: item.parent_id == null ? null : toNumberId(item.parent_id),
    authorName: item.author_name,
    role: item.role,
    content: item.content,
    status: item.status,
    likesCount: toNumber(item.likes_count),
    createdAt: item.created_at,
  };
}

function mapBackendSubscription(item: BackendSubscription): PublicSubscriptionItem {
  return {
    id: toNumberId(item.id),
    email: item.email,
    status: item.status,
    createdAt: item.createdAt ?? item.created_at,
  };
}

function mapPublicMessage(item: BackendMessage): Message {
  return {
    id: toNumberId(item.id),
    parentId: item.parent_id == null ? null : toNumberId(item.parent_id),
    author: item.author_name,
    role: item.role === "owner" ? "站长" : "访客",
    avatar: "green",
    time: item.created_at?.slice(0, 10) ?? "刚刚",
    content: item.content,
    likes: toNumber(item.likes_count),
    approved: item.status === "approved",
    replies: item.replies?.map(mapPublicMessage) ?? [],
  };
}

function mapDashboard(data: BackendDashboard): AdminDashboardData {
  return {
    counts: {
      posts: data.counts?.posts ?? 0,
      published: data.counts?.published ?? 0,
      draft: data.counts?.draft ?? 0,
      scheduled: data.counts?.scheduled ?? 0,
      archived: data.counts?.archived ?? 0,
      pendingComments: data.counts?.pendingComments ?? 0,
      pendingMessages: data.counts?.pendingMessages ?? 0,
      media: data.counts?.media ?? 0,
      categories: data.counts?.categories ?? 0,
      tags: data.counts?.tags ?? 0,
      views: data.counts?.views ?? 0,
      likes: data.counts?.likes ?? 0,
      comments: data.counts?.comments ?? 0,
    },
    hotPosts: (data.hotPosts ?? []).map((item) => ({
      id: toNumberId(item.id),
      title: item.title,
      viewsCount: toNumber(item.viewsCount ?? item.views_count),
      likesCount: toNumber(item.likesCount ?? item.likes_count),
      commentsCount: toNumber(item.commentsCount ?? item.comments_count),
    })),
    pendingComments: (data.pendingComments ?? []).map((item) => ({
      id: toNumberId(item.id),
      authorName: item.author_name,
      content: item.content,
      status: item.status,
      postTitle: item.post_title,
      createdAt: item.created_at,
    })),
    pendingMessages: (data.pendingMessages ?? []).map((item) => ({
      id: toNumberId(item.id),
      authorName: item.author_name,
      content: item.content,
      status: item.status,
      createdAt: item.created_at,
    })),
    latestPosts: (data.latestPosts ?? []).map((item) => ({
      id: toNumberId(item.id),
      title: item.title,
      status: item.status,
      updatedAt: item.updatedAt ?? item.updated_at,
      publishedAt: item.publishedAt ?? item.published_at,
    })),
    dailyStats: (data.dailyStats ?? []).map((item) => ({
      date: item.date ?? item.stat_date ?? "",
      pv: toNumber(item.pv),
      uv: toNumber(item.uv),
      commentsCount: toNumber(item.commentsCount ?? item.comments_count),
      messagesCount: toNumber(item.messagesCount ?? item.messages_count),
      likesCount: toNumber(item.likesCount ?? item.likes_count),
    })).filter((item) => item.date),
    source: "api",
  };
}

const defaultAboutPageSettings: AboutPageSettings = {
  title: "关于我",
  badge: "技术博主 / 开发者",
  subtitle: "热爱编程 · 热爱分享 · 持续学习 · 长期主义",
  introTitle: "个人简介",
  intro: "大家好，我是一名全栈开发者，喜欢用代码解决问题，也热衷于分享技术经验与思考。本站是我独立搭建并持续运营的个人博客，记录学习、工作与生活中的点滴。希望通过持续输出，与更多志同道合的朋友一起成长。",
  location: "中国 · 杭州",
  email: "hello@example.com",
  phone: "17354410494",
  website: "https://example.com",
  githubUrl: "https://github.com",
  wechatQrUrl: "",
  portraitUrl: "/assets/about-portrait.png",
  safeDays: "567",
  safeSince: "自 2023-11-01 起",
  skills: ["TypeScript", "React", "Next.js", "Node.js", "NestJS", "MySQL", "Docker", "Git", "…"],
  projects: [
    { title: "BlogCore 全栈博客系统", description: "基于 Node.js + React 的全栈博客系统，支持 Markdown、文章管理、评论、留言、统计与主题自定义。", imageUrl: "/assets/about-project-blogcore.png", projectUrl: "", demoUrl: "", tags: ["Node.js", "React", "MySQL", "TypeScript"], badge: "开源项目" },
    { title: "PlanDo 任务管理应用", description: "一个简洁高效的任务管理工具，支持看板、日历、协作与数据统计，帮助团队提升效率。", imageUrl: "/assets/about-project-plando.png", projectUrl: "", demoUrl: "", tags: ["React", "TypeScript", "Tailwind CSS"], badge: "个人项目" },
    { title: "DevNote 开发者笔记", description: "专为开发者设计的笔记工具，支持代码片段、Markdown、标签分类与全文搜索。", imageUrl: "/assets/about-project-devnote.png", projectUrl: "", demoUrl: "", tags: ["Vue 3", "Vite", "IndexedDB"], badge: "个人项目" },
  ],
  socials: [
    { label: "GitHub", url: "https://github.com" },
    { label: "掘金", url: "https://juejin.cn" },
    { label: "知乎", url: "https://www.zhihu.com" },
    { label: "Bilibili", url: "https://www.bilibili.com" },
    { label: "微信公众号", url: "" },
  ],
  writingTopics: ["后端开发", "前端开发", "全栈实践", "项目复盘", "算法与数据结构", "工具推荐", "成长思考", "面试总结"].map((label) => ({ label, url: `/posts?tag=${encodeURIComponent(label)}` })),
  timeline: [
    { year: "2021", title: "计算机科学与技术 本科毕业", description: "在校期间热爱编程，参与多个项目开发。" },
    { year: "2022", title: "全栈开发工程师", description: "参与企业级系统开发，积累全栈开发经验。" },
    { year: "2023", title: "开始技术写作", description: "搭建个人博客，持续输出技术文章与教程。" },
    { year: "2024", title: "独立开发 & 开源贡献", description: "发布开源项目，专注于自研与系统优化。" },
  ],
  cooperateTitle: "欢迎交流与合作",
  cooperateText: "如果你有任何问题、建议，或者想一起交流技术，欢迎在留言板给我留言～",
  cooperateButtonText: "去留言",
  cooperateUrl: "/messages",
};

const defaultHomePageSettings: HomePageSettings = {
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

function normalizeHomePageSettings(input?: Partial<HomePageSettings>): HomePageSettings {
  const source = input ?? {};
  const color = (value: unknown, fallback: string) => /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? String(value) : fallback;
  const normalizeIcon = (value: unknown, fallback: HomeEntryCardSetting["icon"]): HomeEntryCardSetting["icon"] => value === "cube" || value === "user" || value === "doc" ? value : fallback;
  const entryCards = Array.isArray(source.entryCards) ? source.entryCards : defaultHomePageSettings.entryCards;
  const clampPercent = (value: unknown, fallback = 50) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(100, Math.round(number)));
  };
  const clampZoom = (value: unknown, fallback = 100) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(100, Math.min(180, Math.round(number)));
  };
  const clampOverlay = (value: unknown, fallback = 0) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(70, Math.round(number)));
  };
  return {
    ...defaultHomePageSettings,
    ...source,
    title: source.title ?? defaultHomePageSettings.title,
    subtitle: source.subtitle ?? defaultHomePageSettings.subtitle,
    description: source.description ?? defaultHomePageSettings.description,
    primaryButtonText: source.primaryButtonText ?? defaultHomePageSettings.primaryButtonText,
    primaryButtonUrl: source.primaryButtonUrl ?? defaultHomePageSettings.primaryButtonUrl,
    secondaryButtonText: source.secondaryButtonText ?? defaultHomePageSettings.secondaryButtonText,
    secondaryButtonUrl: source.secondaryButtonUrl ?? defaultHomePageSettings.secondaryButtonUrl,
    primaryButtonColor: color(source.primaryButtonColor, defaultHomePageSettings.primaryButtonColor),
    secondaryButtonColor: color(source.secondaryButtonColor, defaultHomePageSettings.secondaryButtonColor),
    titleColor: color(source.titleColor, defaultHomePageSettings.titleColor),
    subtitleColor: color(source.subtitleColor, defaultHomePageSettings.subtitleColor),
    descriptionColor: color(source.descriptionColor, defaultHomePageSettings.descriptionColor),
    coverType: source.coverType === "video" ? "video" : "image",
    coverUrl: source.coverUrl ?? defaultHomePageSettings.coverUrl,
    coverVideoUrl: source.coverVideoUrl ?? defaultHomePageSettings.coverVideoUrl,
    coverPositionX: clampPercent(source.coverPositionX, defaultHomePageSettings.coverPositionX),
    coverPositionY: clampPercent(source.coverPositionY, defaultHomePageSettings.coverPositionY),
    coverZoom: clampZoom(source.coverZoom, defaultHomePageSettings.coverZoom),
    coverOverlayOpacity: clampOverlay(source.coverOverlayOpacity, defaultHomePageSettings.coverOverlayOpacity),
    entryCards: entryCards.map((item, index) => ({
      title: item?.title ?? defaultHomePageSettings.entryCards[index]?.title ?? "入口",
      description: item?.description ?? defaultHomePageSettings.entryCards[index]?.description ?? "",
      actionText: item?.actionText ?? defaultHomePageSettings.entryCards[index]?.actionText ?? "查看",
      icon: normalizeIcon(item?.icon, defaultHomePageSettings.entryCards[index]?.icon ?? "doc"),
      href: item?.href ?? defaultHomePageSettings.entryCards[index]?.href ?? "/",
      visible: item?.visible !== false,
    })).filter((item) => item.title || item.description || item.actionText),
  };
}

function normalizeAboutPageSettings(input?: Partial<AboutPageSettings>): AboutPageSettings {
  const source = input ?? {};
  const legacyGithubUrl = Array.isArray(source.socials) ? source.socials.find((item) => item.label?.toLowerCase() === "github")?.url : "";
  return {
    ...defaultAboutPageSettings,
    ...source,
    phone: source.phone ?? defaultAboutPageSettings.phone,
    githubUrl: source.githubUrl ?? legacyGithubUrl ?? defaultAboutPageSettings.githubUrl,
    wechatQrUrl: source.wechatQrUrl ?? defaultAboutPageSettings.wechatQrUrl,
    skills: Array.isArray(source.skills) ? source.skills : defaultAboutPageSettings.skills,
    projects: Array.isArray(source.projects) ? source.projects.map((item) => ({ ...item, projectUrl: item.projectUrl ?? "", demoUrl: item.demoUrl ?? "", tags: Array.isArray(item.tags) ? item.tags : [] })) : defaultAboutPageSettings.projects,
    socials: Array.isArray(source.socials) ? source.socials : defaultAboutPageSettings.socials,
    writingTopics: Array.isArray(source.writingTopics) ? source.writingTopics.map((item) => typeof item === "string" ? { label: item, url: `/posts?tag=${encodeURIComponent(item)}` } : { label: item.label, url: item.url ?? "" }).filter((item) => item.label) : defaultAboutPageSettings.writingTopics,
    timeline: Array.isArray(source.timeline) ? source.timeline : defaultAboutPageSettings.timeline,
  };
}

export const api = {
  getPublicPosts: async (options: { pageSize?: number; sort?: "latest" | "hot"; category?: string; tag?: string; keyword?: string; year?: string } = {}) => {
    const fallback = { articles };
    const params = new URLSearchParams();
    if (options.pageSize) params.set("pageSize", String(options.pageSize));
    if (options.sort) params.set("sort", options.sort);
    if (options.category) params.set("category", options.category);
    if (options.tag) params.set("tag", options.tag);
    if (options.keyword) params.set("q", options.keyword);
    if (options.year) params.set("year", options.year);
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await requestJson<{ items?: BackendPost[]; source?: "mock" }>(`/public/posts${query}`, { items: [], source: "mock" });
    if (data.source === "mock" || !Array.isArray(data.items)) return wait({ ...fallback, source: "mock" as const });
    return { articles: data.items.map(mapBackendPost), source: "api" as const };
  },
  getPublicCategories: async () => {
    const fallback = { items: categories.map(([name, count], index) => ({ id: index + 1, name, slug: String(name), postsCount: count })), source: "mock" as const };
    const data = await requestJson<{ items?: BackendCategory[]; source?: "mock" }>("/public/categories", { items: [], source: "mock" });
    if (data.source === "mock" || !Array.isArray(data.items)) return wait(fallback);
    return { items: data.items.map(mapBackendCategory).filter((item) => item.postsCount > 0), source: "api" as const };
  },
  getPublicTags: async () => {
    const fallback = { items: tags.map((name, index) => ({ id: index + 1, name, slug: name, postsCount: 0 })), source: "mock" as const };
    const data = await requestJson<{ items?: BackendTag[]; source?: "mock" }>("/public/tags", { items: [], source: "mock" });
    if (data.source === "mock" || !Array.isArray(data.items)) return wait(fallback);
    return { items: data.items.map(mapBackendTag).filter((item) => item.postsCount > 0), source: "api" as const };
  },
  getPublicStats: async (): Promise<PublicSiteStats> => {
    const fallback = {
      posts: articles.length,
      categories: categories.length,
      tags: tags.length,
      messages: messages.length,
      views: 0,
      likes: articles.reduce((sum, item) => sum + item.likes, 0),
      comments: articles.reduce((sum, item) => sum + item.comments, 0),
      source: "mock" as const,
    };
    const data = await requestJson<BackendPublicStats>("/public/stats", { source: "mock" });
    if (data.source === "mock") return wait(fallback);
    return {
      posts: toNumber(data.postsCount ?? data.posts_count),
      categories: toNumber(data.categoriesCount ?? data.categories_count),
      tags: toNumber(data.tagsCount ?? data.tags_count),
      messages: toNumber(data.messagesCount ?? data.messages_count),
      views: toNumber(data.viewsCount ?? data.views_count),
      likes: toNumber(data.likesCount ?? data.likes_count),
      comments: toNumber(data.commentsCount ?? data.comments_count),
      source: "api",
    };
  },
  getPublicHome: async () => {
    const data = await requestJson<{ item?: Partial<HomePageSettings>; source?: "mock" }>("/public/home", { item: defaultHomePageSettings, source: "mock" });
    return { item: normalizeHomePageSettings(data.item), source: data.source === "mock" ? "mock" as const : "api" as const };
  },
  getPublicAbout: async () => {
    const data = await requestJson<{ item?: Partial<AboutPageSettings>; source?: "mock" }>("/public/about", { item: defaultAboutPageSettings, source: "mock" });
    return { item: normalizeAboutPageSettings(data.item), source: data.source === "mock" ? "mock" as const : "api" as const };
  },
  getArticle: async (id: number) => {
    const fallbackArticle = articles.find((item) => item.id === id) ?? null;
    try {
      const data = await requestStrictJson<BackendPost>(`/public/posts/${id}`, {
        headers: { "x-visitor-id": getVisitorId() },
      });
      return { article: mapBackendPost(data), source: "api" as const, notFound: false, message: "" };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return { article: null, source: "api" as const, notFound: true, message: "文章不存在或尚未发布" };
      }
      return wait({ article: fallbackArticle, source: "mock" as const, notFound: !fallbackArticle, message: getApiErrorMessage(error) });
    }
  },
  getComments: async (postId: number) => {
    const data = await requestJson<{ items?: BackendComment[]; source?: "mock" }>(`/public/posts/${postId}/comments`, { items: [], source: "mock" });
    if (data.source === "mock" || !Array.isArray(data.items)) return { items: [], source: "mock" as const };
    return { items: data.items.map(mapPublicComment), source: "api" as const };
  },
  likePost: async (postId: number) => {
    const visitorId = getVisitorId();
    const data = await requestStrictJson<{ liked?: boolean; alreadyLiked?: boolean; likesCount?: number | string }>(`/public/posts/${postId}/like`, {
      method: "POST",
      body: JSON.stringify({ visitorId }),
    });
    return {
      liked: Boolean(data.liked),
      alreadyLiked: Boolean(data.alreadyLiked),
      likesCount: toNumber(data.likesCount),
      source: "api" as const,
    };
  },
  likeMessage: async (messageId: number) => {
    const visitorId = getVisitorId();
    const data = await requestStrictJson<{ liked?: boolean; alreadyLiked?: boolean; likesCount?: number | string }>(`/public/messages/${messageId}/like`, {
      method: "POST",
      body: JSON.stringify({ visitorId }),
    });
    return {
      liked: Boolean(data.liked),
      alreadyLiked: Boolean(data.alreadyLiked),
      likesCount: toNumber(data.likesCount),
      source: "api" as const,
    };
  },
  getAdminPosts: async (status?: AdminPostListItem["status"]) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await requestStrictJson<{ items?: Array<BackendPost & { status?: AdminPostListItem["status"] }> }>(`/admin/posts${query}`);
    if (!Array.isArray(data.items)) throw new ApiError("后端没有返回文章列表");
    return { items: data.items.map(mapAdminPost), source: "api" as const };
  },
  getEditorPost: async (id: number) => {
    const data = await requestStrictJson<BackendPost>(`/admin/posts/${id}`);
    currentDraftId = toNumberId(data.id);
    return { item: mapEditorPost(data), source: "api" as const };
  },
  startNewPost: () => {
    currentDraftId = undefined;
  },
  updatePostStatus: async (id: number, status: "draft" | "published" | "scheduled" | "archived") => {
    const data = await requestStrictJson<{ ok?: boolean; id?: DbId; status?: "draft" | "published" | "scheduled" | "archived"; item?: BackendPost }>(`/admin/posts/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
    const item = data.item ? mapAdminPost(data.item) : undefined;
    return { ok: data.ok ?? true, id: toNumberId(data.item?.id ?? data.id ?? id), status: item?.status ?? data.status ?? status, item, source: "api" as const };
  },
  updatePostFeatured: async (id: number, isFeatured: boolean) => {
    const data = await requestStrictJson<{ ok?: boolean; id?: DbId; isFeatured?: boolean; item?: BackendPost }>(`/admin/posts/${id}/featured`, { method: "PUT", body: JSON.stringify({ isFeatured }) });
    const item = data.item ? mapAdminPost(data.item) : undefined;
    return { ok: data.ok ?? true, id: toNumberId(data.item?.id ?? data.id ?? id), isFeatured: item?.featured ?? data.isFeatured ?? isFeatured, item, source: "api" as const };
  },
  deletePost: async (id: number) => {
    const data = await requestStrictJson<{ ok?: boolean; id?: DbId; deleted?: boolean; status?: "archived" }>(`/admin/posts/${id}`, { method: "DELETE" });
    return { ok: data.ok ?? true, id: toNumberId(data.id ?? id), deleted: data.deleted ?? false, status: data.status ?? "archived", source: "api" as const };
  },
  getAdminMedia: async () => {
    const data = await requestStrictJson<{ items?: BackendMedia[] }>("/admin/media");
    if (!Array.isArray(data.items)) throw new ApiError("后端没有返回媒体列表");
    return { items: data.items.map(mapBackendMedia), source: "api" as const };
  },
  uploadMedia: async (file: File, altText?: string) => {
    const formData = new FormData();
    formData.set("file", file);
    if (altText) formData.set("altText", altText);
    const data = await requestStrictJson<{ item?: BackendMedia }>("/admin/media", { method: "POST", body: formData });
    if (!data.item) throw new ApiError("后端没有返回已上传的媒体文件");
    return { item: mapBackendMedia(data.item), source: "api" as const };
  },
  updateMedia: async (id: number, altText: string) => {
    const data = await requestStrictJson<{ ok?: boolean; item?: BackendMedia }>(`/admin/media/${id}`, {
      method: "PUT",
      body: JSON.stringify({ altText }),
    });
    if (!data.item) throw new ApiError("后端没有返回已更新的媒体文件");
    return { ok: data.ok ?? true, item: mapBackendMedia(data.item), source: "api" as const };
  },
  deleteMedia: async (id: number) => {
    const data = await requestStrictJson<{ ok?: boolean; id?: DbId; deleted?: boolean }>(`/admin/media/${id}`, { method: "DELETE" });
    return { ok: data.ok ?? true, id: toNumberId(data.id ?? id), deleted: data.deleted ?? true, source: "api" as const };
  },
  getAdminCategories: async () => {
    const data = await requestStrictJson<{ items?: BackendCategory[] }>("/admin/categories");
    if (!Array.isArray(data.items)) throw new ApiError("后端没有返回分类列表");
    return { items: data.items.map(mapBackendCategory), source: "api" as const };
  },
  createCategory: async (payload: { name: string; slug?: string; description?: string; icon?: string }) => {
    const data = await requestStrictJson<{ ok?: boolean; item?: BackendCategory }>("/admin/categories", { method: "POST", body: JSON.stringify(payload) });
    if (!data.item) throw new ApiError("后端没有返回已创建的分类");
    return { ok: data.ok ?? true, item: mapBackendCategory(data.item), source: "api" as const };
  },
  updateCategory: async (id: number, payload: { name: string; slug?: string; description?: string; icon?: string }) => {
    const data = await requestStrictJson<{ ok?: boolean; item?: BackendCategory }>(`/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    if (!data.item) throw new ApiError("后端没有返回已更新的分类");
    return { ok: data.ok ?? true, item: mapBackendCategory(data.item), source: "api" as const };
  },
  deleteCategory: async (id: number) => {
    const data = await requestStrictJson<{ ok?: boolean; id?: DbId; deleted?: boolean }>(`/admin/categories/${id}`, { method: "DELETE" });
    return { ok: data.ok ?? true, id: toNumberId(data.id ?? id), deleted: data.deleted ?? true, source: "api" as const };
  },
  getAdminTags: async () => {
    const data = await requestStrictJson<{ items?: BackendTag[] }>("/admin/tags");
    if (!Array.isArray(data.items)) throw new ApiError("后端没有返回标签列表");
    return { items: data.items.map(mapBackendTag), source: "api" as const };
  },
  createTag: async (payload: { name: string; slug?: string; color?: string }) => {
    const data = await requestStrictJson<{ ok?: boolean; item?: BackendTag }>("/admin/tags", { method: "POST", body: JSON.stringify(payload) });
    if (!data.item) throw new ApiError("后端没有返回已创建的标签");
    return { ok: data.ok ?? true, item: mapBackendTag(data.item), source: "api" as const };
  },
  updateTag: async (id: number, payload: { name: string; slug?: string; color?: string }) => {
    const data = await requestStrictJson<{ ok?: boolean; item?: BackendTag }>(`/admin/tags/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    if (!data.item) throw new ApiError("后端没有返回已更新的标签");
    return { ok: data.ok ?? true, item: mapBackendTag(data.item), source: "api" as const };
  },
  deleteTag: async (id: number) => {
    const data = await requestStrictJson<{ ok?: boolean; id?: DbId; deleted?: boolean }>(`/admin/tags/${id}`, { method: "DELETE" });
    return { ok: data.ok ?? true, id: toNumberId(data.id ?? id), deleted: data.deleted ?? true, source: "api" as const };
  },
  getAdminComments: async () => {
    const data = await requestStrictJson<{ items?: BackendComment[] }>("/admin/comments");
    if (!Array.isArray(data.items)) throw new ApiError("后端没有返回评论列表");
    return { items: data.items.map(mapBackendComment), source: "api" as const };
  },
  getAdminMessages: async () => {
    const data = await requestStrictJson<{ items?: BackendMessage[] }>("/admin/messages");
    if (!Array.isArray(data.items)) throw new ApiError("后端没有返回留言列表");
    return { items: data.items.map(mapBackendMessage), source: "api" as const };
  },
  getMessages: async () => {
    const fallback = { messages, source: "mock" as const };
    const data = await requestJson<{ items?: BackendMessage[]; source?: "mock" }>("/public/messages", { items: [], source: "mock" });
    if (data.source === "mock" || !Array.isArray(data.items)) return wait(fallback);
    return { messages: data.items.map(mapPublicMessage), source: "api" as const };
  },
  postMessage: async (payload: { author: string; email: string; site?: string; content: string; parentId?: number }) => {
    const createdMessage = await requestStrictJson<{ item?: BackendMessage }>("/public/messages", { method: "POST", body: JSON.stringify(payload) });
    if (!createdMessage.item) throw new ApiError("后端没有返回已创建的留言");
    return { ...mapPublicMessage(createdMessage.item), approved: false, source: "api" as const };
  },
  subscribe: async (email: string) => {
    const data = await requestStrictJson<{ ok?: boolean; item?: BackendSubscription }>("/public/subscriptions", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (!data.item) throw new ApiError("后端没有返回订阅记录");
    return { ok: data.ok ?? true, item: mapBackendSubscription(data.item), source: "api" as const };
  },
  postComment: async (postId: number, payload: { authorName: string; authorEmail: string; authorSite?: string; content: string }) => {
    const createdComment = await requestStrictJson<{ item?: BackendComment }>(`/public/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!createdComment.item) throw new ApiError("后端没有返回已创建的评论");
    return { ...mapPublicComment(createdComment.item), ok: true, localPending: createdComment.item.status === "pending", source: "api" as const };
  },
  reviewComment: async (id: number, status: "approved" | "rejected") => {
    const reviewedComment = await requestStrictJson<{ ok?: boolean; item?: BackendComment }>(`/admin/comments/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
    const item = reviewedComment.item ? mapBackendComment(reviewedComment.item) : undefined;
    return {
      ok: reviewedComment.ok ?? true,
      id: item?.id ?? id,
      status: item?.status === "approved" || item?.status === "rejected" ? item.status : status,
      item,
      source: "api" as const,
    };
  },
  deleteComment: async (id: number) => {
    const data = await requestStrictJson<{ ok?: boolean; id?: DbId; deleted?: boolean }>(`/admin/comments/${id}`, { method: "DELETE" });
    return { ok: data.ok ?? true, id: toNumberId(data.id ?? id), deleted: data.deleted ?? true, source: "api" as const };
  },
  reviewMessage: async (id: number, status: "approved" | "rejected") => {
    const reviewedMessage = await requestStrictJson<{ ok?: boolean; item?: BackendMessage }>(`/admin/messages/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
    const item = reviewedMessage.item ? mapBackendMessage(reviewedMessage.item) : undefined;
    return {
      ok: reviewedMessage.ok ?? true,
      id: item?.id ?? id,
      status: item?.status === "approved" || item?.status === "rejected" ? item.status : status,
      item,
      source: "api" as const,
    };
  },
  deleteMessage: async (id: number) => {
    const data = await requestStrictJson<{ ok?: boolean; id?: DbId; deleted?: boolean }>(`/admin/messages/${id}`, { method: "DELETE" });
    return { ok: data.ok ?? true, id: toNumberId(data.id ?? id), deleted: data.deleted ?? true, source: "api" as const };
  },
  replyMessage: async (id: number, content: string) => {
    const createdReply = await requestStrictJson<{ ok?: boolean; item?: BackendMessage }>(`/admin/messages/${id}/replies`, { method: "POST", body: JSON.stringify({ content }) });
    if (!createdReply.item) throw new ApiError("后端没有返回已创建的站长回复");
    return { item: mapBackendMessage(createdReply.item), source: "api" as const };
  },
  login: async (account: string, password: string) => {
    const data = await requestStrictJson<{ token?: string; expiresAt?: string; user?: { username: string; role: string } }>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ account, password }),
    });
    if (!data.token) throw new ApiError("后端没有返回登录 token");
    window.localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    if (data.expiresAt) window.localStorage.setItem(`${ADMIN_TOKEN_KEY}-expires-at`, data.expiresAt);
    emitAuthChanged();
    return { ok: true, token: data.token, expiresAt: data.expiresAt, user: data.user };
  },
  logout: () => {
    const token = getAdminToken();
    if (token) {
      fetch(`${API_BASE}/admin/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    clearAdminSession();
  },
  isLoggedIn: () => {
    const token = getAdminToken();
    if (!token) return false;
    const expiresAt = window.localStorage.getItem(`${ADMIN_TOKEN_KEY}-expires-at`);
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      clearAdminSession();
      return false;
    }
    return true;
  },
  authChangedEvent: ADMIN_AUTH_CHANGED_EVENT,
  getAdminAboutSettings: async () => {
    const data = await requestStrictJson<{ item?: Partial<AboutPageSettings> }>("/admin/about-settings");
    return { item: normalizeAboutPageSettings(data.item), source: "api" as const };
  },
  updateAdminAboutSettings: async (item: AboutPageSettings) => {
    const data = await requestStrictJson<{ ok?: boolean; item?: Partial<AboutPageSettings> }>("/admin/about-settings", {
      method: "PUT",
      body: JSON.stringify({ item }),
    });
    return { ok: data.ok ?? true, item: normalizeAboutPageSettings(data.item), source: "api" as const };
  },
  getAdminHomeSettings: async () => {
    const data = await requestStrictJson<{ item?: Partial<HomePageSettings> }>("/admin/home-settings");
    return { item: normalizeHomePageSettings(data.item), source: "api" as const };
  },
  updateAdminHomeSettings: async (item: HomePageSettings) => {
    const data = await requestStrictJson<{ ok?: boolean; item?: Partial<HomePageSettings> }>("/admin/home-settings", {
      method: "PUT",
      body: JSON.stringify({ item }),
    });
    return { ok: data.ok ?? true, item: normalizeHomePageSettings(data.item), source: "api" as const };
  },
  getDashboard: async () => {
    const data = await requestStrictJson<BackendDashboard>("/admin/dashboard");
    return mapDashboard(data);
  },
  getAiStatus: async (): Promise<AdminAiStatus> => {
    const data = await requestStrictJson<AdminAiStatus>("/admin/ai/status");
    return {
      enabled: Boolean(data.enabled),
      mode: data.mode === "api" ? "api" : "mock",
      provider: data.provider ?? null,
      model: data.model ?? null,
      responsesModel: data.responsesModel ?? null,
      webSearchEnabled: Boolean(data.webSearchEnabled),
      tasksTableReady: Boolean(data.tasksTableReady),
      tasksCount: Number(data.tasksCount ?? 0),
      message: data.message ?? "AI 模型服务尚未接入；当前仅支持前端模拟预览。",
    };
  },
  runAiTool: async (payload: { tool: AdminAiTool; title?: string; summary?: string; content?: string; postId?: number; scope?: "document" | "selection"; userInstruction?: string; reviewFocus?: AdminAiReviewFocus; enableWebSearch?: boolean }): Promise<AdminAiRunResult> => {
    const data = await requestStrictJson<AdminAiRunResult>("/admin/ai/run", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 45000,
    });
    return {
      ok: data.ok ?? true,
      tool: data.tool,
      label: data.label,
      result: data.result ?? "",
      notes: data.notes ?? "",
      sources: data.sources ?? [],
      provider: data.provider ?? "qwen",
      model: data.model ?? "",
      enableWebSearch: Boolean(data.enableWebSearch),
      taskId: data.taskId,
    };
  },
  formatCount,
  saveDraft: async (title: string, content: string, summary?: string, meta?: EditorPostMeta) => {
    const payload = {
      title,
      contentMarkdown: content,
      summary,
      seoTitle: meta?.seoTitle,
      coverUrl: meta?.coverUrl,
      categoryName: meta?.categoryName ?? "技术笔记",
      tags: meta?.tags?.length ? meta.tags : ["博客系统", "自建项目", "AI"],
      status: meta?.status ?? "draft",
      visibility: meta?.visibility ?? "public",
      scheduledAt: meta?.scheduledAt,
      isFeatured: meta?.isFeatured ?? true,
      allowComment: meta?.allowComment ?? true,
      requireCommentReview: meta?.requireCommentReview ?? true,
    };
    const savedPost = currentDraftId
      ? await requestStrictJson<{ ok?: boolean; id: DbId; item?: BackendPost }>(`/admin/posts/${currentDraftId}`, { method: "PUT", body: JSON.stringify(payload) })
      : await requestStrictJson<{ ok?: boolean; id: DbId; item?: BackendPost }>("/admin/posts", { method: "POST", body: JSON.stringify(payload) });
    const savedId = toNumberId(savedPost.item?.id ?? savedPost.id);
    currentDraftId = savedId;
    const item = savedPost.item ? mapEditorPost(savedPost.item) : undefined;
    return { ...item, id: savedId, ok: savedPost.ok ?? true, title: item?.title ?? title, content, status: item?.status ?? meta?.status ?? "draft", savedAt: new Date().toLocaleTimeString("zh-CN", { hour12: false }), source: "api" as const };
  },
  publishPost: async (title: string, content: string, summary?: string, meta?: EditorPostMeta) => {
    const draft = await api.saveDraft(title, content, summary, { ...meta, status: "draft", scheduledAt: undefined });
    const publishedPost = await requestStrictJson<{ ok?: boolean; id?: DbId; status?: "published"; item?: BackendPost }>(`/admin/posts/${draft.id}/publish`, { method: "POST" });
    const item = publishedPost.item ? mapEditorPost(publishedPost.item) : undefined;
    return { ...item, ok: publishedPost.ok ?? true, id: toNumberId(publishedPost.item?.id ?? publishedPost.id ?? draft.id), status: item?.status ?? publishedPost.status ?? "published", source: "api" as const };
  },
};
