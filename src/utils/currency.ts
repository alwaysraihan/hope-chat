/**
 * Currency utilities — global-scale, zero third-party dependencies.
 *
 * Formatting strategy
 * ───────────────────
 * We use the JavaScript built-in Intl.NumberFormat API (available in React
 * Native's Hermes / JSC engine, fully spec-compliant).  It handles:
 *   • Correct currency symbols for every ISO 4217 code
 *   • Locale-specific decimal / thousands separators  (1,234.56 vs 1.234,56)
 *   • Symbol placement (before or after the number, space or no space)
 *   • Right-to-left currencies (Arabic, Hebrew)
 *   • No-decimal currencies (JPY ¥1,234 vs USD $12.34)
 *
 * Exchange rates
 * ──────────────
 * Rates are loaded from open.er-api.com once per 4-hour session and cached
 * in MMKV.  Hardcoded fallback rates are used if the device is offline or
 * the fetch fails.  All DB prices are stored in USD; this layer converts
 * USD ↔ local currency for display/input only.
 */

import { createMMKV } from 'react-native-mmkv';

// ─── Country → ISO 4217 currency code ────────────────────────────────────────

const COUNTRY_CURRENCY: Record<string, string> = {
  AF:'AFN', AL:'ALL', DZ:'DZD', AO:'AOA', AR:'ARS', AM:'AMD', AU:'AUD',
  AT:'EUR', AZ:'AZN', BS:'BSD', BH:'BHD', BD:'BDT', BY:'BYN', BE:'EUR',
  BZ:'BZD', BJ:'XOF', BT:'BTN', BO:'BOB', BA:'BAM', BW:'BWP', BR:'BRL',
  BN:'BND', BG:'BGN', BF:'XOF', BI:'BIF', KH:'KHR', CM:'XAF', CA:'CAD',
  CV:'CVE', CF:'XAF', TD:'XAF', CL:'CLP', CN:'CNY', CO:'COP', KM:'KMF',
  CG:'XAF', CD:'CDF', CR:'CRC', HR:'EUR', CU:'CUP', CY:'EUR', CZ:'CZK',
  DK:'DKK', DJ:'DJF', DO:'DOP', EC:'USD', EG:'EGP', SV:'USD', GQ:'XAF',
  ER:'ERN', EE:'EUR', ET:'ETB', FJ:'FJD', FI:'EUR', FR:'EUR', GA:'XAF',
  GM:'GMD', GE:'GEL', DE:'EUR', GH:'GHS', GR:'EUR', GT:'GTQ', GN:'GNF',
  GW:'XOF', GY:'GYD', HT:'HTG', HN:'HNL', HU:'HUF', IS:'ISK', IN:'INR',
  ID:'IDR', IR:'IRR', IQ:'IQD', IE:'EUR', IL:'ILS', IT:'EUR', JM:'JMD',
  JP:'JPY', JO:'JOD', KZ:'KZT', KE:'KES', KI:'AUD', KW:'KWD', KG:'KGS',
  LA:'LAK', LV:'EUR', LB:'LBP', LS:'LSL', LR:'LRD', LY:'LYD', LI:'CHF',
  LT:'EUR', LU:'EUR', MK:'MKD', MG:'MGA', MW:'MWK', MY:'MYR', MV:'MVR',
  ML:'XOF', MT:'EUR', MH:'USD', MR:'MRU', MU:'MUR', MX:'MXN', MD:'MDL',
  MC:'EUR', MN:'MNT', ME:'EUR', MA:'MAD', MZ:'MZN', MM:'MMK', NA:'NAD',
  NR:'AUD', NP:'NPR', NL:'EUR', NZ:'NZD', NI:'NIO', NE:'XOF', NG:'NGN',
  NO:'NOK', OM:'OMR', PK:'PKR', PW:'USD', PA:'PAB', PG:'PGK', PY:'PYG',
  PE:'PEN', PH:'PHP', PL:'PLN', PT:'EUR', QA:'QAR', RO:'RON', RU:'RUB',
  RW:'RWF', SA:'SAR', SN:'XOF', RS:'RSD', SC:'SCR', SL:'SLE', SG:'SGD',
  SK:'EUR', SI:'EUR', SB:'SBD', SO:'SOS', ZA:'ZAR', SS:'SSP', ES:'EUR',
  LK:'LKR', SD:'SDG', SR:'SRD', SE:'SEK', CH:'CHF', SY:'SYP', TW:'TWD',
  TJ:'TJS', TZ:'TZS', TH:'THB', TL:'USD', TG:'XOF', TO:'TOP', TT:'TTD',
  TN:'TND', TR:'TRY', TM:'TMT', TV:'AUD', UG:'UGX', UA:'UAH', AE:'AED',
  GB:'GBP', US:'USD', UY:'UYU', UZ:'UZS', VU:'VUV', VE:'VES', VN:'VND',
  YE:'YER', ZM:'ZMW', ZW:'ZWL',
};

