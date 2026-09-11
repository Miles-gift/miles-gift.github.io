import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = true;

const isPublic = (data: { draft?: boolean; visibility?: string }) => data.draft !== true && data.visibility === "public";
const xmlEscape = (value: string) => value.replace(/[<>&'\"]/g, (char) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
})[char] || char);

export const GET: APIRoute = async ({ site }) => {
  const origin = site || new URL("https://miles-gift.github.io");
  const [articles, resources, thoughts, journey] = await Promise.all([
    getCollection("articles", (entry) => isPublic(entry.data)),
    getCollection("resources", (entry) => isPublic(entry.data)),
    getCollection("thoughts", (entry) => isPublic(entry.data)),
    getCollection("journey", (entry) => isPublic(entry.data)),
  ]);
  const records = [
    { path: "/", priority: "1.0" },
    { path: "/articles/", priority: "0.9" },
    { path: "/resources/", priority: "0.9" },
    { path: "/journey/", priority: "0.8" },
    { path: "/about/", priority: "0.8" },
    { path: "/archives/", priority: "0.6" },
    ...articles.map((entry) => ({ path: `/articles/${entry.data.slug}/`, lastmod: entry.data.updatedDate || entry.data.pubDate, priority: "0.8" })),
    ...resources.map((entry) => ({ path: `/resources/${entry.data.slug}/`, lastmod: entry.data.lastReviewedAt || entry.data.pubDate, priority: "0.7" })),
    ...thoughts.map((entry) => ({ path: `/thoughts/${entry.data.id}/`, lastmod: entry.data.pubDate, priority: "0.6" })),
    ...journey.map((entry) => ({ path: `/journey/${entry.data.slug}/`, lastmod: entry.data.pubDate, priority: "0.6" })),
  ];
  const allEntries = [...articles, ...resources, ...thoughts];
  const topics = [...new Set(allEntries.map((entry) => entry.data.topic))];
  const tags = [...new Set(allEntries.flatMap((entry) => entry.data.tags))];
  records.push(...topics.map((topic) => ({ path: `/topics/${encodeURIComponent(topic)}/`, priority: "0.5" })));
  records.push(...tags.map((tag) => ({ path: `/tags/${encodeURIComponent(tag)}/`, priority: "0.4" })));

  const urls = records.map((record) => {
    const loc = xmlEscape(new URL(record.path, origin).href);
    const lastmod = "lastmod" in record && record.lastmod instanceof Date
      ? `<lastmod>${record.lastmod.toISOString().slice(0, 10)}</lastmod>`
      : "";
    return `<url><loc>${loc}</loc>${lastmod}<priority>${record.priority}</priority></url>`;
  }).join("");

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
