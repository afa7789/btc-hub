// Formatting utilities for DEBASE

/**
 * Format a number as USD currency
 */
export function formatUSD(value: number, decimals = 2): string {
  return `$${value.toFixed(decimals)}`;
}

/**
 * Format a number as ounces (for gold/silver)
 */
export function formatOunces(value: number, decimals = 6): string {
  return `${value.toFixed(decimals)} oz`;
}

/**
 * Format large numbers with K/M/B suffixes
 */
export function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if (value >= 1) return `${value.toFixed(0)}x`;
  return value.toFixed(2);
}

/**
 * Format date string for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format billions into readable string with B/T/Q suffixes
 */
export function formatBillions(billions: number): string {
  if (billions >= 1000000) {
    return `$${(billions / 1000000).toFixed(1)}Q`; // Quadrillion
  }
  if (billions >= 1000) {
    return `$${(billions / 1000).toFixed(1)}T`; // Trillion
  }
  return `$${billions.toFixed(0)}B`; // Billion
}
