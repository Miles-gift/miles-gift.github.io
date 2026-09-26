# 本地博客 CMS 阶段 1：本地服务与基础界面

## 实现内容

- 新增 `npm run cms`，使用 Node 本地 HTTP 服务，只绑定 `127.0.0.1`；默认地址 `http://127.0.0.1:4178/`，可使用 `CMS_PORT` 选择端口。
- 本地界面复用网站全局字体和主题变量，提供文章库、搜索、草稿筛选、明暗主题与源码查看弹窗。
- 增加仓库状态与本机保存状态提示；文章库从 `src/content/blog/` 读取 Markdown/MDX frontmatter。
- 加入本地会话随机令牌、写请求 Origin/Host 校验、5 MB 请求上限、JSON API、固定静态资源映射和内容 slug 白名单。
- CMS 工作区将放入 `.local-cms/`，并已加入 `.gitignore`；草稿通过临时文件原子写入，权限为仅当前用户读写。阶段 1 的写入接口可保存私有工作区草稿，但 UI 编辑器将在阶段 2 完成。
- CMS 只由 `tools/local-cms/` 服务，不属于 Astro 页面；生产 `dist/` 中没有 CMS 页面、会话令牌或 API 资源。

## 验收结果

| 检查 | 结果 |
| --- | --- |
| `node --check tools/local-cms/server.mjs` 与 `node --check tools/local-cms/ui/app.js` | 通过。 |
| `npm run check` | 通过：95 files，0 errors/warnings/hints。 |
| `npm run frontmatter:check` | 通过：4 篇文章无变化、无错误、正文哈希无差异。 |
| `npm run build` | 通过：21 pages。 |
| `dist/` 内容检查 | 通过：未发现 CMS UI、会话字段或服务端文件。 |
| 浏览器本机验收 | 通过：界面展示 4 篇文章、文章搜索筛选和主题切换入口。 |
| API 本机烟雾检查 | 通过：健康状态、文章读取、拒绝缺少会话令牌的写入、接受合法本机写入；临时测试草稿已清除。 |

启动本地监听需要允许 `npm run cms` 绑定回环网卡；服务只在 `127.0.0.1` 接受连接。Astro 仍报告上游 Markdown API 弃用提示和既有的大 chunk 警告，和本地 CMS 无关。

## 阶段状态

- [x] 阶段 0 基线、哈希、回退 tag 与计划已推送。
- [x] 阶段 1 本地服务、只读文章库和工作区 API 已完成并推送。
- [ ] 阶段 2 文章增删改、Markdown 编辑与图片管理。
