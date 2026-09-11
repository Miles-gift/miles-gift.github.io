import { getCollection, getEntry } from "astro:content";
import type { CollectionEntry } from "astro:content";
import { i18n } from "astro:config/client";

export type ArticleEntryWithLocaleStatus = CollectionEntry<"articles"> & {
  isFallback?: boolean;
};

function isListable(data: { draft?: boolean; visibility?: string }) {
  if (!import.meta.env.PROD) return true;
  return data.draft !== true && data.visibility === "public";
}

export async function getArticleEntrySort(
  lang: string = i18n?.defaultLocale || "zh-cn",
  filter?: (entry: CollectionEntry<"articles">) => boolean | undefined,
  sort?: (a: CollectionEntry<"articles">, b: CollectionEntry<"articles">) => number,
): Promise<ArticleEntryWithLocaleStatus[]> {
  const defaultSort = (a: CollectionEntry<"articles">, b: CollectionEntry<"articles">) => {
    return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
  };
  const entries = await getCollection("articles", filter || ((entry) => isListable(entry.data)));
  const grouped = new Map<string, Record<string, CollectionEntry<"articles">>>();
  const defaultLanguage = i18n?.defaultLocale || "zh-cn";

  for (const entry of entries) {
    if (!grouped.has(entry.data.slug)) grouped.set(entry.data.slug, {});
    grouped.get(entry.data.slug)![entry.data.lang] = entry;
  }

  const selected: ArticleEntryWithLocaleStatus[] = [];
  for (const [id, translations] of grouped) {
    const localized = translations[lang];
    const fallback = translations[defaultLanguage];
    const entry = localized || fallback;
    if (!entry) continue;
    selected.push({ ...entry, id, isFallback: !localized && Boolean(fallback) });
  }

  return selected.sort(sort || defaultSort);
}

export async function getPublicEntries<K extends "resources" | "thoughts" | "journey">(
  collection: K,
): Promise<CollectionEntry<K>[]> {
  return getCollection(collection, (entry) => isListable(entry.data));
}

export function entryPath(entry: CollectionEntry<"articles" | "resources" | "thoughts" | "journey">) {
  if (entry.collection === "articles") return `/articles/${entry.data.slug}/`;
  if (entry.collection === "resources") return `/resources/${entry.data.slug}/`;
  if (entry.collection === "thoughts") return `/thoughts/${entry.data.id}/`;
  return `/journey/${entry.data.slug}/`;
}

export async function getSpec(lang: string, spec: string) {
  const defaultLanguage = i18n?.defaultLocale || "zh-cn";
  let collection = await getEntry("spec", `${spec}/${lang}`);
  if (!collection) collection = await getEntry("spec", `${spec}/${defaultLanguage}`);
  return collection;
}
