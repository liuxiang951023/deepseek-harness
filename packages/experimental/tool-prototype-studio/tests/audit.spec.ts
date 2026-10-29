import { describe, expect, it } from 'vitest'
import { auditPrototype } from '../src/audit.ts'
import { composeBrief, type PrototypeBrief } from '../src/brief.ts'

const brief: PrototypeBrief = composeBrief({ requirements: 'r', screens: ['List', 'Detail'], outputDir: 'out' }, 4000)

const hooks = (existing: readonly string[] = []) => ({
  assetExists: (relativePath: string) => Promise.resolve(existing.includes(relativePath)),
})

const page = (body: string): string => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width"><title>Demo</title><style>.a{}</style></head>
<body>
<section data-screen="List"><button onclick="go('Detail')">open</button></section>
<section data-screen="Detail"></section>
${body}
</body></html>`

describe('auditPrototype', () => {
  it('passes a self-contained entry that covers every declared screen', async () => {
    const result = await auditPrototype(page(''), brief, hooks())
    expect(result.passed).toBe(true)
    expect(result.findings).toEqual([])
    expect(result.screensFound).toEqual(['list', 'detail'])
    expect(result.screensMissing).toEqual([])
  })

  it('fails empty entries', async () => {
    const result = await auditPrototype('  \n ', brief, hooks())
    expect(result.passed).toBe(false)
    expect(result.findings[0]).toMatchObject({ severity: 'error', message: 'index.html is empty' })
    expect(result.screensMissing).toEqual(['List', 'Detail'])
  })

  it('reports external references and missing local assets with line numbers', async () => {
    const html = page('<script src="https://cdn.example.com/x.js"></script>\n<img src="logo.png">\n<link rel="stylesheet" href="theme.css">')
    const result = await auditPrototype(html, brief, hooks(['theme.css']))
    const errors = result.findings.filter(finding => finding.severity === 'error')
    expect(result.passed).toBe(false)
    expect(errors.map(error => error.line)).toEqual([6, 7])
    expect(errors[0]?.message).toContain('cdn.example.com')
    expect(errors[1]?.message).toContain('logo.png')
  })

  it('flags external url() references', async () => {
    const html = page('<style>.b{background:url(//cdn.example.com/bg.png)}</style>')
    const result = await auditPrototype(html, brief, hooks())
    expect(result.findings.some(finding => finding.message.includes('url()'))).toBe(true)
  })

  it('reports declared screens with no data-screen marker', async () => {
    const html = '<!doctype html><html><head><title>t</title><style></style></head><body><section data-screen="List"></section></body></html>'
    const result = await auditPrototype(html, brief, hooks())
    expect(result.passed).toBe(false)
    expect(result.screensMissing).toEqual(['Detail'])
    expect(result.findings.some(finding => finding.message.includes('Detail'))).toBe(true)
  })

  it('warns about unfinished markers, missing viewport, and inert pages without failing', async () => {
    const html = '<html><body><section data-screen="List"></section><section data-screen="Detail"></section><p>TODO</p></body></html>'
    const result = await auditPrototype(html, brief, hooks())
    expect(result.passed).toBe(true)
    expect(result.findings.map(finding => finding.severity)).toEqual([
      'warning', 'warning', 'warning', 'warning', 'warning',
    ])
    expect(result.findings.some(finding => finding.message.includes('TODO'))).toBe(true)
  })
})
