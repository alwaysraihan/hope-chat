/**
 * Timezone utilities — global-scale, no third-party library.
 * Uses the Intl API available in every modern JS engine (Hermes / JSC).
 *
 * Design principles
 * ─────────────────
 * 1.  Device timezone (Intl) is the primary source — always accurate.
 * 2.  Country code is a coarse fallback only: many countries span multiple
 *     zones (Russia, USA, Canada, Brazil, Australia, …), so the country →
 *     zone mapping picks the most-populated/capital city zone.
 * 3.  All time arithmetic is done in UTC milliseconds.  Never add offsets to
 *     local wall-clock minutes when month/year boundaries might be crossed.
 */

// ─── Device timezone ──────────────────────────────────────────────────────────

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// ─── Country → timezone fallback ─────────────────────────────────────────────
// One representative IANA timezone per ISO-3166-1 alpha-2 country code.
// Used when the creator saved their profile before timezone tracking was added.

const COUNTRY_TZ: Record<string, string> = {
  AF: 'Asia/Kabul',          AG: 'America/Antigua',
  AL: 'Europe/Tirane',       AM: 'Asia/Yerevan',
  AO: 'Africa/Luanda',       AR: 'America/Argentina/Buenos_Aires',
  AT: 'Europe/Vienna',       AU: 'Australia/Sydney',
  AZ: 'Asia/Baku',           BA: 'Europe/Sarajevo',
  BB: 'America/Barbados',    BD: 'Asia/Dhaka',
  BE: 'Europe/Brussels',     BF: 'Africa/Ouagadougou',
  BG: 'Europe/Sofia',        BH: 'Asia/Bahrain',
  BI: 'Africa/Bujumbura',    BJ: 'Africa/Porto-Novo',
  BN: 'Asia/Brunei',         BO: 'America/La_Paz',
  BR: 'America/Sao_Paulo',   BT: 'Asia/Thimphu',
  BW: 'Africa/Gaborone',     BY: 'Europe/Minsk',
  BZ: 'America/Belize',      CA: 'America/Toronto',
  CD: 'Africa/Kinshasa',     CF: 'Africa/Bangui',
  CG: 'Africa/Brazzaville',  CH: 'Europe/Zurich',
  CI: 'Africa/Abidjan',      CL: 'America/Santiago',
  CM: 'Africa/Douala',       CN: 'Asia/Shanghai',
  CO: 'America/Bogota',      CR: 'America/Costa_Rica',
  CU: 'America/Havana',      CV: 'Atlantic/Cape_Verde',
  CY: 'Asia/Nicosia',        CZ: 'Europe/Prague',
  DE: 'Europe/Berlin',       DJ: 'Africa/Djibouti',
  DK: 'Europe/Copenhagen',   DO: 'America/Santo_Domingo',
  DZ: 'Africa/Algiers',      EC: 'America/Guayaquil',
  EE: 'Europe/Tallinn',      EG: 'Africa/Cairo',
  ER: 'Africa/Asmara',       ES: 'Europe/Madrid',
  ET: 'Africa/Addis_Ababa',  FI: 'Europe/Helsinki',
  FJ: 'Pacific/Fiji',        FR: 'Europe/Paris',
  GA: 'Africa/Libreville',   GB: 'Europe/London',
  GE: 'Asia/Tbilisi',        GH: 'Africa/Accra',
  GM: 'Africa/Banjul',       GN: 'Africa/Conakry',
  GQ: 'Africa/Malabo',       GR: 'Europe/Athens',
  GT: 'America/Guatemala',   GW: 'Africa/Bissau',
  GY: 'America/Guyana',      HN: 'America/Tegucigalpa',
  HR: 'Europe/Zagreb',       HT: 'America/Port-au-Prince',
  HU: 'Europe/Budapest',     ID: 'Asia/Jakarta',
  IE: 'Europe/Dublin',       IL: 'Asia/Jerusalem',
  IN: 'Asia/Kolkata',        IQ: 'Asia/Baghdad',
  IR: 'Asia/Tehran',         IS: 'Atlantic/Reykjavik',
  IT: 'Europe/Rome',         JM: 'America/Jamaica',
  JO: 'Asia/Amman',          JP: 'Asia/Tokyo',
  KE: 'Africa/Nairobi',      KG: 'Asia/Bishkek',
  KH: 'Asia/Phnom_Penh',     KI: 'Pacific/Tarawa',
  KM: 'Indian/Comoro',       KP: 'Asia/Pyongyang',
  KR: 'Asia/Seoul',          KW: 'Asia/Kuwait',
  KZ: 'Asia/Almaty',         LA: 'Asia/Vientiane',
  LB: 'Asia/Beirut',         LI: 'Europe/Vaduz',
  LK: 'Asia/Colombo',        LR: 'Africa/Monrovia',
  LS: 'Africa/Maseru',       LT: 'Europe/Vilnius',
  LU: 'Europe/Luxembourg',   LV: 'Europe/Riga',
  LY: 'Africa/Tripoli',      MA: 'Africa/Casablanca',
  MC: 'Europe/Monaco',       MD: 'Europe/Chisinau',
  ME: 'Europe/Podgorica',    MG: 'Indian/Antananarivo',
  MK: 'Europe/Skopje',       ML: 'Africa/Bamako',
  MM: 'Asia/Rangoon',        MN: 'Asia/Ulaanbaatar',
  MR: 'Africa/Nouakchott',   MT: 'Europe/Malta',
  MU: 'Indian/Mauritius',    MV: 'Indian/Maldives',
  MW: 'Africa/Blantyre',     MX: 'America/Mexico_City',
  MY: 'Asia/Kuala_Lumpur',   MZ: 'Africa/Maputo',
  NA: 'Africa/Windhoek',     NE: 'Africa/Niamey',
  NG: 'Africa/Lagos',        NI: 'America/Managua',
  NL: 'Europe/Amsterdam',    NO: 'Europe/Oslo',
  NP: 'Asia/Kathmandu',      NR: 'Pacific/Nauru',
  NZ: 'Pacific/Auckland',    OM: 'Asia/Muscat',
  PA: 'America/Panama',      PE: 'America/Lima',
  PG: 'Pacific/Port_Moresby',PH: 'Asia/Manila',
  PK: 'Asia/Karachi',        PL: 'Europe/Warsaw',
  PT: 'Europe/Lisbon',       PW: 'Pacific/Palau',
  PY: 'America/Asuncion',    QA: 'Asia/Qatar',
  RO: 'Europe/Bucharest',    RS: 'Europe/Belgrade',
  RU: 'Europe/Moscow',       RW: 'Africa/Kigali',
  SA: 'Asia/Riyadh',         SB: 'Pacific/Guadalcanal',
  SC: 'Indian/Mahe',         SD: 'Africa/Khartoum',
  SE: 'Europe/Stockholm',    SG: 'Asia/Singapore',
  SI: 'Europe/Ljubljana',    SK: 'Europe/Bratislava',
  SL: 'Africa/Freetown',     SM: 'Europe/San_Marino',
  SN: 'Africa/Dakar',        SO: 'Africa/Mogadishu',
  SR: 'America/Paramaribo',  SS: 'Africa/Juba',
  ST: 'Africa/Sao_Tome',     SV: 'America/El_Salvador',
  SY: 'Asia/Damascus',       SZ: 'Africa/Mbabane',
  TD: 'Africa/Ndjamena',     TG: 'Africa/Lome',
  TH: 'Asia/Bangkok',        TJ: 'Asia/Dushanbe',
  TL: 'Asia/Dili',           TM: 'Asia/Ashgabat',
  TN: 'Africa/Tunis',        TO: 'Pacific/Tongatapu',
  TR: 'Europe/Istanbul',     TT: 'America/Port_of_Spain',
  TV: 'Pacific/Funafuti',    TZ: 'Africa/Dar_es_Salaam',
  UA: 'Europe/Kiev',         UG: 'Africa/Kampala',
  US: 'America/New_York',    UY: 'America/Montevideo',
  UZ: 'Asia/Tashkent',       VA: 'Europe/Vatican',
  VC: 'America/St_Vincent',  VE: 'America/Caracas',
  VN: 'Asia/Ho_Chi_Minh',    VU: 'Pacific/Efate',
  WS: 'Pacific/Apia',        YE: 'Asia/Aden',
  ZA: 'Africa/Johannesburg', ZM: 'Africa/Lusaka',
  ZW: 'Africa/Harare',
};

