import type { ReactNode } from "react";
import { sanitizeAssetUrl } from "../services/api";

const iconPaths: Record<string, ReactNode> = {
  code: (
    <>
      <path d="M10 8 5 13l5 5" />
      <path d="m14 20 4-16" />
      <path d="m18 8 5 5-5 5" />
    </>
  ),
  server: (
    <>
      <rect x="5" y="4" width="18" height="7" rx="2" />
      <rect x="5" y="13" width="18" height="7" rx="2" />
      <path d="M9 7h.01M9 16h.01M13 7h6M13 16h6" />
    </>
  ),
  database: (
    <>
      <ellipse cx="14" cy="6" rx="8" ry="3" />
      <path d="M6 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M6 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  cloud: (
    <>
      <path d="M8 18h12a4 4 0 0 0 .4-8 6 6 0 0 0-11.5-1.8A5 5 0 0 0 8 18Z" />
      <path d="M11 22h6" />
    </>
  ),
  tool: (
    <>
      <path d="M16.8 6.2a4.4 4.4 0 0 0-5.4 5.4L5 18l3 3 6.4-6.4a4.4 4.4 0 0 0 5.4-5.4l-3.1 3.1-3-3 3.1-3.1Z" />
    </>
  ),
  chat: (
    <>
      <path d="M6 7.5A4.5 4.5 0 0 1 10.5 3h7A4.5 4.5 0 0 1 22 7.5v4A4.5 4.5 0 0 1 17.5 16H13l-5 4v-4.3A4.5 4.5 0 0 1 6 11.5v-4Z" />
      <path d="M10 8h8M10 12h5" />
    </>
  ),
  sparkles: (
    <>
      <path d="m13 3 1.6 4.4L19 9l-4.4 1.6L13 15l-1.6-4.4L7 9l4.4-1.6L13 3Z" />
      <path d="m20 15 .9 2.1L23 18l-2.1.9L20 21l-.9-2.1L17 18l2.1-.9L20 15Z" />
      <path d="m6 16 .8 1.8L9 18.5l-2.2.7L6 21l-.8-1.8-2.2-.7 2.2-.7L6 16Z" />
    </>
  ),
  file: (
    <>
      <path d="M8 3h8l5 5v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M16 3v6h6M10 14h8M10 18h6" />
    </>
  ),
  ai: (
    <>
      <rect x="7" y="7" width="14" height="14" rx="3" />
      <path d="M10 3v4M14 3v4M18 3v4M10 21v4M14 21v4M18 21v4M3 10h4M3 14h4M3 18h4M21 10h4M21 14h4M21 18h4" />
      <path d="M11 17h1l2-6 2 6h1M12.5 15h3" />
    </>
  ),
  book: (
    <>
      <path d="M6 5.5A2.5 2.5 0 0 1 8.5 3H22v20H8.5A2.5 2.5 0 0 1 6 20.5v-15Z" />
      <path d="M6 19.5A2.5 2.5 0 0 1 8.5 17H22M10 8h7M10 12h5" />
    </>
  ),
  rocket: (
    <>
      <path d="M14 3c4 1 7 4 8 8l-5 5-5-5 5-5Z" />
      <path d="m12 11-6 2-2 6 6-2M17 16l-2 6-6 2 2-6" />
      <circle cx="17" cy="8" r="1.5" />
    </>
  ),
  search: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="m17.5 17.5 4 4" />
    </>
  ),
  folder: (
    <>
      <path d="M4 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
      <path d="M4 11h20" />
    </>
  ),
};

function iconKey(value = "") {
  const key = value.trim().toLowerCase().replace(/\s+/g, "-");
  if (key === "backend") return "server";
  if (key === "frontend") return "code";
  if (key === "devops") return "cloud";
  if (key === "tools") return "tool";
  if (key === "notes") return "chat";
  if (key === "ai-engineering" || key === "ai") return "ai";
  if (key === "learning" || key === "study") return "book";
  if (key === "project" || key === "projects") return "rocket";
  return key || "folder";
}

export default function CategoryIcon({ icon, label }: { icon?: string; label?: string }) {
  const rawIcon = String(icon || "").trim();
  const imageUrl = sanitizeAssetUrl(rawIcon);

  return (
    <span className="category-icon" aria-hidden={label ? undefined : true} aria-label={label}>
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" />
      ) : rawIcon.startsWith("<svg") ? (
        <span className="category-icon-inline-svg" dangerouslySetInnerHTML={{ __html: rawIcon }} />
      ) : (
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {iconPaths[iconKey(rawIcon)] ?? iconPaths.folder}
        </svg>
      )}
    </span>
  );
}
