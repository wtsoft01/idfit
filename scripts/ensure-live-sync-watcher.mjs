import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const statePath = resolve(root, ".idfit-live-sync-state.json");
const watcherPath = resolve(root, ".idfit-live-sync-watcher.json");
const command = "node";
const args = ["scripts/telegram-live-sync.mjs", "--watch", "--interval-ms", "30000", "--limit", "50", "--source-timeout-ms", "120000"];

function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const watcher = readJson(watcherPath);
if (watcher?.pid && isPidAlive(watcher.pid)) {
  console.log(JSON.stringify({ ok: true, action: "already_running", pid: watcher.pid, state: readJson(statePath) }, null, 2));
  process.exit(0);
}

const child = spawn(command, args, {
  cwd: root,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();

const payload = { pid: child.pid, startedAt: new Date().toISOString(), command: [command, ...args].join(" ") };
writeFileSync(watcherPath, JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ ok: true, action: "started", ...payload }, null, 2));
