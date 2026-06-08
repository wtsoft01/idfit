const DEFAULT_USDT_TRC20_CONTRACT = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
const DEFAULT_USDT_BEP20_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const DEFAULT_TRC20_PAYMENT_ADDRESS = "";
const DEFAULT_BEP20_PAYMENT_ADDRESS = "";

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

function tokenAmountToUsdt(rawValue, tokenDecimal = 6) {
  return Number(BigInt(rawValue)) / 10 ** Number(tokenDecimal);
}

function valueOrFallback(value, fallback) {
  return value && String(value).trim() ? value : fallback;
}

function isValidTronAddress(address) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address ?? "");
}

function isValidEvmAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address ?? "");
}

function getHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };
}

async function getPendingOrders({ supabaseUrl, headers, network, paymentAddress }) {
  const pendingUrl = `${supabaseUrl}/rest/v1/orders?status=eq.payment_pending&payment_network=eq.${network}&payment_address=eq.${encodeURIComponent(paymentAddress)}&select=id,order_no,sale_price_usdt,payment_network,payment_address,created_at&order=created_at.asc`;
  return fetchJson(pendingUrl, headers);
}

async function fetchTrc20Transfers({ paymentAddress, contractAddress, tronGridApiKey, limit }) {
  const tronHeaders = tronGridApiKey ? { "TRON-PRO-API-KEY": tronGridApiKey } : {};
  const tronUrl = new URL(`https://api.trongrid.io/v1/accounts/${paymentAddress}/transactions/trc20`);
  tronUrl.searchParams.set("only_confirmed", "true");
  tronUrl.searchParams.set("only_to", "true");
  tronUrl.searchParams.set("contract_address", contractAddress);
  tronUrl.searchParams.set("limit", String(limit));

  const payload = await fetchJson(tronUrl.toString(), tronHeaders);
  return (payload.data ?? []).map((transfer) => ({
    txid: transfer.transaction_id,
    to: transfer.to,
    amount: Number(formatUsdt4(tokenAmountToUsdt(transfer.value, transfer.token_info?.decimals ?? 6))),
    confirmedAt: transfer.block_timestamp ? new Date(transfer.block_timestamp).toISOString() : null,
  }));
}

async function fetchBep20Transfers({ paymentAddress, contractAddress, bscScanApiKey, limit }) {
  const bscUrl = new URL("https://api.bscscan.com/api");
  bscUrl.searchParams.set("module", "account");
  bscUrl.searchParams.set("action", "tokentx");
  bscUrl.searchParams.set("contractaddress", contractAddress);
  bscUrl.searchParams.set("address", paymentAddress);
  bscUrl.searchParams.set("page", "1");
  bscUrl.searchParams.set("offset", String(limit));
  bscUrl.searchParams.set("sort", "desc");
  if (bscScanApiKey) bscUrl.searchParams.set("apikey", bscScanApiKey);

  const payload = await fetchJson(bscUrl.toString());
  if (payload.status === "0" && payload.message !== "No transactions found") {
    throw new Error(`BscScan error: ${payload.message ?? "unknown"} ${payload.result ?? ""}`.trim());
  }

  return (Array.isArray(payload.result) ? payload.result : []).filter((transfer) => transfer.to?.toLowerCase() === paymentAddress.toLowerCase()).map((transfer) => ({
    txid: transfer.hash,
    to: transfer.to,
    amount: Number(formatUsdt4(tokenAmountToUsdt(transfer.value, transfer.tokenDecimal ?? 18))),
    confirmedAt: transfer.timeStamp ? new Date(Number(transfer.timeStamp) * 1000).toISOString() : null,
  }));
}

function matchOrders(pendingOrders, transfers) {
  const usedTxids = new Set();
  const matches = [];

  for (const order of pendingOrders) {
    const expected = Number(formatUsdt4(order.sale_price_usdt));
    const transfer = transfers.find((item) => item.amount === expected && !usedTxids.has(item.txid));
    if (!transfer) continue;
    usedTxids.add(transfer.txid);
    matches.push({
      order_id: order.id,
      order_no: order.order_no,
      network: order.payment_network,
      expected: formatUsdt4(expected),
      txid: transfer.txid,
      confirmedAt: transfer.confirmedAt,
    });
  }

  return matches;
}

