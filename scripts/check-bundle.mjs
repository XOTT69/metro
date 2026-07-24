import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const root = new URL("../dist/assets/", import.meta.url);
const limit = 420 * 1024;
const entryLimit = 260 * 1024;
const mapEngineLimit = 1_000 * 1024;
const mapEngineGzipLimit = 270 * 1024;
const mapWorkerLimit = 500 * 1024;
const mapWorkerGzipLimit = 140 * 1024;
const entries = await readdir(root);
const files = await Promise.all(
  entries
    .filter((name) => name.endsWith(".js"))
    .map(async (name) => {
      const path = join(root.pathname, name);
      return {
        name,
        size: (await stat(path)).size,
        gzipSize: gzipSync(await readFile(path)).length,
      };
    }),
);
const largest = files.sort((a, b) => b.size - a.size)[0];
const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const entryName = html.match(/src="\/assets\/([^"]+\.js)"/)?.[1];
const entry = files.find(({ name }) => name === entryName);

if (!largest) throw new Error("Bundle check: JavaScript assets not found.");
if (!entry) throw new Error("Bundle check: entry JavaScript asset not found.");
const oversized = files.filter(
  ({ name, size }) =>
    size > limit &&
    !(
      name.startsWith("maplibre-vendor-") &&
      size <= mapEngineLimit &&
      files.find((file) => file.name === name)?.gzipSize <= mapEngineGzipLimit
    ) &&
    !(
      name.startsWith("maplibre-gl-worker-") &&
      size <= mapWorkerLimit &&
      files.find((file) => file.name === name)?.gzipSize <= mapWorkerGzipLimit
    ),
);
if (oversized.length) {
  const offender = oversized[0];
  throw new Error(
    `Bundle check failed: ${offender.name} is ${Math.round(offender.size / 1024)} KB (limit 420 KB).`,
  );
}
if (entry.size > entryLimit) {
  throw new Error(
    `Bundle check failed: initial ${entry.name} is ${Math.round(entry.size / 1024)} KB (limit 260 KB).`,
  );
}
console.log(
  `Bundle check passed: initial JS is ${Math.round(entry.size / 1024)} KB; largest chunk is ${Math.round(largest.size / 1024)} KB (lazy map engine: ${Math.round(largest.gzipSize / 1024)} KB gzip).`,
);
