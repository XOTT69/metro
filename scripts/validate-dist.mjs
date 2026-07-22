import { access, readFile, readdir, stat } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'

const dist = resolve('dist')
const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8'))
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'privacy.html',
  'sources.html',
  'robots.txt',
  'version.json',
]

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const exists = async (path) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

for (const file of requiredFiles) {
  assert(await exists(join(dist, file)), `Missing production file: dist/${file}`)
}

const files = []
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await walk(path)
    else files.push(path)
  }
}
await walk(dist)

const totals = { js: 0, css: 0, total: 0 }
for (const file of files) {
  const size = (await stat(file)).size
  totals.total += size
  if (extname(file) === '.js') totals.js += size
  if (extname(file) === '.css') totals.css += size
}

const limits = {
  js: 700 * 1024,
  css: 350 * 1024,
  total: 2 * 1024 * 1024,
}
assert(totals.js <= limits.js, `JavaScript budget exceeded: ${Math.ceil(totals.js / 1024)} KB`)
assert(totals.css <= limits.css, `CSS budget exceeded: ${Math.ceil(totals.css / 1024)} KB`)
assert(totals.total <= limits.total, `Total build budget exceeded: ${Math.ceil(totals.total / 1024)} KB`)

const indexHtml = await readFile(join(dist, 'index.html'), 'utf8')
assert(indexHtml.includes('<html lang="uk">'), 'Built index is missing a document language')
assert(indexHtml.includes('name="description"'), 'Built index is missing a meta description')
assert(indexHtml.includes('name="viewport"'), 'Built index is missing a viewport declaration')
assert(indexHtml.includes('rel="manifest"'), 'Built index is missing its web app manifest link')

const manifest = JSON.parse(await readFile(join(dist, 'manifest.webmanifest'), 'utf8'))
assert(manifest.display === 'standalone', 'Manifest must use standalone display mode')
assert(typeof manifest.name === 'string' && manifest.name.length > 0, 'Manifest name is missing')
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'Manifest icons are incomplete')
assert(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3, 'Manifest shortcuts are incomplete')

const version = JSON.parse(await readFile(join(dist, 'version.json'), 'utf8'))
assert(version.name === packageJson.name, `Build metadata name mismatch: expected ${packageJson.name}`)
assert(version.version === packageJson.version, `Build metadata version mismatch: expected ${packageJson.version}`)
assert(typeof version.commit === 'string' && version.commit.length > 0, 'Build metadata commit is missing')
assert(!Number.isNaN(Date.parse(version.builtAt)), 'Build metadata timestamp is invalid')

const serviceWorker = await readFile(join(dist, 'sw.js'), 'utf8')
assert(serviceWorker.length > 500, 'Generated service worker looks incomplete')

const largest = await Promise.all(files.map(async (file) => ({
  file: relative(dist, file),
  size: (await stat(file)).size,
})))
largest.sort((a, b) => b.size - a.size)

console.log(`Validated ${files.length} production files for v${version.version} (${version.commit}).`)
console.log(`Build size: ${Math.ceil(totals.total / 1024)} KB total, ${Math.ceil(totals.js / 1024)} KB JS, ${Math.ceil(totals.css / 1024)} KB CSS.`)
console.log('Largest files:')
for (const item of largest.slice(0, 5)) {
  console.log(`- ${item.file}: ${Math.ceil(item.size / 1024)} KB`)
}
