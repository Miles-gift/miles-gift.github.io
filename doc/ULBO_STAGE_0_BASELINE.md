# 阶段 0：迁移基线

- 日期：2026-09-26
- 原站基线分支：`main`
- 原站基线提交：`13a3f2b`（`docs: record Ulbo migration acceptance`）
- 源远端：`origin` → `https://github.com/Miles-gift/miles-gift.github.io.git`
- 旧站构建：Astro 7 + pnpm + Momo，自定义内容集合及 CMS。
- Ulbo 上游：`https://github.com/xxy1103/ulbo-astro-theme-template`
- 本地核对版本：`a2b499937642f509c7aa481e0e7409d3d399121e`。
- 作者可迁移内容：4 篇长文（`site-start`、`why-a-digital-garden`、`content-operating-system`、`public-not-private`），1 份 about 个人简介。
- 《内容不是文件》引用的公开插图：`/illustrations/content-loop.svg`、`/illustrations/publication-boundary.svg`。
- 不迁移内容：9 条 resources、3 条 thoughts、21 条 journey、Momo CMS、Pagefind、旧设计和旧组件。
- 文章旧路径：`/articles/<slug>/`；目标路径：`/blog/<slug>/`。
- 页面参考：官方主题页、上游 README/源码、`https://template.ulna520.top/`。
- 许可待核对项：Ulbo MIT 已在上游仓库提供；默认背景图及各字体/图像素材的独立授权须在发布前逐项确认。
- 回退依据：原站基线提交 `13a3f2b`；阶段 0 完成时为其创建 tag `pre-ulbo-exact-template-20260926`。

## 参考快照清单

执行阶段 5 时，应在同一浏览器环境、390/768/1440 px 宽度下截图：主页、博客归档、标签、关于、文章详情，以及浅/深色主题。记录 computed font-family，导航滚动状态、搜索、移动菜单、目录、主题切换和页面转场录屏。截图应存于最终验收记录对应目录，不把临时截图误当成线上验收证据。

## 阶段 0 验收状态

- [x] 工作区开始时无已修改或已暂存文件（仅前一轮新写的迁移计划文件未跟踪）。
- [x] 确认 `main` 基线和 GitHub `origin`。
- [x] 检查了四篇长文、个人简介与两张文章插图。
- [x] 核对主题页、模板仓库、模板 schema、字体与构建脚本。
- [x] 原站备份 tag 已创建（阶段完成后推送）。
- [x] Ulbo 上游完整 SHA 锁定。
- [x] 本阶段提交已创建（推送后完成阶段）。
