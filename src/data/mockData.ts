import type { Article, Message } from "../types";

export const categories = [
  ["前端开发", 32],
  ["后端开发", 28],
  ["运维部署", 16],
  ["数据库", 12],
  ["工具教程", 20],
  ["随笔杂谈", 18],
] as const;

export const tags = [
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
];

export const articles: Article[] = [
  {
    id: 1,
    title: "Next.js 14 + App Router 实战指南：从入门到精通",
    excerpt: "全面介绍 Next.js 14 的新特性与 App Router 的核心概念，通过实战项目带你掌握现代化 React 全栈开发。",
    summary: "本文围绕 App Router、Server Components、缓存策略和部署流程，梳理 Next.js 14 在真实项目中的落地方式。",
    date: "2024-05-12",
    category: "前端开发",
    tags: ["Next.js", "React", "TypeScript"],
    reads: "2.4k",
    likes: 128,
    comments: 32,
    readingMinutes: 12,
    image: "next",
    featured: true,
    sections: [
      { id: "intro", title: "1. App Router 带来的变化", level: 2, body: "App Router 将路由、布局、数据加载和服务端渲染组织在统一的约定中，让复杂页面的拆分和复用更加自然。" },
      { id: "routing", title: "2. 路由与布局设计", level: 2, body: "通过 layout、template、loading 和 error 文件，可以为不同层级的页面提供独立状态和边界。", list: ["嵌套路由天然对应页面结构", "loading 文件提供渐进式体验", "error 边界让局部失败不影响整体"] },
      { id: "server-components", title: "2.1 Server Components", level: 3, body: "服务端组件适合读取数据库、拼装静态内容和减少客户端 bundle；交互型模块则继续放在 client component 中。" },
      { id: "cache", title: "2.2 缓存与重新验证", level: 3, body: "合理使用 fetch cache、revalidate 和 route segment config，可以平衡实时性与性能。" },
      { id: "deploy", title: "3. 部署上线", level: 2, body: "上线前需要确认环境变量、构建产物、图片优化和日志监控，避免开发环境假设进入生产。" },
      { id: "summary", title: "4. 总结", level: 2, body: "Next.js 14 更适合以页面结构为中心组织全栈功能，但需要对缓存和组件边界保持清晰判断。" },
    ],
    codeSample: `export default async function Page() {
  const posts = await getPosts()
  return <PostList items={posts} />
}`,
    nextId: 2,
  },
  {
    id: 2,
    title: "Docker 核心原理与最佳实践",
    excerpt: "深入理解 Docker 的核心原理，掌握容器化应用开发与部署的最佳实践方案。",
    summary: "本文从镜像、容器、网络、卷和 Compose 编排入手，说明如何把应用稳定地运行在容器环境中。",
    date: "2024-05-11",
    category: "后端开发",
    tags: ["Docker", "DevOps"],
    reads: "1.6k",
    likes: 76,
    comments: 18,
    readingMinutes: 10,
    image: "docker",
    sections: [
      { id: "image", title: "1. 镜像是如何构建的", level: 2, body: "镜像由多层只读文件系统组成，Dockerfile 中每条指令都会形成可缓存的构建层。" },
      { id: "container", title: "2. 容器运行机制", level: 2, body: "容器并不是轻量虚拟机，而是利用 namespace、cgroups 和联合文件系统隔离进程。" },
      { id: "network", title: "2.1 网络与端口", level: 3, body: "开发环境可使用端口映射快速暴露服务，生产环境则要明确内部网络、反向代理和健康检查。" },
      { id: "volume", title: "2.2 数据卷管理", level: 3, body: "持久数据不要写进容器层，应通过 volume 或外部存储保留，方便升级和迁移。" },
      { id: "compose", title: "3. Compose 编排", level: 2, body: "Compose 适合描述本地或小规模服务拓扑，可以把应用、数据库、缓存和队列统一启动。" },
      { id: "summary", title: "4. 总结", level: 2, body: "容器化的重点不是只会写 Dockerfile，而是让构建、配置、运行和排障流程都可重复。" },
    ],
    codeSample: `services:
  web:
    build: .
    ports:
      - "3000:3000"`,
    previousId: 1,
    nextId: 3,
  },
  {
    id: 3,
    title: "Vue 3 组合式 API 深入浅出",
    excerpt: "从基础到进阶，全面解析 Vue 3 组合式 API 的设计理念与实用技巧。",
    summary: "本文用组件状态、复用逻辑和工程组织三个角度说明 Composition API 的优势和边界。",
    date: "2024-05-09",
    category: "前端开发",
    tags: ["Vue.js", "TypeScript"],
    reads: "1.2k",
    likes: 88,
    comments: 24,
    readingMinutes: 9,
    image: "vue",
    sections: [
      { id: "setup", title: "1. setup 的职责", level: 2, body: "setup 是组合状态、生命周期和业务逻辑的入口，它让逻辑按功能聚合，而不是按选项分散。" },
      { id: "reactivity", title: "2. 响应式基础", level: 2, body: "ref 适合基础值，reactive 适合对象结构，computed 用于派生状态，watch 用于处理副作用。" },
      { id: "composables", title: "2.1 逻辑复用", level: 3, body: "将业务逻辑抽成 composable，可以让组件保持轻量，也方便测试和跨页面复用。" },
      { id: "typescript", title: "2.2 类型约束", level: 3, body: "在大型项目中，组合式 API 与 TypeScript 的结合能提升表单、接口和状态管理的可靠性。" },
      { id: "patterns", title: "3. 常见组织模式", level: 2, body: "建议按业务能力拆分 hooks，并为复杂状态保留明确的输入输出，不把所有逻辑塞进单个 setup。" },
      { id: "summary", title: "4. 总结", level: 2, body: "组合式 API 提供了更强的组织能力，但仍要避免过度抽象和难以追踪的隐式依赖。" },
    ],
    codeSample: `const count = ref(0)
const doubled = computed(() => count.value * 2)`,
    previousId: 2,
    nextId: 4,
  },
  {
    id: 4,
    title: "Linux 性能优化实战：定位与解决方案",
    excerpt: "系统性讲解 Linux 性能优化方法论，结合实际案例分析性能瓶颈定位与调优。",
    summary: "本文从 CPU、内存、磁盘 IO 和网络四个方向梳理 Linux 性能排查路径，帮助你建立稳定的诊断流程。",
    date: "2024-05-07",
    category: "运维部署",
    tags: ["Linux", "性能优化"],
    reads: "1.1k",
    likes: 64,
    comments: 15,
    readingMinutes: 11,
    image: "linux",
    sections: [
      { id: "baseline", title: "1. 先建立性能基线", level: 2, body: "优化前要明确正常状态下的 CPU、内存、磁盘和网络指标，否则很容易把偶发现象误判成瓶颈。" },
      { id: "cpu", title: "2. CPU 问题定位", level: 2, body: "通过 top、pidstat 和 perf 可以观察进程占用、上下文切换和热点函数。" },
      { id: "memory", title: "2.1 内存与缓存", level: 3, body: "Linux 会充分利用空闲内存做 page cache，排查时要区分真实内存压力和正常缓存占用。" },
      { id: "io", title: "2.2 磁盘 IO", level: 3, body: "iostat、iotop 和慢日志可以帮助定位读写延迟、队列拥塞和异常写放大。" },
      { id: "network", title: "3. 网络链路检查", level: 2, body: "网络问题需要同时观察连接数、重传、延迟和应用层超时，不能只看带宽是否打满。" },
      { id: "summary", title: "4. 总结", level: 2, body: "性能优化的核心是先定位、再验证、最后沉淀监控，而不是凭经验直接改参数。" },
    ],
    codeSample: `pidstat -u -r -d 1
sudo perf top
ss -antp`,
    previousId: 3,
  },
];

