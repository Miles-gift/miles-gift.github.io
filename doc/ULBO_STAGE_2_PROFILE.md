# 阶段 2：作者与站点配置

## 配置来源

所有个人事实均来自旧站 `src/content/spec/about/zh-cn.md` 中公开的作者介绍：显示名 yoyo、华中科技大学集成电路学院、电子科学与技术本科、预计 2027 年毕业、高性能处理器电源架构探索方向、AI 芯片与集成电路设计兴趣、健身/美食/乒乓球爱好、中国湖北武汉位置、GitHub `Miles-gift`。

## 变更

- `src/config/site.ts`：canonical 站点设为 `https://miles-gift.github.io/`；标题设为 `yoyo`；站点描述采用上述公开学习方向；导航仓库地址指向 `Miles-gift/miles-gift.github.io`。
- `src/config/profile.ts`：填入 yoyo 的真实教育身份、研究兴趣、爱好、位置及 GitHub。移除对模板默认头像的引用，让 Ulbo 原有的姓名首字母占位逻辑显示；未设置未确认的邮箱。
- `src/config/hero.ts`：只替换首页/关于页的示例文字为从作者简介提取的真实文案；沿用原配置字段、Hero 图片、组件、布局和动画。
- 保持 Ulbo 博客归档、标签等页面的原版界面文案、样式和结构。

## 验证记录

| 命令/检查 | 结果 |
| --- | --- |
| `npm run check` | 通过：92 files，0 errors/warnings/hints。 |
| `npm run build` | 通过；生成网站标题 `yoyo | 个人博客`，canonical、OG、RSS 与 Person 结构化数据使用正确站点/作者地址。 |
| 占位值扫描 | 在生产构建中未发现 `Your Name`、`Your Role / Focus`、`Your City`、`you@example.com`、`example.com`、上游演示域名、模板仓库或演示名称。 |
| 个人资料核对 | 仅展示旧站已公开的教育/方向/兴趣/位置/GitHub；没有邮箱、头像或新增履历。 |

## 阶段 2 完成清单

- [x] 站点 URL、标题、描述、仓库链接已配置。
- [x] Ulbo 原生个人资料字段填入作者公开信息。
- [x] 移除虚构邮箱、社交链接和模板头像显示。
- [x] 清除 Hero 配置中的示例文案，保留模板组件。
- [x] 静态检查与空内容构建通过。
- [x] 本阶段变更与检查已完成（提交、推送随后进行）。
