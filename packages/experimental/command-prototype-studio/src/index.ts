/**
 * Human-facing `/prototype` command. One invocation submits the composer's
 * admitted PRD and screenshot attachments together with the typed request as a
 * single user message, so the agent reads the material and then calls the
 * `prototype_generate` tool to frame the prototype task.
 * @module @deepseek-ai/dsh-command-prototype-studio
 */

import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands/brand'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

export const name = 'command-prototype-studio'

/** The command registry is the only service this plugin contributes through. */
export const inject = ['commands']

const USAGE = 'Usage: /prototype <request — the pages you want, the system URL and its login when the prototype must mirror it>'

/**
 * Instructions prepended to the typed request. They name the attachment roles
 * the agent must read first and fix the single-file output so the result
 * previews and downloads locally.
 */
const INSTRUCTIONS = [
  'Build a high-fidelity interactive prototype from this request.',
  'Review every attachment on this message before designing: a PRD document defines the scope, and screenshots show the real system pages.',
  'When the request names a system URL together with a login account and password, open it, sign in, and study the real page structure and visual language for fidelity.',
  'Call the prototype_generate tool once with the inputs you extracted, then build the prototype it describes.',
  'Write ONE self-contained HTML entry file with inline CSS and JavaScript — no build step, no external network dependencies — so it previews locally and downloads as source.',
].join('\n')

/**
 * Register the `/prototype` command.
 * @param ctx - registrant context carrying the command registry.
 */
export function apply(ctx: Context): void {
  ctx.commands.register({
    definitionId: CommandDefinitionId('@deepseek-ai/dsh-command-prototype-studio'),
    name: 'prototype',
    description: 'Build an interactive prototype from this request, its PRD, and its screenshots',
    input: { hint: '<request>', attachments: true },
    handler: ({ agent, rawInput, attachments }): CommandResult => {
      const request = rawInput.trim()
      if (request.length === 0) {
        return { kind: 'error', text: `Prototype Studio needs a request.\n${USAGE}` }
      }
      agent.followup(createUserMessage({
        content: [...attachments, { type: 'text', text: `${INSTRUCTIONS}\n\nRequest: ${request}` }],
        source: { kind: 'user' },
      }))
      return {
        kind: 'success',
        text: attachments.length === 0
          ? 'Prototype request submitted.'
          : `Prototype request submitted with ${attachments.length} attachment(s).`,
      }
    },
  })
}
