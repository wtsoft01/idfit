import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServiceSupabase } from "./sales-ingest-engine.mjs";

const DEFAULT_INTERVAL_MS = 180_000;
const DEFAULT_LIMIT = 20;
const DEFAULT_SOURCE_TIMEOUT_MS = 90_000;
const DEFAULT_MAINTENANCE_TIMEOUT_MS = 120_000;
const DEFAULT_TARGETS_PER_CYCLE = 2;
const DEFAULT_SOURCE_COOLDOWN_MS = 15_000;
const STATE_PATH = "./.idfit-live-sync-state.json";
const CURSOR_PATH = "./.idfit-live-sync-cursor.json";
const LOG_DIR = "./logs";
const LOG_PATH = `${LOG_DIR}/idfit-live-sync.log`;
const DEFAULT_TARGETS = [
  { target: "@gpt_nocard", mode: "history", sourceType: "group" },
  { target: "@Rltra91", mode: "history", sourceType: "group" },
  { target: "@snart_store_bot", mode: "bot", sourceType: "bot" },
  { target: "@Xmbtaaabot", mode: "bot", sourceType: "bot" },
  { target: "@gptplus003", mode: "history", sourceType: "channel" },
  { target: "@uuGlobalBOT", mode: "bot", sourceType: "bot" },
  { target: "@ammortal_helper_bot", mode: "bot", sourceType: "bot" },
];

