import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';

/** Emitting this event from anywhere (e.g. FCM handler) triggers an immediate inbox reload. */
export const RELOAD_CHAT_LIST_EVENT = 'hopechat:reload_chat_list';
const POLL_INTERVAL_MS = 30_000;
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
  clearAuth,
  selectAuthToken,
  selectHopenityProfile,
} from '../redux/features/auth/authSlice';
import {
  fetchHopenityChatDirectory,
  formatChatTime,
  HopenityChatItem,
} from '../services/chatService';
import { formatChatListPreview } from '../services/chatMessagePreview';
import type { ApiLastMessageLike } from '../services/chatMessagePreview';
import {
  deriveConversationMessageKey,
  maybeDecryptContent,
} from '../services/e2ee/conversationCrypto';
import type { ExtendedMessage } from '../components/types/chat';
import {
  appendCallLogToThreadCache,
  getHiddenConversationIds,
  readChatDirectoryCache,
  writeChatDirectoryCache,
} from '../services/offlineCache';
import {
  CALL_OUTCOME_EVENT,
  emitCallOutcomeApplied,
  formatCallOutcomeLine,
  type CallOutcomePayload,
} from '../services/callOutcomeBus';
import { persistCallOutcomeChatMessage } from '../services/callLogPersist';
import { normalizeChatUserId } from '../utils/chatUserId';
import { getLocalNickname } from '../services/nicknameCache';
import { getPinnedConversationIds, getMutedConversationIds } from '../services/chatPrefs';

export type ConversationSummary = {
  id: string;
  name: string;
  emoji?: string;
  bgFrom?: string;
  bgTo?: string;
  preview: string;
  time: string;
  unreadCount: number;
  isOnline?: boolean;
  /** ISO or ms from server — shown when peer is not online */
  lastSeenAt?: string | number | null;
  isUnread?: boolean;
  isGroup?: boolean;
  groupName?: string | null;
  groupPhotoUrl?: string | null;
  groupAdminUserIds?: string[];
  isTyping?: boolean;
  avatarUrl?: string | null;
  /** Recipient must accept this REQUESTED chat before replying (server-enforced). */
  needsAcceptance?: boolean;
  /** True when the local user sent the initial request and the other side hasn't accepted yet. */
  isSentRequest?: boolean;
  /** Other user in a 1:1 chat — used for E2EE key agreement + previews. */
  peerUserId?: string | null;
  /** Server-provided chat chrome (optional); merged in Inbox with local theme prefs. */
  remoteWallpaperUrl?: string | null;
  remoteThemePresetId?: number | null;
  remoteReactionPalette?: string[] | null;
  /** From chat list / peer profile — drives home + Story tab rings when set. */
  peerHasActiveStory?: boolean;
  peerStoryCount?: number;
  unviewedStoryCount?: number;
  /** Group-only: total member count (including self). */
  groupMemberCount?: number;
  /** Group-only: how many members are currently online. */
  groupOnlineCount?: number;
  /** True when this chat came from the v1 API (has conversationKey). v2-native chats need v2 endpoints. */
  isV1Chat?: boolean;
  /** Client-side pin flag — stored in MMKV, pinned chats sort to the top of the inbox. */
  pinned?: boolean;
  /** Client-side mute flag — stored in MMKV, muted chats suppress notifications. */
  isMuted?: boolean;
  messages: ExtendedMessage[];
};

type ChatsContextValue = {
  conversations: ConversationSummary[];
  setConversations: React.Dispatch<React.SetStateAction<ConversationSummary[]>>;
  bumpUnread: (conversationId: string, delta?: number) => void;
  reloadConversations: () => Promise<void>;
  listLoading: boolean;
  /** Pending REQUESTED chats folder — surfaced beside Requests UI */
  pendingRequestCount: number;
};

const ChatsContext = createContext<ChatsContextValue | null>(null);

export function useChats(): ChatsContextValue {
  const ctx = useContext(ChatsContext);
  if (!ctx) {
    throw new Error('useChats must be used within ChatsProvider');
  }
  return ctx;
}

