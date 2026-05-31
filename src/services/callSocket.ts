/**
 * WebSocket (Socket.IO) channel for real-time call signaling.
 *
 * Primary path: Socket.IO (< 100 ms — used when callee has the app foregrounded).
 * Fallback path: FCM push (used when callee's app is backgrounded / device offline).
 *
 * Events received:
 *   incoming_call   — same payload as the FCM incoming_call data message
 *   call_cancelled  — same payload as the FCM call_cancelled data message
 *
 * Run `npm install socket.io-client` once after pulling this file.
 */
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/env';

// Socket URL — same host as the REST API, path /socket.io
const SOCKET_URL = API_BASE_URL.replace(/\/+$/, '');

type CallSocketListener = (data: Record<string, string>) => void;

class CallSocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private incomingCallListeners: Set<CallSocketListener> = new Set();
  private cancelledListeners: Set<CallSocketListener> = new Set();

  connect(authToken: string): void {
    if (this.socket?.connected && this.token === authToken) return;
    this.disconnect();
    this.token = authToken;

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

    this.socket.on('disconnect', reason => {
      if (__DEV__) console.log('[CallSocket] disconnected', reason);
    });

    this.socket.on('incoming_call', (data: unknown) => {
      const normalized = normalizeSocketData(data);
      if (!normalized) return;
      this.incomingCallListeners.forEach(l => {
        try { l(normalized); } catch { /* */ }
      });
    });

    this.socket.on('call_cancelled', (data: unknown) => {
      const normalized = normalizeSocketData(data);
      if (!normalized) return;
      this.cancelledListeners.forEach(l => {
        try { l(normalized); } catch { /* */ }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
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
