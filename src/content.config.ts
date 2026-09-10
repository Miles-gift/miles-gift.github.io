import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import taxonomy from "./content/taxonomy.json";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug 必须使用小写英文、数字和连字符");
const topics = taxonomy.topics as [string, ...string[]];
const resourceTypes = taxonomy.resourceTypes as [string, ...string[]];
const resourceStatuses = taxonomy.resourceStatuses as [string, ...string[]];
const journeyKinds = taxonomy.journeyKinds as [string, ...string[]];
const visibilities = taxonomy.visibilities as [string, ...string[]];
const licenses = taxonomy.licenses as [string, ...string[]];

const visibility = z.enum(visibilities).default("public");
const topic = z.enum(topics);
const tags = z.array(z.string().trim().min(1).max(32)).min(1).max(6);
const optionalUrl = z.union([z.literal(""), z.string().url()]).optional().default("");
const timelineDate = z.string().regex(/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/, "时间必须是 YYYY、YYYY-MM 或 YYYY-MM-DD");

const articleCollection = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string().trim().min(2).max(80),
    slug,
    description: z.string().trim().min(12).max(220),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    visibility,
    kind: z.literal("article"),
    maintenance: z.enum(["active", "stable", "archived"]).default("active"),
    topic,
    tags,
    series: z.string().trim().max(48).optional(),
    seriesOrder: z.number().int().positive().optional(),
    cover: z.string().default(""),
    coverAlt: z.string().max(160).default(""),
    featured: z.boolean().default(false),
    pinTop: z.number().int().min(0).max(3).default(0),
    lang: z.literal("zh-cn").default("zh-cn"),
    canonical: optionalUrl,
    license: z.enum(licenses).default("CC-BY-NC-SA-4.0"),
  }).strict(),
});

const resourceCollection = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/resources" }),
  schema: z.object({
    title: z.string().trim().min(2).max(100),
    slug,
    description: z.string().trim().min(12).max(220),
    pubDate: z.coerce.date(),
    resourceType: z.enum(resourceTypes),
    topic,
    tags,
    sourceKind: z.enum(["personal-note", "external"]).default("personal-note"),
    sourceUrl: optionalUrl,
    author: z.string().trim().max(80).optional(),
    publisher: z.string().trim().max(80).optional(),
    publishedYear: z.number().int().min(1900).max(2100).optional(),
    language: z.string().trim().min(2).max(24).default("zh-cn"),
    status: z.enum(resourceStatuses),
    progress: z.number().int().min(0).max(100).default(0),
    rating: z.number().min(1).max(5).nullable().default(null),
    startedAt: z.coerce.date().optional(),
    completedAt: z.coerce.date().optional(),
    lastReviewedAt: z.coerce.date(),
    cover: z.string().default(""),
    coverAlt: z.string().max(160).default(""),
    takeaways: z.array(z.string().trim().min(2).max(120)).max(5).default([]),
    draft: z.boolean().default(false),
    visibility,
  }).strict(),
});

const thoughtCollection = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/thoughts" }),
  schema: z.object({
    id: z.string().regex(/^\d{8}-\d{3}$/),
    title: z.string().trim().min(2).max(60),
    description: z.string().trim().min(8).max(160),
    pubDate: z.coerce.date(),
    topic,
    tags,
    related: z.array(slug).max(6).default([]),
    draft: z.boolean().default(false),
    visibility,
  }).strict(),
});

const journeyCollection = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/journey" }),
  schema: z.object({
    title: z.string().trim().min(2).max(100),
    slug,
    pubDate: z.coerce.date(),
    startDate: timelineDate,
    endDate: timelineDate.nullable().default(null),
    dateLabel: z.string().trim().min(2).max(40),
    location: z.string().trim().max(80).optional(),
    organization: z.string().trim().max(100).optional(),
    role: z.string().trim().max(80).optional(),
    kind: z.enum(journeyKinds),
    summary: z.string().trim().min(8).max(220),
    highlights: z.array(z.string().trim().min(2).max(140)).max(5).default([]),
    skills: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
    featured: z.boolean().default(false),
    order: z.number().int().min(0).max(999).default(0),
    sourceLevel: z.enum(["user-provided", "verified-summary"]),
    projectTitle: z.string().trim().max(160).optional(),
    draft: z.boolean().default(false),
    visibility,
  }).strict(),
});

const pageCollection = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string().trim().min(2).max(80),
    slug,
    description: z.string().trim().min(12).max(220),
    updatedDate: z.coerce.date(),
    draft: z.boolean().default(false),
    visibility,
  }).strict(),
});

const specCollection = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/spec" }),
});

export const collections = {
  articles: articleCollection,
  resources: resourceCollection,
  thoughts: thoughtCollection,
  journey: journeyCollection,
  pages: pageCollection,
  spec: specCollection,
};