/** ISO 4217 currency code for a given ISO 3166-1 alpha-2 country code. */
export function currencyForCountry(countryCode: string | null | undefined): string {
  if (!countryCode) return 'USD';
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? 'USD';
}

// ─── Intl formatter cache ─────────────────────────────────────────────────────

// Cache Intl.NumberFormat instances — constructing them is expensive.
const _formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string): Intl.NumberFormat {
  const key = currency;
  if (_formatters.has(key)) return _formatters.get(key)!;

  let fmt: Intl.NumberFormat;
  try {
    fmt = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      // Let Intl decide whether to show decimals (JPY = 0, USD = 2, BHD = 3)
      maximumFractionDigits: undefined,
    });
  } catch {
    // Unsupported currency code — fall back to plain number + code
    fmt = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  _formatters.set(key, fmt);
  return fmt;
}

/**
 * Format a number as a local currency string using the platform's Intl engine.
 * e.g. formatCurrencyAmount(1100, 'BDT') → '৳1,100'
 *      formatCurrencyAmount(12.5,  'USD') → '$12.50'
 *      formatCurrencyAmount(1500,  'JPY') → '¥1,500'
 *      formatCurrencyAmount(10,    'KWD') → 'KD 10.000'
 */
export function formatCurrencyAmount(amount: number, currency: string): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return getFormatter(currency).format(safe);
  } catch {
    return `${currency} ${safe.toFixed(2)}`;
  }
}

/**
 * Extract just the currency symbol for a given code.
 * Uses Intl to determine the correct symbol — no hardcoded map needed.
 * e.g. symbolForCurrency('BDT') → '৳', symbolForCurrency('EUR') → '€'
 */
export function symbolForCurrency(currency: string): string {
  try {
    // Format "0" in the target currency and strip the numeric part to get symbol
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const sym = parts.find(p => p.type === 'currency')?.value;
    return sym ?? currency;
  } catch {
    return currency;
  }
}

// ─── Exchange rates ───────────────────────────────────────────────────────────

// Hardcoded fallbacks: 1 USD = N units of each currency (mid-2025 approximations).
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
  ETB:57,     GNF:8600,   MMK:2100,   VND:25000,  IDR:16200,  MNT:3400,
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

/** Refresh rates from open.er-api.com (free, no key). Safe to call on every app open. */
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

/** How many units of `currency` equal 1 USD. */
export function rateFromUSD(currency: string): number {
  return _rates[currency] ?? 1;
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

export type ConvertedPrice = {
  /** Formatted string, e.g. "৳ 1,100" or "$12.50" */
  display: string;
  /** Raw number in the target currency */
  local: number;
  /** ISO 4217 code */
  currency: string;
};

/**
 * Convert a USD amount to a target currency and format it using Intl.
 *
 * @example
 * convertFromUSD(10, 'BDT')  → { display: '৳1,100', local: 1100, currency: 'BDT' }
 * convertFromUSD(10, 'USD')  → { display: '$10.00', local: 10,   currency: 'USD' }
 * convertFromUSD(10, 'JPY')  → { display: '¥1,570', local: 1570, currency: 'JPY' }
 */
export function convertFromUSD(usdAmount: number, targetCurrency: string): ConvertedPrice {
  const rate  = rateFromUSD(targetCurrency);
  const local = usdAmount * rate;
  return {
    display:  formatCurrencyAmount(local, targetCurrency),
    local,
    currency: targetCurrency,
  };
}

/**
 * Convert a local-currency value back to USD for storing in the DB.
 * @example convertToUSD(1100, 'BDT') → ~10.00
 */
export function convertToUSD(localAmount: number, fromCurrency: string): number {
  const rate = rateFromUSD(fromCurrency);
  return rate > 0 ? localAmount / rate : localAmount;
}
