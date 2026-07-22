import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const reportsDirectory = resolve('.lighthouseci')
const thresholds = {
  accessibility: 0.9,
  'best-practices': 0.85,
  seo: 0.9,
}
const requiredAudits = [
  'button-name',
  'color-contrast',
  'html-has-lang',
  'link-name',
  'meta-description',
  'viewport',
]

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const files = (await readdir(reportsDirectory))
  .filter((file) => file.startsWith('lhr-') && file.endsWith('.json'))
  .sort()

assert(files.length === 4, `Expected 4 Lighthouse reports, found ${files.length}`)

for (const file of files) {
  const report = JSON.parse(await readFile(join(reportsDirectory, file), 'utf8'))
  const url = report.finalUrl ?? report.requestedUrl ?? file
  assert(!report.runtimeError, `${url}: Lighthouse runtime error: ${report.runtimeError?.message ?? 'unknown error'}`)

  for (const [category, minimum] of Object.entries(thresholds)) {
    const score = report.categories?.[category]?.score
    assert(typeof score === 'number', `${url}: missing ${category} score`)
    assert(score >= minimum, `${url}: ${category} score ${Math.round(score * 100)} is below ${Math.round(minimum * 100)}`)
  }

  for (const auditId of requiredAudits) {
    const audit = report.audits?.[auditId]
    assert(audit, `${url}: missing required audit ${auditId}`)
    assert(audit.score === 1 || audit.scoreDisplayMode === 'notApplicable', `${url}: audit ${auditId} failed`)
  }

  const scores = Object.keys(thresholds)
    .map((category) => `${category} ${Math.round(report.categories[category].score * 100)}`)
    .join(', ')
  console.log(`${url}: ${scores}`)
}

console.log('Validated four Lighthouse reports with no runtime errors.')
