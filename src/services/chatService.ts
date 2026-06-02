import { API_BASE_URL } from '../config/env';

// v2/chats returns both DMs and group chats; v1/chats returns DMs only.
const CHAT_LIST_ENDPOINT = '/api/v2/chats';
const V1_CHAT_LIST_ENDPOINT = '/api/v1/chats';

export type HopenityChatItem = {
  id?: string | number;
  /** Some API builds expose peer presence on the chat row */
  peerOnline?: boolean;
  isPeerOnline?: boolean;
  peerLastSeen?: string | number | null;
  lastSeen?: string | number | null;
  last_seen?: string | number | null;
  userAId?: string;
  userAProfileType?: 'USER' | 'PAGE';
  userBProfileType?: 'USER' | 'PAGE';
  userA?: {
    user_id?: string;
    name?: string;
    image?: string | null;
    isOnline?: boolean;
    online?: boolean;
    lastSeen?: string | number | null;
    last_seen?: string | number | null;
    lastActiveAt?: string | number | null;
    peerHasActiveStory?: boolean;
    peer_has_active_story?: boolean;
    hasActiveStory?: boolean;
    has_active_story?: boolean;
    peerStoryCount?: number;
    peer_story_count?: number;
    unviewedStoryCount?: number;
    unviewed_story_count?: number;
  };
  userAPage?: { name?: string; image?: string | null } | null;
  userBId?: string;
  userB?: {
    user_id?: string;
    name?: string;
    image?: string | null;
    isOnline?: boolean;
    online?: boolean;
    lastSeen?: string | number | null;
    last_seen?: string | number | null;
    lastActiveAt?: string | number | null;
    peerHasActiveStory?: boolean;
    peer_has_active_story?: boolean;
    hasActiveStory?: boolean;
    has_active_story?: boolean;
    peerStoryCount?: number;
    peer_story_count?: number;
    unviewedStoryCount?: number;
    unviewed_story_count?: number;
  };
  userBPage?: { name?: string; image?: string | null } | null;
  /** True when this is a group chat (≥ 2 participants other than self). */
  isGroup?: boolean;
  groupName?: string | null;
  groupPhotoUrl?: string | null;
  groupAdminUserIds?: string[];
  createdByUserId?: string | null;
  participants?: Array<{
    user_id?: string;
    name?: string;
    image?: string | null;
    isOnline?: boolean;
    online?: boolean;
    lastSeen?: string | number | null;
    last_seen?: string | number | null;
    lastActiveAt?: string | number | null;
    isAdmin?: boolean;
    peerHasActiveStory?: boolean;
    peer_has_active_story?: boolean;
    hasActiveStory?: boolean;
    has_active_story?: boolean;
    peerStoryCount?: number;
    peer_story_count?: number;
    unviewedStoryCount?: number;
    unviewed_story_count?: number;
  }>;
  /** Backend: include `messageType`, `metadata`, durations, `missed`, `callKind` for call/voice rows. */
  lastMessage?: {
    content?: string;
    createdAt?: string;
    created_at?: string;
    senderId?: string;
    messageType?: string;
    type?: string;
    kind?: string;
    duration?: number;
    durationSeconds?: number;
    talkingTime?: number;
    talkingTimeSeconds?: number;
    callDurationSeconds?: number;
    missed?: boolean;
    callKind?: 'audio' | 'video' | string;
    metadata?: Record<string, unknown>;
  };
  /** Latest message when included from list endpoint (desc order, first = newest) */
  messages?: Array<{
    content?: string;
    createdAt?: string;
    created_at?: string;
    senderId?: string;
    messageType?: string;
    type?: string;
    kind?: string;
    duration?: number;
    durationSeconds?: number;
    talkingTime?: number;
    talkingTimeSeconds?: number;
    callDurationSeconds?: number;
    missed?: boolean;
    callKind?: 'audio' | 'video' | string;
    metadata?: Record<string, unknown>;
  }>;
  unreadCount?: number;
  status?: string;
  requestedById?: string | null;
  /** Present on v1 1-to-1 chats only — use this to distinguish v1 vs v2 native chats. */
  conversationKey?: string | null;
  /** When true, peer has at least one active story (home strip + Story viewer). */
  peerHasActiveStory?: boolean;
  peer_has_active_story?: boolean;
  hasActiveStory?: boolean;
  has_active_story?: boolean;
  peerStoryCount?: number;
  peer_story_count?: number;
  unviewedStoryCount?: number;
  unviewed_story_count?: number;
  peerUnviewedStoryCount?: number;
  /** Optional: server-driven chat UI — client merges into theme / reactions when present. */
  chatTheme?: {
    wallpaperUrl?: string | null;
    themePresetId?: number;
    reactionEmojiPalette?: string[];
    accentHex?: string | null;
  };
};

