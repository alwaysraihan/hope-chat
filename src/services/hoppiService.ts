 import { API_BASE_URL } from '../config/env';

// hoppi.live is the Next.js storefront (for user-facing share links only —
// it 404s on every API route). The actual backend lives on the api subdomain;
// all fetch() calls in this file must use HOPPI_API_URL, not HOPPI_BASE_URL.
export const HOPPI_BASE_URL = 'https://hoppi.live';
const HOPPI_API_URL = 'https://api.hoppi.live';

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
    const res = await fetch(`${HOPPI_API_URL}/auth/customer-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hopenityToken}` },
    });
    if (!res.ok) {
      if (__DEV__) {
        console.warn(
          `[hoppiService] customer-token exchange failed: HTTP ${res.status}` +
          (res.status === 401 || res.status === 403
            ? ' — hopenityToken rejected (stale/expired session)'
            : ''),
        );
      }
      return null;
    }
    const data = await res.json() as { success?: boolean; token?: string; userId?: string };
    if (!data.success || !data.token || !data.userId) {
      if (__DEV__) console.warn('[hoppiService] customer-token response missing token/userId', data);
      return null;
    }
    const session: HoppiSession = { hoppiToken: data.token, hoppiUserId: data.userId };
    sessionCache.set(hopenityToken, {
      session,
      expiresAt: Date.now() + 5 * 60 * 60 * 1000, // 5-hour cache
    });
    return session;
  } catch (e) {
    if (__DEV__) console.warn('[hoppiService] customer-token network error', e);
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
    const res = await fetch(`${HOPPI_API_URL}/seller/my-profile`, {
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
      `${HOPPI_API_URL}/add-product/by-seller/${sellerId}?page=${page}&limit=20`,
      { headers: { Authorization: `Bearer ${hoppiToken}` } },
    );
    const data = await res.json();
    return data?.products ?? (Array.isArray(data?.data) ? data.data : []);
  } catch {
    return [];
  }
}

/**
 * Resolve the trailing segment of a `hoppi.live/product/<ref>` URL.
 *
 * That segment is usually a Mongo ObjectId (24 hex chars), which only
 * `/add-product/:id` serves — `/add-product/by-slug/:slug` 404s for it. Human
 * readable slugs still exist for older links, so try the shape that matches and
 * fall back to the other before giving up.
 */
export async function fetchProductBySlug(
  ref: string,
): Promise<HoppiProduct | null> {
  const looksLikeObjectId = /^[a-f\d]{24}$/i.test(ref);
  const paths = looksLikeObjectId
    ? [`/add-product/${ref}`, `/add-product/by-slug/${ref}`]
    : [`/add-product/by-slug/${ref}`, `/add-product/${ref}`];

  for (const path of paths) {
    try {
      const res = await fetch(`${HOPPI_API_URL}${path}`);
      if (!res.ok) continue;
      const data = await res.json();
      const p = data?.data ?? data?.product ?? data;
      if (p?._id || p?.title) return p as HoppiProduct;
    } catch {
      // try the next shape
    }
  }
  return null;
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

/**
 * hoppi.live's cart is keyed on a `userId` QUERY PARAM, not on the bearer token
 * (unlike /orders, which reads the user from the JWT — which is exactly why
 * "My Purchases" worked while "My Cart" came back empty).
 *
 * The Hopenity app writes the cart under the HOPENITY user id (`user.user_id`,
 * the cuid). HopeChat was reading it back under `session.hoppiUserId`, which is
 * hoppi's own Mongo `_id` issued by /auth/customer-token — a different
 * identifier for the same person, so the lookup always missed and the cart
 * looked empty.
 *
 * `hopenityUserId` must therefore be the same cuid the Hopenity app uses.
 */
export async function fetchMyCart(
  session: HoppiSession,
  hopenityUserId: string,
): Promise<HoppiCartItem[]> {
  const cartUserId = String(hopenityUserId ?? '').trim();
  if (!cartUserId) {
    if (__DEV__) console.warn('[hoppiService] fetchMyCart called without a Hopenity user id');
    return [];
  }
  try {
    const res = await fetch(
      `${HOPPI_API_URL}/cart?userId=${encodeURIComponent(cartUserId)}`,
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
    const res = await fetch(`${HOPPI_API_URL}/orders?page=${page}&limit=20`, {
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
  if (!productId) return null;
  // Encode: variant cart lines use composite references that can contain
  // characters (":", "/", spaces) which would otherwise break the path and make
  // the receiving card resolve the wrong product — or none at all.
  return `${HOPPI_BASE_URL}/product/${encodeURIComponent(productId)}`;
}
