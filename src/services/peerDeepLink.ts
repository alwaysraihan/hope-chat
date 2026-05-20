/**
 * Stores the peer payload that arrived via a `hopechat://peer/{userId}` deep link
 * so it can be consumed once conversations are available in HomeScreen.
 *
 * URL format (Hopenity should include name + avatar so we can seed a new chat):
 *   hopechat://peer/{userId}?name=John%20Doe&avatar=https%3A%2F%2F...
 *
 * Uses a module-level slot + a single listener because only HomeScreen ever
 * needs to act on this, and the listener is replaced each time HomeScreen
 * re-registers (e.g. after a navigation stack reset).
 */

export type PeerLinkPayload = {
  peerId: string;
  displayName?: string;
  avatarUrl?: string | null;
};

let _pending: PeerLinkPayload | null = null;
let _listener: ((payload: PeerLinkPayload) => void) | null = null;

/** Called from the Linking handler in App.tsx as soon as the URL is parsed. */
export function setPendingPeerLink(payload: PeerLinkPayload): void {
  _pending = payload;
  // Notify HomeScreen immediately if it is already mounted and listening.
  _listener?.(payload);
}

/**
 * Read-and-clear the pending peer payload.
 * Called once by HomeScreen when the conversation list finishes loading.
 */
export function consumePendingPeerLink(): PeerLinkPayload | null {
  const p = _pending;
  _pending = null;
  return p;
}

/**
 * Subscribe to real-time peer deep-link events (app already running / backgrounded).
 * Returns an unsubscribe function.
 */
export function onPeerDeepLink(
  cb: (payload: PeerLinkPayload) => void,
): () => void {
  _listener = cb;
  return () => {
    if (_listener === cb) _listener = null;
  };
}
