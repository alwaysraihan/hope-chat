/**
 * Currency utilities for Hopenity.
 *
 * Formatting  — Intl.NumberFormat (platform-native, handles every ISO 4217 code,
 *               locale-specific separators, symbol placement, RTL, zero-decimal
 *               currencies like JPY, and three-decimal like KWD).
 *
 * Country → currency — country-to-currency npm package (maintained ISO 3166-1 α2
 *                      → ISO 4217 mapping, 17M+ weekly downloads).
 *
 * Arithmetic  — currency.js (safe decimal arithmetic, avoids float precision
 *               errors like 2.1 + 1.1 = 3.2000000000000002, 97M+ weekly downloads).
 *
 * Exchange rates — open.er-api.com (free, no key, USD-base, refreshed every 4 h
 *                  and cached in MMKV).  Hardcoded mid-2025 fallback rates are
 *                  used when offline or on first load.
 */

import countryToCurrency from 'country-to-currency';
import currency from 'currency.js';
import { createMMKV } from 'react-native-mmkv';

// ─── Country → ISO 4217 currency code ────────────────────────────────────────

/** ISO 4217 currency code for a given ISO 3166-1 alpha-2 country code. */
export function currencyForCountry(countryCode: string | null | undefined): string {
  if (!countryCode) return 'USD';
  return (countryToCurrency as Record<string, string>)[countryCode.toUpperCase()] ?? 'USD';
}

// ─── Intl formatter cache ─────────────────────────────────────────────────────

const _formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currencyCode: string): Intl.NumberFormat {
  if (_formatters.has(currencyCode)) return _formatters.get(currencyCode)!;
  let fmt: Intl.NumberFormat;
  try {
    fmt = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: undefined,
    });
  } catch {
    fmt = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  _formatters.set(currencyCode, fmt);
  return fmt;
}

/** Format a number as a local currency string using the platform's Intl engine. */
export function formatCurrencyAmount(amount: number, currencyCode: string): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return getFormatter(currencyCode).format(safe);
  } catch {
    return `${currencyCode} ${safe.toFixed(2)}`;
  }
}

/** Extract just the currency symbol for a given code. */
export function symbolForCurrency(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find(p => p.type === 'currency')?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

// ─── Exchange rates ───────────────────────────────────────────────────────────

// Hardcoded fallbacks: 1 USD = N units (mid-2025 approximations).
const FALLBACK_RATES: Record<string, number> = {
  USD:1,      EUR:0.93,   GBP:0.79,   JPY:157,    CNY:7.25,   KRW:1340,
  INR:84,     BDT:110,    PKR:278,    LKR:310,    NPR:134,    PHP:58,
  THB:36,     IDR:16200,  MYR:4.7,    SGD:1.35,   HKD:7.82,   TWD:32,
  AUD:1.54,   CAD:1.37,   NZD:1.68,   CHF:0.90,   SEK:10.7,   NOK:10.7,
  DKK:6.94,   PLN:4.0,    CZK:23,     HUF:370,    RON:4.65,   BGN:1.82,
  TRY:32,     RUB:92,     UAH:41,     BRL:5.1,    MXN:17,     ARS:900,
  CLP:940,    COP:4000,   PEN:3.75,   AED:3.67,   SAR:3.75,   QAR:3.64,
  KWD:0.31,   BHD:0.38,   OMR:0.38,   ILS:3.7,    ZAR:18.5,   NGN:1550,
  GHS:15.5,   KES:130,    EGP:49,     MAD:10,     TZS:2700,   UGX:3800,
  ETB:57,     GNF:8600,   MMK:2100,   VND:25000,  MNT:3400,
};

let _rates: Record<string, number> = { ...FALLBACK_RATES };
let _ratesFetchedAt = 0;
const RATES_TTL_MS = 4 * 60 * 60 * 1000; // 4 h

const _storage = createMMKV({ id: 'hopechat-exchange-rates' });

function loadCachedRates(): void {
  try {
    const raw = _storage.getString('rates_v1');
    const ts  = _storage.getNumber('rates_ts_v1') ?? 0;
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>;
      if (parsed && typeof parsed === 'object') {
        _rates = { ...FALLBACK_RATES, ...parsed };
        _ratesFetchedAt = ts;
      }
    }
  } catch { /* keep fallback */ }
}

loadCachedRates();

/** Refresh rates from open.er-api.com (free, no key, USD-base). */
export async function refreshExchangeRates(): Promise<void> {
  if (Date.now() - _ratesFetchedAt < RATES_TTL_MS) return;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout?.(6000) ?? undefined,
    });
    if (!res.ok) return;
    const json = await res.json() as { rates?: Record<string, number>; result?: string };
    if (json.result === 'success' && json.rates && typeof json.rates === 'object') {
      _rates = { ...FALLBACK_RATES, ...json.rates };
      _ratesFetchedAt = Date.now();
      _storage.set('rates_v1', JSON.stringify(json.rates));
      _storage.set('rates_ts_v1', _ratesFetchedAt);
    }
  } catch { /* keep cached / fallback */ }
}

/** How many units of `currencyCode` equal 1 USD. */
export function rateFromUSD(currencyCode: string): number {
  return _rates[currencyCode] ?? 1;
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

export type ConvertedPrice = {
  /** Formatted string, e.g. "৳1,100" or "$12.50" */
  display: string;
  /** Raw number in the target currency */
  local: number;
  /** ISO 4217 code */
  currency: string;
};

/**
 * Convert a USD amount to a target currency and format it using Intl.
 * Uses currency.js for precision-safe arithmetic.
 *
 * @example
 * convertFromUSD(10, 'BDT')  → { display: '৳1,100', local: 1100, currency: 'BDT' }
 * convertFromUSD(10, 'USD')  → { display: '$10.00', local: 10,   currency: 'USD' }
 * convertFromUSD(10, 'JPY')  → { display: '¥1,570', local: 1570, currency: 'JPY' }
 */
export function convertFromUSD(usdAmount: number, targetCurrency: string): ConvertedPrice {
  const rate  = rateFromUSD(targetCurrency);
  const local = currency(usdAmount, { precision: 8 }).multiply(rate).value;
  return {
    display:  formatCurrencyAmount(local, targetCurrency),
    local,
    currency: targetCurrency,
  };
}

/**
 * Convert a local-currency value back to USD for storing in the DB.
 * Uses currency.js for precision-safe division.
 */
export function convertToUSD(localAmount: number, fromCurrency: string): number {
  const rate = rateFromUSD(fromCurrency);
  if (rate <= 0) return localAmount;
  return currency(localAmount, { precision: 8 }).divide(rate).value;
}
