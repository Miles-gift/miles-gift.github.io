# Miles 个人站内容模型

> 状态：阶段 3 基线
>
> 版本：v1.0
>
> 更新日期：2026-09-10

## 1. 目标

内容模型把文章、资料、短想法、个人经历和固定页面分开管理，让每种内容只承担清晰职责，并在构建前拦截错误字段、重复路径、失控主题和不应进入公开仓库的附件。

## 2. Collections

| Collection | 目录 | 公开 URL | 当前数量 | 主要用途 |
|---|---|---|---:|---|
| `articles` | `src/content/articles/<slug>/zh-cn.md` | `/articles/<slug>/` | 4 | 长文、教程、复盘和系统思考 |
| `resources` | `src/content/resources/<slug>.md` | `/resources/<slug>/` | 5 | 官方来源索引、原创导读、学习状态与结论 |
| `thoughts` | `src/content/thoughts/<id>.md` | `/thoughts/<id>/` | 3 | 只表达一个观点的短记录 |
| `journey` | `src/content/journey/<slug>.md` | `/journey/<slug>/` | 5 | 教育、项目、成果与阶段节点 |
| `pages` | `src/content/pages/<slug>.md` | 由固定路由映射 | 2 | 隐私、版权等固定页面正文 |
| `spec` | `src/content/spec/<name>/zh-cn.md` | 固定路由 | 2 | 迁移期间保留的 About 与友链说明 |

Schema 集中在 `src/content.config.ts`，受控枚举集中在 `src/content/taxonomy.json`。

## 3. 公共字段

- `slug`：小写英文、数字和连字符；发布后保持稳定。
- `description`：可独立理解的摘要，不机械截取正文。
- `draft`：本地草稿开关。
- `visibility`：`public`、`unlisted` 或 `draft`。
- `topic`：从受控主题中选择一个。
- `tags`：1–6 个具体标签，单个不超过 32 字符。
- `pubDate`：内容在网站上的发布日期，不等于经历发生日期或外部资料出版日期。

生产列表、RSS 和首页只读取 `draft: false` 且 `visibility: public` 的内容。`unlisted` 的完整直达规则将在阶段 5 与 sitemap 一起落实。

## 4. 各类型关键字段

### Articles

文章固定 `kind: article`，支持 `series`、`seriesOrder`、`featured`、`pinTop`、封面、canonical 和内容许可。当前只启用 `zh-cn`，目录仍为未来逐篇翻译保留空间。

### Resources

每条资料必须有官方或权威 `sourceUrl`、资料类型、学习状态、0–100 进度、复核日期和 1–5 条个人收获。资料页不是链接收藏夹，正文必须解释保存原因、使用方式和版权边界。

### Thoughts

`id` 使用 `YYYYMMDD-NNN`，保证短记按日期可辨识且 URL 稳定。每条有标题、摘要、一个 topic、标签和可选 related slug；正文保持一个观点。

### Journey

`startDate` 和 `endDate` 接受 `YYYY`、`YYYY-MM` 或 `YYYY-MM-DD`，以保留来源的真实精度。`pubDate` 只表示该条目在网站发布的日期。`sourceLevel` 区分用户明确提供和证明材料核验摘要，防止从证书推断个人职责。

### Pages

固定页面保存标题、slug、description、更新时间和可见性。隐私与版权页面均从 collection 读取，并已进入页脚导航。

## 5. Taxonomy

首版受控主题：电子设计、AI 与机器学习、工程工具、语言学习、知识管理、个人成长、建站记录。

新增 topic 前必须确认它能长期容纳多条内容，不能用一次性活动名代替标签。资源类型、资源状态、Journey 类型、可见性和许可同样由 JSON 词表约束。

## 6. 自动预检

`pnpm validate:content` 在每次 `pnpm build` 前自动运行：

- 扫描五个公开内容 collection 的 Markdown。
- 检查 frontmatter 是否存在。
- 检查 slug/id 是否存在且与目录或文件名一致。
- 检查同一 URL 命名空间内是否重复。
- 检查 topic 是否属于受控词表。
- 拒绝内容目录中的 PDF、Office、压缩包等高风险附件。

Astro 的严格 Zod schema 继续负责日期、URL、枚举、长度、范围、必填字段和未知字段检查。两层检查一起保证错误内容不能悄悄进入生产构建。

## 7. 首批迁移内容

- 4 篇真实建站文章，来自当前项目的目标、决策、隐私治理和内容系统复盘，不使用模板示例。
- 5 条资料，来自本地 PyTorch、uv、Git、macOS 和 IELTS 学习线索；只写原创导读并链接官方来源。
- 3 条原创短想法，围绕失败记录、收藏与版本信息。
- 5 条 Journey，包含两段由本人提供的教育经历与三项经证明核验的脱敏成果。
- 2 个固定页面，分别说明隐私与版权。

本地课程视频、课件、题库、证明扫描件、学号、编号和第三方身份均未复制进入内容目录。

## 8. URL 迁移

文章规范 URL 从 `/blog/<slug>/` 调整为 `/articles/<slug>/`。构建仍为每个旧路径生成 `noindex` 迁移页，使用 canonical、meta refresh 和脚本跳转到新路径。完整映射见 `doc/REDIRECTS.md`。

## 9. 后续阶段接口

- 阶段 4：首页直接读取 featured 文章、资料、短想法和 Journey。
- 阶段 5：建立各类型列表、筛选、聚合、相关内容和完整搜索页面。
- 阶段 6：CMS 按本 schema 提供表单、预览和保存，不再写入旧 `content/blog`。
- 阶段 7：sitemap、JSON-LD、canonical 与断链检查以这些稳定 URL 为准。
