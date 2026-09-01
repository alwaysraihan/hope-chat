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
/**
 * The server emits the whole message row on `new_message`, not just an id.
 * Carrying it through lets the inbox render the message straight away instead
 * of firing a second REST round-trip to fetch what it was already handed.
 */
type NewMessageListener = (data: {
  chatId: number;
  message?: Record<string, unknown>;
}) => void;
type TypingListener = (data: { chatId: number; userId: string }) => void;
/** A group has one live call; this keeps every member's "Join call" banner in sync. */
type GroupCallStateListener = (data: {
  threadId: string;
  active: boolean;
  liveKitRoom: string;
  callKind: string;
  startedByUserId: string;
  startedByName: string;
  participantCount: number;
}) => void;
/** Word effects animate on BOTH devices, so the emoji travels with the event. */
type WordEffectListener = (data: {
  chatId: string;
  emoji: string;
  word: string;
  fromUserId: string;
}) => void;
/** The chat theme is shared by every participant, so a change has to reach the other end live. */
type ChatThemeUpdatedListener = (data: {
  chatId: string;
  theme: string | null;
}) => void;
/** Nicknames are shared by every participant of a chat, so a change has to reach the other end live. */
type NicknamesUpdatedListener = (data: {
  chatId: string;
  nicknames: Record<string, string>;
}) => void;

class CallSocketService {
  private socket: any = null;
  private token: string | null = null;
  private userId: string | null = null;
  private incomingCallListeners: Set<CallSocketListener> = new Set();
  private cancelledListeners: Set<CallSocketListener> = new Set();
  private ringingListeners: Set<CallSocketListener> = new Set();
  private messageDeletedListeners: Set<MessageDeletedListener> = new Set();
  private newMessageListeners: Set<NewMessageListener> = new Set();
  private userTypingListeners: Set<TypingListener> = new Set();
  private userStoppedTypingListeners: Set<TypingListener> = new Set();
  private nicknamesUpdatedListeners: Set<NicknamesUpdatedListener> = new Set();
  private chatThemeUpdatedListeners: Set<ChatThemeUpdatedListener> = new Set();
  private wordEffectListeners: Set<WordEffectListener> = new Set();
  private groupCallStateListeners: Set<GroupCallStateListener> = new Set();

