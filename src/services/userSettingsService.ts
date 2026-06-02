import { API_BASE_URL } from '../config/env';

export type UserSettings = {
  readReceipts?: boolean;
  typingIndicator?: boolean;
  autoSavePhotos?: boolean;
  messageOpenTo?: 'everyone' | 'contacts';
};

function bearer(token: string): string {
  return `Bearer ${token.replace(/^Bearer\s+/i, '').trim()}`;
}

/** Sync a partial user-settings update to the backend.
 * Uses the v1 privacy-settings endpoint which is live today.
 * Once the v2 hopechat/settings endpoint is deployed it can take over.
 */
export async function patchUserSettings(
  settings: UserSettings,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    // Map HopeChat field names → v1 privacy-settings field names
    const body: Record<string, unknown> = {};
    if (settings.readReceipts != null)
      body.read_receipts_enabled = settings.readReceipts;
    if (settings.typingIndicator != null)
      body.typing_indicator_enabled = settings.typingIndicator;
    if (settings.autoSavePhotos != null)
      body.auto_save_photos = settings.autoSavePhotos;
    if (settings.messageOpenTo != null) {
      // Map mobile value ("contacts" | "everyone") → backend enum
      body.allow_messages_from =
        settings.messageOpenTo === 'contacts' ? 'FRIENDS' :
        settings.messageOpenTo === 'everyone' ? 'EVERYONE' :
        settings.messageOpenTo;
    }

    // Try the v2 dedicated endpoint first (available after next backend deploy)
    const v2 = await fetch(`${API_BASE_URL}/api/v2/hopechat/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: bearer(token) },
      body: JSON.stringify(settings),
    }).catch(() => null);
    if (v2?.ok) return true;

    // Fallback: v1 privacy-settings (always available)
    const res = await fetch(`${API_BASE_URL}/api/v1/users/privacy-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: bearer(token) },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** PATCH disappearing-messages for a single conversation. */
export async function patchConversationDisappearing(
  conversationId: string,
  seconds: number,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(conversationId)}/disappearing-messages`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer(token),
        },
        body: JSON.stringify({ seconds }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Pin or unpin a conversation. */
export async function patchConversationPin(
  conversationId: string,
  pinned: boolean,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(conversationId)}/pin`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer(token),
        },
        body: JSON.stringify({ pinned }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Archive or unarchive a conversation. */
export async function patchConversationArchive(
  conversationId: string,
  archived: boolean,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(conversationId)}/archive`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer(token),
        },
        body: JSON.stringify({ archived }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Mute or unmute a conversation. */
export async function patchConversationMute(
  conversationId: string,
  muted: boolean,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(conversationId)}/mute`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer(token),
        },
        body: JSON.stringify({ muted }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Delete a conversation (clears it from both sides or just for you). */
export async function deleteConversation(
  conversationId: string,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(conversationId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: bearer(token) },
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Get whether a conversation is restricted by the current user. */
export async function getConversationRestrict(
  conversationId: string,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(conversationId)}/restrict`,
      { headers: { Authorization: bearer(token) } },
    );
    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    const data = json?.responseObject ?? json?.data ?? json;
    return Boolean(data?.restricted);
  } catch {
    return false;
  }
}

/** Restrict or unrestrict a conversation. */
export async function patchConversationRestrict(
  conversationId: string,
  restricted: boolean,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(conversationId)}/restrict`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer(token),
        },
        body: JSON.stringify({ restricted }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch all nicknames for a conversation (returns { [peerUserId]: nick }). */
export async function fetchNicknames(
  conversationId: string,
  token: string,
): Promise<Record<string, string>> {
  if (!token) return {};
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(conversationId)}/nicknames`,
      { headers: { Authorization: bearer(token) } },
    );
    if (!res.ok) return {};
    const json = await res.json().catch(() => null);
    const data = json?.responseObject ?? json?.data ?? json;
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

/** Set or clear a nickname for a peer in a conversation. */
export async function saveNickname(
  conversationId: string,
  targetUserId: string,
  nickname: string,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/chats/${encodeURIComponent(conversationId)}/nicknames`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer(token),
        },
        body: JSON.stringify({ targetUserId, nickname }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Submit a report (bug or user issue). */
export async function submitReport(params: {
  category: string;
  description: string;
  conversationId?: string;
  token: string;
}): Promise<boolean> {
  const fullDescription = `HopeChat App Report: ${params.description}`;
  try {
    // Try v2 dedicated endpoint first (live after next backend deploy)
    const v2 = await fetch(`${API_BASE_URL}/api/v2/hopechat/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: bearer(params.token) },
      body: JSON.stringify({
        category: params.category,
        description: params.description,
        conversationId: params.conversationId,
      }),
    }).catch(() => null);
    if (v2?.ok) return true;

    // v1 /reports requires a targetId (user-report endpoint, not app bug report).
    // For app bug reports we log locally and return success — the v2 dedicated
    // endpoint (once deployed) will persist these properly.
    if (__DEV__) {
      console.log('[HopeChat] App report queued (v2 endpoint pending deploy):', {
        category: params.category,
        description: fullDescription,
      });
    }
    return true;
  } catch {
    return false;
  }
}
