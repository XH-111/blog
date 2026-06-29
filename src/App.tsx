import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { api, getApiErrorMessage, sanitizeAssetUrl, sanitizeMarkdownUrl, sanitizeNavigationUrl } from "./services/api";
import type { ClipboardEvent, PointerEvent, WheelEvent } from "react";
import type { AboutPageSettings, AdminAiReviewFocus, AdminAiSettings, AdminAiStatus, AdminAiTaskItem, AdminAiTool, AdminCategoryItem, AdminCommentItem, AdminDashboardData, AdminMediaItem, AdminMessageItem, AdminPostListItem, AdminPostVersionItem, AdminSearchItem, AdminTagItem, HomeEntryCardSetting, HomePageSettings, ImportPreview, PublicCommentItem, PublicSiteStats, SiteSettings } from "./services/api";
import type { Article, Message } from "./types";

const nav = [
  ["首页", "/"],
  ["文章", "/posts"],
  ["关于", "/about"],
  ["留言板", "/messages"],
] as const;

const defaultHomeSettings: HomePageSettings = {
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

const defaultSiteSettings: SiteSettings = {
  siteName: "全栈博客创作平台",
  siteSubtitle: "记录 · 分享 · 成长",
  logoUrl: "",
  faviconUrl: "",
  defaultSeoTitle: "全栈博客创作平台",
  defaultSeoDescription: "记录技术探索与项目经验，分享思考与实践。",
  defaultOgImageUrl: "",
  icpText: "",
  icpUrl: "",
  policeText: "",
  policeUrl: "",
  footerText: "© 2026 全栈博客创作平台",
};

const COMMENT_CONTENT_MAX_LENGTH = 1000;
const MESSAGE_CONTENT_MAX_LENGTH = 2000;
const ARCHIVE_PAGE_SIZE = 10;
const ADMIN_LIST_PAGE_SIZE = 10;
const ADMIN_MEDIA_PAGE_SIZE = 10;
const PUBLIC_COMMENT_PAGE_SIZE = 10;
const PUBLIC_MESSAGE_PAGE_SIZE = 10;
const QUICK_EMOJIS = ["😊", "👍", "👏", "❤️", "😂", "🙏"];

function useRoute() {
  const [path, setPath] = useState(location.hash.replace("#", "") || "/");
  useEffect(() => {
    const sync = () => setPath(location.hash.replace("#", "") || "/");
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);
  return path;
}

function go(path: string) {
  const nextHash = `#${path}`;
  if (location.hash === nextHash) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    location.hash = path;
  }
  scrollTo({ top: 0, behavior: "smooth" });
}

function replaceHash(path: string) {
  const nextHash = `#${path}`;
  if (location.hash !== nextHash) history.replaceState(null, "", nextHash);
}

function navigateConfiguredUrl(url = "/") {
  const target = sanitizeNavigationUrl(url);
  if (!target) return;
  if (/^https?:\/\//i.test(target)) {
    window.open(target, "_blank", "noopener,noreferrer");
    return;
  }
  if (target.startsWith("#")) {
    location.hash = target;
    return;
  }
  go(target);
}

function emitAdminDataChanged() {
  window.dispatchEvent(new Event("admin-data-changed"));
}

function routeQuery() {
  return new URLSearchParams(location.hash.split("?")[1] ?? "");
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampZoom(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.max(100, Math.min(180, Math.round(value)));
}

function validHexColor(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function homeCoverStyle(config: Pick<HomePageSettings, "coverUrl" | "coverPositionX" | "coverPositionY" | "coverZoom">) {
  const coverUrl = sanitizeAssetUrl(config.coverUrl);
  return coverUrl ? {
    backgroundImage: `url(${coverUrl})`,
    backgroundPosition: `${config.coverPositionX}% ${config.coverPositionY}%`,
    backgroundSize: config.coverZoom === 100 ? "cover" : `${config.coverZoom}% auto`,
  } : undefined;
}

function homeVideoStyle(config: Pick<HomePageSettings, "coverPositionX" | "coverPositionY" | "coverZoom">) {
  return {
    objectPosition: `${config.coverPositionX}% ${config.coverPositionY}%`,
    transform: `scale(${config.coverZoom / 100})`,
  };
}

function homeOverlayStyle(config: Pick<HomePageSettings, "coverOverlayOpacity">) {
  return { opacity: config.coverOverlayOpacity / 100 };
}

function contrastTextColor(hexColor: string) {
  const color = validHexColor(hexColor, "#ffffff").replace("#", "");
  const red = parseInt(color.slice(0, 2), 16);
  const green = parseInt(color.slice(2, 4), 16);
  const blue = parseInt(color.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 150 ? "#173047" : "#ffffff";
}

function Icon({ name }: { name: string }) {
  return <span className={`icon icon-${name}`} aria-hidden="true" />;
}

function useSiteSettings(applyDocumentMeta = false) {
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSiteSettings);
  useEffect(() => {
    let alive = true;
    function loadSiteSettings() {
      api.getPublicSiteSettings()
        .then((result) => {
          if (!alive) return;
          setSiteSettings(result.item);
          if (applyDocumentMeta) {
            document.title = result.item.defaultSeoTitle || result.item.siteName;
            const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
            if (description) description.content = result.item.defaultSeoDescription;
          }
          applySiteDocumentSettings(result.item);
        })
        .catch(() => {
          if (applyDocumentMeta) document.title = defaultSiteSettings.defaultSeoTitle;
        });
    }
    loadSiteSettings();
    window.addEventListener("admin-data-changed", loadSiteSettings);
    return () => {
      alive = false;
      window.removeEventListener("admin-data-changed", loadSiteSettings);
    };
  }, [applyDocumentMeta]);
  return siteSettings;
}

function setMetaDescription(content: string) {
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = content;
}

function setNamedMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!content) {
    meta?.remove();
    return;
  }
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function setPropertyMeta(property: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!content) {
    meta?.remove();
    return;
  }
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function applySiteDocumentSettings(settings: SiteSettings) {
  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const faviconUrl = sanitizeAssetUrl(settings.faviconUrl);
  const defaultOgImageUrl = sanitizeAssetUrl(settings.defaultOgImageUrl);
  if (faviconUrl) {
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.href = faviconUrl;
  } else {
    favicon?.remove();
  }
  setPropertyMeta("og:site_name", settings.siteName);
  setPropertyMeta("og:title", settings.defaultSeoTitle || settings.siteName);
  setPropertyMeta("og:description", settings.defaultSeoDescription);
  setPropertyMeta("og:image", defaultOgImageUrl);
  setNamedMeta("twitter:card", defaultOgImageUrl ? "summary_large_image" : "");
}

function Logo({ admin = false, settings = defaultSiteSettings }: { admin?: boolean; settings?: SiteSettings }) {
  const title = admin ? settings.siteName.replace(/创作平台$/, "").trim() || settings.siteName : settings.siteName;
  const subtitle = admin ? "创作平台" : settings.siteSubtitle;
  const logoUrl = sanitizeAssetUrl(settings.logoUrl);
  return (
    <button className="brand" onClick={() => go(admin ? "/admin" : "/")}>
      <span className={`brand-mark ${logoUrl ? "has-logo" : ""}`} style={logoUrl ? { backgroundImage: `url(${logoUrl})` } : undefined}>{logoUrl ? "" : admin ? "✒" : "</>"}</span>
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
    </button>
  );
}

function PublicHeader({ active }: { active: string }) {
  const [headerSearch, setHeaderSearch] = useState("");
  const siteSettings = useSiteSettings(false);
  const headerNav = nav;
  useEffect(() => {
    const pageTitle = active === "/"
      ? siteSettings.defaultSeoTitle || siteSettings.siteName
      : active === "/posts" ? `文章 - ${siteSettings.siteName}`
        : active === "/about" ? `关于 - ${siteSettings.siteName}`
          : active === "/messages" ? `留言板 - ${siteSettings.siteName}`
            : active.startsWith("/article") ? `文章详情 - ${siteSettings.siteName}`
              : siteSettings.defaultSeoTitle || siteSettings.siteName;
    document.title = pageTitle;
    setMetaDescription(siteSettings.defaultSeoDescription);
  }, [active, siteSettings]);
  function openPublicNav(href: string) {
    go(href);
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const keyword = headerSearch.trim();
    if (keyword) go(`/posts?q=${encodeURIComponent(keyword)}`);
  }
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("blog-theme", next);
  }
  function isPublicNavActive(href: string) {
    return active === href || (active.startsWith("/article") && href === "/posts");
  }
  return (
    <>
      <header className={`public-header ${active.startsWith("/article") ? "article-header" : ""} ${active === "/posts" ? "floating-header" : ""}`}>
        <Logo settings={siteSettings} />
        <nav className="desktop-nav" aria-label="主导航">
          {headerNav.map(([label, href]) => (
            <button key={href} className={isPublicNavActive(href) ? "active" : ""} onClick={() => openPublicNav(href)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="header-tools">
          <form className="search-mini" onSubmit={submitSearch}>
            <input value={headerSearch} onChange={(event) => setHeaderSearch(event.target.value)} placeholder="搜索文章..." />
            <button aria-label="搜索文章">⌕</button>
          </form>
          <button className="round" onClick={toggleTheme} aria-label="切换深色模式">◐</button>
          <button className="admin-entry-button" onClick={() => go("/admin/login")}>后台</button>
        </div>
      </header>
      <nav className="mobile-bottom-nav" aria-label="移动端主导航">
        {headerNav.map(([label, href]) => (
          <button key={href} className={isPublicNavActive(href) ? "active" : ""} onClick={() => openPublicNav(href)}>
            <span className={`mobile-nav-icon mobile-nav-${href === "/" ? "home" : href.slice(1)}`} aria-hidden="true" />
            <b>{label === "留言板" ? "留言" : label}</b>
          </button>
        ))}
      </nav>
    </>
  );
}

function PublicFooter() {
  const siteSettings = useSiteSettings(false);
  const icpUrl = sanitizeNavigationUrl(siteSettings.icpUrl);
  const policeUrl = sanitizeNavigationUrl(siteSettings.policeUrl);
  if (!siteSettings.footerText && !siteSettings.icpText && !siteSettings.policeText) return null;
  return (
    <footer className="public-footer">
      {siteSettings.footerText && <span>{siteSettings.footerText}</span>}
      {siteSettings.icpText && (icpUrl ? <a href={icpUrl} target="_blank" rel="noreferrer">{siteSettings.icpText}</a> : <span>{siteSettings.icpText}</span>)}
      {siteSettings.policeText && (policeUrl ? <a href={policeUrl} target="_blank" rel="noreferrer">{siteSettings.policeText}</a> : <span>{siteSettings.policeText}</span>)}
    </footer>
  );
}

function Tag({ children, tone = "cyan" }: { children: ReactNode; tone?: string }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

function Art({ type, wide = false, coverUrl }: { type: Article["image"]; wide?: boolean; coverUrl?: string }) {
  const safeCoverUrl = sanitizeAssetUrl(coverUrl);
  return (
    <div className={`art ${safeCoverUrl ? "custom-cover" : type} ${wide ? "wide" : ""}`} style={safeCoverUrl ? { backgroundImage: `url(${safeCoverUrl})` } : undefined}>
      <div className="art-grid" />
      <b>{type === "next" ? "Next.js 14" : type === "docker" ? "docker" : type === "vue" ? "Vue 3" : type === "linux" ? "Linux" : "Code"}</b>
      <span>{type === "next" ? "App Router 实战指南" : type === "linux" ? "性能优化" : type === "mountain" ? "" : "全栈实践"}</span>
    </div>
  );
}

function HomePage() {
  const [homeConfig, setHomeConfig] = useState<HomePageSettings>(defaultHomeSettings);
  const heroStyle = homeCoverStyle(homeConfig);
  const homeCoverUrl = sanitizeAssetUrl(homeConfig.coverUrl);
  const homeVideoUrl = sanitizeAssetUrl(homeConfig.coverVideoUrl);
  const isVideoCover = homeConfig.coverType === "video" && Boolean(homeVideoUrl);
  const visibleEntryCards = homeConfig.entryCards.filter((item) => item.visible);
  const renderedEntryCards = visibleEntryCards.length ? visibleEntryCards : defaultHomeSettings.entryCards.filter((item) => item.visible);

  useEffect(() => {
    let alive = true;
    api.getPublicHome()
      .then((result) => {
        if (alive) setHomeConfig(result.item);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <PublicHeader active="/" />
      <main className="home-landing">
        <section className="home-hero-shell">
          <div className={`home-hero-blank ${homeCoverUrl && !isVideoCover ? "has-image" : ""} ${isVideoCover ? "has-video" : ""}`} style={isVideoCover ? undefined : heroStyle} aria-hidden="true">
            {isVideoCover && <video className="home-hero-video" src={homeVideoUrl} style={homeVideoStyle(homeConfig)} autoPlay muted loop playsInline />}
            <div className="home-hero-orbit one" />
            <div className="home-hero-orbit two" />
            <div className="home-hero-horizon" />
          </div>
          {(homeCoverUrl || isVideoCover) && <div className="home-hero-overlay" style={homeOverlayStyle(homeConfig)} aria-hidden="true" />}
          <div className="home-hero-content">
            {homeConfig.title && <h1 style={{ color: homeConfig.titleColor }}>{homeConfig.title}</h1>}
            {homeConfig.subtitle && <p className="home-hero-subtitle" style={{ color: homeConfig.subtitleColor }}>{homeConfig.subtitle}</p>}
            {homeConfig.description && <p className="home-hero-copy" style={{ color: homeConfig.descriptionColor }}>{homeConfig.description}</p>}
            <div className="home-hero-actions">
              <button className="home-primary-action" style={{ background: homeConfig.primaryButtonColor, color: contrastTextColor(homeConfig.primaryButtonColor) }} onClick={() => navigateConfiguredUrl(homeConfig.primaryButtonUrl)}>{homeConfig.primaryButtonText}</button>
              <button className="home-secondary-action" style={{ background: homeConfig.secondaryButtonColor, color: contrastTextColor(homeConfig.secondaryButtonColor), borderColor: homeConfig.secondaryButtonColor }} onClick={() => navigateConfiguredUrl(homeConfig.secondaryButtonUrl)}>{homeConfig.secondaryButtonText}</button>
            </div>
          </div>
        </section>

        <section className="home-entry-grid" aria-label="首页入口">
          {renderedEntryCards.map((item) => (
            <button className="home-entry-card" key={`${item.title}-${item.href}`} onClick={() => navigateConfiguredUrl(item.href)}>
              <span className={`home-entry-icon ${item.icon}`} aria-hidden="true" />
              <span>
                <b>{item.title}</b>
                <small>{item.description}</small>
                <em>{item.actionText} →</em>
              </span>
            </button>
          ))}
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

function LegacyHomePage() {
  const [query, setQuery] = useState("");
  const [homeArticles, setHomeArticles] = useState<Article[]>([]);
  const [homeCategories, setHomeCategories] = useState<AdminCategoryItem[]>([]);
  const [homeTags, setHomeTags] = useState<AdminTagItem[]>([]);
  const [siteStats, setSiteStats] = useState<PublicSiteStats>();
  const [homeUsingMock, setHomeUsingMock] = useState(false);
  const keyword = query.trim().toLowerCase();
  useEffect(() => {
    let alive = true;
    Promise.all([api.getPublicPosts(), api.getPublicCategories(), api.getPublicTags(), api.getPublicStats()]).then(([postResult, categoryResult, tagResult, statsResult]) => {
      if (!alive) return;
      setHomeArticles(postResult.articles);
      setHomeCategories(categoryResult.items);
      setHomeTags(tagResult.items);
      setSiteStats(statsResult);
      setHomeUsingMock(postResult.source === "mock" || categoryResult.source === "mock" || tagResult.source === "mock" || statsResult.source === "mock");
    });
    return () => {
      alive = false;
    };
  }, []);
  const featuredArticle = homeArticles.find((item) => item.featured) ?? homeArticles[0];
  const filtered = homeArticles.filter((item) => {
    const haystack = [item.title, item.excerpt, item.category, ...item.tags].join(" ").toLowerCase();
    return !keyword || haystack.includes(keyword);
  });
  const latestItems = keyword || !featuredArticle ? filtered : filtered.filter((item) => item.id !== featuredArticle.id);
  return (
    <>
      <PublicHeader active="/" />
      <main className="page two-col home">
        <section className="main-flow">
          <PublicDataNotice show={homeUsingMock} surface="首页" />
          <div className="hero-card">
            <div>
              <h1>全栈之路 · 技术沉淀与成长记录</h1>
              <p>这里记录我的技术探索、项目经验与思考总结，希望与同路人一起学习、交流与成长。</p>
              <div className="chip-row">
                <Tag>技术笔记</Tag><Tag tone="green">项目复盘</Tag><Tag tone="orange">面试总结</Tag><Tag tone="blue">知识库</Tag>
              </div>
            </div>
            <div className="laptop-scene"><span /></div>
          </div>
          <SectionTitle icon="♕" title="精选推荐" />
          {featuredArticle ? (
            <article className="featured-card" onClick={() => go(`/article/${featuredArticle.id}`)}>
              <Art type={featuredArticle.image} />
              <div>
                <h2>{featuredArticle.title}</h2>
                <p>{featuredArticle.excerpt}</p>
                <div className="chip-row">{featuredArticle.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>
                <Meta item={featuredArticle} />
              </div>
              <time>{featuredArticle.date}</time>
            </article>
          ) : <div className="empty card">数据库暂无精选文章</div>}
          <Dots />
          <SectionTitle title="最新文章" />
          <div className="article-list">
            {latestItems.length ? latestItems.map((item) => <ArticleRow key={item.id} item={item} />) : <div className="empty card">没有找到匹配的文章</div>}
          </div>
        </section>
        <aside className="side-stack">
          <Card title="搜索文章">
            <div className="search-box"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入关键词搜索..." /><button>⌕</button></div>
          </Card>
          <Card title="分类导航" moreHref="/categories">
            <div className="category-grid">{homeCategories.map((item) => <button key={item.id} onClick={() => go(`/posts?category=${encodeURIComponent(item.name)}`)}><Icon name="dot" />{item.name}<b>{item.postsCount}</b></button>)}</div>
          </Card>
          <Card title="热门标签" moreHref="/tags">
            <div className="tag-cloud">{homeTags.map((tag, index) => <button className="tag-button" key={tag.id} onClick={() => go(`/posts?tag=${encodeURIComponent(tag.name)}`)}><Tag tone={["pink", "green", "blue", "purple", "gray"][index % 5]}>{tag.name}</Tag></button>)}</div>
          </Card>
          <Card title="推荐文章" moreHref="/posts">
            <MiniList items={featuredArticle ? homeArticles.filter((item) => item.id !== featuredArticle.id).slice(0, 5) : homeArticles.slice(0, 5)} />
          </Card>
          <PublicStatsCard stats={siteStats} />
        </aside>
      </main>
      <PublicFooter />
    </>
  );
}

function SectionTitle({ title, icon }: { title: string; icon?: string }) {
  return <h2 className="section-title">{icon && <span>{icon}</span>}{title}</h2>;
}

function Dots() {
  return <div className="dots"><i className="on" /><i /><i /><i /></div>;
}

function Meta({ item }: { item: Article }) {
  return <div className="meta"><span>◎ {item.reads}</span><span>☰ {item.comments}</span><span>♡ {item.likes}</span><span>◷ 阅读 12 分钟</span></div>;
}

function ArticleRow({ item }: { item: Article }) {
  return (
    <article className="article-row" onClick={() => go(`/article/${item.id}`)}>
      <Art type={item.image} coverUrl={item.coverUrl} />
      <div>
        <h3>{item.title}<Tag tone="purple">AI 摘要</Tag></h3>
        <p>{item.excerpt}</p>
        <div className="chip-row">{item.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>
        <Meta item={item} />
      </div>
      <time>{item.date}</time>
    </article>
  );
}

function HighlightedText({ text, keyword }: { text: string; keyword?: string }) {
  const query = keyword?.trim();
  if (!query) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

function ArchiveArticleCard({ item, keyword }: { item: Article; keyword?: string }) {
  const matchText = keyword?.trim() ? item.searchSnippet || item.summary || item.excerpt : "";
  return (
    <button className="archive-featured-card" onClick={() => go(`/article/${item.id}`)}>
      <Art type={item.image} coverUrl={item.coverUrl} />
      <span>
        <Tag>{item.category}</Tag>
        <b><HighlightedText text={item.title} keyword={keyword} /></b>
        <small><HighlightedText text={item.excerpt} keyword={keyword} /></small>
        {matchText && <small className="archive-match">匹配内容：<HighlightedText text={matchText} keyword={keyword} /></small>}
        <em>阅读 {item.readingMinutes} 分钟 · {item.date}</em>
      </span>
    </button>
  );
}

function Card({ title, children, more, moreHref }: { title: string; children: React.ReactNode; more?: boolean; moreHref?: string }) {
  return <section className="card"><header><h3>{title}</h3>{(more || moreHref) && <button onClick={() => moreHref && go(moreHref)}>更多 ›</button>}</header>{children}</section>;
}

function MiniList({ items }: { items: Article[] }) {
  return <div className="mini-list">{items.length ? items.map((item) => <button key={item.id} onClick={() => go(`/article/${item.id}`)}><Art type={item.image} coverUrl={item.coverUrl} /><span>{item.title}<small>◎ {item.reads}　♡ {item.likes}</small></span></button>) : <p className="soft-text">暂无文章</p>}</div>;
}

function PublicStatsCard({ stats }: { stats?: PublicSiteStats }) {
  const items = [
    ["文章总数", stats ? String(stats.posts) : "--"],
    ["访问量(PV)", stats ? api.formatCount(stats.views) : "--"],
    ["评论数", stats ? String(stats.comments) : "--"],
    ["留言数", stats ? String(stats.messages) : "--"],
    ["点赞数", stats ? String(stats.likes) : "--"],
];
  return <Card title="站点数据"><div className="stat-grid">{items.map(([k, v]) => <div key={k}><Icon name="doc" /><span>{k}</span><b>{v}</b></div>)}</div></Card>;
}

function PublicDataNotice({ show, surface }: { show: boolean; surface: string }) {
  return show ? <div className="note">当前{surface}暂未连接后端，正在显示离线预览数据。</div> : null;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  return ok;
}

function useSafeImageUrl(url?: string, fallback = "/assets/about-portrait.png") {
  const fallbackUrl = sanitizeAssetUrl(fallback) || "/assets/about-portrait.png";
  const normalized = sanitizeAssetUrl(url) || fallbackUrl;
  const [safeUrl, setSafeUrl] = useState(normalized);
  useEffect(() => {
    setSafeUrl(normalized);
  }, [normalized]);
  return {
    url: safeUrl,
    onError: () => {
      if (safeUrl !== fallbackUrl) setSafeUrl(fallbackUrl);
    },
  };
}

function AuthorAvatar({ url, label = "站长头像" }: { url?: string; label?: string }) {
  const image = useSafeImageUrl(url, defaultAboutSettings.portraitUrl);
  return (
    <div className="avatar lg author-photo">
      <img src={image.url} onError={image.onError} alt={label} />
    </div>
  );
}

function ProjectCover({ url, badge, title }: { url?: string; badge?: string; title: string }) {
  const image = useSafeImageUrl(url, "/assets/about-project-blogcore.png");
  return (
    <div className="project-cover art wide">
      <img src={image.url} onError={image.onError} alt={title} loading="lazy" />
      {badge && <span>{badge}</span>}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const displayLanguage = normalizeCodeLanguage(language);
  async function copyCode() {
    try {
      setCopied(await copyText(code));
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <pre className={`code-block language-${displayLanguage}`}>
      <span className="code-block-head">
        <b>{displayLanguage}</b>
        <button type="button" onClick={copyCode}>{copied ? "已复制" : "复制"}</button>
      </span>
      <code>
        {code.split("\n").map((line, index) => (
          <span className="code-line" key={`${index}-${line}`}>
            <span className="code-line-number">{index + 1}</span>
            <span className="code-line-content">{renderCodeTokens(line, displayLanguage, index)}</span>
          </span>
        ))}
      </code>
    </pre>
  );
}

function normalizeCodeLanguage(language = "") {
  const normalized = language.trim().toLowerCase();
  if (!normalized) return "code";
  if (["ts", "tsx"].includes(normalized)) return "typescript";
  if (["js", "jsx", "mjs"].includes(normalized)) return "javascript";
  if (["sh", "shell", "powershell", "ps1"].includes(normalized)) return "bash";
  return normalized.replace(/[^a-z0-9-]/g, "") || "code";
}

const codeKeywords = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "continue", "default", "else", "export", "extends", "false", "finally", "for", "from", "function", "if", "import", "in", "interface", "let", "new", "null", "return", "switch", "this", "throw", "true", "try", "type", "undefined", "while",
]);

function renderCodeTokens(line: string, language: string, lineIndex: number) {
  const tokenPattern = /(\/\/.*$|#.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(line)) !== null) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index));
    const token = match[0];
    const className = token.startsWith("//") || (language === "bash" && token.startsWith("#"))
      ? "comment"
      : /^['"`]/.test(token)
        ? "string"
        : /^\d/.test(token)
          ? "number"
          : codeKeywords.has(token)
            ? "keyword"
            : "";
    nodes.push(className ? <span className={`code-token ${className}`} key={`${lineIndex}-${match.index}`}>{token}</span> : token);
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));
  return nodes.length ? nodes : " ";
}

function StatsCard() {
  return <Card title="站点数据"><div className="stat-grid">{[["文章总数", "--"], ["访问量 (PV)", "--"], ["评论数", "--"], ["点赞数", "--"]].map(([k, v]) => <div key={k}><Icon name="doc" /><span>{k}</span><b>{v}</b></div>)}</div></Card>;
}

function ArticlePage({ articleId }: { articleId: number }) {
  const siteSettings = useSiteSettings(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeNotice, setLikeNotice] = useState("");
  const [liking, setLiking] = useState(false);
  const [comment, setComment] = useState("");
  const [activeSection, setActiveSection] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [articleSource, setArticleSource] = useState<"api" | "mock">("mock");
  const [articleLoading, setArticleLoading] = useState(true);
  const [articleNotice, setArticleNotice] = useState("");
  const [articlePassword, setArticlePassword] = useState("");
  const [unlockNotice, setUnlockNotice] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [latestArticles, setLatestArticles] = useState<Article[]>([]);
  const [articleSideUsingMock, setArticleSideUsingMock] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const toc = article?.sections ?? [];
  const articleCoverUrl = sanitizeAssetUrl(article?.coverUrl);
  const previewImageUrl = sanitizeAssetUrl(previewImage?.src);

  useEffect(() => {
    let alive = true;
    setArticleLoading(true);
    setArticleNotice("");
    setArticle(null);
    setArticlePassword("");
    setUnlockNotice("");
    setRelatedArticles([]);
    setLatestArticles([]);
    setArticleSideUsingMock(false);
    if (!articleId) {
      api.getPublicPosts({ pageSize: 1 })
        .then((result) => {
          if (!alive) return;
          const latest = result.articles[0];
          if (latest) {
            go(`/article/${latest.id}`);
          } else {
            setArticleSource(result.source);
            setArticleNotice(result.source === "mock" ? "内容服务暂不可用，当前没有可打开的文章。" : "暂无已发布文章。");
            setArticle(null);
          }
        })
        .catch((error) => {
          if (!alive) return;
          setArticleSource("api");
          setArticleNotice(getApiErrorMessage(error));
          setArticle(null);
        })
        .finally(() => {
          if (alive) setArticleLoading(false);
        });
      return () => {
        alive = false;
      };
    }
    api.getArticle(articleId)
      .then(({ article: nextArticle, source, message }) => {
        if (alive) {
          setArticleSource(source);
          setArticleNotice(message);
          setArticle(nextArticle);
          setLikeCount(nextArticle?.likes ?? 0);
        }
      })
      .catch((error) => {
        if (alive) {
          setArticleSource("api");
          setArticleNotice(getApiErrorMessage(error));
          setArticle(null);
          setLikeCount(0);
        }
      })
      .finally(() => {
        if (alive) setArticleLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [articleId]);

  useEffect(() => {
    if (!article) return;
    if (!article.locked) {
      document.title = `${article.title} - ${siteSettings.siteName}`;
      setMetaDescription(article.summary || article.excerpt || siteSettings.defaultSeoDescription);
    }
    setLiked(false);
    setLikeCount(article.likes);
    setLikeNotice("");
    setComment("");
    setActiveSection(article.sections[0]?.id ?? "");
    let alive = true;
    Promise.all([
      api.getRelatedPosts(article.id),
      api.getPublicPosts({ pageSize: 5 }),
    ]).then(([relatedResult, latestResult]) => {
      if (!alive) return;
      setRelatedArticles(relatedResult.articles.filter((item) => item.id !== article.id).slice(0, 4));
      setLatestArticles(latestResult.articles.filter((item) => item.id !== article.id).slice(0, 5));
      setArticleSideUsingMock(relatedResult.source === "mock" || latestResult.source === "mock");
    });
    return () => {
      alive = false;
    };
  }, [article, siteSettings]);

  useEffect(() => {
    if (!toc.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible?.target.id) setActiveSection(visible.target.id);
    }, { rootMargin: "-24% 0px -62% 0px", threshold: [0, 0.2, 1] });
    toc.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [toc]);

  function jumpToSection(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function copyArticleLink() {
    try {
      const ok = await copyText(location.href);
      setLikeNotice(ok ? "文章链接已复制到剪贴板。" : "当前浏览器不支持自动复制，请手动复制地址栏链接。");
    } catch {
      setLikeNotice("当前浏览器不支持自动复制，请手动复制地址栏链接。");
    }
  }

  async function likeArticle() {
    if (!article) {
      setLikeNotice("文章尚未加载完成，暂时不能点赞。");
      return;
    }
    if (articleSource !== "api") {
      setLikeNotice("离线预览文章暂不支持点赞。");
      return;
    }
    if (liking) return;
    setLiking(true);
    try {
      const result = await api.likePost(article.id);
      setLikeCount(result.likesCount);
      setLiked(result.liked || result.alreadyLiked);
      setLikeNotice(result.alreadyLiked ? "你已经点过赞了" : "点赞已写入数据库");
      setArticle((current) => current ? ({ ...current, likes: result.likesCount }) : current);
    } catch (error) {
      setLikeNotice(getApiErrorMessage(error));
    } finally {
      setLiking(false);
    }
  }

  async function unlockArticle(event: FormEvent) {
    event.preventDefault();
    if (!article || unlocking) return;
    if (!articlePassword.trim()) {
      setUnlockNotice("请输入访问密码。");
      return;
    }
    setUnlocking(true);
    setUnlockNotice("正在验证密码...");
    try {
      const result = await api.unlockArticle(article.id, articlePassword);
      setArticle(result.article);
      setArticleSource(result.source);
      setLikeCount(result.article.likes);
      setArticlePassword("");
      setUnlockNotice("密码正确，正文已解锁。");
    } catch (error) {
      setUnlockNotice(getApiErrorMessage(error));
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <>
      <PublicHeader active={`/article/${article?.id ?? articleId}`} />
      {!article ? (
        <main className="page-shell">
          <section className="empty card">
            <h1>{articleLoading ? "正在读取文章" : "文章不可用"}</h1>
            <p>{articleLoading ? "正在从后端数据库加载文章内容..." : articleNotice || "文章不存在或尚未发布。"}</p>
            <button onClick={() => go("/")}>返回首页</button>
          </section>
        </main>
      ) : article.locked ? (
        <main className="page-shell">
          <section className="password-gate card">
            <Tag tone="orange">密码访问</Tag>
            <h1>{article.title}</h1>
            <p>{article.summary || "这篇文章需要输入访问密码后才能阅读正文。"}</p>
            {article.passwordHint && <p className="password-hint">提示：{article.passwordHint}</p>}
            <form onSubmit={unlockArticle}>
              <input value={articlePassword} type="password" onChange={(event) => setArticlePassword(event.target.value)} placeholder="输入访问密码" />
              <button disabled={unlocking}>{unlocking ? "验证中..." : "解锁阅读"}</button>
            </form>
            {unlockNotice && <p className="form-notice">{unlockNotice}</p>}
            <button className="text-link" onClick={() => go("/posts")}>返回文章页</button>
          </section>
        </main>
      ) : (
      <main className="article-layout">
        {toc.length > 0 && (
          <details className="mobile-toc card">
            <summary>文章目录 <small>{toc.length} 个小节</small></summary>
            <nav className="mobile-toc-list" aria-label="移动端文章目录">
              {toc.map((section) => (
                <button className={`toc-level-${section.level} ${activeSection === section.id ? "active" : ""}`} key={section.id} onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  jumpToSection(section.id);
                }}>
                  {section.title}
                </button>
              ))}
            </nav>
          </details>
        )}
        <aside className="toc card">
          <h3>文章目录</h3>
          <div className="toc-list">
            {toc.map((section) => <button className={`toc-level-${section.level} ${activeSection === section.id ? "active" : ""}`} key={section.id} onClick={() => jumpToSection(section.id)}>{section.title}</button>)}
          </div>
          <button className="toc-top" onClick={() => scrollTo({ top: 0, behavior: "smooth" })}>回到顶部 ↑</button>
        </aside>
        <article className="paper">
          <div className="cover mountain" style={articleCoverUrl ? { backgroundImage: `url(${articleCoverUrl})` } : undefined} />
          <div className="paper-body">
            <h1>{article.title}</h1>
            <div className="chip-row" aria-busy={articleLoading}><Tag tone="orange">{article.category}</Tag>{article.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}<span className="meta">▣ {article.date}　◷ 阅读 {article.readingMinutes} 分钟　◎ {article.reads}　♡ {likeCount}</span></div>
            <div className="article-actions" aria-label="文章操作">
              <button className={liked ? "liked" : ""} onClick={likeArticle} disabled={liking || articleSource !== "api"} title={articleSource !== "api" ? "离线预览文章暂不支持点赞" : liked ? "已点赞" : "点赞文章"}>
                <span>{liked ? "♥" : "♡"}</span>{liking ? "点赞中..." : liked ? `已点赞 ${likeCount}` : `点赞 ${likeCount}`}
              </button>
              <button onClick={() => document.querySelector(".comments")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                <span>评</span>评论 {article.comments}
              </button>
              <button onClick={copyArticleLink}>
                <span>链</span>复制链接
              </button>
            </div>
            {likeNotice && <p className="form-notice">{likeNotice}</p>}
            <blockquote>{article.summary}</blockquote>
            {article.sections.map((section) => {
              const Heading = section.level === 3 ? "h3" : "h2";
              return (
                <section key={section.id} id={section.id} className="article-section">
                  <Heading>{section.title}</Heading>
                  <div className="article-markdown">{renderArticleMarkdown(section.body, `article-${article.id}-${section.id}`, { onImageClick: (src, alt) => setPreviewImage({ src, alt }) })}</div>
                  {section.list && <ul>{section.list.map((item) => <li key={item}>{item}</li>)}</ul>}
                </section>
              );
            })}
            {articleSource === "mock" && <div className="note">当前内容服务暂不可用或文章不存在，正在显示离线预览内容。</div>}
            {article.codeSample && <><h3>示例代码</h3><CodeBlock code={article.codeSample} language="typescript" /></>}
            <Pager article={article} />
            <CommentBox articleId={article.id} value={comment} onChange={setComment} enabled={articleSource === "api" && article.allowComment !== false} disabledReason={articleSource !== "api" ? "离线预览文章暂不支持评论提交。" : undefined} />
            <section className="article-related-bottom">
              <h3>推荐阅读</h3>
              {relatedArticles.length ? <div>{relatedArticles.map((item) => <button key={item.id} onClick={() => go(`/article/${item.id}`)}><b>{item.title}</b><small>{item.category} · 阅读 {item.readingMinutes} 分钟</small></button>)}</div> : <p className="soft-text">暂无同分类或同标签文章。</p>}
            </section>
          </div>
        </article>
        <aside className="side-stack article-side">
          <PublicDataNotice show={articleSideUsingMock} surface="文章页侧栏" />
          <AuthorCard />
          <Card title="文章摘要"><p className="soft-text">{article.summary}</p></Card>
          <Card title="相关文章">{relatedArticles.length ? <MiniList items={relatedArticles} /> : <p className="soft-text">暂无相关文章</p>}</Card>
          <Card title="最新文章">{latestArticles.length ? <ol className="rank-list">{latestArticles.map((item) => <li key={item.id}>{item.title}<time>{item.date.slice(5)}</time></li>)}</ol> : <p className="soft-text">暂无最新文章</p>}</Card>
        </aside>
        <div className="float-actions"><button onClick={likeArticle} disabled={liking || articleSource !== "api"} title={articleSource !== "api" ? "离线预览文章暂不支持点赞" : liked ? "已点赞" : "点赞"}>{liked ? "♥" : "♡"}</button><button onClick={() => document.querySelector(".comments")?.scrollIntoView({ behavior: "smooth", block: "start" })} title="跳到评论区">评</button><button onClick={copyArticleLink} title="复制文章链接">链</button><button onClick={() => scrollTo(0, 0)} title="回到顶部">↑</button></div>
        {previewImage && (
          <div className="media-modal article-image-modal" role="dialog" aria-modal="true" aria-label="文章图片预览" onClick={() => setPreviewImage(null)}>
            <div className="media-modal-panel article-image-modal-panel" onClick={(event) => event.stopPropagation()}>
              <header><b>{previewImage.alt || "文章图片"}</b><button type="button" onClick={() => setPreviewImage(null)}>关闭</button></header>
              {previewImageUrl && <img src={previewImageUrl} alt={previewImage.alt || "文章图片"} />}
            </div>
          </div>
        )}
      </main>
      )}
      <PublicFooter />
    </>
  );
}

function Pager({ article }: { article: Article }) {
  return <div className="pager"><button disabled={!article.previousId} onClick={() => article.previousId && go(`/article/${article.previousId}`)}>← 上一篇<br /><b>{article.previousTitle ?? "没有上一篇"}</b></button><button disabled={!article.nextId} onClick={() => article.nextId && go(`/article/${article.nextId}`)}>下一篇 →<br /><b>{article.nextTitle ?? "没有下一篇"}</b></button></div>;
}

function CommentBox({ articleId, value, onChange, enabled, disabledReason }: { articleId: number; value: string; onChange: (value: string) => void; enabled: boolean; disabledReason?: string }) {
  const [comments, setComments] = useState<PublicCommentItem[]>([]);
  const [commenter, setCommenter] = useState({ authorName: "", authorEmail: "" });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [commentPage, setCommentPage] = useState(1);
  const [commentPagination, setCommentPagination] = useState({ page: 1, pageSize: PUBLIC_COMMENT_PAGE_SIZE, total: 0, hasMore: false });

  useEffect(() => {
    let alive = true;
    function loadComments() {
      setLoading(true);
      setCommentPage(1);
      api.getComments(articleId, { page: 1, pageSize: PUBLIC_COMMENT_PAGE_SIZE })
        .then((result) => {
          if (!alive) return;
          setComments(result.items);
          setCommentPagination({ page: result.page, pageSize: result.pageSize, total: result.total, hasMore: result.hasMore });
          if (result.source === "mock") setMessage("评论服务暂不可用，当前未展示离线预览评论。");
        })
        .catch((error) => {
          if (alive) setMessage(getApiErrorMessage(error));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }
    loadComments();
    window.addEventListener("admin-data-changed", loadComments);
    return () => {
      alive = false;
      window.removeEventListener("admin-data-changed", loadComments);
    };
  }, [articleId]);

  async function loadMoreComments() {
    if (loadingMore || !commentPagination.hasMore) return;
    const nextPage = commentPage + 1;
    setLoadingMore(true);
    try {
      const result = await api.getComments(articleId, { page: nextPage, pageSize: PUBLIC_COMMENT_PAGE_SIZE });
      setComments((items) => [...items, ...result.items]);
      setCommentPage(result.page);
      setCommentPagination({ page: result.page, pageSize: result.pageSize, total: result.total, hasMore: result.hasMore });
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  async function submitComment() {
    const content = value.trim();
    if (!enabled) {
      setMessage(disabledReason ?? "这篇文章已关闭评论。");
      return;
    }
    if (!commenter.authorName.trim()) {
      setMessage("请输入评论昵称。");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(commenter.authorEmail.trim())) {
      setMessage("请输入有效邮箱，邮箱不会公开。");
      return;
    }
    if (content.length > COMMENT_CONTENT_MAX_LENGTH) {
      setMessage(`评论内容不能超过 ${COMMENT_CONTENT_MAX_LENGTH} 字。`);
      return;
    }
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      const submittedComment = await api.postComment(articleId, { ...commenter, content });
      setComments((items) => [{ ...submittedComment, localPending: submittedComment.status === "pending" }, ...items]);
      onChange("");
      setMessage(submittedComment.status === "pending" ? "评论已写入数据库，审核通过后会公开显示。" : "评论已发布。");
      emitAdminDataChanged();
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function appendCommentEmoji(emoji: string) {
    if (!enabled || value.length >= COMMENT_CONTENT_MAX_LENGTH) return;
    onChange(`${value}${emoji}`.slice(0, COMMENT_CONTENT_MAX_LENGTH));
  }

  const title = enabled ? "发表评论" : "评论已关闭";

  return (
    <section className="comments">
      <h3>{title}</h3>
      {!enabled ? (
        <div className="comment-closed">{disabledReason ?? "站长已关闭这篇文章的评论，前端和后端都会拒绝新评论。"}</div>
      ) : (
        <div className="comment-input">
          <span className="avatar sm">访</span>
          <div className="comment-compose">
            <div className="comment-meta">
              <input value={commenter.authorName} onChange={(event) => setCommenter((current) => ({ ...current, authorName: event.target.value }))} placeholder="昵称" />
              <input value={commenter.authorEmail} onChange={(event) => setCommenter((current) => ({ ...current, authorEmail: event.target.value }))} placeholder="邮箱（不会公开）" />
            </div>
            <textarea value={value} maxLength={COMMENT_CONTENT_MAX_LENGTH} onChange={(event) => onChange(event.target.value)} placeholder="写下你的评论..." />
            <div className="comment-tools" aria-label="评论表情快捷输入">
              <span>表情</span>
              <div className="emoji-row">
                {QUICK_EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => appendCommentEmoji(emoji)} aria-label={`插入表情 ${emoji}`}>{emoji}</button>)}
              </div>
              <small>{value.length}/{COMMENT_CONTENT_MAX_LENGTH}</small>
            </div>
          </div>
          <button onClick={submitComment} disabled={submitting || !value.trim() || !commenter.authorName.trim() || !commenter.authorEmail.trim()}>{submitting ? "提交中..." : "发表评论"}</button>
        </div>
      )}
      {message && <p className="form-notice">{message}</p>}
      <div className="comment-thread">
        {loading ? <p className="soft-text">正在读取评论...</p> : comments.length ? comments.map((item) => (
          <article className="comment-row" key={item.id}>
            <span className="avatar xs">{item.localPending || item.status === "pending" ? "审" : "评"}</span>
            <div>
              <p><b>{item.authorName}</b>：{item.content}</p>
              <small>{item.createdAt?.slice(0, 16).replace("T", " ") ?? "刚刚"} · 点赞 {item.likesCount}{(item.localPending || item.status === "pending") ? " · 待审核" : ""}</small>
            </div>
          </article>
        )) : <div className="friendly-empty"><b>暂无公开评论</b><span>成为第一个认真交流的人吧，审核通过后会显示在这里。</span></div>}
      </div>
      {!loading && comments.length > 0 && <p className="list-count">已显示 {comments.length} / {commentPagination.total} 条评论</p>}
      {!loading && commentPagination.hasMore && <button className="load-more" disabled={loadingMore} onClick={loadMoreComments}>{loadingMore ? "加载中..." : "加载更多评论"}</button>}
    </section>
  );
}

function AuthorCard() {
  const [stats, setStats] = useState<PublicSiteStats>();
  const [usingMock, setUsingMock] = useState(false);
  const [author, setAuthor] = useState<AboutPageSettings>(defaultAboutSettings);
  const [aboutUsingMock, setAboutUsingMock] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getPublicStats(), api.getPublicAbout()]).then(([statsResult, aboutResult]) => {
      if (!alive) return;
      setStats(statsResult);
      setUsingMock(statsResult.source === "mock");
      setAuthor(aboutResult.item);
      setAboutUsingMock(aboutResult.source === "mock");
    }).catch(() => {
      if (!alive) return;
      setAuthor(defaultAboutSettings);
      setAboutUsingMock(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="author card">
      <AuthorAvatar url={author.portraitUrl} />
      <h3>{author.title || defaultAboutSettings.title} <Tag>{author.badge || "站长"}</Tag></h3>
      <p>{author.subtitle || defaultAboutSettings.subtitle}</p>
      <p>{author.intro || defaultAboutSettings.intro}</p>
      {(usingMock || aboutUsingMock) && <p className="soft-text">作者信息暂未连接后端，正在显示离线预览数据。</p>}
      <div className="author-stats"><b>{stats ? stats.posts : "--"}<span>文章</span></b><b>{stats ? api.formatCount(stats.views) : "--"}<span>访问</span></b></div>
      <button onClick={() => go("/about")}>了解作者</button>
    </section>
  );
}

function PostsPage() {
  const archiveRoute = useRoute();
  const initialParams = routeQuery();
  const initialCategory = initialParams.get("category") ?? "全部分类";
  const initialSearch = initialParams.get("q") ?? "";
  const initialView = initialParams.get("view");
  const initialSort = initialParams.get("sort") === "hot" ? "hot" : "latest";
  const initialPage = Math.max(1, Number(initialParams.get("page") ?? 1) || 1);
  const [search, setSearch] = useState(initialSearch);
  const [searchDraft, setSearchDraft] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [sortMode, setSortMode] = useState<"latest" | "hot">(initialSort);
  const [page, setPage] = useState(initialPage);
  const [listMode, setListMode] = useState<"featured" | "all" | "category" | "search">(
    initialSearch ? "search" : initialCategory !== "全部分类" ? "category" : initialView === "all" ? "all" : "featured"
  );
  const [archiveArticles, setArchiveArticles] = useState<Article[]>([]);
  const [archiveCategories, setArchiveCategories] = useState<AdminCategoryItem[]>([]);
  const [archiveStats, setArchiveStats] = useState<PublicSiteStats>();
  const [archivePagination, setArchivePagination] = useState({ page: initialPage, pageSize: ARCHIVE_PAGE_SIZE, total: 0, hasMore: false });
  const [archiveUsingMock, setArchiveUsingMock] = useState(false);
  useEffect(() => {
    const nextParams = routeQuery();
    const nextSearch = nextParams.get("q") ?? "";
    const nextCategory = nextParams.get("category") ?? "全部分类";
    const nextView = nextParams.get("view");
    const nextSort = nextParams.get("sort") === "hot" ? "hot" : "latest";
    const nextPage = Math.max(1, Number(nextParams.get("page") ?? 1) || 1);
    setSearch(nextSearch);
    setSearchDraft(nextSearch);
    setCategory(nextCategory);
    setSortMode(nextSort);
    setPage(nextPage);
    setListMode(nextSearch ? "search" : nextCategory !== "全部分类" ? "category" : nextView === "all" ? "all" : "featured");
  }, [archiveRoute]);
  useEffect(() => {
    let alive = true;
    Promise.all([api.getPublicCategories(), api.getPublicStats()]).then(([categoryResult, statsResult]) => {
      if (!alive) return;
      setArchiveCategories(categoryResult.items);
      setArchiveStats(statsResult);
      setArchiveUsingMock(categoryResult.source === "mock" || statsResult.source === "mock");
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    api.getPublicPosts({
      page,
      pageSize: ARCHIVE_PAGE_SIZE,
      sort: sortMode,
      featured: listMode === "featured",
      category: listMode === "category" ? category : undefined,
      keyword: listMode === "search" ? search : undefined,
    }).then((postResult) => {
      if (!alive) return;
      setArchiveArticles(postResult.articles);
      setArchivePagination({ page: postResult.page ?? page, pageSize: postResult.pageSize ?? ARCHIVE_PAGE_SIZE, total: postResult.total ?? postResult.articles.length, hasMore: Boolean(postResult.hasMore) });
      setArchiveUsingMock((current) => current || postResult.source === "mock");
    });
    return () => {
      alive = false;
    };
  }, [listMode, category, search, sortMode, page]);
  const databaseCategoryOptions = archiveCategories.map((item) => item.name);
  const categoryCountMap = new Map(archiveCategories.map((item) => [item.name, item.postsCount]));
  const visibleArticles = archiveArticles;
  const totalArticles = archivePagination.total;
  const totalPages = Math.max(1, Math.ceil(totalArticles / ARCHIVE_PAGE_SIZE));
  const currentTitle = listMode === "featured" ? "精选文章" : listMode === "all" ? "全部文章" : listMode === "search" ? "搜索结果" : `${category} 分类文章`;
  const currentDescription = listMode === "featured"
    ? `默认展示最多 ${ARCHIVE_PAGE_SIZE} 篇精选文章，点击全部或分类后只看对应文章。`
    : listMode === "all"
      ? `当前共 ${totalArticles} 篇已发布文章，本页最多显示 ${ARCHIVE_PAGE_SIZE} 篇。`
      : listMode === "search"
        ? `包含关键词“${search}”的文章共 ${totalArticles} 篇，本页最多显示 ${ARCHIVE_PAGE_SIZE} 篇。`
        : `该分类下共有 ${totalArticles} 篇文章，本页最多显示 ${ARCHIVE_PAGE_SIZE} 篇。`;
  const currentSortLabel = sortMode === "hot" ? "热门优先" : "最新优先";
  function buildPostsPath(nextMode: typeof listMode, options: { nextSearch?: string; nextCategory?: string; nextSort?: "latest" | "hot"; nextPage?: number } = {}) {
    const params = new URLSearchParams();
    const targetSort = options.nextSort ?? sortMode;
    const targetPage = Math.max(1, options.nextPage ?? 1);
    if (nextMode === "search" && options.nextSearch?.trim()) params.set("q", options.nextSearch.trim());
    if (nextMode === "category" && options.nextCategory) params.set("category", options.nextCategory);
    if (nextMode === "all") params.set("view", "all");
    if (targetSort === "hot") params.set("sort", "hot");
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/posts?${query}` : "/posts";
  }
  function openFeaturedArticles() {
    go(buildPostsPath("featured"));
  }
  function openAllArticles() {
    go(buildPostsPath("all"));
  }
  function openCategory(nextCategory: string) {
    go(buildPostsPath("category", { nextCategory }));
  }
  function submitArchiveSearch(event: FormEvent) {
    event.preventDefault();
    const keyword = searchDraft.trim();
    go(keyword ? buildPostsPath("search", { nextSearch: keyword }) : buildPostsPath("featured"));
  }
  function clearArchiveSearch() {
    setSearchDraft("");
    go(buildPostsPath("featured"));
  }
  function changeSort(nextSort: "latest" | "hot") {
    if (listMode === "search") go(buildPostsPath("search", { nextSearch: search, nextSort }));
    else if (listMode === "category") go(buildPostsPath("category", { nextCategory: category, nextSort }));
    else go(buildPostsPath(listMode, { nextSort }));
  }
  function changePage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    if (listMode === "search") go(buildPostsPath("search", { nextSearch: search, nextPage }));
    else if (listMode === "category") go(buildPostsPath("category", { nextCategory: category, nextPage }));
    else go(buildPostsPath(listMode, { nextPage }));
  }
  return (
    <>
      <PublicHeader active="/posts" />
      <main className="page archive-layout">
        <aside className="filter card archive-category-panel">
          <h3>文章分类</h3>
          <p>默认先看精选，切换全部或分类后只显示对应文章。</p>
          <button className={listMode === "featured" ? "active" : ""} onClick={openFeaturedArticles}>精选文章 <small>{listMode === "featured" ? totalArticles : ""}</small></button>
          <button className={listMode === "all" ? "active" : ""} onClick={openAllArticles}>全部文章 <small>{archiveStats?.posts ?? archiveArticles.length}</small></button>
          <h4>按分类浏览</h4>
          {databaseCategoryOptions.map((x) => <button className={listMode === "category" && category === x ? "active" : ""} key={x} onClick={() => openCategory(x)}>{x} <small>{categoryCountMap.get(x) ?? archiveArticles.filter((item) => item.category === x).length}</small></button>)}
        </aside>
        <section className="timeline-wrap archive-main">
          <PublicDataNotice show={archiveUsingMock} surface="归档页" />
          <section className="archive-search-panel">
            <form className="archive-search-form" onSubmit={submitArchiveSearch}>
              <label htmlFor="archive-search-input">搜索文章</label>
              <div>
                <input
                  id="archive-search-input"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="输入标题、摘要、分类或标签"
                />
                <button type="submit">搜索</button>
                {listMode === "search" && <button className="ghost" type="button" onClick={clearArchiveSearch}>清空</button>}
              </div>
            </form>
            {listMode === "search" && (
              <p className="archive-active-filter">
                正在搜索 <b>{search}</b>
                <span>{totalArticles ? `找到 ${totalArticles} 篇文章` : "暂时没有匹配文章"}</span>
              </p>
            )}
          </section>
          <div className="archive-hero">
            <div>
              <h1>{currentTitle}</h1>
              <p>{currentDescription} 当前排序：{currentSortLabel}。</p>
            </div>
            {listMode === "featured" ? <button onClick={openAllArticles}>查看全部文章</button> : <button onClick={openFeaturedArticles}>返回精选</button>}
          </div>
          <div className="archive-sort-toolbar" aria-label="文章排序">
            <span>排序</span>
            <button className={sortMode === "latest" ? "active" : ""} onClick={() => changeSort("latest")}>最新</button>
            <button className={sortMode === "hot" ? "active" : ""} onClick={() => changeSort("hot")}>热门</button>
          </div>
          {visibleArticles.length ? (
            <div className="archive-featured-grid">
              {visibleArticles.map((item) => <ArchiveArticleCard key={item.id} item={item} keyword={listMode === "search" ? search : undefined} />)}
            </div>
          ) : (
            <section className="archive-empty-state">
              <h3>{listMode === "featured" ? "暂时还没有精选文章" : "没有找到匹配的文章"}</h3>
              <p>{listMode === "search" ? "可以换一个关键词，或者清空搜索回到精选文章。" : "可以切换到全部文章，或者去后台把合适的文章设为精选。"}</p>
              {listMode === "search" ? <button onClick={clearArchiveSearch}>清空搜索</button> : <button onClick={openAllArticles}>查看全部文章</button>}
            </section>
          )}
          <div className="archive-pagination">
            <button disabled={page <= 1} onClick={() => changePage(page - 1)}>上一页</button>
            <span>第 {page} / {totalPages} 页 · 共 {totalArticles} 篇</span>
            <button disabled={!archivePagination.hasMore} onClick={() => changePage(page + 1)}>下一页</button>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

const ABOUT_PAGE_CACHE_KEY = "blog-public-about-cache";

function readCachedAboutSettings() {
  try {
    const cached = window.sessionStorage.getItem(ABOUT_PAGE_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as Partial<AboutPageSettings>;
    return {
      ...defaultAboutSettings,
      ...parsed,
      skills: Array.isArray(parsed.skills) ? parsed.skills : defaultAboutSettings.skills,
      projects: Array.isArray(parsed.projects) ? parsed.projects : defaultAboutSettings.projects,
      writingTopics: Array.isArray(parsed.writingTopics) ? parsed.writingTopics : defaultAboutSettings.writingTopics,
      timeline: Array.isArray(parsed.timeline) ? parsed.timeline : defaultAboutSettings.timeline,
    };
  } catch {
    return null;
  }
}

function cacheAboutSettings(item: AboutPageSettings) {
  try {
    window.sessionStorage.setItem(ABOUT_PAGE_CACHE_KEY, JSON.stringify(item));
  } catch {
    // Ignore storage failures; the fresh API result is already rendered.
  }
}

function AboutPage() {
  const cachedAbout = readCachedAboutSettings();
  const [aboutConfig, setAboutConfig] = useState<AboutPageSettings>(cachedAbout ?? defaultAboutSettings);
  const [aboutUsingMock, setAboutUsingMock] = useState(false);
  const [wechatQrOpen, setWechatQrOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getPublicAbout().then((aboutResult) => {
      if (!alive) return;
      if (aboutResult.source !== "mock") {
        setAboutConfig(aboutResult.item);
        cacheAboutSettings(aboutResult.item);
      } else if (!cachedAbout) {
        setAboutConfig(aboutResult.item);
      }
      setAboutUsingMock(aboutResult.source === "mock" && !cachedAbout);
    }).catch(() => {
      if (alive && !cachedAbout) setAboutUsingMock(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const aboutSkills = aboutConfig?.skills.filter((item) => item.trim() && item.trim() !== "…") ?? [];
  const portrait = useSafeImageUrl(aboutConfig?.portraitUrl, defaultAboutSettings.portraitUrl);
  const wechatQrUrl = sanitizeAssetUrl(aboutConfig.wechatQrUrl);
  const githubUrl = sanitizeNavigationUrl(aboutConfig.githubUrl);
  const cooperateUrl = sanitizeNavigationUrl(aboutConfig.cooperateUrl) || "/messages";
  const aboutProjects = aboutConfig.projects.map((project) => ({
    ...project,
    imageUrl: sanitizeAssetUrl(project.imageUrl),
    projectUrl: sanitizeNavigationUrl(project.projectUrl),
    demoUrl: sanitizeNavigationUrl(project.demoUrl),
  }));

  return (
    <>
      <PublicHeader active="/about" />
      <main className="page about-layout">
        <section className="about-main card">
          <div className="profile">
            <img className="portrait" src={portrait.url} onError={portrait.onError} alt={aboutConfig.title || "关于我头像"} loading="eager" />
            <div className="profile-text"><h1>{aboutConfig.title} <Tag>{aboutConfig.badge}</Tag></h1><p>{aboutConfig.subtitle}</p><h3>{aboutConfig.introTitle}</h3><p>{aboutConfig.intro}</p><div className="contact"><span>⌖ {aboutConfig.location}</span><span>✉ {aboutConfig.email}</span><span>☎ {aboutConfig.phone}</span></div></div>
          </div>
          <hr />
          <h3>技术栈</h3><div className="skill-row">{aboutSkills.map((x) => <span className="skill-chip" key={x}><b>{x.slice(0, 2).toUpperCase()}</b>{x}</span>)}</div>
          <h3>项目作品集</h3>
          <div className="project-grid">{aboutProjects.map((project, i) => <article className={project.projectUrl || project.demoUrl ? "clickable" : ""} key={`${project.title}-${i}`} onClick={() => navigateConfiguredUrl(project.projectUrl || project.demoUrl)}><ProjectCover url={project.imageUrl} badge={project.badge} title={project.title} /><h4>{project.title}</h4><p>{project.description}</p><div>{project.tags.map((tag) => <Tag key={tag} tone="gray">{tag}</Tag>)}</div></article>)}</div>
          <div className="cooperate"><span>💬✈</span><div><h3>{aboutConfig.cooperateTitle}</h3><p>{aboutConfig.cooperateText}</p></div><button onClick={() => navigateConfiguredUrl(cooperateUrl)}>{aboutConfig.cooperateButtonText} →</button></div>
        </section>
        <aside className="side-stack"><PublicDataNotice show={aboutUsingMock} surface="关于页公开数据" /><Card title="关注我"><div className="socials about-socials"><button type="button" onClick={() => navigateConfiguredUrl(githubUrl)}><span className="social-icon github-icon" aria-hidden="true">GH</span><b>GitHub</b></button><button type="button" onClick={() => setWechatQrOpen(true)}><span className="social-icon wechat-icon" aria-hidden="true">微</span><b>微信</b></button></div></Card><Card title="自我介绍时间线"><div className="intro-line">{aboutConfig.timeline.map((x) => <p key={`${x.year}-${x.title}`}><b>{x.year}</b><span>{x.title}</span><small>{x.description}</small></p>)}</div></Card></aside>
        {wechatQrOpen && (
          <div className="media-modal" role="dialog" aria-modal="true" aria-label="微信二维码" onClick={() => setWechatQrOpen(false)}>
            <div className="media-modal-panel qr-modal-panel" onClick={(event) => event.stopPropagation()}>
              <header><b>微信</b><button type="button" onClick={() => setWechatQrOpen(false)}>关闭</button></header>
              {wechatQrUrl ? <img src={wechatQrUrl} alt="微信二维码" /> : <p className="soft-text">请在后台关于页配置中上传微信二维码。</p>}
            </div>
          </div>
        )}
      </main>
      <PublicFooter />
    </>
  );
}

function listToText(items: string[]) {
  return items.join("\n");
}

function textToList(text: string) {
  return text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function topicsToText(items: AboutPageSettings["writingTopics"]) {
  return items.map((item) => `${item.label}|${item.url ?? ""}`).join("\n");
}

function textToTopics(text: string): AboutPageSettings["writingTopics"] {
  return text.split(/\r?\n/).map((line) => {
    const [label = "", url = ""] = line.split("|");
    return { label: label.trim(), url: url.trim() };
  }).filter((item) => item.label);
}

function SiteSettingsPage() {
  const [config, setConfig] = useState<SiteSettings>(defaultSiteSettings);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<"logoUrl" | "faviconUrl" | "defaultOgImageUrl" | null>(null);
  const [siteMediaItems, setSiteMediaItems] = useState<AdminMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<"logoUrl" | "faviconUrl" | "defaultOgImageUrl" | null>(null);
  const siteFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    api.getAdminSiteSettings()
      .then((result) => {
        if (alive) setConfig(result.item);
      })
      .catch((error) => {
        if (!alive) return;
        setNotice(getApiErrorMessage(error));
        if (getApiErrorMessage(error).includes("登录")) api.logout();
      });
    return () => {
      alive = false;
    };
  }, []);

  function updateField<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  async function openSiteMediaPicker(target: "logoUrl" | "faviconUrl" | "defaultOgImageUrl") {
    setMediaPickerTarget(target);
    setMediaLoading(true);
    setNotice("");
    try {
      const result = await api.getAdminMedia({ pageSize: 100, type: "image" });
      setSiteMediaItems(result.items.filter((item) => item.mimeType.startsWith("image/")));
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setMediaLoading(false);
    }
  }

  function selectSiteMedia(item: AdminMediaItem) {
    if (!mediaPickerTarget) return;
    updateField(mediaPickerTarget, mediaDisplayUrl(item));
    setMediaPickerTarget(null);
    setNotice(`已选择${siteMediaTargetLabel(mediaPickerTarget)}：${mediaDisplayName(item)}`);
  }

  function startSiteUpload(target: "logoUrl" | "faviconUrl" | "defaultOgImageUrl") {
    setUploadingTarget(target);
    siteFileInputRef.current?.click();
  }

  async function uploadSiteImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !uploadingTarget) return;
    setSaving(true);
    setNotice("");
    try {
      const result = await api.uploadMedia(file, file.name);
      updateField(uploadingTarget, mediaDisplayUrl(result.item));
      setNotice(`${siteMediaTargetLabel(uploadingTarget)}已上传并填入，保存后前台生效。`);
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setSaving(false);
      setUploadingTarget(null);
    }
  }

  async function saveSiteSettings() {
    setSaving(true);
    setNotice("");
    try {
      const result = await api.updateAdminSiteSettings(config);
      setConfig(result.item);
      setNotice("站点基础设置已保存，前台标题和品牌区会同步更新。");
      emitAdminDataChanged();
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const previewFaviconUrl = sanitizeAssetUrl(config.faviconUrl);
  const previewDefaultOgImageUrl = sanitizeAssetUrl(config.defaultOgImageUrl);

  return (
    <>
      <AdminTop />
      <div className="admin-content admin-placeholder">
        <div className="title-row">
          <h1>站点设置</h1>
          <div className="title-actions"><button onClick={saveSiteSettings} disabled={saving}>{saving ? "保存中..." : "保存配置"}</button><button onClick={() => go("/")}>预览前台</button></div>
        </div>
        {notice && <p className="admin-hint">{notice}</p>}
        <input ref={siteFileInputRef} className="visually-hidden" type="file" accept="image/*" onChange={uploadSiteImage} />
        <section className="card site-config">
          <div className="settings-panel">
            <header>
              <b>品牌信息</b>
              <span>控制前台导航、后台侧边栏的站点名称、说明和 Logo。</span>
            </header>
            <div className="settings-grid">
              <label>站点名称<input value={config.siteName} onChange={(event) => updateField("siteName", event.target.value)} /></label>
              <label>站点副标题<input value={config.siteSubtitle} onChange={(event) => updateField("siteSubtitle", event.target.value)} /></label>
              <label className="wide">Logo 图片<div className="inline-picker"><input value={config.logoUrl} onChange={(event) => updateField("logoUrl", event.target.value)} placeholder="/assets/logo.png 或 /uploads/..." /><button type="button" onClick={() => openSiteMediaPicker("logoUrl")}>媒体库</button><button type="button" onClick={() => startSiteUpload("logoUrl")}>上传</button><button type="button" onClick={() => updateField("logoUrl", "")}>清空</button></div></label>
              <label className="wide">浏览器图标 Favicon<div className="inline-picker"><input value={config.faviconUrl} onChange={(event) => updateField("faviconUrl", event.target.value)} placeholder="/assets/favicon.png 或 /uploads/..." /><button type="button" onClick={() => openSiteMediaPicker("faviconUrl")}>媒体库</button><button type="button" onClick={() => startSiteUpload("faviconUrl")}>上传</button><button type="button" onClick={() => updateField("faviconUrl", "")}>清空</button></div></label>
            </div>
          </div>
          <div className="settings-panel">
            <header>
              <b>默认 SEO 与分享</b>
              <span>作为页面未单独配置 SEO 时的默认标题、描述和分享图。</span>
            </header>
            <div className="settings-grid">
              <label>默认标题<input value={config.defaultSeoTitle} onChange={(event) => updateField("defaultSeoTitle", event.target.value)} /></label>
              <label className="wide">默认描述<textarea value={config.defaultSeoDescription} onChange={(event) => updateField("defaultSeoDescription", event.target.value)} /></label>
              <label className="wide">默认分享图<div className="inline-picker"><input value={config.defaultOgImageUrl} onChange={(event) => updateField("defaultOgImageUrl", event.target.value)} placeholder="/assets/share-cover.png 或 /uploads/..." /><button type="button" onClick={() => openSiteMediaPicker("defaultOgImageUrl")}>媒体库</button><button type="button" onClick={() => startSiteUpload("defaultOgImageUrl")}>上传</button><button type="button" onClick={() => updateField("defaultOgImageUrl", "")}>清空</button></div></label>
            </div>
          </div>
          <div className="settings-panel wide">
            <header>
              <b>页脚文案</b>
              <span>用于备案号、公安备案、版权说明等公开展示内容；留空则自动隐藏。</span>
            </header>
            <div className="settings-grid">
              <label>ICP备案号<input value={config.icpText} onChange={(event) => updateField("icpText", event.target.value)} placeholder="例如：浙ICP备..." /></label>
              <label>ICP备案链接<input value={config.icpUrl} onChange={(event) => updateField("icpUrl", event.target.value)} placeholder="https://beian.miit.gov.cn/" /></label>
              <label>公安备案号<input value={config.policeText} onChange={(event) => updateField("policeText", event.target.value)} placeholder="例如：浙公网安备..." /></label>
              <label>公安备案链接<input value={config.policeUrl} onChange={(event) => updateField("policeUrl", event.target.value)} placeholder="https://www.beian.gov.cn/..." /></label>
              <label>页脚文案<input value={config.footerText} onChange={(event) => updateField("footerText", event.target.value)} /></label>
            </div>
          </div>
          <div className="settings-panel wide">
            <header>
              <b>保存前预览</b>
              <span>这里展示导航品牌、页脚、SEO 分享卡片的大致效果。</span>
            </header>
            <div className="site-preview-grid">
              <div className="site-preview-card">
                <span>品牌区</span>
                <Logo settings={config} />
              </div>
              <div className="site-preview-card">
                <span>浏览器与分享</span>
                <div className="site-browser-preview">
                  <i style={previewFaviconUrl ? { backgroundImage: `url(${previewFaviconUrl})` } : undefined}>{previewFaviconUrl ? "" : "✦"}</i>
                  <b>{config.defaultSeoTitle || config.siteName}</b>
                </div>
                <div className="site-share-preview">
                  {previewDefaultOgImageUrl ? <img src={previewDefaultOgImageUrl} alt="默认分享图预览" /> : <div>分享图未配置</div>}
                  <section>
                    <b>{config.defaultSeoTitle || config.siteName}</b>
                    <p>{config.defaultSeoDescription || "默认描述为空，搜索和分享时可能缺少摘要。"}</p>
                  </section>
                </div>
              </div>
              <div className="site-preview-card">
                <span>页脚</span>
                <footer className="public-footer site-footer-preview">
                  {config.footerText && <span>{config.footerText}</span>}
                  {config.icpText && <span>{config.icpText}</span>}
                  {config.policeText && <span>{config.policeText}</span>}
                  {!config.footerText && !config.icpText && !config.policeText && <span>页脚已隐藏</span>}
                </footer>
              </div>
            </div>
          </div>
        </section>
        {mediaPickerTarget && (
          <div className="media-modal" role="dialog" aria-modal="true" aria-label={`选择${siteMediaTargetLabel(mediaPickerTarget)}`} onClick={() => setMediaPickerTarget(null)}>
            <div className="media-modal-panel media-picker-panel" onClick={(event) => event.stopPropagation()}>
              <header><b>选择{siteMediaTargetLabel(mediaPickerTarget)}</b><button type="button" onClick={() => setMediaPickerTarget(null)}>关闭</button></header>
              {mediaLoading ? <p className="soft-text">正在读取媒体库...</p> : siteMediaItems.length ? (
                <div className="media-picker-grid">
                  {siteMediaItems.map((item) => (
                    <button type="button" key={item.id} onClick={() => selectSiteMedia(item)}>
                      <img src={mediaPreviewUrl(item)} alt={item.altText || item.originalName} loading="lazy" />
                      <span>{mediaDisplayName(item)}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="soft-text">媒体库暂无图片</p>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ImportArticlesPage() {
  const [jsonText, setJsonText] = useState("");
  const [strategy, setStrategy] = useState<"skip" | "rename">("skip");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{ summary: { total: number; imported: number; skipped: number; failed: number; comments: number }; results: Array<{ index: number; ok: boolean; skipped?: boolean; title?: string; slug?: string; comments?: number; error?: string; reason?: string }> } | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  function parseImportJson() {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.items)) return parsed.items;
    if (Array.isArray(parsed.articles)) return parsed.articles;
    throw new Error("JSON 顶层必须是数组，或包含 items/articles 数组");
  }

  async function loadTemplate() {
    setLoading(true);
    setNotice("");
    try {
      const template = await api.getImportArticleTemplate();
      setJsonText(JSON.stringify(template.items, null, 2));
      setPreview(null);
      setResult(null);
      setNotice("模板已填入编辑框，可以直接改内容后预检。");
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function previewImport() {
    setLoading(true);
    setNotice("");
    setResult(null);
    try {
      const items = parseImportJson();
      const response = await api.previewArticleImport(items, strategy);
      setPreview(response.preview);
      setNotice(response.preview.invalid ? "预检发现问题，请先修正错误项。" : "预检通过，可以确认导入。");
    } catch (error) {
      setPreview(null);
      setNotice(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function commitImport() {
    if (!preview || preview.invalid) {
      setNotice("请先通过预检再导入。");
      return;
    }
    setLoading(true);
    setNotice("");
    try {
      const items = parseImportJson();
      const response = await api.commitArticleImport(items, strategy);
      setResult(response);
      setNotice(`导入完成：成功 ${response.summary.imported} 篇，跳过 ${response.summary.skipped} 篇，失败 ${response.summary.failed} 篇。`);
      emitAdminDataChanged();
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AdminTop />
      <div className="admin-content admin-placeholder">
        <div className="title-row">
          <h1>批量导入文章</h1>
          <div className="title-actions">
            <button type="button" onClick={loadTemplate} disabled={loading}>填入模板</button>
            <button type="button" onClick={previewImport} disabled={loading || !jsonText.trim()}>预检</button>
            <button type="button" onClick={commitImport} disabled={loading || !preview || preview.invalid > 0}>确认导入</button>
          </div>
        </div>
        {notice && <p className="admin-hint">{notice}</p>}
        <section className="card import-config">
          <div className="settings-panel">
            <header>
              <b>导入策略</b>
              <span>用于迁移旧博客、补录历史文章和初始化展示数据。建议先预检，再确认导入。</span>
            </header>
            <div className="settings-grid single">
              <label>slug 冲突处理<select value={strategy} onChange={(event) => { setStrategy(event.target.value as "skip" | "rename"); setPreview(null); setResult(null); }}><option value="skip">跳过已存在 slug</option><option value="rename">自动追加后缀</option></select></label>
            </div>
            <div className="import-help">
              <b>支持字段</b>
              <p>文章：title、slug、summary、contentMarkdown、category、tags、coverUrl、status、publishedAt、createdAt、viewsCount、likesCount、readingMinutes、isFeatured、allowComment。</p>
              <p>评论：authorName、authorEmail、content、status、isVisible、likesCount、createdAt、parentIndex。</p>
            </div>
          </div>
          <div className="settings-panel">
            <header>
              <b>JSON 内容</b>
              <span>可以粘贴数组，也可以粘贴包含 items 或 articles 的对象。</span>
            </header>
            <textarea className="import-json" value={jsonText} onChange={(event) => { setJsonText(event.target.value); setPreview(null); setResult(null); }} placeholder='[{"title":"文章标题","contentMarkdown":"# 正文"}]' />
          </div>
          {preview && (
            <div className="settings-panel wide">
              <header>
                <b>预检结果</b>
                <span>共 {preview.total} 篇，有效 {preview.valid} 篇，错误 {preview.invalid} 篇，评论 {preview.comments} 条，涉及 {preview.categories} 个分类和 {preview.tags} 个标签。</span>
              </header>
              <div className="import-preview-list">
                {preview.rows.map((row) => (
                  <article key={row.index} className={row.errors.length ? "has-error" : row.warnings.length ? "has-warning" : ""}>
                    <b>{row.index + 1}. {row.title}</b>
                    <small>{row.slug} · {row.status} · {row.commentsCount} 条评论</small>
                    {row.errors.map((item) => <p key={item}>错误：{item}</p>)}
                    {row.warnings.map((item) => <p key={item}>提示：{item}</p>)}
                  </article>
                ))}
              </div>
            </div>
          )}
          {result && (
            <div className="settings-panel wide">
              <header>
                <b>导入结果</b>
                <span>成功 {result.summary.imported} 篇，跳过 {result.summary.skipped} 篇，失败 {result.summary.failed} 篇，导入评论 {result.summary.comments} 条。</span>
              </header>
              <div className="import-preview-list">
                {result.results.map((row) => (
                  <article key={row.index} className={!row.ok && !row.skipped ? "has-error" : row.skipped ? "has-warning" : ""}>
                    <b>{row.index + 1}. {row.title || "未命名文章"}</b>
                    <small>{row.skipped ? "已跳过" : row.ok ? `已导入 ${row.slug || ""}` : "失败"}{row.comments ? ` · ${row.comments} 条评论` : ""}</small>
                    {row.error && <p>错误：{row.error}</p>}
                    {row.reason && <p>原因：{row.reason}</p>}
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function HomeSettingsPage() {
  const [config, setConfig] = useState<HomePageSettings>(defaultHomeSettings);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [homeMediaItems, setHomeMediaItems] = useState<AdminMediaItem[]>([]);
  const coverDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; width: number; height: number } | null>(null);

  useEffect(() => {
    let alive = true;
    api.getAdminHomeSettings()
      .then((result) => {
        if (alive) setConfig(result.item);
      })
      .catch((error) => {
        if (!alive) return;
        const message = getApiErrorMessage(error);
        setNotice(message);
        if (message.includes("登录")) api.logout();
      });
    return () => {
      alive = false;
    };
  }, []);

  function updateField<K extends keyof HomePageSettings>(key: K, value: HomePageSettings[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function updateEntryCard(index: number, patch: Partial<HomeEntryCardSetting>) {
    setConfig((current) => ({
      ...current,
      entryCards: current.entryCards.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function addEntryCard() {
    setConfig((current) => ({
      ...current,
      entryCards: [...current.entryCards, { title: "新的入口", description: "写一句入口说明。", actionText: "查看", icon: "doc", href: "/", visible: true }],
    }));
  }

  function removeEntryCard(index: number) {
    setConfig((current) => ({ ...current, entryCards: current.entryCards.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function moveEntryCard(index: number, direction: -1 | 1) {
    setConfig((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.entryCards.length) return current;
      const nextCards = [...current.entryCards];
      [nextCards[index], nextCards[nextIndex]] = [nextCards[nextIndex], nextCards[index]];
      return { ...current, entryCards: nextCards };
    });
  }

  function resetEntryCards() {
    setConfig((current) => ({ ...current, entryCards: defaultHomeSettings.entryCards }));
  }

  async function saveHomeSettings() {
    setSaving(true);
    setNotice("");
    try {
      const result = await api.updateAdminHomeSettings(config);
      setConfig(result.item);
      setNotice("首页配置已保存，刷新首页即可看到最新内容。");
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function openHomeMediaPicker() {
    setMediaPickerOpen(true);
    setMediaLoading(true);
    setNotice("");
    try {
      const result = await api.getAdminMedia({ pageSize: 100 });
      setHomeMediaItems(result.items.filter((item) => item.mimeType.startsWith("image/") || item.mimeType.startsWith("video/")));
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setMediaLoading(false);
    }
  }

  function selectHomeMedia(item: AdminMediaItem) {
    const isVideo = item.mimeType.startsWith("video/");
    setConfig((current) => ({
      ...current,
      coverType: isVideo ? "video" : "image",
      coverUrl: isVideo ? current.coverUrl : mediaDisplayUrl(item),
      coverVideoUrl: isVideo ? item.url : current.coverVideoUrl,
      coverPositionX: 50,
      coverPositionY: 50,
      coverZoom: 100,
    }));
    setMediaPickerOpen(false);
    setNotice(`已选择首页封面：${mediaDisplayName(item)}`);
  }

  function updateCoverPosition(x: number, y: number) {
    setConfig((current) => ({ ...current, coverPositionX: clampPercent(x), coverPositionY: clampPercent(y) }));
  }

  function startCoverDrag(event: PointerEvent<HTMLDivElement>) {
    if (!activeCoverUrl) return;
    const rect = event.currentTarget.getBoundingClientRect();
    coverDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: config.coverPositionX,
      originY: config.coverPositionY,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveCoverDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = coverDragRef.current;
    if (!drag) return;
    const nextX = drag.originX + ((event.clientX - drag.startX) / drag.width) * 100;
    const nextY = drag.originY + ((event.clientY - drag.startY) / drag.height) * 100;
    updateCoverPosition(nextX, nextY);
  }

  function endCoverDrag(event: PointerEvent<HTMLDivElement>) {
    coverDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function zoomCover(event: WheelEvent<HTMLDivElement>) {
    if (config.coverType === "image" && !config.coverUrl) return;
    if (config.coverType === "video" && !config.coverVideoUrl) return;
    event.preventDefault();
    const step = event.deltaY < 0 ? 5 : -5;
    updateField("coverZoom", clampZoom(config.coverZoom + step));
  }

  const activeCoverUrl = sanitizeAssetUrl(config.coverType === "video" ? config.coverVideoUrl : config.coverUrl);
  const activeVideoCoverUrl = sanitizeAssetUrl(config.coverVideoUrl);

  return (
    <>
      <AdminTop />
      <div className="admin-content admin-placeholder">
        <div className="title-row">
          <h1>首页配置</h1>
          <div className="title-actions"><button onClick={saveHomeSettings} disabled={saving}>{saving ? "保存中..." : "保存配置"}</button><button onClick={() => go("/")}>预览首页</button></div>
        </div>
        {notice && <p className="admin-hint">{notice}</p>}
        <section className="card home-config">
          <div className="settings-panel">
            <header>
              <b>首屏文案</b>
              <span>控制首页标题、副标题、介绍文案和两个行动按钮。</span>
            </header>
            <div className="settings-grid">
              <label>主标题<input value={config.title} onChange={(event) => updateField("title", event.target.value)} /></label>
              <label>主标题颜色<span className="color-field"><input type="color" value={validHexColor(config.titleColor, defaultHomeSettings.titleColor)} onChange={(event) => updateField("titleColor", event.target.value)} /><input value={config.titleColor} onChange={(event) => updateField("titleColor", event.target.value)} /></span></label>
              <label>副标题<input value={config.subtitle} onChange={(event) => updateField("subtitle", event.target.value)} /></label>
              <label>副标题颜色<span className="color-field"><input type="color" value={validHexColor(config.subtitleColor, defaultHomeSettings.subtitleColor)} onChange={(event) => updateField("subtitleColor", event.target.value)} /><input value={config.subtitleColor} onChange={(event) => updateField("subtitleColor", event.target.value)} /></span></label>
              <label className="wide">介绍文案<textarea value={config.description} onChange={(event) => updateField("description", event.target.value)} /></label>
              <label>介绍文案颜色<span className="color-field"><input type="color" value={validHexColor(config.descriptionColor, defaultHomeSettings.descriptionColor)} onChange={(event) => updateField("descriptionColor", event.target.value)} /><input value={config.descriptionColor} onChange={(event) => updateField("descriptionColor", event.target.value)} /></span></label>
              <label>主按钮文字<input value={config.primaryButtonText} onChange={(event) => updateField("primaryButtonText", event.target.value)} /></label>
              <label>主按钮颜色<span className="color-field"><input type="color" value={validHexColor(config.primaryButtonColor, defaultHomeSettings.primaryButtonColor)} onChange={(event) => updateField("primaryButtonColor", event.target.value)} /><input value={config.primaryButtonColor} onChange={(event) => updateField("primaryButtonColor", event.target.value)} /></span></label>
              <label>主按钮链接<input value={config.primaryButtonUrl} onChange={(event) => updateField("primaryButtonUrl", event.target.value)} placeholder="/posts" /></label>
              <label>副按钮文字<input value={config.secondaryButtonText} onChange={(event) => updateField("secondaryButtonText", event.target.value)} /></label>
              <label>副按钮颜色<span className="color-field"><input type="color" value={validHexColor(config.secondaryButtonColor, defaultHomeSettings.secondaryButtonColor)} onChange={(event) => updateField("secondaryButtonColor", event.target.value)} /><input value={config.secondaryButtonColor} onChange={(event) => updateField("secondaryButtonColor", event.target.value)} /></span></label>
              <label>副按钮链接<input value={config.secondaryButtonUrl} onChange={(event) => updateField("secondaryButtonUrl", event.target.value)} placeholder="/about" /></label>
            </div>
          </div>
          <div className="settings-panel">
            <header>
              <b>首页封面</b>
              <span>可从媒体库选择图片或视频，拖动和滚轮缩放会在保存前实时预览。</span>
            </header>
            <div className="seg home-cover-type">
              <button className={config.coverType === "image" ? "active" : ""} type="button" onClick={() => updateField("coverType", "image")}>图片</button>
              <button className={config.coverType === "video" ? "active" : ""} type="button" onClick={() => updateField("coverType", "video")}>视频</button>
            </div>
            <div
              className={`home-cover-preview ${activeCoverUrl ? "has-image draggable" : ""} ${config.coverType === "video" && activeVideoCoverUrl ? "has-video" : ""}`}
              style={config.coverType === "image" ? homeCoverStyle(config) : undefined}
              onPointerDown={startCoverDrag}
              onPointerMove={moveCoverDrag}
              onPointerUp={endCoverDrag}
              onPointerCancel={endCoverDrag}
              onWheel={zoomCover}
            >
              {config.coverType === "video" && activeVideoCoverUrl && <video className="home-cover-preview-video" src={activeVideoCoverUrl} style={homeVideoStyle(config)} autoPlay muted loop playsInline />}
              {activeCoverUrl && <span className="home-cover-preview-overlay" style={homeOverlayStyle(config)} aria-hidden="true" />}
              <div>
                {config.title ? <b style={{ color: config.titleColor }}>{config.title}</b> : <b className="muted-preview-text">标题已隐藏</b>}
                {config.subtitle && <span style={{ color: config.subtitleColor }}>{config.subtitle}</span>}
                {config.description && <small style={{ color: config.descriptionColor }}>{config.description}</small>}
                <p className="home-cover-preview-actions">
                  <i style={{ background: config.primaryButtonColor, color: contrastTextColor(config.primaryButtonColor) }}>{config.primaryButtonText || "主按钮"}</i>
                  <i style={{ background: config.secondaryButtonColor, color: contrastTextColor(config.secondaryButtonColor) }}>{config.secondaryButtonText || "副按钮"}</i>
                </p>
                {activeCoverUrl && <small>拖动调整位置，滚轮或滑块缩放，保存前可实时预览</small>}
              </div>
            </div>
            <div className="settings-grid single">
              {config.coverType === "image"
                ? <label>图片封面 URL<div className="inline-picker"><input value={config.coverUrl} onChange={(event) => updateField("coverUrl", event.target.value)} placeholder="留空则使用默认空白背景" /><button type="button" onClick={openHomeMediaPicker}>媒体库</button></div></label>
                : <label>视频封面 URL<div className="inline-picker"><input value={config.coverVideoUrl} onChange={(event) => updateField("coverVideoUrl", event.target.value)} placeholder="/uploads/2026/06/18/cover.mp4" /><button type="button" onClick={openHomeMediaPicker}>媒体库</button></div></label>}
            </div>
            {activeCoverUrl && (
              <div className="home-cover-position">
                <label>水平位置 <b>{config.coverPositionX}%</b><input type="range" min="0" max="100" value={config.coverPositionX} onChange={(event) => updateField("coverPositionX", Number(event.target.value))} /></label>
                <label>垂直位置 <b>{config.coverPositionY}%</b><input type="range" min="0" max="100" value={config.coverPositionY} onChange={(event) => updateField("coverPositionY", Number(event.target.value))} /></label>
                <label>缩放比例 <b>{config.coverZoom}%</b><input type="range" min="100" max="180" step="5" value={config.coverZoom} onChange={(event) => updateField("coverZoom", Number(event.target.value))} /></label>
                <label>遮罩透明度 <b>{config.coverOverlayOpacity}%</b><input type="range" min="0" max="70" step="5" value={config.coverOverlayOpacity} onChange={(event) => updateField("coverOverlayOpacity", Number(event.target.value))} /></label>
              </div>
            )}
            <div className="home-cover-actions">
              <button type="button" onClick={() => setConfig((current) => ({ ...current, coverUrl: "", coverVideoUrl: "", coverPositionX: 50, coverPositionY: 50, coverZoom: 100 }))}>清空封面</button>
            </div>
          </div>
          <div className="settings-panel wide">
            <div className="home-entry-editor">
              <header>
                <div>
                  <b>首页入口卡片</b>
                  <span>控制首页首屏下方的入口卡片，隐藏后前台不展示；全部隐藏时前台会使用默认入口兜底。</span>
                </div>
                <div className="entry-editor-actions">
                  <button type="button" onClick={addEntryCard}>新增入口</button>
                  <button type="button" onClick={resetEntryCards}>恢复默认</button>
                </div>
              </header>
              {config.entryCards.map((card, index) => (
                <article key={`${card.title}-${index}`}>
                  <div className="project-card-head">
                    <b>入口 {index + 1}</b>
                    <div className="entry-card-actions">
                      <button type="button" disabled={index === 0} onClick={() => moveEntryCard(index, -1)}>上移</button>
                      <button type="button" disabled={index === config.entryCards.length - 1} onClick={() => moveEntryCard(index, 1)}>下移</button>
                      <button className="project-remove" type="button" onClick={() => removeEntryCard(index)}>删除</button>
                    </div>
                  </div>
                  <label className="switch">前台显示<input type="checkbox" checked={card.visible} onChange={(event) => updateEntryCard(index, { visible: event.target.checked })} /></label>
                  <label>图标<select value={card.icon} onChange={(event) => updateEntryCard(index, { icon: event.target.value as HomeEntryCardSetting["icon"] })}><option value="doc">文章</option><option value="cube">项目</option><option value="user">个人</option></select></label>
                  <label>标题<input value={card.title} onChange={(event) => updateEntryCard(index, { title: event.target.value })} /></label>
                  <label>按钮文案<input value={card.actionText} onChange={(event) => updateEntryCard(index, { actionText: event.target.value })} /></label>
                  <label className="wide">说明<textarea value={card.description} onChange={(event) => updateEntryCard(index, { description: event.target.value })} /></label>
                  <label className="wide">跳转链接<input value={card.href} onChange={(event) => updateEntryCard(index, { href: event.target.value })} placeholder="/posts 或 https://example.com" /></label>
                </article>
              ))}
              {!config.entryCards.length && <p className="soft-text">暂无自定义入口，前台会显示默认三张入口卡片。</p>}
            </div>
          </div>
        </section>
        {mediaPickerOpen && (
          <div className="media-modal" role="dialog" aria-modal="true" aria-label="选择首页封面" onClick={() => setMediaPickerOpen(false)}>
            <div className="media-modal-panel media-picker-panel" onClick={(event) => event.stopPropagation()}>
              <header><b>选择首页封面</b><button type="button" onClick={() => setMediaPickerOpen(false)}>关闭</button></header>
              {mediaLoading ? <p className="soft-text">正在读取媒体库...</p> : homeMediaItems.length ? (
                <div className="media-picker-grid">
                  {homeMediaItems.map((item) => (
                    <button type="button" key={item.id} onClick={() => selectHomeMedia(item)}>
                      {item.mimeType.startsWith("video/")
                        ? <video src={mediaOriginalUrl(item)} muted playsInline />
                        : <img src={mediaPreviewUrl(item)} alt={item.altText || item.originalName} loading="lazy" />}
                      <span>{item.mimeType.startsWith("video/") ? "视频 · " : ""}{mediaDisplayName(item)}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="soft-text">媒体库暂无图片或视频</p>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

type AboutTimelineEditorItem = AboutPageSettings["timeline"][number] & { editorKey: string };

let aboutTimelineEditorKeySeed = 0;

function withAboutTimelineKeys(items: AboutPageSettings["timeline"]): AboutTimelineEditorItem[] {
  return items.map((item) => ({ ...item, editorKey: `timeline-${aboutTimelineEditorKeySeed += 1}` }));
}

function AboutSettingsPage() {
  const [config, setConfig] = useState<AboutPageSettings>(defaultAboutSettings);
  const [skillsText, setSkillsText] = useState(listToText(defaultAboutSettings.skills));
  const [projects, setProjects] = useState<AboutPageSettings["projects"]>(defaultAboutSettings.projects);
  const [topicsText, setTopicsText] = useState(topicsToText(defaultAboutSettings.writingTopics));
  const [timeline, setTimeline] = useState<AboutTimelineEditorItem[]>(() => withAboutTimelineKeys(defaultAboutSettings.timeline));
  const [aboutMediaItems, setAboutMediaItems] = useState<AdminMediaItem[]>([]);
  const [mediaTarget, setMediaTarget] = useState<"portrait" | "project" | "wechatQr" | null>(null);
  const [mediaProjectIndex, setMediaProjectIndex] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getAdminAboutSettings()
      .then((result) => {
        if (!alive) return;
        setConfig(result.item);
        setSkillsText(listToText(result.item.skills));
        setProjects(result.item.projects);
        setTopicsText(topicsToText(result.item.writingTopics));
        setTimeline(withAboutTimelineKeys(result.item.timeline));
      })
      .catch((error) => {
        if (!alive) return;
        setNotice(getApiErrorMessage(error));
        if (getApiErrorMessage(error).includes("登录")) api.logout();
      });
    return () => {
      alive = false;
    };
  }, []);

  function updateField<K extends keyof AboutPageSettings>(key: K, value: AboutPageSettings[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function updateProject(index: number, patch: Partial<AboutPageSettings["projects"][number]>) {
    setProjects((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addProject() {
    setProjects((items) => [...items, { title: "新项目", description: "", imageUrl: "", projectUrl: "", demoUrl: "", tags: [], badge: "个人项目" }]);
  }

  function removeProject(index: number) {
    setProjects((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveProject(index: number, direction: -1 | 1) {
    setProjects((items) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= items.length) return items;
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function updateTimeline(index: number, patch: Partial<AboutPageSettings["timeline"][number]>) {
    setTimeline((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addTimelineItem() {
    setTimeline((items) => [...items, { year: "", title: "", description: "", editorKey: `timeline-${aboutTimelineEditorKeySeed += 1}` }]);
  }

  function removeTimelineItem(index: number) {
    setTimeline((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveTimelineItem(index: number, direction: -1 | 1) {
    setTimeline((items) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= items.length) return items;
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function saveAboutSettings() {
    setSaving(true);
    setNotice("");
    try {
      const payload: AboutPageSettings = {
        ...config,
        skills: textToList(skillsText),
        projects: projects.map((item) => ({ ...item, tags: Array.isArray(item.tags) ? item.tags : [] })),
        socials: [{ label: "GitHub", url: config.githubUrl }, { label: "微信", url: "" }],
        writingTopics: textToTopics(topicsText),
        timeline: timeline.map((item) => ({
          year: item.year.trim(),
          title: item.title.trim(),
          description: item.description.trim(),
        })).filter((item) => item.year || item.title || item.description),
      };
      const result = await api.updateAdminAboutSettings(payload);
      setConfig(result.item);
      setNotice("关于页配置已保存到数据库。");
      emitAdminDataChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function openAboutMediaPicker(target: "portrait" | "project" | "wechatQr", projectIndex = 0) {
    setMediaTarget(target);
    setMediaProjectIndex(projectIndex);
    setMediaLoading(true);
    setNotice("");
    try {
      const result = await api.getAdminMedia({ pageSize: 100 });
      setAboutMediaItems(result.items.filter((item) => item.mimeType.startsWith("image/")));
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setMediaLoading(false);
    }
  }

  function selectAboutMedia(item: AdminMediaItem) {
    if (mediaTarget === "portrait") {
      updateField("portraitUrl", mediaDisplayUrl(item));
    } else if (mediaTarget === "wechatQr") {
      updateField("wechatQrUrl", mediaDisplayUrl(item));
    } else if (mediaTarget === "project") {
      updateProject(mediaProjectIndex, { imageUrl: mediaDisplayUrl(item) });
    }
    setMediaTarget(null);
    setNotice(`已选择图片：${item.originalName}`);
  }

  return (
    <>
      <AdminTop />
      <div className="admin-content admin-placeholder">
        <div className="title-row">
          <h1>关于页配置</h1>
          <div className="title-actions"><button onClick={saveAboutSettings} disabled={saving}>{saving ? "保存中..." : "保存配置"}</button><button onClick={() => go("/about")}>预览关于页</button></div>
        </div>
        {notice && <p className="admin-hint">{notice}</p>}
        <section className="card about-config">
          <div className="settings-panel">
            <header>
              <b>基础资料</b>
              <span>控制关于页首屏、个人介绍与联系信息。</span>
            </header>
            <div className="settings-grid">
            <label>标题<input value={config.title} onChange={(event) => updateField("title", event.target.value)} /></label>
            <label>身份标签<input value={config.badge} onChange={(event) => updateField("badge", event.target.value)} /></label>
            <label className="wide">副标题<input value={config.subtitle} onChange={(event) => updateField("subtitle", event.target.value)} /></label>
            <label>头像 URL<div className="inline-picker"><input value={config.portraitUrl} onChange={(event) => updateField("portraitUrl", event.target.value)} /><button type="button" onClick={() => openAboutMediaPicker("portrait")}>媒体库</button></div></label>
            <label>安全运行天数<input value={config.safeDays} onChange={(event) => updateField("safeDays", event.target.value)} /></label>
            <label>安全运行起始说明<input value={config.safeSince} onChange={(event) => updateField("safeSince", event.target.value)} /></label>
            <label>简介小标题<input value={config.introTitle} onChange={(event) => updateField("introTitle", event.target.value)} /></label>
            <label className="wide">个人简介<textarea value={config.intro} onChange={(event) => updateField("intro", event.target.value)} /></label>
            <label>所在地<input value={config.location} onChange={(event) => updateField("location", event.target.value)} /></label>
            <label>邮箱<input value={config.email} onChange={(event) => updateField("email", event.target.value)} /></label>
            <label>电话<input value={config.phone} onChange={(event) => updateField("phone", event.target.value)} /></label>
            <label>GitHub 链接<input value={config.githubUrl} onChange={(event) => updateField("githubUrl", event.target.value)} /></label>
            <label className="wide">微信二维码<div className="inline-picker"><input value={config.wechatQrUrl} onChange={(event) => updateField("wechatQrUrl", event.target.value)} /><button type="button" onClick={() => openAboutMediaPicker("wechatQr")}>媒体库</button></div></label>
            </div>
          </div>
          <div className="settings-panel">
            <header>
              <b>侧栏与履历</b>
              <span>技术栈每行一条，写作主题使用“名称|链接”。</span>
            </header>
            <div className="settings-grid compact">
            <label>技术栈（每行一个）<textarea value={skillsText} onChange={(event) => setSkillsText(event.target.value)} /></label>
            <label>写作主题（名称|链接，每行一个）<textarea value={topicsText} onChange={(event) => setTopicsText(event.target.value)} /></label>
            </div>
          </div>
          <div className="settings-panel wide">
            <div className="timeline-editor">
              <header>
                <div>
                  <b>时间线</b>
                  <span>逐条编辑公开履历，适合填写教育、工作、项目和个人实践经历。</span>
                </div>
                <button type="button" onClick={addTimelineItem}>新增时间线</button>
              </header>
              {timeline.map((item, index) => (
                <article key={item.editorKey}>
                  <div className="project-card-head">
                    <b>经历 {index + 1}</b>
                    <div className="entry-card-actions">
                      <button type="button" disabled={index === 0} onClick={() => moveTimelineItem(index, -1)}>上移</button>
                      <button type="button" disabled={index === timeline.length - 1} onClick={() => moveTimelineItem(index, 1)}>下移</button>
                      <button className="project-remove" type="button" onClick={() => removeTimelineItem(index)}>删除</button>
                    </div>
                  </div>
                  <label>时间 / 年份<input value={item.year} onChange={(event) => updateTimeline(index, { year: event.target.value })} placeholder="例如：2026.05 - 至今" /></label>
                  <label>标题<input value={item.title} onChange={(event) => updateTimeline(index, { title: event.target.value })} placeholder="例如：多 Agent 竞品分析系统个人实践" /></label>
                  <label className="wide">说明<textarea value={item.description} onChange={(event) => updateTimeline(index, { description: event.target.value })} placeholder="写一段公开展示用的简介，尽量简洁。" /></label>
                </article>
              ))}
              {!timeline.length && <p className="soft-text">暂无时间线，点击“新增时间线”开始配置。</p>}
            </div>
          </div>
          <div className="settings-panel wide">
            <div className="wide project-editor">
              <header><div><b>项目作品集</b><span>封面从媒体库选择，链接留空时前台仅展示不跳转。</span></div><button type="button" onClick={addProject}>新增项目</button></header>
              {projects.map((project, index) => (
                <article key={`${project.title}-${index}`}>
                  <div className="project-media-column">
                    <div className="project-thumb" style={{ backgroundImage: sanitizeAssetUrl(project.imageUrl) ? `url(${sanitizeAssetUrl(project.imageUrl)})` : undefined }} />
                    <button type="button" onClick={() => openAboutMediaPicker("project", index)}>选择封面</button>
                  </div>
                  <div className="project-form-grid">
                    <div className="project-card-head">
                      <b>项目 {index + 1}</b>
                      <div className="entry-card-actions">
                        <button type="button" disabled={index === 0} onClick={() => moveProject(index, -1)}>上移</button>
                        <button type="button" disabled={index === projects.length - 1} onClick={() => moveProject(index, 1)}>下移</button>
                        <button className="project-remove" type="button" onClick={() => removeProject(index)}>删除</button>
                      </div>
                    </div>
                    <label>项目名称<input value={project.title} onChange={(event) => updateProject(index, { title: event.target.value })} /></label>
                    <label>项目徽标<input value={project.badge ?? ""} onChange={(event) => updateProject(index, { badge: event.target.value })} /></label>
                    <label className="wide">项目描述<textarea value={project.description} onChange={(event) => updateProject(index, { description: event.target.value })} /></label>
                    <label>标签（逗号分隔）<input value={project.tags.join(", ")} onChange={(event) => updateProject(index, { tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
                    <label>项目链接<input value={project.projectUrl ?? ""} onChange={(event) => updateProject(index, { projectUrl: event.target.value })} /></label>
                    <label>演示链接<input value={project.demoUrl ?? ""} onChange={(event) => updateProject(index, { demoUrl: event.target.value })} /></label>
                    <label className="wide">封面 URL<input value={project.imageUrl ?? ""} onChange={(event) => updateProject(index, { imageUrl: event.target.value })} /></label>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="settings-panel wide">
            <header>
              <b>合作入口</b>
              <span>控制关于页底部行动按钮与文案。</span>
            </header>
            <div className="settings-grid">
            <label>合作标题<input value={config.cooperateTitle} onChange={(event) => updateField("cooperateTitle", event.target.value)} /></label>
            <label>合作按钮<input value={config.cooperateButtonText} onChange={(event) => updateField("cooperateButtonText", event.target.value)} /></label>
            <label>合作按钮链接<input value={config.cooperateUrl} onChange={(event) => updateField("cooperateUrl", event.target.value)} /></label>
            <label className="wide">合作文案<textarea value={config.cooperateText} onChange={(event) => updateField("cooperateText", event.target.value)} /></label>
            </div>
          </div>
        </section>
        {mediaTarget && (
          <div className="media-modal" role="dialog" aria-modal="true" aria-label="选择关于页图片" onClick={() => setMediaTarget(null)}>
            <div className="media-modal-panel media-picker-panel" onClick={(event) => event.stopPropagation()}>
              <header><b>选择图片</b><button type="button" onClick={() => setMediaTarget(null)}>关闭</button></header>
              {mediaLoading ? <p className="soft-text">正在读取媒体库...</p> : aboutMediaItems.length ? (
                <div className="media-picker-grid">
                  {aboutMediaItems.map((item) => <button type="button" key={item.id} onClick={() => selectAboutMedia(item)}><img src={mediaPreviewUrl(item)} alt={item.altText || item.originalName} loading="lazy" /><span>{item.originalName}</span></button>)}
                </div>
              ) : <p className="soft-text">媒体库暂无图片</p>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function MessagesPage() {
  const [tab, setTab] = useState("all");
  const [sort, setSort] = useState("latest");
  const [form, setForm] = useState({ author: "", email: "", site: "", content: "" });
  const [list, setList] = useState<Message[]>([]);
  const [submitNotice, setSubmitNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [messagesUsingMock, setMessagesUsingMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [messagePage, setMessagePage] = useState(1);
  const [messagePagination, setMessagePagination] = useState({ page: 1, pageSize: PUBLIC_MESSAGE_PAGE_SIZE, total: 0, hasMore: false });
  const [ownerProfile, setOwnerProfile] = useState(defaultAboutSettings);

  useEffect(() => {
    let alive = true;
    function loadMessages() {
      setLoading(true);
      setMessagePage(1);
      api.getMessages({ page: 1, pageSize: PUBLIC_MESSAGE_PAGE_SIZE })
        .then(({ messages: nextMessages, source, page: nextPage, pageSize, total, hasMore }) => {
          if (!alive) return;
          const usingMock = source === "mock";
          setList(nextMessages);
          setMessagePage(nextPage);
          setMessagePagination({ page: nextPage, pageSize, total, hasMore });
          setMessagesUsingMock(usingMock);
        })
        .catch((error) => {
          if (alive) {
            setMessagesUsingMock(false);
            setSubmitNotice(getApiErrorMessage(error));
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }
    loadMessages();
    window.addEventListener("admin-data-changed", loadMessages);
    return () => {
      alive = false;
      window.removeEventListener("admin-data-changed", loadMessages);
    };
  }, []);

  async function loadMoreMessages() {
    if (loadingMore || !messagePagination.hasMore) return;
    const nextPage = messagePage + 1;
    setLoadingMore(true);
    try {
      const result = await api.getMessages({ page: nextPage, pageSize: PUBLIC_MESSAGE_PAGE_SIZE });
      setList((items) => [...items, ...result.messages]);
      setMessagePage(result.page);
      setMessagePagination({ page: result.page, pageSize: result.pageSize, total: result.total, hasMore: result.hasMore });
      setMessagesUsingMock(result.source === "mock");
    } catch (error) {
      setSubmitNotice(getApiErrorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    let alive = true;
    function loadOwnerProfile() {
      api.getPublicAbout()
        .then((result) => {
          if (alive) setOwnerProfile(result.item);
        })
        .catch(() => {
          if (alive) setOwnerProfile(defaultAboutSettings);
        });
    }
    loadOwnerProfile();
    window.addEventListener("admin-data-changed", loadOwnerProfile);
    return () => {
      alive = false;
      window.removeEventListener("admin-data-changed", loadOwnerProfile);
    };
  }, []);

  const repliedCount = list.filter((item) => item.replies?.length).length;
  const pendingCount = list.filter((item) => !item.approved).length;
  const visibleMessages = [...list]
    .filter((item) => tab === "all" || (tab === "reply" ? Boolean(item.replies?.length) : !item.approved))
    .sort((a, b) => sort === "hot" ? b.likes - a.likes : b.id - a.id);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!form.author.trim() || !form.email.trim() || !form.content.trim()) {
      setSubmitNotice("请填写昵称、邮箱和留言内容。");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setSubmitNotice("请输入有效邮箱，邮箱不会公开。");
      return;
    }
    if (form.content.trim().length > MESSAGE_CONTENT_MAX_LENGTH) {
      setSubmitNotice(`留言内容不能超过 ${MESSAGE_CONTENT_MAX_LENGTH} 字。`);
      return;
    }
    setSubmitting(true);
    setSubmitNotice("正在提交留言...");
    try {
      const next = await api.postMessage(form);
      setList((items) => [{ ...next, approved: false, replies: [] }, ...items]);
      setForm({ author: "", email: "", site: "", content: "" });
      setSubmitNotice("留言已提交，审核通过后会公开显示。");
      emitAdminDataChanged();
    } catch (error) {
      setSubmitNotice(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function appendMessageEmoji(emoji: string) {
    setForm((current) => ({ ...current, content: `${current.content}${emoji}`.slice(0, MESSAGE_CONTENT_MAX_LENGTH) }));
  }

  return (
    <>
      <PublicHeader active="/messages" />
      <main className="page two-col message-page">
        <section className="main-flow">
          <PublicDataNotice show={messagesUsingMock} surface="留言板" />
          <div className="message-title">
            <div><h1><span className="message-title-icon" />留言板</h1><p>欢迎交流，有问题可以留言，我会尽快回复你。</p></div>
            <span>♧ {repliedCount ? `有 ${repliedCount} 条站长回复` : "暂无站长回复"}</span>
          </div>
          <form className="message-form card" onSubmit={submit}>
            <div className="form-grid">
              <label>昵称 *<input value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="请输入你的昵称" /></label>
              <label>邮箱 *<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="请输入邮箱，不会公开" /></label>
              <label>网站（可选）<input value={form.site} onChange={(event) => setForm({ ...form, site: event.target.value })} placeholder="https://your-site.com" /></label>
            </div>
            <label>写下你的留言 *<textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} maxLength={MESSAGE_CONTENT_MAX_LENGTH} placeholder="欢迎留言交流，分享你的想法或问题..." /></label>
            <footer className="message-compose-tools">
              <div className="emoji-row" aria-label="留言表情快捷输入">
                <span>表情</span>
                {QUICK_EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => appendMessageEmoji(emoji)} aria-label={`插入表情 ${emoji}`}>{emoji}</button>)}
              </div>
              <small>{form.content.length} / {MESSAGE_CONTENT_MAX_LENGTH}</small>
              <button disabled={submitting || !form.author.trim() || !form.email.trim() || !form.content.trim()}>{submitting ? "提交中..." : "发布留言"}</button>
            </footer>
            {submitNotice && <p className="form-notice">{submitNotice}</p>}
          </form>
          <div className="message-tabs">
            <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>全部留言 <b>{list.length}</b></button>
            <button onClick={() => setTab("reply")} className={tab === "reply" ? "active" : ""}>站长回复 <b>{repliedCount}</b></button>
            <button onClick={() => setTab("pending")} className={tab === "pending" ? "active" : ""}>待审核 <b>{pendingCount}</b></button>
            <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">最新留言</option><option value="hot">点赞最多</option></select>
          </div>
          <div className="message-list">{loading ? <section className="empty card">正在读取留言...</section> : visibleMessages.length ? visibleMessages.map((item) => <MessageItem key={item.id} item={item} readonlyMock={messagesUsingMock} />) : <section className="friendly-empty card"><b>当前筛选下暂无留言</b><span>{tab === "all" ? "还没有公开留言，可以先写下第一个问题或想法。" : "换到全部留言，或者等待站长审核和回复。"}</span></section>}</div>
          {!loading && list.length > 0 && <p className="list-count">已显示 {list.length} / {messagePagination.total} 条留言</p>}
          {!loading && messagePagination.hasMore && <button className="load-more" disabled={loadingMore} onClick={loadMoreMessages}>{loadingMore ? "加载中..." : "加载更多留言"}</button>}
        </section>
        <aside className="side-stack"><section className="rule-card card"><h3>友好交流</h3><p>请尊重他人、文明发言</p><p>禁止发布广告、恶意链接</p><p>技术讨论请尽量具体清晰</p><p>站长会定期查看并回复</p></section><Card title="最新评论"><MiniComments /></Card><section className="author card"><AuthorAvatar url={ownerProfile.portraitUrl} /><h3>{ownerProfile.title || "关于我"} <Tag>{ownerProfile.badge || "站长"}</Tag></h3><p>{ownerProfile.subtitle || defaultAboutSettings.subtitle}</p><p>{ownerProfile.intro || defaultAboutSettings.intro}</p></section></aside>
      </main>
      <PublicFooter />
    </>
  );
}

function MessageItem({ item, readonlyMock = false }: { item: Message; readonlyMock?: boolean }) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(item.likes);
  const [likeNotice, setLikeNotice] = useState("");
  const [liking, setLiking] = useState(false);
  async function likeMessage() {
    if (readonlyMock) {
      setLikeNotice("离线预览留言暂不支持点赞。");
      return;
    }
    if (liking) return;
    setLiking(true);
    setLikeNotice("");
    try {
      const result = await api.likeMessage(item.id);
      setLikesCount(result.likesCount);
      setLiked(result.liked || result.alreadyLiked);
      setLikeNotice(result.alreadyLiked ? "你已经点过赞了" : "点赞已写入数据库");
    } catch (error) {
      setLikeNotice(getApiErrorMessage(error));
    } finally {
      setLiking(false);
    }
  }
  return (
    <article className="message-item card">
      <div className={`avatar ${item.avatar}`}>{item.author[0]}</div>
      <div>
        <h3>{item.author}<Tag tone={item.role === "站长" ? "green" : "blue"}>{item.role}</Tag><small> · {item.time}</small></h3>
        <p>{item.content}</p>
        <button onClick={likeMessage} disabled={liking || !item.approved || readonlyMock} title={readonlyMock ? "离线预览留言暂不支持点赞" : item.approved ? "点赞留言" : "审核通过后可点赞"}>{liked ? "♥" : "♡"} {likesCount}</button>
        {likeNotice && <small className="form-notice">{likeNotice}</small>}
        {item.replies?.map((reply) => <MessageItem key={reply.id} item={reply} readonlyMock={readonlyMock} />)}
      </div>
      <span className="approved">{item.approved ? "已通过 ✓" : "待审核"}</span>
    </article>
  );
}

function MiniComments({ items }: { items?: AdminDashboardData["pendingComments"] }) {
  const list = items ?? [];
  return <div className="comment-mini">{list.length ? list.map((item) => <p key={item.id}><span className="avatar xs">{item.authorName[0]}</span><b>{item.authorName}</b><small>{item.createdAt?.slice(0, 10) ?? "刚刚"}</small><br />{item.content}</p>) : <p className="soft-text">{items ? "暂无待审核评论" : "暂无评论数据"}</p>}</div>;
}

function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.login(account, password);
      go("/admin");
    } catch (loginError) {
      setError(getApiErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-copy">
        <p className="path">后台 /admin/login</p>
        <h1>管理后台登录</h1>
        <p>登录后才能访问文章、媒体、评论和留言等管理接口。</p>
        <div className="feature-row">
          <span>真实鉴权<small>校验管理员账号密码</small></span>
          <span>Token 会话<small>后台接口自动携带 Bearer token</small></span>
          <span>数据库闭环<small>操作结果写入 PostgreSQL</small></span>
        </div>
        <div className="dashboard-preview"><aside><b>后台</b><span>文章</span><span>评论</span><span>媒体</span><span>设置</span></aside><div><StatsCard /><div className="chart-line" /></div></div>
        <div className="security-tip"><b>登录说明</b><span>默认账号由 backend/.env 的 ADMIN_DEFAULT_PASSWORD 和 seed 数据决定。</span></div>
      </section>
      <form className="login-card" onSubmit={submit}>
        <span className="brand-mark">站</span>
        <h2>登录后台</h2>
        <p>请输入管理员账号密码</p>
        <label>账号<input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="管理员账号或邮箱" autoComplete="username" /></label>
        <label>密码<span className="password-field"><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" type={showPassword ? "text" : "password"} autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "隐藏" : "查看"}</button></span></label>
        {error && <p className="form-notice">{error}</p>}
        <button className="primary" disabled={loading}>{loading ? "登录中..." : "登录管理后台"}</button>
        <div className="warning"><b>安全提示</b><span>管理接口必须带 Bearer token，未登录时后端会返回 401。</span></div>
      </form>
    </main>
  );
}

function AccountSecurityPage() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setNotice("请填写当前密码、新密码和确认密码。");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setNotice("两次输入的新密码不一致。");
      return;
    }
    if (form.newPassword.length < 8) {
      setNotice("新密码至少需要 8 位。");
      return;
    }
    setSaving(true);
    try {
      await api.changeAdminPassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setNotice("密码已修改。其它已登录会话会失效，当前会话继续可用。");
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminTop />
      <div className="admin-content admin-placeholder">
        <div className="title-row">
          <h1>账号安全</h1>
        </div>
        {notice && <p className="admin-hint">{notice}</p>}
        <section className="card security-config">
          <form className="settings-panel security-form" onSubmit={submit}>
            <header>
              <b>修改管理员密码</b>
              <span>系统不会保存明文密码，因此不能查看当前密码原文；这里只能查看你正在输入的新旧密码。</span>
            </header>
            <label>当前密码<span className="password-field"><input type={showPasswords ? "text" : "password"} value={form.currentPassword} onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" /><button type="button" onClick={() => setShowPasswords((value) => !value)}>{showPasswords ? "隐藏" : "查看"}</button></span></label>
            <label>新密码<span className="password-field"><input type={showPasswords ? "text" : "password"} value={form.newPassword} onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))} autoComplete="new-password" placeholder="至少 8 位" /><button type="button" onClick={() => setShowPasswords((value) => !value)}>{showPasswords ? "隐藏" : "查看"}</button></span></label>
            <label>确认新密码<span className="password-field"><input type={showPasswords ? "text" : "password"} value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} autoComplete="new-password" /><button type="button" onClick={() => setShowPasswords((value) => !value)}>{showPasswords ? "隐藏" : "查看"}</button></span></label>
            <button className="primary" disabled={saving}>{saving ? "保存中..." : "保存新密码"}</button>
          </form>
          <section className="settings-panel">
            <header>
              <b>为什么不能查看原密码</b>
              <span>后台只保存密码哈希，无法从数据库反推出原密码。这是正常且更安全的设计。</span>
            </header>
            <div className="import-help">
              <p>如果忘记密码，可以在服务器上通过环境变量或临时脚本重置管理员密码。</p>
              <p>修改密码后，请把新密码保存在你的密码管理器里，不要写进代码仓库。</p>
            </div>
          </section>
        </section>
      </div>
    </>
  );
}

const defaultAiSettings: AdminAiSettings = {
  hasApiKey: false,
  maskedApiKey: "",
  keySource: "none",
  qwenModel: "qwen-plus",
  qwenResponsesModel: "qwen-plus",
  webSearchEnabled: false,
  encryptedAtRest: false,
  encryptionAvailable: false,
};

function AiSettingsPage() {
  const [settings, setSettings] = useState<AdminAiSettings>(defaultAiSettings);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [clearApiKey, setClearApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    api.getAdminAiSettings()
      .then((result) => {
        if (alive) setSettings(result);
      })
      .catch((error) => {
        if (!alive) return;
        setNotice(getApiErrorMessage(error));
        if (getApiErrorMessage(error).includes("登录")) api.logout();
      });
    return () => {
      alive = false;
    };
  }, []);

  function updateField<K extends keyof AdminAiSettings>(key: K, value: AdminAiSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveAiSettings() {
    setSaving(true);
    setNotice("");
    try {
      const result = await api.updateAdminAiSettings({
        qwenApiKey: apiKey,
        clearApiKey,
        qwenModel: settings.qwenModel,
        qwenResponsesModel: settings.qwenResponsesModel,
        webSearchEnabled: settings.webSearchEnabled,
      });
      setSettings(result.item);
      setApiKey("");
      setClearApiKey(false);
      setNotice("AI 设置已保存。编辑器里的摘要、评论和润色会使用这份配置。");
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function testAiSettings() {
    setTesting(true);
    setNotice("");
    try {
      const result = await api.testAdminAiSettings();
      setNotice(`${result.message}${result.model ? `（${result.model}）` : ""}`);
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setTesting(false);
    }
  }

  const keySourceText = settings.keySource === "database" ? "后台数据库配置" : settings.keySource === "env" ? "服务器环境变量" : "未配置";

  return (
    <>
      <AdminTop />
      <div className="admin-content admin-placeholder">
        <div className="title-row">
          <h1>AI 设置</h1>
          <div className="title-actions"><button onClick={testAiSettings} disabled={testing || saving || !settings.hasApiKey}>{testing ? "测试中..." : "测试连接"}</button><button onClick={saveAiSettings} disabled={saving || testing}>{saving ? "保存中..." : "保存配置"}</button></div>
        </div>
        {notice && <p className="admin-hint">{notice}</p>}
        <section className="card ai-settings-config">
          <div className="settings-panel">
            <header>
              <b>千问 API Key</b>
              <span>只保存在后端，浏览器不会拿到明文；留空保存时表示不修改现有 Key。</span>
            </header>
            <div className="ai-key-status">
              <span className={settings.hasApiKey ? "ok" : "warn"}>{settings.hasApiKey ? "已配置" : "未配置"}</span>
              <b>{settings.maskedApiKey || "暂无 Key"}</b>
              <small>来源：{keySourceText}</small>
              <small>{settings.encryptedAtRest ? "数据库中已加密保存" : settings.encryptionAvailable ? "下次保存会加密入库" : "建议在服务器 .env 配置 SETTINGS_SECRET 以启用入库加密"}</small>
            </div>
            <label>API Key<span className="password-field"><input type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => { setApiKey(event.target.value); if (event.target.value) setClearApiKey(false); }} placeholder={settings.hasApiKey ? "留空表示不修改现有 Key" : "请输入 DashScope / 千问 API Key"} autoComplete="off" /><button type="button" onClick={() => setShowKey((value) => !value)}>{showKey ? "隐藏" : "查看"}</button></span></label>
            <label className="check ai-clear-key"><input type="checkbox" checked={clearApiKey} onChange={(event) => { setClearApiKey(event.target.checked); if (event.target.checked) setApiKey(""); }} />清空已保存的后台 Key</label>
          </div>
          <div className="settings-panel">
            <header>
              <b>模型与联网</b>
              <span>普通摘要/润色走 Chat Completions；AI 评论可选择启用百炼 web_search 工具。</span>
            </header>
            <div className="settings-grid">
              <label>普通模型<input value={settings.qwenModel} onChange={(event) => updateField("qwenModel", event.target.value)} placeholder="qwen-plus" /></label>
              <label>联网评论模型<input value={settings.qwenResponsesModel} onChange={(event) => updateField("qwenResponsesModel", event.target.value)} placeholder="qwen-plus" /></label>
              <label className="check ai-settings-switch"><input type="checkbox" checked={settings.webSearchEnabled} onChange={(event) => updateField("webSearchEnabled", event.target.checked)} />允许 AI 评论使用百炼联网搜索</label>
            </div>
          </div>
          <div className="settings-panel wide">
            <header>
              <b>安全说明</b>
              <span>推荐只在后台服务器调用模型，不要把 Key 写到前端代码、文章内容或公开接口。</span>
            </header>
            <div className="import-help">
              <p>后台配置优先级高于服务器环境变量；如果后台没有配置 Key，会自动兜底使用服务器 `.env` 中的 `DASHSCOPE_API_KEY` 或 `QWEN_API_KEY`。</p>
              <p>如需数据库加密保存，请在服务器 `.env` 增加长度至少 16 位的 `SETTINGS_SECRET`，保存一次 AI 设置后生效。</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

const adminRoutes: Record<string, { label: string; path: string }> = {
  dashboard: { label: "仪表盘", path: "/admin" },
  posts: { label: "文章管理", path: "/admin/posts" },
  drafts: { label: "草稿箱", path: "/admin/drafts" },
  trash: { label: "回收站", path: "/admin/trash" },
  categories: { label: "分类管理", path: "/admin/categories" },
  tags: { label: "标签管理", path: "/admin/tags" },
  comments: { label: "评论审核", path: "/admin/comments" },
  messages: { label: "留言管理", path: "/admin/messages" },
  media: { label: "媒体库", path: "/admin/media" },
  import: { label: "批量导入", path: "/admin/import" },
  about: { label: "关于页配置", path: "/admin/about-config" },
  home: { label: "首页配置", path: "/admin/home-config" },
  settings: { label: "站点设置", path: "/admin/settings" },
  ai: { label: "AI 设置", path: "/admin/ai-settings" },
  security: { label: "账号安全", path: "/admin/security" },
};

const adminRouteAliases: Record<string, string> = {
  "/admin/about": "about",
  "/admin/home": "home",
};

type AdminRow = {
  key: string;
  id: number;
  text: string;
  status: string;
  href: string;
  media?: AdminMediaItem;
  actions?: Array<{
    label: string;
    title?: string;
    href?: string;
    run?: () => void;
  }>;
  review?: {
    kind: "comment" | "message";
    id: number;
    status: string;
  };
};

const emptyDashboard: AdminDashboardData = {
  counts: { posts: 0, published: 0, draft: 0, scheduled: 0, archived: 0, pendingComments: 0, pendingMessages: 0, media: 0, categories: 0, tags: 0, views: 0, likes: 0, comments: 0 },
  hotPosts: [],
  pendingComments: [],
  pendingMessages: [],
  latestPosts: [],
  dailyStats: [],
  source: "mock",
};

function formatCompactNumber(value = 0) {
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(".0", "")}k` : String(value);
}

function getDefaultScheduledAt() {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())} ${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

function adminStatusText(status: string) {
  if (status === "published") return "已发布";
  if (status === "draft") return "草稿";
  if (status === "scheduled") return "定时";
  if (status === "archived") return "回收站";
  return status || "未知";
}

function looksLikeMojibake(value = "") {
  return /[ÃÂ�]|[åäæçèé][\u0080-\u00ff]/i.test(value);
}

function looksLikeGeneratedName(value = "") {
  const baseName = value.replace(/\.[a-z0-9]+$/i, "");
  return /^[a-f0-9-]{24,}$/i.test(baseName) || /^\d{10,}-[a-f0-9]{8,}$/i.test(baseName);
}

function mediaUrlFileName(url = "") {
  return decodeURIComponent(url.split("?")[0].split("/").pop() ?? "");
}

function cleanMediaText(value = "") {
  const text = value.trim();
  if (!text || looksLikeMojibake(text) || looksLikeGeneratedName(text)) return "";
  return text;
}

function mediaDisplayName(item: AdminMediaItem) {
  return cleanMediaText(item.altText ?? "") || cleanMediaText(item.originalName) || cleanMediaText(mediaUrlFileName(item.url)) || `媒体 #${item.id}`;
}

function mediaPreviewUrl(item: AdminMediaItem) {
  return sanitizeAssetUrl(item.thumbnailUrl) || sanitizeAssetUrl(item.displayUrl) || sanitizeAssetUrl(item.url);
}

function mediaDisplayUrl(item: AdminMediaItem) {
  return sanitizeAssetUrl(item.displayUrl) || sanitizeAssetUrl(item.thumbnailUrl) || sanitizeAssetUrl(item.url);
}

function mediaOriginalUrl(item: AdminMediaItem) {
  return sanitizeAssetUrl(item.url);
}

function safeSourceLinks(sources: Array<{ title: string; url: string }>) {
  return sources.map((source) => ({ ...source, url: sanitizeMarkdownUrl(source.url) })).filter((source) => source.url);
}

function siteMediaTargetLabel(target: "logoUrl" | "faviconUrl" | "defaultOgImageUrl") {
  if (target === "logoUrl") return "Logo";
  if (target === "faviconUrl") return "Favicon";
  return "默认分享图";
}

function isVideoMedia(item: AdminMediaItem) {
  return item.mimeType.startsWith("video/");
}

function formatMediaFileSize(value?: number) {
  if (!value) return "";
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1).replace(".0", "")} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function formatMediaCreatedAt(value?: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function mediaMetaText(item: AdminMediaItem) {
  const displayName = mediaDisplayName(item);
  const originalName = cleanMediaText(item.originalName);
  return [
    item.mimeType.replace(/^(image|video)\//, "").toUpperCase(),
    item.width && item.height ? `${item.width}x${item.height}` : "",
    formatMediaFileSize(item.fileSize),
    formatMediaCreatedAt(item.createdAt),
    originalName && originalName !== displayName ? originalName : "",
  ].filter(Boolean).join(" · ");
}

function compactMediaUrl(url = "") {
  const parts = url.split("/");
  if (parts.length >= 6) return `${parts.slice(0, 5).join("/")}/.../${parts[parts.length - 1]}`;
  return url;
}

const defaultAboutSettings: AboutPageSettings = {
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
  socials: [{ label: "GitHub", url: "https://github.com" }, { label: "掘金", url: "https://juejin.cn" }, { label: "知乎", url: "https://www.zhihu.com" }, { label: "Bilibili", url: "https://www.bilibili.com" }, { label: "微信公众号", url: "" }],
  writingTopics: ["后端开发", "前端开发", "全栈实践", "项目复盘", "算法与数据结构", "工具推荐", "成长思考", "面试总结"].map((label) => ({ label, url: `/posts?tag=${encodeURIComponent(label)}` })),
  timeline: [{ year: "2021", title: "计算机科学与技术 本科毕业", description: "在校期间热爱编程，参与多个项目开发。" }, { year: "2022", title: "全栈开发工程师", description: "参与企业级系统开发，积累全栈开发经验。" }, { year: "2023", title: "开始技术写作", description: "搭建个人博客，持续输出技术文章与教程。" }, { year: "2024", title: "独立开发 & 开源贡献", description: "发布开源项目，专注于自研与系统优化。" }],
  cooperateTitle: "欢迎交流与合作",
  cooperateText: "如果你有任何问题、建议，或者想一起交流技术，欢迎在留言板给我留言～",
  cooperateButtonText: "去留言",
  cooperateUrl: "/messages",
};

function AdminShell({ editor = false, page = "dashboard" }: { editor?: boolean; page?: string }) {
  const active = editor ? "文章管理" : adminRoutes[page]?.label ?? "仪表盘";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const content = editor ? <EditorPage /> : page === "dashboard" ? <DashboardPage /> : page === "settings" ? <SiteSettingsPage /> : page === "ai" ? <AiSettingsPage /> : page === "security" ? <AccountSecurityPage /> : page === "about" ? <AboutSettingsPage /> : page === "home" ? <HomeSettingsPage /> : page === "import" ? <ImportArticlesPage /> : <AdminPlaceholder page={page} />;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [active, editor, page]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  return <div className={`admin-app ${editor ? "admin-editor-app" : ""} ${mobileMenuOpen ? "admin-mobile-menu-open" : ""}`}>
    <header className="admin-mobile-bar">
      <button type="button" className="admin-mobile-menu-button" aria-label="打开后台菜单" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}>☰</button>
      <div>
        <strong>{active}</strong>
        <small>{editor ? "文章编辑" : "后台管理"}</small>
      </div>
      <button type="button" className="admin-mobile-new-button" aria-label="新建文章" onClick={() => go("/admin/editor")}>＋</button>
    </header>
    <AdminSidebar active={active} onNavigate={() => setMobileMenuOpen(false)} />
    {mobileMenuOpen && <button type="button" className="admin-mobile-backdrop" aria-label="关闭后台菜单" onClick={() => setMobileMenuOpen(false)} />}
    <section className="admin-main">{content}</section>
  </div>;
}

function AdminSidebar({ active, onNavigate }: { active: string; onNavigate?: () => void }) {
  const items = Object.values(adminRoutes);
  const [dashboard, setDashboard] = useState<AdminDashboardData>(emptyDashboard);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSiteSettings);
  useEffect(() => {
    let alive = true;
    function loadDashboard() {
      api.getDashboard()
      .then((result) => {
        if (alive) {
          setDashboard(result);
        }
      })
      .catch((error) => {
        if (!alive) return;
        const message = getApiErrorMessage(error);
        if (message.includes("登录")) api.logout();
      });
    }
    loadDashboard();
    window.addEventListener("admin-data-changed", loadDashboard);
    return () => {
      alive = false;
      window.removeEventListener("admin-data-changed", loadDashboard);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    function loadSiteSettings() {
      api.getPublicSiteSettings()
        .then((result) => {
          if (alive) setSiteSettings(result.item);
        })
        .catch(() => undefined);
    }
    loadSiteSettings();
    window.addEventListener("admin-data-changed", loadSiteSettings);
    return () => {
      alive = false;
      window.removeEventListener("admin-data-changed", loadSiteSettings);
    };
  }, []);
  function badge(label: string) {
    const count = label === "文章管理" ? dashboard.counts.posts
      : label === "草稿箱" ? dashboard.counts.draft
        : label === "回收站" ? dashboard.counts.archived
          : label === "分类管理" ? dashboard.counts.categories
            : label === "标签管理" ? dashboard.counts.tags
              : label === "评论审核" ? dashboard.counts.pendingComments
                : label === "留言管理" ? dashboard.counts.pendingMessages
                  : label === "媒体库" ? dashboard.counts.media
                    : 0;
    return count > 0 ? formatCompactNumber(count) : "";
  }
  function logoutAdmin() {
    api.logout();
    onNavigate?.();
    go("/admin/login");
  }
  return <aside className="admin-side"><Logo admin settings={siteSettings} /><nav>{items.map((item) => {
    const itemBadge = badge(item.label);
    return <button key={item.path} className={active === item.label ? "active" : ""} onClick={() => { onNavigate?.(); go(item.path); }}>{item.label}{itemBadge && <small>{itemBadge}</small>}</button>;
  })}</nav><div className="admin-user"><span className="avatar sm">管</span><span>管理员<small>超级管理员</small></span><button type="button" title="退出登录并使当前后端会话失效" onClick={logoutAdmin}>退出</button></div></aside>;
}

function AdminTop({ editor = false, editorTitle = "新建文章" }: { editor?: boolean; editorTitle?: string }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminSearchResults, setAdminSearchResults] = useState<AdminSearchItem[]>([]);
  const [adminSearchOpen, setAdminSearchOpen] = useState(false);
  const [adminSearchLoading, setAdminSearchLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    function loadPendingCount() {
      api.getDashboard()
        .then((result) => {
          if (alive) setPendingCount(result.counts.pendingComments + result.counts.pendingMessages);
        })
        .catch((error) => {
          if (alive && error instanceof Error && error.message.includes("登录")) api.logout();
        });
    }
    loadPendingCount();
    window.addEventListener("admin-data-changed", loadPendingCount);
    return () => {
      alive = false;
      window.removeEventListener("admin-data-changed", loadPendingCount);
    };
  }, []);
  useEffect(() => {
    const keyword = adminSearch.trim();
    if (!keyword) {
      setAdminSearchResults([]);
      setAdminSearchLoading(false);
      return;
    }
    let alive = true;
    setAdminSearchLoading(true);
    const timer = window.setTimeout(() => {
      api.searchAdmin(keyword)
        .then((result) => {
          if (alive) setAdminSearchResults(result.items);
        })
        .catch(() => {
          if (alive) setAdminSearchResults([]);
        })
        .finally(() => {
          if (alive) setAdminSearchLoading(false);
        });
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [adminSearch]);
  function submitAdminSearch(event: FormEvent) {
    event.preventDefault();
    setAdminSearchOpen(true);
  }
  function openAdminSearchItem(item: AdminSearchItem) {
    setAdminSearchOpen(false);
    setAdminSearch("");
    go(item.href);
  }
  return <header className="admin-top"><div>{editor ? `‹ 文章管理 / ${editorTitle}` : "欢迎回来，站长 👋"}</div><form className="search-mini admin-search" onSubmit={submitAdminSearch}><input value={adminSearch} onFocus={() => setAdminSearchOpen(true)} onChange={(event) => { setAdminSearch(event.target.value); setAdminSearchOpen(true); }} placeholder="搜索文章、分类、标签、媒体..." /><button aria-label="后台搜索">⌕</button>{adminSearchOpen && adminSearch.trim() && <div className="admin-search-panel">{adminSearchLoading ? <p>正在搜索...</p> : adminSearchResults.length ? adminSearchResults.map((item) => <button type="button" key={`${item.kind}-${item.href}-${item.title}`} onMouseDown={(event) => event.preventDefault()} onClick={() => openAdminSearchItem(item)}><b>{item.title}</b><small>{item.subtitle}</small></button>) : <p>没有找到相关结果</p>}</div>}</form><button className="bell">♧{pendingCount > 0 && <b>{formatCompactNumber(pendingCount)}</b>}</button><span className="avatar sm">站</span></header>;
}

function AdminPlaceholder({ page }: { page: string }) {
  const info = adminRoutes[page] ?? adminRoutes.dashboard;
  const dbPages = ["posts", "drafts", "trash", "media", "categories", "tags", "comments", "messages"];
  const [adminPosts, setAdminPosts] = useState<AdminPostListItem[]>([]);
  const [adminMedia, setAdminMedia] = useState<AdminMediaItem[]>([]);
  const [adminCategories, setAdminCategories] = useState<AdminCategoryItem[]>([]);
  const [adminTags, setAdminTags] = useState<AdminTagItem[]>([]);
  const [adminComments, setAdminComments] = useState<AdminCommentItem[]>([]);
  const [adminMessages, setAdminMessages] = useState<AdminMessageItem[]>([]);
  const [previewMedia, setPreviewMedia] = useState<AdminMediaItem | null>(null);
  const [source, setSource] = useState<"api" | "unimplemented">("api");
  const [loading, setLoading] = useState(dbPages.includes(page));
  const [actionNotice, setActionNotice] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [postPage, setPostPage] = useState(1);
  const [postPagination, setPostPagination] = useState({ page: 1, pageSize: ADMIN_LIST_PAGE_SIZE, total: 0, hasMore: false });
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "image" | "video">("all");
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaPagination, setMediaPagination] = useState({ page: 1, pageSize: ADMIN_MEDIA_PAGE_SIZE, total: 0, hasMore: false });
  const [moderationStatusFilter, setModerationStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [moderationSearch, setModerationSearch] = useState("");
  const [moderationPage, setModerationPage] = useState(1);
  const [moderationPagination, setModerationPagination] = useState({ page: 1, pageSize: ADMIN_LIST_PAGE_SIZE, total: 0, hasMore: false });
  const [mediaUploading, setMediaUploading] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPostPage(1);
    setModerationPage(1);
    setSelectedKeys([]);
  }, [page]);

  useEffect(() => {
    setModerationPage(1);
    setSelectedKeys([]);
  }, [moderationStatusFilter, moderationSearch]);

  useEffect(() => {
    setBatchMode(false);
    setSelectedKeys([]);
    let alive = true;
    async function load() {
      setLoading(dbPages.includes(page));
      setActionNotice("");
      try {
        if (page === "posts" || page === "drafts" || page === "trash") {
          const result = await api.getAdminPosts({ status: page === "drafts" ? "draft" : page === "trash" ? "archived" : undefined, page: postPage, pageSize: ADMIN_LIST_PAGE_SIZE });
          if (alive) {
            setAdminPosts(result.items);
            setPostPagination({ page: result.page, pageSize: result.pageSize, total: result.total, hasMore: result.hasMore });
            setSource(result.source);
            setLoading(false);
          }
        } else if (page === "media") {
          const result = await api.getAdminMedia({ page: mediaPage, pageSize: ADMIN_MEDIA_PAGE_SIZE, type: mediaTypeFilter, keyword: mediaSearch });
          if (alive) {
            setAdminMedia(result.items);
            setMediaPagination({ page: result.page, pageSize: result.pageSize, total: result.total, hasMore: result.hasMore });
            setSource(result.source);
            setLoading(false);
          }
        } else if (page === "categories") {
          const result = await api.getAdminCategories();
          if (alive) {
            setAdminCategories(result.items);
            setSource(result.source);
            setLoading(false);
          }
        } else if (page === "tags") {
          const result = await api.getAdminTags();
          if (alive) {
            setAdminTags(result.items);
            setSource(result.source);
            setLoading(false);
          }
        } else if (page === "comments") {
          const result = await api.getAdminComments({ page: moderationPage, pageSize: ADMIN_LIST_PAGE_SIZE, status: moderationStatusFilter, keyword: moderationSearch });
          if (alive) {
            setAdminComments(result.items);
            setModerationPagination({ page: result.page, pageSize: result.pageSize, total: result.total, hasMore: result.hasMore });
            setSource(result.source);
            setLoading(false);
          }
        } else if (page === "messages") {
          const result = await api.getAdminMessages({ page: moderationPage, pageSize: ADMIN_LIST_PAGE_SIZE, status: moderationStatusFilter, keyword: moderationSearch });
          if (alive) {
            setAdminMessages(result.items);
            setModerationPagination({ page: result.page, pageSize: result.pageSize, total: result.total, hasMore: result.hasMore });
            setSource(result.source);
            setLoading(false);
          }
        } else {
          setSource("unimplemented");
          setLoading(false);
          setActionNotice(`${info.label}尚未接入后端接口，当前不展示 mock 管理数据。`);
        }
      } catch (error) {
        if (!alive) return;
        setLoading(false);
        setSource("api");
        setActionNotice(getApiErrorMessage(error));
        if (getApiErrorMessage(error).includes("登录")) api.logout();
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [page, postPage, mediaPage, mediaTypeFilter, mediaSearch, moderationPage, moderationStatusFilter, moderationSearch]);

  async function reviewRow(kind: "comment" | "message", id: number, status: "approved" | "rejected") {
    try {
      if (kind === "comment") {
        const result = await api.reviewComment(id, status);
        setAdminComments((items) => items.map((item) => item.id === id ? { ...item, ...(result.item ?? {}), status: result.status } : item));
      } else {
        const result = await api.reviewMessage(id, status);
        setAdminMessages((items) => items.map((item) => item.id === id ? { ...item, ...(result.item ?? {}), status: result.status } : item));
      }
      setActionNotice("操作已写入数据库。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function replyToMessage(id: number) {
    const content = window.prompt("请输入站长回复内容");
    if (!content?.trim()) return;
    try {
      const result = await api.replyMessage(id, content.trim());
      setAdminMessages((items) => [result.item, ...items]);
      setActionNotice("站长回复已写入数据库，并会在留言板对应留言下展示。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function changePostStatus(id: number, status: "draft" | "published" | "scheduled" | "archived") {
    try {
      const result = await api.updatePostStatus(id, status);
      setAdminPosts((items) => items.map((item) => item.id === id ? { ...item, ...(result.item ?? {}), status: result.status } : item).filter((item) => page !== "drafts" || item.status === "draft").filter((item) => page !== "trash" || item.status === "archived").filter((item) => page !== "posts" || item.status !== "archived"));
      setActionNotice("文章状态已写入数据库。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function togglePostFeatured(id: number, isFeatured: boolean) {
    try {
      const result = await api.updatePostFeatured(id, isFeatured);
      setAdminPosts((items) => sortPostsForAdminList(items.map((item) => item.id === id ? { ...item, ...(result.item ?? {}), featured: result.isFeatured } : item)));
      setActionNotice(isFeatured ? "文章已设为精选，会进入前台精选列表。" : "文章已取消精选，前台精选列表不再优先展示。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function movePostFeatured(id: number, direction: "up" | "down") {
    try {
      const result = await api.updatePostFeaturedOrder(id, direction);
      const refreshed = await api.getAdminPosts({ status: page === "drafts" ? "draft" : page === "trash" ? "archived" : undefined, page: postPage, pageSize: ADMIN_LIST_PAGE_SIZE });
      setAdminPosts(sortPostsForAdminList(refreshed.items));
      setPostPagination({ page: refreshed.page, pageSize: refreshed.pageSize, total: refreshed.total, hasMore: refreshed.hasMore });
      setActionNotice(result.unchanged ? "这篇精选文章已经在当前方向的边界。" : "精选文章排序已更新，前台精选列表会按新顺序展示。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function duplicatePost(id: number) {
    try {
      const result = await api.duplicatePost(id);
      setAdminPosts((items) => sortPostsForAdminList([result.item, ...items]));
      setActionNotice("文章已复制为新草稿。");
      emitAdminDataChanged();
      go(`/admin/editor?id=${result.item.id}`);
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function deletePost(id: number) {
    try {
      await api.deletePost(id);
      setAdminPosts((items) => items.filter((item) => item.id !== id));
      setActionNotice(page === "trash" ? "文章已从数据库永久删除。" : "文章已移入回收站。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function uploadMediaFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || mediaUploading) return;
    const mediaFiles = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (!mediaFiles.length) {
      setActionNotice("请选择图片或视频文件。");
      return;
    }

    const uploaded: AdminMediaItem[] = [];
    const failed: string[] = [];
    setMediaUploading(true);
    try {
      for (const [index, file] of mediaFiles.entries()) {
        try {
          setActionNotice(`正在上传媒体 ${index + 1}/${mediaFiles.length}：${file.name}`);
          const result = await api.uploadMedia(file, file.name);
          uploaded.push(result.item);
        } catch (error) {
          failed.push(`${file.name}：${getApiErrorMessage(error)}`);
        }
      }
    } finally {
      setMediaUploading(false);
    }
    if (uploaded.length) {
      setMediaPage(1);
      setAdminMedia((items) => [...uploaded.reverse(), ...items]);
      setMediaPagination((current) => ({ ...current, page: 1, total: current.total + uploaded.length, hasMore: current.total + uploaded.length > current.pageSize }));
      setSource("api");
      emitAdminDataChanged();
    }
    const skipped = files.length - mediaFiles.length;
    const parts = [
      uploaded.length ? `已上传 ${uploaded.length} 个媒体文件` : "",
      failed.length ? `失败 ${failed.length} 个：${failed[0]}` : "",
      skipped ? `已跳过 ${skipped} 个非图片/视频文件` : "",
    ].filter(Boolean);
    setActionNotice(parts.join("；") || "没有上传媒体文件。");
  }

  async function updateMediaAlt(id: number, currentAltText = "") {
    const altText = window.prompt("请输入媒体说明（alt_text）", currentAltText);
    if (altText === null) return;
    try {
      const result = await api.updateMedia(id, altText.trim());
      setAdminMedia((items) => items.map((item) => item.id === id ? result.item : item));
      setActionNotice("媒体说明已更新到数据库。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function deleteMedia(id: number) {
    if (!window.confirm("确定删除这个媒体文件吗？数据库记录会删除，本地上传文件也会尝试删除。")) return;
    try {
      const result = await api.deleteMedia(id);
      setAdminMedia((items) => items.filter((item) => item.id !== result.id));
      setMediaPagination((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
      setActionNotice("媒体文件已从数据库删除。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function createCategory() {
    const name = window.prompt("请输入新分类名称");
    if (!name?.trim()) return;
    const description = window.prompt("请输入分类描述（可留空）") ?? "";
    try {
      const result = await api.createCategory({ name: name.trim(), description: description.trim() });
      setAdminCategories((items) => [...items, result.item]);
      setActionNotice("分类已写入数据库。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function updateCategory(item: AdminCategoryItem) {
    const name = window.prompt("请输入分类名称", item.name);
    if (!name?.trim()) return;
    const description = window.prompt("请输入分类描述（可留空）", item.description ?? "") ?? "";
    try {
      const result = await api.updateCategory(item.id, { name: name.trim(), slug: item.slug, description: description.trim(), icon: item.icon });
      setAdminCategories((items) => items.map((current) => current.id === item.id ? result.item : current));
      setActionNotice("分类已更新到数据库。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function deleteCategory(id: number) {
    if (!window.confirm("确定删除这个分类吗？仍有文章使用时后端会拒绝删除。")) return;
    try {
      const result = await api.deleteCategory(id);
      setAdminCategories((items) => items.filter((item) => item.id !== result.id));
      setActionNotice("分类已从数据库删除。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function createTag() {
    const name = window.prompt("请输入新标签名称");
    if (!name?.trim()) return;
    const color = window.prompt("请输入标签颜色（可留空，例如 #14b8a6）") ?? "";
    try {
      const result = await api.createTag({ name: name.trim(), color: color.trim() || undefined });
      setAdminTags((items) => [...items, result.item]);
      setActionNotice("标签已写入数据库。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function updateTag(item: AdminTagItem) {
    const name = window.prompt("请输入标签名称", item.name);
    if (!name?.trim()) return;
    const color = window.prompt("请输入标签颜色（可留空，例如 #14b8a6）", item.color ?? "") ?? "";
    try {
      const result = await api.updateTag(item.id, { name: name.trim(), slug: item.slug, color: color.trim() || undefined });
      setAdminTags((items) => items.map((current) => current.id === item.id ? result.item : current));
      setActionNotice("标签已更新到数据库。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function deleteTag(id: number) {
    if (!window.confirm("确定删除这个标签吗？仍有文章使用时后端会拒绝删除。")) return;
    try {
      const result = await api.deleteTag(id);
      setAdminTags((items) => items.filter((item) => item.id !== result.id));
      setActionNotice("标签已从数据库删除。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function deleteComment(id: number) {
    if (!window.confirm("确定删除这条评论吗？删除后不可恢复。")) return;
    try {
      const result = await api.deleteComment(id);
      setAdminComments((items) => items.filter((item) => item.id !== result.id));
      setActionNotice("评论已从数据库删除。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function toggleCommentVisibility(id: number, isVisible: boolean) {
    try {
      const result = await api.updateCommentVisibility(id, isVisible);
      if (result.item) setAdminComments((items) => items.map((item) => item.id === id ? { ...item, ...result.item } : item));
      setActionNotice(isVisible ? "评论已设为前台可见。" : "评论已隐藏，后台仍可管理。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  async function deleteMessage(id: number) {
    if (!window.confirm("确定删除这条留言吗？若它有回复，回复也会一起删除。")) return;
    try {
      const result = await api.deleteMessage(id);
      setAdminMessages((items) => items.filter((item) => item.id !== result.id && item.parentId !== result.id));
      setActionNotice("留言已从数据库删除。");
      emitAdminDataChanged();
    } catch (error) {
      setActionNotice(getApiErrorMessage(error));
    }
  }

  function setRowSelected(key: string, selected: boolean) {
    setSelectedKeys((keys) => selected ? [...new Set([...keys, key])] : keys.filter((item) => item !== key));
  }

  function postStatusLabel(status?: string) {
    if (status === "draft") return "草稿";
    if (status === "scheduled") return "定时";
    if (status === "archived") return "已归档";
    return "已发布";
  }

  function sortPostsForAdminList(items: AdminPostListItem[]) {
    return [...items].sort((a, b) => {
      const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      if (featuredDiff) return featuredDiff;
      if (a.featured && b.featured) return (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0);
      return 0;
    });
  }

  function reviewStatus(status: string) {
    if (status === "approved") return "已通过";
    if (status === "rejected") return "已驳回";
    return "待审核";
  }

  const filteredAdminMedia = adminMedia.filter((item) => {
    const matchType = mediaTypeFilter === "all" || (mediaTypeFilter === "image" ? item.mimeType.startsWith("image/") : item.mimeType.startsWith("video/"));
    const keyword = mediaSearch.trim().toLowerCase();
    const matchSearch = !keyword || [mediaDisplayName(item), item.originalName, item.fileName, item.altText ?? "", item.mimeType].join(" ").toLowerCase().includes(keyword);
    return matchType && matchSearch;
  });
  const moderationKeyword = moderationSearch.trim().toLowerCase();
  const filteredAdminComments = adminComments.filter((item) => {
    const matchStatus = moderationStatusFilter === "all" || item.status === moderationStatusFilter;
    const matchSearch = !moderationKeyword || [item.authorName, item.content, item.postTitle ?? ""].join(" ").toLowerCase().includes(moderationKeyword);
    return matchStatus && matchSearch;
  });
  const filteredAdminMessages = adminMessages.filter((item) => {
    const matchStatus = moderationStatusFilter === "all" || item.status === moderationStatusFilter;
    const matchSearch = !moderationKeyword || [item.authorName, item.content, item.role].join(" ").toLowerCase().includes(moderationKeyword);
    return matchStatus && matchSearch;
  });

  const rows: AdminRow[] = page === "posts" || page === "drafts" || page === "trash"
    ? adminPosts.map((item) => ({
        key: `post-${item.id}`,
        id: item.id,
        text: `${item.title} · ${item.date || "未发布"} · ${item.category}`,
        status: `${postStatusLabel(item.status)}${item.featured ? " · 精选" : ""}`,
        href: `/admin/editor?id=${item.id}`,
        actions: page === "trash"
          ? [
              { label: "恢复为草稿", title: "从回收站恢复，恢复后会进入草稿箱，不会直接公开显示", run: () => changePostStatus(item.id, "draft") },
              { label: "永久删除", title: "彻底清除文章及关联评论、章节、标签关系，删除后不可恢复", run: () => deletePost(item.id) },
            ]
          : [
              { label: "编辑", title: "打开编辑器修改这篇文章", href: `/admin/editor?id=${item.id}` },
              ...(item.status === "published" ? [{ label: "查看", title: "打开前台文章详情页", href: `/article/${item.id}` }] : []),
              ...(item.status === "published" ? [{ label: "下架为草稿", title: "前台不再展示，文章保留在草稿箱继续编辑", run: () => changePostStatus(item.id, "draft") }] : [{ label: "发布", title: "将草稿发布到前台公开显示", run: () => changePostStatus(item.id, "published") }]),
              { label: "复制", title: "复制文章内容、摘要、封面、分类和标签为一篇新草稿", run: () => duplicatePost(item.id) },
              { label: item.featured ? "取消精选" : "设为精选", title: item.featured ? "从前台精选文章列表移除" : "加入前台精选文章列表", run: () => togglePostFeatured(item.id, !item.featured) },
              ...(item.featured ? [
                { label: "上移精选", title: "提高这篇文章在前台精选列表中的展示顺序", run: () => movePostFeatured(item.id, "up") },
                { label: "下移精选", title: "降低这篇文章在前台精选列表中的展示顺序", run: () => movePostFeatured(item.id, "down") },
              ] : []),
              { label: "删除", title: "先移入回收站，之后可恢复或永久删除", run: () => deletePost(item.id) },
            ],
      }))
    : page === "media"
      ? filteredAdminMedia.map((item) => ({
          key: `media-${item.id}`,
          id: item.id,
          text: mediaDisplayName(item),
          status: compactMediaUrl(item.url),
          href: "",
          media: item,
          actions: [
            { label: "查看", title: isVideoMedia(item) ? "预览这个视频" : "预览这张图片", run: () => setPreviewMedia(item) },
            { label: "编辑说明", title: "更新媒体 alt_text，保存到 media_assets", run: () => updateMediaAlt(item.id, item.altText ?? "") },
            { label: "删除", title: "删除媒体数据库记录，并尝试删除本地上传文件", run: () => deleteMedia(item.id) },
          ],
        }))
        : page === "categories"
          ? adminCategories.map((item) => ({
              key: `category-${item.id}`,
              id: item.id,
              text: `${item.name} · ${item.slug}${item.description ? ` · ${item.description}` : ""}`,
              status: `${item.postsCount} 篇文章`,
              href: `/posts?category=${encodeURIComponent(item.name)}`,
              actions: [
                { label: "编辑", title: "修改分类名称和描述，保存到 categories", run: () => updateCategory(item) },
                { label: "删除", title: "删除未被文章使用的分类", run: () => deleteCategory(item.id) },
              ],
            }))
        : page === "tags"
          ? adminTags.map((item) => ({
              key: `tag-${item.id}`,
              id: item.id,
              text: `${item.name} · ${item.slug}${item.color ? ` · ${item.color}` : ""}`,
              status: `${item.postsCount} 篇文章`,
              href: `/posts?tag=${encodeURIComponent(item.name)}`,
              actions: [
                { label: "编辑", title: "修改标签名称和颜色，保存到 tags", run: () => updateTag(item) },
                { label: "删除", title: "删除未被文章使用的标签", run: () => deleteTag(item.id) },
              ],
            }))
          : page === "comments"
            ? filteredAdminComments.map((item) => ({
                key: `comment-${item.id}`,
                id: item.id,
                text: `${item.authorName} · ${item.content}${item.postTitle ? ` · ${item.postTitle}` : ""}`,
                status: `${reviewStatus(item.status)} · ${item.isVisible ? "前台可见" : "已隐藏"}${item.source === "admin_import" ? " · 导入" : ""}`,
                href: "",
                actions: [
                  { label: item.isVisible ? "隐藏" : "显示", title: item.isVisible ? "后台保留，但前台不再展示这条评论" : "允许前台展示这条已通过评论", run: () => toggleCommentVisibility(item.id, !item.isVisible) },
                  { label: "删除", title: "删除这条评论，保存到 comments", run: () => deleteComment(item.id) },
                ],
                review: { kind: "comment" as const, id: item.id, status: item.status },
              }))
            : page === "messages"
              ? filteredAdminMessages.map((item) => ({
                  key: `message-${item.id}`,
                  id: item.id,
                  text: `${item.parentId ? "回复" : "留言"} · ${item.authorName} · ${item.content}`,
                  status: reviewStatus(item.status),
                  href: "",
                  actions: [
                    ...(!item.parentId ? [{ label: "站长回复", title: "给这条留言写入一条站长回复，保存到 messages.parent_id", run: () => replyToMessage(item.id) }] : []),
                    { label: "删除", title: item.parentId ? "删除这条留言回复" : "删除这条留言及其回复", run: () => deleteMessage(item.id) },
                  ],
                  review: { kind: "message" as const, id: item.id, status: item.status },
                }))
              : [];
  const selectedRows = rows.filter((row) => selectedKeys.includes(row.key));
  const allRowsSelected = rows.length > 0 && selectedRows.length === rows.length;
  const mediaHasActiveFilter = page === "media" && (mediaTypeFilter !== "all" || Boolean(mediaSearch.trim()));
  const emptyText = page === "media" && mediaHasActiveFilter ? "当前筛选下暂无媒体，试试清空搜索或切换类型。" : `暂无${info.label}数据。`;
  const batchActions = page === "posts"
    ? [{ label: "批量设精选", danger: false, run: () => batchChangePostFeatured(true) }, { label: "批量取消精选", danger: false, run: () => batchChangePostFeatured(false) }, { label: "批量下架", danger: false, run: () => batchChangePostStatus("draft") }, { label: "批量移入回收站", danger: true, run: () => batchDeletePosts() }]
    : page === "drafts"
      ? [{ label: "批量设精选", danger: false, run: () => batchChangePostFeatured(true) }, { label: "批量取消精选", danger: false, run: () => batchChangePostFeatured(false) }, { label: "批量发布", danger: false, run: () => batchChangePostStatus("published") }, { label: "批量移入回收站", danger: true, run: () => batchDeletePosts() }]
      : page === "trash"
        ? [{ label: "批量恢复为草稿", danger: false, run: () => batchChangePostStatus("draft") }, { label: "批量永久删除", danger: true, run: () => batchDeletePosts(true) }]
        : page === "media"
          ? [{ label: "批量删除媒体", danger: true, run: () => batchDeleteMedia() }]
          : page === "categories"
            ? [{ label: "批量删除分类", danger: true, run: () => batchDeleteCategories() }]
            : page === "tags"
              ? [{ label: "批量删除标签", danger: true, run: () => batchDeleteTags() }]
              : page === "comments"
                ? [{ label: "批量通过", danger: false, run: () => batchReview("comment", "approved") }, { label: "批量驳回", danger: false, run: () => batchReview("comment", "rejected") }, { label: "批量显示", danger: false, run: () => batchChangeCommentVisibility(true) }, { label: "批量隐藏", danger: false, run: () => batchChangeCommentVisibility(false) }, { label: "批量删除", danger: true, run: () => batchDeleteComments() }]
                : page === "messages"
                  ? [{ label: "批量通过", danger: false, run: () => batchReview("message", "approved") }, { label: "批量驳回", danger: false, run: () => batchReview("message", "rejected") }, { label: "批量删除", danger: true, run: () => batchDeleteMessages() }]
                  : [];

  async function runBatch(label: string, runner: (row: AdminRow) => Promise<void>) {
    if (!selectedRows.length) return;
    const failures: string[] = [];
    setActionNotice(`正在${label} ${selectedRows.length} 项...`);
    for (const row of selectedRows) {
      try {
        await runner(row);
      } catch (error) {
        failures.push(`${row.text}：${getApiErrorMessage(error)}`);
      }
    }
    setSelectedKeys((keys) => keys.filter((key) => failures.some((failure) => rows.find((row) => row.key === key && failure.startsWith(row.text)))));
    setActionNotice(failures.length ? `${label}完成，成功 ${selectedRows.length - failures.length} 项，失败 ${failures.length} 项。${failures[0]}` : `${label}完成，已处理 ${selectedRows.length} 项。`);
    emitAdminDataChanged();
  }

  function batchChangePostStatus(status: "draft" | "published" | "scheduled" | "archived") {
    const label = status === "published" ? "批量发布" : "批量恢复/下架";
    runBatch(label, async (row) => {
      const result = await api.updatePostStatus(row.id, status);
      setAdminPosts((items) => items.map((item) => item.id === row.id ? { ...item, ...(result.item ?? {}), status: result.status } : item).filter((item) => page !== "drafts" || item.status === "draft").filter((item) => page !== "trash" || item.status === "archived").filter((item) => page !== "posts" || item.status !== "archived"));
    });
  }

  function batchChangePostFeatured(isFeatured: boolean) {
    const label = isFeatured ? "批量设精选" : "批量取消精选";
    runBatch(label, async (row) => {
      const result = await api.updatePostFeatured(row.id, isFeatured);
      setAdminPosts((items) => sortPostsForAdminList(items.map((item) => item.id === row.id ? { ...item, ...(result.item ?? {}), featured: result.isFeatured } : item)));
    });
  }

  function batchDeletePosts(permanent = false) {
    const message = permanent ? `确定永久删除选中的 ${selectedRows.length} 篇文章吗？删除后不可恢复。` : `确定将选中的 ${selectedRows.length} 篇文章移入回收站吗？`;
    if (!window.confirm(message)) return;
    runBatch(permanent ? "批量永久删除" : "批量移入回收站", async (row) => {
      await api.deletePost(row.id);
      setAdminPosts((items) => items.filter((item) => item.id !== row.id));
    });
  }

  function batchDeleteMedia() {
    if (!window.confirm(`确定删除选中的 ${selectedRows.length} 个媒体文件吗？`)) return;
    runBatch("批量删除媒体", async (row) => {
      const result = await api.deleteMedia(row.id);
      setAdminMedia((items) => items.filter((item) => item.id !== result.id));
      setMediaPagination((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
    });
  }

  function batchDeleteCategories() {
    if (!window.confirm(`确定删除选中的 ${selectedRows.length} 个分类吗？仍有文章使用时后端会拒绝删除。`)) return;
    runBatch("批量删除分类", async (row) => {
      const result = await api.deleteCategory(row.id);
      setAdminCategories((items) => items.filter((item) => item.id !== result.id));
    });
  }

  function batchDeleteTags() {
    if (!window.confirm(`确定删除选中的 ${selectedRows.length} 个标签吗？仍有文章使用时后端会拒绝删除。`)) return;
    runBatch("批量删除标签", async (row) => {
      const result = await api.deleteTag(row.id);
      setAdminTags((items) => items.filter((item) => item.id !== result.id));
    });
  }

  function batchDeleteComments() {
    if (!window.confirm(`确定删除选中的 ${selectedRows.length} 条评论吗？删除后不可恢复。`)) return;
    runBatch("批量删除评论", async (row) => {
      const result = await api.deleteComment(row.id);
      setAdminComments((items) => items.filter((item) => item.id !== result.id));
    });
  }

  function batchChangeCommentVisibility(isVisible: boolean) {
    runBatch(isVisible ? "批量显示评论" : "批量隐藏评论", async (row) => {
      const result = await api.updateCommentVisibility(row.id, isVisible);
      if (result.item) setAdminComments((items) => items.map((item) => item.id === row.id ? { ...item, ...result.item } : item));
    });
  }

  function batchDeleteMessages() {
    if (!window.confirm(`确定删除选中的 ${selectedRows.length} 条留言吗？父留言的回复会一起删除。`)) return;
    runBatch("批量删除留言", async (row) => {
      const result = await api.deleteMessage(row.id);
      setAdminMessages((items) => items.filter((item) => item.id !== result.id && item.parentId !== result.id));
    });
  }

  function batchReview(kind: "comment" | "message", status: "approved" | "rejected") {
    const label = status === "approved" ? "批量通过" : "批量驳回";
    runBatch(label, async (row) => {
      if (kind === "comment") {
        const result = await api.reviewComment(row.id, status);
        setAdminComments((items) => items.map((item) => item.id === row.id ? { ...item, ...(result.item ?? {}), status: result.status } : item));
      } else {
        const result = await api.reviewMessage(row.id, status);
        setAdminMessages((items) => items.map((item) => item.id === row.id ? { ...item, ...(result.item ?? {}), status: result.status } : item));
      }
    });
  }
  const postPageHint = page === "trash"
    ? "回收站里的文章不会在前台显示。点“恢复为草稿”可找回，点“永久删除”会彻底清除。"
    : page === "drafts"
      ? "草稿箱保存未公开文章。点“发布”后才会在前台显示，点“删除”会先进入回收站。"
      : page === "posts"
        ? "文章管理显示非回收站文章。点“删除”只是移入回收站，不会立即清除。"
        : "";

  return (
    <>
      <AdminTop />
      <div className="admin-content admin-placeholder">
        <div className="title-row">
          <h1>{info.label}</h1>
          {(page === "posts" || page === "drafts" || page === "trash") && <div className="title-actions"><button title="创建一篇新文章" onClick={() => go("/admin/editor")}>＋ 新建文章</button><button title="查看还没有公开发布的文章" onClick={() => go("/admin/drafts")}>草稿箱</button><button title="查看已删除但还可以恢复的文章" onClick={() => go("/admin/trash")}>回收站</button></div>}
          {page === "categories" && <div className="title-actions"><button title="新增分类并写入 categories 表" onClick={createCategory}>＋ 新建分类</button></div>}
          {page === "tags" && <div className="title-actions"><button title="新增标签并写入 tags 表" onClick={createTag}>＋ 新建标签</button></div>}
        </div>
        {postPageHint && <p className="admin-hint">{postPageHint}</p>}
        {actionNotice && <p className="admin-hint">{actionNotice}</p>}
        {page === "media" && (
          <div className="admin-hint media-upload-strip">
            <button type="button" disabled={mediaUploading} onClick={() => mediaInputRef.current?.click()}>{mediaUploading ? "上传中..." : "上传媒体"}</button>
            <span>可一次选择多张图片或视频；上传后会写入 media_assets，并可作为文章封面使用。</span>
            <input ref={mediaInputRef} className="visually-hidden" type="file" accept="image/*,video/*" multiple onChange={uploadMediaFile} />
          </div>
        )}
        {page === "media" && (
          <div className="media-filter-bar">
            <div className="media-type-tabs" aria-label="媒体类型筛选">
              {[
                ["all", "全部"],
                ["image", "图片"],
                ["video", "视频"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={mediaTypeFilter === value ? "active" : ""}
                  onClick={() => { setMediaTypeFilter(value as "all" | "image" | "video"); setMediaPage(1); setSelectedKeys([]); }}
                >
                  {label}
                </button>
              ))}
            </div>
            <label>
              <span className="visually-hidden">搜索媒体</span>
              <input value={mediaSearch} onChange={(event) => { setMediaSearch(event.target.value); setMediaPage(1); setSelectedKeys([]); }} placeholder="搜索文件名、说明或类型" />
            </label>
            {mediaHasActiveFilter && <button type="button" className="media-clear-filter" onClick={() => { setMediaTypeFilter("all"); setMediaSearch(""); setMediaPage(1); setSelectedKeys([]); }}>清空</button>}
          </div>
        )}
        {(page === "comments" || page === "messages") && (
          <div className="moderation-filter-bar">
            <div className="media-type-tabs" aria-label="审核状态筛选">
              {[
                ["all", "全部"],
                ["pending", "待审核"],
                ["approved", "已通过"],
                ["rejected", "已驳回"],
              ].map(([value, label]) => (
                <button key={value} type="button" className={moderationStatusFilter === value ? "active" : ""} onClick={() => { setModerationStatusFilter(value as "all" | "pending" | "approved" | "rejected"); setModerationPage(1); setSelectedKeys([]); }}>
                  {label}
                </button>
              ))}
            </div>
            <label>
              <span className="visually-hidden">搜索审核内容</span>
              <input value={moderationSearch} onChange={(event) => { setModerationSearch(event.target.value); setModerationPage(1); setSelectedKeys([]); }} placeholder={page === "comments" ? "搜索评论作者、内容或文章标题" : "搜索留言作者、内容或角色"} />
            </label>
            {(moderationStatusFilter !== "all" || moderationSearch.trim()) && <button type="button" className="media-clear-filter" onClick={() => { setModerationStatusFilter("all"); setModerationSearch(""); setModerationPage(1); setSelectedKeys([]); }}>清空</button>}
          </div>
        )}
        <section className="card admin-table">
          <header>
            <div>
              <b>{info.label} {source === "api" ? "数据库列表" : "未接入"}</b>
              <span>{source === "api" ? "当前列表来自本地 PostgreSQL 后端。" : "该后台模块还没有对应后端接口，已隐藏前端假数据。"}</span>
            </div>
            {!loading && rows.length > 0 && !batchMode && <button className="table-batch-button" onClick={() => setBatchMode(true)}>批量选择</button>}
          </header>
          {!loading && rows.length > 0 && batchMode && (
            <div className="batch-toolbar">
              <label><input type="checkbox" checked={allRowsSelected} onChange={(event) => setSelectedKeys(event.target.checked ? rows.map((row) => row.key) : [])} />全选</label>
              <span>已选 {selectedRows.length} 项</span>
              <div>
                {batchActions.map((action) => <button key={action.label} className={action.danger ? "danger" : ""} disabled={!selectedRows.length} onClick={action.run}>{action.label}</button>)}
                {selectedRows.length > 0 && <button onClick={() => setSelectedKeys([])}>取消选择</button>}
                <button onClick={() => { setBatchMode(false); setSelectedKeys([]); }}>退出批量</button>
              </div>
            </div>
          )}
          {loading ? <p className="soft-text">正在读取数据...</p> : rows.length ? rows.map((row) => <div className={`admin-row ${row.href ? "clickable" : ""} ${row.media ? "media-row" : ""} ${selectedKeys.includes(row.key) ? "selected" : ""}`} key={row.key} onClick={() => row.href && go(row.href)}>{batchMode && <label className="row-check" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedKeys.includes(row.key)} onChange={(event) => setRowSelected(row.key, event.target.checked)} /><span className="visually-hidden">选择 {row.text}</span></label>}{row.media && <button className={`media-thumb ${isVideoMedia(row.media) ? "video-thumb" : ""}`} type="button" style={isVideoMedia(row.media) ? undefined : { backgroundImage: `url(${mediaPreviewUrl(row.media)})` }} onClick={(event) => { event.stopPropagation(); setPreviewMedia(row.media!); }} aria-label={`查看 ${row.text}`}>{isVideoMedia(row.media) && <><video src={mediaOriginalUrl(row.media)} muted preload="metadata" /><span>视频</span></>}</button>}{row.media ? <span className="media-text"><b>{row.text}</b><small>{mediaMetaText(row.media)}</small></span> : <span>{row.text}</span>}<div className="admin-row-actions"><small>{row.status}</small>{row.actions?.map((action) => <button key={action.label} title={action.title} onClick={(event) => { event.stopPropagation(); if (action.href) go(action.href); action.run?.(); }}>{action.label}</button>)}{row.review && row.review.status !== "approved" && <button onClick={(event) => { event.stopPropagation(); reviewRow(row.review!.kind, row.review!.id, "approved"); }}>通过</button>}{row.review && row.review.status !== "rejected" && <button onClick={(event) => { event.stopPropagation(); reviewRow(row.review!.kind, row.review!.id, "rejected"); }}>驳回</button>}</div></div>) : <p className="soft-text">{emptyText}</p>}
          {(page === "posts" || page === "drafts" || page === "trash") && !loading && (
            <div className="admin-pagination">
              <button disabled={postPage <= 1} onClick={() => { setPostPage((value) => Math.max(1, value - 1)); setSelectedKeys([]); }}>上一页</button>
              <span>第 {postPagination.page} 页 · 共 {postPagination.total} 篇文章</span>
              <button disabled={!postPagination.hasMore} onClick={() => { setPostPage((value) => value + 1); setSelectedKeys([]); }}>下一页</button>
            </div>
          )}
          {page === "media" && !loading && (
            <div className="admin-pagination">
              <button disabled={mediaPage <= 1} onClick={() => { setMediaPage((value) => Math.max(1, value - 1)); setSelectedKeys([]); }}>上一页</button>
              <span>第 {mediaPagination.page} 页 · 共 {mediaPagination.total} 个媒体</span>
              <button disabled={!mediaPagination.hasMore} onClick={() => { setMediaPage((value) => value + 1); setSelectedKeys([]); }}>下一页</button>
            </div>
          )}
          {(page === "comments" || page === "messages") && !loading && (
            <div className="admin-pagination">
              <button disabled={moderationPage <= 1} onClick={() => { setModerationPage((value) => Math.max(1, value - 1)); setSelectedKeys([]); }}>上一页</button>
              <span>第 {moderationPagination.page} 页 · 共 {moderationPagination.total} 条{page === "comments" ? "评论" : "留言"}</span>
              <button disabled={!moderationPagination.hasMore} onClick={() => { setModerationPage((value) => value + 1); setSelectedKeys([]); }}>下一页</button>
            </div>
          )}
        </section>
        {previewMedia && (
          <div className="media-modal" role="dialog" aria-modal="true" aria-label={isVideoMedia(previewMedia) ? "视频预览" : "图片预览"} onClick={() => setPreviewMedia(null)}>
            <div className="media-modal-panel" onClick={(event) => event.stopPropagation()}>
              <header><b>{previewMedia.originalName}</b><button type="button" onClick={() => setPreviewMedia(null)}>关闭</button></header>
              {isVideoMedia(previewMedia)
                ? <video className="media-preview-video" src={mediaOriginalUrl(previewMedia)} controls preload="metadata" />
                : <img src={mediaDisplayUrl(previewMedia)} alt={previewMedia.altText || previewMedia.originalName} />}
              <p>{mediaMetaText(previewMedia)}</p>
              <p>{previewMedia.url}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function DashboardPage() {
  const [metric, setMetric] = useState("PV");
  const [dashboard, setDashboard] = useState<AdminDashboardData>(emptyDashboard);
  const [dashboardNotice, setDashboardNotice] = useState("");
  const quickActions: Record<string, string> = { "新建文章": "/admin/editor", "写草稿": "/admin/editor?status=draft", "上传图片": "/admin/media", "管理分类": "/admin/categories", "管理标签": "/admin/tags", "站点设置": "/admin/settings" };
  useEffect(() => {
    let alive = true;
    function loadDashboard() {
      api.getDashboard()
        .then((result) => {
          if (alive) {
            setDashboard(result);
            setDashboardNotice("");
          }
        })
        .catch((error) => {
          if (!alive) return;
          const message = getApiErrorMessage(error);
          setDashboardNotice(message);
          if (message.includes("登录")) api.logout();
        });
    }
    loadDashboard();
    window.addEventListener("admin-data-changed", loadDashboard);
    return () => {
      alive = false;
      window.removeEventListener("admin-data-changed", loadDashboard);
    };
  }, []);
  const trendValues = dashboard.dailyStats.map((item) => metric === "PV" ? item.pv : item.uv);
  const maxTrendValue = Math.max(1, ...trendValues);
  const chartData = dashboard.dailyStats.map((item) => {
    const value = metric === "PV" ? item.pv : item.uv;
    return {
      date: item.date,
      value,
      height: Math.max(8, (value / maxTrendValue) * 86),
    };
  });
  const dashboardCards = [
    ["文章总数", formatCompactNumber(dashboard.counts.posts), `${dashboard.counts.published} 已发布 / ${dashboard.counts.draft} 草稿`, "doc"],
    ["访问量", formatCompactNumber(dashboard.counts.views), `近 7 天 ${formatCompactNumber(trendValues.reduce((sum, value) => sum + value, 0))}`, "eye"],
    ["评论数", formatCompactNumber(dashboard.counts.comments), `${dashboard.counts.pendingComments} 条待审核`, "comment"],
    ["待处理留言", formatCompactNumber(dashboard.counts.pendingMessages), "留言板待审核", "mail"],
    ["点赞数", formatCompactNumber(dashboard.counts.likes), "累计互动", "like"],
  ] as const;
  const statusTotal = Math.max(1, dashboard.counts.published + dashboard.counts.draft + dashboard.counts.scheduled + dashboard.counts.archived);
  const percent = (value: number) => `${((value / statusTotal) * 100).toFixed(1)}%`;
  const latestActivity = [
    ...dashboard.latestPosts.map((item) => `${adminStatusText(item.status)}文章《${item.title}》`),
    ...(dashboard.counts.pendingComments ? [`有 ${dashboard.counts.pendingComments} 条评论待审核`] : []),
    ...(dashboard.counts.pendingMessages ? [`有 ${dashboard.counts.pendingMessages} 条留言待审核`] : []),
  ].slice(0, 5);
  const dashboardConnected = dashboard.source === "api" && !dashboardNotice;
  return (
    <>
      <AdminTop />
      <div className="admin-content">
        {dashboardNotice && <p className="admin-hint">{dashboardNotice}</p>}
        <div className="title-row">
          <h1>站点数据</h1>
          <button onClick={() => go("/admin/editor")}>✎ 新建文章</button>
        </div>
        <div className="admin-stats">
          {dashboardCards.map(([title, value, sub, icon]) => (
            <section className="admin-stat card" key={title}>
              <Icon name={icon} />
              <span>{title}</span>
              <b>{value}</b>
              <small>{sub}</small>
            </section>
          ))}
        </div>
        <div className="left-stack">
          <section className="chart card">
            <header><h3>访问趋势</h3><select><option>近 7 天</option></select></header>
            <div className="seg"><button className={metric === "PV" ? "active" : ""} onClick={() => setMetric("PV")}>PV</button><button className={metric === "UV" ? "active" : ""} onClick={() => setMetric("UV")}>UV</button></div>
            <div className="line-chart">
              {chartData.length ? chartData.map((item, index) => (
                <i key={item.date} style={{ height: `${item.height}%` }} title={`${item.date} ${metric}: ${item.value}`}>
                  <b>{index === chartData.length - 1 ? formatCompactNumber(item.value) : ""}</b>
                </i>
              )) : <p className="soft-text chart-empty">暂无近 7 天趋势数据</p>}
            </div>
          </section>
          <section className="activity card">
            <h3>最新动态</h3>
            {latestActivity.length ? latestActivity.map((x, index) => <p key={`${index}-${x}`}><span>{x}</span><time>刚刚同步</time></p>) : <p className="soft-text">暂无最新动态</p>}
            <button className="text-link" onClick={() => go("/admin")}>查看全部动态 →</button>
          </section>
        </div>
        <div className="middle-stack">
          <section className="donut card">
            <h3>内容状态概览</h3>
            <div className="donut-ring"><b>{dashboard.counts.posts + dashboard.counts.archived}<small>总计</small></b></div>
            <p>● 已发布　{dashboard.counts.published} ({percent(dashboard.counts.published)})</p>
            <p>● 草稿　{dashboard.counts.draft} ({percent(dashboard.counts.draft)})</p>
            <p>● 定时发布　{dashboard.counts.scheduled} ({percent(dashboard.counts.scheduled)})</p>
            <p>● 回收站　{dashboard.counts.archived} ({percent(dashboard.counts.archived)})</p>
          </section>
          <section className="site-status card">
            <h3>站点运行状态</h3>
            <div><b>数据来源</b><span>{dashboardConnected ? "本地 PostgreSQL" : "后端不可用，未展示 mock 数据"}</span></div>
            <div><b>后端接口</b><span>127.0.0.1:8000/api</span></div>
            <div><b>联调状态</b><span>{dashboardConnected ? "已连接" : "后端不可用"}</span></div>
          </section>
          <section className="hot card">
            <h3>热门文章</h3>
            {dashboard.hotPosts.length ? dashboard.hotPosts.map((a, i) => <p key={a.id}><b>{i + 1}</b>{a.title}<span>◎ {formatCompactNumber(a.viewsCount)}</span></p>) : <p className="soft-text">暂无热门文章</p>}
            <button className="text-link" onClick={() => go("/admin/posts")}>查看全部文章 →</button>
          </section>
        </div>
        <div className="right-stack">
          <section className="review card">
            <h3>待审核</h3>
            <MiniComments items={dashboard.pendingComments} />
            <button className="text-link" onClick={() => go("/admin/comments")}>查看全部评论 →</button>
          </section>
          <section className="pending card">
            <h3>留言板待处理</h3>
            {dashboard.pendingMessages.length ? dashboard.pendingMessages.map((item) => <p key={item.id}><b>{item.authorName}</b><span>{item.createdAt?.slice(0, 10) ?? "刚刚"}</span><small>{item.content}</small></p>) : <p className="soft-text">暂无待处理留言</p>}
            <button className="text-link" onClick={() => go("/admin/messages")}>查看全部留言 →</button>
          </section>
          <section className="quick card">
            <h3>快捷操作</h3>
            {Object.entries(quickActions).map(([label, href]) => <button key={label} onClick={() => go(href)}>{label}</button>)}
          </section>
        </div>
      </div>
    </>
  );
}

type MarkdownRenderOptions = {
  onImageClick?: (src: string, alt: string) => void;
};

function renderInlineMarkdown(text: string, keyPrefix: string, options: MarkdownRenderOptions = {}) {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith("![")) {
      const image = token.match(/^!\[([^\]]*)]\(([^)]+)\)$/);
      const safeImageUrl = image ? sanitizeAssetUrl(image[2]) : "";
      nodes.push(image && safeImageUrl ? (
        options.onImageClick
          ? <button className="markdown-image-button" key={key} type="button" onClick={() => options.onImageClick?.(safeImageUrl, image[1])}><img className="preview-inline-image" src={safeImageUrl} alt={image[1]} /></button>
          : <img className="preview-inline-image" key={key} src={safeImageUrl} alt={image[1]} />
      ) : token);
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)]\(([^)]+)\)$/);
      const safeLinkUrl = link ? sanitizeMarkdownUrl(link[2]) : "";
      nodes.push(link && safeLinkUrl ? <a key={key} href={safeLinkUrl} target="_blank" rel="noreferrer">{link[1]}</a> : link ? <span key={key}>{link[1]}</span> : token);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function isMarkdownTableStart(lines: string[], index: number) {
  return /^\s*\|.+\|\s*$/.test(lines[index] ?? "") && /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[index + 1] ?? "");
}

function collectMarkdownTable(lines: string[], startIndex: number, keyPrefix: string, options: MarkdownRenderOptions = {}) {
  const headers = lines[startIndex].split("|").slice(1, -1).map((cell) => cell.trim());
  const rows: string[][] = [];
  let index = startIndex + 2;
  while (index < lines.length && /^\s*\|.+\|\s*$/.test(lines[index])) {
    rows.push(lines[index].split("|").slice(1, -1).map((cell) => cell.trim()));
    index += 1;
  }
  return {
    nextIndex: index - 1,
    node: (
      <div className="markdown-table-scroll" key={`${keyPrefix}-table-${startIndex}`}>
        <table className="preview-table">
          <thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{renderInlineMarkdown(cell, `${keyPrefix}-th-${startIndex}-${cellIndex}`, options)}</th>)}</tr></thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{renderInlineMarkdown(cell, `${keyPrefix}-td-${startIndex}-${rowIndex}-${cellIndex}`, options)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    ),
  };
}

function renderArticleMarkdown(markdown: string, keyPrefix: string, options: MarkdownRenderOptions = {}) {
  const blocks: ReactNode[] = [];
  const lines = markdown.split("\n");
  let inCode = false;
  let code: string[] = [];
  let codeLanguage = "";
  let list: ReactNode[] = [];
  let orderedList: ReactNode[] = [];
  let orderedListStart = 1;
  let checklist: ReactNode[] = [];

  function flushList(index: number) {
    if (list.length) {
      blocks.push(<ul className="markdown-list" key={`${keyPrefix}-list-${index}`}>{list}</ul>);
      list = [];
    }
    if (orderedList.length) {
      blocks.push(<ol className="markdown-list markdown-ordered-list" start={orderedListStart} key={`${keyPrefix}-ordered-list-${index}`}>{orderedList}</ol>);
      orderedList = [];
      orderedListStart = 1;
    }
    if (checklist.length) {
      blocks.push(<div className="markdown-checklist" key={`${keyPrefix}-checklist-${index}`}>{checklist}</div>);
      checklist = [];
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push(<CodeBlock key={`${keyPrefix}-code-${index}`} code={code.join("\n")} language={codeLanguage} />);
        code = [];
        codeLanguage = "";
      } else {
        flushList(index);
        codeLanguage = line.replace(/^```/, "").trim();
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushList(index);
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      flushList(index);
      const table = collectMarkdownTable(lines, index, keyPrefix, options);
      blocks.push(table.node);
      index = table.nextIndex;
    } else if (line.startsWith("# ")) {
      flushList(index);
      blocks.push(<h2 key={`${keyPrefix}-h2-${index}`}>{renderInlineMarkdown(line.replace(/^#\s+/, ""), `${keyPrefix}-h2-${index}`, options)}</h2>);
    } else if (line.startsWith("## ")) {
      flushList(index);
      blocks.push(<h3 key={`${keyPrefix}-h3-${index}`}>{renderInlineMarkdown(line.replace(/^##\s+/, ""), `${keyPrefix}-h3-${index}`, options)}</h3>);
    } else if (line.startsWith("### ")) {
      flushList(index);
      blocks.push(<h4 key={`${keyPrefix}-h4-${index}`}>{renderInlineMarkdown(line.replace(/^###\s+/, ""), `${keyPrefix}-h4-${index}`, options)}</h4>);
    } else if (line.startsWith("> ")) {
      flushList(index);
      blocks.push(<blockquote key={`${keyPrefix}-quote-${index}`}>{renderInlineMarkdown(line.replace(/^>\s+/, ""), `${keyPrefix}-quote-${index}`, options)}</blockquote>);
    } else if (/^- \[[ x]\]/.test(line)) {
      const checked = line.includes("[x]");
      checklist.push(<label className="preview-check" key={`${keyPrefix}-check-${index}`}><input type="checkbox" checked={checked} readOnly />{renderInlineMarkdown(line.replace(/^- \[[ x]\]\s*/, ""), `${keyPrefix}-check-${index}`, options)}</label>);
    } else if (/^\d+\.\s+/.test(line)) {
      const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (!orderedList.length) orderedListStart = Number(orderedMatch?.[1] ?? 1) || 1;
      orderedList.push(<li key={`${keyPrefix}-oli-${index}`}>{renderInlineMarkdown(orderedMatch?.[2] ?? line.replace(/^\d+\.\s+/, ""), `${keyPrefix}-oli-${index}`, options)}</li>);
    } else if (line.startsWith("- ")) {
      list.push(<li key={`${keyPrefix}-li-${index}`}>{renderInlineMarkdown(line.replace(/^-\s+/, ""), `${keyPrefix}-li-${index}`, options)}</li>);
    } else {
      flushList(index);
      blocks.push(<p key={`${keyPrefix}-p-${index}`}>{renderInlineMarkdown(line, `${keyPrefix}-p-${index}`, options)}</p>);
    }
  }

  flushList(lines.length);
  if (inCode && code.length) {
    blocks.push(<CodeBlock key={`${keyPrefix}-code-tail`} code={code.join("\n")} language={codeLanguage} />);
  }
  return blocks;
}

function MarkdownPreview({ title, summary, markdown }: { title: string; summary: string; markdown: string }) {
  const blocks: ReactNode[] = [];
  const lines = markdown.split("\n");
  let inCode = false;
  let code: string[] = [];
  let codeLanguage = "";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push(<CodeBlock key={`code-${index}`} code={code.join("\n")} language={codeLanguage} />);
        code = [];
        codeLanguage = "";
      } else {
        codeLanguage = line.replace(/^```/, "").trim();
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (!line.trim()) continue;
    if (isMarkdownTableStart(lines, index)) {
      const table = collectMarkdownTable(lines, index, "preview");
      blocks.push(table.node);
      index = table.nextIndex;
    } else if (line.startsWith("# ")) {
      blocks.push(<h2 key={index}>{renderInlineMarkdown(line.replace(/^#\s+/, ""), `h2-${index}`)}</h2>);
    } else if (line.startsWith("## ")) {
      blocks.push(<h3 key={index}>{renderInlineMarkdown(line.replace(/^##\s+/, ""), `h3-${index}`)}</h3>);
    } else if (line.startsWith("### ")) {
      blocks.push(<h4 key={index}>{renderInlineMarkdown(line.replace(/^###\s+/, ""), `h4-${index}`)}</h4>);
    } else if (line.startsWith("> ")) {
      blocks.push(<blockquote key={index}>{renderInlineMarkdown(line.replace(/^>\s+/, ""), `quote-${index}`)}</blockquote>);
    } else if (/^- \[[ x]\]/.test(line)) {
      const checked = line.includes("[x]");
      blocks.push(<label className="preview-check" key={index}><input type="checkbox" checked={checked} readOnly />{renderInlineMarkdown(line.replace(/^- \[[ x]\]\s*/, ""), `check-${index}`)}</label>);
    } else if (line.startsWith("- ")) {
      blocks.push(<p className="preview-list" key={index}>{renderInlineMarkdown(line.replace(/^-\s+/, ""), `list-${index}`)}</p>);
    } else {
      blocks.push(<p key={index}>{renderInlineMarkdown(line, `p-${index}`)}</p>);
    }
  }
  if (inCode && code.length) blocks.push(<CodeBlock key="code-tail" code={code.join("\n")} language={codeLanguage} />);

  return (
    <div className="preview-doc">
      <div className="preview-kicker">实时预览</div>
      {title.trim() && <h1>{title}</h1>}
      {summary.trim() && <div className="note">⊙ {summary}</div>}
      {blocks}
    </div>
  );
}

const DEFAULT_EDITOR_TITLE = "";
const DEFAULT_EDITOR_MARKDOWN = "";
const DEFAULT_EDITOR_SUMMARY = "";
const DEFAULT_EDITOR_CATEGORY = "技术笔记";
const DEFAULT_EDITOR_TAGS: string[] = [];
const DEFAULT_EDITOR_COVER = "/assets/editor-cover.png";

function EditorPage() {
  const [title, setTitle] = useState(DEFAULT_EDITOR_TITLE);
  const [saved, setSaved] = useState("10:25:30");
  const [published, setPublished] = useState(false);
  const [markdown, setMarkdown] = useState(DEFAULT_EDITOR_MARKDOWN);
  const [notice, setNotice] = useState("自动保存已开启");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [aiSummary, setAiSummary] = useState(DEFAULT_EDITOR_SUMMARY);
  const [categoryOptions, setCategoryOptions] = useState(["技术笔记", "项目复盘"]);
  const [tagOptions, setTagOptions] = useState(["博客系统", "自建项目", "开发心得", "AI"]);
  const [categoryName, setCategoryName] = useState(DEFAULT_EDITOR_CATEGORY);
  const [selectedTags, setSelectedTags] = useState(DEFAULT_EDITOR_TAGS);
  const [featured, setFeatured] = useState(true);
  const [allowComment, setAllowComment] = useState(true);
  const [reviewComment, setReviewComment] = useState(true);
  const [postStatus, setPostStatus] = useState<"published" | "scheduled" | "draft">("published");
  const [publishTiming, setPublishTiming] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduledAt);
  const [visibility, setVisibility] = useState<"public" | "private" | "password">("public");
  const [accessPassword, setAccessPassword] = useState("");
  const [passwordHint, setPasswordHint] = useState("");
  const [hasAccessPassword, setHasAccessPassword] = useState(false);
  const [seoTitle, setSeoTitle] = useState(title.slice(0, 60));
  const [coverUrl, setCoverUrl] = useState(DEFAULT_EDITOR_COVER);
  const [coverName, setCoverName] = useState("editor-cover.png");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<"cover" | "body">("cover");
  const [editorMediaItems, setEditorMediaItems] = useState<AdminMediaItem[]>([]);
  const [mediaPickerLoading, setMediaPickerLoading] = useState(false);
  const [loadedEditId, setLoadedEditId] = useState<number | undefined>();
  const [postVersions, setPostVersions] = useState<AdminPostVersionItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<AdminAiStatus>({
    enabled: false,
    mode: "mock",
    provider: null,
    model: null,
    responsesModel: null,
    webSearchEnabled: false,
    tasksTableReady: false,
    tasksCount: 0,
    message: "正在读取 AI 功能状态...",
  });
  const [aiTasks, setAiTasks] = useState<AdminAiTaskItem[]>([]);
  const [aiTasksOpen, setAiTasksOpen] = useState(false);
  const [aiTasksLoading, setAiTasksLoading] = useState(false);
  const [aiBusyTool, setAiBusyTool] = useState<AdminAiTool | "">("");
  const [aiMode, setAiMode] = useState<AdminAiTool>("polish");
  const [aiComment, setAiComment] = useState("");
  const [aiPolishNotes, setAiPolishNotes] = useState("");
  const [aiCommentSources, setAiCommentSources] = useState<Array<{ title: string; url: string }>>([]);
  const [aiResultModal, setAiResultModal] = useState<{ title: string; content: string; sources?: Array<{ title: string; url: string }> } | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{ type: "info" | "success" | "error"; text: string }>({ type: "info", text: "选择功能后开始处理。" });
  const [aiPolishInstruction, setAiPolishInstruction] = useState("");
  const [aiCommentInstruction, setAiCommentInstruction] = useState("");
  const [aiReviewFocus, setAiReviewFocus] = useState<AdminAiReviewFocus>("knowledge");
  const [aiWebSearch, setAiWebSearch] = useState(true);
  const [lastPolishSnapshot, setLastPolishSnapshot] = useState<{
    markdown: string;
    selectionStart: number;
    selectionEnd: number;
    scope: "document" | "selection";
  } | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const bodyImageInputRef = useRef<HTMLInputElement | null>(null);
  const markdownInputRef = useRef<HTMLTextAreaElement | null>(null);
  const editorQuery = routeQuery();
  const editPostId = Number(editorQuery.get("id") ?? 0) || undefined;
  const initialEditorStatus = editorQuery.get("status") === "draft" ? "draft" : "published";
  const isEditingExistingPost = Boolean(loadedEditId);
  const editorModeTitle = isEditingExistingPost ? `编辑文章 #${loadedEditId}` : "新建文章";
  const primaryPublishLabel = postStatus === "scheduled" ? "已定时" : isEditingExistingPost && published ? "更新发布" : published ? "已发布" : "发布";
  const readingMinutes = Math.max(1, Math.ceil(markdown.length / 350));
  const lineNumbers = markdown.split("\n").map((_, index) => index + 1);

  const normalizedScheduledAt = publishTiming === "scheduled" && scheduledAt.trim() ? scheduledAt.trim().replace(" ", "T") : undefined;
  const editorCoverPreviewUrl = sanitizeAssetUrl(coverUrl);
  const postMeta = {
    categoryName,
    tags: selectedTags,
    isFeatured: featured,
    coverUrl: editorCoverPreviewUrl,
    visibility,
    accessPassword,
    passwordHint,
    scheduledAt: normalizedScheduledAt,
    seoTitle,
    allowComment,
    requireCommentReview: reviewComment,
  };

  useEffect(() => {
    let alive = true;
    if (!editPostId) {
      setLoadedEditId(undefined);
      setTitle(DEFAULT_EDITOR_TITLE);
      setMarkdown(DEFAULT_EDITOR_MARKDOWN);
      setAiSummary(DEFAULT_EDITOR_SUMMARY);
      setCategoryName(DEFAULT_EDITOR_CATEGORY);
      setSelectedTags(DEFAULT_EDITOR_TAGS);
      setFeatured(true);
      setAllowComment(true);
      setReviewComment(true);
      setPostStatus(initialEditorStatus);
      setPublishTiming("now");
      setScheduledAt(getDefaultScheduledAt());
      setVisibility("public");
      setAccessPassword("");
      setPasswordHint("");
      setHasAccessPassword(false);
      setSeoTitle(DEFAULT_EDITOR_TITLE.slice(0, 60));
      setCoverUrl(DEFAULT_EDITOR_COVER);
      setCoverName("editor-cover.png");
      setPostVersions([]);
      setVersionsLoading(false);
      setPublished(false);
      setAiComment("");
      setAiPolishNotes("");
      setAiCommentSources([]);
      setAiResultModal(null);
      setAiFeedback({ type: "info", text: "选择功能后开始处理。" });
      setLastPolishSnapshot(null);
      setSaved(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
      setNotice(initialEditorStatus === "draft" ? "已进入新草稿模式，保存后写入数据库" : "已进入新建文章模式，发布后写入数据库");
      api.startNewPost();
      return () => {
        alive = false;
      };
    }
    setLoadedEditId(editPostId);
    setVersionsLoading(true);
    api.getPostVersions(editPostId)
      .then((versionResult) => {
        if (alive) setPostVersions(versionResult.items);
      })
      .catch(() => {
        if (alive) setPostVersions([]);
      })
      .finally(() => {
        if (alive) setVersionsLoading(false);
      });
    setNotice(`正在读取文章 #${editPostId}`);
    api.getEditorPost(editPostId)
      .then(({ item, source }) => {
        if (!alive || !item) {
          if (alive) {
            setLoadedEditId(undefined);
            setPublished(false);
            setNotice("没有找到这篇文章，已停留在新建文章模式");
            api.startNewPost();
          }
          return;
        }
        setTitle(item.title);
        setMarkdown(item.markdown);
        setAiSummary(item.summary);
        setAiComment("");
        setAiPolishNotes("");
        setAiCommentSources([]);
        setAiResultModal(null);
        setAiFeedback({ type: "info", text: "选择功能后开始处理。" });
        setLastPolishSnapshot(null);
        if (item.categoryName) setCategoryName(item.categoryName);
        if (item.tags.length) setSelectedTags(item.tags);
        setFeatured(item.isFeatured ?? true);
        setAllowComment(item.allowComment ?? true);
        setReviewComment(item.requireCommentReview ?? true);
        setVisibility(item.visibility ?? "public");
        setAccessPassword("");
        setPasswordHint(item.passwordHint ?? "");
        setHasAccessPassword(Boolean(item.hasAccessPassword));
        setSeoTitle(item.title.slice(0, 60));
        if (item.coverUrl) {
          setCoverUrl(item.coverUrl);
          setCoverName(item.coverUrl.startsWith("data:") ? "uploaded-cover" : item.coverUrl.split("/").pop() ?? "cover");
        }
        setPostStatus(item.status === "draft" ? "draft" : item.status === "scheduled" ? "scheduled" : "published");
        setPublishTiming(item.status === "scheduled" ? "scheduled" : "now");
        if (item.scheduledAt) setScheduledAt(item.scheduledAt.slice(0, 16).replace("T", " "));
        setPublished(item.status === "published");
        setNotice(source === "api" ? `已加载数据库文章 #${item.id}` : "后端不可用，无法加载文章详情");
      })
      .catch((error) => {
        if (!alive) return;
        setLoadedEditId(undefined);
        setPublished(false);
        setNotice(`${getApiErrorMessage(error)}，已停留在新建文章模式`);
        api.startNewPost();
      });
    return () => {
      alive = false;
    };
  }, [editPostId, initialEditorStatus]);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getAdminCategories(), api.getAdminTags()]).then(([categoryResult, tagResult]) => {
      if (!alive) return;
      const nextCategories = categoryResult.items.map((item) => item.name);
      const nextTags = tagResult.items.map((item) => item.name);
      if (nextCategories.length) {
        setCategoryOptions(nextCategories);
        setCategoryName((current) => nextCategories.includes(current) ? current : nextCategories[0]);
      }
      if (nextTags.length) setTagOptions(nextTags.slice(0, 12));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    api.getAiStatus()
      .then((status) => {
        if (alive) {
          setAiStatus(status);
          if (!status.webSearchEnabled) setAiWebSearch(false);
        }
      })
      .catch((error) => {
        if (alive) {
          setAiStatus((current) => ({ ...current, message: getApiErrorMessage(error) }));
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  async function saveDraft() {
    try {
      const savedDraft = await api.saveDraft(title, markdown, aiSummary, { ...postMeta, status: "draft" });
      setSaved(savedDraft.savedAt);
      setLoadedEditId(savedDraft.id);
      replaceHash(`/admin/editor?id=${savedDraft.id}`);
      setPostStatus(savedDraft.status === "published" ? "published" : savedDraft.status === "scheduled" ? "scheduled" : "draft");
      setPublished(savedDraft.status === "published");
      const successText = isEditingExistingPost ? `文章 #${savedDraft.id} 已更新为草稿` : `草稿已保存到数据库 #${savedDraft.id}`;
      setNotice(successText);
      api.getPostVersions(savedDraft.id).then((result) => setPostVersions(result.items)).catch(() => undefined);
      emitAdminDataChanged();
      return savedDraft;
    } catch (error) {
      setNotice(getApiErrorMessage(error));
      return undefined;
    }
  }

  function restoreVersion(version: AdminPostVersionItem) {
    setTitle(version.title);
    setMarkdown(version.contentMarkdown);
    setAiSummary(version.summary);
    if (version.categoryName) setCategoryName(version.categoryName);
    if (version.tags.length) setSelectedTags(version.tags);
    if (version.coverUrl) {
      setCoverUrl(version.coverUrl);
      setCoverName(version.coverUrl.split("/").pop() || "cover");
    }
    setNotice(`已恢复版本 #${version.id} 到编辑器，确认无误后请手动保存。`);
  }

  async function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("请选择图片文件");
      return;
    }
    try {
      setNotice("正在上传封面...");
      const result = await api.uploadMedia(file, file.name);
      setCoverUrl(mediaDisplayUrl(result.item));
      setCoverName(result.item.originalName);
      setNotice(`封面已上传并写入媒体库：${result.item.originalName}`);
      emitAdminDataChanged();
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    }
  }
  async function uploadEditorBodyImages(files: File[], source: "upload" | "paste" = "upload") {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setNotice("请选择图片文件");
      return;
    }
    try {
      setNotice(source === "paste" ? "正在上传粘贴的图片..." : "正在上传正文图片...");
      const snippets: string[] = [];
      for (const file of imageFiles) {
        const result = await api.uploadMedia(file, file.name || "pasted-image.png");
        const imageUrl = sanitizeAssetUrl(result.item.url);
        if (imageUrl) snippets.push(`![${result.item.altText || result.item.originalName}](${imageUrl})`);
      }
      if (!snippets.length) {
        setNotice("图片已上传，但返回的媒体地址不可用于正文插入。");
        return;
      }
      insertMarkdownAtCursor(snippets.join("\n\n"), source === "paste" ? "图片已从剪切板上传到媒体库，并插入正文。" : "图片已上传到媒体库，并插入正文。");
      emitAdminDataChanged();
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    }
  }
  async function handleBodyImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await uploadEditorBodyImages(files, "upload");
  }
  async function handleMarkdownPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    await uploadEditorBodyImages(files, "paste");
  }
  async function openMediaPicker(target: "cover" | "body" = "cover") {
    setMediaPickerTarget(target);
    setMediaPickerOpen(true);
    setMediaPickerLoading(true);
    try {
      const result = await api.getAdminMedia({ pageSize: 100 });
      setEditorMediaItems(result.items.filter((item) => item.mimeType.startsWith("image/")));
      setNotice(target === "cover" ? "请选择一张媒体库图片作为封面" : "请选择一张媒体库图片插入正文");
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setMediaPickerLoading(false);
    }
  }
  function chooseEditorMedia(item: AdminMediaItem) {
    if (mediaPickerTarget === "body") {
      const imageUrl = sanitizeAssetUrl(item.url);
      if (!imageUrl) {
        setNotice("这个媒体地址不可用于正文插入。");
        return;
      }
      insertMarkdownAtCursor(`![${item.altText || item.originalName}](${imageUrl})`, `已从媒体库插入图片：${item.originalName}`);
    } else {
      setCoverUrl(mediaDisplayUrl(item));
      setCoverName(item.originalName);
      setNotice(`已从媒体库选择封面：${item.originalName}`);
    }
    setMediaPickerOpen(false);
  }
  function insertMarkdownAtCursor(snippet: string, nextNotice = "已插入 Markdown 片段") {
    const textarea = markdownInputRef.current;
    const start = textarea?.selectionStart ?? markdown.length;
    const end = textarea?.selectionEnd ?? markdown.length;
    const prefix = markdown.slice(0, start);
    const suffix = markdown.slice(end);
    const needsLeadingBreak = prefix && !prefix.endsWith("\n") ? "\n" : "";
    const needsTrailingBreak = suffix && !snippet.endsWith("\n") ? "\n" : "";
    const nextMarkdown = `${prefix}${needsLeadingBreak}${snippet}${needsTrailingBreak}${suffix}`;
    const nextCursor = prefix.length + needsLeadingBreak.length + snippet.length;
    setMarkdown(nextMarkdown);
    setNotice(nextNotice);
    window.setTimeout(() => {
      markdownInputRef.current?.focus();
      markdownInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  }
  function insertSnippet(snippet: string) {
    insertMarkdownAtCursor(snippet);
  }
  function toggleTag(tag: string) {
    setSelectedTags((items) => items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]);
  }
  async function createEditorTag() {
    const name = window.prompt("请输入新标签名称");
    if (!name?.trim()) return;
    try {
      const result = await api.createTag({ name: name.trim() });
      setTagOptions((items) => items.includes(result.item.name) ? items : [...items, result.item.name]);
      setSelectedTags((items) => items.includes(result.item.name) ? items : [...items, result.item.name]);
      setNotice(`标签已写入数据库并加入当前文章：${result.item.name}`);
      emitAdminDataChanged();
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    }
  }
  function undoLastPolish() {
    if (!lastPolishSnapshot) {
      setNotice("暂无可撤销的 AI 润色。");
      return;
    }
    setMarkdown(lastPolishSnapshot.markdown);
    setLastPolishSnapshot(null);
    setNotice(lastPolishSnapshot.scope === "selection" ? "已撤销上一次选区润色。" : "已撤销上一次全文润色。");
    window.setTimeout(() => {
      markdownInputRef.current?.focus();
      markdownInputRef.current?.setSelectionRange(lastPolishSnapshot.selectionStart, lastPolishSnapshot.selectionEnd);
    }, 0);
  }
  const aiToolNames: Record<AdminAiTool, string> = {
    summary: "AI 摘要",
    polish: "AI 润色",
    comment: "AI 评论",
  };
  const aiStatusNames: Record<string, string> = {
    running: "处理中",
    succeeded: "已完成",
    failed: "失败",
  };
  async function loadAiTasks(showNotice = false) {
    setAiTasksLoading(true);
    try {
      const result = await api.getAiTasks(20);
      setAiTasks(result.items);
      setAiStatus((current) => ({ ...current, tasksCount: Math.max(current.tasksCount, result.items.length) }));
      if (showNotice) setNotice(result.items.length ? `已读取最近 ${result.items.length} 条 AI 任务。` : "暂无 AI 任务记录。");
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    } finally {
      setAiTasksLoading(false);
    }
  }
  function toggleAiTasks() {
    setAiTasksOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) void loadAiTasks(true);
      return nextOpen;
    });
  }
  function openAiTaskResult(task: AdminAiTaskItem) {
    const name = aiToolNames[task.taskType as AdminAiTool] ?? "AI 任务";
    const sections = [
      `状态：${aiStatusNames[task.status] ?? task.status}`,
      task.model ? `模型：${task.model}${task.enableWebSearch ? "（联网核查）" : ""}` : "",
      task.userInstruction ? `本次要求：${task.userInstruction}` : "",
      task.notes ? `处理说明：\n${task.notes}` : "",
      task.result ? `输出结果：\n${task.result}` : "",
      task.message ? `错误信息：${task.message}` : "",
      !task.result && !task.notes && !task.message && task.inputPreview ? `输入摘要：${task.inputPreview}` : "",
    ].filter(Boolean).join("\n\n");
    setAiResultModal({ title: `${name} #${task.id}`, content: sections || "这条任务暂时没有可复看的输出。", sources: task.sources });
  }
  async function runAiTool(tool: AdminAiTool) {
    const labels = aiToolNames;
    if (aiBusyTool) return;
    const textarea = markdownInputRef.current;
    const selectionStart = textarea?.selectionStart ?? markdown.length;
    const selectionEnd = textarea?.selectionEnd ?? markdown.length;
    const selectedMarkdown = markdown.slice(selectionStart, selectionEnd);
    const polishScope: "document" | "selection" = tool === "polish" && selectedMarkdown.trim() ? "selection" : "document";
    const aiContent = tool === "polish" && polishScope === "selection" ? selectedMarkdown : markdown;
    if (!title.trim() && !markdown.trim()) {
      setNotice("请先填写标题或正文，再使用 AI 功能。");
      return;
    }
    if (tool === "polish" && !aiContent.trim()) {
      setNotice("请先填写正文，或选中一段需要润色的内容。");
      return;
    }
    const userInstruction = tool === "polish" ? aiPolishInstruction.trim() : tool === "comment" ? aiCommentInstruction.trim() : "";
    const polishSnapshot = tool === "polish" ? { markdown, selectionStart, selectionEnd, scope: polishScope } : null;
    setAiBusyTool(tool);
    const runningText = tool === "polish" && polishScope === "selection" ? "AI 正在润色选中内容..." : `${labels[tool]}正在生成...`;
    setNotice(runningText);
    setAiFeedback({ type: "info", text: runningText });
    if (tool === "comment") setAiCommentSources([]);
    if (tool === "polish") setAiPolishNotes("");
    try {
      const result = await api.runAiTool({
        tool,
        title,
        summary: aiSummary,
        content: aiContent,
        postId: loadedEditId,
        scope: polishScope,
        userInstruction,
        reviewFocus: tool === "comment" ? aiReviewFocus : undefined,
        enableWebSearch: tool === "comment" && aiWebSearch,
      });
      if (tool === "summary") {
        const nextSummary = result.result.length > 200 ? result.result.slice(0, 200) : result.result;
        setAiSummary(nextSummary);
        const successText = `${labels[tool]}已写入摘要字段，请检查后保存文章。`;
        setNotice(successText);
        setAiFeedback({ type: "success", text: successText });
      }
      if (tool === "polish") {
        if (!polishSnapshot) return;
        const currentMarkdownValue = markdownInputRef.current?.value ?? polishSnapshot.markdown;
        if (currentMarkdownValue !== polishSnapshot.markdown) {
          const changedText = "正文在 AI 润色期间发生变化，已取消自动替换，避免覆盖你的手动修改。";
          setNotice(changedText);
          setAiFeedback({ type: "error", text: changedText });
          return;
        }
        const nextMarkdown = polishSnapshot.scope === "selection"
          ? `${polishSnapshot.markdown.slice(0, polishSnapshot.selectionStart)}${result.result}${polishSnapshot.markdown.slice(polishSnapshot.selectionEnd)}`
          : result.result;
        const nextSelectionStart = polishSnapshot.scope === "selection" ? polishSnapshot.selectionStart : 0;
        const nextSelectionEnd = polishSnapshot.scope === "selection" ? polishSnapshot.selectionStart + result.result.length : result.result.length;
        setLastPolishSnapshot(polishSnapshot);
        setMarkdown(nextMarkdown);
        setAiPolishNotes(result.notes || "已完成润色，请检查正文变化。");
        const successText = polishSnapshot.scope === "selection" ? "AI 已替换选中内容，可点击撤销润色恢复。" : "AI 已替换全文，可点击撤销润色恢复。";
        setNotice(successText);
        setAiFeedback({ type: "success", text: successText });
        window.setTimeout(() => {
          markdownInputRef.current?.focus();
          markdownInputRef.current?.setSelectionRange(nextSelectionStart, nextSelectionEnd);
        }, 0);
      }
      if (tool === "comment") {
        setAiComment(result.result);
        setAiCommentSources(result.sources ?? []);
        const successText = result.enableWebSearch ? `${labels[tool]}已完成联网核查，只作为修改建议，不会自动改正文。` : `${labels[tool]}已生成，只作为修改建议，不会自动改正文。`;
        setNotice(successText);
        setAiFeedback({ type: "success", text: successText });
      }
      if (result.taskId) {
        setAiStatus((current) => ({ ...current, enabled: true, mode: "api", provider: result.provider, model: result.model, tasksCount: current.tasksCount + 1, message: `千问已接入，当前模型：${result.model}` }));
        if (aiTasksOpen) void loadAiTasks();
      }
    } catch (error) {
      const message = getApiErrorMessage(error);
      setNotice(message);
      setAiFeedback({ type: "error", text: `${labels[tool]}失败：${message}` });
    } finally {
      setAiBusyTool("");
    }
  }
  async function publish() {
    if (postStatus === "draft") {
      const draft = await saveDraft();
      if (draft) setPublished(false);
      return;
    }
    if (!title.trim()) {
      setNotice("发布文章必须填写标题。");
      return;
    }
    if (!markdown.trim()) {
      setNotice("发布文章必须填写正文内容。");
      return;
    }
    if (publishTiming === "scheduled") {
      const scheduledTime = normalizedScheduledAt ? new Date(normalizedScheduledAt).getTime() : NaN;
      if (!normalizedScheduledAt || Number.isNaN(scheduledTime)) {
        setNotice("请填写有效的定时发布时间，例如 2026-06-15 20:00。");
        return;
      }
      if (scheduledTime <= Date.now()) {
        setNotice("定时发布时间必须晚于当前时间。");
        return;
      }
      try {
        const scheduledPost = await api.saveDraft(title, markdown, aiSummary, { ...postMeta, status: "scheduled" });
        setSaved(scheduledPost.savedAt);
        setLoadedEditId(scheduledPost.id);
        replaceHash(`/admin/editor?id=${scheduledPost.id}`);
        setPostStatus(scheduledPost.status === "scheduled" ? "scheduled" : scheduledPost.status === "published" ? "published" : "draft");
        setPublished(false);
        const successText = isEditingExistingPost ? `文章 #${scheduledPost.id} 已更新为定时发布` : `文章已定时保存到数据库 #${scheduledPost.id}`;
        setNotice(successText);
        emitAdminDataChanged();
      } catch (error) {
        setNotice(getApiErrorMessage(error));
      }
      return;
    }
    try {
      const publishedPost = await api.publishPost(title, markdown, aiSummary, { ...postMeta, status: "published" });
      setLoadedEditId(publishedPost.id);
      replaceHash(`/admin/editor?id=${publishedPost.id}`);
      setPostStatus(publishedPost.status === "published" ? "published" : publishedPost.status === "scheduled" ? "scheduled" : "draft");
      setPublished(publishedPost.status === "published");
      const successText = isEditingExistingPost ? `文章 #${publishedPost.id} 已更新发布` : `文章已发布到数据库 #${publishedPost.id}`;
      setNotice(successText);
      emitAdminDataChanged();
    } catch (error) {
      setNotice(getApiErrorMessage(error));
    }
    return;
  }

  const tools = [
    ["B", "**加粗文本**"],
    ["I", "*斜体文本*"],
    ["H", "## 新的小节"],
    ["≡", "- 列表项"],
    ["</>", "```js\nconsole.log('hello')\n```"],
    ["❞", "> 引用内容"],
    ["🔗", "[链接文字](https://example.com)"],
    ["▦", "| 字段 | 说明 |\n| --- | --- |\n| title | 文章标题 |"],
  ];
  const aiModeOptions: Array<{ tool: AdminAiTool; name: string; desc: string }> = [
    { tool: "polish", name: "润色", desc: "按要求优化正文" },
    { tool: "comment", name: "评论", desc: "检查问题并给建议" },
    { tool: "summary", name: "摘要", desc: "生成文章卡片摘要" },
  ];

  return (
    <>
      <AdminTop editor editorTitle={editorModeTitle} />
      <div className={`editor preview-${previewMode}`}>
        <section className="editor-core">
          <div className="editor-title">
            <h1>{editorModeTitle}</h1>
            <span>✓ 已自动保存 {saved} · {notice}</span>
          </div>
          <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="editor-tabs"><button className="active">Markdown</button></div>
          <div className="editor-split">
            <div className="markdown-pane">
              <div className="toolbar">{tools.map(([label, snippet]) => <button key={label} title={`插入${label}`} onClick={() => insertSnippet(snippet)}>{label}</button>)}<button type="button" title="上传正文图片" onClick={() => bodyImageInputRef.current?.click()}>▧</button><button type="button" title="从媒体库插入图片" onClick={() => openMediaPicker("body")}>库</button></div>
              <div className="markdown-editor-shell">
                <div className="line-numbers">{lineNumbers.map((line) => <span key={line}>{line}</span>)}</div>
                <textarea ref={markdownInputRef} value={markdown} onChange={(event) => setMarkdown(event.target.value)} onPaste={handleMarkdownPaste} onBlur={saveDraft} />
              </div>
              <input ref={bodyImageInputRef} className="visually-hidden" type="file" accept="image/*" multiple onChange={handleBodyImageUpload} />
              <footer>字数: {markdown.length}　预计阅读: {readingMinutes} 分钟　保存于 {saved}　• {notice}</footer>
            </div>
            <div className="preview-pane"><MarkdownPreview title={title} summary={aiSummary} markdown={markdown} /></div>
          </div>
        </section>
        <aside className="publish-panel card">
          <Card title="封面图">
            <div className="cover-thumb" style={editorCoverPreviewUrl ? { backgroundImage: `url(${editorCoverPreviewUrl})` } : undefined} />
            <div className="cover-actions">
              <button type="button" onClick={() => coverInputRef.current?.click()}>上传封面</button>
              <button type="button" onClick={() => openMediaPicker("cover")}>从媒体库选择</button>
              <small>{coverName}</small>
            </div>
            <input ref={coverInputRef} className="visually-hidden" type="file" accept="image/*" onChange={handleCoverUpload} />
          </Card>
          <label>分类<select value={categoryName} onChange={(event) => setCategoryName(event.target.value)}>{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>标签<div className="tag-cloud">{tagOptions.map((tag) => <button className={`tag-button ${selectedTags.includes(tag) ? "active" : ""}`} key={tag} onClick={() => toggleTag(tag)}><Tag tone="gray">{tag} {selectedTags.includes(tag) ? "×" : "+"}</Tag></button>)}</div><button className="text-link" onClick={createEditorTag}>+ 新增标签</button></label>
          <label>文章摘要<textarea value={aiSummary} maxLength={200} onChange={(event) => setAiSummary(event.target.value)} /><small>{aiSummary.length}/200</small></label>
          <label className="switch">精选推荐<input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /></label>
          <h3>发布设置</h3>
          <label>状态
            <span className="publish-radio">
              <label><input name="postStatus" type="radio" checked={postStatus === "published" || postStatus === "scheduled"} onChange={() => setPostStatus("published")} /> 发布</label>
              <label><input name="postStatus" type="radio" checked={postStatus === "draft"} onChange={() => setPostStatus("draft")} /> 草稿</label>
            </span>
          </label>
          <label>发布方式
            <span className="publish-radio">
              <label><input name="publishTiming" type="radio" checked={publishTiming === "now"} onChange={() => setPublishTiming("now")} /> 立即发布</label>
              <label><input name="publishTiming" type="radio" checked={publishTiming === "scheduled"} onChange={() => setPublishTiming("scheduled")} /> 定时发布</label>
            </span>
          </label>
          <label>定时发布<input value={scheduledAt} disabled={publishTiming === "now"} onChange={(event) => setScheduledAt(event.target.value)} placeholder="2024-06-15 20:00" /></label>
          <label>访问权限
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as "public" | "private" | "password")}>
              <option value="public">公开（所有人可见）</option>
              <option value="private">私密（仅管理员可见）</option>
              <option value="password">密码访问</option>
            </select>
            <small className="field-help">
              {visibility === "public" ? "公开文章会出现在前台列表，并允许通过详情页访问。" : visibility === "private" ? "私密文章只保存在后台，前台列表和详情页都不会展示。" : "密码文章会出现在前台列表，详情页输入正确密码后才能阅读正文。"}
            </small>
          </label>
          {visibility === "password" && (
            <>
              <label>访问密码<input value={accessPassword} type="password" onChange={(event) => setAccessPassword(event.target.value)} placeholder={hasAccessPassword ? "留空则保留原密码" : "请输入访问密码"} /></label>
              <label>密码提示<input value={passwordHint} maxLength={80} onChange={(event) => setPasswordHint(event.target.value)} placeholder="例如：我的英文名、项目代号等" /></label>
              <small className="field-help">{hasAccessPassword ? "当前文章已设置访问密码；填写新密码会覆盖旧密码。" : "发布密码文章前必须设置访问密码，密码只会以哈希形式保存。"}</small>
            </>
          )}
          {isEditingExistingPost && (
            <Card title="版本历史">
              <div className="version-list">
                {versionsLoading ? <p className="soft-text">正在读取版本...</p> : postVersions.length ? postVersions.map((version) => (
                  <button type="button" key={version.id} onClick={() => restoreVersion(version)}>
                    <b>{version.title}</b>
                    <small>{version.createdAt?.slice(0, 16).replace("T", " ") ?? "刚刚"} · 恢复到编辑器</small>
                  </button>
                )) : <p className="soft-text">暂无历史版本，保存后会自动生成快照。</p>}
              </div>
            </Card>
          )}
          <h3>SEO 设置</h3>
          <label>SEO 标题<input value={seoTitle} maxLength={80} onChange={(event) => setSeoTitle(event.target.value)} placeholder="输入搜索结果标题" /></label>
          <h3>评论设置</h3>
          <label className="switch">允许评论<input type="checkbox" checked={allowComment} onChange={(event) => setAllowComment(event.target.checked)} /></label>
          <label className="switch">评论审核<input type="checkbox" checked={reviewComment} onChange={(event) => setReviewComment(event.target.checked)} /></label>
        </aside>
        <aside className="ai-panel card">
          <header><h3>✦ AI 助手</h3><button onClick={() => setNotice("AI 助手面板已保持打开")}>×</button></header>
          <div className="ai-status-row">
            <span className={aiStatus.enabled ? "ready" : "warn"}>{aiStatus.enabled ? "千问已接入" : "未配置 Key"}</span>
            <button type="button" onClick={toggleAiTasks}>{aiTasksOpen ? "收起" : `任务 ${aiStatus.tasksCount}`}</button>
          </div>
          {aiTasksOpen && (
            <section className="ai-history" aria-label="AI 任务历史">
              <div className="ai-history-head">
                <b>最近任务</b>
                <button type="button" disabled={aiTasksLoading} onClick={() => loadAiTasks(true)}>{aiTasksLoading ? "读取中" : "刷新"}</button>
              </div>
              {aiTasksLoading && !aiTasks.length ? <p className="ai-history-empty">正在读取 AI 任务...</p> : aiTasks.length ? (
                <div className="ai-history-list">
                  {aiTasks.map((task) => {
                    const toolName = aiToolNames[task.taskType as AdminAiTool] ?? "AI 任务";
                    const timeText = task.createdAt?.slice(0, 16).replace("T", " ") ?? "刚刚";
                    return (
                      <button type="button" key={task.id} onClick={() => openAiTaskResult(task)}>
                        <span>
                          <b>{toolName}</b>
                          <small>{aiStatusNames[task.status] ?? task.status} · {timeText}</small>
                        </span>
                        <i>{task.result || task.notes || task.message || task.inputPreview || "查看结果"}</i>
                      </button>
                    );
                  })}
                </div>
              ) : <p className="ai-history-empty">暂无任务记录，生成摘要、评论或润色后会出现在这里。</p>}
            </section>
          )}
          <div className="ai-mode-tabs">
            {aiModeOptions.map((item) => (
              <button key={item.tool} className={aiMode === item.tool ? "active" : ""} onClick={() => setAiMode(item.tool)}>
                {item.name}
                <small>{item.desc}</small>
              </button>
            ))}
          </div>
          <section className="ai-workspace">
            <div className={`ai-feedback ${aiFeedback.type}`}>{aiFeedback.text}</div>
            {aiMode === "polish" && (
              <>
                <h3>AI 润色</h3>
                <p className="ai-muted">选中正文片段时只润色选区；未选中时润色全文。</p>
                <label className="ai-field">润色要求
                  <textarea value={aiPolishInstruction} maxLength={800} onChange={(event) => setAiPolishInstruction(event.target.value)} placeholder="例如：润色一下论文结构；让表达更正式；保留技术术语" />
                  <small>{aiPolishInstruction.length}/800</small>
                </label>
                <button className="ai-primary" disabled={Boolean(aiBusyTool)} onClick={() => runAiTool("polish")}>{aiBusyTool === "polish" ? "润色中..." : "开始润色"}</button>
                <button className="ai-undo" disabled={!lastPolishSnapshot || Boolean(aiBusyTool)} onClick={undoLastPolish}>撤销上次润色</button>
                <div className="ai-result-head">
                  <b>润色说明</b>
                  <button type="button" disabled={!aiPolishNotes} onClick={() => setAiResultModal({ title: "AI 润色说明", content: aiPolishNotes })}>放大查看</button>
                </div>
                <div className="ai-result">{aiPolishNotes || "润色完成后会在这里简要说明原文问题和修改方向。"}</div>
              </>
            )}
            {aiMode === "comment" && (
              <>
                <h3>AI 评论</h3>
                <label className="ai-field">评论重点
                  <select value={aiReviewFocus} onChange={(event) => setAiReviewFocus(event.target.value as AdminAiReviewFocus)}>
                    <option value="knowledge">知识性错误</option>
                    <option value="structure">结构性错误</option>
                    <option value="suggestions">优化建议</option>
                    <option value="all">综合检查</option>
                  </select>
                </label>
                <label className="ai-field">评论要求
                  <textarea value={aiCommentInstruction} maxLength={800} onChange={(event) => setAiCommentInstruction(event.target.value)} placeholder="例如：只看知识性错误；检查文章结构；指出论证跳跃处" />
                  <small>{aiCommentInstruction.length}/800</small>
                </label>
                <label className="ai-web-switch">
                  <span>
                    联网核查
                    <small>{aiStatus.webSearchEnabled ? `百炼 ${aiStatus.responsesModel || aiStatus.model || ""}` : "后端未启用"}</small>
                  </span>
                  <input type="checkbox" checked={aiWebSearch && Boolean(aiStatus.webSearchEnabled)} disabled={!aiStatus.webSearchEnabled || Boolean(aiBusyTool)} onChange={(event) => setAiWebSearch(event.target.checked)} />
                </label>
                <button className="ai-primary" disabled={Boolean(aiBusyTool)} onClick={() => runAiTool("comment")}>{aiBusyTool === "comment" ? "评论生成中..." : "生成评论"}</button>
                <div className="ai-result-head">
                  <b>评论结果</b>
                  <button type="button" disabled={!aiComment} onClick={() => setAiResultModal({ title: "AI 评论结果", content: aiComment, sources: aiCommentSources })}>放大查看</button>
                </div>
                <div className="ai-result">{aiComment || "生成后会在这里显示审稿建议。"}</div>
                {aiCommentSources.length > 0 && (
                  <div className="ai-sources">
                    <b>参考来源</b>
                    {safeSourceLinks(aiCommentSources).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a>)}
                  </div>
                )}
              </>
            )}
            {aiMode === "summary" && (
              <>
                <h3>AI 摘要</h3>
                <p className="ai-muted">生成适合文章卡片展示的短摘要。</p>
                <button className="ai-primary" disabled={Boolean(aiBusyTool)} onClick={() => runAiTool("summary")}>{aiBusyTool === "summary" ? "摘要生成中..." : "重新生成摘要"}</button>
                <div className="ai-result">{aiSummary || "暂无摘要"}</div>
              </>
            )}
          </section>
          <div className="hint">{aiStatus.message}</div>
        </aside>
        <div className="editor-actions"><button className={previewMode === "desktop" ? "active" : ""} onClick={() => setPreviewMode("desktop")}>▣</button><button className={previewMode === "mobile" ? "active" : ""} onClick={() => setPreviewMode("mobile")}>▯</button><button onClick={() => setNotice("预览已刷新")}>预览</button><button className="draft" onClick={saveDraft}>存为草稿</button><button className="primary" onClick={publish}>{primaryPublishLabel}</button></div>
        {mediaPickerOpen && (
          <div className="media-modal" role="dialog" aria-modal="true" aria-label={mediaPickerTarget === "cover" ? "选择封面图" : "插入正文图片"} onClick={() => setMediaPickerOpen(false)}>
            <div className="media-modal-panel media-picker-panel" onClick={(event) => event.stopPropagation()}>
              <header><b>{mediaPickerTarget === "cover" ? "选择封面图" : "插入正文图片"}</b><button type="button" onClick={() => setMediaPickerOpen(false)}>关闭</button></header>
              {mediaPickerLoading ? <p className="soft-text">正在读取媒体库...</p> : editorMediaItems.length ? (
                <div className="media-picker-grid">
                  {editorMediaItems.map((item) => <button key={item.id} type="button" onClick={() => chooseEditorMedia(item)}><img src={mediaPreviewUrl(item)} alt={item.altText || item.originalName} loading="lazy" /><span>{item.originalName}</span></button>)}
                </div>
              ) : <p className="soft-text">媒体库暂无可用图片。</p>}
            </div>
          </div>
        )}
        {aiResultModal && (
          <div className="ai-result-modal" role="dialog" aria-modal="true" aria-label={aiResultModal.title} onClick={() => setAiResultModal(null)}>
            <div className="ai-result-modal-panel" onClick={(event) => event.stopPropagation()}>
              <header><b>{aiResultModal.title}</b><button type="button" onClick={() => setAiResultModal(null)}>关闭</button></header>
              <pre>{aiResultModal.content}</pre>
              {aiResultModal.sources?.length ? (
                <div className="ai-result-modal-sources">
                  <b>参考来源</b>
                  {safeSourceLinks(aiResultModal.sources).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a>)}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function App() {
  const path = useRoute();
  const [authVersion, setAuthVersion] = useState(0);
  useEffect(() => {
    const syncAuth = () => setAuthVersion((value) => value + 1);
    window.addEventListener(api.authChangedEvent, syncAuth);
    return () => window.removeEventListener(api.authChangedEvent, syncAuth);
  }, []);
  const page = useMemo(() => {
    const routePath = path.split("?")[0];
    if (routePath === "/admin/login") return api.isLoggedIn() ? <AdminShell /> : <AdminLogin />;
    if (routePath === "/admin" || routePath.startsWith("/admin/")) {
      if (!api.isLoggedIn()) return <AdminLogin />;
    }
    if (routePath === "/admin/editor") return <AdminShell editor />;
    if (routePath === "/admin") return <AdminShell />;
    if (routePath.startsWith("/admin/")) {
      const adminPage = adminRouteAliases[routePath] ?? Object.entries(adminRoutes).find(([, item]) => item.path === routePath)?.[0] ?? "dashboard";
      return <AdminShell page={adminPage} />;
    }
    if (routePath.startsWith("/article")) return <ArticlePage articleId={Number(routePath.split("/")[2]) || 0} />;
    if (routePath === "/posts" || routePath === "/archive" || routePath === "/categories" || routePath === "/tags") return <PostsPage />;
    if (routePath === "/about") return <AboutPage />;
    if (routePath === "/messages") return <MessagesPage />;
    return <HomePage />;
  }, [path, authVersion]);
  return page;
}
