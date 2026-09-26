# 本地 CMS 阶段 5：体验收敛与最终验收

## 完成内容

- 补充 [本地 CMS 使用手册](LOCAL_BLOG_CMS_USER_GUIDE.md)，覆盖启动/停止、文章和设置维护、预览、发布清单、GitHub 推送、冲突处理与备份恢复。
- 修正页面级标题和主要操作：文章、博客设置、发布与编辑器各自显示对应标题；新建文章入口只在文章列表页展示。
- 修正 `[hidden]` 样式优先级，避免隐藏控件被组件 `display` 规则重新显示。
- 修正 GitHub Pages 验收 job：该 job 在独立 runner 上 checkout 仓库后，才从文章 frontmatter 读取需验证的 URL；通过明确读取 `draft` 字段生成线上检查清单。
- CMS 只追踪 `.github/workflows/deploy.yml` 的 Astro Pages 工作流状态，不会把同一提交触发的 GitHub 自动 Jekyll 检查误判为本站部署结果。
- 将内容管理页眉和源码对话框的提示改为中文，继续使用网站的主题变量、Outfit/Plus Jakarta Sans 字体、卡片、边框、圆角和按钮样式。
- 保留键盘焦点样式和 `prefers-reduced-motion` 规则；所有主页面有可读标题，状态更新通过 live region 播报。

## 本地验收

- 通过运行中的 CMS 浏览器完成文章列表、设置页、发布页、编辑器的无障碍树检查；确认不同页面标题同步，设置/发布页面不会显示“新建文章”操作。
- 目视检查 CMS 浅色和深色界面；桌面 CMS 捕获视口为 1280×720。使用“预览博客页”实际启动隔离 Astro 预览，验证博客 Hero、归档、文章、标签和页脚由 Ulbo 页面真实渲染。预览截图视口为 516 像素宽。
- 通过有会话令牌的本机 API 完成私有草稿新建、读取、编辑和删除；对已发布文章验证本机软删除、恢复；临时草稿已清理。发布接口在实施分支正确拒绝发布。
- `npm test`：17 个测试文件、67 项通过。
- `npm run frontmatter:check`：4 篇源文章无格式变更和错误。
- `npm run check`：0 错误、0 警告、1 条浏览器 `beforeunload.returnValue` 弃用提示；该 API 用于离开页面前的未保存内容提醒。
- `npm run build`：成功，生成 21 个页面。Vite 仍有既有的大型 chunk 提示，不影响构建。
- `git diff --check`：通过。

CI 验收期间修正了三项环境差异：测试 fixture 显式将 bare Git remote 设为 `main`；Verify job 在独立 runner 上 checkout 源码，并以无依赖的 frontmatter 检查读取文章清单；CMS 状态查询限定 Astro Pages 工作流，忽略同一 SHA 的自动 Jekyll job。相应发布状态筛选加入了回归测试。

## 范围与限制

- 本机端到端测试没有向正式博客推送测试文章或更改现有文章内容；这类公开内容变更需要有者提供或确认正式文案。阶段 4 的 Git 发布边界、失败回滚和 push 拒绝行为已由隔离本地 Git fixture 覆盖。
- 浏览器自动化环境本次未提供设置 CSS 视口宽度的接口，因此未实测 390px 与 768px 两个精确宽度；CMS 已包含 640px 和 880px 两档窄屏布局及 reduced-motion 支持。完整移动设备目视复核可在用户本机调整浏览器窗口后完成。
- 最终公开站点部署以合并后 GitHub Actions `Verify live site` job 通过及线上页面返回成功为准；运行链接和 SHA 在下方补录。

## 提交与线上部署

CMS 阶段 0–5 代码 SHA：`217323f73b966267103283fbe0edf16f9e3bd5ec`。对应 [GitHub Actions 运行](https://github.com/Miles-gift/miles-gift.github.io/actions/runs/36226317907)已成功；Verify 检查首页 `/`、博客 `/blog/`、RSS，以及仓库中所有非草稿文章页和旧地址跳转。
