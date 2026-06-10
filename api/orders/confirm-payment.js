import { createClient } from "@supabase/supabase-js";
import { autoConfirmUsdtDeposits } from "../../scripts/auto-confirm-usdt-core.mjs";

function getBearerToken(request) {
  return request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = getBearerToken(request);

  if (!supabaseUrl || !serviceKey) return response.status(500).json({ ok: false, error: "Server payment confirmation is not configured." });
  if (!accessToken) return response.status(401).json({ ok: false, error: "Login is required." });

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const user = userData?.user;
  if (userError || !user) return response.status(401).json({ ok: false, error: "Invalid session." });

  const orderId = typeof request.body?.orderId === "string" ? request.body.orderId : "";
  if (!orderId) return response.status(400).json({ ok: false, error: "orderId is required." });

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,user_id,status,payment_network,payment_address")
    .eq("id", orderId)
    .single();

  if (orderError || !order) return response.status(404).json({ ok: false, error: "Order not found." });
  if (order.user_id !== user.id) return response.status(403).json({ ok: false, error: "Forbidden." });
  if (order.status !== "payment_pending") return response.status(200).json({ ok: true, alreadyProcessed: true, status: order.status });

  const result = await autoConfirmUsdtDeposits({
    env: process.env,
    write: true,
    network: order.payment_network,
    paymentAddress: order.payment_address,
    limit: Number(request.query.limit ?? 200),
  });

  const matched = result.matches.some((match) => match.order_id === order.id);
  return response.status(200).json({ ok: true, matched, result: { pending: result.pending, transferCount: result.transferCount, matches: result.matches.length } });
}