function normalizeTarget(identifier) {
  const raw = String(identifier ?? "").trim();
  const telegramUrlMatch = raw.match(/^@?https?:\/\/(?:t\.me|telegram\.me)\/([^/?#]+)/i);
  if (telegramUrlMatch) return `@${telegramUrlMatch[1]}`;
  const embeddedTelegramUrlMatch = raw.match(/@?https?:\/\/(?:t\.me|telegram\.me)\/([^/?#]+)/i);
  if (embeddedTelegramUrlMatch) return `@${embeddedTelegramUrlMatch[1]}`;
  return raw;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = { limit: DEFAULT_LIMIT, once: true, intervalMs: DEFAULT_INTERVAL_MS, sourceTimeoutMs: DEFAULT_SOURCE_TIMEOUT_MS, maintenanceTimeoutMs: DEFAULT_MAINTENANCE_TIMEOUT_MS, targetsPerCycle: DEFAULT_TARGETS_PER_CYCLE, sourceCooldownMs: DEFAULT_SOURCE_COOLDOWN_MS, targetFilters: [], targets: null, discover: true };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--limit") args.limit = Number(argv[++index] ?? args.limit);
    if (value === "--watch") args.once = false;
    if (value === "--once") args.once = true;
    if (value === "--target") args.targetFilters.push(...String(argv[++index] ?? "").split(",").map(normalizeTarget).filter(Boolean));
    if (value === "--no-discover") args.discover = false;
    if (value === "--interval-ms") args.intervalMs = Number(argv[++index] ?? args.intervalMs);
    if (value === "--source-timeout-ms") args.sourceTimeoutMs = Number(argv[++index] ?? args.sourceTimeoutMs);
    if (value === "--maintenance-timeout-ms") args.maintenanceTimeoutMs = Number(argv[++index] ?? args.maintenanceTimeoutMs);
    if (value === "--targets-per-cycle") args.targetsPerCycle = Number(argv[++index] ?? args.targetsPerCycle);
    if (value === "--source-cooldown-ms") args.sourceCooldownMs = Number(argv[++index] ?? args.sourceCooldownMs);
  }
  return args;
}

function inferMode(source) {
  const type = String(source.source_type ?? "").toLowerCase();
  if (type === "website") return "website";
  return type === "channel" || type === "group" ? "history" : "bot";
}

function targetDedupeKey(item) {
  const target = String(item.target ?? "").toLowerCase();
  if (target.endsWith("_bot")) return `telegram-bot:${target}`;
  return `${item.mode}:${target}`;
}

async function loadApprovedTargets() {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("telegram_sources")
    .select("id,telegram_identifier,source_type,status,auto_collect_enabled,metadata")
    .eq("auto_collect_enabled", true)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  const deduped = new Map();
  const targets = (data ?? [])
    .map((source) => ({
      sourceId: source.id,
      target: normalizeTarget(source.telegram_identifier),
      mode: inferMode(source),
      sourceType: source.source_type ?? "bot",
      metadata: source.metadata ?? {},
    }))
    .filter((item) => item.target)
    .filter((item) => {
      const key = targetDedupeKey(item);
      if (deduped.has(key)) return false;
      deduped.set(key, item);
      return true;
    });

  return targets.length ? targets : DEFAULT_TARGETS;
}

function run(command, args, timeoutMs) {
  const executable = command === "node" ? process.execPath : command;
  mkdirSync(LOG_DIR, { recursive: true });
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    env: { ...process.env, IDFIT_NON_INTERACTIVE: "1" },
    shell: false,
    timeout: timeoutMs,
    windowsHide: true,
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("");
  if (output) {
    try {
      appendFileSync(LOG_PATH, output);
    } catch (error) {
      console.error(`[sync] failed to append collector log: ${error.message}`);
    }
  }
  const timedOut = result.error?.code === "ETIMEDOUT";
  return {
    exitCode: result.status ?? (timedOut ? -1 : 1),
    signal: result.signal ?? null,
    timedOut,
    errorMessage: result.error?.message ?? null,
  };
}

function writeState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function readCursor() {
  try {
    return JSON.parse(readFileSync(CURSOR_PATH, "utf8"));
  } catch {
    return { nextIndex: 0 };
  }
}

function writeCursor(cursor) {
  writeFileSync(CURSOR_PATH, JSON.stringify(cursor, null, 2));
}

function selectTargetsForCycle(targets, args) {
  if (args.targetFilters?.length || args.once) return targets;
  const count = Math.max(1, Math.min(targets.length, Number(args.targetsPerCycle) || DEFAULT_TARGETS_PER_CYCLE));
  const cursor = readCursor();
  const start = Number.isFinite(Number(cursor.nextIndex)) ? Number(cursor.nextIndex) % targets.length : 0;
  const selected = Array.from({ length: count }, (_, offset) => targets[(start + offset) % targets.length]);
  writeCursor({ nextIndex: (start + count) % targets.length, totalTargets: targets.length, updatedAt: new Date().toISOString() });
  return selected;
}

function cycleState(base, patch = {}) {
  writeState({ ...base, updatedAt: new Date().toISOString(), ...patch });
}

async function recordSourceSyncResult(supabase, item, result) {
  if (!item.sourceId) return;
  const { error } = await supabase.rpc("idfit_record_source_sync_result", {
    source_id_input: item.sourceId,
    ok_input: result.ok,
    collector_input: "telegram-live-sync",
    exit_code_input: result.exitCode,
    message_input: result.ok ? null : result.errorMessage ?? `collector exited with code ${result.exitCode}`,
  });
  if (error) {
    console.error(`[sync] failed to record source health ${item.target}: ${error.message}`);
  }
  if (result.ok) {
    const { error: restoreError } = await supabase
      .from("telegram_sources")
      .update({ status: "live" })
      .eq("id", item.sourceId)
      .eq("auto_collect_enabled", true)
      .eq("status", "throttled");
    if (restoreError) console.error(`[sync] failed to restore live source ${item.target}: ${restoreError.message}`);
  }
}

async function runCycle(args) {
  const startedAt = new Date();
  const supabase = createServiceSupabase();
  const loadedTargets = args.targets ?? await loadApprovedTargets();
  const targetFilterSet = new Set(args.targetFilters ?? []);
  const allTargets = targetFilterSet.size ? loadedTargets.filter((item) => targetFilterSet.has(item.target)) : loadedTargets;
  const targets = selectTargetsForCycle(allTargets, args);
  let failures = 0;
  const results = [];

  const stateBase = { status: "running", startedAt: startedAt.toISOString(), intervalMs: args.intervalMs, sourceCooldownMs: args.sourceCooldownMs, targets: targets.map((item) => item.target), totalTargets: allTargets.length, targetsPerCycle: targets.length };
  cycleState(stateBase, { currentIndex: 0, completed: [], results: [] });

  if (!targets.length) {
    throw new Error(`No live collection targets matched: ${(args.targetFilters ?? []).join(", ")}`);
  }

  for (const [targetIndex, item] of targets.entries()) {
    cycleState(stateBase, { currentIndex: targetIndex, currentTarget: item.target, completed: results.map((result) => result.target), failures, results });
    console.log(`=== SYNC ${item.target} (${item.sourceType}/${item.mode}) ===`);
    let runResult;
    if (item.mode === "history") {
      runResult = run("node", ["scripts/telegram-history-collector.mjs", "--target", item.target, "--source-type", item.sourceType, "--limit", String(args.limit), "--since-last", "--write"], args.sourceTimeoutMs);
    } else if (item.mode === "website") {
      const url = item.metadata?.url ?? item.metadata?.source_url ?? item.metadata?.linked_url ?? item.target;
      runResult = run("node", ["scripts/website-collector.mjs", "--write", "--url", String(url), "--source", item.target], args.sourceTimeoutMs);
    } else {
      runResult = run("node", ["scripts/telegram-bot-explorer.mjs", "--bot", item.target, "--max-depth", "3", "--max-clicks", "18", "--write"], args.sourceTimeoutMs);
    }

    const ok = runResult.exitCode === 0 && !runResult.timedOut;
    if (!ok) {
      failures += 1;
      console.error(`[sync] failed ${item.target} exit=${runResult.exitCode}${runResult.timedOut ? " timeout=true" : ""}`);
    }
    const syncResult = { target: item.target, ok, ...runResult };
    await recordSourceSyncResult(supabase, item, syncResult);
    results.push(syncResult);
    cycleState(stateBase, { currentIndex: targetIndex + 1, currentTarget: null, completed: results.map((result) => result.target), failures, results });
    if (targetIndex < targets.length - 1 && args.sourceCooldownMs > 0) {
      console.log(`[sync] cooling down ${args.sourceCooldownMs}ms before next source`);
      await sleep(args.sourceCooldownMs);
    }
  }

  if (args.discover) {
    console.log("=== DISCOVER SOURCE LEADS ===");
    const runResult = run("node", ["scripts/source-discovery.mjs", "--write", "--limit", String(Math.max(args.limit, 200))], args.maintenanceTimeoutMs);
    const ok = runResult.exitCode === 0 && !runResult.timedOut;
    if (!ok) {
      failures += 1;
      console.error(`[sync] source discovery failed exit=${runResult.exitCode}${runResult.timedOut ? " timeout=true" : ""}`);
    }
    results.push({ target: "source-discovery", ok, ...runResult });
  }

  console.log("=== PROMOTE SELLABLE CANDIDATES ===");
  const promoteResult = run("node", ["scripts/promote-recent-sellable-candidates.mjs", "--write", "--hours", "2", "--limit", "200"], args.maintenanceTimeoutMs);
  const promoteOk = promoteResult.exitCode === 0 && !promoteResult.timedOut;
  if (!promoteOk) {
    failures += 1;
    console.error(`[sync] sellable candidate promotion failed exit=${promoteResult.exitCode}${promoteResult.timedOut ? " timeout=true" : ""}`);
  }
  results.push({ target: "promote-sellable-candidates", ok: promoteOk, ...promoteResult });

  console.log("=== EXPIRE SOLD-OUT PRODUCTS ===");
  const soldOutExpireResult = run("node", ["scripts/expire-risky-visible-products.mjs", "--write"], args.maintenanceTimeoutMs);
  const soldOutExpireOk = soldOutExpireResult.exitCode === 0 && !soldOutExpireResult.timedOut;
  if (!soldOutExpireOk) {
    failures += 1;
    console.error(`[sync] sold-out product expiry failed exit=${soldOutExpireResult.exitCode}${soldOutExpireResult.timedOut ? " timeout=true" : ""}`);
  }
  results.push({ target: "expire-sold-out-products", ok: soldOutExpireOk, ...soldOutExpireResult });

  console.log("=== EXPIRE STALE PRODUCTS ===");
  const staleExpireResult = run("node", ["scripts/expire-stale-products.mjs", "--write"], args.maintenanceTimeoutMs);
  const staleExpireOk = staleExpireResult.exitCode === 0 && !staleExpireResult.timedOut;
  if (!staleExpireOk) {
    failures += 1;
    console.error(`[sync] stale product expiry failed exit=${staleExpireResult.exitCode}${staleExpireResult.timedOut ? " timeout=true" : ""}`);
  }
  results.push({ target: "expire-stale-products", ok: staleExpireOk, ...staleExpireResult });

  const completedAt = new Date();
  const nextRunAt = new Date(completedAt.getTime() + args.intervalMs);
  cycleState({
    status: failures ? "completed_with_failures" : "completed",
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    nextRunAt: nextRunAt.toISOString(),
    intervalMs: args.intervalMs,
    failures,
    results,
  });

  if (failures) console.error(`[sync] completed with ${failures} failure(s)`);
  else console.log("[sync] completed");
  return { failures, nextRunAt };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs();

  while (true) {
    const { failures, nextRunAt } = await runCycle(args);
    if (args.once) {
      return;
    }
    const waitMs = Math.max(0, nextRunAt.getTime() - Date.now());
    console.log(`[sync] next run at ${nextRunAt.toISOString()} (${waitMs}ms)`);
    await sleep(waitMs);
  }
}

main().catch((error) => {
  writeState({ status: "crashed", error: error?.message ?? String(error), crashedAt: new Date().toISOString() });
  console.error(error);
  process.exit(1);
});
