import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(projectRoot, "src", "content");
const timeoutMs = Number(process.env.EXTERNAL_LINK_TIMEOUT_MS || 12_000);
const concurrency = Number(process.env.EXTERNAL_LINK_CONCURRENCY || 6);

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_")) files.push(absolute);
  }
  return files;
}

function linksIn(source) {
  return [...source.matchAll(/https?:\/\/[^\s<>()"'`]+/g)]
    .map(([link]) => link.replace(/[)\]},.;，。；！!?]+$/u, ""))
    .filter((link) => {
      try {
        const url = new URL(link);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    });
}

async function request(url, method) {
  const response = await fetch(url, {
    method,
    redirect: "follow",
    headers: {
      "user-agent": "yoyo-site-link-check/1.0 (+https://miles-gift.github.io/)",
      ...(method === "GET" ? { range: "bytes=0-0" } : {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  await response.body?.cancel();
  return { status: response.status, finalUrl: response.url };
}

async function check(url) {
  try {
    let result = await request(url, "HEAD");
    if ([403, 405, 406, 429].includes(result.status) || result.status >= 500) {
      result = await request(url, "GET");
    }
    if ([404, 410].includes(result.status)) return { url, kind: "broken", ...result };
    if (result.status >= 200 && result.status < 400) return { url, kind: "ok", ...result };
    return { url, kind: "warning", ...result, message: `HTTP ${result.status}` };
  } catch (error) {
    return { url, kind: "warning", status: 0, finalUrl: "", message: error.message };
  }
}

const sources = new Map();
for (const absolute of await markdownFiles(contentRoot)) {
  const relative = path.relative(projectRoot, absolute);
  for (const link of linksIn(await readFile(absolute, "utf8"))) {
    if (!sources.has(link)) sources.set(link, new Set());
    sources.get(link).add(relative);
  }
}

const urls = [...sources.keys()].sort();
const results = [];
let cursor = 0;

async function worker() {
  while (cursor < urls.length) {
    const index = cursor++;
    results[index] = await check(urls[index]);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));

const broken = results.filter((result) => result.kind === "broken");
const warnings = results.filter((result) => result.kind === "warning");
const ok = results.filter((result) => result.kind === "ok");

for (const result of [...broken, ...warnings]) {
  const level = result.kind === "broken" ? "失效" : "提示";
  const locations = [...sources.get(result.url)].join(", ");
  console.log(`- ${level}：${result.url}（${result.message || `HTTP ${result.status}`}；${locations}）`);
}

console.log(`外链巡检完成：${urls.length} 个唯一链接，${ok.length} 个正常，${broken.length} 个明确失效，${warnings.length} 个网络或访问提示。`);

if (broken.length) process.exit(1);
