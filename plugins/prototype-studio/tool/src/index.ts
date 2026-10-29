/**
 * Prototype Studio tools: `prototype_generate` frames one high-fidelity
 * interactive prototype task into a machine-checkable brief, and
 * `prototype_verify` audits the generated entry against that brief until it
 * passes. File creation stays with the agent's normal write tools; the verify
 * loop is what a prompt cannot guarantee on its own.
 * Named exports preserve loader injection metadata.
 * @module @deepseek-ai/dsh-tool-prototype-studio
 */

import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool, type ToolExecution } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-working-directory'
import type { Session } from '@deepseek-ai/dsh-session'
import { auditPrototype } from './audit.ts'
import { composeBrief, type PrototypeBrief } from './brief.ts'

export const name = 'tool-prototype-studio'

/** Registries and services this plugin contributes through. */
export const inject = ['tools', 'systemPrompt', 'fs', 'workingDirectory']

/** Model-facing Prototype Studio configuration. */
export interface Config {
  /**
   * Required deployment bound on the requirement description, in code points.
   * A long description is the main unbounded token input of the tool, so the
   * ceiling is a deployment choice rather than a fixed constant.
   */
  maxRequirementsLength: number
}

/** Schemastery configuration for the Prototype Studio consumer. */
export const Config: z<Config> = z.object({
  maxRequirementsLength: z.number().required(),
})

const GENERATE_DESCRIPTION =
  'Frame a high-fidelity interactive web prototype task. Call it once with the studio inputs — '
  + 'the backend preview URL with optional login credentials, the requirement description, the '
  + 'screen names, and the output directory — after reading the PRD document and system screenshots '
  + 'attached to the conversation. It returns the ordered generation steps and the single-file entry '
  + 'contract. Build the prototype afterwards with the normal write tools; this tool itself writes no files.'

const VERIFY_DESCRIPTION =
  'Audit the generated prototype entry against the brief from prototype_generate before reporting '
  + 'completion. It checks the offline-preview guarantee, resolves every local asset reference, counts '
  + 'the data-screen markers against the declared screens, and reports unfinished markers, each with '
  + 'its line number. Fix every error and call it again until it passes; a failed audit is never the '
  + 'end of the task.'

/** Wire payload schema mirrored in the generate return. */
const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    outputDir: { type: 'string', required: true },
    entryFile: { type: 'string', required: true },
    screens: { type: 'array', required: true, items: { type: 'string' } },
    backendUrl: { type: 'string' },
    credentialsProvided: { type: 'boolean', required: true },
    requirementsLength: { type: 'integer', required: true },
    steps: { type: 'array', required: true, items: { type: 'string' } },
  },
} as const

/** Wire payload schema mirrored in the verify return. */
const AUDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    passed: { type: 'boolean', required: true },
    errorCount: { type: 'integer', required: true },
    warningCount: { type: 'integer', required: true },
    screensFound: { type: 'array', required: true, items: { type: 'string' } },
    screensMissing: { type: 'array', required: true, items: { type: 'string' } },
    findings: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', required: true },
          line: { type: 'integer' },
          message: { type: 'string', required: true },
        },
      },
    },
  },
} as const

/**
 * Intent guidance so people never need to learn a command: a request for a
 * screen plus a PRD or screenshots is the trigger, and the conversation is the
 * whole input surface.
 */
const GUIDANCE = [
  'Prototype Studio: when the person wants a page, screen, dashboard, admin console, report, or interactive prototype — especially with a PRD document or system screenshots attached — treat it as a prototype request.',
  'Call prototype_generate once with the inputs you extracted, then build the self-contained HTML entry it names. Never ask them for a command or a filled-in form first.',
  'Read the attached PRD and screenshots before designing. When they give a backend URL with an account and password, sign in and study the real pages for layout, navigation, and visual language.',
  'Before you report a prototype as done, call prototype_verify and fix every error it reports. Present the entry file with the present tool so the person can download the code.',
].join('\n')

/** The wire payload `prototype_verify` returns and renders for the model. */
interface AuditPayload {
  readonly passed: boolean
  readonly screensFound: readonly string[]
  readonly screensMissing: readonly string[]
  readonly findings: readonly {
    readonly severity: string
    readonly line?: number
    readonly message: string
  }[]
}

/**
 * Render the audit verdict as the model-facing tool result.
 * @param result - wire payload returned by the audit.
 * @returns the text shown to the model.
 */
function renderAudit(result: AuditPayload): string {
  const errors = result.findings.filter(finding => finding.severity === 'error').length
  const warnings = result.findings.length - errors
  const lines = result.findings.map((finding) => {
    const position = finding.line === undefined ? '' : `line ${finding.line}: `
    return `[${finding.severity}] ${position}${finding.message}`
  })
  return [
    result.passed ? 'Prototype audit PASSED.' : `Prototype audit FAILED with ${errors} error(s).`,
    `${errors} error(s), ${warnings} warning(s); screens ${result.screensFound.length}/${result.screensFound.length + result.screensMissing.length}.`,
    ...lines,
  ].join('\n')
}

