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

/** Sync a partial user-settings update to the backend. Fire-and-forget on error. */
export async function patchUserSettings(
  settings: UserSettings,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/api/v2/users/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: bearer(token),
      },
      body: JSON.stringify(settings),
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

/** Submit a report (bug or user issue). */
export async function submitReport(params: {
  category: string;
  description: string;
  conversationId?: string;
  token: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v2/users/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: bearer(params.token),
      },
      body: JSON.stringify({
        category: params.category,
        description: `HopeChat App Report: ${params.description}`,
        conversationId: params.conversationId,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
