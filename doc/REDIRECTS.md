# URL 迁移表

> 更新日期：2026-09-10
>
> 原则：已公开 URL 不静默失效；旧页面不进入索引，并明确指向唯一 canonical。

| 旧路径 | 新路径 | 原因 | 当前实现 |
|---|---|---|---|
| `/blog/site-start/` | `/articles/site-start/` | 文章内容类型改为 `articles` | 静态迁移页 + canonical + meta/JS 跳转 |

阶段 3 的兼容路由会为所有 article slug 生成相同形式的 `/blog/<slug>/` 迁移页，避免测试或早期链接失效。当前 GitHub Pages 不能配置服务器级 301；若未来绑定 Cloudflare 或其他边缘层，应将本表转换为真正的永久重定向规则。

新增映射时必须同时检查：

- 新路径已在生产构建生成。
- 旧路径包含 `noindex`。
- canonical 只指向新路径。
- RSS、站内链接和搜索结果不再输出旧路径。
- 线上旧路径可以到达新页面。
