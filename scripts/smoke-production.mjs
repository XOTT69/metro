import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8'))
const rawUrl = process.argv[2] || process.env.PRODUCTION_URL
const expectedVersion = process.env.EXPECTED_VERSION || packageJson.version
const expectedCommit = (process.env.EXPECTED_COMMIT || '').trim().slice(0, 12)
const retries = Number.parseInt(process.env.SMOKE_RETRIES || '1', 10)
const retryDelayMs = Number.parseInt(process.env.SMOKE_RETRY_DELAY_MS || '10000', 10)
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || '20000', 10)
const reportPath = resolve(process.env.SMOKE_REPORT_PATH || 'smoke-report.json')

if (!rawUrl) {
  throw new Error('Production URL is required. Pass it as an argument or set PRODUCTION_URL.')
}

const baseUrl = new URL(rawUrl)
if (!['http:', 'https:'].includes(baseUrl.protocol)) {
  throw new Error(`Unsupported production URL protocol: ${baseUrl.protocol}`)
}
if (!baseUrl.pathname.endsWith('/')) baseUrl.pathname += '/'
baseUrl.search = ''
baseUrl.hash = ''

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const sleep = (duration) => new Promise((resolvePromise) => setTimeout(resolvePromise, duration))

const withCacheBuster = (url) => {
  const target = new URL(url)
  target.searchParams.set('__smoke', Date.now().toString())
  return target
}

const request = async (url, expectedType) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(withCacheBuster(url), {
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'user-agent': 'metro-kyiv-production-smoke/1.0' },
      signal: controller.signal,
    })
    const body = await response.text()
    const contentType = response.headers.get('content-type') || ''
    assert(response.ok, `${url.pathname}${url.search} returned HTTP ${response.status}`)
    if (expectedType) assert(contentType.includes(expectedType), `${url.pathname} returned unexpected content type: ${contentType}`)
    assert(body.length > 0, `${url.pathname} returned an empty response`)
    return { response, body, contentType }
  } finally {
    clearTimeout(timer)
  }
}

const pageUrls = [
  '?tab=route&from=vokzalna&to=maidan-nezalezhnosti',
  '?tab=map&from=vokzalna&to=maidan-nezalezhnosti',
  '?tab=tourist',
  '?tab=stations&station=vokzalna',
]

const runSmoke = async () => {
  const checks = []
  const record = (name, details = {}) => checks.push({ name, ok: true, ...details })

  const root = new URL('./', baseUrl)
  const rootResult = await request(root, 'text/html')
  assert(rootResult.body.includes('id="root"'), 'Production HTML is missing the React root element')
  assert(rootResult.body.includes('rel="manifest"'), 'Production HTML is missing the manifest link')
  assert(rootResult.body.includes('name="description"'), 'Production HTML is missing the meta description')
  record('root-html', { url: rootResult.response.url, bytes: rootResult.body.length })

  const scriptUrls = [...rootResult.body.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1])
  const stylesheetUrls = [...rootResult.body.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((match) => match[1])
  assert(scriptUrls.length >= 1, 'Production HTML does not reference an application script')
  assert(stylesheetUrls.length >= 1, 'Production HTML does not reference a stylesheet')

  for (const asset of [...scriptUrls, ...stylesheetUrls]) {
    const assetUrl = new URL(asset, rootResult.response.url)
    const assetResult = await request(assetUrl)
    assert(assetResult.body.length > 100, `Production asset looks incomplete: ${assetUrl.pathname}`)
    record('asset', { url: assetUrl.toString(), bytes: assetResult.body.length })
  }

  const manifestUrl = new URL('manifest.webmanifest', baseUrl)
  const manifestResult = await request(manifestUrl, 'application/manifest+json')
  const manifest = JSON.parse(manifestResult.body)
  assert(manifest.display === 'standalone', 'Production manifest is not installable in standalone mode')
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'Production manifest icons are incomplete')
  assert(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3, 'Production manifest shortcuts are incomplete')
  record('manifest', { url: manifestResult.response.url, icons: manifest.icons.length, shortcuts: manifest.shortcuts.length })

  const versionUrl = new URL('version.json', baseUrl)
  const versionResult = await request(versionUrl, 'application/json')
  const version = JSON.parse(versionResult.body)
  assert(version.version === expectedVersion, `Production version is ${version.version}; expected ${expectedVersion}`)
  assert(typeof version.commit === 'string' && version.commit.length > 0, 'Production commit metadata is missing')
  if (expectedCommit) {
    assert(version.commit === expectedCommit, `Production commit is ${version.commit}; expected ${expectedCommit}`)
  }
  assert(!Number.isNaN(Date.parse(version.builtAt)), 'Production build timestamp is invalid')
  record('version', {
    url: versionResult.response.url,
    version: version.version,
    commit: version.commit,
    expectedCommit: expectedCommit || undefined,
    builtAt: version.builtAt,
  })

  const serviceWorkerUrl = new URL('sw.js', baseUrl)
  const serviceWorker = await request(serviceWorkerUrl, 'javascript')
  assert(serviceWorker.body.length > 500, 'Production service worker looks incomplete')
  record('service-worker', { url: serviceWorker.response.url, bytes: serviceWorker.body.length })

  for (const path of ['privacy.html', 'sources.html']) {
    const legalUrl = new URL(path, baseUrl)
    const legal = await request(legalUrl, 'text/html')
    assert(legal.body.length > 300, `${path} looks incomplete`)
    record(path, { url: legal.response.url, bytes: legal.body.length })
  }

  const robotsUrl = new URL('robots.txt', baseUrl)
  const robots = await request(robotsUrl, 'text/plain')
  assert(/user-agent/i.test(robots.body), 'robots.txt is missing User-agent rules')
  record('robots', { url: robots.response.url })

  for (const relativeUrl of pageUrls) {
    const pageUrl = new URL(relativeUrl, baseUrl)
    const page = await request(pageUrl, 'text/html')
    assert(page.body.includes('id="root"'), `Deep link did not return the PWA shell: ${relativeUrl}`)
    record('deep-link', { url: page.response.url })
  }

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    productionUrl: baseUrl.toString(),
    expectedVersion,
    expectedCommit: expectedCommit || null,
    deployedVersion: version.version,
    deployedCommit: version.commit,
    checks,
  }
}

let lastError
for (let attempt = 1; attempt <= Math.max(1, retries); attempt += 1) {
  try {
    const report = { attempt, attemptsAllowed: Math.max(1, retries), ...(await runSmoke()) }
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`Production smoke passed for ${report.productionUrl}`)
    console.log(`Deployed v${report.deployedVersion} (${report.deployedCommit}); ${report.checks.length} checks passed.`)
    process.exit(0)
  } catch (error) {
    lastError = error
    const report = {
      ok: false,
      attempt,
      attemptsAllowed: Math.max(1, retries),
      checkedAt: new Date().toISOString(),
      productionUrl: baseUrl.toString(),
      expectedVersion,
      expectedCommit: expectedCommit || null,
      error: error instanceof Error ? error.message : String(error),
    }
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.error(`Production smoke attempt ${attempt}/${Math.max(1, retries)} failed: ${report.error}`)
    if (attempt < Math.max(1, retries)) await sleep(retryDelayMs)
  }
}

throw lastError
