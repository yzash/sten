export const SGD_PER_USD = 1.29;

export function usd(n: number, opts: { compact?: boolean; sign?: boolean } = {}): string {
  const sign = opts.sign && n > 0 ? "+" : n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (opts.compact) {
    if (v >= 1_000_000) return `${sign}USD ${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 10_000) return `${sign}USD ${Math.round(v / 1_000)}K`;
    if (v >= 1_000) return `${sign}USD ${(v / 1_000).toFixed(1)}K`;
  }
  return `${sign}USD ${Math.round(v).toLocaleString("en-US")}`;
}

export function sgd(nUsd: number): string {
  const v = nUsd * SGD_PER_USD;
  if (v >= 1_000_000) return `SGD ${(v / 1_000_000).toFixed(2)}M`;
  return `SGD ${Math.round(v).toLocaleString("en-US")}`;
}

export const num = (n: number) => Math.round(n).toLocaleString("en-US");
export const days = (n: number) => `${n}d`;
export const pct = (n: number, dp = 0) => `${n.toFixed(dp)}%`;
