import rss from "@astrojs/rss";
import { getArticleEntrySort, getPublicEntries } from "../utils/content-utils";
import { siteConfig, profileConfig } from "../config";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const [articles, resources, thoughts, journey] = await Promise.all([
    getArticleEntrySort("zh-cn"),
    getPublicEntries("resources"),
    getPublicEntries("thoughts"),
    getPublicEntries("journey"),
  ]);

  const items = [
    ...articles.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.pubDate,
      description: entry.data.description,
      link: `/articles/${entry.data.slug}/`,
      category: "文章",
    })),
    ...resources.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.pubDate,
      description: entry.data.description,
      link: `/resources/${entry.data.slug}/`,
      category: "资料",
    })),
    ...thoughts.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.pubDate,
      description: entry.data.description,
      link: `/thoughts/${entry.data.id}/`,
      category: "想法",
    })),
    ...journey.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.pubDate,
      description: entry.data.summary,
      link: `/journey/${entry.data.slug}/`,
      category: "旅程",
    })),
  ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

  return rss({
    title: `${siteConfig.title} - ${siteConfig.subTitle}`,
    description: profileConfig.description,
    site: context.site ?? "https://miles-gift.github.io",
    items: items.slice(0, 30).map((item) => ({
      title: item.title,
      pubDate: item.pubDate,
      description: item.description,
      link: item.link,
      categories: [item.category],
    })),
    customData: "<language>zh-cn</language>",
  });
}
