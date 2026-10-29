/**
 * Pure input validation and brief composition for the prototype studio tools.
 * The composed brief is the machine-checkable contract `prototype_verify`
 * audits against, so its fields stay free of prose.
 * @module @deepseek-ai/dsh-tool-prototype-studio/brief
 */

/** Studio inputs the model supplies after reading the conversation attachments. */
export interface PrototypeInput {
  /** Free-form requirement description from the requester. */
  readonly requirements: string
  /** Screen names to build, one per page the prototype must cover. */
  readonly screens: readonly string[]
  /** Workspace-relative directory that receives the prototype files. */
  readonly outputDir: string
  /** Online backend address the prototype mirrors; only with credentials. */
  readonly backendUrl?: string
  /** Login account for the backend; only meaningful with password. */
  readonly account?: string
  /** Login password for the backend; only meaningful with account. */
  readonly password?: string
}

/** The contract both studio tools share for one prototype task. */
export interface PrototypeBrief {
  /** Workspace-relative directory that receives the prototype files. */
  readonly outputDir: string
  /** File name of the single self-contained entry, relative to outputDir. */
  readonly entryFile: string
  /** Screen names the entry must cover. */
  readonly screens: readonly string[]
  /** Whether login credentials were supplied (never the values themselves). */
  readonly credentialsProvided: boolean
  /** Length of the requirement description in code points. */
  readonly requirementsLength: number
  /** Backend address echoed for reference; omitted when absent. */
  readonly backendUrl?: string
  /** Ordered steps the agent follows after this brief. */
  readonly steps: readonly string[]
}

/** Entry file every prototype writes; verified by name so the audit can find it. */
const ENTRY_FILE = 'index.html'

/** Upper bound on declared screens; a prototype beyond this is a different task. */
const MAX_SCREENS = 24

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed
}

/**
 * Validate studio inputs and compose the brief.
 * @param raw - inputs as the model supplied them.
 * @param maxRequirementsLength - deployment's bound on the requirement description.
 * @returns the brief the agent follows and `prototype_verify` audits against.
 */
export function composeBrief(raw: PrototypeInput, maxRequirementsLength: number): PrototypeBrief {
  const requirements = raw.requirements.trim()
  if (requirements.length === 0) throw new Error('requirements must describe the prototype')
  const requirementsLength = requirements.length
  if (requirementsLength > maxRequirementsLength) {
    throw new Error(`requirements is ${requirementsLength} characters; the limit is ${maxRequirementsLength}`)
  }
  const outputDir = raw.outputDir.trim()
  if (outputDir.length === 0) throw new Error('outputDir must name a workspace directory')

  const screens = raw.screens.map(screen => screen.trim()).filter(screen => screen.length > 0)
  if (screens.length === 0) throw new Error('screens must list at least one screen name')
  if (screens.length > MAX_SCREENS) throw new Error(`screens lists ${screens.length} names; the limit is ${MAX_SCREENS}`)
  const duplicated = screens.filter((screen, index) => screens
    .slice(0, index)
    .some(earlier => earlier.toLowerCase() === screen.toLowerCase()))
  if (duplicated.length > 0) throw new Error(`screens repeats ${duplicated.join(', ')}`)

  const backendUrl = optional(raw.backendUrl)
  const credentialsProvided = optional(raw.account) !== undefined && optional(raw.password) !== undefined
  const steps: string[] = ['Read the PRD document and system screenshots attached to this conversation before designing.']
  if (backendUrl !== undefined && credentialsProvided) {
    steps.push(`Sign in at \`${backendUrl}\` with the supplied credentials and study the real page structure, navigation, and visual language.`)
    steps.push(`Save one reference screenshot per screen under \`${outputDir}/reference/\` so later iterations keep the same visual baseline.`)
  }
  steps.push(`Write \`${outputDir}/${ENTRY_FILE}\` as one self-contained page: inline CSS and JavaScript, no build step, no external network requests.`)
  steps.push(`Mark each screen's root element with \`data-screen="<name>"\` for ${screens.map(screen => `\`${screen}\``).join(', ')} and switch between them inside the page.`)
  steps.push('Call prototype_verify with the entry file and fix every error it reports until it passes.')
  steps.push(`Call present with \`${outputDir}/${ENTRY_FILE}\` so the person can download the code.`)

  return {
    outputDir,
    entryFile: ENTRY_FILE,
    screens,
    credentialsProvided,
    requirementsLength,
    ...(backendUrl !== undefined && { backendUrl }),
    steps,
  }
}
