import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { closePool, query } from "../src/db.js";

const uploadRoot = path.resolve(process.cwd(), "public", "uploads");

function uploadUrlFromStoragePath(storagePath) {
  const relative = path.relative(uploadRoot, storagePath).split(path.sep).join("/");
  return `/uploads/${relative}`;
}

function variantPath(storagePath, suffix) {
  const parsed = path.parse(storagePath);
  return path.join(parsed.dir, `${parsed.name}-${suffix}.webp`);
}

async function ensureColumns() {
  await query(`
    ALTER TABLE media_assets
      ADD COLUMN IF NOT EXISTS thumbnail_url text,
      ADD COLUMN IF NOT EXISTS display_url text
  `);
}

async function generate(row) {
  const sourcePath = path.resolve(row.storage_path);
  if (!sourcePath.startsWith(`${uploadRoot}${path.sep}`)) return { skipped: true, reason: "outside_upload_root" };
  const thumbPath = variantPath(sourcePath, "thumb");
  const displayPath = variantPath(sourcePath, "display");
  await mkdir(path.dirname(thumbPath), { recursive: true });
  const image = sharp(sourcePath, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  await Promise.all([
    image.clone().resize({ width: 480, height: 360, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toFile(thumbPath),
    image.clone().resize({ width: 1400, height: 900, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toFile(displayPath),
  ]);
  await query(
    `UPDATE media_assets
     SET thumbnail_url = $1,
         display_url = $2,
         width = COALESCE(width, $3),
         height = COALESCE(height, $4)
     WHERE id = $5`,
    [uploadUrlFromStoragePath(thumbPath), uploadUrlFromStoragePath(displayPath), metadata.width ?? null, metadata.height ?? null, row.id],
  );
  return { skipped: false };
}

async function main() {
  await ensureColumns();
  const result = await query(`
    SELECT id, mime_type, storage_path
    FROM media_assets
    WHERE mime_type IN ('image/jpeg', 'image/png', 'image/webp')
      AND storage_path IS NOT NULL
      AND (thumbnail_url IS NULL OR thumbnail_url = '' OR display_url IS NULL OR display_url = '')
    ORDER BY id
  `);
  let generated = 0;
  let skipped = 0;
  for (const row of result.rows) {
    try {
      const outcome = await generate(row);
      if (outcome.skipped) skipped += 1;
      else generated += 1;
    } catch (error) {
      skipped += 1;
      console.warn(`media ${row.id} variant failed: ${error?.message || error}`);
    }
  }
  console.log(`media variants completed: generated=${generated}, skipped=${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
