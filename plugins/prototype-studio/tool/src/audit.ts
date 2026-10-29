/**
 * Pure contract audit for a generated prototype. The browser is not rendered
 * here: findings cover the offline-preview guarantee, local asset resolution,
 * declared screen coverage, and unfinished markers, each with its line number
 * so the agent can fix precisely.
 * @module @deepseek-ai/dsh-tool-prototype-studio/audit
 */

import type { PrototypeBrief } from './brief.ts'

/** Severity of one audit finding; any error fails the audit. */
export type AuditSeverity = 'error' | 'warning'

/** One actionable finding, located by 1-based line when the source allows it. */
export interface AuditFinding {
  readonly severity: AuditSeverity
  /** 1-based source line; absent for whole-file findings. */
  readonly line?: number
  readonly message: string
}

/** Collaborators the audit cannot derive from the HTML alone. */
export interface AuditHooks {
  /**
   * Whether a referenced local file resolves next to the entry file.
   * @param relativePath - reference value with query and fragment removed.
   * @returns true when the file exists.
   */
  readonly assetExists: (relativePath: string) => Promise<boolean>
}

/** Outcome of one audit pass. */
export interface AuditResult {
  /** Whether no finding has `severity: 'error'`. */
  readonly passed: boolean
  readonly findings: readonly AuditFinding[]
  /** Count of distinct `data-screen` values present. */
  readonly screensFound: readonly string[]
  /** Declared screens with no `data-screen` marker. */
  readonly screensMissing: readonly string[]
}

const EXTERNAL_PREFIXES = ['http://', 'https://', '//']
const INERT_PREFIXES = ['#', 'data:', 'mailto:', 'tel:', 'javascript:']
const UNFINISHED = /\bTODO\b|FIXME|待补充|占位符|lorem ipsum/gi
const INTERACTIVE = /onclick|addEventListener|onchange|oninput|onsubmit|data-action/i

/**
 * 1-based line number of a character offset.
 * @param source - audited text.
 * @param offset - character offset from a regex match.
 * @returns the line containing the offset.
 */
function lineAt(source: string, offset: number): number {
  let line = 1
  for (let index = 0; index < offset && index < source.length; index += 1) {
    if (source[index] === '\n') line += 1
  }
  return line
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Audit a generated prototype against its brief.
 * @param html - entry file source.
 * @param brief - contract produced by `prototype_generate`.
 * @param hooks - filesystem lookups for referenced local assets.
 * @returns findings, their pass/fail verdict, and screen coverage.
 */
export async function auditPrototype(
  html: string,
  brief: PrototypeBrief,
  hooks: AuditHooks,
): Promise<AuditResult> {
  const findings: AuditFinding[] = []
  const add = (severity: AuditSeverity, message: string, offset?: number): void => {
    findings.push(offset === undefined ? { severity, message } : { severity, message, line: lineAt(html, offset) })
  }

  if (html.trim().length === 0) {
    add('error', `${brief.entryFile} is empty`)
    return { passed: false, findings, screensFound: [], screensMissing: [...brief.screens] }
  }

  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) {
    const reference = (match[2] ?? '').trim()
    const offset = match.index
    if (reference.length === 0) continue
    const lower = reference.toLowerCase()
    if (INERT_PREFIXES.some(prefix => lower.startsWith(prefix))) continue
    if (EXTERNAL_PREFIXES.some(prefix => lower.startsWith(prefix))) {
      add('error', `external reference "${reference}" breaks offline preview; inline it or store it next to the entry file`, offset)
      continue
    }
    const relative = reference.split(/[?#]/)[0] ?? ''
    if (relative.length === 0) continue
    if (!(await hooks.assetExists(relative))) {
      add('error', `referenced file "${relative}" does not exist in ${brief.outputDir}`, offset)
    }
  }

  for (const match of html.matchAll(/url\(\s*["']?(?:https?:)?\/\//gi)) {
    add('error', 'external url() reference breaks offline preview', match.index)
  }

  if (!/<meta[^>]+name\s*=\s*["']viewport["']/i.test(html)) {
    add('warning', 'no viewport meta tag; the prototype will not scale on narrow screens')
  }
  if (!/<style[\s>]/i.test(html)) {
    add('warning', 'no inline <style> block; inline CSS keeps the single-file preview self-contained')
  }
  if (!/<title>\s*\S/i.test(html)) add('warning', 'no <title>; the downloaded page shows a blank tab title')

  for (const match of html.matchAll(UNFINISHED)) {
    add('warning', `unfinished marker "${match[0]}" left in the entry`, match.index)
  }

  const screensFound: string[] = []
  for (const match of html.matchAll(/data-screen\s*=\s*(["'])(.*?)\1/gi)) {
    const name = normalize(match[2] ?? '')
    if (name.length > 0 && !screensFound.includes(name)) screensFound.push(name)
  }
  const screensMissing = brief.screens.filter(screen => !screensFound.includes(normalize(screen)))
  if (screensMissing.length > 0) {
    add('error', `missing data-screen markers for: ${screensMissing.join(', ')}`)
  }

  if (!INTERACTIVE.test(html)) add('warning', 'no interaction handler found; the prototype will not respond to input')

  return {
    passed: findings.every(finding => finding.severity !== 'error'),
    findings,
    screensFound,
    screensMissing,
  }
}
