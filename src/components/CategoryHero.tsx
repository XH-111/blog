import { sanitizeAssetUrl } from "../services/api";
import type { AdminCategoryItem } from "../services/api";
import CategoryIcon from "./CategoryIcon";
import { categoryVisualStyle, getCategoryVisual } from "./categoryVisuals";

export default function CategoryHero({
  category,
  count,
  sortMode,
  onSortChange,
}: {
  category: AdminCategoryItem;
  count: number;
  sortMode: "latest" | "hot";
  onSortChange: (value: "latest" | "hot") => void;
}) {
  const visual = getCategoryVisual(category);
  const cover = sanitizeAssetUrl(visual.cover);

  return (
    <section className="category-hero" style={categoryVisualStyle(visual)}>
      <div className="category-hero-copy">
        <CategoryIcon icon={visual.icon} label={visual.name} />
        <div>
          <h1>{visual.name}</h1>
          <p>{visual.description}</p>
          <span>共 {count} 篇文章</span>
        </div>
      </div>
      <div className={`category-hero-cover ${cover ? "has-cover" : ""}`} aria-hidden="true">
        {cover ? <img src={cover} alt="" loading="lazy" /> : <div className="category-hero-generated" />}
      </div>
      <div className="category-sort">
        <span>排序：</span>
        <select value={sortMode} onChange={(event) => onSortChange(event.target.value === "hot" ? "hot" : "latest")}>
          <option value="latest">最新发布</option>
          <option value="hot">热门浏览</option>
        </select>
      </div>
    </section>
  );
}
