---
description: "The model-facing prototype studio tools: prototype_generate frames one high-fidelity interactive prototype task from the PRD and screenshots the agent read out of the conversation, and prototype_verify audits the generated entry against that brief until it passes."
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-prototype-studio

English | [中文](README.zh.md)

## Summary

The package registers two tools that keep one prototype task on contract. `prototype_generate` validates the inputs the agent extracted from the conversation — the requirement description, the screen names, the output directory, and optionally the backend URL with a login pair — and returns an ordered generation brief with a single-file entry. `prototype_verify` reads that entry from the workspace and audits it against the same brief, reporting each finding with its line number. Neither tool writes files: the agent builds the prototype with its normal write tools and iterates until the audit passes.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The agent calls `prototype_generate` once per prototype task, builds the entry it names, then calls `prototype_verify` and fixes every reported error before presenting the result. The brief is held per Session, so the verify call needs no repeated inputs.

### What the audit checks

`prototype_verify` enforces the contract a prompt alone cannot guarantee:

- **Offline preview** — no external `src`, `href`, or `url()` reference; the downloaded page must open without a network.
- **Local assets** — every referenced local file resolves next to the entry.
- **Screen coverage** — each declared screen has a `data-screen="<name>"` marker, matched case-insensitively.
- **Unfinished markers** — `TODO`, `FIXME`, `待补充`, `占位符`, and `lorem ipsum` are reported as warnings.
- **Single-file structure** — missing viewport, inline `<style>`, `<title>`, or an interaction handler are warnings.

### Why the tools do not write files

Framing, building, and auditing stay separate so every file mutation remains visible in the ordinary tool log. The agent already owns read and write tools, per-step context, and the final report.

<a id="understand-the-implementation"></a>
## Understand the implementation

- `src/brief.ts` — pure input validation and brief composition; the requirement description bound is a deployment `Config` field (`maxRequirementsLength`), not a constant.
- `src/audit.ts` — pure async audit over the entry source plus an `assetExists` lookup; findings carry 1-based line numbers.
- `src/index.ts` — `prototype_generate` and `prototype_verify` registration; both return values and never mutate the workspace.

<a id="further-exploration"></a>
## Further Exploration

- [docs/cookbook/adding-a-tool.md](../../../docs/cookbook/adding-a-tool.md) — how tool registration and UI presentation compose.
- `@deepseek-ai/dsh-command-prototype-studio` — the optional `/prototype` command that submits a conversation request with its PRD and screenshots.

<a id="model-experience"></a>
## Model Experience

### Tool definitions and results

#### What the model sees

`prototype_generate` takes required `requirements`, `screens`, and `outputDir` plus optional `backendUrl`, `account`, and `password`, and returns a brief object: `entryFile` always `index.html`, `credentialsProvided`, `requirementsLength`, the echoed `backendUrl` when present, and ordered `steps`. `prototype_verify` takes an optional `entryFile` and returns `passed`, `errorCount`, `warningCount`, `screensFound`, `screensMissing`, and `findings` with severities and line numbers. The plugin also registers one prompt section naming the plain-language trigger, so people never have to learn a command.

##### Prototype Studio intent section

```markdown
Prototype Studio: when the person wants a page, screen, dashboard, admin console, report, or interactive prototype — especially with a PRD document or system screenshots attached — treat it as a prototype request.
Call prototype_generate once with the inputs you extracted, then build the self-contained HTML entry it names. Never ask them for a command or a filled-in form first.
Read the attached PRD and screenshots before designing. When they give a backend URL with an account and password, sign in and study the real pages for layout, navigation, and visual language.
Before you report a prototype as done, call prototype_verify and fix every error it reports. Present the entry file with the present tool so the person can download the code.
```

#### Token effect

A fixed definition cost on every request where the two tools are visible, plus one brief per prototype task and one audit result per verify call. The brief echoes the requirement description only as a code-point count and never echoes the login pair; findings carry one short line each, so repeated verify calls stay small.

#### KV Cache effect

Prefix-stable while the tool definitions and visibility are unchanged. Appending a brief or an audit result follows the reusable request prefix; unloading the bundle removes the definitions and invalidates reuse from them.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The audit is static. It does not render the page, capture screenshots, or compare pixels against the reference screenshots; visual fidelity remains the agent's judgment.
- The tools cannot verify that `backendUrl` is reachable or that the credentials work; failures surface in the agent's fetch or browser tools.
- PRD documents and screenshots reach the agent as conversation attachments, resolved before prompt admission; these tools neither read nor verify them.
- Screen coverage is marker-based: the audit proves each declared screen has a `data-screen` element, not that its layout matches the reference.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and directions that are not decided. It is explicitly non-authoritative — shipped behavior, limits, and accepted rationale live in the sections above and the package code.

#### Future: rendered verification

A rendered check would need a screenshot service. `@deepseek-ai/dsh-browser-use` exposes an exclusive provider-name slot and its providers register tools, so no programmatic capture seam exists yet. If one lands, the audit can gain a visual-diff stage without changing the brief.

</details>
