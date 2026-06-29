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

type MessageDeletedListener = (data: { messageId: number; chatId: number }) => void;
type NewMessageListener = (data: { chatId: number }) => void;

class CallSocketService {
  private socket: any = null;
  private token: string | null = null;
  private userId: string | null = null;
  private incomingCallListeners: Set<CallSocketListener> = new Set();
  private cancelledListeners: Set<CallSocketListener> = new Set();
  private ringingListeners: Set<CallSocketListener> = new Set();
  private messageDeletedListeners: Set<MessageDeletedListener> = new Set();
  private newMessageListeners: Set<NewMessageListener> = new Set();

  connect(authToken: string, userId?: string): void {
    if (this.socket?.connected && this.token === authToken) return;
    this.disconnect();
    this.token = authToken;
    this.userId = userId ?? null;

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
        // Join the user-specific room so the server can deliver personal events
        // (incoming_call, call_cancelled, call_ringing) via io.to(`user_${userId}`).
        if (this.userId) {
          try { this.socket?.emit('join_user', this.userId); } catch { /* */ }
        }
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
      this.socket.on('call_ringing', (data: unknown) => {
        const normalized = normalizeSocketData(data);
        if (!normalized) return;
        this.ringingListeners.forEach(l => { try { l(normalized); } catch { /* */ } });
      });
      this.socket.on('message_deleted', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const d = data as Record<string, unknown>;
        const payload = { messageId: Number(d.messageId), chatId: Number(d.chatId) };
        this.messageDeletedListeners.forEach(l => { try { l(payload); } catch { /* */ } });
      });
      this.socket.on('new_message', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const d = data as Record<string, unknown>;
        const payload = { chatId: Number(d.chatId) };
        this.newMessageListeners.forEach(l => { try { l(payload); } catch { /* */ } });
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
    this.userId = null;
  }

  onIncomingCall(listener: CallSocketListener): () => void {
    this.incomingCallListeners.add(listener);
    return () => this.incomingCallListeners.delete(listener);
  }

  onCallCancelled(listener: CallSocketListener): () => void {
    this.cancelledListeners.add(listener);
    return () => this.cancelledListeners.delete(listener);
  }

  /** Caller subscribes: fires when callee's device receives the ring. */
  onCallRinging(listener: CallSocketListener): () => void {
    this.ringingListeners.add(listener);
    return () => this.ringingListeners.delete(listener);
  }

  /**
   * Callee emits this immediately on receiving incoming_call so the caller's UI
   * can switch from "Calling…" to "Ringing…" only when the device is actually ringing.
   */
  emitCallRinging(liveKitRoom: string, callerId: string): void {
    if (!this.socket?.connected || !liveKitRoom || !callerId) return;
    try {
      this.socket.emit('call_ringing', { liveKitRoom, callerId });
    } catch { /* */ }
  }

  joinChatRoom(chatId: string | number): void {
    if (!this.socket?.connected) return;
    try { this.socket.emit('join_chat', String(chatId)); } catch { /* */ }
  }

  leaveChatRoom(chatId: string | number): void {
    if (!this.socket?.connected) return;
    try { this.socket.emit('leave_chat', String(chatId)); } catch { /* */ }
  }

  onMessageDeleted(listener: MessageDeletedListener): () => void {
    this.messageDeletedListeners.add(listener);
    return () => this.messageDeletedListeners.delete(listener);
  }

  onNewMessage(listener: NewMessageListener): () => void {
    this.newMessageListeners.add(listener);
    return () => this.newMessageListeners.delete(listener);
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