async function writeMatches({ supabaseUrl, headers, matches }) {
  for (const match of matches) {
    const patchUrl = `${supabaseUrl}/rest/v1/orders?id=eq.${match.order_id}`;
    const response = await fetch(patchUrl, {
      method: "PATCH",
      headers: { ...headers, prefer: "return=minimal" },
      body: JSON.stringify({
        status: "payment_confirmed",
        payment_tx_hash: match.txid,
        payment_confirmed_at: match.confirmedAt ?? new Date().toISOString(),
        admin_note: `${match.network} USDT 고유입금액 ${match.expected} 자동확인`,
      }),
    });

    if (!response.ok) throw new Error(`Failed to update ${match.order_no}: ${response.status} ${await response.text()}`);
  }
}

async function confirmNetwork({ network, env, supabaseUrl, headers, write, limit, overrideAddress }) {
  if (network === "BEP20") {
    const paymentAddress = valueOrFallback(overrideAddress, valueOrFallback(env.USDT_BEP20_PAYMENT_ADDRESS, DEFAULT_BEP20_PAYMENT_ADDRESS));
    const contractAddress = valueOrFallback(env.USDT_BEP20_CONTRACT, DEFAULT_USDT_BEP20_CONTRACT);
    if (!isValidEvmAddress(paymentAddress)) return { ok: false, network, skipped: true, error: "A valid USDT_BEP20_PAYMENT_ADDRESS is required." };

    const pendingOrders = await getPendingOrders({ supabaseUrl, headers, network, paymentAddress });
    if (pendingOrders.length === 0) return { ok: true, network, write, paymentAddress, pending: 0, transferCount: 0, matches: [] };

    const transfers = await fetchBep20Transfers({ paymentAddress, contractAddress, bscScanApiKey: env.BSCSCAN_API_KEY, limit });
    const matches = matchOrders(pendingOrders, transfers);
    if (write) await writeMatches({ supabaseUrl, headers, matches });
    return { ok: true, network, write, paymentAddress, pending: pendingOrders.length, transferCount: transfers.length, matches };
  }

  const paymentAddress = valueOrFallback(overrideAddress, valueOrFallback(env.USDT_TRC20_PAYMENT_ADDRESS, DEFAULT_TRC20_PAYMENT_ADDRESS));
  const contractAddress = valueOrFallback(env.USDT_TRC20_CONTRACT, DEFAULT_USDT_TRC20_CONTRACT);
  if (!isValidTronAddress(paymentAddress)) return { ok: false, network, skipped: true, error: "A valid USDT_TRC20_PAYMENT_ADDRESS is required." };

  const pendingOrders = await getPendingOrders({ supabaseUrl, headers, network, paymentAddress });
  if (pendingOrders.length === 0) return { ok: true, network, write, paymentAddress, pending: 0, transferCount: 0, matches: [] };

  const transfers = await fetchTrc20Transfers({ paymentAddress, contractAddress, tronGridApiKey: env.TRONGRID_API_KEY, limit });
  const matches = matchOrders(pendingOrders, transfers);
  if (write) await writeMatches({ supabaseUrl, headers, matches });
  return { ok: true, network, write, paymentAddress, pending: pendingOrders.length, transferCount: transfers.length, matches };
}

export async function autoConfirmUsdtDeposits(options = {}) {
  const env = options.env ?? process.env;
  const supabaseUrl = valueOrFallback(options.supabaseUrl, env.SUPABASE_URL ?? env.VITE_SUPABASE_URL);
  const serviceKey = valueOrFallback(options.serviceKey, env.SUPABASE_SERVICE_ROLE_KEY);
  const write = Boolean(options.write);
  const limit = Number(options.limit ?? 200);
  const requestedNetwork = options.network ? String(options.network).toUpperCase() : "ALL";

  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const headers = getHeaders(serviceKey);
  const networks = requestedNetwork === "ALL" ? ["TRC20", "BEP20"] : [requestedNetwork];
  const results = [];

  for (const network of networks) {
    if (!["TRC20", "BEP20"].includes(network)) throw new Error(`Unsupported network: ${network}`);
    results.push(await confirmNetwork({
      network,
      env,
      supabaseUrl,
      headers,
      write,
      limit,
      overrideAddress: network === "TRC20" ? options.paymentAddress : undefined,
    }));
  }

  return {
    ok: results.every((result) => result.ok || result.skipped),
    write,
    networks: results,
    pending: results.reduce((sum, result) => sum + Number(result.pending ?? 0), 0),
    transferCount: results.reduce((sum, result) => sum + Number(result.transferCount ?? 0), 0),
    matches: results.flatMap((result) => result.matches ?? []),
  };
}
