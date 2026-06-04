import { API_BASE_URL } from '../config/env';

export type DaySlot = { start: string; end: string };
export type WeeklySchedule = Partial<Record<
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  DaySlot[]
>>;

export type PremiumCallProfile = {
  isEnabled: boolean;
  anytime: boolean;
  expertise: string[];
  bio: string;
  price5min: number | null;
  price10min: number | null;
  price30min: number | null;
  price60min: number | null;
  hopeWishPrice: number | null;
  weeklySchedule: WeeklySchedule;
  /** IANA timezone of the creator (e.g. "Asia/Dhaka"). Stored so callers can
   *  convert schedule times into their own timezone. */
  timezone?: string | null;
};

export type CallBooking = {
  id: number;
  calleeId: string;
  callerId: string;
  isHopeWish: boolean;
  durationMinutes: number;
  totalAmount: number;
  platformFee: number;
  calleePayout: number;
  status: 'PENDING' | 'CONFIRMED' | 'IN_CALL' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  scheduledAt: string;
  completedAt: string | null;
  chatThreadId: number | null;
  callerNote: string | null;
  noteAccepted: boolean;
  messagingEnabled: boolean;
};

function bearer(token: string) {
  return `Bearer ${token.replace(/^Bearer\s+/i, '').trim()}`;
}

const BASE = `${API_BASE_URL}/api/v1/premium-calls`;

export async function fetchMyPremiumProfile(
  token: string,
): Promise<{ profile: PremiumCallProfile | null; serverError: boolean }> {
  try {
    const res = await fetch(`${BASE}/profile/me`, {
      headers: { Authorization: bearer(token) },
    });
    // 404 = user has no profile yet (new creator) — normal state, no error
    if (res.status === 404) return { profile: null, serverError: false };
    // 500 = backend service is down — flag so the UI can warn the user
    if (res.status >= 500) return { profile: null, serverError: true };
    if (!res.ok) return { profile: null, serverError: false };
    const json = await res.json().catch(() => null);
    const profile = json?.responseObject ?? null;
    return { profile, serverError: false };
  } catch {
    return { profile: null, serverError: false };
  }
}

export async function fetchUserPremiumProfile(userId: string): Promise<PremiumCallProfile | null> {
  try {
    const res = await fetch(`${BASE}/profile/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.responseObject ?? null;
  } catch {
    return null;
  }
}

export async function savePremiumProfile(
  profile: Partial<PremiumCallProfile>,
  token: string,
): Promise<{ ok: boolean; message: string | null; status: number }> {
  try {
    const res = await fetch(`${BASE}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: bearer(token) },
      body: JSON.stringify(profile),
    });
    if (res.ok) return { ok: true, message: null, status: res.status };
    const json = await res.json().catch(() => null);
    const message: string | null =
      (json?.message ?? json?.error ?? null) as string | null;
    return { ok: false, message, status: res.status };
  } catch {
    return { ok: false, message: null, status: 0 };
  }
}

export type BookingResult =
  | { ok: true;  bookingId: number; totalAmount: number }
  | { ok: false; status: number; message: string | null; insufficientBalance: boolean; requiredUSD: number | null };

export async function createBooking(payload: {
  calleeId: string;
  durationMinutes: number;
  scheduledAt: string;
  isHopeWish: boolean;
  callerNote?: string;
  topic?: string;
  agenda?: string;
  callType?: 'single' | 'group';
}, token: string): Promise<BookingResult> {
  try {
    const res = await fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: bearer(token) },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.responseObject) {
      return { ok: true, ...json.responseObject };
    }
    const message: string | null = json?.message ?? null;
    const lower = (message ?? '').toLowerCase();
    const insufficientBalance =
      res.status === 402 ||
      lower.includes('insufficient') ||
      lower.includes('balance') ||
      lower.includes('not enough');
    const requiredUSD: number | null = json?.responseObject?.requiredAmount ?? json?.requiredAmount ?? null;
    return { ok: false, status: res.status, message, insufficientBalance, requiredUSD };
  } catch {
    return { ok: false, status: 0, message: 'Network error', insufficientBalance: false, requiredUSD: null };
  }
}

/** Create a hosted-payment checkout URL to top up the wallet by `amountUSD`. */
export async function createWalletTopupCheckout(amountUSD: number, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE.replace('/premium-calls', '')}/wallet/topup/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: bearer(token) },
      body: JSON.stringify({ amount: amountUSD }),
    });
    const json = await res.json().catch(() => null);
    return json?.responseObject?.checkoutUrl ?? null;
  } catch {
    return null;
  }
}

export async function fetchMyBookings(
  role: 'caller' | 'callee',
  token: string,
): Promise<CallBooking[]> {
  try {
    const res = await fetch(`${BASE}/bookings?role=${role}`, {
      headers: { Authorization: bearer(token) },
    });
    const json = await res.json();
    return json?.responseObject ?? [];
  } catch {
    return [];
  }
}

export async function fetchAvailableSlots(userId: string, date: string): Promise<{
  profile: PremiumCallProfile;
  existingBookings: { scheduledAt: string; durationMinutes: number }[];
} | null> {
  try {
    const res = await fetch(
      `${BASE}/profile/${encodeURIComponent(userId)}/slots/${encodeURIComponent(date)}`,
    );
    const json = await res.json();
    return json?.responseObject ?? null;
  } catch {
    return null;
  }
}

export async function completeBooking(bookingId: number, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/bookings/${bookingId}/complete`, {
      method: 'PATCH',
      headers: { Authorization: bearer(token) },
    });
    return res.ok;
  } catch {
    return false;
  }
}
