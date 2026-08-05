import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function validateMigrationName(name) {
  if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(name ?? "")) {
    throw new TypeError("Migration name must be lowercase snake_case and start with a letter.");
  }
  return name;
}

export function migrationTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

export function createMigration(name, options = {}) {
  validateMigrationName(name);
  const directory = resolve(options.cwd ?? process.cwd(), options.directory ?? "supabase/migrations");
  const target = resolve(directory, `${migrationTimestamp(options.now)}_${name}.sql`);
  if (existsSync(target)) throw new Error(`Migration already exists: ${target}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(target, [
    `-- Forward-only migration: ${name}`,
    "-- Review RLS, grants, function execution privileges and rollback/recovery impact.",
    "-- Add or update the relevant pgTAP coverage before applying this migration.",
    "",
  ].join("\n"), { encoding: "utf8", flag: "wx" });
  return target;
}

export function runMigrationCli(args, io = console) {
  if (args.length !== 1) {
    io.error("Usage: npm run migration:new -- <snake_case_name>");
    return 1;
  }
  try {
    io.log(createMigration(args[0]));
    return 0;
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  process.exitCode = runMigrationCli(process.argv.slice(2));
}
