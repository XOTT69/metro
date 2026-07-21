import { rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { build } from 'vite'

const outDir = resolve('.route-validation')

try {
  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      ssr: 'scripts/route-validation-entry.ts',
      outDir,
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { entryFileNames: 'validate.mjs' } },
    },
  })
  await import(`${pathToFileURL(resolve(outDir, 'validate.mjs')).href}?t=${Date.now()}`)
} finally {
  await rm(outDir, { recursive: true, force: true })
}
