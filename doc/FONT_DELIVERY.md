# 跨设备艺术字体交付说明

> 完成日期：2026-09-11
> 适用范围：公开站点的中文标题、短引用、导航品牌字与 Markdown 标题

## 1. 目标

此前站点把 `Kaiti SC`、`STKaiti`、`KaiTi` 等系统字体作为标题首选。macOS 通常能显示预期楷体，但手机系统、浏览器和厂商字库不同，访客可能看到普通宋体或无衬线体。此次改造的目标是让电脑与手机使用同一套艺术字形，同时避免重新发布数十 MiB 的完整中文字库。

## 2. 交付方案

- 中文展示字体使用霞鹜文楷 Bright，站内 CSS 家族名固定为 `Yoyo LXGW Bright`。
- 字体来源包固定为 `@chinese-fonts/lxgwwenkaibright@2.0.0`，对应 LXGW Bright 5.526。
- 构建脚本扫描组件、样式、结构化数据，以及 Markdown 的 frontmatter、标题和引用，只选择覆盖当前展示文字的预切分 WOFF2。
- 生成的字体文件放在 `public/fonts/lxgw-bright/`，该目录不提交 Git；开发、生产和 GitHub Actions 构建都会重新生成。
- 生成的 `src/styles/lxgw-bright.generated.css` 提交到仓库，便于类型检查、代码审查和构建前引用保持稳定。
- 不使用 `local()` 优先命中系统字体，从而避免同名字体版本不同造成的跨设备差异。
- 系统楷体仍保留为下载失败时的后备；`font-display: swap` 让弱网下正文不会因等待字体而空白。

## 3. 字体角色

| 角色 | 字体与字重 | 用途 |
| --- | --- | --- |
| 中文展示常规 | LXGW Bright Regular 400 | 内容页标题、原文标题 |
| 中文展示强调 | LXGW Bright Medium 500 / 600 / 700 | 首页、栏目、Markdown 分级标题 |
| 中文展示斜体 | LXGW Bright Italic / Medium Italic | 中文引用或强调需要斜体时 |
| 英文与年份 | EB Garamond | 英文视觉文字、数字、年份 |
| 长正文 | 系统宋体栈 | 长文与学习笔记，优先阅读稳定性 |
| 代码 | JetBrains Mono | 代码块与行内代码 |

## 4. 当前体积与门禁

- 中文展示字体：155 个 WOFF2 分片，5.02 MiB。
- 全部字体：246 个文件，约 6.62 MiB。
- 完整 `dist/`：约 15 MB；仍显著低于曾经包含完整中文字库时的约 43 MB。
- `pnpm check:public` 检查中文字体文件和生成 CSS 是否存在，并在中文展示字体超过 6 MiB 时失败。
- 新增标题、栏目名或引用后，`pnpm dev` 和 `pnpm build` 会自动刷新选择结果，不需要手工挑选字符。

## 5. 验证记录

- `CI=true pnpm build`：96 个 HTML 页面、37 个 Pagefind 页面生成成功。
- `pnpm check:public`：2831 条站内链接、155 个中文展示字体分片通过。
- 390 × 844 首页：标题实际计算字体为 `Yoyo LXGW Bright`，500 字重加载成功，固定导航正常，无横向溢出。
- 资料详情页：常规 400 与粗体 700 字重加载成功。
- 浏览器控制台：0 个 warning / error。

## 6. 来源、许可与维护边界

字体项目：[LXGW Bright](https://github.com/lxgw/LxgwBright)，字体软件采用 SIL Open Font License 1.1。网页字体切分包来自 [chinese-free-web-font-storage](https://github.com/KonghaYao/chinese-free-web-font-storage)，包裹代码采用 MIT 许可。构建产物同时携带字体提示和包裹许可文件。

本方案只覆盖站点中承担视觉角色的短文本。长正文继续使用系统宋体，以控制首次访问的流量；若未来大量新增汉字、繁体字或特殊字符，应先观察生成体积，再决定是否扩大 6 MiB 门禁。

## 7. 远端验收

- 实现提交：`edb73a2`；回滚基线：`baseline/mobile-font-consistency`。
- GitHub Actions 内容健康运行 `34559213037` 成功。
- GitHub Pages 部署运行 `34559213018` 的 Build、deploy、Verify live site 三项均成功。
- 线上首页已加载生成后的字体 CSS；抽查的 WOFF2 文件可公开下载，格式有效，SHA-256 与本地构建产物一致。
