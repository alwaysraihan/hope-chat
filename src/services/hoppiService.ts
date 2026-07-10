import { API_BASE_URL } from '../config/env';

export const HOPPI_BASE_URL = 'https://hoppi.live';

export interface HoppiSession {
  hoppiToken: string;
  // hoppi.live Mongo user id — the key the cart API is scoped by.
  hoppiUserId: string;
}

// In-memory cache: hopenityToken → { session, expiresAt }
const sessionCache = new Map<string, { session: HoppiSession; expiresAt: number }>();

export async function getHoppiSession(
  hopenityToken: string,
): Promise<HoppiSession | null> {
  const cached = sessionCache.get(hopenityToken);
  if (cached && cached.expiresAt > Date.now()) return cached.session;

  try {
    const res = await fetch(`${HOPPI_BASE_URL}/auth/customer-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hopenityToken}` },
    });
    const data = await res.json() as { success?: boolean; token?: string; userId?: string };
    if (!data.success || !data.token || !data.userId) return null;
    const session: HoppiSession = { hoppiToken: data.token, hoppiUserId: data.userId };
    sessionCache.set(hopenityToken, {
      session,
      expiresAt: Date.now() + 5 * 60 * 60 * 1000, // 5-hour cache
    });
    return session;
  } catch {
    return null;
  }
}

export async function getHoppiToken(
  hopenityToken: string,
): Promise<string | null> {
  const session = await getHoppiSession(hopenityToken);
  return session?.hoppiToken ?? null;
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

// ── Cart & purchases (shared "shop" sheet, available to every user) ─────────

export interface HoppiCartItem {
  id: string; // product id
  name: string;
  price: number;
  quantity: number;
  icon?: string; // product image url
  variantLabel?: string;
}

export async function fetchMyCart(session: HoppiSession): Promise<HoppiCartItem[]> {
  try {
    const res = await fetch(
      `${HOPPI_BASE_URL}/cart?userId=${encodeURIComponent(session.hoppiUserId)}`,
      { headers: { Authorization: `Bearer ${session.hoppiToken}` } },
    );
    const data = await res.json();
    const items = data?.data?.items;
    return Array.isArray(items) ? items.filter((i: any) => i?.id) : [];
  } catch {
    return [];
  }
}

export interface HoppiPurchasedProduct {
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  orderStatus?: string;
  orderDate?: string;
}

export async function fetchMyPurchases(
  session: HoppiSession,
  page = 1,
): Promise<HoppiPurchasedProduct[]> {
  try {
    const res = await fetch(`${HOPPI_BASE_URL}/orders?page=${page}&limit=20`, {
      headers: { Authorization: `Bearer ${session.hoppiToken}` },
    });
    const data = await res.json();
    const orders = data?.data?.orders ?? data?.orders ?? (Array.isArray(data?.data) ? data.data : []);
    if (!Array.isArray(orders)) return [];
    const products: HoppiPurchasedProduct[] = [];
    for (const order of orders) {
      for (const p of order?.products ?? []) {
        if (!p?.name) continue;
        products.push({
          productId: p.productId ? String(p.productId) : undefined,
          name: p.name,
          price: Number(p.price) || 0,
          quantity: Number(p.quantity) || 1,
          imageUrl: p.imageUrl,
          orderStatus: order?.status,
          orderDate: order?.createdAt,
        });
      }
    }
    return products;
  } catch {
    return [];
  }
}

/**
 * Share url for a cart/purchased item. Cart items key `id` (and order rows
 * `productId`) hold the product's id, which the hoppi.live product page
 * resolves the same way as a slug. Returns null when the id is missing
 * (legacy orders) — callers should render those rows as not shareable.
 */
export function productIdShareUrl(productId: string | undefined): string | null {
  return productId ? `${HOPPI_BASE_URL}/product/${productId}` : null;
}
