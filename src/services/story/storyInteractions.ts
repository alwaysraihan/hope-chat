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
