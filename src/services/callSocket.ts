/**
 * WebSocket (Socket.IO) channel for real-time call signaling.
 *
 * Primary path: Socket.IO (< 100 ms -- used when callee has the app foregrounded).
 * Fallback path: FCM push (used when callee's app is backgrounded / device offline).
 *
 * socket.io-client is loaded lazily inside connect() -- never at module evaluation
 * time -- so its browser-environment detection code runs only after the React
 * Native bridge is fully set up.
 */
import { API_BASE_URL } from '../config/env';

const SOCKET_URL = API_BASE_URL.replace(/\/+$/, '');

type CallSocketListener = (data: Record<string, string>) => void;

class CallSocketService {
  private socket: any = null;
  private token: string | null = null;
  private incomingCallListeners: Set<CallSocketListener> = new Set();
  private cancelledListeners: Set<CallSocketListener> = new Set();

  connect(authToken: string): void {
    if (this.socket?.connected && this.token === authToken) return;
    this.disconnect();
    this.token = authToken;

    // Lazy-load socket.io-client ONLY when connect() is called (inside a useEffect).
    // Loading it at module-evaluation time causes Android crashes because
    // socket.io-client runs browser-environment detection before RN polyfills are ready.
    let io: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      io = require('socket.io-client').io;
    } catch {
      if (__DEV__) {
        console.warn('[CallSocket] socket.io-client not available -- FCM fallback active.');
      }
      return;
    }

    try {
      this.socket = io(SOCKET_URL, {
        auth: { token: authToken },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 10_000,
      });

      this.socket.on('connect', () => {
        if (__DEV__) console.log('[CallSocket] connected', this.socket?.id);
      });
      this.socket.on('disconnect', (reason: string) => {
        if (__DEV__) console.log('[CallSocket] disconnected', reason);
      });
      this.socket.on('incoming_call', (data: unknown) => {
        const normalized = normalizeSocketData(data);
        if (!normalized) return;
        this.incomingCallListeners.forEach(l => { try { l(normalized); } catch { /* */ } });
      });
      this.socket.on('call_cancelled', (data: unknown) => {
        const normalized = normalizeSocketData(data);
        if (!normalized) return;
        this.cancelledListeners.forEach(l => { try { l(normalized); } catch { /* */ } });
      });
    } catch (e) {
      if (__DEV__) console.warn('[CallSocket] connect error', e);
      this.socket = null;
    }
  }

  disconnect(): void {
    if (this.socket) {
      try { this.socket.removeAllListeners(); } catch { /* */ }
      try { this.socket.disconnect(); } catch { /* */ }
      this.socket = null;
    }
    this.token = null;
  }

  onIncomingCall(listener: CallSocketListener): () => void {
    this.incomingCallListeners.add(listener);
    return () => this.incomingCallListeners.delete(listener);
  }

  onCallCancelled(listener: CallSocketListener): () => void {
    this.cancelledListeners.add(listener);
    return () => this.cancelledListeners.delete(listener);
  }

  isConnected(): boolean {
    return this.socket?.connected === true;
  }
}

function normalizeSocketData(data: unknown): Record<string, string> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data as object)) {
    if (typeof v === 'string') out[k] = v;
    else if (v != null && (typeof v === 'number' || typeof v === 'boolean'))
      out[k] = String(v);
  }
  return Object.keys(out).length > 0 ? out : null;
}

export const callSocket = new CallSocketService();
