/** Plugin registration: both studio tools execute through the runtime. */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import ToolRuntime, { type ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { provideWorkingDirectoryFixture } from '@deepseek-ai/dsh-agent-loop-testkit'
import { apply } from '../src/index.ts'

const cleanups: Array<() => Promise<unknown>> = []
afterEach(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup()
  cleanups.length = 0
})

function owner(cwd: string): Agent {
  const id = SessionId('prototype-studio')
  const session = Session.create(id, [], {
    version: SESSION_FORMAT_VERSION, id, createdAt: 0, cwd, isSeeded: false,
  })
  return { id, session } as Agent
}

async function setup(maxRequirementsLength = 4000) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-prototype-studio-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  provideWorkingDirectoryFixture(ctx, root)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(LocalFileSystem, { cwd: root })
  apply(ctx, { maxRequirementsLength })
  const agent = owner(root)
  return {
    root,
    execute: (name: string, args: Record<string, unknown>): Promise<ToolExecutionResult> =>
      executeToolFixture(ctx, {
        agent,
        name,
        arguments: args,
        callId: ToolCallId('call'),
        signal: new AbortController().signal,
      }),
  }
}

it('registers prototype_generate and returns the composed brief', async () => {
  const h = await setup()
  const result = await h.execute('prototype_generate', {
    requirements: 'admin dashboard',
    screens: ['List', 'Detail'],
    outputDir: 'out',
  })
  expect(result.content).toEqual([{
    type: 'text',
    text: 'Prototype brief ready: write the self-contained out/index.html, 2 screen(s), 5 steps.',
  }])
})

it('surfaces brief validation failures as structured tool errors', async () => {
  const h = await setup()
  const result = await h.execute('prototype_generate', {
    requirements: '  ',
    screens: ['List'],
    outputDir: 'out',
  })
  expect(result.isError).toBe(true)
  expect(result.error).toEqual({ message: 'requirements must describe the prototype' })
})

it('refuses to verify before a brief exists', async () => {
  const h = await setup()
  const result = await h.execute('prototype_verify', {})
  expect(result.isError).toBe(true)
  expect(result.error).toEqual({
    message: 'call prototype_generate first; prototype_verify audits the prototype against its brief',
  })
})

it('audits the written entry against the brief and reports missing screens', async () => {
  const h = await setup()
  await h.execute('prototype_generate', {
    requirements: 'admin dashboard',
    screens: ['List', 'Detail'],
    outputDir: 'out',
  })
  await mkdir(join(h.root, 'out'), { recursive: true })
  await writeFile(join(h.root, 'out', 'index.html'), [
    '<!doctype html><html><head><meta name="viewport" content="width=device-width">',
    '<title>Admin</title><style>body{margin:0}</style></head>',
    '<body><main data-screen="List" onclick="go()"></main></body></html>',
  ].join(''))
  const result = await h.execute('prototype_verify', {})
  expect(result.isError).toBe(false)
  expect(result.content).toEqual([{
    type: 'text',
    text: [
      'Prototype audit FAILED with 1 error(s).',
      '1 error(s), 0 warning(s); screens 1/2.',
      '[error] missing data-screen markers for: Detail',
    ].join('\n'),
  }])
})

it('rejects a non-positive maxRequirementsLength at load', async () => {
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  provideWorkingDirectoryFixture(ctx)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(LocalFileSystem, { cwd: process.cwd() })
  expect(() => { apply(ctx, { maxRequirementsLength: 0 }) }).toThrow(
    'tool-prototype-studio: maxRequirementsLength must be a positive integer',
  )
})
