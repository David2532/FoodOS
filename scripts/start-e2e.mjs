import { cpSync, existsSync } from "node:fs";

const standaloneRoot = ".next/standalone";
if (!existsSync(`${standaloneRoot}/server.js`)) {
  throw new Error("Standalone build missing. Run `npm run build` before the E2E server.");
}

cpSync(".next/static", `${standaloneRoot}/.next/static`, { recursive: true });
cpSync("public", `${standaloneRoot}/public`, { recursive: true });
process.env.HOSTNAME ??= "127.0.0.1";
process.env.PORT ??= "3100";
await import("../.next/standalone/server.js");
