---
description: "原型工作室 bundle：/prototype 命令与 prototype_generate 工具，把附加的 PRD、系统截图与文字请求变成可下载的高保真可交互原型。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-prototype-studio-bundle

[English](README.md) | 中文

## 概述

原型工作室是一个可选 bundle。它加入两个条目：`@deepseek-ai/dsh-command-prototype-studio`（把对话请求连同附加的 PRD 与截图一起提交的 `/prototype` 命令）与 `@deepseek-ai/dsh-tool-prototype-studio`（构建生成简报的 `prototype_generate` 工具）。工具插件还注册一段提示词引导，agent 因此能用自然语言识别原型请求，`/prototype` 只是可选快捷方式。在「插件」页打开之前，两者都不会加载。

## 目录

- [使用本 bundle](#use-this-bundle)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-bundle"></a>
## 使用本 bundle

在「插件」页打开，然后进入会话。完整使用步骤与凭据注意事项见 [docs/](docs/DETAIL.md)。

<a id="understand-the-implementation"></a>
## 理解实现

- `cordis.patch.yml` — 插入一个组，包含命令插件与带 `maxRequirementsLength` 上限的工具插件。
- `src/index.ts` — bundle 层不承载运行时代码。

<a id="further-exploration"></a>
## 延伸阅读

- `@deepseek-ai/dsh-command-prototype-studio` — `/prototype` 命令。
- `@deepseek-ai/dsh-tool-prototype-studio` — 面向模型的简报工具。

<a id="model-experience"></a>
## 模型体验

### 组合的命令与工具

#### 模型看到什么

打开本 bundle 后，工具列表多出 `prototype_generate`，用户命令面板多出 `/prototype`。命令本身的提交表现为一条普通用户消息，内容为附件加一段固定指令。

#### Token 影响

两个条目只在 bundle 打开时消耗 token：每个请求一份固定的工具定义开销，外加每个原型任务一份简报，以及每次 `/prototype` 调用一段固定指令。

#### KV Cache 影响

bundle 保持打开时前缀稳定。关闭它会移除工具定义与命令，并使变更点之后的复用失效。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 应用内没有原型预览；结果从工作区下载。
- bundle 无法验证附件内容、后台地址或登录凭据。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

本节是维护者的工作上下文：未决问题与尚未确定的方向，明确非权威——已交付的行为、限制与已接受的取舍见上文各节与包内代码。

#### 未来：应用内原型预览

预览需要宿主侧渲染生成的文件，并保证它不进入模型上下文。目前尚无设计。

</details>
