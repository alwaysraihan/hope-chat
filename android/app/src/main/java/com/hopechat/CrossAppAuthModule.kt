package com.hopechat

import android.net.Uri
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * CrossAppAuthModule — Android companion for cross-app auth between HopeChat and Hopenity.
 *
 * ── Android strategy (v2) — ContentProvider ───────────────────────────────────
 *
 * `android:sharedUserId` was deprecated in API 29 and is blocked by Play Store
 * for new apps. `createPackageContext` across package boundaries fails with
 * SecurityException on Android 10+ unless both apps share the same UID — which
 * requires sharedUserId, so this is a circular dependency that no longer works.
 *
 * The Play-Store-compliant replacement is a signature-protected ContentProvider:
 *   • Hopenity declares `com.hopenity.permission.READ_AUTH` with
 *     `protectionLevel="signature"` and registers HopenityAuthProvider.
 *   • HopeChat declares `uses-permission` for that permission.
 *   • Android verifies at install time that both APKs are signed with the same
 *     key; only then is the permission granted.
 *   • `readHopenityAuthSync()` queries the ContentProvider via IPC and returns
 *     the Hopenity session JSON string.  The JS layer parses it with the
 *     existing normalizeHopenityPersistedBlob() logic.
 *
 * ── iOS ────────────────────────────────────────────────────────────────────────
 * The iOS counterpart (CrossAppAuthStorage.m) returns the App Group container
 * path so MMKV reads the shared file Hopenity wrote — no changes needed there.
 *
 * ── Fallback ───────────────────────────────────────────────────────────────────
 * If Hopenity is not installed, the ContentProvider query throws/returns null.
 * `readHopenityAuthSync()` returns "" in that case so hopenitySharedAuth.ts
 * falls back to HopeChat's own private MMKV, which is seeded by the deep-link
 * handshake (hopechat://auth?token=...) the first time the user opens from Hopenity.
 *
 * `getSharedMMKVDirectorySync()` is kept as a no-op for backwards compatibility
 * with the JS call site; it always returns "" on Android now.
 */
@ReactModule(name = CrossAppAuthModule.NAME)
class CrossAppAuthModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    /**
     * Returns "" on Android — shared MMKV path is no longer used.
     * iOS counterpart returns the App Group container path (unchanged).
     * Kept so the JS call site in hopenitySharedAuth.ts does not need to change.
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getSharedMMKVDirectorySync(): String = ""

    /**
     * Reads the Hopenity session JSON string via the signature-protected
     * ContentProvider exposed by Hopenity (com.hopenity.authprovider).
     *
     * Returns the raw `user` JSON string on success, or "" when:
     *   • Hopenity is not installed
     *   • The signature permission check fails (different signing key)
     *   • Any other error
     *
     * The returned string is passed directly to normalizeHopenityPersistedBlob()
     * in hopenitySharedAuth.ts — the same parsing path used by the MMKV read.
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun readHopenityAuthSync(): String {
        return try {
            val uri = Uri.parse("content://com.hopenity.authprovider/user")
            val cursor = reactApplicationContext.contentResolver
                .query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val idx = it.getColumnIndex("user_json")
                    if (idx >= 0) it.getString(idx) ?: "" else ""
                } else ""
            } ?: ""
        } catch (_: Exception) {
            ""
        }
    }

    companion object {
        const val NAME = "CrossAppAuthStorage"
    }
}