function peerSide(
  chat: HopenityChatItem,
  localUserId: string | number,
): 'A' | 'B' | null {
  const localId =
    normalizeChatUserId(localUserId) || String(localUserId ?? '');
  const a =
    chat.userAId != null && String(chat.userAId) !== ''
      ? String(chat.userAId)
      : '';
  const b =
    chat.userBId != null && String(chat.userBId) !== ''
      ? String(chat.userBId)
      : '';

  const aN = normalizeChatUserId(a) || a;
  const bN = normalizeChatUserId(b) || b;

  if (aN && aN === localId) return 'B';
  if (bN && bN === localId) return 'A';

  if (aN && !bN) return aN !== localId ? 'A' : null;
  if (bN && !aN) return bN !== localId ? 'B' : null;

  if (aN && bN) {
    if (aN !== localId && bN === localId) return 'A';
    if (bN !== localId && aN === localId) return 'B';
    if (aN !== localId) return 'A';
    if (bN !== localId) return 'B';
  }

  return null;
}

function profileFromParticipants(
  chat: HopenityChatItem,
  localUserId: string | number,
): { name: string; image: string | null } | null {
  const localId =
    normalizeChatUserId(localUserId) || String(localUserId ?? '');
  const parts = chat.participants ?? [];
  for (const p of parts) {
    const pid = String(
      p.user_id ?? (p as { id?: string }).id ?? '',
    );
    const pidN = normalizeChatUserId(pid) || pid;
    if (pidN && pidN !== localId) {
      return { name: p.name ?? 'Chat', image: p.image ?? null };
    }
  }
  return null;
}

/** Other participant in a 1:1 chat (for title/avatar — avoids mixing up A/B). */
function getRemoteParticipantId(
  chat: HopenityChatItem,
  localUserId: string | number,
): string | null {
  const L = normalizeChatUserId(localUserId) || String(localUserId ?? '');
  const a =
    chat.userAId != null && String(chat.userAId) !== ''
      ? String(chat.userAId)
      : '';
  const b =
    chat.userBId != null && String(chat.userBId) !== ''
      ? String(chat.userBId)
      : '';

  const aN = normalizeChatUserId(a) || a;
  const bN = normalizeChatUserId(b) || b;

  if (aN && aN === L && bN) return b;
  if (bN && bN === L && aN) return a;
  if (aN && aN !== L) return a;
  if (bN && bN !== L) return b;

  const req =
    chat.requestedById != null && String(chat.requestedById) !== ''
      ? String(chat.requestedById)
      : '';
  const reqN = normalizeChatUserId(req) || req;
  if (reqN && reqN !== L) return req;

  for (const p of chat.participants ?? []) {
    const pid = String(
      p.user_id ?? (p as { id?: string }).id ?? '',
    );
    const pidN = normalizeChatUserId(pid) || pid;
    if (pidN && pidN !== L) return pid;
  }
  return null;
}

/** Profile for a specific user id in this chat row (userA / userB / participants). */
function profileForUserId(
  chat: HopenityChatItem,
  userId: string,
): { name: string; image: string | null } | null {
  const uid = String(userId);
  const a =
    chat.userAId != null && String(chat.userAId) !== ''
      ? String(chat.userAId)
      : '';
  const b =
    chat.userBId != null && String(chat.userBId) !== ''
      ? String(chat.userBId)
      : '';
  if (a && uid === a) return displayParticipantProfile(chat, 'A');
  if (b && uid === b) return displayParticipantProfile(chat, 'B');
  for (const p of chat.participants ?? []) {
    const pid = String(p.user_id ?? (p as { id?: string }).id ?? '');
    if (pid === uid) {
      return { name: p.name ?? 'Chat', image: p.image ?? null };
    }
  }
  return null;
}

function displayParticipantProfile(
  chat: HopenityChatItem,
  side: 'A' | 'B',
): { name: string; image: string | null } {
  const isPage =
    side === 'A' ? chat.userAProfileType === 'PAGE' : chat.userBProfileType === 'PAGE';
  const pageMeta = side === 'A' ? chat.userAPage : chat.userBPage;
  const user = side === 'A' ? chat.userA : chat.userB;
  if (isPage) {
    return {
      name: pageMeta?.name ?? user?.name ?? 'Page',
      image: pageMeta?.image ?? user?.image ?? null,
    };
  }
  return {
    name: user?.name ?? 'Chat',
    image: user?.image ?? null,
  };
}

