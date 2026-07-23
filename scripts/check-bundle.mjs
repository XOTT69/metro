import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../dist/client/assets/", import.meta.url);
const limit = 420 * 1024;
const entries = await readdir(root);
const files = await Promise.all(
  entries
    .filter((name) => name.endsWith(".js"))
    .map(async (name) => ({ name, size: (await stat(join(root.pathname, name))).size })),
);
const largest = files.sort((a, b) => b.size - a.size)[0];

if (!largest) throw new Error("Bundle check: JavaScript assets not found.");
if (largest.size > limit) {
  throw new Error(
    `Bundle check failed: ${largest.name} is ${Math.round(largest.size / 1024)} KB (limit 420 KB).`,
  );
}
console.log(`Bundle check passed: largest JS asset is ${Math.round(largest.size / 1024)} KB.`);
