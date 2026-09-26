# Ulbo 原版模板迁移：最终验收记录

- Ulbo 上游：`xxy1103/ulbo-astro-theme-template`
- 冻结上游 commit：`a2b499937642f509c7aa481e0e7409d3d399121e`
- 网站：`https://miles-gift.github.io/`
- 实施分支：`codex/ulbo-exact-template`
- 阶段记录：`ULBO_STAGE_0_BASELINE.md`、`ULBO_STAGE_1_TEMPLATE_BASE.md`、`ULBO_STAGE_2_PROFILE.md`、`ULBO_STAGE_3_CONTENT.md`、`ULBO_STAGE_4_DEPLOYMENT.md`、`ULBO_STAGE_5_VISUAL_ACCEPTANCE.md`

## 最终内容范围

- 迁入 4 篇长文章：site-start、why-a-digital-garden、content-operating-system、public-not-private。
- 迁入 yoyo 已公开的教育身份、研究兴趣、爱好、位置与 GitHub；没有加入虚构邮箱或模板示例头像。
- 文章正文对旧站源文件 SHA-256 比较为 4/4 完全一致。
- 搜索索引 4 篇，RSS 4 篇，模板标签由 4 篇文章生成。
- 最终构建不包含原站 resources、thoughts、journey 栏目；也不包含原 CMS、Pagefind、Momo 页面/样式或上游演示文章。
- 四个旧文章路径生成 noindex 静态跳转页，转至 Ulbo 原生 `/blog/<slug>/`；跳转页不进入 sitemap。

## 原版模板核对

模板组件、布局、全局样式、脚本、lib、plugins、依赖与锁文件均与冻结上游一致。仅中央站点/个人/Hero 文案配置以及 GitHub Pages 和旧文章兼容所需路由/配置存在差异。Ulbo MIT 许可随仓库保留；作者文章许可另见 `CONTENT_LICENSES.md`。

视觉、响应式、字体、浅/深主题、移动菜单、搜索、文章目录、图片灯箱和页面导航记录见 `ULBO_STAGE_5_VISUAL_ACCEPTANCE.md`。

## 最终检查

| 项目 | 结果 |
| --- | --- |
| `npm ci` | 通过，按冻结上游锁文件安装。 |
| `npm run check` | 通过：93 files，0 errors/warnings/hints。 |
| `npm test` | 通过：14 test files、54 tests。 |
| `npm run frontmatter:check` | 通过：4 篇，0 规范变化、0 错误、0 正文哈希差异。 |
| `npm run build` | 通过：21 page(s)，含模板原生页面、4 篇文章及4个旧地址跳转。 |
| 输出核验 | 搜索/RSS 各 4 篇；退役内容集合不存在；sitemap 不含 redirect/退役栏目；四条旧地址目标正确。 |
| 部署工作流 | YAML 解析通过；包含 build、deploy、verify 三个 job。 |

## 已知提示

- 上游 Astro Markdown 配置 API 输出 deprecation 提示；为保持与冻结模板一致，本次未擅自升级 Astro 或重写配置。
- 上游 build 提示存在超过 500 kB 的 chunk；未为视觉/依赖表现偏离上游做拆包调整。
- `npm ci` 报告了 19 项依赖 audit 告警（1 low、7 moderate、10 high、1 critical）；本次未升级依赖。GitHub Actions 的 CI 和 Pages 部署仍需在合并后完成实际运行确认。

## 发布状态

- [x] 阶段 0–5 均已分别提交并推送到实施分支。
- [x] 阶段 6 本地最终检查已完成。
- [ ] 阶段 6 验收记录已提交并推送实施分支。
- [ ] 合并到 `main`，等待 GitHub Actions 部署。
- [ ] 检查生产首页、四篇文章、About、标签、搜索、RSS、sitemap 与四条旧地址跳转。
