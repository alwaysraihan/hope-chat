/**
 * Hopenity post lookup — backs the in-chat preview card for hopenity.com links.
 *
 * `/api/v1/posts/:id` is public (no auth), so a shared post previews even for a
 * signed-out reader. Responses are memoised for the session: the same link is
 * commonly re-rendered as the thread scrolls, and each render would otherwise
 * refetch.
 */

import { API_BASE_URL } from '../config/env';

export type HopenityPost = {
  id: string;
  caption: string;
  /** Poster image: video thumbnail, or the image itself. */
  thumbnailUrl: string | null;
  mediaType: 'VIDEO' | 'IMAGE' | 'TEXT' | string;
  authorName: string | null;
  authorAvatar: string | null;
  likeCount?: number;
  commentCount?: number;
};

const cache = new Map<string, HopenityPost | null>();

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export async function fetchHopenityPost(
  postId: string,
): Promise<HopenityPost | null> {
  const key = String(postId);
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/posts/${encodeURIComponent(key)}`);
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }

    const json = await res.json();
    const p = (json?.responseObject ?? json?.data ?? json) as Record<string, unknown>;
    if (!p || typeof p !== 'object' || p.id == null) {
      cache.set(key, null);
      return null;
    }

    const user = (p.user ?? p.author ?? {}) as Record<string, unknown>;
    const page = (p.page ?? {}) as Record<string, unknown>;
    const mediaType = str(p.media_type) ?? str(p.mediaType) ?? 'TEXT';
    const mediaUrl = str(p.media_url) ?? str(p.mediaUrl);

    const post: HopenityPost = {
      id: key,
      caption: str(p.content) ?? str(p.caption) ?? str(p.text) ?? '',
      // A video's media_url is an .m3u8 manifest — never usable as an <Image>
      // source, so fall back to the thumbnail and show a play affordance.
      thumbnailUrl:
        str(p.thumbnail_url) ??
        str(p.thumbnailUrl) ??
        (mediaType === 'IMAGE' ? mediaUrl : null),
      mediaType,
      authorName: str(page.name) ?? str(user.name) ?? null,
      authorAvatar: str(page.image) ?? str(user.image) ?? null,
      likeCount: num(p.like_count) ?? num(p.likeCount),
      commentCount: num(p.comment_count) ?? num(p.commentCount),
    };

    cache.set(key, post);
    return post;
  } catch {
    // Don't cache transient network failures — a retry on the next render is fine.
    return null;
  }
}
