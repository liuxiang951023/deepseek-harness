import { describe, expect, it } from 'vitest'
import { composeBrief } from '../src/brief.ts'

describe('composeBrief', () => {
  it('returns the entry contract and ordered steps', () => {
    const brief = composeBrief({ requirements: ' order admin ', screens: ['List', 'Detail'], outputDir: ' out ' }, 4000)
    expect(brief.outputDir).toBe('out')
    expect(brief.entryFile).toBe('index.html')
    expect(brief.screens).toEqual(['List', 'Detail'])
    expect(brief.credentialsProvided).toBe(false)
    expect(brief.requirementsLength).toBe(11)
    expect(brief.steps[0]).toContain('Read the PRD document')
    expect(brief.steps.at(-1)).toContain('present')
  })

  it('adds backend study steps only when a URL and credentials are both present', () => {
    const withCredentials = composeBrief({
      requirements: 'r',
      screens: ['List'],
      outputDir: 'out',
      backendUrl: ' https://admin.example.com ',
      account: 'demo',
      password: 'demo123',
    }, 4000)
    expect(withCredentials.backendUrl).toBe('https://admin.example.com')
    expect(withCredentials.credentialsProvided).toBe(true)
    expect(withCredentials.steps.some(step => step.includes('Sign in at `https://admin.example.com`'))).toBe(true)

    const halfCredentials = composeBrief({ requirements: 'r', screens: ['List'], outputDir: 'out', account: 'demo' }, 4000)
    expect(halfCredentials.credentialsProvided).toBe(false)
    expect(halfCredentials.steps.some(step => step.includes('Sign in at'))).toBe(false)
  })

  it('never echoes the login pair', () => {
    const brief = composeBrief({
      requirements: 'r',
      screens: ['List'],
      outputDir: 'out',
      backendUrl: 'https://admin.example.com',
      account: 'demo',
      password: 'demo123',
    }, 4000)
    expect(JSON.stringify(brief)).not.toContain('demo123')
    expect(JSON.stringify(brief)).not.toContain('"demo"')
  })

  it('rejects empty requests, missing screens, duplicate screens, and over-long requirements', () => {
    expect(() => composeBrief({ requirements: '  ', screens: ['List'], outputDir: 'out' }, 4000)).toThrow('requirements')
    expect(() => composeBrief({ requirements: 'r', screens: [], outputDir: 'out' }, 4000)).toThrow('at least one screen')
    expect(() => composeBrief({ requirements: 'r', screens: ['List', ' list '], outputDir: 'out' }, 4000)).toThrow('repeats')
    expect(() => composeBrief({ requirements: 'r', screens: ['List'], outputDir: '  ' }, 4000)).toThrow('outputDir')
    expect(() => composeBrief({ requirements: 'abcd', screens: ['List'], outputDir: 'out' }, 3)).toThrow('the limit is 3')
  })
})
