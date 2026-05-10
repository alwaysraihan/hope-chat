/**
 * Cross-app auth vault (Hope Chat ⇄ Hopenity).
 * Must stay byte-for-byte identical to
 * `Hopenity/Src/Application/Storage/sharedHopenityAuthVault.ts`.
 *
 * Changing the encryption key invalidates existing encrypted MMKV files;
 * users must sign in again.
 */
export const SHARED_HOPENITY_AUTH_MMKV_STORAGE_ID = 'hopenity-auth' as const;

export const SHARED_HOPENITY_AUTH_MMKV_ENCRYPTION_KEY =
  'hopenity-auth!1' as const;