/** Best-effort timezone from a 2-letter country code. Returns 'UTC' when unknown. */
export function timezoneFromCountry(countryCode: string | null | undefined): string {
  if (!countryCode) return 'UTC';
  return COUNTRY_TZ[countryCode.toUpperCase()] ?? 'UTC';
}

// ─── UTC offset (corrected for all month/year boundaries) ────────────────────

/**
 * UTC offset in minutes for a timezone at a given instant.
 *
 * Works at every date including month/year boundaries because we compute only
 * the hour+minute part and detect the day-crossing direction from the sign.
 *
 * Examples: Asia/Dhaka → +360, America/New_York (EDT) → -240, UTC → 0
 */
export function getUTCOffsetMinutes(tz: string, date: Date = new Date()): number {
  try {
    const opts: Intl.DateTimeFormatOptions = {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hourCycle: 'h23',
    };
    const g = (parts: Intl.DateTimeFormatPart[], t: Intl.DateTimeFormatPartTypes) =>
      parseInt(parts.find(p => p.type === t)?.value ?? '0', 10);

    const tzParts  = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz    }).formatToParts(date);
    const utcParts = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).formatToParts(date);

    // HH:MM diff (ignoring day)
    let diff =
      (g(tzParts, 'hour') * 60 + g(tzParts, 'minute')) -
      (g(utcParts,'hour') * 60 + g(utcParts,'minute'));

    // If the calendar day differs, we're crossing midnight.
    // Timezone offsets are bounded by ±14 h = ±840 min, so exactly one ±1440
    // adjustment restores the true offset.
    if (g(tzParts, 'day') !== g(utcParts, 'day')) {
      if (diff >  0) diff -= 1440;  // tz is ahead BUT on next day → behind  e.g. UTC-12
      else           diff += 1440;  // tz is behind BUT on prev day → ahead   e.g. UTC+14
    }

    return diff;
  } catch {
    return 0;
  }
}

