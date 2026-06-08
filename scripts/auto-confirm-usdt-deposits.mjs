import { autoConfirmUsdtDeposits } from "./auto-confirm-usdt-core.mjs";

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

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function main() {
  const envFile = await parseEnvFile();
  const env = { ...envFile, ...process.env };
  const result = await autoConfirmUsdtDeposits({
    env,
    write: process.argv.includes("--write"),
    paymentAddress: getArg("address", env.USDT_TRC20_PAYMENT_ADDRESS),
    contractAddress: getArg("contract", env.USDT_TRC20_CONTRACT),
    limit: getArg("limit", "200"),
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
