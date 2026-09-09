import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(projectRoot, "src", "content");
const taxonomy = JSON.parse(await readFile(path.join(contentRoot, "taxonomy.json"), "utf8"));
const collections = ["articles", "resources", "thoughts", "journey", "pages"];
const errors = [];
const seen = new Map();
let checked = 0;

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

function frontmatterOf(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) errors.push(`${file}: 缺少 YAML frontmatter`);
  return match?.[1] ?? "";
}

function scalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*["']?([^\\n"']+?)["']?\\s*$`, "m"));
  return match?.[1]?.trim();
}

for (const collection of collections) {
  const base = path.join(contentRoot, collection);
  const files = await markdownFiles(base);
  for (const absolute of files) {
    checked += 1;
    const relative = path.relative(projectRoot, absolute);
    const frontmatter = frontmatterOf(await readFile(absolute, "utf8"), relative);
    const identifierKey = collection === "thoughts" ? "id" : "slug";
    const identifier = scalar(frontmatter, identifierKey);
    const topic = scalar(frontmatter, "topic");

    if (!identifier) {
      errors.push(`${relative}: 缺少 ${identifierKey}`);
    } else {
      const urlKey = `${collection}/${identifier}`;
      if (seen.has(urlKey)) errors.push(`${relative}: 与 ${seen.get(urlKey)} 重复使用 ${identifier}`);
      else seen.set(urlKey, relative);

      const expected = collection === "articles"
        ? path.basename(path.dirname(absolute))
        : path.basename(absolute, ".md");
      if (identifier !== expected) errors.push(`${relative}: ${identifierKey} 应与路径标识 ${expected} 一致`);
    }

    if (topic && !taxonomy.topics.includes(topic)) {
      errors.push(`${relative}: topic“${topic}”不在受控词表中`);
    }
  }
}

const forbidden = (await readdir(contentRoot, { recursive: true }))
  .filter((name) => /\.(?:pdf|docx?|xlsx?|pptx?|zip|7z|rar)$/i.test(name));
if (forbidden.length) errors.push(`内容目录中发现禁止公开的附件：${forbidden.join(", ")}`);

if (errors.length) {
  console.error("内容预检失败：");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`内容预检通过：${checked} 个 Markdown 文件，${taxonomy.topics.length} 个受控主题，未发现重复路径或禁止附件。`);
