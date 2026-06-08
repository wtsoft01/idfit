export type PaymentNetwork = "TRC20" | "BEP20";

export const DEFAULT_PAYMENT_NETWORK: PaymentNetwork = "TRC20";

const FALLBACK_TRC20_PAYMENT_ADDRESS = "";
const FALLBACK_BEP20_PAYMENT_ADDRESS = "";

export function getUsdtPaymentAddress(network: PaymentNetwork = DEFAULT_PAYMENT_NETWORK) {
  if (network === "BEP20") return import.meta.env.VITE_USDT_BEP20_PAYMENT_ADDRESS || FALLBACK_BEP20_PAYMENT_ADDRESS;
  return import.meta.env.VITE_USDT_TRC20_PAYMENT_ADDRESS || FALLBACK_TRC20_PAYMENT_ADDRESS;
}

export function isConfiguredPaymentAddress(network: PaymentNetwork, address: string | null | undefined) {
  if (!address) return false;
  if (network === "BEP20") return /^0x[a-fA-F0-9]{40}$/.test(address);
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}
