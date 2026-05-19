import { API_BASE_URL } from '../../config/env';
import type { StoryRing } from '../../data/storyFeedCache';

type ApiStoryItem = {
  id?: string | number;
  user_id?: string | number;
  userId?: string | number;
  type?: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  content?: string | null;
  backgroundColor?: string | null;
  created_at?: string;
  user?: {
    id?: string | number;
    user_id?: string | number;
    name?: string;
    image?: string | null;
    profile_image?: string | null;
  };
  duration?: number;
};

function pickStr(...vals: (string | number | null | undefined)[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && !isNaN(v)) return String(v);
  }
  return '';
}

function storyMediaUri(item: ApiStoryItem): string {
  return pickStr(item.media_url, item.thumbnail_url) || '';
}

/** Fetch stories from the Hopenity API feed. Returns an empty array on error. */
export async function fetchStoryFeed(token: string | null): Promise<StoryRing[]> {
  if (!token) return [];
  try {
    const base = API_BASE_URL.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/v1/stories?limit=30`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = await res.json();

    const list: ApiStoryItem[] =
      json?.responseObject?.stories ??
      json?.responseObject?.data ??
      json?.responseObject ??
      json?.data?.stories ??
      json?.data ??
      json?.stories ??
      [];

    if (!Array.isArray(list) || list.length === 0) return [];

    // Group by user
    const byUser = new Map<string, { name: string; avatar: string | null; slides: { id: string; uri: string; durationMs: number }[] }>();
    for (const item of list) {
      const uid = pickStr(item.user?.id, item.user?.user_id, item.user_id, item.userId) || 'unknown';
      const name = pickStr(item.user?.name) || 'Friend';
      const avatar = pickStr(item.user?.image, item.user?.profile_image) || null;
      const uri = storyMediaUri(item);
      if (!uri) continue;
      if (!byUser.has(uid)) {
        byUser.set(uid, { name, avatar: avatar || null, slides: [] });
      }
      byUser.get(uid)!.slides.push({
        id: pickStr(item.id) || `${uid}_${Date.now()}`,
        uri,
        durationMs: typeof item.duration === 'number' ? item.duration : 5000,
      });
    }

    return Array.from(byUser.entries()).map(([uid, data]) => ({
      id: uid,
      name: data.name.split(/\s+/)[0] || data.name,
      avatarUri: data.avatar ?? undefined,
      slides: data.slides,
    }));
  } catch {
    return [];
  }
}
