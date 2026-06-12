import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  createServiceSupabase,
  getOrCreateSource,
  ingestRawSalesMessage,
  loadEnv,
  normalizeSourceIdentifier,
} from "./sales-ingest-engine.mjs";

const PARSER_VERSION = "idfit-supplier-bot-explorer-v1";
const DEFAULT_SAFE_BUTTONS = [
  "start", "시작", "상품", "상품정보", "상품 정보", "상품보기", "상품 보기", "목록", "리스트", "가격", "가격정보", "재고", "상세", "확인", "다음", "more", "list", "catalog", "product", "products", "price", "stock", "details", "buy", "order", "purchase", "sản phẩm", "san pham", "mua hàng", "mua hang", "mua ngay", "giá", "gia", "kho", "chi tiết", "chi tiet", "购买", "商品", "价格", "库存", "查看", "详情", "下单",
];
const DEFAULT_STOP_BUTTONS = [
  "결제완료", "송금완료", "입금완료", "구매확정", "확정", "확인완료", "전송", "제출", "confirm", "confirmed", "paid", "payment sent", "i paid", "submit", "send", "đã thanh toán", "da thanh toán", "da thanh toan", "xác nhận", "xac nhan", "gửi", "gui", "付款完成", "已付款", "确认", "提交", "发送",
];
const DEFAULT_ORDER_BUTTONS = ["구매", "구매하기", "주문", "주문하기", "buy", "order", "purchase", "mua", "mua ngay", "mua hàng", "mua hang", "下单", "购买"];
const WALLET_PATTERNS = [
  { network: "TRC20", regex: /\bT[A-HJ-NP-Za-km-z1-9]{25,40}\b/g },
  { network: "BEP20", regex: /\b0x[a-fA-F0-9]{40}\b/g },
  { network: "ERC20", regex: /\b0x[a-fA-F0-9]{40}\b/g },
];

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    help: false,
    bot: "",
    sourceName: "",
    dryRun: false,
    write: false,
    maxDepth: 5,
    maxClicks: 25,
    clickOrderButtons: false,
    sessionOut: "",
    scenario: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--bot") args.bot = argv[++index] ?? args.bot;
    else if (value === "--source-name") args.sourceName = argv[++index] ?? args.sourceName;
    else if (value === "--max-depth") args.maxDepth = Number(argv[++index] ?? args.maxDepth);
    else if (value === "--max-clicks") args.maxClicks = Number(argv[++index] ?? args.maxClicks);
    else if (value === "--session-out") args.sessionOut = argv[++index] ?? args.sessionOut;
    else if (value === "--click-order-buttons") args.clickOrderButtons = true;
    else if (value === "--write") args.write = true;
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--step") args.scenario.push(argv[++index] ?? "");
  }
  return args;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function includesAny(text, words) {
  const lower = normalizeText(text).toLowerCase();
  return words.some((word) => lower.includes(String(word).toLowerCase()));
}

function extractUsdtAmount(text) {
  const normalized = normalizeText(text).replace(/,/g, "");
  const match = normalized.match(/(?:USDT|USD|\$)\s*[:：-]?\s*(\d+(?:\.\d+)?)/i) || normalized.match(/(\d+(?:\.\d+)?)\s*(?:USDT|USD|달러)/i);
  return match ? Number(match[1]) : null;
}

