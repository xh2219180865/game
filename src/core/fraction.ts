export interface Fraction {
  numerator: string;
  denominator: string;
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a || 1n;
}

export function fraction(n: bigint | number, d: bigint | number = 1): Fraction {
  let numerator = BigInt(n);
  let denominator = BigInt(d);
  if (denominator === 0n) throw new RangeError('Fraction denominator must not be zero');
  if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
  const divisor = gcd(numerator, denominator);
  return { numerator: String(numerator / divisor), denominator: String(denominator / divisor) };
}

export function add(a: Fraction, b: Fraction): Fraction {
  return fraction(BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator), BigInt(a.denominator) * BigInt(b.denominator));
}

export function subtract(a: Fraction, b: Fraction): Fraction {
  return add(a, { numerator: String(-BigInt(b.numerator)), denominator: b.denominator });
}

export function multiply(a: Fraction, b: Fraction): Fraction {
  return fraction(BigInt(a.numerator) * BigInt(b.numerator), BigInt(a.denominator) * BigInt(b.denominator));
}

export function divide(a: Fraction, b: Fraction): Fraction {
  return fraction(BigInt(a.numerator) * BigInt(b.denominator), BigInt(a.denominator) * BigInt(b.numerator));
}

export function compare(a: Fraction, b: Fraction): number {
  const delta = BigInt(a.numerator) * BigInt(b.denominator) - BigInt(b.numerator) * BigInt(a.denominator);
  return delta === 0n ? 0 : delta > 0n ? 1 : -1;
}

export function floor(a: Fraction): number {
  const n = BigInt(a.numerator), d = BigInt(a.denominator);
  const result = n / d - (n < 0n && n % d !== 0n ? 1n : 0n);
  const value = Number(result);
  if (!Number.isSafeInteger(value)) throw new RangeError('Fraction result exceeds the supported integer range');
  return value;
}

export function ceil(a: Fraction): number {
  return -floor({ numerator: String(-BigInt(a.numerator)), denominator: a.denominator });
}

export function asNumber(a: Fraction): number {
  return Number(a.numerator) / Number(a.denominator);
}

export function minimum(a: Fraction, b: Fraction): Fraction {
  return compare(a, b) <= 0 ? a : b;
}

export function isFraction(value: unknown): value is Fraction {
  if (!value || typeof value !== 'object') return false;
  const f = value as Fraction;
  if (typeof f.numerator !== 'string' || typeof f.denominator !== 'string') return false;
  if (!/^-?\d{1,96}$/.test(f.numerator) || !/^[1-9]\d{0,95}$/.test(f.denominator)) return false;
  const normalized = fraction(BigInt(f.numerator), BigInt(f.denominator));
  return normalized.numerator === f.numerator && normalized.denominator === f.denominator;
}

export const ZERO: Fraction = Object.freeze(fraction(0));
export const ONE: Fraction = Object.freeze(fraction(1));
