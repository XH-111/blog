import { closePool, transaction } from "../src/db.js";
import crypto from "node:crypto";

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

const categories = [
  ["前端开发", "frontend", 1],
  ["后端开发", "backend", 2],
  ["运维部署", "devops", 3],
  ["数据库", "database", 4],
  ["工具教程", "tools", 5],
  ["随笔杂谈", "notes", 6],
];

const tags = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Vue.js",
  "Node.js",
  "Docker",
  "Linux",
  "Git",
  "算法",
  "数据库",
  "性能优化",
  "设计模式",
  "测试",
  "面试",
  "AI",
  "DevOps",
];

const posts = [
  {
    title: "Next.js 14 + App Router 实战指南：从入门到精通",
    slug: "nextjs-14-app-router-guide",
    excerpt: "全面介绍 Next.js 14 的新特性与 App Router 的核心概念，通过实战项目带你掌握现代化 React 全栈开发。",
    summary: "本文围绕 App Router、Server Components、缓存策略和部署流程，梳理 Next.js 14 在真实项目中的落地方式。",
    category: "前端开发",
    tags: ["Next.js", "React", "TypeScript"],
    coverUrl: "/assets/thumb-next.png",
    readingMinutes: 12,
    viewsCount: 2400,
    likesCount: 128,
    commentsCount: 32,
    isFeatured: true,
    publishedAt: "2024-05-12T10:00:00+08:00",
    content: `# Next.js 14 + App Router 实战指南：从入门到精通

App Router 将路由、布局、数据加载和服务端渲染组织在统一约定中，让复杂页面的拆分和复用更加自然。

## 1. App Router 带来的变化
App Router 将页面结构和数据边界放到目录约定里，适合组织全栈 React 应用。

## 2. 路由与布局设计
通过 layout、template、loading 和 error 文件，可以为不同层级的页面提供独立状态。

## 2.1 Server Components
服务端组件适合读取数据库、拼装静态内容和减少客户端 bundle。

## 2.2 缓存与重新验证
合理使用 fetch cache、revalidate 和 route segment config，可以平衡实时性与性能。

## 3. 部署上线
上线前需要确认环境变量、构建产物、图片优化和日志监控。

## 4. 总结
Next.js 14 更适合以页面结构为中心组织全栈功能。`,
    sections: [
      ["intro", "1. App Router 带来的变化", 2, "App Router 将页面结构和数据边界放到目录约定里，适合组织全栈 React 应用。"],
      ["routing", "2. 路由与布局设计", 2, "通过 layout、template、loading 和 error 文件，可以为不同层级的页面提供独立状态。"],
      ["server-components", "2.1 Server Components", 3, "服务端组件适合读取数据库、拼装静态内容和减少客户端 bundle。"],
      ["cache", "2.2 缓存与重新验证", 3, "合理使用 fetch cache、revalidate 和 route segment config，可以平衡实时性与性能。"],
      ["deploy", "3. 部署上线", 2, "上线前需要确认环境变量、构建产物、图片优化和日志监控。"],
      ["summary", "4. 总结", 2, "Next.js 14 更适合以页面结构为中心组织全栈功能。"],
    ],
  },
  {
    title: "Docker 核心原理与最佳实践",
    slug: "docker-core-best-practices",
    excerpt: "深入理解 Docker 的核心原理，掌握容器化应用开发与部署的最佳实践方案。",
    summary: "本文从镜像、容器、网络、卷和 Compose 编排入手，说明如何把应用稳定地运行在容器环境中。",
    category: "后端开发",
    tags: ["Docker", "DevOps"],
    coverUrl: "/assets/thumb-docker.png",
    readingMinutes: 10,
    viewsCount: 1600,
    likesCount: 76,
    commentsCount: 18,
    isFeatured: false,
    publishedAt: "2024-05-11T10:00:00+08:00",
    content: `# Docker 核心原理与最佳实践

本文从镜像、容器、网络、卷和 Compose 编排入手，说明如何把应用稳定地运行在容器环境中。

## 1. 镜像是如何构建的
镜像由多层只读文件系统组成，Dockerfile 中每条指令都会形成可缓存的构建层。

## 2. 容器运行机制
容器并不是轻量虚拟机，而是利用 namespace、cgroups 和联合文件系统隔离进程。

## 2.1 网络与端口
开发环境可使用端口映射快速暴露服务，生产环境则要明确内部网络、反向代理和健康检查。

## 2.2 数据卷管理
持久数据不要写进容器层，应通过 volume 或外部存储保留，方便升级和迁移。

## 3. Compose 编排
Compose 适合描述本地或小规模服务拓扑，可以把应用、数据库、缓存和队列统一启动。

## 4. 总结
容器化的重点不是只会写 Dockerfile，而是让构建、配置、运行和排障流程都可重复。`,
    sections: [
      ["image", "1. 镜像是如何构建的", 2, "镜像由多层只读文件系统组成，Dockerfile 中每条指令都会形成可缓存的构建层。"],
      ["container", "2. 容器运行机制", 2, "容器并不是轻量虚拟机，而是利用 namespace、cgroups 和联合文件系统隔离进程。"],
      ["network", "2.1 网络与端口", 3, "开发环境可使用端口映射快速暴露服务，生产环境则要明确内部网络、反向代理和健康检查。"],
      ["volume", "2.2 数据卷管理", 3, "持久数据不要写进容器层，应通过 volume 或外部存储保留，方便升级和迁移。"],
      ["compose", "3. Compose 编排", 2, "Compose 适合描述本地或小规模服务拓扑，可以把应用、数据库、缓存和队列统一启动。"],
      ["summary", "4. 总结", 2, "容器化的重点不是只会写 Dockerfile，而是让构建、配置、运行和排障流程都可重复。"],
    ],
  },
  {
    title: "Vue 3 组合式 API 深入浅出",
    slug: "vue3-composition-api-guide",
    excerpt: "从基础到进阶，全面解析 Vue 3 组合式 API 的设计理念与实用技巧。",
    summary: "本文用组件状态、复用逻辑和工程组织三个角度说明 Composition API 的优势和边界。",
    category: "前端开发",
    tags: ["Vue.js", "TypeScript"],
    coverUrl: "/assets/thumb-vue.png",
    readingMinutes: 9,
    viewsCount: 1200,
    likesCount: 88,
    commentsCount: 24,
    isFeatured: false,
    publishedAt: "2024-05-09T10:00:00+08:00",
    content: `# Vue 3 组合式 API 深入浅出

组合式 API 提供了更强的逻辑组织能力，但仍要避免过度抽象和隐式依赖。

## 1. setup 的职责
setup 是组合状态、生命周期和业务逻辑的入口。

## 2. 响应式基础
ref 适合基础值，reactive 适合对象结构，computed 用于派生状态。

## 2.1 逻辑复用
将业务逻辑抽成 composable，可以让组件保持轻量。

## 2.2 类型约束
在大型项目中，组合式 API 与 TypeScript 的结合能提升可靠性。

## 3. 常见组织模式
建议按业务能力拆分 hooks，并保留明确输入输出。

## 4. 总结
组合式 API 的核心是让逻辑围绕功能聚合。`,
    sections: [
      ["setup", "1. setup 的职责", 2, "setup 是组合状态、生命周期和业务逻辑的入口。"],
      ["reactivity", "2. 响应式基础", 2, "ref 适合基础值，reactive 适合对象结构，computed 用于派生状态。"],
      ["composables", "2.1 逻辑复用", 3, "将业务逻辑抽成 composable，可以让组件保持轻量。"],
      ["typescript", "2.2 类型约束", 3, "在大型项目中，组合式 API 与 TypeScript 的结合能提升可靠性。"],
      ["patterns", "3. 常见组织模式", 2, "建议按业务能力拆分 hooks，并保留明确输入输出。"],
      ["summary", "4. 总结", 2, "组合式 API 的核心是让逻辑围绕功能聚合。"],
    ],
  },
  {
    title: "Linux 性能优化实战：定位与解决方案",
    slug: "linux-performance-optimization",
    excerpt: "系统性讲解 Linux 性能优化方法论，结合实际案例分析性能瓶颈定位与调优。",
    summary: "本文从 CPU、内存、磁盘 IO 和网络四个方向梳理 Linux 性能排查路径，帮助你建立稳定的诊断流程。",
    category: "运维部署",
    tags: ["Linux", "性能优化"],
    coverUrl: "/assets/thumb-linux.png",
    readingMinutes: 11,
    viewsCount: 1100,
    likesCount: 64,
    commentsCount: 15,
    isFeatured: false,
    publishedAt: "2024-05-07T10:00:00+08:00",
    content: `# Linux 性能优化实战：定位与解决方案

性能优化的核心是先定位、再验证、最后沉淀监控。

## 1. 先建立性能基线
优化前要明确正常状态下的 CPU、内存、磁盘和网络指标。

## 2. CPU 问题定位
通过 top、pidstat 和 perf 可以观察进程占用、上下文切换和热点函数。

## 2.1 内存与缓存
Linux 会充分利用空闲内存做 page cache，排查时要区分真实内存压力和正常缓存占用。

## 2.2 磁盘 IO
iostat、iotop 和慢日志可以帮助定位读写延迟、队列拥塞和异常写放大。

## 3. 网络链路检查
网络问题需要同时观察连接数、重传、延迟和应用层超时。

## 4. 总结
不要凭经验直接改参数，要把证据链闭环。`,
    sections: [
      ["baseline", "1. 先建立性能基线", 2, "优化前要明确正常状态下的 CPU、内存、磁盘和网络指标。"],
      ["cpu", "2. CPU 问题定位", 2, "通过 top、pidstat 和 perf 可以观察进程占用、上下文切换和热点函数。"],
      ["memory", "2.1 内存与缓存", 3, "Linux 会充分利用空闲内存做 page cache，排查时要区分真实内存压力和正常缓存占用。"],
      ["io", "2.2 磁盘 IO", 3, "iostat、iotop 和慢日志可以帮助定位读写延迟、队列拥塞和异常写放大。"],
      ["network", "3. 网络链路检查", 2, "网络问题需要同时观察连接数、重传、延迟和应用层超时。"],
      ["summary", "4. 总结", 2, "不要凭经验直接改参数，要把证据链闭环。"],
    ],
  },
];