export type HopenityChatDirectoryCounts = {
  requested: number;
  blocked: number;
  inbox: number;
  total: number;
};

export type HopenityChatListEnvelope = {
  chats: HopenityChatItem[];
  pagination?: { hasMore: boolean; nextOffset: number };
  counts?: HopenityChatDirectoryCounts;
  /** Present when this envelope was built from an HTTP response (e.g. 401 handling). */
  httpStatus?: number;
};

function unwrapChatListPayload(raw: unknown): HopenityChatListEnvelope | HopenityChatItem[] {
  if (raw == null) {
    return { chats: [] };
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'object' && raw !== null && Array.isArray((raw as HopenityChatListEnvelope).chats)) {
    return raw as HopenityChatListEnvelope;
  }
  return { chats: [] };
}

/**
 * Fetch v1 chat list — returns raw chats array (includes all ACTIVE/REQUESTED v1 chats).
 * Used internally to supplement the v2 chat directory with contacts from older threads.
 *
 * The v1 endpoint returns `responseObject` as either an Array or a plain object
 * with numeric keys (e.g. {0: chat, 1: chat, ...}). Both forms are handled.
 */
async function fetchV1ChatList(token: string): Promise<HopenityChatItem[]> {
  try {
    const url = `${API_BASE_URL}${V1_CHAT_LIST_ENDPOINT}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    const raw = json?.responseObject ?? json?.data ?? json;

    // The v1 endpoint returns either an array or a numeric-keyed object.
    // Normalise both forms to a plain array.
    let list: HopenityChatItem[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (raw && typeof raw === 'object') {
      // Could be { chats: [...] } or { 0: chat, 1: chat, ... }
      if (Array.isArray(raw.chats)) {
        list = raw.chats;
      } else {
        // numeric-keyed object — Object.values() produces the array
        const vals = Object.values(raw) as HopenityChatItem[];
        if (vals.length > 0 && typeof vals[0] === 'object' && vals[0] !== null) {
          list = vals;
        }
      }
    }
    return list;
  } catch {
    return [];
  }
}

/**
 * Full chat directory response (includes folder counts when using offset/limit/status).
 *
 * Merges v1 legacy chats into the v2 response for the inbox view so the mobile
 * client sees all accepted contacts — especially for the group-creation contacts
 * picker (NewGroupScreen). v1 chats that already appear in v2 (same peer) are
 * de-duplicated by peerUserId.
 */
export async function fetchHopenityChatDirectory(
  token?: string | null,
  params?: { offset?: number; limit?: number; status?: 'inbox' | 'requested' | 'blocked'; pageId?: number },
): Promise<HopenityChatListEnvelope> {
  const searchParams = new URLSearchParams();
  if (params?.offset != null) searchParams.set('offset', String(params.offset));
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.pageId != null) searchParams.set('pageId', String(params.pageId));
  const url = `${API_BASE_URL}${CHAT_LIST_ENDPOINT}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  const httpStatus = response.status;
  const json = await response.json().catch(() => null);
  const raw = json?.responseObject ?? json?.data ?? json;
  const unwrapped = unwrapChatListPayload(raw);

  let base: HopenityChatListEnvelope;
  if (Array.isArray(unwrapped)) {
    base = { chats: unwrapped, httpStatus };
  } else {
    base = { ...unwrapped, httpStatus };
  }

  // Merge v1 chats when fetching inbox (first page only).
  // This fills the contacts list for NewGroupScreen and ensures all accepted
  // conversations appear in the chat directory even before v2 migration.
  const wantInbox = !params?.status || params.status === 'inbox';
  const wantRequested = params?.status === 'requested';
  if (token && (wantInbox || wantRequested) && (params?.offset ?? 0) === 0) {
    try {
      const v1Chats = await fetchV1ChatList(token);

      // Build a set of IDs already in v2 result (deduplicate by chat id + peer ids).
      const v2ChatIds = new Set<string>(base.chats.map(c => String(c.id ?? '')));
      const v2PeerIds = new Set<string>(
        base.chats.flatMap(c => {
          if (c.participants?.length) return [];
          const ids: string[] = [];
          if (c.userAId) ids.push(c.userAId);
          if (c.userBId) ids.push(c.userBId);
          return ids;
        }),
      );

      const v1Only = v1Chats.filter(c => {
        const matchesStatus = wantRequested ? c.status === 'REQUESTED' : c.status === 'ACTIVE';
        if (!matchesStatus) return false;
        // Always deduplicate by chat ID
        if (v2ChatIds.has(String(c.id ?? ''))) return false;
        const peerA = c.userAId;
        const peerB = c.userBId;
        if (!peerA || !peerB) return false;
        // For REQUESTED mode: skip peer-ID dedup — v2PeerIds includes the local
        // user's ID (they appear in every v2 chat), which would incorrectly filter
        // out all v1 chats. ID-based dedup above is sufficient since v1/v2 use
        // different ID spaces.
        if (wantRequested) return true;
        return !v2PeerIds.has(peerA) && !v2PeerIds.has(peerB);
      });

      if (v1Only.length > 0) {
        const merged = [...base.chats, ...v1Only];
        // Sort merged list newest-first so v2 groups and v1 DMs interleave correctly.
        merged.sort((a, b) => {
          const ta = new Date(
            (a as any).updatedAt ?? (a as any).updated_at ?? (a.lastMessage as any)?.createdAt ?? 0,
          ).getTime();
          const tb = new Date(
            (b as any).updatedAt ?? (b as any).updated_at ?? (b.lastMessage as any)?.createdAt ?? 0,
          ).getTime();
          return tb - ta;
        });
        base = { ...base, chats: merged };
      }
    } catch {
      // v1 merge is best-effort — never block the main response
    }
  }

  return base;
}

/**
 * Lightweight check that the bearer token is accepted by the same API used for chats.
 * Call from the login screen **before** promoting Redux session to avoid Home → 401 → logout flash.
 */
export async function validateHopeChatAccessToken(
  token: string,
): Promise<'valid' | 'unauthorized' | 'unavailable'> {
  const trimmed = typeof token === 'string' ? token.trim() : '';
  if (!trimmed) return 'unauthorized';
  try {
    const dir = await fetchHopenityChatDirectory(trimmed, {
      limit: 1,
      offset: 0,
      status: 'inbox',
    });
    const st = dir.httpStatus ?? 200;
    if (st === 401 || st === 403) return 'unauthorized';
    if (st >= 400) return 'unavailable';
    return 'valid';
  } catch {
    return 'unavailable';
  }
}

export async function fetchHopenityChatList(
  token?: string | null,
  params?: { offset?: number; limit?: number; status?: string },
): Promise<HopenityChatItem[]> {
  const dir = await fetchHopenityChatDirectory(token, {
    offset: params?.offset,
    limit: params?.limit,
    status: params?.status as 'inbox' | 'requested' | 'blocked' | undefined,
  });
  return dir.chats;
}

export type HopenityChatMessage = {
  id?: number | string;
  content?: string;
  createdAt?: string;
  created_at?: string;
  senderId?: string;
  sender?: { user_id?: string; name?: string; image?: string | null };
  read?: boolean;
  viewerRead?: boolean;
  recipientRead?: boolean;
  readAt?: string;
  deliveredAt?: string;
  delivered?: boolean;
  /** sent | delivered | read — align with your receipts API */
  deliveryStatus?: string;
  status?: string;
  messageType?: string;
  type?: string;
  kind?: string;
  duration?: number;
  durationSeconds?: number;
  talkingTime?: number;
  talkingTimeSeconds?: number;
  callDurationSeconds?: number;
  missed?: boolean;
  callKind?: 'audio' | 'video' | string;
  metadata?: Record<string, unknown>;
  deletedAt?: string | null;
};

export type HopenityChatMessagesPage = {
  messages: HopenityChatMessage[];
  pagination: {
    hasMore: boolean;
    nextBefore: number | null;
  } | null;
};

function unwrapChatMessagesEnvelope(json: unknown): HopenityChatMessagesPage {
  if (!json || typeof json !== 'object') return { messages: [], pagination: null };
  const body = json as { responseObject?: unknown; data?: unknown };
  const envelope = body.responseObject ?? body.data;
  const payload = envelope ?? json;

  if (Array.isArray(payload)) {
    return { messages: payload as HopenityChatMessage[], pagination: null };
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'messages' in payload &&
    Array.isArray((payload as HopenityChatMessagesPage).messages)
  ) {
    const p = payload as HopenityChatMessagesPage;
    return {
      messages: p.messages,
      pagination: p.pagination ?? null,
    };
  }

  return { messages: [], pagination: null };
}

/**
 * POST /api/v1/chats — get or create a 1-to-1 conversation with targetUserId.
 * Returns the real conversation ID, or null on failure.
 */
export async function getOrCreatePeerChat(
  targetUserId: string,
  token: string,
): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUserId }),
    });
    const json = await response.json().catch(() => null);
    const raw = json?.responseObject ?? json?.data ?? json;
    const id = raw?.id ?? raw?.chatId ?? raw?.conversation_id;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
}

