---
description: "面向模型的原型工作室工具：prototype_generate 根据 agent 从对话中读到的 PRD 与截图编排一次高保真可交互原型任务，prototype_verify 依据同一份简报审计生成入口，直到通过。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-prototype-studio

[English](README.md) | 中文

## 概述

本包注册两个工具，把一个原型任务固定在契约上。`prototype_generate` 校验 agent 从对话中提取的输入——需求描述、页面名称、输出目录，以及可选的后台地址与登录凭据对——并返回有序生成简报与单文件入口。`prototype_verify` 读取工作区中的该入口，依据同一份简报审计，并逐条报告带行号的发现。两个工具都不写文件：agent 用常规写工具构建原型，并反复迭代直到审计通过。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

每个原型任务调用一次 `prototype_generate`，构建它指定的入口，然后调用 `prototype_verify`，在呈现结果前修掉每一条报错。简报按 Session 保存，因此审计调用无需重复输入。

### 审计检查什么

`prototype_verify` 落实提示词本身无法保证的契约：

- **离线预览**——不出现外部 `src`、`href` 或 `url()` 引用；下载后的页面断网也能打开。
- **本地资源**——每个被引用的本地文件都能在入口同级解析到。
- **页面覆盖**——每个声明的页面都有 `data-screen="<name>"` 标记，匹配不区分大小写。
- **未完成标记**——`TODO`、`FIXME`、`待补充`、`占位符`、`lorem ipsum` 以警告形式报告。
- **单文件结构**——缺少 viewport、内联 `<style>`、`<title>` 或交互处理函数时给出警告。

### 为什么工具不写文件

编排、构建与审计彼此分离，使每一次文件改动都留在普通工具日志里。agent 本就持有读写工具、每一步上下文与最终汇报。

<a id="understand-the-implementation"></a>
## 理解实现

- `src/brief.ts` — 纯输入校验与简报编排；需求描述的长度上限是部署配置字段 `maxRequirementsLength`，不是常量。
- `src/audit.ts` — 面向入口源码与 `assetExists` 查找的纯异步审计；发现带 1 起始的行号。
- `src/index.ts` — `prototype_generate` 与 `prototype_verify` 注册；两者只返回值，绝不改动工作区。

<a id="further-exploration"></a>
## 延伸阅读

- [docs/cookbook/adding-a-tool.zh.md](../../../docs/cookbook/adding-a-tool.zh.md) — 工具注册与 UI 呈现如何组合。
- `@deepseek-ai/dsh-command-prototype-studio` — 可选命令，把携带 PRD 与截图的对话请求提交为原型任务（`/prototype`）。

<a id="model-experience"></a>
## 模型体验

### 工具定义与返回

#### 模型看到什么

`prototype_generate` 接收必填的 `requirements`、`screens` 与 `outputDir`，以及可选的 `backendUrl`、`account`、`password`；返回简报对象：`entryFile` 固定为 `index.html`、`credentialsProvided`、`requirementsLength`、存在时回显的 `backendUrl`，以及有序的 `steps`。`prototype_verify` 接收可选的 `entryFile`，返回 `passed`、`errorCount`、`warningCount`、`screensFound`、`screensMissing`，以及带严重级别与行号的 `findings`。插件还注册一个提示词段落，写明自然语言触发条件，因此使用者无需记住命令。

##### Prototype Studio 意图段落

```markdown
Prototype Studio: when the person wants a page, screen, dashboard, admin console, report, or interactive prototype — especially with a PRD document or system screenshots attached — treat it as a prototype request.
Call prototype_generate once with the inputs you extracted, then build the self-contained HTML entry it names. Never ask them for a command or a filled-in form first.
Read the attached PRD and screenshots before designing. When they give a backend URL with an account and password, sign in and study the real pages for layout, navigation, and visual language.
Before you report a prototype as done, call prototype_verify and fix every error it reports. Present the entry file with the present tool so the person can download the code.
```

#### Token 影响

两个工具可见时每个请求都有固定的定义开销，外加每个原型任务一份简报与每次审计一份结果。简报只把需求描述回显为码点数量、从不回显登录凭据对；每条发现只占一行，因此反复审计的调用结果仍然很小。

#### KV Cache 影响

工具定义与可见性不变时前缀稳定。追加简报或审计结果跟在可复用请求前缀之后；卸载 bundle 会移除定义，并使基于它的复用失效。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 审计是静态的：不渲染页面、不截图，也不与参考截图做像素比对；视觉保真度仍由 agent 判断。
- 工具无法验证 `backendUrl` 可达或凭据有效；失败会在 agent 的抓取或浏览器工具中暴露。
- PRD 文档与截图以对话附件形式到达 agent，在提示词准入前完成解析；本包既不读取也不校验它们。
- 页面覆盖基于标记：审计证明每个声明页面都有 `data-screen` 元素，而不是证明其布局与参考一致。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

本节是维护者的工作上下文：未决问题与尚未确定的方向，明确非权威——已交付的行为、限制与已接受的取舍见上文各节与包内代码。

#### 未来：渲染验证

渲染验证需要截图服务。`@deepseek-ai/dsh-browser-use` 只提供独占的 provider 名称槽位，其 provider 注册的是工具，目前没有程序化截图的接缝。若该接缝出现，审计可在不改动简报的前提下增加视觉比对阶段。

</details>