export function resolveChatTitleForPeer(
  chat: HopenityChatItem,
  localUserId: string | number,
): { name: string; avatarUrl: string | null; isGroup: boolean } {
  // Use the explicit isGroup flag when present (returned by the v2/groups endpoint).
  // Fall back to participants array detection: ≥ 2 participants means a group
  // (a 1:1 thread uses userA/userB and never has a participants array).
  const isGroup =
    Boolean(chat.isGroup) || (chat.participants?.length ?? 0) >= 2;
  const groupName =
    (chat as any).groupName ||
    chat.participants?.map(p => p.name).filter(Boolean).join(', ');

  if (isGroup) {
    const peerSideLetter = peerSide(chat, localUserId);
    const fromParticipant =
      peerSideLetter == null
        ? profileFromParticipants(chat, localUserId)
        : null;
    const peer = peerSideLetter
      ? displayParticipantProfile(chat, peerSideLetter)
      : fromParticipant ?? { name: 'Chat', image: null };
    return {
      name: groupName || peer.name,
      avatarUrl: peer.image,
      isGroup: true,
    };
  }

  const L = normalizeChatUserId(localUserId) || String(localUserId ?? '');
  const st = String(chat.status ?? '').toUpperCase();
  if (st === 'REQUESTED' && chat.requestedById != null) {
    const rid = normalizeChatUserId(chat.requestedById) || String(chat.requestedById);
    if (rid && rid !== L) {
      const incoming = profileForUserId(chat, rid);
      if (incoming) {
        return {
          name: incoming.name,
          avatarUrl: incoming.image,
          isGroup: false,
        };
      }
    }
    if (rid && rid === L) {
      const otherId = getRemoteParticipantId(chat, localUserId);
      if (otherId) {
        const outgoingPeer = profileForUserId(chat, otherId);
        if (outgoingPeer) {
          return {
            name: outgoingPeer.name,
            avatarUrl: outgoingPeer.image,
            isGroup: false,
          };
        }
      }
    }
  }

  const remoteId = getRemoteParticipantId(chat, localUserId);
  const fromRemoteId = remoteId
    ? profileForUserId(chat, remoteId)
    : null;

  const peerSideLetter = peerSide(chat, localUserId);
  const fromParticipant =
    peerSideLetter == null
      ? profileFromParticipants(chat, localUserId)
      : null;
  const peer =
    fromRemoteId ??
    (peerSideLetter
      ? displayParticipantProfile(chat, peerSideLetter)
      : fromParticipant ?? { name: 'Chat', image: null });

  return {
    name: peer.name,
    avatarUrl: peer.image,
    isGroup: false,
  };
}

function asRecord(o: unknown): Record<string, unknown> | null {
  return o && typeof o === 'object' ? (o as Record<string, unknown>) : null;
}

function coalesceOnline(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  return undefined;
}

