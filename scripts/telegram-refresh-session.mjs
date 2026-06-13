import { writeFileSync } from "node:fs";
import { loadEnv } from "./sales-ingest-engine.mjs";

const DEFAULT_SESSION_OUT = ".telegram-user-session.txt";

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    help: false,
    sessionOut: DEFAULT_SESSION_OUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--session-out") args.sessionOut = argv[++index] ?? args.sessionOut;
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/telegram-refresh-session.mjs [options]

Refresh a Telegram MTProto user session and save it to a local ignored file.

Options:
  --session-out <path>       Save Telegram user session string (default: ${DEFAULT_SESSION_OUT})
  --help                    Show this help`);
}

async function importTelegramClient() {
  try {
    const telegram = await import("telegram");
    const sessions = await import("telegram/sessions/index.js");
    const input = await import("input");
    return { TelegramClient: telegram.TelegramClient, StringSession: sessions.StringSession, input: input.default ?? input };
  } catch {
    throw new Error("Missing packages. Run: npm install telegram input");
  }
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }

  const env = loadEnv();
  const apiId = Number(env.TELEGRAM_API_ID ?? 0);
  const apiHash = env.TELEGRAM_API_HASH;
  const sessionString = env.TELEGRAM_USER_SESSION ?? "";

  if (!apiId || !apiHash) throw new Error("Missing TELEGRAM_API_ID and TELEGRAM_API_HASH");

  const { TelegramClient, StringSession, input } = await importTelegramClient();
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, { connectionRetries: 5 });

  await client.start({
    phoneNumber: async () => env.TELEGRAM_PHONE || input.text("Telegram phone: "),
    password: async () => env.TELEGRAM_2FA_PASSWORD || input.text("Telegram 2FA password: "),
    phoneCode: async () => input.text("Telegram login code: "),
    onError: (error) => console.error(`[session] login error: ${error.message}`),
  });

  const newSession = client.session.save();
  writeFileSync(args.sessionOut, newSession, "utf8");
  console.log(`[session] Telegram user session saved to ${args.sessionOut}`);
  console.log("[session] Copy this value into TELEGRAM_USER_SESSION in your server-only .env or deployment secret.");
  await client.disconnect();
}

main().catch((error) => {
  console.error(`[session] ${error.message}`);
  process.exit(1);
});
