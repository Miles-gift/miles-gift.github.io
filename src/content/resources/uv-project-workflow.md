---
title: uv 项目工作流
slug: uv-project-workflow
description: 以 uv 官方项目指南为核验基线，整理 Python 版本、环境、依赖、锁文件和运行命令之间的关系。
pubDate: 2026-09-10
resourceType: documentation
topic: 工程工具
tags: [uv, Python, 环境管理]
sourceUrl: https://docs.astral.sh/uv/guides/projects/
author: Astral
publisher: Astral
language: en
status: learning
progress: 60
rating: null
startedAt: 2026-09-10
lastReviewedAt: 2026-09-10
cover: ""
coverAlt: ""
takeaways: [区分解释器与项目环境, 将依赖声明和锁文件一起维护, 发布前在干净目录复现命令]
draft: false
visibility: public
---

## 为什么收藏

现有 uv 笔记已经有较完整的命令清单，但命令行工具变化较快。公开版本应以官方文档为准，并在当前环境逐条实测，而不是把旧速查表原样发布。

## 整理框架

- Python 解释器的安装与选择。
- 项目初始化、虚拟环境和依赖声明。
- 锁文件、同步与可复现安装。
- 脚本、工具和项目命令的边界。
- 常见失败场景与诊断顺序。

当前条目是学习索引；完整速查会在真实项目中复现后单独成文。
