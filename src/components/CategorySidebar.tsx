import type { AdminCategoryItem } from "../services/api";
import CategoryItem from "./CategoryItem";

export type CategoryListMode = "featured" | "all" | "category" | "search";

export default function CategorySidebar({
  categories,
  activeMode,
  activeCategory,
  totalPosts,
  featuredCount,
  onFeatured,
  onAll,
  onCategory,
}: {
  categories: AdminCategoryItem[];
  activeMode: CategoryListMode;
  activeCategory?: string;
  totalPosts: number;
  featuredCount: number;
  onFeatured: () => void;
  onAll: () => void;
  onCategory: (category: string) => void;
}) {
  const featuredCategory: AdminCategoryItem = {
    id: -1,
    name: "精选文章",
    slug: "featured",
    postsCount: featuredCount,
  };
  const allCategory: AdminCategoryItem = {
    id: 0,
    name: "全部文章",
    slug: "all",
    postsCount: totalPosts,
  };

  return (
    <aside className="category-sidebar" aria-label="文章分类">
      <header>
        <span className="category-sidebar-mark" aria-hidden="true" />
        <b>文章分类</b>
      </header>
      <div className="category-list">
        <CategoryItem category={featuredCategory} active={activeMode === "featured"} count={featuredCount} onSelect={onFeatured} />
        <CategoryItem category={allCategory} active={activeMode === "all"} count={totalPosts} onSelect={onAll} />
        {categories.map((item) => (
          <CategoryItem
            key={item.id || item.slug || item.name}
            category={item}
            active={activeMode === "category" && activeCategory === item.name}
            count={item.postsCount}
            onSelect={() => onCategory(item.name)}
          />
        ))}
      </div>
    </aside>
  );
}
