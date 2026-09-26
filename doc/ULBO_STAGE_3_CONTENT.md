# 阶段 3：迁入四篇长文

## 文章映射

| slug | 标题 | 日期 | 分类 |
| --- | --- | --- | --- |
| `site-start` | 从这里开始 | 2026-09-09（更新：2026-09-10） | 建站记录 |
| `why-a-digital-garden` | 为什么要做一座自己的数字花园 | 2026-09-10 | 知识管理 |
| `content-operating-system` | 内容不是文件：把个人知识库变成可持续发布系统 | 2026-09-10 | 知识管理 |
| `public-not-private` | 公开记录，不等于公开一切 | 2026-09-10 | 建站记录 |

正文从 Git 回退基线 `13a3f2b` 直接迁入。只将 schema 字段映射为 Ulbo 所需的 `date`、`updated`、`categories`、`tags`，并去除原站专属 Frontmatter；正文未改写。标签 `Git`、`Markdown` 按上游规范化工具统一为 `git`、`markdown`。每篇旧 Frontmatter 里的 `CC-BY-NC-SA-4.0` 许可记录见 `doc/CONTENT_LICENSES.md`；Ulbo 的严格 schema 和文章布局保持不变。

## 正文哈希校验

去除 Frontmatter 后，源文与迁入文 SHA-256 相同：

| slug | SHA-256（前 12 位） | 结果 |
| --- | --- | --- |
| `site-start` | `28ae8a2773be` | 完全一致 |
| `why-a-digital-garden` | `a790f38e346e` | 完全一致 |
| `content-operating-system` | `ab38c8f52df7` | 完全一致 |
| `public-not-private` | `288d50f3d695` | 完全一致 |

## 文章资源

- `public/illustrations/content-loop.svg`：逐字复制自旧站公开插图。
- `public/illustrations/publication-boundary.svg`：逐字复制自旧站公开插图。
- 文章里的 `/illustrations/...` URL 不变，已随静态构建复制到 `dist/illustrations/`。

## 验证记录

| 命令/检查 | 结果 |
| --- | --- |
| `npm run frontmatter:fix` | 4 篇按模板规范化；`bodyHashMismatches` 为空。 |
| `npm run frontmatter:check` | 通过；4 个文件，`changedFiles`、schema errors、body hash mismatches 均为空。 |
| 逐篇 SHA-256 正文比较 | 4/4 完全一致。 |
| 插图比较 | 2/2 文件与旧站完全一致。 |
| `npm run check` | 通过：92 files，0 errors/warnings/hints。 |
| `npm run build` | 通过：17 page(s)，包括 blog 归档、4 个文章详情、标签和 Ulbo 模板页面。 |
| 搜索索引 | 只索引这 4 篇文章，链接为 `/blog/<slug>/`。 |

## 阶段 3 完成清单

- [x] 迁入且仅迁入 4 篇公开长文。
- [x] 按 Ulbo schema 映射日期、分类和标签。
- [x] 正文哈希、Frontmatter、文章插图均核验通过。
- [x] Ulbo 搜索索引、标签、RSS 和页面构建成功。
- [x] 保留作者文章原授权记录，未把文章许可混同为模板代码 MIT 许可。
- [x] 本阶段变更与检查已完成（提交、推送随后进行）。
