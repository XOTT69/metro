import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8'))
const commit = (
  process.env.CF_PAGES_COMMIT_SHA
  || process.env.RELEASE_COMMIT_SHA
  || process.env.GITHUB_SHA
  || process.env.VERCEL_GIT_COMMIT_SHA
  || 'local'
).slice(0, 12)

const metadata = {
  name: packageJson.name,
  version: packageJson.version,
  commit,
  builtAt: new Date().toISOString(),
}

await mkdir(resolve('public'), { recursive: true })
await writeFile(resolve('public/version.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')

console.log(`Generated public/version.json for ${metadata.name} v${metadata.version} (${metadata.commit}).`)