  connect(authToken: string, userId?: string): void {
    if (this.socket && this.token === authToken) {
      // Same credentials: reuse the existing socket. If it is merely offline
      // (network blip, or the app was backgrounded past the reconnect budget)
      // kick it instead of tearing down — rebuilding drops the reconnect state
      // machine and was leaving the app deaf to incoming calls until restart.
      if (this.userId == null && userId) this.userId = userId;
      if (!this.socket.connected) {
        try { this.socket.connect(); } catch { /* */ }
      }
      return;
    }
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
        // Never stop trying. A finite budget (was 5 attempts / ~5s) meant any
        // outage longer than a few seconds — exactly what happens when a call
        // drops — permanently killed call signaling for the whole session.
        reconnectionAttempts: Infinity,
        reconnectionDelayMax: 10_000,
        randomizationFactor: 0.5,
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
        // socket.io does not auto-reconnect when the server closed the socket
        // deliberately; without this the client stays offline forever.
        if (reason === 'io server disconnect') {
          setTimeout(() => {
            try { this.socket?.connect(); } catch { /* */ }
          }, 1000);
        }
      });
      this.socket.on('connect_error', (e: unknown) => {
        if (__DEV__) console.log('[CallSocket] connect_error', e);
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
        // chatId lives on the message row itself; older emitters sent only it.
        const chatId = Number(d.chatId ?? d.chat_id);
        if (!Number.isFinite(chatId)) return;
        const payload = { chatId, message: d };
        this.newMessageListeners.forEach(l => { try { l(payload); } catch { /* */ } });
      });
      this.socket.on('nicknames_updated', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const d = data as Record<string, unknown>;
        const chatId = String(d.chatId ?? d.chat_id ?? '');
        const nicknames = (d.nicknames ?? {}) as Record<string, string>;
        if (!chatId || typeof nicknames !== 'object') return;
        this.nicknamesUpdatedListeners.forEach(l => {
          try { l({ chatId, nicknames }); } catch { /* */ }
        });
      });
      this.socket.on('group_call_state', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const d = data as Record<string, unknown>;
        const threadId = String(d.threadId ?? d.chatId ?? '');
        if (!threadId) return;
        const payload = {
          threadId,
          active: d.active === true || d.active === 'true',
          liveKitRoom: String(d.liveKitRoom ?? ''),
          callKind: String(d.callKind ?? ''),
          startedByUserId: String(d.startedByUserId ?? ''),
          startedByName: String(d.startedByName ?? ''),
          participantCount: Number(d.participantCount ?? 0),
        };
        this.groupCallStateListeners.forEach(l => { try { l(payload); } catch { /* */ } });
      });
      this.socket.on('word_effect', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const d = data as Record<string, unknown>;
        const emoji = String(d.emoji ?? '');
        const chatId = String(d.chatId ?? d.chat_id ?? '');
        if (!emoji || !chatId) return;
        const payload = {
          chatId,
          emoji,
          word: String(d.word ?? ''),
          fromUserId: String(d.fromUserId ?? ''),
        };
        this.wordEffectListeners.forEach(l => { try { l(payload); } catch { /* */ } });
      });
      this.socket.on('chat_theme_updated', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const d = data as Record<string, unknown>;
        const chatId = String(d.chatId ?? d.chat_id ?? '');
        if (!chatId) return;
        const theme = d.theme == null ? null : String(d.theme);
        this.chatThemeUpdatedListeners.forEach(l => {
          try { l({ chatId, theme }); } catch { /* */ }
        });
      });
      this.socket.on('user_typing', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const d = data as Record<string, unknown>;
        const payload = { chatId: Number(d.chatId), userId: String(d.userId ?? '') };
        this.userTypingListeners.forEach(l => { try { l(payload); } catch { /* */ } });
      });
      this.socket.on('user_stopped_typing', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const d = data as Record<string, unknown>;
        const payload = { chatId: Number(d.chatId), userId: String(d.userId ?? '') };
        this.userStoppedTypingListeners.forEach(l => { try { l(payload); } catch { /* */ } });
      });
    } catch (e) {
      if (__DEV__) console.warn('[CallSocket] connect error', e);
      this.socket = null;
    }
  }

  /**
   * Cheap liveness kick — safe to call on every network regain / app foreground.
   * Reconnects the existing socket, or builds one if we were never connected.
   */
  ensureConnected(authToken?: string | null, userId?: string | null): void {
    const token = authToken ?? this.token;
    if (!token) return;
    if (!this.socket) {
      this.connect(token, userId ?? undefined);
      return;
    }
    if (this.socket.connected) {
      // Re-assert room membership: a silent server restart drops rooms while
      // the client still believes it is connected.
      if (this.userId) {
        try { this.socket.emit('join_user', this.userId); } catch { /* */ }
      }
      return;
    }
    try { this.socket.connect(); } catch { /* */ }
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

  emitTyping(chatId: string | number, userId: string): void {
    if (!this.socket?.connected) return;
    try { this.socket.emit('typing', { chatId: Number(chatId), userId }); } catch { /* */ }
  }

  emitStopTyping(chatId: string | number, userId: string): void {
    if (!this.socket?.connected) return;
    try { this.socket.emit('stop_typing', { chatId: Number(chatId), userId }); } catch { /* */ }
  }

  onUserTyping(listener: TypingListener): () => void {
    this.userTypingListeners.add(listener);
    return () => this.userTypingListeners.delete(listener);
  }

  onNicknamesUpdated(listener: NicknamesUpdatedListener): () => void {
    this.nicknamesUpdatedListeners.add(listener);
    return () => this.nicknamesUpdatedListeners.delete(listener);
  }

  /** Tell the other end to play a word effect we just matched locally. */
  emitWordEffect(chatId: string | number, emoji: string, word: string): void {
    if (!this.socket?.connected || !emoji) return;
    try {
      this.socket.emit('word_effect', { chatId: Number(chatId), emoji, word });
    } catch { /* */ }
  }

  onGroupCallState(listener: GroupCallStateListener): () => void {
    this.groupCallStateListeners.add(listener);
    return () => this.groupCallStateListeners.delete(listener);
  }

  onWordEffect(listener: WordEffectListener): () => void {
    this.wordEffectListeners.add(listener);
    return () => this.wordEffectListeners.delete(listener);
  }

  onChatThemeUpdated(listener: ChatThemeUpdatedListener): () => void {
    this.chatThemeUpdatedListeners.add(listener);
    return () => this.chatThemeUpdatedListeners.delete(listener);
  }

  onUserStoppedTyping(listener: TypingListener): () => void {
    this.userStoppedTypingListeners.add(listener);
    return () => this.userStoppedTypingListeners.delete(listener);
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
