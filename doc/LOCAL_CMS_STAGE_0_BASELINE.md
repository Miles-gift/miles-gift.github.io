# 本地博客 CMS 阶段 0：基线与范围记录

- 日期：2026-09-26
- 仓库：`Miles-gift/miles-gift.github.io`
- 基线分支：`main`
- 基线提交：`3dd55238788f5afaf447ae134987dcc6e5f7bd41`（`feat: set profile avatar`）
- 实施分支：`codex/local-blog-cms`
- Node.js：`v26.0.0`（满足仓库 `>=22.12.0`）
- npm：`11.12.1`（满足仓库 `>=9.6.5`）
- 回退 tag：`cms-baseline-20260926`

## 工作区与远程

分支创建前，`main` 与 `origin/main` 同步，工作区除本次新增的执行计划外干净。执行计划随本阶段提交到实施分支。当前 Git 远程 `origin` 指向 `Miles-gift/miles-gift.github.io`，`upstream` 指向原 Momo 仓库；本地 CMS 发布目标只使用 `origin/main`。

## 文章源文件基线

当前正式文章为 4 篇，以下 SHA-256 用于后续比较未编辑内容和验证回退：

| 文件 | SHA-256 |
| --- | --- |
| `src/content/blog/content-operating-system.md` | `09d6242d2557a2f36737a34c82cdc56cd46b7b075c68193cf409ebf0324ab725` |
| `src/content/blog/public-not-private.md` | `0a18f6d11fa0c421de0e19f9aae3042a446a100efced01d3d7882ebeff43abd7` |
| `src/content/blog/site-start.md` | `1d3cfa9446c93d541c76bd25e7a8702b3f8a06d866282ca98423fa04d042ed65` |
| `src/content/blog/why-a-digital-garden.md` | `6632631706f9f95faa94d3ecda3bb64249771d638a6b064cb1f372a3d6b8bf50` |

文章当前使用 `title`、`date`、`updated`、`description`、`draft`、`categories`、`tags` frontmatter。图片引用包括 `public/illustrations/content-loop.svg` 与 `public/illustrations/publication-boundary.svg`；CMS 上传媒体应使用单独目录。

## 构建与 Pages 基线

仓库已有 `.github/workflows/deploy.yml`：`main` push 执行 `npm ci`、Astro 检查、Vitest、frontmatter 检查和构建，然后调用 GitHub Pages artifact/deploy action 并检查线上路由。此前的部署记录中，Astro Pages 工作流 run `36213026781` 成功；GitHub 同时出现过默认 Jekyll 检查 run `36213026871` 失败。该失败与已成功的 Astro workflow 分开记录，阶段 4 需核查 GitHub Pages 发布来源及状态展示逻辑，不能把两种运行混为 CMS 发布结果。

当前部署验证固定列出最初的 4 篇文章和旧 URL，因此新增/删除功能完成前必须先将这部分检查改为动态内容清单。

## 当前范围决定

- 本机单作者使用，不提供公网 `/admin`、云端编辑或公开写接口。
- 文章 URL 使用文件 slug；重命名公开文章需要显式迁移流程。
- 私有草稿放在 `.local-cms/`，CMS 发布只推选定且通过检查的公开内容。
- CMS 样式复用 Ulbo 字体与颜色变量；网站模板原有布局及阅读交互保持原样。

## 阶段 0 验收

- [x] 仓库基线、远端、运行时版本和文章清单已记录。
- [x] 对文章源文件记录 SHA-256，用于后续内容保护核验。
- [x] 建立回退 tag `cms-baseline-20260926`。
- [x] 确认 Pages workflow 与硬编码路由检查的风险点。
- [x] 本阶段文档与执行计划已提交并推送到实施分支。
