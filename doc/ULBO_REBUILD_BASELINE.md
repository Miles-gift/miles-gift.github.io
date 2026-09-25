# Ulbo 重构前基线

> 记录日期：2026-09-25  
> 基线提交：`0c14a1b`（`style: widen reading layouts`）  
> 重构分支：`codex/ulbo-redesign`  
> 远程仓库：`Miles-gift/miles-gift.github.io`

## 仓库与内容

- Astro `^7.2.1`，pnpm `11.12.0`，Node.js `v26.0.0`。
- 站点根目录：`https://miles-gift.github.io/`；部署由 `.github/workflows/deploy.yml` 管理。
- 公开内容共 37 条：文章 4 条、资料 9 条、短想法 3 条、旅程 21 条。
- 本次质量构建生成 98 个 HTML 页面；其中 Pagefind 收录 38 个页面、3,907 个词。
- 站点地图包含核心栏目、公开内容、标签和主题页面。

## 阶段 0 质量结果

已执行 `pnpm quality`，结果如下：

| 检查项 | 结果 |
| --- | --- |
| Astro 与站点、Studio TypeScript 检查 | 通过 |
| 内容健康检查 | 37 条正式内容、37 条公开；无资料超过 180 天未复核 |
| 内容预检 | 37 个 Markdown 文件；无重复路径或禁止附件 |
| Astro 生产构建 | 98 个 HTML 页面生成 |
| Pagefind | 38 个页面、3,907 个词 |
| 公开产物检查 | 通过；2,928 条内部链接、站点地图与 robots 有效 |
| 展示字体生成 | 155 个 WOFF2 分片，5.02 MiB |

pnpm 在启动时尝试访问 npm registry 检查版本更新，因当前网络限制显示 `ERR_PNPM_META_FETCH_FAIL`。本地 lockfile 检查、所有质量步骤和最终构建均正常通过。Node.js 还输出 `module.register()` 弃用提示；未影响构建。

## 视觉截图基线

现有 `doc/images/` 与 `doc/baseline/` 图片的文件时间为 2026-09-09，来自更早的 Momo 模板阶段，不能作为 2026-09-25 当前页面的有效截图对照。本阶段尝试通过浏览器界面打开现站，但当前 Mac 处于锁定状态，无法完成浏览器截图。

在首次修改全站布局或样式之前补充当前站点截图，建议覆盖：

| 页面 | 视口 | 主题 |
| --- | --- | --- |
| 首页 | 1440 × 900、390 × 844 | 浅色、深色 |
| 文章列表与长文详情 | 1440 × 900、390 × 844 | 浅色 |
| 资料库与资料详情 | 1440 × 900、390 × 844 | 浅色 |
| 旅程、关于、搜索 | 1440 × 900、390 × 844 | 浅色 |

截图记录浏览器、视口、主题、提交 SHA 与页面 URL，保存后供后续阶段做视觉回归比较。

## 路由覆盖

当前生产构建包含以下核心路径与内容页：

```text
/
/articles/                  /articles/<slug>/
/resources/                 /resources/<slug>/
/thoughts/<id>/
/journey/                   /journey/<slug>/
/about/                     /archives/
/search/                    /tags/<tag>/
/topics/<topic>/            /404.html
/sitemap.xml
```

文章、资料、短想法和旅程详情的 slug/id 清单保留在 `src/content/` 对应目录；重构阶段逐条核对生成 URL。既有 `/blog/<slug>/` 与 `/archive/` 兼容路由根据 `doc/REDIRECTS.md` 继续验证。

## 阶段 0 结论

质量与内容基线已建立，现有公开内容和路由总量已记录。当前站点的实时截图待浏览器可用时、且在阶段 2 修改全站视觉前补齐；已存在的旧截图不冒充为当前视觉基线。