/**
 * Register the studio tools and their intent guidance.
 * @param ctx - registrant context carrying the tool, prompt-section, filesystem, and working-directory services.
 * @param config - deployment's explicit requirement bound.
 */
export function apply(ctx: Context, config: Config): void {
  const maxRequirementsLength = config.maxRequirementsLength
  if (!Number.isInteger(maxRequirementsLength) || maxRequirementsLength < 1) {
    throw new Error('tool-prototype-studio: maxRequirementsLength must be a positive integer')
  }

  const briefs = new WeakMap<Session, PrototypeBrief>()
  const sessionOf = (exec: ToolExecution): Session => {
    const session = exec.agent?.session
    if (session === undefined) throw new Error('prototype studio tools require an agent Session')
    return session
  }

  ctx.tools.register(defineTool({
    name: 'prototype_generate',
    description: GENERATE_DESCRIPTION,
    parameters: {
      backendUrl: {
        type: 'string',
        description: 'Online admin/backend URL the prototype should mirror; omit when the requester gave none.',
      },
      account: {
        type: 'string',
        description: 'Login account for that backend; supply only together with backendUrl and password.',
      },
      password: {
        type: 'string',
        description: 'Login password for that backend; supply only together with backendUrl and account.',
      },
      screens: {
        type: 'array',
        required: true,
        items: { type: 'string' },
        description: 'Screen names the prototype must cover, one per page, taken from the PRD and screenshots.',
      },
      requirements: {
        type: 'string',
        required: true,
        description: 'The requester requirement description; every page, interaction, and style point to cover.',
      },
      outputDir: {
        type: 'string',
        required: true,
        description: 'Workspace directory the prototype files are written into.',
      },
    },
    output: {
      schema: BRIEF_SCHEMA,
      render: (_args, value) => [{
        type: 'text',
        text: `Prototype brief ready: write the self-contained ${value.outputDir}/${value.entryFile}, `
          + `${value.screens.length} screen(s), ${value.steps.length} steps.`,
      }],
    },
    execute(args, exec) {
      const brief = composeBrief(args, maxRequirementsLength)
      briefs.set(sessionOf(exec), brief)
      return Promise.resolve({
        ...brief,
        screens: [...brief.screens],
        steps: [...brief.steps],
      })
    },
    presentCall: args => ({
      card: 'generic',
      title: 'Frame prototype task',
      kind: 'other',
      rawInput: args,
    }),
  }))

  ctx.tools.register(defineTool({
    name: 'prototype_verify',
    description: VERIFY_DESCRIPTION,
    parameters: {
      entryFile: {
        type: 'string',
        description: 'Entry file relative to the brief output directory; defaults to the brief entry file.',
      },
    },
    output: {
      schema: AUDIT_SCHEMA,
      render: (_args, value) => [{
        type: 'text',
        text: renderAudit(value),
      }],
    },
    async execute(args, exec) {
      const session = sessionOf(exec)
      const brief = briefs.get(session)
      if (brief === undefined) {
        throw new Error('call prototype_generate first; prototype_verify audits the prototype against its brief')
      }
      const cwd = ctx.workingDirectory.get(session)
      const entryFile = (args.entryFile ?? brief.entryFile).trim()
      const entryPath = join(brief.outputDir, entryFile)
      const entry = await ctx.fs.resolve(entryPath, { cwd, signal: exec.signal })
      const info = await ctx.fs.stat(entry, exec.signal)
      if (info === undefined) throw new Error(`the entry file "${entryPath}" does not exist yet`)
      const html = await ctx.fs.readText(entry, exec.signal)
      const entryDir = join(cwd, dirname(entryPath))
      const audit = await auditPrototype(html, brief, {
        assetExists: async (relativePath) => {
          const target = await ctx.fs.resolve(relativePath, { cwd: entryDir, signal: exec.signal })
          return (await ctx.fs.stat(target, exec.signal)) !== undefined
        },
      })
      const errors = audit.findings.filter(finding => finding.severity === 'error').length
      return {
        passed: audit.passed,
        errorCount: errors,
        warningCount: audit.findings.length - errors,
        screensFound: [...audit.screensFound],
        screensMissing: [...audit.screensMissing],
        findings: audit.findings.map(finding => ({ ...finding })),
      }
    },
    presentCall: args => ({
      card: 'generic',
      title: 'Verify prototype',
      kind: 'other',
      rawInput: args,
    }),
  }))

  ctx.systemPrompt.section({
    name: 'prototype-studio:intent',
    text: GUIDANCE,
    order: ctx.systemPrompt.getSectionOrder('TOOL_COMPUTER_USE'),
  })
}
