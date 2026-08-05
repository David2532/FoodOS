import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_LINK = /!?(?:\[[^\]]*\])\(([^)]+)\)/g;

function linkPath(rawTarget) {
  const target = rawTarget.trim().replace(/^<|>$/g, "");
  if (/^(?:https?:|mailto:|tel:|app:|plugin:|#)/i.test(target)) return null;
  const withoutFragment = target.split("#", 1)[0].split("?", 1)[0];
  if (!withoutFragment) return null;
  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

export function checkMarkdownFiles(files, cwd = process.cwd()) {
  const errors = [];
  for (const file of files) {
    const absolute = resolve(cwd, file);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      errors.push(`${file}: file does not exist`);
      continue;
    }
    const content = readFileSync(absolute, "utf8");
    if (!content.endsWith("\n")) errors.push(`${file}: missing final newline`);
    if (/^(?:<<<<<<<|=======|>>>>>>>)/m.test(content)) errors.push(`${file}: unresolved conflict marker`);

    for (const match of content.matchAll(LOCAL_LINK)) {
      const target = linkPath(match[1]);
      if (!target) continue;
      const linked = resolve(dirname(absolute), target);
      if (!existsSync(linked)) errors.push(`${file}: broken local link ${target}`);
    }
  }
  return errors;
}

export function runMarkdownCli(files, io = console) {
  if (files.length === 0) {
    io.error("FAIL markdown: no Markdown files supplied");
    return 1;
  }
  const errors = checkMarkdownFiles(files);
  if (errors.length > 0) {
    for (const error of errors) io.error(`FAIL markdown: ${error}`);
    return 1;
  }
  io.log(`PASS markdown: ${files.length} file(s)`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runMarkdownCli(process.argv.slice(2));
}
