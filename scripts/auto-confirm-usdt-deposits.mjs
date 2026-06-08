const DEFAULT_USDT_TRC20_CONTRACT = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
const DEFAULT_PAYMENT_ADDRESS = "TXk9bN3QzPmGv4Vc8a1Fx4Pn8Vq2sLm7";

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

async function parseEnvFile() {
  try {
    const fs = await import("node:fs");
    if (!fs.existsSync(".env")) return {};
    return Object.fromEntries(
      fs.readFileSync(".env", "utf8")
        .split(/\r?\n/)
        .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

function formatUsdt4(value) {
  return Number(value ?? 0).toFixed(4);
}

function trc20AmountToUsdt(rawValue, tokenDecimal = 6) {
  return Number(BigInt(rawValue)) / 10 ** Number(tokenDecimal);
}

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function main() {
  const envFile = await parseEnvFile();
  const env = { ...envFile, ...process.env };
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const paymentAddress = getArg("address", env.USDT_TRC20_PAYMENT_ADDRESS || DEFAULT_PAYMENT_ADDRESS);
  const contractAddress = getArg("contract", env.USDT_TRC20_CONTRACT || DEFAULT_USDT_TRC20_CONTRACT);
  const write = process.argv.includes("--write");
  const limit = Number(getArg("limit", "200"));

  if (!supabaseUrl || !serviceKey) throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

  const headers = {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };

  const pendingUrl = `${supabaseUrl}/rest/v1/orders?status=eq.payment_pending&payment_address=eq.${encodeURIComponent(paymentAddress)}&select=id,order_no,sale_price_usdt,payment_address,created_at&order=created_at.asc`;
  const pendingOrders = await fetchJson(pendingUrl, headers);

  if (pendingOrders.length === 0) {
    console.log(JSON.stringify({ ok: true, write, pending: 0, matches: [] }, null, 2));
    return;
  }

  const tronHeaders = env.TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": env.TRONGRID_API_KEY } : {};
  const tronUrl = new URL(`https://api.trongrid.io/v1/accounts/${paymentAddress}/transactions/trc20`);
  tronUrl.searchParams.set("only_confirmed", "true");
  tronUrl.searchParams.set("only_to", "true");
  tronUrl.searchParams.set("contract_address", contractAddress);
  tronUrl.searchParams.set("limit", String(limit));

  const transfersPayload = await fetchJson(tronUrl.toString(), tronHeaders);
  const transfers = (transfersPayload.data ?? []).map((transfer) => ({
    txid: transfer.transaction_id,
    to: transfer.to,
    amount: Number(formatUsdt4(trc20AmountToUsdt(transfer.value, transfer.token_info?.decimals ?? 6))),
    confirmedAt: transfer.block_timestamp ? new Date(transfer.block_timestamp).toISOString() : null,
  }));

  const usedTxids = new Set();
  const matches = [];

  for (const order of pendingOrders) {
    const expected = Number(formatUsdt4(order.sale_price_usdt));
    const transfer = transfers.find((item) => item.to === paymentAddress && item.amount === expected && !usedTxids.has(item.txid));
    if (!transfer) continue;
    usedTxids.add(transfer.txid);
    matches.push({ order_id: order.id, order_no: order.order_no, expected: formatUsdt4(expected), txid: transfer.txid, confirmedAt: transfer.confirmedAt });
  }

  if (write) {
    for (const match of matches) {
      const patchUrl = `${supabaseUrl}/rest/v1/orders?id=eq.${match.order_id}`;
      await fetch(patchUrl, {
        method: "PATCH",
        headers: { ...headers, prefer: "return=minimal" },
        body: JSON.stringify({
          status: "payment_confirmed",
          payment_tx_hash: match.txid,
          payment_confirmed_at: match.confirmedAt ?? new Date().toISOString(),
          admin_note: `TRC20 USDT 고유입금액 ${match.expected} 자동확인`,
        }),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`Failed to update ${match.order_no}: ${response.status} ${await response.text()}`);
      });
    }
  }

  console.log(JSON.stringify({ ok: true, write, paymentAddress, pending: pendingOrders.length, transferCount: transfers.length, matches }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
