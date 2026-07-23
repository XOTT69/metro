import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../dist/assets/", import.meta.url);
const limit = 420 * 1024;
const entryLimit = 260 * 1024;
const entries = await readdir(root);
const files = await Promise.all(
  entries
    .filter((name) => name.endsWith(".js"))
    .map(async (name) => ({ name, size: (await stat(join(root.pathname, name))).size })),
);
const largest = files.sort((a, b) => b.size - a.size)[0];
const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const entryName = html.match(/src="\/assets\/([^"]+\.js)"/)?.[1];
const entry = files.find(({ name }) => name === entryName);

if (!largest) throw new Error("Bundle check: JavaScript assets not found.");
if (!entry) throw new Error("Bundle check: entry JavaScript asset not found.");
if (largest.size > limit) {
  throw new Error(
    `Bundle check failed: ${largest.name} is ${Math.round(largest.size / 1024)} KB (limit 420 KB).`,
  );
}
if (entry.size > entryLimit) {
  throw new Error(
    `Bundle check failed: initial ${entry.name} is ${Math.round(entry.size / 1024)} KB (limit 260 KB).`,
  );
}
console.log(
  `Bundle check passed: initial JS is ${Math.round(entry.size / 1024)} KB; largest chunk is ${Math.round(largest.size / 1024)} KB.`,
);
