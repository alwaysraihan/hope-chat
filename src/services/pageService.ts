import { API_BASE_URL } from '../config/env';

export type OwnedPage = {
  id: string;
  name: string;
  image: string | null;
  username?: string;
};

function normalise(raw: Record<string, unknown>): OwnedPage {
  return {
    id: String(raw.id ?? raw.page_id ?? ''),
    name: String(raw.name ?? raw.title ?? raw.page_name ?? ''),
    image:
      (raw.image ?? raw.profile_image ?? raw.photo ?? raw.cover ?? null) as string | null,
    username: raw.username != null ? String(raw.username) : undefined,
  };
}

export async function fetchMyPages(token: string): Promise<OwnedPage[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/pages/my-pages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => null);
    const list = json?.responseObject ?? json?.data ?? json;
    if (!Array.isArray(list)) return [];
    return list
      .map(r => normalise(r as Record<string, unknown>))
      .filter(p => p.id && p.name);
  } catch {
    return [];
  }
}
