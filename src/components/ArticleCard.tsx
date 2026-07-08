import { sanitizeAssetUrl } from "../services/api";
import type { AdminCategoryItem } from "../services/api";
import type { Article } from "../types";
import CategoryIcon from "./CategoryIcon";
import { categoryVisualStyle, getCategoryVisual } from "./categoryVisuals";

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

export default function ArticleCard({
  article,
  category,
  keyword,
  onOpen,
}: {
  article: Article;
  category?: AdminCategoryItem;
  keyword?: string;
  onOpen: (id: number) => void;
}) {
  const fallbackCategory: AdminCategoryItem = {
    id: 0,
    name: article.category,
    slug: article.category,
    postsCount: 0,
  };
  const visual = getCategoryVisual(category ?? fallbackCategory);
  const cover = sanitizeAssetUrl(article.coverUrl);
  const matchText = keyword?.trim() ? article.searchSnippet || article.summary || article.excerpt : "";
  const primaryTag = article.tags[0] || article.category;

  return (
    <button className="category-article-card" type="button" style={categoryVisualStyle(visual)} onClick={() => onOpen(article.id)}>
      <span className={`category-article-cover ${cover ? "has-cover" : ""}`} style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
        {!cover && <CategoryIcon icon={visual.icon} label={article.category} />}
      </span>
      <span className="category-article-body">
        <span className="category-article-badge">{article.category}</span>
        <b><HighlightedText text={article.title} keyword={keyword} /></b>
        <small><HighlightedText text={article.excerpt} keyword={keyword} /></small>
        {matchText && <small className="category-article-match">匹配内容：<HighlightedText text={matchText} keyword={keyword} /></small>}
        <em>
          <span>全栈小码哥</span>
          <span>{article.date}</span>
          <span>{article.reads}</span>
          <strong>{primaryTag}</strong>
        </em>
      </span>
    </button>
  );
}
