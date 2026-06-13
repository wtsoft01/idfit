import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const statePath = resolve(root, ".idfit-live-sync-state.json");
const watcherPath = resolve(root, ".idfit-live-sync-watcher.json");
const command = "node";
const args = [
  "scripts/telegram-live-sync.mjs",
  "--watch",
  "--interval-ms",
  "180000",
  "--limit",
  "20",
  "--source-timeout-ms",
  "90000",
  "--maintenance-timeout-ms",
  "120000",
  "--targets-per-cycle",
  "2",
  "--source-cooldown-ms",
  "15000",
];

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

function findRunningWatchers() {
  if (process.platform !== "win32") return [];

  try {
    const output = execFileSync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "@(Get-CimInstance Win32_Process | Where-Object { $_.Name -like '*node*' -and $_.CommandLine -like '*telegram-live-sync.mjs*' -and $_.CommandLine -like '*--watch*' } | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress",
    ], { cwd: root, encoding: "utf8", windowsHide: true }).trim();
    if (!output) return [];
    const processes = JSON.parse(output);
    return (Array.isArray(processes) ? processes : [processes])
      .map((processInfo) => ({ pid: Number(processInfo.ProcessId), command: String(processInfo.CommandLine || "") }))
      .filter((processInfo) => Number.isInteger(processInfo.pid) && processInfo.pid > 0);
  } catch {
    return [];
  }
}

function stopDuplicateWatchers(keepPid, watchers) {
  const stopped = [];
  for (const watcherProcess of watchers) {
    if (watcherProcess.pid === keepPid) continue;
    try {
      process.kill(watcherProcess.pid, "SIGTERM");
      stopped.push(watcherProcess.pid);
    } catch {
      // Ignore stale process ids.
    }
  }
  return stopped;
}

const watcher = readJson(watcherPath);
const runningWatchers = findRunningWatchers();
if (watcher?.pid && isPidAlive(watcher.pid)) {
  const stoppedDuplicates = stopDuplicateWatchers(watcher.pid, runningWatchers);
  console.log(JSON.stringify({ ok: true, action: "already_running", pid: watcher.pid, stoppedDuplicates, state: readJson(statePath) }, null, 2));
  process.exit(0);
}

const runningWatcher = runningWatchers[0];
if (runningWatcher) {
  const payload = { ...runningWatcher, adoptedAt: new Date().toISOString() };
  writeFileSync(watcherPath, JSON.stringify(payload, null, 2));
  const stoppedDuplicates = stopDuplicateWatchers(runningWatcher.pid, runningWatchers);
  console.log(JSON.stringify({ ok: true, action: "adopted_existing", ...payload, stoppedDuplicates, state: readJson(statePath) }, null, 2));
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
