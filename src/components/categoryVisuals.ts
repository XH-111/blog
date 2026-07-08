import type { CSSProperties } from "react";
import type { AdminCategoryItem } from "../services/api";

export type CategoryVisual = AdminCategoryItem & {
  cover?: string;
  background?: string;
  themeColor?: string;
};

type VisualDefaults = Pick<CategoryVisual, "icon" | "cover" | "background" | "themeColor" | "description">;

export const defaultCategoryVisuals: Record<string, VisualDefaults> = {
  精选文章: {
    icon: "sparkles",
    cover: "/assets/home-hero-scene.png",
    background: "linear-gradient(135deg, rgba(0,229,255,.18), rgba(255,61,242,.12))",
    themeColor: "#72f7ff",
    description: "从全部技术笔记中挑选出的高价值文章，适合快速开始阅读。",
  },
  全部文章: {
    icon: "file",
    cover: "/assets/article-cover.png",
    background: "linear-gradient(135deg, rgba(0,229,255,.14), rgba(119,140,255,.1))",
    themeColor: "#00e5ff",
    description: "按发布时间浏览所有已公开文章，覆盖开发、部署、数据库与工具实践。",
  },
  搜索结果: {
    icon: "search",
    cover: "/assets/article-cover.png",
    background: "linear-gradient(135deg, rgba(157,104,255,.2), rgba(0,229,255,.1))",
    themeColor: "#9d68ff",
    description: "根据关键词筛选文章标题、摘要、正文、分类和标签。",
  },
  前端开发: {
    icon: "code",
    cover: "/assets/thumb-next.png",
    background: "linear-gradient(135deg, rgba(0,229,255,.18), rgba(72,94,255,.08))",
    themeColor: "#00e5ff",
    description: "聚焦 React、Vue、TypeScript 与现代前端工程实践。",
  },
  后端开发: {
    icon: "server",
    cover: "/assets/thumb-docker.png",
    background: "linear-gradient(135deg, rgba(0,229,255,.2), rgba(45,92,255,.1))",
    themeColor: "#00e5ff",
    description: "专注后端开发技术、架构设计、性能优化与最佳实践。",
  },
  运维部署: {
    icon: "cloud",
    cover: "/assets/thumb-linux.png",
    background: "linear-gradient(135deg, rgba(91,255,186,.18), rgba(0,229,255,.08))",
    themeColor: "#5dffba",
    description: "记录 Linux、Docker、CI/CD 与线上稳定性相关经验。",
  },
  数据库: {
    icon: "database",
    cover: "/assets/article-cover.png",
    background: "linear-gradient(135deg, rgba(157,104,255,.2), rgba(0,229,255,.08))",
    themeColor: "#9d68ff",
    description: "沉淀数据库建模、查询优化、索引设计与数据可靠性实践。",
  },
  工具教程: {
    icon: "tool",
    cover: "/assets/editor-cover.png",
    background: "linear-gradient(135deg, rgba(255,198,90,.18), rgba(0,229,255,.08))",
    themeColor: "#ffc65a",
    description: "分享高效开发工具、调试方法和工作流优化技巧。",
  },
  随笔杂谈: {
    icon: "chat",
    cover: "/assets/home-hero-scene.png",
    background: "linear-gradient(135deg, rgba(255,61,242,.18), rgba(0,229,255,.08))",
    themeColor: "#ff8df8",
    description: "记录技术之外的思考、复盘、成长和日常灵感。",
  },
};

export function getCategoryVisual(category: AdminCategoryItem): CategoryVisual {
  const defaults = defaultCategoryVisuals[category.name] ?? defaultCategoryVisuals[category.slug] ?? defaultCategoryVisuals.全部文章;
  return {
    ...category,
    icon: category.icon || defaults.icon,
    cover: category.cover || defaults.cover,
    background: category.background || defaults.background,
    themeColor: category.themeColor || defaults.themeColor,
    description: category.description || defaults.description,
  };
}

export function categoryVisualStyle(category: AdminCategoryItem): CSSProperties {
  const visual = getCategoryVisual(category);
  return {
    "--category-color": visual.themeColor || "#00e5ff",
    "--category-bg": visual.background || "linear-gradient(135deg, rgba(0,229,255,.14), rgba(157,104,255,.08))",
  } as CSSProperties;
}
