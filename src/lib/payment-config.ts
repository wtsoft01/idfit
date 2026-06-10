export type PaymentNetwork = "TRC20" | "BEP20";

export const DEFAULT_PAYMENT_NETWORK: PaymentNetwork = "TRC20";

export function isConfiguredPaymentAddress(network: PaymentNetwork, address: string | null | undefined) {
  if (!address) return false;
  if (network === "BEP20") return /^0x[a-fA-F0-9]{40}$/.test(address);
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

export function normalizePaymentNetwork(value: string | null | undefined): PaymentNetwork {
  return value === "BEP20" ? "BEP20" : "TRC20";
}

export type PaymentWalletSetting = {
  network: PaymentNetwork;
  address: string;
  enabled: boolean;
  memo?: string;
};

export type PaymentSettings = {
  wallets: PaymentWalletSetting[];
  paymentWindowMinutes: number;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  wallets: [
    { network: "TRC20", address: "", enabled: true, memo: "" },
    { network: "BEP20", address: "", enabled: false, memo: "" },
  ],
  paymentWindowMinutes: 60,
};

export function parsePaymentSettings(value: unknown): PaymentSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_PAYMENT_SETTINGS;
  const record = value as Record<string, unknown>;
  const wallets = Array.isArray(record.wallets)
    ? record.wallets
        .filter((wallet): wallet is Record<string, unknown> => Boolean(wallet) && typeof wallet === "object" && !Array.isArray(wallet))
        .map((wallet) => ({
          network: normalizePaymentNetwork(typeof wallet.network === "string" ? wallet.network : null),
          address: typeof wallet.address === "string" ? wallet.address.trim() : "",
          enabled: wallet.enabled !== false,
          memo: typeof wallet.memo === "string" ? wallet.memo : "",
        }))
    : DEFAULT_PAYMENT_SETTINGS.wallets;

  const paymentWindowMinutes = typeof record.paymentWindowMinutes === "number" && record.paymentWindowMinutes > 0
    ? record.paymentWindowMinutes
    : DEFAULT_PAYMENT_SETTINGS.paymentWindowMinutes;

  return {
    wallets: ["TRC20", "BEP20"].map((network) => wallets.find((wallet) => wallet.network === network) ?? DEFAULT_PAYMENT_SETTINGS.wallets.find((wallet) => wallet.network === network)!),
    paymentWindowMinutes,
  };
}

export function getEnabledWallet(settings: PaymentSettings, network: PaymentNetwork) {
  return settings.wallets.find((wallet) => wallet.network === network && wallet.enabled && isConfiguredPaymentAddress(network, wallet.address)) ?? null;
}
