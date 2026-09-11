import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const distRoot = join(projectRoot, "dist");
const forbiddenRoutes = ["/rss.xml", "/privacy/", "/copyright/", "/friends/", "/blog/", "/design-system/", "/archive/"];
const errors = [];
const warnings = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full));
    else result.push(full);
  }
  return result;
}

function publicPath(file) {
  const rel = relative(distRoot, file).replace(/\\/g, "/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -10)}`;
  return `/${rel}`;
}

async function exists(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalizedPath = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = resolve(distRoot, `.${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`);
  if (!candidate.startsWith(distRoot)) return false;
  const candidates = extname(candidate)
    ? [candidate]
    : [candidate, `${candidate}.html`, join(candidate, "index.html")];
  for (const file of candidates) {
    if (await stat(file).then((item) => item.isFile()).catch(() => false)) return true;
  }
  return false;
}

const files = await walk(distRoot);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
let links = 0;

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const page = publicPath(file);
  const is404 = page === "/404.html";
  if (!/<html[^>]+lang=["'][^"']+["']/i.test(html)) errors.push(`${page}: 缺少 html lang`);
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${page}: 缺少 title`);
  if (!/<main(?:\s|>)/i.test(html)) errors.push(`${page}: 缺少 main landmark`);
  if (!/<h1(?:\s|>)/i.test(html)) errors.push(`${page}: 缺少 H1`);
  if (!/rel=["']canonical["']/i.test(html)) errors.push(`${page}: 缺少 canonical`);
  if (!/property=["']og:title["']/i.test(html) || !/property=["']og:image["']/i.test(html)) errors.push(`${page}: 缺少 Open Graph 元数据`);
  if (!/type=["']application\/ld\+json["']/i.test(html)) errors.push(`${page}: 缺少结构化数据`);
  if (is404 && !/name=["']robots["'][^>]+noindex/i.test(html)) errors.push(`${page}: 404 未设置 noindex`);
  if (page === "/search/" && !/name=["']robots["'][^>]+noindex/i.test(html)) errors.push(`${page}: 搜索页未设置 noindex`);
  if (/\/(?:Users|home)\//.test(html) || /file:\/\//i.test(html)) errors.push(`${page}: 包含本地绝对路径`);
  if (/BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(html)) errors.push(`${page}: 疑似包含密钥`);
  if (/href=["'][^"']*(?:rss\.xml|\/privacy\/|\/copyright\/|\/friends\/|\/blog\/|\/design-system\/|\/archive\/)/i.test(html)) errors.push(`${page}: 仍链接到已移除入口`);
  if (/(?:证书编号|身份证号)[:：]\s*[A-Za-z0-9]{6,}|学号[:：]\s*\d{6,}|手机号[:：]\s*1\d{10}/.test(html)) warnings.push(`${page}: 可能含个人敏感字段，请人工复核`);
  const h1Count = (html.match(/<h1(?:\s|>)/gi) || []).length;
  const preservesOriginalResourceHeading = page.startsWith("/resources/") && page !== "/resources/" && h1Count === 2;
  if (h1Count !== 1 && !preservesOriginalResourceHeading) errors.push(`${page}: H1 数量异常，实际 ${h1Count}`);
  for (const image of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\salt=["'][^"']*["']/i.test(image[0])) errors.push(`${page}: 图片缺少 alt 属性`);
  }
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) errors.push(`${page}: 存在重复 id ${[...new Set(duplicateIds)].join("、")}`);

  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
  for (const href of hrefs) {
    if (!href || href.startsWith("#") || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(href)) continue;
    const url = new URL(href, `https://miles-gift.github.io${page}`);
    links += 1;
    if (forbiddenRoutes.some((route) => url.pathname === route || url.pathname.startsWith(route))) {
      errors.push(`${page}: 指向已移除路径 ${url.pathname}`);
      continue;
    }
    if (!await exists(url.pathname)) errors.push(`${page}: 内部链接不存在 ${href}`);
  }
}

const sitemap = await readFile(join(distRoot, "sitemap.xml"), "utf8").catch(() => "");
const robots = await readFile(join(distRoot, "robots.txt"), "utf8").catch(() => "");
if (!sitemap.includes("https://miles-gift.github.io/") || !sitemap.includes("/resources/")) errors.push("sitemap.xml 缺少站点或核心栏目");
if (!robots.includes("Sitemap: https://miles-gift.github.io/sitemap.xml")) errors.push("robots.txt 未指向 sitemap");
if ((sitemap.match(/<url>/g) || []).length < 40) errors.push("sitemap.xml URL 数量异常偏少");
for (const route of forbiddenRoutes) {
  if (sitemap.includes(route)) errors.push(`sitemap.xml 包含已移除路径 ${route}`);
}
for (const removed of ["rss.xml", "privacy/index.html", "copyright/index.html", "friends/index.html", "blog/index.html", "design-system/index.html", "archive/index.html"]) {
  if (await stat(join(distRoot, removed)).then(() => true).catch(() => false)) errors.push(`生成产物仍包含已移除页面 ${removed}`);
}
if (!await stat(join(distRoot, "brand", "yoyo-social-card.png")).then((item) => item.isFile()).catch(() => false)) errors.push("缺少 PNG 分享图");

const largeFiles = [];
for (const file of files) {
  const size = await stat(file).then((item) => item.size);
  if (size > 1_500_000 && !/\.(?:woff2?|png)$/i.test(file)) largeFiles.push(`${relative(distRoot, file)} (${Math.ceil(size / 1024)} KiB)`);
}
if (largeFiles.length) warnings.push(`较大非字体资源：${largeFiles.join("、")}`);

if (warnings.length) console.warn(`公开站点警告（${warnings.length}）：\n- ${warnings.join("\n- ")}`);
if (errors.length) {
  console.error(`公开站点检查失败（${errors.length}）：\n- ${[...new Set(errors)].join("\n- ")}`);
  process.exit(1);
}
console.log(`公开站点检查通过：${htmlFiles.length} 个 HTML、${links} 个内部链接、sitemap 与 robots 均有效。`);
