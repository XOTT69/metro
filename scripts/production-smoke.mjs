import { access, readFile } from "node:fs/promises";

await access(new URL("../dist/server/index.js", import.meta.url));
await access(new URL("../dist/client/manifest.webmanifest", import.meta.url));
await access(new URL("../dist/client/sw.js", import.meta.url));
const worker = await readFile(new URL("../dist/server/index.js", import.meta.url), "utf8");
if (!worker.includes("fetch")) {
  throw new Error("Production smoke failed: Worker entrypoint has no fetch handler.");
}
console.log("Production smoke passed: Worker and PWA artifacts are present.");
