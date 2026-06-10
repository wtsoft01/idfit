export function makeUniqueUsdtAmount(baseAmount: number, unavailableAmounts: Array<number | string> = []) {
  const roundedBase = Math.round(Number(baseAmount) * 100) / 100;
  const unavailable = new Set(unavailableAmounts.map((amount) => formatUsdt4(Number(amount))));
  const offsets = Array.from({ length: 99 }, (_, index) => index + 1).sort(() => Math.random() - 0.5);

  for (const offset of offsets) {
    const candidate = Number((roundedBase + offset / 10000).toFixed(4));
    if (!unavailable.has(formatUsdt4(candidate))) return candidate;
  }

  return Number((roundedBase + (100 + Math.floor(Math.random() * 900)) / 10000).toFixed(4));
}

export function formatUsdt4(value: number) {
  return Number(value ?? 0).toFixed(4);
}

export function baseUsdt2(value: number) {
  return Number(value ?? 0).toFixed(2);
}
