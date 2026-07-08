import type { AdminCategoryItem } from "../services/api";
import CategoryIcon from "./CategoryIcon";
import { categoryVisualStyle, getCategoryVisual } from "./categoryVisuals";

export default function CategoryItem({
  category,
  active,
  count,
  onSelect,
}: {
  category: AdminCategoryItem;
  active: boolean;
  count?: number;
  onSelect: () => void;
}) {
  const visual = getCategoryVisual(category);
  const displayCount = count ?? visual.postsCount ?? 0;

  return (
    <button
      type="button"
      className={`category-item ${active ? "active" : ""}`}
      style={categoryVisualStyle(visual)}
      onClick={onSelect}
    >
      <CategoryIcon icon={visual.icon} label={visual.name} />
      <span>{visual.name}</span>
      <small>{displayCount}</small>
    </button>
  );
}
