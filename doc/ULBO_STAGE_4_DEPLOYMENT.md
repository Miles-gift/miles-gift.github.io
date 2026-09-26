# 阶段 4：旧文章地址与 GitHub Pages 适配

## 旧文章地址

新增静态路由 `src/pages/articles/[slug].astro`，依据 Ulbo `blog` Collection 生成四个旧 URL 页面。每个页面使用 `noindex,follow`、canonical 和即时 meta refresh 指向对应 `/blog/<slug>/`，同时保留可点击的标题链接作为回退。该页不修改 Ulbo 博客文章页面及其组件。

上游原生 `/blog/<slug>/` 路由现在直接展示文章，不存在原站旧版反向跳转。redirect 路由不加入 sitemap；RSS 与搜索仍只由 Ulbo blog Collection 生成。

旧资料库、短想法、旅程和其它原站栏目没有生成替代路由，也没有加入导航/索引。

## GitHub Pages 部署

- 新增 `.github/workflows/deploy.yml`，在 `main` 推送时用 Node 22.12 与 `npm ci` 检查、测试、校验 Frontmatter、构建 `dist` 并通过 Actions 部署 GitHub Pages。
- 部署后验证首页、Ulbo 原生博客/文章/标签/关于/RSS/robots/sitemap，以及四条旧文章跳转页。
- `astro.config.mjs` 的 `site` 已由阶段 2 配置为 `https://miles-gift.github.io`；该 GitHub 用户站点直接部署在域名根路径，无项目子路径 `base`。
- sitemap 过滤 `/articles/` 跳转页，避免把 noindex 迁移地址作为规范页面提交。

## 验证记录

| 命令/检查 | 结果 |
| --- | --- |
| `.github/workflows/deploy.yml` YAML 解析 | 通过；build/deploy/verify 三个 job。 |
| `npm run check` | 通过：93 files，0 errors/warnings/hints。 |
| `npm run build` | 通过：21 page(s)，包含四条旧文章跳转页和四个 Ulbo 原生博客详情。 |
| 跳转 HTML 核验 | 四条均含正确目标、canonical 与 `noindex,follow`。 |
| sitemap 核验 | 不含 `/articles/`、`/resources/`、`/journey/` 等退役栏目。 |

GitHub Pages 工作流仅在 `main` 上触发。本阶段推送至 `codex/ulbo-exact-template` 只保存部署配置，不发布线上站点；合并阶段在最终验收后执行。

## 阶段 4 完成清单

- [x] 四条旧文章 URL 跳转到对应 Ulbo blog 地址。
- [x] 跳转页面不进入 sitemap、RSS 或搜索索引。
- [x] GitHub Pages 的 npm/Node 构建部署流程已配置。
- [x] 本地构建、路由与 sitemap 检查通过。
- [x] 本阶段变更与检查已完成（提交、推送随后进行）。