async function upsertCategory(client, [name, slug, sortOrder]) {
  const result = await client.query(
    `INSERT INTO categories(name, slug, sort_order)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = now()
     RETURNING id`,
    [name, slug, sortOrder],
  );
  return result.rows[0].id;
}

async function upsertTag(client, name) {
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const result = await client.query(
    `INSERT INTO tags(name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id`,
    [name, slug],
  );
  return result.rows[0].id;
}

async function main() {
  await transaction(async (client) => {
    const categoryIds = new Map();
    for (const item of categories) categoryIds.set(item[0], await upsertCategory(client, item));

    const tagIds = new Map();
    for (const item of tags) tagIds.set(item, await upsertTag(client, item));

    const adminPasswordHash = await hashPassword(process.env.ADMIN_DEFAULT_PASSWORD ?? "password");
    await client.query(
      `INSERT INTO admin_users(username, email, password_hash, role)
       VALUES ('admin', 'admin@example.com', $1, 'owner')
       ON CONFLICT (username) DO UPDATE
       SET password_hash = CASE
         WHEN admin_users.password_hash = 'mock-password-hash' THEN EXCLUDED.password_hash
         ELSE admin_users.password_hash
       END,
       updated_at = now()`,
      [adminPasswordHash],
    );

    for (const post of posts) {
      const inserted = await client.query(
        `INSERT INTO posts(
          title, slug, excerpt, summary, content_markdown, cover_url, category_id, status,
          is_featured, reading_minutes, views_count, likes_count, comments_count, published_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'published',$8,$9,$10,$11,$12,$13)
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          excerpt = EXCLUDED.excerpt,
          summary = EXCLUDED.summary,
          content_markdown = EXCLUDED.content_markdown,
          cover_url = EXCLUDED.cover_url,
          category_id = EXCLUDED.category_id,
          is_featured = EXCLUDED.is_featured,
          reading_minutes = EXCLUDED.reading_minutes,
          views_count = EXCLUDED.views_count,
          likes_count = EXCLUDED.likes_count,
          comments_count = EXCLUDED.comments_count,
          published_at = EXCLUDED.published_at,
          updated_at = now()
        RETURNING id`,
        [
          post.title,
          post.slug,
          post.excerpt,
          post.summary,
          post.content,
          post.coverUrl,
          categoryIds.get(post.category),
          post.isFeatured,
          post.readingMinutes,
          post.viewsCount,
          post.likesCount,
          post.commentsCount,
          post.publishedAt,
        ],
      );
      const postId = inserted.rows[0].id;
      await client.query("DELETE FROM post_tags WHERE post_id = $1", [postId]);
      await client.query("DELETE FROM post_sections WHERE post_id = $1", [postId]);

      for (const tag of post.tags) {
        await client.query("INSERT INTO post_tags(post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [postId, tagIds.get(tag)]);
      }

      for (const [index, section] of post.sections.entries()) {
        await client.query(
          `INSERT INTO post_sections(post_id, anchor, title, level, body, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [postId, section[0], section[1], section[2], section[3], index + 1],
        );
      }
    }

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
      UPDATE tags t
      SET posts_count = sub.count
      FROM (
        SELECT tag_id, count(*)::integer AS count
        FROM post_tags
        GROUP BY tag_id
      ) sub
      WHERE t.id = sub.tag_id
    `);

    await client.query(
      `INSERT INTO site_settings(key, value_json)
       VALUES ('basic', '{"siteName":"全栈博客创作平台","subtitle":"记录 · 分享 · 成长"}'::jsonb)
       ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now()`,
    );
  });
}

main()
  .then(() => console.log("seed completed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePool);
