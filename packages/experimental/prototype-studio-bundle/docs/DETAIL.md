# Prototype Studio

Turn a conversation plus your uploaded PRD and screenshots into a high-fidelity interactive prototype.

## What it does

With this bundle switched on, the agent recognizes prototype requests on its own: a conversation gains the `prototype_generate` tool, and `/prototype` remains an optional shortcut. You stay in the ordinary composer:

- attach the PRD document (Word, PDF, Markdown, …) and the system page screenshots with the attachment control;
- write the request in plain text — the pages, the interactions, the style;
- when the prototype must mirror a live system, include its online backend address with the login account and password.

Just send it — for example "build an order admin console from this PRD with list, detail, and review dialogs". The agent reads the attached PRD and screenshots, optionally signs in to the backend to study the real page structure and visual language, and writes one self-contained `index.html` with inline CSS and JavaScript. It then runs `prototype_verify`, which audits the entry against the brief — external references, missing local assets, uncovered screens, unfinished markers — and keeps fixing until the audit passes.

## How to use it

1. Switch the bundle on from the Plugins page.
2. Open a conversation.
3. Attach the PRD and screenshots with the composer's attachment control.
4. Describe the request; include the backend address and login when the prototype must mirror a live system. Type `/prototype` first when you want to be explicit.
5. Send. The agent works through the brief, verifies the entry, and reports it.
6. Open `index.html` in the workspace file surface to preview it, or download the source.

## Notes

- Login details written into the conversation become part of the prompt, so they are model-visible and logged. Use a dedicated read-only account.
- Verification is static: it proves the page covers every declared screen and opens offline, not that it matches the reference screenshots pixel for pixel.
- The command cannot verify attachment contents, reachability, or credentials; failures surface while the agent browses.