export const archiveGroups = [
  {
    year: "2024",
    count: 65,
    months: [
      { month: "5月", count: 8, items: ["使用 TypeScript 优化大型项目的实践", "Vue 3 组合式 API 设计思路与最佳实践", "项目复盘：从 0 到 1 搭建企业级权限系统"] },
      { month: "4月", count: 7, items: ["深入理解 JavaScript 事件循环机制", "Docker 容器化部署前端项目最佳实践"] },
      { month: "3月", count: 6, items: ["React 18 新特性深度解析", "MySQL 索引优化实战指南"] },
    ],
  },
  {
    year: "2023",
    count: 42,
    months: [{ month: "12月", count: 5, items: ["前端性能优化的 20 个实用技巧"] }],
  },
];

export const messages: Message[] = [
  {
    id: 1,
    author: "程序员小明",
    role: "访客",
    avatar: "blue",
    time: "2 小时前",
    content: "博主你好！请问文章《从零搭建个人博客系统》中用到的技术栈可以开源吗？我想学习一下 🙂",
    likes: 3,
    approved: true,
    replies: [
      {
        id: 11,
        author: "站长",
        role: "站长",
        avatar: "dark",
        time: "1 小时前",
        content: "你好，项目的核心代码已开源在 GitHub，地址放在文章末尾了哈，欢迎 Star ⭐",
        likes: 2,
        approved: true,
      },
      {
        id: 12,
        author: "程序员小明",
        role: "访客",
        avatar: "blue",
        time: "30 分钟前",
        content: "好的，感谢回复！已经给 star 了 🎉",
        likes: 1,
        approved: true,
      },
    ],
  },
  {
    id: 2,
    author: "前端小白",
    role: "访客",
    avatar: "pink",
    time: "昨天 20:15",
    content: "非常喜欢博主的内容，尤其是性能优化那篇，受益匪浅！期待更多干货～",
    likes: 5,
    approved: true,
  },
];

export const dashboardStats = [
  ["文章总数", "128", "较上周 ↑ 8", "doc"],
  ["访问量", "24,532", "PV 32,106  UV 18,542", "eye"],
  ["评论数", "362", "待审核 12", "chat"],
  ["留言数", "85", "待审核 7", "mail"],
  ["点赞数", "1,256", "较上周 ↑ 9.8%", "like"],
];
