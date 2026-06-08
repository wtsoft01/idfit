export const DEFAULT_PAYMENT_NETWORK = "TRC20";

const FALLBACK_PAYMENT_ADDRESS = "";

export function getUsdtPaymentAddress() {
  return import.meta.env.VITE_USDT_TRC20_PAYMENT_ADDRESS || FALLBACK_PAYMENT_ADDRESS;
}

export function isConfiguredPaymentAddress(address: string | null | undefined) {
  return Boolean(address && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address));
}
