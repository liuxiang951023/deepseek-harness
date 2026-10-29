---
description: "/prototype 斜杠命令：把携带 PRD 与系统截图的对话请求作为一次原型任务提交；供希望用对话中已有素材生成原型的用户使用。"
kind: "package-reference"
---

# @deepseek-ai/dsh-command-prototype-studio

[English](README.md) | 中文

## 概述

`/prototype` 是原型请求的显式快捷方式。直接用自然语言说出需求同样可行：工具插件的提示词引导会识别携带 PRD 或截图的页面/原型请求，因此使用者无需记住本命令。使用时，输入框里附加的 PRD 文档与系统截图会随键入的请求一起作为一条用户消息提交，agent 因此先阅读这些素材，再调用 `@deepseek-ai/dsh-tool-prototype-studio` 的 `prototype_generate`。附件在命令执行前已由输入框准入，命令本身既不读取也不存储任何文件。

## 目录

- [使用本命令](#use-this-command)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-command"></a>
## 使用本命令

1. 用输入框的附件控件附加 PRD 与系统截图。
2. 输入 `/prototype` 并跟上请求内容——要生成的页面，以及需要还原真实系统时的系统地址与登录账号密码。
3. 发送。agent 会阅读附件，必要时登录真实系统，然后写出原型。

空请求会被拒绝并返回用法说明，而不是提交一个空回合。

<a id="understand-the-implementation"></a>
## 理解实现

- `src/index.ts` — 注册命令并开启 `input.attachments`，转发一条用户消息，内容是被准入的附件加一段固定指令。

<a id="further-exploration"></a>
## 延伸阅读

- `@deepseek-ai/dsh-tool-prototype-studio` — 编排生成简报的 `prototype_generate` 工具。

<a id="model-experience"></a>
## 模型体验

### 斜杠命令提交

#### 模型看到什么

一条普通用户消息：被准入的附件，其后紧跟一段文本，以 `Build a high-fidelity interactive prototype from this request.` 开头、说明必须先阅读附件，并以 `Request: <键入的请求>` 结尾。

#### Token 影响

每次调用固定几百 token 的指令块。附件 token 取决于输入框准入的内容；键入的请求只在消息内回显一次，不会出现第二份副本。

#### KV Cache 影响

纯追加：消息落在既有请求前缀之后，因此先前的 KV 缓存条目仍可复用。指令块不依赖请求文本，使追加内容在相似调用间保持稳定。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 命令无法校验附件内容、系统地址或登录凭据。
- 应用内没有原型预览；生成的文件从工作区文件面板打开。
- 命令直接提交消息、不返回可被 agent 拒绝的结果；误触发会消耗一个回合。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

本节是维护者的工作上下文：未决问题与尚未确定的方向，明确非权威——已交付的行为、限制与已接受的取舍见上文各节与包内代码。

#### 未来：自动识别意图

命令是显式的，因为附件意图并不唯一：单有 PRD 不等于“要做原型”。尚未设计出不依赖斜杠命令、靠提示词段落识别该意图的方案。

</details>
