import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(projectRoot, "src", "content");
const reportPath = path.join(projectRoot, "doc", "CONTENT_HEALTH_REPORT.md");
const collections = ["articles", "resources", "thoughts", "journey"];
const collectionLabels = {
  articles: "长篇札记",
  resources: "资料原文",
  thoughts: "灵光便笺",
  journey: "旅程坐标",
};
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.split("=");
  return [key, value.join("=")];
}));
const asOfText = args.get("--as-of") || new Date().toISOString().slice(0, 10);
const asOf = new Date(`${asOfText}T00:00:00Z`);

if (Number.isNaN(asOf.getTime())) {
  console.error(`内容健康检查失败：无效日期 ${asOfText}`);
  process.exit(1);
}

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_")) files.push(absolute);
  }
  return files.sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function frontmatterOf(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${file}: 缺少 YAML frontmatter`);
  return match[1];
}

function scalar(frontmatter, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = frontmatter.match(new RegExp(`^${escaped}:\\s*(.*?)\\s*$`, "m"));
  if (!match) return "";
  const value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function inlineArray(frontmatter, key) {
  const value = scalar(frontmatter, key);
  if (!value.startsWith("[") || !value.endsWith("]")) return [];
  return value.slice(1, -1)
    .split(",")
    .map((item) => item.trim().replace(/^(?:"|')|(?:"|')$/g, ""))
    .filter(Boolean);
}

function isPublic(item) {
  return item.draft !== "true" && item.visibility === "public";
}

function countBy(items, field) {
  const counts = new Map();
  for (const item of items) {
    const value = item[field] || "未填写";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, "zh-CN"));
}

function markdownTable(rows, emptyText) {
  if (!rows.length) return emptyText;
  return rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
}

const taxonomy = JSON.parse(await readFile(path.join(contentRoot, "taxonomy.json"), "utf8"));
const items = [];

try {
  for (const collection of collections) {
    const files = await markdownFiles(path.join(contentRoot, collection));
    for (const absolute of files) {
      const relative = path.relative(projectRoot, absolute);
      const frontmatter = frontmatterOf(await readFile(absolute, "utf8"), relative);
      items.push({
        collection,
        relative,
        identifier: scalar(frontmatter, collection === "thoughts" ? "id" : "slug"),
        title: scalar(frontmatter, "title") || "未命名",
        topic: scalar(frontmatter, "topic"),
        visibility: scalar(frontmatter, "visibility") || "未填写",
        draft: scalar(frontmatter, "draft") || "false",
        lastReviewedAt: scalar(frontmatter, "lastReviewedAt"),
        tags: inlineArray(frontmatter, "tags"),
      });
    }
  }
} catch (error) {
  console.error(`内容健康检查失败：${error.message}`);
  process.exit(1);
}

const publicItems = items.filter(isPublic);
const draftItems = items.filter((item) => !isPublic(item));
const publicResources = publicItems.filter((item) => item.collection === "resources");
const missingReviewDate = publicResources.filter((item) => !item.lastReviewedAt);
const invalidReviewDate = publicResources.filter((item) => item.lastReviewedAt && Number.isNaN(new Date(`${item.lastReviewedAt}T00:00:00Z`).getTime()));
const staleResources = publicResources
  .map((item) => {
    const reviewedAt = new Date(`${item.lastReviewedAt}T00:00:00Z`);
    const ageDays = Number.isNaN(reviewedAt.getTime()) ? -1 : Math.floor((asOf - reviewedAt) / 86_400_000);
    return { ...item, ageDays };
  })
  .filter((item) => item.ageDays > 180)
  .sort((a, b) => b.ageDays - a.ageDays || a.title.localeCompare(b.title, "zh-CN"));

const tagCounts = new Map();
for (const item of publicItems) {
  for (const tag of item.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
}
const oneUseTags = [...tagCounts.entries()]
  .filter(([, count]) => count === 1)
  .map(([tag]) => tag)
  .sort((a, b) => a.localeCompare(b, "zh-CN"));
const usedTopics = new Set(publicItems.map((item) => item.topic).filter(Boolean));
const unusedTopics = taxonomy.topics.filter((topic) => !usedTopics.has(topic));

const collectionRows = collections.map((collection) => {
  const all = items.filter((item) => item.collection === collection);
  return [collectionLabels[collection], all.length, all.filter(isPublic).length, all.filter((item) => !isPublic(item)).length];
});
const topicRows = countBy(publicItems.filter((item) => item.topic), "topic").map(([topic, count]) => [topic, count]);
const visibilityRows = countBy(items, "visibility").map(([visibility, count]) => [visibility, count]);

const report = `# 内容健康报告

> 统计日期：${asOfText}
> 自动生成：\`pnpm content:health:write\`
> 口径：\`src/content/\` 四个正式内容集合；公开内容为 \`draft: false\` 且 \`visibility: public\`

## 1. 总览

| 指标 | 数量 |
| --- | ---: |
| 正式内容 | ${items.length} |
| 公开内容 | ${publicItems.length} |
| 草稿或非公开内容 | ${draftItems.length} |
| 受控主题 | ${taxonomy.topics.length} |
| 已使用主题 | ${usedTopics.size} |
| 公开资料 | ${publicResources.length} |
| 超过 180 天未复核的公开资料 | ${staleResources.length} |
| 只出现一次的标签 | ${oneUseTags.length} |

## 2. 内容类型分布

| 类型 | 总数 | 公开 | 草稿/非公开 |
| --- | ---: | ---: | ---: |
${markdownTable(collectionRows, "暂无正式内容。")}

## 3. 公开主题分布

| 主题 | 数量 |
| --- | ---: |
${markdownTable(topicRows, "暂无带主题的公开内容。")}

未使用的受控主题：${unusedTopics.length ? unusedTopics.map((topic) => `\`${topic}\``).join("、") : "无"}。

## 4. 可见性分布

| 可见性 | 数量 |
| --- | ---: |
${markdownTable(visibilityRows, "暂无内容。")}

## 5. 资料复核队列

超过 180 天未复核：

${markdownTable(staleResources.map((item) => [`[${item.title}](../${item.relative})`, item.lastReviewedAt, `${item.ageDays} 天`]), "暂无。")}

缺少复核日期：${missingReviewDate.length ? missingReviewDate.map((item) => `\`${item.relative}\``).join("、") : "无"}。

复核日期无效：${invalidReviewDate.length ? invalidReviewDate.map((item) => `\`${item.relative}\``).join("、") : "无"}。

## 6. 标签整理提示

只出现一次的标签不代表错误，但应定期判断是保留其精确含义、合并近义词，还是等待后续内容自然形成聚类。

${oneUseTags.length ? oneUseTags.map((tag) => `- \`${tag}\``).join("\n") : "暂无单次标签。"}

## 7. 维护结论

${missingReviewDate.length || invalidReviewDate.length
  ? "存在公开资料复核日期缺失或无效，请先修正后再发布。"
  : staleResources.length
    ? `有 ${staleResources.length} 条公开资料超过 180 天未复核，应按队列逐条确认命令、链接和结论是否仍然有效。`
    : "所有公开资料均具有有效复核日期，当前没有超过 180 天的复核积压。"}
`;

if (args.has("--write")) {
  await writeFile(reportPath, report, "utf8");
  console.log(`内容健康报告已写入：${path.relative(projectRoot, reportPath)}`);
}

console.log(`内容健康检查通过：${items.length} 条正式内容，${publicItems.length} 条公开，${staleResources.length} 条资料超过 180 天未复核，${oneUseTags.length} 个单次标签。`);

if (missingReviewDate.length || invalidReviewDate.length) process.exit(1);
