import { API_BASE_URL } from '../config/env';

export const HOPPI_BASE_URL = 'https://hoppi.live';

// In-memory cache: hopenityToken → { hoppiToken, expiresAt }
const tokenCache = new Map<string, { hoppiToken: string; expiresAt: number }>();

export async function getHoppiToken(
  hopenityToken: string,
): Promise<string | null> {
  const cached = tokenCache.get(hopenityToken);
  if (cached && cached.expiresAt > Date.now()) return cached.hoppiToken;

  try {
    const res = await fetch(`${HOPPI_BASE_URL}/auth/customer-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hopenityToken}` },
    });
    const data = await res.json() as { success?: boolean; token?: string };
    if (!data.success || !data.token) return null;
    tokenCache.set(hopenityToken, {
      hoppiToken: data.token,
      expiresAt: Date.now() + 5 * 60 * 60 * 1000, // 5-hour cache
    });
    return data.token;
  } catch {
    return null;
  }
}

export interface HoppiProduct {
  _id: string;
  title?: string;
  name?: string;
  images?: string[];
  slug?: string;
  simpleProduct?: { regularPrice?: number; salePrice?: number };
  price?: number;
}

export interface HoppiSeller {
  _id: string;
  shopName?: string;
  name?: string;
  sellerAccountId?: string;
}

export async function fetchMySellerProfile(
  hoppiToken: string,
): Promise<HoppiSeller | null> {
  try {
    const res = await fetch(`${HOPPI_BASE_URL}/seller/my-profile`, {
      headers: { Authorization: `Bearer ${hoppiToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const s = data?.data ?? data?.seller ?? data;
    return s?._id ? s : null;
  } catch {
    return null;
  }
}

export async function fetchSellerProducts(
  hoppiToken: string,
  sellerId: string,
  page = 1,
): Promise<HoppiProduct[]> {
  try {
    const res = await fetch(
      `${HOPPI_BASE_URL}/add-product/by-seller/${sellerId}?page=${page}&limit=20`,
      { headers: { Authorization: `Bearer ${hoppiToken}` } },
    );
    const data = await res.json();
    return data?.products ?? (Array.isArray(data?.data) ? data.data : []);
  } catch {
    return [];
  }
}

export async function fetchProductBySlug(
  slug: string,
): Promise<HoppiProduct | null> {
  try {
    const res = await fetch(`${HOPPI_BASE_URL}/add-product/by-slug/${slug}`);
    const data = await res.json();
    const p = data?.product ?? data?.data ?? data;
    return p?._id || p?.title ? p : null;
  } catch {
    return null;
  }
}

export function formatHoppiPrice(product: HoppiProduct): string | null {
  const price =
    product.simpleProduct?.salePrice ??
    product.simpleProduct?.regularPrice ??
    product.price;
  if (price == null) return null;
  return `৳${price}`;
}

export function productShareUrl(product: HoppiProduct): string {
  return product.slug
    ? `${HOPPI_BASE_URL}/product/${product.slug}`
    : `${HOPPI_BASE_URL}/product/${product._id}`;
}
