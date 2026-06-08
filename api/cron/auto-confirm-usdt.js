import { autoConfirmUsdtDeposits } from "../../scripts/auto-confirm-usdt-core.mjs";

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const expectedSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? request.query.secret;

  if (expectedSecret && providedSecret !== expectedSecret) {
    return response.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const result = await autoConfirmUsdtDeposits({
      env: process.env,
      write: true,
      limit: Number(request.query.limit ?? 200),
    });

    return response.status(200).json(result);
  } catch (error) {
    console.error(error);
    return response.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
