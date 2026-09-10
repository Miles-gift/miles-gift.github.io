import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [slug, lang = "zh-cn"] = process.argv.slice(2);

if (!slug) {
  console.error("Usage: pnpm newpost <slug> [lang]");
  process.exit(1);
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error("Invalid slug. Use lowercase letters, numbers, and hyphens only.");
  process.exit(1);
}

if (lang !== "zh-cn") {
  console.error("Only zh-cn is enabled for the current launch baseline.");
  process.exit(1);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const articleDirectory = join(scriptDirectory, "..", "src", "content", "articles", slug);
const filePath = join(articleDirectory, `${lang}.md`);
const date = new Date().toISOString().slice(0, 10);

if (existsSync(filePath)) {
  console.error(`Article already exists: ${filePath}`);
  process.exit(1);
}

await mkdir(articleDirectory, { recursive: true });
await writeFile(filePath, `---
title: 待填写标题
slug: ${slug}
description: 请填写一段能够独立说明文章价值的摘要，建议控制在八十到一百六十字。
pubDate: ${date}
draft: true
visibility: draft
kind: article
maintenance: active
topic: 建站记录
tags: [待整理]
cover: ""
coverAlt: ""
featured: false
pinTop: 0
lang: zh-cn
canonical: ""
license: CC-BY-NC-SA-4.0
---

## 问题

这篇文章要解决什么问题？

## 过程

记录事实、尝试、失败与修正。

## 结论

写下可以复用的结论与下一步。
`, "utf8");

console.log(`Created draft article: ${filePath}`);
