import fs from "node:fs";
import path from "node:path";

function loadDotEnv() {
  const file = path.resolve("backend/.env");
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

function numberFromEnv(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export const config = {
  port: Number(process.env.PORT ?? 8000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://blog:blog123456@127.0.0.1:5432/blog_dev",
  adminDefaultPassword: process.env.ADMIN_DEFAULT_PASSWORD ?? "password",
  adminSessionDays: Number(process.env.ADMIN_SESSION_DAYS ?? 7),
  qwenApiKey: process.env.DASHSCOPE_API_KEY ?? process.env.QWEN_API_KEY ?? "",
  qwenBaseUrl: process.env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
  qwenModel: process.env.QWEN_MODEL ?? "qwen-plus",
  qwenResponsesModel: process.env.QWEN_RESPONSES_MODEL ?? process.env.QWEN_MODEL ?? "qwen-plus",
  qwenTimeoutMs: numberFromEnv(process.env.QWEN_TIMEOUT_MS, 30000),
  qwenResponsesTimeoutMs: numberFromEnv(process.env.QWEN_RESPONSES_TIMEOUT_MS, 90000),
  aiWebSearchEnabled: (process.env.AI_WEB_SEARCH_ENABLED ?? "false").toLowerCase() === "true",
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://127.0.0.1:3000,http://127.0.0.1:5173")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
};
