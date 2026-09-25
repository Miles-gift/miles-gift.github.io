# Ulbo 重构验收记录

> 验收日期：2026-09-26  
> 验收分支：`codex/ulbo-redesign`  
> 参考方案：[ULBO_REBUILD_PLAN.md](./ULBO_REBUILD_PLAN.md)

## 自动化验收

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| TypeScript 与 Astro 类型检查 | 通过 | `CI=true pnpm quality` 中 `astro sync`、站点 `tsc --noEmit`、CMS `tsc -p cms/tsconfig.json` 均成功 |
| 内容健康与构建前检查 | 通过 | 37 篇 Markdown 正式内容均公开；8 个受控主题；无重复路径或禁止附件 |
| 静态生产构建 | 通过 | 构建生成 103 个 HTML 页面；包括首页、栏目、文章、资料、旅程、想法、标签、主题、搜索、关于、404 及旧址迁移页 |
| 内部链接、站点地图与 robots | 通过 | 公开产物检查验证 3,158 个内部链接以及 sitemap、robots |
| 搜索索引 | 通过 | Pagefind 索引 38 页、3,907 词，`dist/pagefind` 约 836 KB |
| 中文展示字体 | 通过 | 159 个 WOFF2 分片，合计 5.05 MiB |
| 旧网址迁移页 | 通过 | 四个 `/blog/<slug>/` 页面及 `/archive/` 由公开产物检查核验 `noindex`、新 canonical 和跳转目标 |
| CMS 发布工作流 | 通过 | `CI=true pnpm --dir cms build` 通过；CMS 冒烟覆盖四类内容的创建、保存、预检、冲突处理、图片格式/WebP、列表展示及可恢复回收 |
| 内容规模 | 通过 | 37 篇正式内容，其中 37 篇公开 |

完整自动化命令：

```sh
CI=true pnpm quality
CI=true pnpm --dir cms build
CI=true pnpm --dir cms smoke
```

`pnpm quality` 最终输出：`公开站点检查通过：103 个 HTML、3158 个内部链接、159 个中文字体分片（5.05 MiB）、sitemap 与 robots 均有效。`

## 人工视觉与交互检查

| 检查项 | 状态 | 说明 |
| --- | --- | --- |
| 390px 手机、768px 平板、1440px 桌面布局 | 待完成 | 当前桌面设备锁屏，未能取得页面截图；需设备解锁后检查窄屏溢出和断点布局 |
| 浅色与深色主题截图对比 | 待完成 | 需在可交互浏览器中分别检查各断点，并与阶段 0 基线比较 |
| 键盘完整路径、焦点可见性、弹层与移动导航 | 待完成 | 源码具备键盘处理与 ARIA 状态，但尚未替代真实浏览器逐项操作 |
| 图片替代文本与减少动态效果 | 部分静态核对 | 模板组件存在 alt 属性及 `prefers-reduced-motion` 规则；仍需在页面级辅助技术检查中抽样确认 |

## 当前限制与后续验收动作

自动化构建、内容、CMS、链接和搜索检查均已通过。由于本轮没有可操作的解锁桌面浏览器，不能把手机/平板/桌面截图比较、浅深色视觉确认或完整键盘交互报告为已验收。解锁设备后应完成上表待办，再将截图及检查结果补充到本记录。

构建日志另有 Node.js `module.register()` 弃用提示，以及 Pagefind 对 `zh-cn` 不支持词干化的说明；命令退出成功，这两条提示未导致验收失败。
