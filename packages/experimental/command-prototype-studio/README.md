---
description: "The /prototype slash command: submits a conversation request with its attached PRD and system screenshots as one prototype task, for users who want a prototype built from material already in the chat."
kind: "package-reference"
---

# @deepseek-ai/dsh-command-prototype-studio

English | [中文](README.zh.md)

## Summary

`/prototype` is the explicit shortcut for a prototype request. Typing the request in plain language works too: the tool plugin's prompt guidance recognizes a page or prototype request that carries a PRD or screenshots, so nobody has to learn this command. When used, the PRD documents and system screenshots attached in the composer ride along with the typed request as one user message, so the agent reads that material before designing and then calls `prototype_generate` from `@deepseek-ai/dsh-tool-prototype-studio`. Attachments are admitted by the composer before the command runs, so the command itself neither reads nor stores any file.

## Table of Contents

- [Use this command](#use-this-command)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-command"></a>
## Use this command

1. Attach the PRD and any system screenshots with the composer's attachment control.
2. Type `/prototype` followed by the request — the pages to build, and the system URL with its login account and password when the prototype must mirror a live system.
3. Send. The agent reviews the attachments, optionally signs in to the live system, and writes the prototype.

An empty request is rejected with the usage line instead of submitting an empty turn.

<a id="understand-the-implementation"></a>
## Understand the implementation

- `src/index.ts` — registers the command with `input.attachments` enabled and forwards one user message carrying the admitted attachments plus a fixed instruction block.

<a id="further-exploration"></a>
## Further Exploration

- `@deepseek-ai/dsh-tool-prototype-studio` — the `prototype_generate` tool that frames the generation brief.

<a id="model-experience"></a>
## Model Experience

### Slash command submission

#### What the model sees

One ordinary user message: the admitted attachments followed by a text part that opens with `Build a high-fidelity interactive prototype from this request.`, states that attachments must be reviewed first, and closes with `Request: <typed request>`.

#### Token effect

The instruction block is a fixed few hundred tokens per invocation. Attachment tokens are whatever the composer admitted; the typed request is echoed once inside the message rather than in a second copy.

#### KV Cache effect

Append-only: the message lands after the existing request prefix, so earlier KV-cache entries stay reusable. Nothing in the instruction block depends on the request text, which keeps the appended text stable across similar invocations.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The command cannot verify attachment contents, the system URL, or the login credentials.
- There is no in-app prototype preview; the generated file opens from the workspace file surface.
- The command submits the message directly and returns no result the agent can decline; a mistaken invocation costs one turn.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and directions that are not decided. It is explicitly non-authoritative — shipped behavior, limits, and accepted rationale live in the sections above and the package code.

#### Future: automatic intent detection

The command is deliberate because attachment intent is ambiguous: a PRD alone does not mean "build a prototype". Prompt-section guidance that recognizes the intent without a slash command has no design yet.

</details>
