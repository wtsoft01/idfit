export type PaymentNetwork = string;

export const DEFAULT_PAYMENT_NETWORK = "TRC20";
export const AUTO_CONFIRM_NETWORKS = ["TRC20", "BEP20"] as const;

export const PAYMENT_ASSET_OPTIONS = [
  { value: "USDT", label: "USDT", networks: ["TRC20", "BEP20", "ERC20", "POLYGON", "ARBITRUM", "OP", "BASE", "AVAXC", "SOLANA"] },
  { value: "USDC", label: "USDC", networks: ["ERC20", "POLYGON", "ARBITRUM", "OP", "BASE", "SOLANA"] },
  { value: "BTC", label: "BTC", networks: ["BITCOIN"] },
  { value: "ETH", label: "ETH", networks: ["ERC20", "ARBITRUM", "OP", "BASE"] },
  { value: "BNB", label: "BNB", networks: ["BEP20"] },
  { value: "SOL", label: "SOL", networks: ["SOLANA"] },
] as const;

export const DEFAULT_NETWORK_BY_ASSET = PAYMENT_ASSET_OPTIONS.reduce<Record<string, string>>((result, option) => {
  result[option.value] = option.networks[0];
  return result;
}, {});

export function getPaymentAssetNetworks(asset: string | null | undefined) {
  const normalizedAsset = normalizePaymentAsset(asset);
  return PAYMENT_ASSET_OPTIONS.find((option) => option.value === normalizedAsset)?.networks ?? [DEFAULT_PAYMENT_NETWORK];
}

export function normalizePaymentNetwork(value: string | null | undefined): PaymentNetwork {
  return String(value ?? DEFAULT_PAYMENT_NETWORK).trim().toUpperCase() || DEFAULT_PAYMENT_NETWORK;
}

export function normalizePaymentAsset(value: string | null | undefined) {
  return String(value ?? "USDT").trim().toUpperCase() || "USDT";
}

export function supportsAutoConfirm(network: string | null | undefined, asset: string | null | undefined = "USDT") {
  const normalizedNetwork = normalizePaymentNetwork(network);
  return normalizePaymentAsset(asset) === "USDT" && AUTO_CONFIRM_NETWORKS.includes(normalizedNetwork as (typeof AUTO_CONFIRM_NETWORKS)[number]);
}

export function isConfiguredPaymentAddress(network: PaymentNetwork, address: string | null | undefined) {
  if (!address?.trim()) return false;
  const normalizedNetwork = normalizePaymentNetwork(network);
  const trimmedAddress = address.trim();
  if (normalizedNetwork === "TRC20") return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmedAddress);
  if (["BEP20", "ERC20", "POLYGON", "ARBITRUM", "OP", "BASE", "AVAXC"].includes(normalizedNetwork)) return /^0x[a-fA-F0-9]{40}$/.test(trimmedAddress);
  if (["BTC", "BITCOIN"].includes(normalizedNetwork)) return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/.test(trimmedAddress);
  if (["SOL", "SOLANA"].includes(normalizedNetwork)) return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmedAddress);
  return trimmedAddress.length >= 12;
}

export type PaymentWalletSetting = {
  id: string;
  asset: string;
  network: PaymentNetwork;
  label?: string;
  address: string;
  enabled: boolean;
  autoConfirm?: boolean;
  memo?: string;
};

export type PaymentSettings = {
  wallets: PaymentWalletSetting[];
  paymentWindowMinutes: number;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  wallets: [
    { id: "usdt-trc20", asset: "USDT", network: "TRC20", label: "USDT TRC20", address: "", enabled: true, autoConfirm: true, memo: "" },
    { id: "usdt-bep20", asset: "USDT", network: "BEP20", label: "USDT BEP20", address: "", enabled: false, autoConfirm: true, memo: "" },
  ],
  paymentWindowMinutes: 60,
};

function makeWalletId(wallet: Record<string, unknown>, index: number) {
  if (typeof wallet.id === "string" && wallet.id.trim()) return wallet.id.trim();
  const asset = normalizePaymentAsset(typeof wallet.asset === "string" ? wallet.asset : "USDT").toLowerCase();
  const network = normalizePaymentNetwork(typeof wallet.network === "string" ? wallet.network : null).toLowerCase();
  return `${asset}-${network}-${index}`;
}

export function parsePaymentSettings(value: unknown): PaymentSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_PAYMENT_SETTINGS;
  const record = value as Record<string, unknown>;
  const parsedWallets = Array.isArray(record.wallets)
    ? record.wallets
        .filter((wallet): wallet is Record<string, unknown> => Boolean(wallet) && typeof wallet === "object" && !Array.isArray(wallet))
        .map((wallet, index) => {
          const network = normalizePaymentNetwork(typeof wallet.network === "string" ? wallet.network : null);
          const asset = normalizePaymentAsset(typeof wallet.asset === "string" ? wallet.asset : "USDT");
          return {
            id: makeWalletId(wallet, index),
            asset,
            network,
            label: typeof wallet.label === "string" ? wallet.label : `${asset} ${network}`,
            address: typeof wallet.address === "string" ? wallet.address.trim() : "",
            enabled: wallet.enabled !== false,
            autoConfirm: typeof wallet.autoConfirm === "boolean" ? wallet.autoConfirm : supportsAutoConfirm(network, asset),
            memo: typeof wallet.memo === "string" ? wallet.memo : "",
          };
        })
    : DEFAULT_PAYMENT_SETTINGS.wallets;

  const paymentWindowMinutes = typeof record.paymentWindowMinutes === "number" && record.paymentWindowMinutes > 0
    ? record.paymentWindowMinutes
    : DEFAULT_PAYMENT_SETTINGS.paymentWindowMinutes;

  return {
    wallets: parsedWallets.length > 0 ? parsedWallets : DEFAULT_PAYMENT_SETTINGS.wallets,
    paymentWindowMinutes,
  };
}

export function getEnabledWallet(settings: PaymentSettings, network: PaymentNetwork, asset = "USDT") {
  const normalizedNetwork = normalizePaymentNetwork(network);
  const normalizedAsset = normalizePaymentAsset(asset);
  return settings.wallets.find((wallet) =>
    wallet.enabled
    && normalizePaymentNetwork(wallet.network) === normalizedNetwork
    && normalizePaymentAsset(wallet.asset) === normalizedAsset
    && isConfiguredPaymentAddress(wallet.network, wallet.address)
  ) ?? null;
}

export function getCheckoutWallets(settings: PaymentSettings, asset = "USDT") {
  const normalizedAsset = normalizePaymentAsset(asset);
  return settings.wallets.filter((wallet) =>
    wallet.enabled
    && normalizePaymentAsset(wallet.asset) === normalizedAsset
    && supportsAutoConfirm(wallet.network, wallet.asset)
    && isConfiguredPaymentAddress(wallet.network, wallet.address)
  );
}
