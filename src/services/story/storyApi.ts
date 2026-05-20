import { API_BASE_URL } from '../../config/env';
import type { StoryRing } from '../../data/storyFeedCache';

/**
 * Mirrors the Hopenity StoryGroup/StoryItem shapes from StoryApi.ts.
 * The API returns:
 *   { responseObject: { stories: StoryGroup[] } }
 * where each StoryGroup has a `user` and a nested `stories` array.
 */
type ApiStoryUser = {
  id?: string | number;
  user_id?: string | number;
  name?: string;
  image?: string | null;
  profile_image?: string | null;
};

type ApiStoryItem = {
  id?: string | number;
  type?: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  content?: string | null;
  background_color?: string | null;
  created_at?: string;
  is_viewed?: boolean;
  music_url?: string | null;
  duration?: number;
};

type ApiStoryGroup = {
  user?: ApiStoryUser;
  stories?: ApiStoryItem[];
};

function pickStr(...vals: (string | number | null | undefined)[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && !isNaN(v)) return String(v);
  }
  return '';
}

/**
 * Fetch story feed from the Hopenity API.
 * Endpoint: GET /api/v1/stories
 * Response shape: { responseObject: { stories: StoryGroup[] } }
 */
export async function fetchStoryFeed(token: string | null): Promise<StoryRing[]> {
  if (!token) return [];
  try {
    const base = API_BASE_URL.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/v1/stories?limit=30&page=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = await res.json();

    // The API wraps groups under responseObject.stories (an array of StoryGroup).
    const groups: ApiStoryGroup[] =
      json?.responseObject?.stories ??
      json?.data?.stories ??
      json?.stories ??
      [];

    if (!Array.isArray(groups) || groups.length === 0) return [];

    const rings: StoryRing[] = [];

    for (const group of groups) {
      const user = group.user ?? {};
      const uid = pickStr(user.id, user.user_id) || String(Math.random());
      const name = pickStr(user.name) || 'Friend';
      const avatar = pickStr(user.image, user.profile_image) || null;

      const storyItems = Array.isArray(group.stories) ? group.stories : [];

      // Build slides — only include items that have a visible media URL.
      const slides = storyItems
        .map(s => {
          const storyType = String(s.type ?? '').toUpperCase();
          const isVideo = storyType === 'VIDEO';

          // For video: prefer the direct video URL, fall back to thumbnail for display.
          // For images / text: use media_url then thumbnail_url.
          const uri = isVideo
            ? pickStr(s.media_url, s.thumbnail_url)
            : pickStr(s.media_url, s.thumbnail_url);

          if (!uri) return null; // skip text-only stories with no cover image
          return {
            id: pickStr(s.id) || `${uid}_${Date.now()}`,
            uri,
            type: isVideo ? ('video' as const) : ('image' as const),
            durationMs: typeof s.duration === 'number' && s.duration > 0
              ? s.duration
              : isVideo ? 15000 : 5000,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      if (slides.length === 0) continue;

      rings.push({
        id: uid,
        name: name.split(/\s+/)[0] || name,
        avatarUri: avatar ?? undefined,
        slides,
      });
    }

    return rings;
  } catch {
    return [];
  }
}