function extractWallets(text) {
  const wallets = [];
  for (const pattern of WALLET_PATTERNS) {
    for (const match of String(text ?? "").matchAll(pattern.regex)) {
      wallets.push({ network: pattern.network, address: match[0] });
    }
  }
  const seen = new Set();
  return wallets.filter((wallet) => {
    const key = `${wallet.network}:${wallet.address.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mediaSummary(message) {
  const media = [];
  const photo = message.photo ?? message.media?.photo;
  const document = message.document ?? message.media?.document;
  if (photo) media.push({ type: "photo", purpose: "possible_qr", id: String(photo.id ?? message.id ?? "") });
  if (document) media.push({ type: "document", purpose: "possible_qr", id: String(document.id ?? message.id ?? ""), mime_type: document.mimeType ?? null });
  return media;
}

function extractInlineButtons(message) {
  const rows = message.replyMarkup?.rows ?? [];
  const buttons = [];
  rows.forEach((row, rowIndex) => {
    const rowButtons = row.buttons ?? [];
    rowButtons.forEach((button, buttonIndex) => {
      buttons.push({
        text: normalizeText(button.text),
        rowIndex,
        buttonIndex,
        kind: button.className ?? button.constructor?.name ?? "unknown",
      });
    });
  });
  return buttons.filter((button) => button.text);
}

function classifyButton(button, options = {}) {
  const text = button.text;
  if (includesAny(text, options.stopButtons ?? DEFAULT_STOP_BUTTONS)) return "blocked";
  if (looksLikeProductButton(text)) return "product_item";
  if (includesAny(text, options.orderButtons ?? DEFAULT_ORDER_BUTTONS)) return options.clickOrderButtons ? "order_probe" : "order_blocked";
  if (/(?:상세|정보|details?|detail|chi tiết|chi tiet|查看|详情)/i.test(normalizeText(text))) return "detail_navigation";
  if (includesAny(text, options.safeButtons ?? DEFAULT_SAFE_BUTTONS)) return "safe";
  return "unknown";
}

function extractObservation(message, source) {
  const text = normalizeText(message.message ?? message.text ?? "");
  const buttons = extractInlineButtons(message);
  const wallets = extractWallets(text);
  const amount = extractUsdtAmount(text);
  return {
    source,
    messageId: message.id ? String(message.id) : null,
    text,
    buttons,
    wallets,
    amount,
    media: mediaSummary(message),
    receivedAt: message.date ? new Date(Number(message.date) * 1000).toISOString() : new Date().toISOString(),
  };
}

function conversationDigest(observations) {
  return createHash("sha256").update(JSON.stringify(observations.map((item) => [item.messageId, item.text, item.buttons?.map((button) => button.text)]))).digest("hex");
}

function entityProfile(entity, bot) {
  return {
    id: entity?.id ? String(entity.id) : null,
    username: entity?.username ? `@${entity.username}` : bot,
    title: [entity?.firstName, entity?.lastName].filter(Boolean).join(" ") || entity?.title || bot,
    bot: Boolean(entity?.bot),
    verified: Boolean(entity?.verified),
    scam: Boolean(entity?.scam),
    fake: Boolean(entity?.fake),
    refreshed_at: new Date().toISOString(),
  };
}

async function refreshSourceProfile(supabase, source, entity, bot, options) {
  if (!supabase || options.dryRun || !source?.id) return;
  const metadata = source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata) ? source.metadata : {};
  const profile = entityProfile(entity, bot);
  const { error } = await supabase
    .from("telegram_sources")
    .update({
      metadata: {
        ...metadata,
        profile_refresh_enabled: true,
        profile,
        profile_refreshed_at: profile.refreshed_at,
      },
    })
    .eq("id", source.id);
  if (error) console.error(`[explorer] profile refresh failed: ${error.message}`);
}

async function importTelegramClient() {
  try {
    const telegram = await import("telegram");
    const sessions = await import("telegram/sessions/index.js");
    const input = await import("input");
    return { TelegramClient: telegram.TelegramClient, StringSession: sessions.StringSession, input: input.default ?? input };
  } catch (error) {
    throw new Error("Missing packages. Run: npm install telegram input");
  }
}

function looksLikeProductButton(text) {
  const normalized = normalizeText(text);
  return /(?:\$|USDT|USD|\b\d+(?:\.\d+)?\s*k\b|가격|price|giá|售价|📦|stock|재고|warranty|보증|bảo hành|bao hanh|bh\b|gmail|hotmail|outlook|vpn|api|capcut|chatgpt|claude|gemini|kling|grok|lovable|netflix|adobe)/i.test(normalized)
    && /(?:\d|∞)/.test(normalized)
    && normalized.length >= 8;
}

async function saveObservation(supabase, source, observation, options) {
  const buttonText = observation.buttons.length
    ? observation.buttons.map((button) => button.text).join("\n")
    : "";
  const messageText = [
    observation.text,
    buttonText,
    observation.wallets.length ? `wallets: ${observation.wallets.map((wallet) => `${wallet.network}:${wallet.address}`).join(", ")}` : "",
    observation.amount ? `amount: ${observation.amount} USDT` : "",
  ].filter(Boolean).join("\n");
  const result = await ingestRawSalesMessage(supabase, {
    source,
    text: messageText,
    telegram_message_id: observation.messageId,
    message_media: observation.media,
    received_at: observation.receivedAt,
    hash_key: `${source.id}:supplier-bot:${observation.messageId ?? conversationDigest([observation])}:${messageText}`,
    metadata: {
      collector: "telegram-user-client-bot-explorer",
      parser: PARSER_VERSION,
      buttons: observation.buttons,
      wallets: observation.wallets,
      amount: observation.amount,
      source_bot: source.telegram_identifier,
    },
  }, { parserVersion: PARSER_VERSION, dryRun: options.dryRun });

  const productButtons = observation.buttons.filter((button) => looksLikeProductButton(button.text));
  const buttonResults = [];
  for (const button of productButtons) {
    const classification = classifyButton(button, options);
    buttonResults.push(await ingestRawSalesMessage(supabase, {
      source,
      text: button.text,
      telegram_message_id: observation.messageId ? `${observation.messageId}:${button.rowIndex}:${button.buttonIndex}` : null,
      message_media: [],
      received_at: observation.receivedAt,
      hash_key: `${source.id}:supplier-bot-button:${observation.messageId ?? conversationDigest([observation])}:${button.rowIndex}:${button.buttonIndex}:${button.text}`,
      metadata: {
        collector: "telegram-user-client-bot-explorer-button",
        parser: PARSER_VERSION,
        source_text_kind: "button_product_candidate",
        source_message_id: observation.messageId,
        source_bot: source.telegram_identifier,
        button: { ...button, classification },
      },
    }, { parserVersion: PARSER_VERSION, dryRun: options.dryRun }));
  }

  return { ...result, buttonResults };
}

function printHelp() {
  console.log(`Usage: node scripts/telegram-bot-explorer.mjs --bot @supplier_bot [options]

Options:
  --bot <@username>          Supplier bot username to explore
  --source-name <name>       Source display name
  --write                    Save observations to Supabase raw_messages
  --dry-run                  Resolve sources without writing rows
  --max-depth <number>       Maximum safe button traversal depth (default: 5)
  --max-clicks <number>      Maximum button clicks/messages to inspect (default: 25)
  --click-order-buttons      Manual audit only: probe order/buy buttons; confirm/payment buttons stay blocked
  --step <text>              Use an explicit scenario step instead of /start
  --session-out <path>       Save Telegram user session string
  --help                    Show this help`);
}

function assertValidBot(bot) {
  if (!bot || bot.startsWith("@--") || bot.startsWith("--")) {
    throw new Error("Missing or invalid --bot. Example: --bot @supplier_bot");
  }
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }
  const env = loadEnv();
  const bot = normalizeSourceIdentifier(args.bot || env.TELEGRAM_EXPLORER_BOT, "bot");
  assertValidBot(bot);

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
    onError: (error) => console.error(`[explorer] login error: ${error.message}`),
  });

  const newSession = client.session.save();
  if (args.sessionOut) writeFileSync(args.sessionOut, newSession, "utf8");
  else if (!sessionString) console.log("[explorer] New Telegram session was created. Re-run with --session-out <path> to save it securely, then place it in TELEGRAM_USER_SESSION outside version control.");

  const supabase = args.write || args.dryRun ? createServiceSupabase(env) : null;
  const { source } = supabase
    ? await getOrCreateSource(supabase, {
        name: args.sourceName || `Supplier Bot ${bot}`,
        source_type: "bot",
        telegram_identifier: bot,
        status: "live",
        auto_collect_enabled: true,
        metadata: { collector: "telegram-user-client-bot-explorer", click_order_buttons: args.clickOrderButtons },
      }, { dryRun: args.dryRun })
    : { source: { id: "local-source", telegram_identifier: bot, source_type: "bot" } };

  const entity = await client.getEntity(bot);
  await refreshSourceProfile(supabase, source, entity, bot, args);
  const observations = [];
  const queue = args.scenario.length ? args.scenario.map((text) => ({ text, depth: 0, explicit: true })) : [{ text: "/start", depth: 0, explicit: true }];
  const clicked = new Set();

  while (queue.length && clicked.size < args.maxClicks) {
    const action = queue.shift();
    if (action.depth > args.maxDepth) continue;

    if (action.text === "/start") {
      await client.sendMessage(entity, { message: "/start" });
      clicked.add(`/start:${action.depth}`);
    } else if (action.messageId !== undefined && action.buttonIndex !== undefined) {
      const messages = await client.getMessages(entity, { ids: [action.messageId] });
      const message = Array.isArray(messages) ? messages[0] : messages;
      const key = `${action.messageId}:${action.buttonIndex}:${action.text}`;
      if (!message || clicked.has(key)) continue;
      await message.click({ i: action.buttonIndex });
      clicked.add(key);
    }

    await new Promise((resolve) => setTimeout(resolve, 1800));
    const messages = await client.getMessages(entity, { limit: 8 });
    for (const message of [...messages].reverse()) {
      const observation = extractObservation(message, bot);
      if (!observation.text && !observation.buttons.length && !observation.media.length) continue;
      if (observations.some((item) => item.messageId === observation.messageId)) continue;
      observations.push(observation);
      console.log(`[explorer] message=${observation.messageId} amount=${observation.amount ?? "-"} wallets=${observation.wallets.length} buttons=${observation.buttons.map((button) => button.text).join(" | ")}`);

      if ((args.write || args.dryRun) && supabase) await saveObservation(supabase, source, observation, args);

      for (const button of observation.buttons) {
        const classification = classifyButton(button, { clickOrderButtons: args.clickOrderButtons });
        if (classification === "blocked" || classification === "order_blocked" || classification === "unknown" || classification === "product_item") {
          console.log(`[explorer] skip ${classification}: ${button.text}`);
          continue;
        }
        queue.push({
          text: button.text,
          messageId: Number(observation.messageId),
          buttonIndex: button.buttonIndex,
          depth: action.depth + 1,
          classification,
        });
      }
    }
  }

  console.log(JSON.stringify({ ok: true, bot, observations: observations.length, digest: conversationDigest(observations), clicked: clicked.size }, null, 2));
  await client.disconnect();
}

main().catch((error) => {
  console.error(`[explorer] ${error.message}`);
  process.exit(1);
});
