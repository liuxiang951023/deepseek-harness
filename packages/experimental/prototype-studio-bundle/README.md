---
description: "The Prototype Studio bundle: the /prototype command plus the prototype_generate tool that turn an attached PRD, system screenshots, and a written request into a downloadable high-fidelity interactive prototype."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-prototype-studio-bundle

English | [中文](README.zh.md)

## Summary

Prototype Studio is an opt-in bundle. It adds two entries: `@deepseek-ai/dsh-command-prototype-studio`, the `/prototype` command that submits the conversation request together with its attached PRD and screenshots, and `@deepseek-ai/dsh-tool-prototype-studio`, the `prototype_generate` tool that frames the generation brief. The tool plugin also registers prompt guidance, so the agent recognizes a prototype request in plain language and `/prototype` stays an optional shortcut. Neither loads until the bundle is switched on from the Plugins page.

## Table of Contents

- [Use this bundle](#use-this-bundle)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-bundle"></a>
## Use this bundle

Enable it from the Plugins page, then open a conversation. Full usage steps and the credential caveat are in [`docs/`](docs/DETAIL.md).

<a id="understand-the-implementation"></a>
## Understand the implementation

- `cordis.patch.yml` — inserts one group holding the command plugin and the tool plugin with its `maxRequirementsLength` bound.
- `src/index.ts` — the bundle layer carries no runtime code.

<a id="further-exploration"></a>
## Further Exploration

- `@deepseek-ai/dsh-command-prototype-studio` — the `/prototype` command.
- `@deepseek-ai/dsh-tool-prototype-studio` — the model-facing brief tool.

<a id="model-experience"></a>
## Model Experience

### Bundled command and tool

#### What the model sees

Switching the bundle on adds `prototype_generate` to the tool list and the `/prototype` command to the user's command surface. The command's own submission appears as one ordinary user message carrying the attachments plus a fixed instruction block.

#### Token effect

Both entries cost tokens only while the bundle is on: a fixed tool definition on every request plus the brief for each prototype task, and a fixed instruction block per `/prototype` invocation.

#### KV Cache effect

Prefix-stable while the bundle stays on. Switching it off removes the tool definition and the command, invalidating reuse from the change point.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- There is no prototype preview inside the app; the result is downloaded from the workspace.
- The bundle cannot verify attachment contents, the backend address, or the login credentials.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and directions that are not decided. It is explicitly non-authoritative — shipped behavior, limits, and accepted rationale live in the sections above and the package code.

#### Future: in-app prototype preview

A preview would need a host-side renderer for the generated file and a way to keep it out of model context. No design exists yet.

</details>
