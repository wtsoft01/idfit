const DEFAULT_USDT_TRC20_CONTRACT = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
const DEFAULT_PAYMENT_ADDRESS = "";

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

export function formatUsdt4(value) {
  return Number(value ?? 0).toFixed(4);
}

function trc20AmountToUsdt(rawValue, tokenDecimal = 6) {
  return Number(BigInt(rawValue)) / 10 ** Number(tokenDecimal);
}

function valueOrFallback(value, fallback) {
  return value && String(value).trim() ? value : fallback;
}

function isValidTronAddress(address) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address ?? "");
}

export async function autoConfirmUsdtDeposits(options = {}) {
  const env = options.env ?? process.env;
  const supabaseUrl = valueOrFallback(options.supabaseUrl, env.SUPABASE_URL ?? env.VITE_SUPABASE_URL);
  const serviceKey = valueOrFallback(options.serviceKey, env.SUPABASE_SERVICE_ROLE_KEY);
  const paymentAddress = valueOrFallback(options.paymentAddress, valueOrFallback(env.USDT_TRC20_PAYMENT_ADDRESS, DEFAULT_PAYMENT_ADDRESS));
  const contractAddress = valueOrFallback(options.contractAddress, valueOrFallback(env.USDT_TRC20_CONTRACT, DEFAULT_USDT_TRC20_CONTRACT));
  const tronGridApiKey = valueOrFallback(options.tronGridApiKey, env.TRONGRID_API_KEY);
  const write = Boolean(options.write);
  const limit = Number(options.limit ?? 200);

  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  if (!isValidTronAddress(paymentAddress)) {
    throw new Error("A valid USDT_TRC20_PAYMENT_ADDRESS is required.");
  }

  const headers = {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };

  const pendingUrl = `${supabaseUrl}/rest/v1/orders?status=eq.payment_pending&payment_address=eq.${encodeURIComponent(paymentAddress)}&select=id,order_no,sale_price_usdt,payment_address,created_at&order=created_at.asc`;
  const pendingOrders = await fetchJson(pendingUrl, headers);

  if (pendingOrders.length === 0) {
    return { ok: true, write, paymentAddress, pending: 0, transferCount: 0, matches: [] };
  }

  const tronHeaders = tronGridApiKey ? { "TRON-PRO-API-KEY": tronGridApiKey } : {};
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
    matches.push({
      order_id: order.id,
      order_no: order.order_no,
      expected: formatUsdt4(expected),
      txid: transfer.txid,
      confirmedAt: transfer.confirmedAt,
    });
  }

  if (write) {
    for (const match of matches) {
      const patchUrl = `${supabaseUrl}/rest/v1/orders?id=eq.${match.order_id}`;
      const response = await fetch(patchUrl, {
        method: "PATCH",
        headers: { ...headers, prefer: "return=minimal" },
        body: JSON.stringify({
          status: "payment_confirmed",
          payment_tx_hash: match.txid,
          payment_confirmed_at: match.confirmedAt ?? new Date().toISOString(),
          admin_note: `TRC20 USDT 고유입금액 ${match.expected} 자동확인`,
        }),
      });

      if (!response.ok) throw new Error(`Failed to update ${match.order_no}: ${response.status} ${await response.text()}`);
    }
  }

  return { ok: true, write, paymentAddress, pending: pendingOrders.length, transferCount: transfers.length, matches };
}
