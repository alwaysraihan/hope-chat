import { API_BASE_URL } from '../config/env';

function bearer(token: string): string {
  return `Bearer ${token.replace(/^Bearer\s+/i, '').trim()}`;
}

export type GroupMember = {
  userId: string;
  name?: string;
  image?: string | null;
  isAdmin?: boolean;
  joinedAt?: string;
};

export type GroupInfo = {
  id: string;
  name: string;
  photoUrl?: string | null;
  members: GroupMember[];
  createdBy?: string;
  createdAt?: string;
};

export type CreateGroupResult = {
  groupId: string;
  conversationId: string;
} | null;

function normalizeGroupInfo(raw: Record<string, unknown>): GroupInfo {
  const rawMembers = (raw.members ?? raw.participants ?? []) as Record<string, unknown>[];
  const members: GroupMember[] = rawMembers.map(m => ({
    userId: String(m.userId ?? m.user_id ?? m.id ?? ''),
    name: (m.name ?? m.displayName) as string | undefined,
    image: (m.image ?? m.photo ?? m.avatar ?? null) as string | null | undefined,
    isAdmin: (m.isAdmin ?? (m.role === 'admin')) as boolean | undefined,
    joinedAt: (m.joinedAt ?? m.joined_at) as string | undefined,
  }));
  return {
    id: String(raw.id),
    name: (raw.name ?? raw.groupName ?? '') as string,
    photoUrl: (raw.photoUrl ?? raw.photo ?? raw.image ?? null) as string | null | undefined,
    members,
    createdBy: (raw.createdBy ?? raw.created_by) as string | undefined,
    createdAt: (raw.createdAt ?? raw.created_at) as string | undefined,
  };
}

export async function createGroup(
  name: string,
  memberUserIds: string[],
  token: string,
): Promise<CreateGroupResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v2/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: bearer(token),
      },
      body: JSON.stringify({ name, memberUserIds }),
    });
    const json = await res.json().catch(() => null);
    const raw = json?.responseObject ?? json?.data ?? json;
    const groupId = raw?.id ?? raw?.groupId;
    const conversationId = raw?.conversationId ?? raw?.chatId ?? raw?.id;
    if (!groupId) return null;
    return { groupId: String(groupId), conversationId: String(conversationId) };
  } catch {
    return null;
  }
}

export async function fetchGroupInfo(
  groupId: string,
  token: string,
): Promise<GroupInfo | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v2/groups/${encodeURIComponent(groupId)}`,
      { headers: { Authorization: bearer(token) } },
    );
    const json = await res.json().catch(() => null);
    const raw = json?.responseObject ?? json?.data ?? json;
    if (!raw?.id) return null;
    return normalizeGroupInfo(raw as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function updateGroupInfo(
  groupId: string,
  updates: { name?: string; photoUrl?: string },
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v2/groups/${encodeURIComponent(groupId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer(token),
        },
        body: JSON.stringify(updates),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function addGroupMember(
  groupId: string,
  userId: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v2/groups/${encodeURIComponent(groupId)}/members`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer(token),
        },
        body: JSON.stringify({ userId }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v2/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
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

export async function setGroupMemberAdmin(
  groupId: string,
  userId: string,
  isAdmin: boolean,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v2/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer(token),
        },
        body: JSON.stringify({ isAdmin }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function leaveGroup(
  groupId: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v2/groups/${encodeURIComponent(groupId)}/members/me`,
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

export async function uploadGroupPhoto(
  localUri: string,
  token: string,
): Promise<string | null> {
  try {
    const parts = localUri.split('/');
    const fileName = parts.pop() ?? `group-photo-${Date.now()}.jpg`;
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      type: 'image/jpeg',
      name: fileName,
    } as unknown as Blob);
    const res = await fetch(`${API_BASE_URL}/api/v1/upload`, {
      method: 'POST',
      headers: { Authorization: bearer(token) },
      body: formData,
    });
    const json = await res.json().catch(() => null);
    const raw = json?.responseObject ?? json?.data ?? json;
    const url = raw?.url ?? raw?.responseObject?.url;
    return typeof url === 'string' ? url : null;
  } catch {
    return null;
  }
}

/** Fire-and-forget: tell all group members there's an incoming group call. */
export async function notifyGroupCall(params: {
  groupId: string;
  liveKitRoom: string;
  callKind: 'audio' | 'video';
  token: string;
}): Promise<void> {
  try {
    const base = API_BASE_URL.replace(/\/+$/, '');
    await fetch(
      `${base}/api/v2/groups/${encodeURIComponent(params.groupId)}/hopechat-call-invite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer(params.token),
        },
        body: JSON.stringify({
          liveKitRoom: params.liveKitRoom,
          callKind: params.callKind,
        }),
      },
    );
  } catch {
    /* fire-and-forget */
  }
}
