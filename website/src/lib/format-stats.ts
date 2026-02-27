/** SOL-beløb med max 2 decimaler */
export function formatSol(num: number): string {
  return Number(num).toFixed(2);
}

/** Kompakt format med max 2 decimaler efter hovedtal */
export function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return Number(num).toFixed(2);
}