function coalesceLastSeen(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function sameChatParticipant(a?: string | null, b?: string | null): boolean {
  if (a == null || b == null || a === '' || b === '') return false;
  const an = normalizeChatUserId(String(a)) || String(a);
  const bn = normalizeChatUserId(String(b)) || String(b);
  if (an === bn) return true;
  if (/^\d+$/.test(an) && /^\d+$/.test(bn) && Number(an) === Number(bn)) {
    return true;
  }
  return false;
}

/**
 * Best-effort peer presence from chat list row (userA/userB/participants or top-level flags).
 */
function extractPeerPresence(
  chat: HopenityChatItem,
  localUserId: string | number,
): { isOnline?: boolean; lastSeenAt?: string | null } {
  const rid = getRemoteParticipantId(chat, localUserId);

  let isOnline: boolean | undefined;
  let lastSeenAt: string | null = null;

  const row = asRecord(chat);
  if (row) {
    const topOn = coalesceOnline(
      row.peerOnline ?? row.isPeerOnline ?? row.otherUserOnline,
    );
    if (topOn !== undefined) isOnline = topOn;
    const topLs = coalesceLastSeen(
      row.peerLastSeen ?? row.lastSeen ?? row.last_seen,
    );
    if (topLs) lastSeenAt = topLs;
  }

  const tryProfile = (u: unknown, sideUserId?: string | null) => {
    if (!rid || !u) return;
    const r = asRecord(u);
    if (!r) return;
    const candidate = sideUserId
      ? String(sideUserId)
      : String(r.user_id ?? r.userId ?? r.id ?? r._id ?? '');
    if (!sameChatParticipant(candidate, rid)) return;
    const on = coalesceOnline(r.isOnline ?? r.online ?? r.is_active ?? r.active);
    if (on !== undefined) isOnline = on;
    const ls = coalesceLastSeen(
      r.lastSeen ?? r.last_seen ?? r.lastSeenAt ?? r.lastActiveAt,
    );
    if (ls) lastSeenAt = ls;
  };

  tryProfile(
    chat.userA,
    chat.userAId != null ? String(chat.userAId) : undefined,
  );
  tryProfile(
    chat.userB,
    chat.userBId != null ? String(chat.userBId) : undefined,
  );
  for (const p of chat.participants ?? []) {
    tryProfile(p, undefined);
  }

  return { isOnline, lastSeenAt };
}

function readStoryBoolFromRecord(src: Record<string, unknown>): boolean | undefined {
  let sawFalse = false;
  for (const key of [
    'peerHasActiveStory',
    'peer_has_active_story',
    'hasActiveStory',
    'has_active_story',
    'activeStory',
  ] as const) {
    const v = src[key];
    if (v === true) return true;
    if (v === false) sawFalse = true;
  }
  if (sawFalse) return false;
  return undefined;
}

function readPositiveIntFromRecord(
  src: Record<string, unknown>,
  keys: readonly string[],
): number | undefined {
  for (const k of keys) {
    const v = src[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      return Math.min(1_000_000, Math.floor(v));
    }
  }
  return undefined;
}

function readStoryHintsFromChat(
  chat: HopenityChatItem,
  peerUserNorm: string | null,
): {
  peerHasActiveStory?: boolean;
  peerStoryCount?: number;
  unviewedStoryCount?: number;
} {
  let peerHasActiveStory: boolean | undefined;
  let peerStoryCount: number | undefined;
  let unviewedStoryCount: number | undefined;

  const merge = (src: Record<string, unknown> | null) => {
    if (!src) return;
    const b = readStoryBoolFromRecord(src);
    if (b === true) peerHasActiveStory = true;
    else if (peerHasActiveStory !== true && b === false) peerHasActiveStory = false;
    peerStoryCount ??= readPositiveIntFromRecord(src, [
      'peerStoryCount',
      'peer_story_count',
    ]);
    unviewedStoryCount ??= readPositiveIntFromRecord(src, [
      'unviewedStoryCount',
      'unviewed_story_count',
      'peerUnviewedStoryCount',
    ]);
  };

  merge(asRecord(chat));

  if (peerUserNorm) {
    const tryProfile = (u: unknown, sideUserId?: string | null) => {
      const r = asRecord(u);
      if (!r) return;
      const candidate = sideUserId
        ? String(sideUserId)
        : String(r.user_id ?? r.userId ?? r.id ?? r._id ?? '');
      if (!sameChatParticipant(candidate, peerUserNorm)) return;
      merge(r);
    };

    tryProfile(
      chat.userA,
      chat.userAId != null ? String(chat.userAId) : undefined,
    );
    tryProfile(
      chat.userB,
      chat.userBId != null ? String(chat.userBId) : undefined,
    );
    for (const p of chat.participants ?? []) {
      tryProfile(p, undefined);
    }
  }

  return { peerHasActiveStory, peerStoryCount, unviewedStoryCount };
}

/** Maps API chat row → home/list row (no seeded GiftedChat messages — Inbox loads history via API). */
export function mapChatItemToSummary(
  chat: HopenityChatItem,
  localUser: { _id: string | number; name: string },
): ConversationSummary {
  const localId =
    normalizeChatUserId(localUser._id) || String(localUser._id ?? '');
  const { name, avatarUrl, isGroup } = resolveChatTitleForPeer(chat, localUser._id);

  const peerUserNorm = !isGroup
    ? (() => {
        const rid = getRemoteParticipantId(chat, localUser._id);
        return rid ? normalizeChatUserId(rid) || rid : null;
      })()
    : null;

  const lastRaw =
    chat.messages?.[0] ??
    (chat.lastMessage ? chat.lastMessage : {});
  const created = lastRaw.createdAt ?? lastRaw.created_at;

  let lastForPreview = lastRaw as ApiLastMessageLike;
  if (
    peerUserNorm &&
    typeof lastForPreview.content === 'string' &&
    lastForPreview.content.startsWith('HC1:')
  ) {
    const key = deriveConversationMessageKey(
      localId,
      peerUserNorm,
      String(chat.id ?? ''),
    );
    lastForPreview = {
      ...lastForPreview,
      content: maybeDecryptContent(lastForPreview.content, key),
    };
  }

  const preview = formatChatListPreview(lastForPreview, localId);
  const time = formatChatTime(created);

  const isRequested = String(chat.status ?? '').toUpperCase() === 'REQUESTED';
  // Incoming request: the other user initiated it and we haven't accepted yet.
  const needsAcceptance =
    isRequested &&
    (
      chat.requestedById == null ||
      normalizeChatUserId(String(chat.requestedById)) !== localId
    );
  // Outgoing request: we initiated it and the other side hasn't accepted yet.
  const isSentRequest =
    isRequested &&
    chat.requestedById != null &&
    normalizeChatUserId(String(chat.requestedById)) === localId;

  const ct = chat.chatTheme;

  const presence = extractPeerPresence(chat, localUser._id);
  const storyHints = readStoryHintsFromChat(chat, peerUserNorm);

  const chatIdStr = String(chat.id ?? `${chat.userAId ?? ''}-${chat.userBId ?? ''}`);

  // Apply local nickname override: if the user set a nickname for the peer in
  // this conversation, show it instead of the real name in the chat list.
  const displayName =
    !isGroup && peerUserNorm
      ? (getLocalNickname(chatIdStr, peerUserNorm) || name)
      : name;

  const participants = chat.participants ?? [];
  const groupMemberCount = isGroup && participants.length > 0 ? participants.length : undefined;
  const groupOnlineCount = isGroup && participants.length > 0
    ? participants.filter(p => {
        const r = p as Record<string, unknown>;
        return r.isOnline === true || r.online === true || r.is_active === true;
      }).length
    : undefined;

  return {
    id: chatIdStr,
    name: displayName,
    preview,
    time,
    isV1Chat: !!chat.conversationKey,
    unreadCount: chat.unreadCount ?? 0,
    isGroup,
    groupName: isGroup ? ((chat.groupName ?? null) as string | null) : undefined,
    groupPhotoUrl: isGroup ? ((chat.groupPhotoUrl ?? null) as string | null) : undefined,
    groupAdminUserIds: isGroup ? (chat.groupAdminUserIds ?? []) : undefined,
    groupMemberCount,
    groupOnlineCount,
    isUnread: (chat.unreadCount ?? 0) > 0,
    avatarUrl: isGroup ? (chat.groupPhotoUrl ?? avatarUrl) : avatarUrl,
    isOnline: isGroup ? undefined : presence.isOnline,
    lastSeenAt: isGroup ? null : (presence.lastSeenAt ?? null),
    needsAcceptance,
    isSentRequest,
    peerUserId: peerUserNorm,
    peerHasActiveStory: storyHints.peerHasActiveStory,
    peerStoryCount: storyHints.peerStoryCount,
    unviewedStoryCount: storyHints.unviewedStoryCount,
    remoteWallpaperUrl: ct?.wallpaperUrl ?? null,
    remoteThemePresetId:
      ct?.themePresetId != null ? Number(ct.themePresetId) : null,
    remoteReactionPalette: ct?.reactionEmojiPalette ?? null,
    messages: [],
  };
}

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const giftedChatUser = useAppSelector(s => s.auth.giftedChatUser);
  const hopenityProfile = useAppSelector(selectHopenityProfile);
  const activePage = useAppSelector(s => s.auth.activePage);
  const localUser = useMemo(() => {
    const id =
      normalizeChatUserId(giftedChatUser?._id) ||
      normalizeChatUserId(hopenityProfile?.userId) ||
      'me';
    return {
      _id: id,
      name:
        giftedChatUser?.name ??
        hopenityProfile?.displayName ??
        'You',
    };
  }, [giftedChatUser, hopenityProfile]);

  const token = useAppSelector(selectAuthToken);
  const [listLoading, setListLoading] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [conversations, setConversations] = useState<ConversationSummary[]>(
    () => [],
  );

  useLayoutEffect(() => {
    const uid = String(localUser._id ?? '');
    if (!token || uid === 'me') return;
    const cached = readChatDirectoryCache(uid);
    if (cached && cached.length > 0) {
      const hidden = new Set(getHiddenConversationIds());
      const pinnedIds = new Set(getPinnedConversationIds());
      const visible = cached
        .filter(c => !hidden.has(c.id))
        .map(c => ({ ...c, pinned: pinnedIds.has(c.id) }));
      setConversations([
        ...visible.filter(c => c.pinned),
        ...visible.filter(c => !c.pinned),
      ]);
    }
  }, [token, localUser._id]);

  const activePageIdRef = useRef<string | null>(activePage?.id ?? null);
  // Always-current ref so the CALL_OUTCOME_EVENT handler can look up a conversation
  // without becoming a stale closure (conversations is not in that effect's deps).
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  // When the active page changes, show a loading state immediately so the inbox
  // feels instant (like Messenger) — the reload will overwrite the list when
  // the API responds.  We no longer blank the list here because a blank screen
  // is more jarring than briefly seeing the previous account's conversations.
  useEffect(() => {
    const prev = activePageIdRef.current;
    const next = activePage?.id ?? null;
    if (prev !== next) {
      activePageIdRef.current = next;
      setListLoading(true);
    }
  }, [activePage]);

  const reloadConversations = useCallback(async () => {
    if (!token) {
      setConversations([]);
      setPendingRequestCount(0);
      setListLoading(false);
      return;
    }

    setListLoading(true);
    try {
      const { chats, counts, httpStatus } = await fetchHopenityChatDirectory(token, {
        status: 'inbox',
        limit: 50,
        offset: 0,
        // When a page is active, fetch that page's conversations
        ...(activePage ? { pageId: Number(activePage.id) } : {}),
      });

      if (httpStatus === 401) {
        dispatch(clearAuth());
        setConversations([]);
        setPendingRequestCount(0);
        return;
      }

      const hidden = new Set(getHiddenConversationIds());
      const pinnedIds = new Set(getPinnedConversationIds());
      const mutedIds = new Set(getMutedConversationIds());
      // In page mode the page is one of the conversation participants, so use
      // the page's ID as the "local" identity to correctly find the peer.
      const effectiveLocalUser = activePage
        ? { _id: activePage.id, name: activePage.name }
        : localUser;
      const mapped = chats
        .map(chat => mapChatItemToSummary(chat, effectiveLocalUser))
        .filter(c => !hidden.has(c.id))
        .map(c => ({
          ...c,
          pinned: pinnedIds.has(c.id),
          isMuted: mutedIds.has(c.id),
        }));
      // Pinned chats sort to the top; within each group order is preserved from server.
      const next = [
        ...mapped.filter(c => c.pinned),
        ...mapped.filter(c => !c.pinned),
      ];
      setPendingRequestCount(mapped.filter(c => c.needsAcceptance).length);
      setConversations(next);
      // Only cache personal-mode results — page inbox is transient and should
      // never appear after switching back to personal account.
      if (!activePage) {
        writeChatDirectoryCache(String(localUser._id ?? ''), next);
      }
    } catch (err) {
      console.error('[ChatsProvider] fetchHopenityChatDirectory error:', err);
    } finally {
      setListLoading(false);
    }
  }, [dispatch, localUser, token, activePage]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await reloadConversations();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadConversations]);

  // Re-sort the conversation list every time the app returns to the foreground.
  // This picks up messages sent by others while the app was backgrounded so
  // group and personal chats reflect the correct latest-message order.
  useEffect(() => {
    if (!token) return undefined;
    let lastState = AppState.currentState;
    const sub = AppState.addEventListener('change', nextState => {
      if (lastState !== 'active' && nextState === 'active') {
        void reloadConversations();
      }
      lastState = nextState;
    });
    return () => sub.remove();
  }, [token, reloadConversations]);

  // Poll every 30s while foregrounded so new messages & requests appear without
  // requiring the user to background/foreground the app.
  useEffect(() => {
    if (!token) return undefined;
    const id = setInterval(() => {
      if (AppState.currentState === 'active') {
        void reloadConversations();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, reloadConversations]);

  // Instant reload when something (e.g. FCM new-message notification) fires the event.
  useEffect(() => {
    if (!token) return undefined;
    const sub = DeviceEventEmitter.addListener(RELOAD_CHAT_LIST_EVENT, () => {
      void reloadConversations();
    });
    return () => sub.remove();
  }, [token, reloadConversations]);

  useEffect(() => {
    if (!token) return undefined;
    const sub = DeviceEventEmitter.addListener(
      CALL_OUTCOME_EVENT,
      (p: CallOutcomePayload) => {
        const line = formatCallOutcomeLine(p);

        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === p.conversationId);
          if (idx < 0) return prev;
          const iso = new Date().toISOString();
          const row = {
            ...prev[idx],
            preview: line,
            time: formatChatTime(iso),
          };
          const next = [row, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
          const uidStr = String(localUser._id ?? '');
          if (uidStr && uidStr !== 'me') {
            writeChatDirectoryCache(uidStr, next);
          }
          return next;
        });

        const persist = async () => {
          const loc =
            normalizeChatUserId(String(localUser._id ?? '')) ||
            String(localUser._id ?? '');
          let uid = loc;
          let uname =
            typeof localUser.name === 'string' ? localUser.name : 'You';
          if (p.variant === 'incoming_missed') {
            const pu = p.peerUserId?.trim();
            if (pu) {
              uid = normalizeChatUserId(pu) || pu;
              uname = p.peerDisplayName ?? uname;
            }
          }
          const offlineMsg: ExtendedMessage = {
            _id: `call_evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            text: line,
            createdAt: new Date(),
            user: { _id: uid, name: uname },
            messageKind: 'call_log',
          };

          let finalMsg: ExtendedMessage = offlineMsg;
          if (token) {
            try {
              // Derive isGroup from the conversation summary so the persisted
              // call log uses the v2 endpoint for group chats (v1 returns 403).
              // Use conversationsRef to avoid stale closure (this handler is not
              // re-created when conversations changes).
              const conv = conversationsRef.current.find(c => c.id === p.conversationId);
              const saved = await persistCallOutcomeChatMessage(
                p,
                line,
                token,
                localUser,
                !!conv?.isGroup,
              );
              if (saved) {
                finalMsg = saved;
              }
            } catch (e) {
              console.warn('[ChatsProvider] persist call log failed', e);
            }
          }

          appendCallLogToThreadCache(p.conversationId, finalMsg);
          emitCallOutcomeApplied({
            conversationId: p.conversationId,
            message: finalMsg,
          });
        };
        persist().catch(e => {
          console.warn('[ChatsProvider] persist call log', e);
        });
      },
    );
    return () => sub.remove();
  }, [token, localUser]);

  const bumpUnread = useCallback((conversationId: string, delta = 1) => {
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId
          ? { ...c, unreadCount: Math.max(0, c.unreadCount + delta) }
          : c,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({
      conversations,
      setConversations,
      bumpUnread,
      reloadConversations,
      listLoading,
      pendingRequestCount,
    }),
    [bumpUnread, conversations, listLoading, pendingRequestCount, reloadConversations],
  );

  return (
    <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
  );
}
