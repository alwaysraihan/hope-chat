/**
 * Stores a peer userId that arrived via a `hopechat://peer/{userId}` deep link
 * so it can be consumed once conversations are available in HomeScreen.
 *
 * Uses a module-level slot + a single listener because only HomeScreen ever
 * needs to act on this, and the listener is replaced each time HomeScreen
 * re-registers (e.g. after a navigation stack reset).
 */

let _pendingPeerId: string | null = null;
let _listener: ((peerId: string) => void) | null = null;

/** Called from the Linking handler in App.tsx as soon as the URL is parsed. */
export function setPendingPeerLink(peerId: string): void {
  _pendingPeerId = peerId;
  // Notify HomeScreen immediately if it is already mounted and listening.
  _listener?.(peerId);
}

/**
 * Read-and-clear the pending peer ID.
 * Called once by HomeScreen when conversations first load.
 */
export function consumePendingPeerLink(): string | null {
  const id = _pendingPeerId;
  _pendingPeerId = null;
  return id;
}

/**
 * Subscribe to real-time peer deep-link events (app already running / backgrounded).
 * Returns an unsubscribe function.
 */
export function onPeerDeepLink(cb: (peerId: string) => void): () => void {
  _listener = cb;
  return () => {
    if (_listener === cb) _listener = null;
  };
}
