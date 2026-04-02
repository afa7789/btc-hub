// BigInt utility functions for financial calculations

export const SCALE = 1000000n; // 6 decimal places precision

/**
 * Convert a number to BigInt with scale
 */
export function toBigInt(value: number): bigint {
  return BigInt(Math.round(value * Number(SCALE)));
}

/**
 * Convert a scaled BigInt back to number
 */
export function fromBigInt(bigintValue: bigint): number {
  return Number(bigintValue) / Number(SCALE);
}

/**
 * Divide two BigInts while maintaining precision
 */
export function bigIntDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator * SCALE) / denominator;
}

/**
 * Multiply two BigInts while maintaining scale
 */
export function bigIntMultiply(a: bigint, b: bigint): bigint {
  return (a * b) / SCALE;
}
