/**
 * Hope Wish — personalised video request service.
 *
 * Backend realities (confirmed by API audit):
 *  • There is NO separate /hope-wish/* endpoint.
 *  • Hope Wish bookings use the same endpoint as premium calls:
 *    POST /api/v1/premium-calls/bookings  with  isHopeWish: true
 *  • Extra wish details (recipient, tone, type, instructions) are serialised
 *    into the callerNote field so the creator sees them when they log in.
 *  • The creator (callee) must have a premium-calls profile with hopeWishPrice set.
 *  • The caller does NOT need to be verified — only the creator does.
 */

import { createBooking, fetchUserPremiumProfile } from './premiumCallService';
export { createWalletTopupCheckout } from './premiumCallService';
export type { BookingResult } from './premiumCallService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WishType =
  | 'happy_birthday'
  | 'anniversary'
  | 'graduation'
  | 'congratulations'
  | 'motivational_message'
  | 'shoutout'
  | 'holiday_greeting'
  | 'get_well_soon';

export type WishTone = 'formal' | 'friendly' | 'casual' | 'funny';

export type WishPronoun = 'he_him' | 'she_her' | 'they_them';

export type VideoLength = 30 | 60 | 90 | 120 | 180;

export type HopeWishFormData = {
  creatorId: string;
  /** 'myself' = buyer's own name/pronouns, 'someone_else' = third-party */
  recipientType: 'myself' | 'someone_else';
  recipientName: string;
  pronouns?: WishPronoun | null;
  wishType: WishType;
  tone: WishTone;
  instructions: string;
  deliveryAt?: string;
  videoLengthSeconds: VideoLength;
  isPublic: boolean;
};

export type HopeWishCreatorInfo = {
  hopeWishPrice: number | null;
  isEnabled: boolean;
  videoLengths: VideoLength[];
};

// ─── Display helpers ──────────────────────────────────────────────────────────

export const WISH_TYPE_LABELS: Record<WishType, string> = {
  happy_birthday: 'Happy Birthday',
  anniversary: 'Anniversary',
  graduation: 'Graduation',
  congratulations: 'Congratulations',
  motivational_message: 'Motivational Message',
  shoutout: 'Shoutout / Fan Message',
  holiday_greeting: 'Holiday Greeting',
  get_well_soon: 'Get Well Soon',
};

export const WISH_TYPE_EMOJI: Record<WishType, string> = {
  happy_birthday: '🎂',
  anniversary: '💑',
  graduation: '🎓',
  congratulations: '🎉',
  motivational_message: '💪',
  shoutout: '📣',
  holiday_greeting: '🎄',
  get_well_soon: '💛',
};

export const TONE_LABELS: Record<WishTone, string> = {
  formal: 'Formal',
  friendly: 'Friendly',
  casual: 'Casual',
  funny: 'Funny',
};

export const PRONOUN_LABELS: Record<WishPronoun, string> = {
  he_him: 'He/Him',
  she_her: 'She/Her',
  they_them: 'They/Them',
};

export const VIDEO_LENGTH_LABELS: Record<VideoLength, string> = {
  30: '30 sec',
  60: '1 min',
  90: '1.5 min',
  120: '2 min',
  180: '3 min',
};

// ─── Format callerNote ────────────────────────────────────────────────────────

/**
 * Serialises the wish form into a structured text that the creator sees in their
 * booking dashboard under "Message from buyer".
 */
export function formatHopeWishNote(data: HopeWishFormData): string {
  const pronoun = data.pronouns ? ` (${PRONOUN_LABELS[data.pronouns]})` : '';
  const lines: string[] = [
    `📹 HOPE WISH REQUEST`,
    `Recipient: ${data.recipientName}${pronoun}`,
    `Type: ${WISH_TYPE_EMOJI[data.wishType]} ${WISH_TYPE_LABELS[data.wishType]}`,
    `Tone: ${TONE_LABELS[data.tone]}`,
    `Video length: ${VIDEO_LENGTH_LABELS[data.videoLengthSeconds]}`,
    `Privacy: ${data.isPublic ? 'Public' : 'Private'}`,
  ];
  if (data.deliveryAt) {
    lines.push(`Deliver by: ${new Date(data.deliveryAt).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })}`);
  }
  lines.push('', `Instructions:`, data.instructions.trim());
  return lines.join('\n');
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Fetches the creator's premium-calls profile to determine if they accept
 * Hope Wishes and what their price is.
 */
export async function fetchCreatorWishInfo(
  creatorId: string,
): Promise<HopeWishCreatorInfo | null> {
  const profile = await fetchUserPremiumProfile(creatorId);
  if (!profile) return null;
  return {
    hopeWishPrice: profile.hopeWishPrice,
    isEnabled: profile.isEnabled,
    videoLengths: [30, 60, 90, 120, 180],
  };
}

/**
 * Submits a Hope Wish booking. Returns a BookingResult so callers can inspect
 * success, generic failure, or insufficient-balance to trigger top-up.
 */
export async function submitHopeWishOrder(
  data: HopeWishFormData,
  token: string,
) {
  return createBooking(
    {
      calleeId: data.creatorId,
      durationMinutes: 0,
      scheduledAt: data.deliveryAt ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      isHopeWish: true,
      callerNote: formatHopeWishNote(data),
    },
    token,
  );
}
