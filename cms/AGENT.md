# yoyo Studio

`yoyo Studio` 是“yoyo的旅行日记”的本地内容工作台。它只监听本机地址，用来维护已经上线的四类 Markdown 内容：长篇札记、原文资料、灵光便笺与旅程。

## 启动

在项目根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm cms
```

浏览器访问 `http://localhost:5188/`。工作台会直接读取和保存 `src/content/`；如需同步查看公开站点，再开一个终端执行 `pnpm dev`。

## 内容范围

| 工作台类型 | 文件位置 | 标识格式 |
| --- | --- | --- |
| 长篇札记 `articles` | `src/content/articles/<slug>/zh-cn.md` | 小写英文、数字、连字符 |
| 原文资料 `resources` | `src/content/resources/<slug>.md` | 小写英文、数字、连字符 |
| 灵光便笺 `thoughts` | `src/content/thoughts/<id>.md` | `YYYYMMDD-001` |
| 旅程 `journey` | `src/content/journey/<slug>.md` | 小写英文、数字、连字符 |

工作台不会读取 `/Users/sin/Tools`、评奖评优材料或其他私人目录，也不管理已下线的模板文章、页面集合或多语言副本。

## 日常流程

1. 在概览或内容列表选择类型并创建草稿。
2. 填写字段和 Markdown 正文，保持 `visibility=draft` 时可反复保存。
3. 使用实时预览检查标题、列表、表格、代码、公式、图片和移动端阅读效果。
4. 准备公开时选择 `public`；工作台会同步设置 `draft=false`。
5. 先“保存”，再运行“发布预检”。修完所有错误，并人工复核警告。
6. 回到项目根目录执行 `CI=true pnpm build`。
7. 按 [发布 SOP](../doc/PUBLISHING_SOP.md) 提交、推送，并确认 GitHub Actions 与线上页面。

## 安全与可恢复性

- 服务只由 Vite 在 `localhost:5188` 提供，不应映射到公网。
- 每次保存都携带当前文件版本；磁盘内容变化后，旧页面不能直接覆盖新版本。
- 文件先写入同目录临时文件，再以原子重命名替换，降低中途损坏风险。
- “移入回收区”不会永久删除；正文与对应媒体会进入 `.trash/cms/<时间>/`。
- 上传仅接受真实的 PNG、JPEG、WebP 或 AVIF，最大 8 MB、最大边 2400 px，统一转为质量 82 的 WebP。
- 发布预检会阻止本地绝对路径、空正文、无效分类和草稿误发布，并提示可能的敏感信息或办公附件。
- 证书原件、PDF、Office 文件、压缩包、二维码、学号与第三方个人信息不得上传到公开站点。

恢复与故障处理见 [CMS 恢复手册](../doc/CMS_RECOVERY.md)。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/content?kind=&q=&status=` | 查询四类内容 |
| POST | `/api/content` | 新建草稿 `{ kind, id }` |
| GET | `/api/content/:kind/:id` | 读取正文、字段与文件版本 |
| PUT | `/api/content/:kind/:id` | 携带 `{ data, body, version }` 保存 |
| DELETE | `/api/content/:kind/:id` | 将正文和媒体移入可恢复区 |
| POST | `/api/content/:kind/:id/preflight` | 执行公开发布预检 |
| POST | `/api/preview` | 渲染 Markdown 实时预览 |
| POST | `/api/upload` | 上传、限边并转换图片 |
| GET | `/api/meta` | 获取类型与受控词表 |
| GET | `/api/stats` | 获取总量、草稿、字数与最近内容 |

## 目录结构

```text
cms/
├── index.html
├── server/
│   ├── index.mjs       API 与单页应用入口
│   ├── content.mjs     四类内容接口
│   ├── store.mjs       统一读写、字段归一化、校验与回收
│   ├── preview.mjs     Markdown 预览
│   ├── upload.mjs      图片安全处理
│   ├── meta.mjs        受控词表
│   └── stats.mjs       概览统计
├── src/                TypeScript 单页工作台
└── smoke.mjs           API、界面与媒体端到端冒烟测试
```

## 验证

先启动 `pnpm cms`，再在另一终端执行：

```bash
CI=true pnpm --dir cms build
CI=true pnpm exec tsc -p cms/tsconfig.json
CI=true pnpm --dir cms smoke
```

冒烟测试会创建四类临时草稿、验证保存和冲突保护、测试图片转换与界面预览，最后将测试内容移入 `.trash/cms/`。测试完成后不应在正式内容目录留下测试稿。
