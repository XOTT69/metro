import { access, readFile, readdir } from "node:fs/promises";

const root = new URL("../dist/", import.meta.url);
await access(new URL("index.html", root));
await access(new URL("manifest.webmanifest", root));
await access(new URL("sw.js", root));
await access(new URL("transit-network.json", root));

const html = await readFile(new URL("index.html", root), "utf8");
const assets = await readdir(new URL("assets/", root));

if (!html.includes('id="root"') || !html.includes("manifest.webmanifest")) {
  throw new Error("Production smoke failed: static entrypoint is incomplete.");
}
if (!assets.some((name) => name.endsWith(".js"))) {
  throw new Error("Production smoke failed: JavaScript bundle is missing.");
}
console.log("Production smoke passed: static Pages and PWA artifacts are present.");
