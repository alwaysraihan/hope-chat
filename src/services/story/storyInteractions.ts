import { API_BASE_URL } from '../../config/env';

/**
 * Mirrors feusar's StoryViewer.tsx (markStoryViewed / reactToStory mutations)
 * against the same backend endpoints — POST /stories/:id/view and
 * POST /stories/:id/react. Fire-and-forget: a story view/reaction failing
 * silently must never interrupt playback.
 */

export async function markStoryViewed(
  storyId: string,
  token: string | null,
): Promise<void> {
  if (!storyId || !token) return;
  try {
    await fetch(`${API_BASE_URL}/api/v1/stories/${encodeURIComponent(storyId)}/view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* best-effort */
  }
}

export type StoryViewerRow = {
  id: string;
  viewerId: string;
  viewedAt: string;
  name: string;
  username?: string;
  avatarUrl: string | null;
  /** This viewer's reaction emoji, if any (matched by userId against `reactions`). */
  reaction?: string;
};

/**
 * Owner-only — confirmed against the live API (403 for a non-owner viewer,
 * 200 with the full `views`/`reactions` arrays for the story's own author).
 * Mirrors feusar's "Story details" sheet (StoryViewer.tsx:800-948).
 */
export async function fetchStoryViewers(
  storyId: string,
  token: string | null,
): Promise<StoryViewerRow[]> {
  if (!storyId || !token) return [];
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/stories/${encodeURIComponent(storyId)}/details`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    const raw = json?.responseObject ?? json;
    const views: unknown[] = Array.isArray(raw?.views) ? raw.views : [];
    const reactions: unknown[] = Array.isArray(raw?.reactions) ? raw.reactions : [];
    const reactionByViewer = new Map<string, string>();
    for (const r of reactions) {
      const rr = r as Record<string, unknown>;
      const uid = String(rr.userId ?? rr.viewerId ?? '');
      const emoji = rr.reaction;
      if (uid && typeof emoji === 'string') reactionByViewer.set(uid, emoji);
    }
    return views
      .map((v): StoryViewerRow | null => {
        const vv = v as Record<string, unknown>;
        const viewerId = String(vv.viewerId ?? '');
        const viewer = (vv.viewer ?? {}) as Record<string, unknown>;
        if (!viewerId) return null;
        return {
          id: String(vv.id ?? viewerId),
          viewerId,
          viewedAt: String(vv.viewedAt ?? ''),
          name: String(viewer.name ?? 'Someone'),
          username: viewer.username ? String(viewer.username) : undefined,
          avatarUrl: viewer.image ? String(viewer.image) : null,
          reaction: reactionByViewer.get(viewerId),
        };
      })
      .filter((v): v is StoryViewerRow => v !== null)
      .sort((a, b) => (a.viewedAt < b.viewedAt ? 1 : -1));
  } catch {
    return [];
  }
}

/** Mirrors feusar's deleteStory mutation — DELETE /stories/:id, owner-only. */
export async function deleteStory(
  storyId: string,
  token: string | null,
): Promise<boolean> {
  if (!storyId || !token) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/stories/${encodeURIComponent(storyId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function reactToStory(
  storyId: string,
  reaction: string,
  token: string | null,
): Promise<boolean> {
  if (!storyId || !token) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/stories/${encodeURIComponent(storyId)}/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reaction }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
