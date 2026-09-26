# 阶段 1：Ulbo 原版工程骨架

- 上游仓库：`https://github.com/xxy1103/ulbo-astro-theme-template`
- 上游 commit：`a2b499937642f509c7aa481e0e7409d3d399121e`
- 站点源工程：以上游源文件树覆盖 Momo 项目；保留 Git 历史、根 `.git`、迁移计划和阶段记录。
- 前端文件比对：`src/styles/global.css`、`src/components/BaseHead.astro`、`src/pages/index.astro` 与冻结上游逐字一致。
- 依赖比对：`package.json` 与 `package-lock.json` 与冻结上游逐字一致。
- 删除：旧 Momo Astro 页面/组件/CSS、旧四类 Collection、原 CMS、Pagefind、旧 pnpm 工作区及本地锁文件、旧工作流、Ulbo 演示文章。
- 当前 `src/content/blog/` 为空；未开始迁入作者文章，阶段 3 执行。
- GitHub Pages 工作流：本阶段保留上游 `.github/workflows/ci.yml`；部署流程在阶段 4 配置。

## 验证记录

| 命令 | 结果 |
| --- | --- |
| `npm ci --fetch-retries=8 --fetch-timeout=900000 --maxsockets=3` | 成功；安装 580 packages。初次联网安装遇到连接重置，缓存后重试成功。 |
| `npm run check` | 通过：92 files，0 errors/warnings/hints。提示上游 Astro Markdown 配置 API 已弃用。 |
| `npm test` | 通过：14 test files，54 tests。 |
| `npm run frontmatter:check` | 通过：0 files，0 errors。 |
| `npm run build` | 通过：输出含 `/`、`/about/`、`/blog/`、`/tags/`、`/robots.txt`、`/rss.xml`、`/search-index.json`；Astro 汇总显示 4 page(s) built。 |

## 保留的上游提示

- 空 blog collection 在首页、RSS、搜索和标签生成期间输出“collection empty”提示；迁入文章后复核。
- Build 提示有 chunk 超过 500 kB；暂不调整分包，以保留上游实现。
- npm install 报告 19 项依赖审计告警（1 low、7 moderate、10 high、1 critical）。本阶段未升级依赖；发布前需确认告警来源及是否影响生产面。
- 默认示例身份还将在阶段 2 替换；开发分支尚未部署到 `main`。

## 阶段 1 完成清单

- [x] Ulbo 冻结提交作为项目源工程。
- [x] 删除 Momo 前端、栏目内容、CMS 与原搜索。
- [x] 删除模板演示文章，迁移方案和阶段 0 基线留在 `doc/`。
- [x] 上游原始 CSS、页面、依赖和锁文件比对一致。
- [x] 上游静态检查、测试、Frontmatter 检查与空内容构建通过。
- [x] 本阶段变更与检查已完成（提交、推送随后进行）。
