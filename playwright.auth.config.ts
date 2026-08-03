import { defineConfig, devices } from "@playwright/test";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("Local Supabase public environment is required for authenticated E2E.");

export default defineConfig({
  testDir: "./e2e-auth",
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "authenticated-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/start-e2e.mjs",
    url: "http://127.0.0.1:3101",
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
      NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED: "true",
      HOSTNAME: "127.0.0.1",
      PORT: "3101"
    }
  }
});
