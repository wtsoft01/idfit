export function makeUniqueUsdtAmount(baseAmount: number) {
  const roundedBase = Math.round(Number(baseAmount) * 100) / 100;
  const randomSuffix = Math.floor(Math.random() * 100) + 1;
  return Number((roundedBase + randomSuffix / 10000).toFixed(4));
}

export function formatUsdt4(value: number) {
  return Number(value ?? 0).toFixed(4);
}

export function baseUsdt2(value: number) {
  return Number(value ?? 0).toFixed(2);
}
