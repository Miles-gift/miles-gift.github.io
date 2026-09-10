---
title: "uv 学习记录"
slug: uv-project-workflow
description: "我的 uv 原始学习笔记，记录 Python 版本、项目环境、依赖与常用命令。"
pubDate: 2026-09-10
resourceType: note
topic: 编程与工程工具
tags: [uv, Python, 环境管理]
sourceKind: personal-note
sourceUrl: ""
language: zh-cn
status: reference
progress: 100
rating: null
lastReviewedAt: 2026-09-10
cover: ""
coverAlt: ""
takeaways: []
draft: false
visibility: public
---

> 这是本人原始学习笔记的公开版本。除移除无法公开访问的本地图片路径并补充站点元数据外，正文保持原有内容与结构。
# UV学习记录

### 一、管理python版本

uv 内置 Python 版本管理功能，无需额外安装 pyenv 等工具。

查看可用的 Python 版本：

```bash
uv python list
```

输出结果类似如下：

```bash
cpython-3.14.0rc2-macos-aarch64-none                 <download available>
cpython-3.13.7-macos-aarch64-none                    <download available>
cpython-3.12.11-macos-aarch64-none                   <download available>
cpython-3.11.13-macos-aarch64-none                   <download available>
cpython-3.10.18-macos-aarch64-none                   <download available>
cpython-3.9.6-macos-aarch64-none                     /usr/bin/python3
pypy-3.11.13-macos-aarch64-none                      <download available>
```

安装特定版本的 Python：

```bash
# 安装最新的 Python 3.12
uv python install 3.12

# 安装特定版本
uv python install 3.11.6

# 安装 PyPy 版本
uv python install pypy3.10
```

设置全局默认 Python 版本：

```bash
uv python default 3.12
```

为当前项目固定 Python 版本（会创建 `.python-version` 文件）：

```bash
uv python pin 3.12
```

执行这个命令后，当前项目下就会生成一个 .python-version，打开后，显示版本号内容：

```bash
3.12
```

### 二、创建虚拟环境

创建虚拟环境：

```bash
# 在当前目录创建名为 .venv 的虚拟环境（使用系统默认 Python）
uv venv

# 使用指定 Python 版本创建虚拟环境
uv venv --python 3.12
```

激活虚拟环境：

```bash
# macOS / Linux
source .venv/bin/activate

# Windows（PowerShell）
.venv\Scripts\activate
```

退出虚拟环境：

```bash
deactivate
```

> *日常开发中可以使用* `uv run` *直接运行脚本，无需手动激活虚拟环境。*

### 三、包管理（pip兼容模式）

uv 提供了与 pip 完全兼容的命令接口，可以直接替换已有工作流中的 pip 命令：

安装包：

```bash
# 安装最新版本
uv pip install requests

# 安装特定版本
uv pip install requests==2.31.0

# 从 requirements.txt 批量安装
uv pip install -r requirements.txt
```

升级包：

```bash
uv pip install --upgrade requests
```

卸载包：

```bash
uv pip uninstall requests
```

查看已安装的包：

```bash
uv pip list
```

导出当前环境的依赖到 requirements.txt：

```bash
uv pip freeze > requirements.txt
```

### 四、项目管理（推荐方式）

uv 支持以 `pyproject.toml` 为中心的现代项目管理方式，这是比 pip 模式更推荐的使用方法，尤其适合团队协作和多环境部署。

#### 初始化项目

```bash
uv init my_project
cd my_project
```

这会创建以下基本项目结构：

```
my_project/
├── pyproject.toml    # 项目配置和依赖声明
├── .python-version   # 固定 Python 版本
├── README.md
└── main.py
```

#### 添加和移除依赖

在项目模式下，推荐使用 `uv add` 和 `uv remove` 管理依赖，它们会自动更新 `pyproject.toml` 和 `uv.lock`：

```bash
# 添加生产依赖
uv add requests

# 添加指定版本的依赖
uv add "requests>=2.31.0"

# 添加开发依赖（只在开发环境使用，如测试框架）
uv add --dev pytest ruff

# 移除依赖
uv remove requests
```

#### 安装项目全部依赖（uv sync）

克隆项目或更新 `pyproject.toml` 后，运行以下命令一键安装所有依赖：

```bash
uv sync
```

> **uv sync 说明：**类似于 `pip install -r requirements.txt`，它会根据 `pyproject.toml` 和 `uv.lock`安装所有依赖，确保环境与其他开发者完全一致。如果安装速度慢，可以在 `pyproject.toml` 中设置国内镜像源：
>
> ```bash
> [tool.uv]
> index-url = "https://pypi.tuna.tsinghua.edu.cn/simple"
> ```

#### 生成/更新锁文件

```
uv lock
```

该命令会解析 `pyproject.toml` 中的依赖并生成（或更新）`uv.lock` 文件。`uv.lock` 应该提交到版本库，确保团队所有成员使用完全相同的依赖版本。

### 五、运行脚本

`uv run` 是 uv 中非常实用的命令，可以**无需手动激活虚拟环境**直接运行脚本或命令，uv 会自动找到并使用正确的环境：

```
# 直接运行 Python 脚本
uv run main.py

# 运行项目中的测试
uv run pytest

# 运行任意命令（在虚拟环境的上下文中执行）
uv run python -c "import requests; print(requests.__version__)"
```

使用 `uv run` 相比手动激活环境的优势：不会误用错误的 Python 版本，也不会忘记激活环境导致包找不到，特别适合在 CI/CD 和脚本自动化中使用。
