/**
 * Cross-app auth vault (Hope Chat ⇄ Hopenity).
 * Must stay byte-for-byte identical to
 * `Hopenity/Src/Application/Storage/sharedHopenityAuthVault.ts`.
 *
 * Changing the encryption key invalidates existing encrypted MMKV files;
 * users must sign in again.
 */
export const SHARED_HOPENITY_AUTH_MMKV_STORAGE_ID = 'hopenity-auth' as const;

// The MMKV encryption key, XOR-obfuscated so it isn't a plain string literal
// sitting in the bundled JS output. Decodes to the exact same value at
// runtime — must stay in sync (same plaintext result) with
// `Hopenity/Src/Application/Storage/sharedHopenityAuthVault.ts` and
// `HopenityAuthProvider.kt`.
const ENCRYPTION_KEY_XOR_MASK = 0x5a;
const ENCRYPTION_KEY_XOR_BYTES = [
  0x32, 0x35, 0x2a, 0x3f, 0x34, 0x33, 0x2e, 0x23, 0x77, 0x3b, 0x2f, 0x2e, 0x32,
  0x7b, 0x6b,
];

export const SHARED_HOPENITY_AUTH_MMKV_ENCRYPTION_KEY =
  ENCRYPTION_KEY_XOR_BYTES.map((byte) =>
    String.fromCharCode(byte ^ ENCRYPTION_KEY_XOR_MASK),
  ).join('');
