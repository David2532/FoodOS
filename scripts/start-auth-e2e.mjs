import { spawnSync } from "node:child_process";

const requiredPublicEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
];

for (const name of requiredPublicEnvironment) {
  if (!process.env[name]) {
    throw new Error(`${name} is required for authenticated E2E.`);
  }
}

const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
if (!loopbackHosts.has(supabaseUrl.hostname.toLowerCase())) {
  throw new Error("Authenticated E2E may only run against a loopback Supabase project.");
}

const requiredBuildFlags = [
  "NEXT_PUBLIC_DEMO_MODE_ENABLED",
  "NEXT_PUBLIC_OAUTH_APPLE_ENABLED",
  "NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED"
];

for (const name of requiredBuildFlags) {
  if (process.env[name] !== "true") {
    throw new Error(`${name}=true is required for the authenticated E2E build.`);
  }
}

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("Authenticated E2E must be started through the npm script.");
}

const build = spawnSync(process.execPath, [npmCli, "run", "build"], {
  env: process.env,
  stdio: "inherit"
});

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

await import("./start-e2e.mjs");
