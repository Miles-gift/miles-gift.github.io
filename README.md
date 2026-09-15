# yoyo 的旅行日记

一个以学习、生活与成长为线索的个人博客。

线上站点：[miles-gift.github.io](https://miles-gift.github.io/)

本项目的重点不是展示模板，而是建立一套可以长期维护的个人内容系统：用 Markdown 保存原文，用清楚的栏目整理知识和经历，用本地 CMS 辅助发布，再由 GitHub Actions 自动检查和部署。

## 1. 网站介绍

### 1.1 核心定位

网站名称为 **yoyo 的旅行日记**，主要记录：

- 长篇札记：较完整的日记、复盘、项目记录和个人思考。
- 灵光便笺：随时记录的短想法、观察和正在形成的判断。
- 资料库：公开整理个人学习 Markdown 原文，不替原文做总结。
- 旅程：教育经历、校园服务、奖项和人生里程碑。
- 关于：个人简介、研究方向、关注领域、兴趣、学校、位置、GitHub 与友联。

### 1.2 公开站点的一级栏目

```text
首页
├── 内容总览
├── 最新长篇札记
├── 最新灵光便笺
├── 资料分类
└── 旅程与关于入口

文章
├── 长篇札记
└── 灵光便笺

资料库
├── AI 与机器学习
├── 编程与工程工具
├── macOS 与效率
└── 语言学习

旅程
├── 教育经历
├── 校园服务
└── 获奖与里程碑

关于
├── 个人简介
├── 研究方向与关注领域
├── 兴趣爱好
├── 学校与位置
├── 联系方式
└── 友联
```

公开导航只保留与本人内容相关的入口，以及搜索和归档。RSS、隐私页、版权页、源码入口、模板作者入口和无视觉入口的旧网址均不属于当前站点结构。

### 1.3 当前内容规模

当前公开内容共 37 条：

| 内容类型 | 数量 | 存储位置 |
| --- | ---: | --- |
| 长篇札记 | 4 | `src/content/articles/` |
| 原文资料 | 9 | `src/content/resources/` |
| 灵光便笺 | 3 | `src/content/thoughts/` |
| 旅程 | 21 | `src/content/journey/` |

资料库中的雅思、PyTorch、Git、uv、macOS 等笔记以用户原始 Markdown 为主体，只做公开展示所需的元数据和必要格式处理。旅程页面不展示证书图片、证书编号、二维码、学号或第三方敏感信息。

### 1.4 视觉与交互特点

- 视觉主题：温暖、手工感、青春，核心意象是贯穿学习和成长的“知识轨迹”。
- 支持浅色、深色和跟随系统三种主题模式。
- 中文标题和引用使用站内生成的霞鹜文楷 Bright 子集，英文和数字使用 EB Garamond，代码使用 JetBrains Mono。
- 主导航固定在窗口顶部，桌面和手机端都可以快速切换五个核心栏目。
- 动效保持中等强度，内容进入视口时平滑显现，并尊重系统的“减少动态效果”设置。
- 站点不依赖远程图片才能完成首屏展示，品牌标志、轨迹图形和分享图均由仓库内资源生成。
- 资料详情页统一采用“学习档案页”渲染：保留 Markdown 原文，同时提供纸张阅读面、批注轨、章节层级、表格、代码、引用和图片的统一视觉规则；以后通过 CMS 新增的资料会自动获得同样的样式。

## 2. 网站构成与架构

### 2.1 总体数据流

```text
Markdown 内容 / 站点配置
          │
          ▼
Astro Content Collections + Zod Schema
          │
          ▼
页面路由、布局、组件、Markdown 插件
          │
          ├── Pagefind 静态搜索索引
          ├── 字体与品牌资源生成
          └── Astro 静态构建
                    │
                    ▼
              dist/ 静态产物
                    │
                    ▼
       GitHub Pages + GitHub Actions
```

本地编辑时，数据流增加一条安全的工作台路径：

```text
yoyo Studio（仅监听 127.0.0.1:5188）
          │
          ├── 读取 / 保存 src/content/
          ├── Markdown 实时预览
          ├── 发布预检、版本冲突检查
          └── 图片限边与 WebP 转码
```

CMS 不直接替代 Git，也不把内容上传到第三方云数据库。它是本地内容工作台；正式发布仍然通过 Git 提交、GitHub Actions 构建和 GitHub Pages 部署完成。

### 2.2 技术栈

- **Astro 7**：静态页面生成、路由和页面布局。
- **TypeScript**：站点、组件、内容工具和 CMS 类型检查。
- **Svelte**：目录、归档、评论占位等需要客户端交互的组件。
- **Astro Content Collections**：管理 Markdown 内容并用 Zod 校验 frontmatter。
- **Unified / remark / rehype**：Markdown、数学公式、代码高亮、自定义指令、Typst 和图片处理。
- **Pagefind**：构建阶段生成的本地静态搜索索引。
- **Tailwind CSS 4 + 自定义 CSS**：基础样式、设计令牌和流动手稿视觉。
- **Sharp**：图片尺寸限制、LQIP 和 WebP 处理。
- **Vite + Hono**：本地 `yoyo Studio` 的前端开发服务器与本地 API。
- **pnpm workspace**：统一管理根站点和 `cms/` 子项目。
- **GitHub Actions + GitHub Pages**：质量门禁、静态部署和线上路由检查。

### 2.3 目录结构

```text
.
├── src/                         公开站点源码
│   ├── pages/                   页面路由
│   ├── layouts/                 全站布局
│   ├── components/              页面、内容和交互组件
│   ├── content/                 所有正式内容与内容分类
│   │   ├── articles/            长篇札记
│   │   ├── resources/           原文资料
│   │   ├── thoughts/             灵光便笺
│   │   ├── journey/              教育、服务、奖项与里程碑
│   │   ├── spec/                 关于等结构化说明
│   │   └── taxonomy.json         受控分类、状态和旅程类型
│   ├── plugins/                 Markdown remark/rehype 插件
│   ├── styles/                  设计令牌、正文和字体样式
│   ├── config.ts                站点、个人资料和功能开关
│   └── content.config.ts        内容集合与 frontmatter schema
├── public/                      不经过 Markdown 的公开静态资源
│   ├── brand/                   标志和社交分享图
│   ├── fonts/                   构建时生成的展示字体子集
│   ├── illustrations/           插图
│   └── media/                   已确认可公开的媒体
├── cms/                         yoyo Studio 本地内容工作台
│   ├── src/                     工作台页面、编辑器和 UI
│   ├── server/                  本地 API、读写、预览、上传和统计
│   ├── smoke.mjs                API、媒体和 UI 冒烟测试
│   └── AGENT.md                 CMS 使用与安全说明
├── script/                      构建、内容校验、字体和外链检查脚本
├── doc/                         设计、发布、恢复和维护文档
├── .github/workflows/           部署、内容健康和 Release 工作流
├── astro.config.mjs             Astro、Markdown 和插件配置
├── package.json                 根项目命令和依赖
├── pnpm-workspace.yaml          workspace 与构建依赖策略
└── README.md                    本项目总说明
```

### 2.4 页面和内容关系

公开页面位于 `src/pages/[...locale]/`。当前只启用 `zh-cn`，默认语言不带语言前缀。

| 路径 | 用途 |
| --- | --- |
| `/` | 首页总览 |
| `/articles/` | 长篇札记与灵光便笺统一入口 |
| `/articles/<slug>/` | 长篇札记详情 |
| `/thoughts/<id>/` | 灵光便笺详情 |
| `/resources/` | 资料库入口与分类筛选 |
| `/resources/<slug>/` | 原文资料详情 |
| `/journey/` | 教育、校园服务、获奖与里程碑 |
| `/journey/<slug>/` | 单条旅程详情 |
| `/about/` | 关于页 |
| `/archives/` | 按时间归档 |
| `/search/` | Pagefind 搜索页 |

内容集合在 `src/content.config.ts` 中定义。构建时如果 frontmatter 缺字段、类型不正确、分类不受控或 slug 不符合规则，Astro 会直接失败，不会生成不完整的公开页面。

### 2.5 内容模型

| 集合 | 标识规则 | 关键字段 |
| --- | --- | --- |
| `articles` | `src/content/articles/<slug>/zh-cn.md` | `title`、`slug`、`description`、`pubDate`、`topic`、`tags`、`kind: article` |
| `resources` | `src/content/resources/<slug>.md` | `title`、`slug`、`resourceType`、`topic`、`tags`、`status`、`lastReviewedAt` |
| `thoughts` | `src/content/thoughts/YYYYMMDD-001.md` | `id`、`title`、`description`、`pubDate`、`topic`、`tags` |
| `journey` | `src/content/journey/<slug>.md` | `title`、`startDate`、`dateLabel`、`kind`、`summary`、`sourceLevel` |

所有正式内容都应明确 `draft` 和 `visibility`。准备公开时使用 `draft: false`、`visibility: public`；未完成内容保持草稿，不要依赖页面隐藏来代替状态字段。

## 3. 如何更新内容

### 3.1 推荐方式：使用本地 CMS

先安装依赖并启动工作台：

```bash
pnpm install --frozen-lockfile
pnpm cms
```

然后访问 [http://localhost:5188/](http://localhost:5188/)。若需要同时检查公开页面，再开另一个终端运行 `pnpm dev`。

标准流程：

1. 在概览或内容列表中选择内容类型并新建草稿。
2. 填写标题、日期、分类、标签和正文。
3. 使用实时预览检查标题、列表、表格、代码、公式、图片和移动端阅读效果。
4. 草稿阶段反复保存；准备公开时切换为公开状态。
5. 点击保存后执行“发布预检”，先修复错误，再人工确认警告。
6. 回到项目根目录执行质量检查和正式构建。
7. 提交并推送到 `main`，等待 GitHub Actions 完成后检查线上页面。

CMS 管理的四类文件与 API 说明见 [cms/AGENT.md](cms/AGENT.md)。CMS 具备文件版本冲突保护、原子写入和可恢复删除，适合日常编辑；但它仍然需要 Git 记录和远端构建才能发布。

### 3.2 直接编辑 Markdown

适合批量导入、迁移或需要精确控制正文时使用。新增文件前先查看同类型现有内容，不要从旧模板目录复制过时字段。

通用要求：

- `slug` 只使用小写英文、数字和连字符，并且不能重复。
- `topic` 必须来自 `src/content/taxonomy.json`。
- `tags` 至少 1 个，最多 6 个。
- 日期使用 `YYYY-MM-DD`；灵光便笺的 `pubDate` 可以包含时区。
- 正式公开内容使用 `draft: false` 和 `visibility: public`。
- 正文中的本地绝对路径、密钥、精确住址、学号、二维码和第三方个人信息不得公开。
- 资料库正文遵循“保留 Markdown 原文”的原则，不要为了页面简介擅自总结正文。

长篇札记路径示例：

```text
src/content/articles/my-new-note/zh-cn.md
```

灵光便笺路径示例：

```text
src/content/thoughts/20260911-001.md
```

旅程内容需要额外填写 `startDate`、`endDate`、`dateLabel`、`kind`、`summary` 和 `sourceLevel`。奖项或证书只写经确认的公开信息，不上传证书原件。

### 3.3 更新站点资料与分类

- 修改站点名称、副标题、个人头像、GitHub、主题功能开关：编辑 `src/config.ts`。
- 修改关于页正文、研究方向、兴趣、学校、位置和友联：编辑 `src/content/spec/about/zh-cn.md`。
- 新增或调整资料分类、资料状态和旅程类型：编辑 `src/content/taxonomy.json`，然后运行内容校验。
- 修改页面结构、导航、Markdown 渲染或主题样式：分别检查 `src/pages/`、`src/components/`、`src/plugins/` 和 `src/styles/`。
- 不要直接编辑 `dist/`、`.astro/` 或 Pagefind 生成文件；这些内容会在构建时重新生成。

### 3.4 内容发布前检查

最少执行：

```bash
pnpm validate:content
pnpm typecheck
pnpm build
pnpm check:public
```

内容较多或准备发布到线上时，执行完整质量门禁：

```bash
CI=true pnpm quality
```

如果新增了资料、外链或长期内容，还应执行：

```bash
pnpm content:health
pnpm check:external
```

## 4. 本地运行与构建

### 4.1 环境要求

- Node.js `>=24`
- pnpm `>=11 <12`
- macOS、Linux 或能够运行 Node.js 24 的开发环境

安装依赖：

```bash
pnpm install --frozen-lockfile
```

### 4.2 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 生成品牌与字体资源并启动 Astro 开发服务器 |
| `pnpm build` | 校验内容、生成资源、构建 Astro 页面并生成 Pagefind 索引 |
| `pnpm preview` | 预览最近一次 `dist/` 构建产物 |
| `pnpm typecheck` | 同步 Astro 类型并检查站点与 CMS TypeScript |
| `pnpm validate:content` | 检查内容路径、frontmatter、分类和公开边界 |
| `pnpm check:public` | 检查静态产物中的路由、SEO、链接和公开文件 |
| `pnpm content:health` | 统计内容规模、资料复核日期和分类覆盖 |
| `pnpm check:external` | 检查公开 Markdown 中的外部链接 |
| `pnpm quality` | 依次执行类型检查、内容健康、完整构建和公开产物检查 |
| `pnpm cms` | 启动本地 yoyo Studio |

`pnpm dev` 和 `pnpm build` 会自动生成展示字体子集，因此通常不需要手工维护 `public/fonts/`。如果 pnpm 提示要删除并重新安装已有 modules，请先停止操作并确认 Node/pnpm 版本和 lockfile；不要在未确认的情况下接受破坏性重装。

### 4.3 构建产物

- `dist/`：Astro 生成的静态站点和 Pagefind 索引，不需要手动编辑。
- `public/fonts/`：根据当前站点文字生成的字体资源，通常由脚本维护。
- `.astro/`：Astro 类型和构建缓存。
- `cms/dist/`：CMS 的前端构建产物，不是公开站点内容。

构建产物出现问题时，优先删除对应缓存后重新运行构建，不要直接修改 `dist/` 里的 HTML。

## 5. 本地 CMS：yoyo Studio

`yoyo Studio` 是仅本机可访问的内容工作台，默认监听 `127.0.0.1:5188`。它负责：

- 查询四类内容和概览统计。
- 创建、编辑、保存和删除 Markdown 内容。
- 实时渲染 Markdown、代码、公式和图片。
- 检查分类、草稿状态、空正文、绝对路径和潜在隐私风险。
- 真实图片格式校验、最大 8 MB 限制、最大边 2400 px 限制和 WebP 转码。
- 在磁盘版本发生变化时阻止旧编辑器覆盖新内容。
- 将删除的正文和媒体移入 `.trash/cms/<时间>/`，便于恢复。

它不会读取 `/Users/sin/Tools`、评奖评优原始材料或其他私人目录，也不会管理已经下线的模板内容。

CMS 的接口包括：

```text
GET    /api/content?kind=&q=&status=
POST   /api/content
GET    /api/content/:kind/:id
PUT    /api/content/:kind/:id
DELETE /api/content/:kind/:id
POST   /api/content/:kind/:id/preflight
POST   /api/preview
POST   /api/upload
GET    /api/meta
GET    /api/stats
```

验证 CMS：先运行 `pnpm cms`，再开另一个终端执行：

```bash
CI=true pnpm --dir cms build
CI=true pnpm exec tsc -p cms/tsconfig.json
CI=true pnpm --dir cms smoke
```

冒烟测试会创建临时四类内容、检查保存和版本冲突、测试图片转码和界面预览，最后将测试内容移入可恢复回收区。测试结束后不应在正式内容目录留下测试稿。

## 6. 发布与 GitHub Actions

### 6.1 正式发布链路

```text
本地编辑
  → pnpm quality
  → git diff / git status 复核
  → git add / git commit
  → git push origin main
  → GitHub Actions 构建与检查
  → GitHub Pages 部署
  → Verify live site 检查公开路由
```

远程仓库：`https://github.com/Miles-gift/miles-gift.github.io.git`

线上地址：[https://miles-gift.github.io/](https://miles-gift.github.io/)

### 6.2 工作流

| 工作流 | 触发方式 | 作用 |
| --- | --- | --- |
| `deploy.yml` | `main` 推送 | 安装依赖、类型检查、构建、公开产物检查、部署和线上路由验证 |
| `content-health.yml` | 内容相关推送、每周一 08:30（北京时间）、手动触发 | 运行质量门禁、内容健康报告和外链检查；只读仓库，不改内容 |
| `release.yml` | 推送 `v*` 标签 | 生成 Release 压缩包 |

部署失败时，先打开 Actions 查看失败步骤，再在本地复现同一命令。不要直接修改 GitHub Pages 产物；修复源码或内容后重新提交。

## 7. 运行维护与故障恢复

### 7.1 每次发布后的检查

1. 确认 `git status` 没有误加入的个人材料、证书或临时文件。
2. 确认 `pnpm quality` 完整通过。
3. 检查 Actions 的 Build、deploy 和 Verify live site 均成功。
4. 打开首页、文章、资料库、旅程、关于和新内容详情页。
5. 检查移动端固定导航、主题切换、搜索和正文排版。
6. 确认 `git pull --ff-only` 与远端保持一致。

### 7.2 定期维护

- 每周查看内容健康工作流；只有确认失效的外链才修改原文。
- 按 `lastReviewedAt` 复核资料内容，避免工具版本和学习笔记长期过时。
- 新增内容后关注分类是否失衡、标签是否重复以及首页入口是否需要调整。
- 依赖升级前先记录当前 Node、pnpm、Astro 和构建状态，升级后执行完整 `pnpm quality`。
- 真实邮箱、网易云音乐、项目案例或英文内容准备好后再增加入口，不创建空链接。

维护口径和自动化基线见 [长期维护基线](doc/MAINTENANCE_BASELINE.md)，内容统计见 [内容健康报告](doc/CONTENT_HEALTH_REPORT.md)。

### 7.3 恢复策略

- **误删内容**：优先从 `.trash/cms/` 找到对应时间目录恢复；该目录是 CMS 的可恢复回收区，不要在未确认前清空。
- **误发布内容**：先将内容恢复为草稿或通过 Git 回退对应提交，再重新运行质量检查和部署。
- **构建失败**：查看 Astro schema、frontmatter 和最近一次内容改动，执行 `pnpm validate:content`、`pnpm typecheck` 和 `pnpm build` 定位问题。
- **线上版本异常**：确认 GitHub Actions 运行结果、本地 `HEAD` 与 `origin/main`，必要时使用 Git 的可追溯提交回退，而不是手工编辑线上文件。
- **CMS 保存冲突**：重新读取最新内容后再编辑和保存，不要强行覆盖版本号。

详细步骤见 [CMS 发布 SOP](doc/PUBLISHING_SOP.md) 和 [CMS 恢复手册](doc/CMS_RECOVERY.md)。

## 8. 当前状态与后续计划

### 已完成

- 完成从 Momo 模板到个人博客的重建和个人化。
- 完成首页、文章、资料库、旅程、关于五个核心栏目。
- 完成 37 条真实内容导入、分类和公开边界处理。
- 完成暖色手工感视觉、自动深浅主题、固定主导航和跨设备艺术字体。
- 完成资料库统一“学习档案页”正文渲染，自动覆盖全部资料详情页和未来 CMS 上传的资料。
- 完成本地 CMS、版本冲突保护、图片处理、发布预检和可恢复删除。
- 完成 SEO、站内搜索、内容健康、外链检查、GitHub Pages 部署和线上验证。
- 修复页面中央灰色装饰线、移动端字体回退和页面结构层级问题。

### 后续计划

1. 持续发布长篇札记、灵光便笺和原始学习资料。
2. 按资料复核周期更新工具版本、链接和公开边界。
3. 根据真实使用情况微调首页入口、搜索和内容分类。
4. 在确认账号、隐私和成本后，再考虑评论、远程编辑或对象存储；在此之前不提前引入第三方追踪。

## 9. 相关文档

- [内容模型](doc/CONTENT_MODEL.md)
- [发布 SOP](doc/PUBLISHING_SOP.md)
- [CMS 恢复手册](doc/CMS_RECOVERY.md)
- [长期维护基线](doc/MAINTENANCE_BASELINE.md)
- [内容健康报告](doc/CONTENT_HEALTH_REPORT.md)
- [设计方向](doc/DESIGN_DIRECTION_V2.md)
- [字体交付说明](doc/FONT_DELIVERY.md)
- [上线质量基线](doc/QUALITY_BASELINE.md)
- [CMS 使用说明](cms/AGENT.md)
- [总执行计划](BLOG_REBUILD_PLAN.md)

## 10. README 维护规则

每完成一个阶段或一次具有范围的维护任务，都要同步更新本 README，至少说明：

- 目标和实施范围。
- 当前已实现的能力。
- 网站结构或架构是否发生变化。
- 做过哪些本地、线上和 Git 验证。
- 当前限制、风险和下一步。
- 对应的提交、Actions 运行和线上结果（如有）。

本项目最初基于 [Motues/Momo](https://github.com/Motues/Momo) 的 Astro 框架重建。上游模板只作为工程来源保留在文档中，不作为公开网站导航或视觉入口。
