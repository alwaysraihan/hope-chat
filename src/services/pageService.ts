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

/**
 * Whether visitors may place a HopeChat call to this page.
 *
 * A page that only does text support can turn calling off. The server enforces
 * it on the call-invite endpoint too — hiding the buttons here is a courtesy,
 * not the rule, so a stale client cannot get a call through.
 */
export async function fetchPageAllowCalls(
  token: string,
  pageId: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/pages/${encodeURIComponent(pageId)}/privacy`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return true; // unknown → assume calling is allowed
    const json = await res.json();
    const value = json?.responseObject?.allow_calls;
    return value !== false;
  } catch {
    return true;
  }
}

export async function setPageAllowCalls(
  token: string,
  pageId: string,
  allowCalls: boolean,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/pages/${encodeURIComponent(pageId)}/privacy`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ allow_calls: allowCalls }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