// ─── True local midnight in UTC ───────────────────────────────────────────────

/**
 * Returns the UTC timestamp (ms) for 00:00:00.000 on the date that `date`
 * falls on when viewed in `tz`.
 *
 * e.g. for Asia/Dhaka (UTC+6) on 2026-06-10, this returns the ms for
 *      2026-06-09T18:00:00Z (= midnight Dhaka on June 10).
 *
 * Using noon as the probe avoids DST transitions that typically occur at 02:00.
 */
export function getLocalMidnightAsUTC(date: Date, tz: string): number {
  try {
    // 1. Determine which calendar date it is in tz
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const g = (t: Intl.DateTimeFormatPartTypes) =>
      parseInt(parts.find(p => p.type === t)?.value ?? '0', 10);
    const y = g('year');
    const mo = g('month') - 1;   // 0-based
    const d = g('day');

    // 2. Probe at noon UTC on that calendar date to get the day's standard offset
    const noonProbeMs = Date.UTC(y, mo, d, 12, 0, 0, 0);
    const offsetMins  = getUTCOffsetMinutes(tz, new Date(noonProbeMs));

    // 3. True midnight UTC = naive midnight UTC − offset
    const naiveMidnightMs = Date.UTC(y, mo, d, 0, 0, 0, 0);
    return naiveMidnightMs - offsetMins * 60_000;
  } catch {
    // Fallback: treat date as UTC
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }
}

// ─── Human-readable label ─────────────────────────────────────────────────────

/** "Asia/Dhaka" → "Dhaka (UTC+6)"  |  "America/New_York" → "New York (UTC-4)" */
export function formatTimezoneLabel(tz: string, date: Date = new Date()): string {
  try {
    const offsetMin = getUTCOffsetMinutes(tz, date);
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs  = Math.abs(offsetMin);
    const h    = Math.floor(abs / 60);
    const m    = abs % 60;
    const offset = m === 0
      ? `UTC${sign}${h}`
      : `UTC${sign}${h}:${String(m).padStart(2, '0')}`;
    const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
    return `${city} (${offset})`;
  } catch {
    return tz;
  }
}

// ─── HH:MM conversion (display only) ─────────────────────────────────────────

/** Convert "HH:MM" from one timezone to another for a reference date.
 *  Use only for display; booking logic uses UTC ms directly. */
export function convertHHMM(
  hhmm: string,
  fromTz: string,
  toTz: string,
  referenceDate: Date = new Date(),
): { hhmm: string; dayOffset: -1 | 0 | 1 } {
  try {
    const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
    const fromOffset = getUTCOffsetMinutes(fromTz, referenceDate);
    const toOffset   = getUTCOffsetMinutes(toTz,   referenceDate);
    const totalMins  = h * 60 + m;
    const utcMins    = totalMins - fromOffset;
    const viewerMins = utcMins   + toOffset;
    const dayOffset: -1 | 0 | 1 =
      viewerMins < 0     ? -1 :
      viewerMins >= 1440 ?  1 : 0;
    const norm = ((viewerMins % 1440) + 1440) % 1440;
    return {
      hhmm: `${String(Math.floor(norm / 60)).padStart(2, '0')}:${String(norm % 60).padStart(2, '0')}`,
      dayOffset,
    };
  } catch {
    return { hhmm, dayOffset: 0 };
  }
}

// ─── Weekday lookup in a timezone ────────────────────────────────────────────

const WEEKDAY_KEYS = [
  'sunday','monday','tuesday','wednesday','thursday','friday','saturday',
] as const;
type WeekdayKey = typeof WEEKDAY_KEYS[number];

/** Weekday key ('monday'…) for a Date as seen in a specific timezone. */
export function getWeekdayInTimezone(date: Date, tz: string): WeekdayKey {
  try {
    const name = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'long',
    }).format(date).toLowerCase();
    return (WEEKDAY_KEYS.find(k => k === name) ?? WEEKDAY_KEYS[date.getDay()]);
  } catch {
    return WEEKDAY_KEYS[date.getDay()];
  }
}

export type { WeekdayKey };