/** Loads messages; unwraps `{ messages, pagination }` from `responseObject`. */
export async function fetchHopenityChatMessages(
  chatId: string | number,
  token?: string | null,
  params?: { limit?: number; before?: number | string; isGroup?: boolean },
): Promise<HopenityChatMessagesPage> {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  if (params?.before != null) searchParams.set('before', String(params.before));
  const query = searchParams.toString();
  // Group chats are created via v2/groups and have v2 IDs — v1 returns 403 for them.
  const apiVersion = params?.isGroup ? 'v2' : 'v1';
  const url = `${API_BASE_URL}/api/${apiVersion}/chats/${chatId}/messages${query ? `?${query}` : ''}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  const json = await response.json().catch(() => null);
  return unwrapChatMessagesEnvelope(json);
}

/** Mark inbound messages read (server PATCH). */
export async function markHopenityChatRead(
  chatId: string | number,
  token?: string | null,
): Promise<boolean> {
  if (!token) return false;
  const url = `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(String(chatId))}/read`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  return response.ok;
}

export async function acceptHopenityChatRequest(
  chatId: string | number,
  token?: string | null,
): Promise<boolean> {
  if (!token) return false;
  const url = `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(String(chatId))}/request/accept`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return response.ok;
}

export async function sendHopenityChatMessage(
  chatId: string | number,
  content: string,
  token?: string | null,
  senderPageId?: string | null,
  isGroup?: boolean,
): Promise<HopenityChatMessage | null> {
  if (!content || !token) return null;

  // Group chats are v2 entities — v1 returns 403 for them.
  const apiVersion = isGroup ? 'v2' : 'v1';
  const url = `${API_BASE_URL}/api/${apiVersion}/chats/${chatId}/messages`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const body: Record<string, unknown> = { content };
  if (senderPageId) body.senderPageId = senderPageId;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  const raw = json?.responseObject ?? json?.data ?? json;
  return typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
}

function getUploadMimeType(mediaType: 'image' | 'video' | 'voice'): string {
  switch (mediaType) {
    case 'image':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'voice':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
}

function getUploadFileName(uri: string, mediaType: 'image' | 'video' | 'voice'): string {
  const parts = uri.split('/');
  const candidate = parts.pop() ?? '';
  if (candidate.includes('.')) return candidate;
  if (mediaType === 'image') return `upload-${Date.now()}.jpg`;
  if (mediaType === 'video') return `upload-${Date.now()}.mp4`;
  return `upload-${Date.now()}.dat`;
}

export async function uploadChatMedia(
  localUri: string,
  mediaType: 'image' | 'video' | 'voice',
  token?: string | null,
): Promise<string | null> {
  if (!localUri || !token) return null;

  const url = `${API_BASE_URL}/api/v1/upload`;
  const fileName = getUploadFileName(localUri, mediaType);
  const mimeType = getUploadMimeType(mediaType);

  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    type: mimeType,
    name: fileName,
  } as any);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  const json = await response.json().catch(() => null);
  const raw = json?.responseObject ?? json?.data ?? json;
  const urlValue = raw?.url ?? raw?.responseObject?.url ?? raw?.data?.url;
  return typeof urlValue === 'string' ? urlValue : null;
}

export async function blockHopeChatUser(
  chatId: string | number,
  token?: string | null,
): Promise<boolean> {
  if (!token) return false;
  const url = `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(String(chatId))}/block`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return response.ok;
}

export async function unblockHopeChatUser(
  chatId: string | number,
  token?: string | null,
): Promise<boolean> {
  if (!token) return false;
  const url = `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(String(chatId))}/unblock`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return response.ok;
}

export function formatChatTime(timestamp?: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
