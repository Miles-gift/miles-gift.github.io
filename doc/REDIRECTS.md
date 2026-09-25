# URL 迁移表

> 更新日期：2026-09-26
>
> 原则：已公开 URL 不静默失效；旧页面不进入索引，并明确指向唯一 canonical。

| 旧路径 | 新路径 | 原因 | 当前实现 |
|---|---|---|---|
| `/blog/site-start/` | `/articles/site-start/` | 文章内容类型改为 `articles` | 静态迁移页 + `noindex` + 新 canonical + 0 秒 meta refresh |
| `/archive/` | `/archives/` | 统一采用复数归档路径 | 静态迁移页 + `noindex` + 新 canonical + 0 秒 meta refresh |

构建会为每篇已公开文章生成对应的 `/blog/<slug>/` 迁移页。旧文章路由与归档路由分别由 `src/pages/blog/[...slug].astro` 和 `src/pages/archive/index.astro` 提供。页面包含指向新地址的可见链接、`noindex,follow`、新 canonical 和 0 秒 meta refresh。当前 GitHub Pages 不能配置服务器级 301，因此浏览器会在读取静态迁移页后跳转；若未来绑定 Cloudflare 或其他边缘层，应将本表转换为真正的永久重定向规则。

新增映射时必须同时检查：

- 新路径已在生产构建生成。
- 旧路径包含 `noindex`。
- canonical 只指向新路径。
- RSS、站内链接和搜索结果不再输出旧路径。
- 线上旧路径可以到达新页面。
