/**
 * Hopenity friends list — backs the "Friends" filter on the chat list.
 *
 * Same backend as the rest of the app (donations, premium-calls). The row shape
 * varies by endpoint version: some builds nest the person under `user`, some
 * return them flat, and the id arrives as `user_id`, `userId` or `id` — so
 * normalise defensively rather than trusting one shape.
 */

import { API_BASE_URL } from '../config/env';

export type HopenityFriend = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  username?: string;
};

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function normalizeFriend(raw: Record<string, unknown>): HopenityFriend | null {
  const nested = (raw.user ?? {}) as Record<string, unknown>;
  const src = { ...nested, ...raw };

  const userId = pickString(src.user_id, src.userId, src.id);
  if (!userId) return null;

  const name =
    pickString(
      src.full_name,
      src.fullName,
      src.display_name,
      src.displayName,
      src.name,
      src.username,
    ) ?? 'Friend';

  return {
    userId,
    name,
    // The live payload nests the person under `user` and names the avatar
    // `image` — not profile_photo. Keep the other spellings for older shapes.
    avatarUrl:
      pickString(
        src.image,
        src.profile_photo,
        src.profilePhoto,
        src.avatar,
        src.avatarUrl,
      ) ?? null,
    username: pickString(src.username),
  };
}

export type FriendsPage = {
  friends: HopenityFriend[];
  /** Server total when it reports one — lets the caller stop paging. */
  total?: number;
};

export async function fetchMyFriends(
  currentUserId: string,
  token: string | null,
  params?: { limit?: number; offset?: number },
): Promise<FriendsPage> {
  if (!currentUserId) return { friends: [] };

  const sp = new URLSearchParams({ userId: String(currentUserId) });
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/friendships/friends?${sp.toString()}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
    );
    if (!res.ok) return { friends: [] };

    const json = await res.json();
    const payload = json?.responseObject ?? json;
    const rows: unknown = Array.isArray(payload?.friends)
      ? payload.friends
      : Array.isArray(payload)
        ? payload
        : [];

    if (!Array.isArray(rows)) return { friends: [] };

    return {
      friends: rows
        .map(r => normalizeFriend((r ?? {}) as Record<string, unknown>))
        .filter((f): f is HopenityFriend => f != null),
      total: typeof payload?.total === 'number' ? payload.total : undefined,
    };
  } catch {
    return { friends: [] };
  }
}
