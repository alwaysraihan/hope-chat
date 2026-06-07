import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, ChevronRight, Clock, Star, Phone, Check, X, Video } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import FastImage from '@d11/react-native-fast-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import { IC_PROFILE } from '../assets';
import type { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken, selectHopenityProfile } from '../redux/features/auth/authSlice';
import { useChats } from '../context/ChatsContext';
import { openHopenityProfile } from '../services/hopenityLinking';
import {
  fetchMyBookings,
  confirmBooking,
  rejectBooking,
  completeBooking,
  type CallBooking,
} from '../services/premiumCallService';
import {
  getChatForBooking,
  setBookingForChat,
} from '../services/bookingChatMap';
import {
  getOrCreatePeerChatWithInfo,
  uploadChatMedia,
  sendHopenityChatMessage,
} from '../services/chatService';
import { currencyForCountry, convertFromUSD } from '../utils/currency';

type PeerInfo = { name: string; avatarUrl: string | null };

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'MyBookings'>;
type Tab = 'booked' | 'received';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  CallBooking['status'],
  { label: string; color: string; bg: string }
> = {
  PENDING:   { label: 'Pending',   color: '#B45309', bg: '#FEF3C7' },
  CONFIRMED: { label: 'Confirmed', color: colorss.primary, bg: `${colorss.primary}15` },
  IN_CALL:   { label: 'In Call',   color: '#059669', bg: '#D1FAE5' },
  COMPLETED: { label: 'Completed', color: '#374151', bg: '#F3F4F6' },
  CANCELLED: { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2' },
  NO_SHOW:   { label: 'No Show',   color: '#DC2626', bg: '#FEE2E2' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ─── BookingCard ──────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  role,
  peerInfo,
  viewerCurrency,
  onPress,
  onPressPeer,
  isOpening,
  isAccepting,
  isRejecting,
  isUploading,
  onAccept,
  onReject,
  onSendVideo,
}: {
  booking: CallBooking;
  role: Tab;
  peerInfo?: PeerInfo;
  viewerCurrency: string;
  onPress: () => void;
  onPressPeer: () => void;
  isOpening: boolean;
  isAccepting: boolean;
  isRejecting: boolean;
  isUploading: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onSendVideo?: () => void;
}) {
  const cfg = STATUS_CONFIG[booking.status];
  const isWish = booking.isHopeWish;
  const busy = isOpening || isAccepting || isRejecting || isUploading;

  // Accept/Reject shown to callee for non-wish PENDING bookings
  const showActions = role === 'received'
    && !isWish
    && booking.status === 'PENDING'
    && !!onAccept && !!onReject;

  // Send Video shown to callee for Hope Wish PENDING/CONFIRMED
  const showSendVideo = role === 'received'
    && isWish
    && (booking.status === 'PENDING' || booking.status === 'CONFIRMED')
    && !!onSendVideo;

  return (
    <TouchableOpacity
      style={c.card}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={busy}
    >
      {/* Icon + type */}
      <View style={c.cardTop}>
        <View style={[c.typeIcon, { backgroundColor: isWish ? '#FFF7ED' : `${colorss.primary}12` }]}>
          {isWish
            ? <Star size={20} color="#F97316" fill="#F97316" />
            : <Phone size={20} color={colorss.primary} />}
        </View>
        <View style={c.cardMeta}>
          <Text style={c.cardType}>{isWish ? 'Hope Wish (Video)' : 'Premium Call'}</Text>
          <Text style={c.cardSub}>
            {role === 'booked' ? 'You booked' : 'Request received'}
            {' · '}
            {isWish ? 'Video message' : `${booking.durationMinutes} min`}
            {booking.callType === 'group' ? ' · Group' : ''}
          </Text>
        </View>
        <View style={[c.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[c.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Peer — whom you booked / who booked you. Tap opens their Hopenity profile. */}
      <TouchableOpacity
        style={c.peerRow}
        onPress={onPressPeer}
        activeOpacity={0.7}
        hitSlop={{ top: 4, bottom: 4 }}
      >
        <FastImage
          source={peerInfo?.avatarUrl ? { uri: peerInfo.avatarUrl } : IC_PROFILE}
          style={c.peerAvatar}
          resizeMode={FastImage.resizeMode.cover}
        />
        <View style={{ flex: 1 }}>
          <Text style={c.peerLabel}>{role === 'booked' ? 'Booking with' : 'Booking from'}</Text>
          <Text style={c.peerName} numberOfLines={1}>{peerInfo?.name || 'Hopenity user'}</Text>
        </View>
        <ChevronRight size={16} color={colorss.textSecondary} />
      </TouchableOpacity>

      {/* Date/time */}
      <View style={c.infoRow}>
        <Calendar size={14} color={colorss.textSecondary} />
        <Text style={c.infoText}>{formatDate(booking.scheduledAt)}</Text>
        <Clock size={14} color={colorss.textSecondary} style={{ marginLeft: 12 }} />
        <Text style={c.infoText}>{formatTime(booking.scheduledAt)}</Text>
      </View>

      {/* Amount */}
      {booking.totalAmount > 0 && (
        <View style={c.amountRow}>
          <Text style={c.amountLabel}>
            {role === 'booked' ? 'You paid' : 'Your payout'}
          </Text>
          <Text style={c.amountVal}>
            {convertFromUSD(
              role === 'booked' ? booking.totalAmount : booking.calleePayout,
              viewerCurrency,
            ).display}
          </Text>
        </View>
      )}

      {/* Caller note (wish details) on received tab */}
      {role === 'received' && booking.callerNote ? (
        <View style={c.noteBox}>
          <Text style={c.noteText} numberOfLines={2}>{booking.callerNote}</Text>
        </View>
      ) : null}

      {/* Accept / Reject buttons for PENDING received calls */}
      {showActions && (
        <View style={c.actionsRow}>
          <TouchableOpacity
            style={[c.actionBtn, c.rejectBtn]}
            onPress={onReject}
            disabled={isRejecting || isAccepting}
          >
            {isRejecting
              ? <ActivityIndicator size="small" color="#DC2626" />
              : <><X size={14} color="#DC2626" /><Text style={c.rejectText}>Decline</Text></>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[c.actionBtn, c.acceptBtn]}
            onPress={onAccept}
            disabled={isAccepting || isRejecting}
          >
            {isAccepting
              ? <ActivityIndicator size="small" color={colorss.white} />
              : <><Check size={14} color={colorss.white} /><Text style={c.acceptText}>Accept</Text></>}
          </TouchableOpacity>
        </View>
      )}

      {/* Send Video Response for Hope Wish */}
      {showSendVideo && (
        <TouchableOpacity
          style={c.sendVideoBtn}
          onPress={onSendVideo}
          disabled={isUploading}
        >
          {isUploading
            ? <><ActivityIndicator size="small" color={colorss.white} /><Text style={c.sendVideoText}>Uploading…</Text></>
            : <><Video size={15} color={colorss.white} /><Text style={c.sendVideoText}>Send Video Response</Text></>}
        </TouchableOpacity>
      )}

      {/* Per-card loading overlay for chat open / upload */}
      {(isOpening || isUploading) && !showSendVideo && (
        <View style={c.cardOverlay}>
          <ActivityIndicator size="small" color={colorss.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const c = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colorss.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colorss.border,
    padding: 14,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  typeIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardMeta: { flex: 1 },
  cardType: { fontSize: 14, fontWeight: '700', color: colorss.textPrimary },
  cardSub:  { fontSize: 12, color: colorss.textSecondary, marginTop: 2 },
  badge: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', flexShrink: 0,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  peerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: colorss.background,
    borderRadius: 10,
  },
  peerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colorss.border,
  },
  peerLabel: { fontSize: 11, color: colorss.textSecondary, fontWeight: '500' },
  peerName:  { fontSize: 14, color: colorss.textPrimary, fontWeight: '700', marginTop: 1 },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText:  { fontSize: 13, color: colorss.textSecondary },
  amountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colorss.border,
  },
  amountLabel: { fontSize: 12, color: colorss.textSecondary, fontWeight: '500' },
  amountVal:   { fontSize: 15, fontWeight: '800', color: colorss.textPrimary },
  noteBox: {
    backgroundColor: colorss.background,
    borderRadius: 8, padding: 10,
  },
  noteText: { fontSize: 12, color: colorss.textSecondary, lineHeight: 17, fontStyle: 'italic' },

  actionsRow: {
    flexDirection: 'row', gap: 10,
    paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colorss.border,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10,
  },
  rejectBtn: { borderWidth: 1.5, borderColor: '#DC2626', backgroundColor: '#FFF5F5' },
  acceptBtn: { backgroundColor: colorss.primary },
  rejectText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  acceptText: { fontSize: 13, fontWeight: '700', color: colorss.white },

  sendVideoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#F97316',
    marginTop: 2,
  },
  sendVideoText: { fontSize: 13, fontWeight: '700', color: colorss.white },

  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MyBookingsScreen({ navigation }: Props) {
  const insets   = useSafeAreaInsets();
  const token    = useAppSelector(selectAuthToken);
  const profile  = useAppSelector(selectHopenityProfile);
  const viewerCurrency = currencyForCountry(profile?.country);
  const { conversations } = useChats();

  const [activeTab, setActiveTab] = useState<Tab>('booked');
  const [bookedList,   setBookedList]   = useState<CallBooking[]>([]);
  const [receivedList, setReceivedList] = useState<CallBooking[]>([]);
  const [loadingBooked,   setLoadingBooked]   = useState(true);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Cache of peer name/avatar by userId — fed from cached conversations first,
  // falling back to a lookup for peers we don't have a chat with locally yet.
  const [peerInfoMap, setPeerInfoMap] = useState<Record<string, PeerInfo>>({});

  // Per-card action states
  const [openingBookingId,  setOpeningBookingId]  = useState<number | null>(null);
  const [acceptingId,       setAcceptingId]        = useState<number | null>(null);
  const [rejectingId,       setRejectingId]        = useState<number | null>(null);
  const [uploadingBookingId, setUploadingBookingId] = useState<number | null>(null);

  const loadBooked = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchMyBookings('caller', token);
      setBookedList(data.sort((a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
      ));
    } catch {}
    setLoadingBooked(false);
  }, [token]);

  const loadReceived = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchMyBookings('callee', token);
      setReceivedList(data.sort((a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
      ));
    } catch {}
    setLoadingReceived(false);
  }, [token]);

  useEffect(() => {
    loadBooked();
    loadReceived();
  }, [loadBooked, loadReceived]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBooked(), loadReceived()]);
    setRefreshing(false);
  }, [loadBooked, loadReceived]);

  // ── Resolve peer name/avatar for booking cards.
  // Prefer the cached conversation (no network call); fall back to a one-time
  // lookup for peers we don't have a chat with locally yet (booking creation
  // already opens/creates the chat, so this should be rare).
  const getPeerInfo = useCallback((peerId: string): PeerInfo | undefined => {
    const fromConvo = conversations.find(cv => cv.peerUserId === peerId);
    if (fromConvo) return { name: fromConvo.name, avatarUrl: fromConvo.avatarUrl ?? null };
    return peerInfoMap[peerId];
  }, [conversations, peerInfoMap]);

  useEffect(() => {
    if (!token) return;
    const allPeerIds = [...bookedList.map(b => b.calleeId), ...receivedList.map(b => b.callerId)];
    const missing = Array.from(new Set(
      allPeerIds.filter(id => !!id && !getPeerInfo(id)),
    ));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map(id => getOrCreatePeerChatWithInfo(id, token))).then(results => {
      if (cancelled) return;
      setPeerInfoMap(prev => {
        const next = { ...prev };
        missing.forEach((id, i) => {
          const info = results[i];
          if (info) next[id] = { name: info.peerName, avatarUrl: info.peerAvatarUrl };
        });
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [token, bookedList, receivedList, getPeerInfo]);

  // ── Resolve or create the chat for a booking, returns chatId + peer info
  const resolveChatInfo = useCallback(async (booking: CallBooking, role: Tab) => {
    const peerId = role === 'booked' ? booking.calleeId : booking.callerId;
    const cached = getChatForBooking(booking.id);
    // Always fetch peer info for fresh name/avatar — POST /api/v1/chats is idempotent.
    const info = await getOrCreatePeerChatWithInfo(peerId, token!);
    if (!info) return null;
    const chatId = cached ?? info.chatId;
    if (!cached) setBookingForChat(chatId, booking.id);
    return { ...info, chatId };
  }, [token]);

  // ── Open chat
  const openChat = useCallback(async (booking: CallBooking, role: Tab) => {
    if (!token || openingBookingId != null) return;
    setOpeningBookingId(booking.id);
    try {
      const peerId = role === 'booked' ? booking.calleeId : booking.callerId;
      const info = await resolveChatInfo(booking, role);
      if (!info) return;

      // Build a minimal seed so InboxGate can render immediately even when
      // this chat is not yet in the cached conversations list (e.g. just created
      // or user navigating before the list refreshed).
      const peerName     = (info as any).peerName as string | undefined;
      const peerAvatar   = (info as any).peerAvatarUrl as string | null | undefined;
      const seedConversation = {
        id:          info.chatId,
        name:        peerName ?? '',
        preview:     '',
        time:        '',
        unreadCount: 0,
        avatarUrl:   peerAvatar ?? null,
        peerUserId:  peerId,
        messages:    [] as any[],
      };

      navigation.navigate('Inbox', {
        conversationId:   info.chatId,
        displayName:      peerName,
        avatarUrl:        peerAvatar ?? null,
        bookingId:        booking.id,
        messagingEnabled: booking.messagingEnabled,
        isGroupBooking:   booking.callType === 'group',
        seedConversation,
      });
    } finally {
      setOpeningBookingId(null);
    }
  }, [token, openingBookingId, navigation, resolveChatInfo]);

  // ── Accept booking (creator confirms a pending call)
  const handleAccept = useCallback(async (booking: CallBooking) => {
    if (!token || acceptingId != null) return;
    setAcceptingId(booking.id);
    try {
      const ok = await confirmBooking(booking.id, token);
      if (ok) {
        setReceivedList(prev => prev.map(b =>
          b.id === booking.id ? { ...b, status: 'CONFIRMED' } : b,
        ));
      } else {
        Alert.alert('Error', 'Could not confirm booking. Please try again.');
      }
    } finally {
      setAcceptingId(null);
    }
  }, [token, acceptingId]);

  // ── Reject booking
  const handleReject = useCallback(async (booking: CallBooking) => {
    if (!token || rejectingId != null) return;
    Alert.alert(
      'Decline Booking',
      'Are you sure you want to decline this booking? The caller will be refunded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setRejectingId(booking.id);
            try {
              const ok = await rejectBooking(booking.id, token);
              if (ok) {
                setReceivedList(prev => prev.map(b =>
                  b.id === booking.id ? { ...b, status: 'CANCELLED' } : b,
                ));
              } else {
                Alert.alert('Error', 'Could not decline booking. Please try again.');
              }
            } finally {
              setRejectingId(null);
            }
          },
        },
      ],
    );
  }, [token, rejectingId]);

  // ── Hope Wish: pick video, upload, send as message, mark complete
  const handleSendVideoResponse = useCallback(async (booking: CallBooking) => {
    if (!token || uploadingBookingId != null) return;

    launchImageLibrary(
      { mediaType: 'video', videoQuality: 'low', selectionLimit: 1 },
      async response => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset?.uri) return;

        setUploadingBookingId(booking.id);
        try {
          // Get/create the chat thread
          const info = await resolveChatInfo(booking, 'received');
          if (!info) {
            Alert.alert('Error', 'Could not find the chat thread. Please try again.');
            return;
          }

          // Upload video to CDN
          const remoteUri = await uploadChatMedia(asset.uri, 'video', token);
          if (!remoteUri) {
            Alert.alert('Upload Failed', 'Could not upload the video. Please try again.');
            return;
          }

          // Send the video URL as a chat message (renders as video on both sides)
          await sendHopenityChatMessage(info.chatId, remoteUri, token);

          // Mark the booking as completed
          await completeBooking(booking.id, token);

          // Reflect in local state
          setReceivedList(prev => prev.map(b =>
            b.id === booking.id ? { ...b, status: 'COMPLETED' } : b,
          ));

          // Navigate to chat so creator sees the sent video
          navigation.navigate('Inbox', {
            conversationId: info.chatId,
            bookingId: booking.id,
            messagingEnabled: booking.messagingEnabled,
          });
        } finally {
          setUploadingBookingId(null);
        }
      },
    );
  }, [token, uploadingBookingId, resolveChatInfo, navigation]);

  const currentList    = activeTab === 'booked' ? bookedList    : receivedList;
  const currentLoading = activeTab === 'booked' ? loadingBooked : loadingReceived;

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={s.nav}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={22} color={colorss.textPrimary} />
        </TouchableOpacity>
        <Text style={s.navTitle}>My Bookings</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {([
          { key: 'booked',   label: 'Booked',   count: bookedList.length },
          { key: 'received', label: 'Received',  count: receivedList.length },
        ] as { key: Tab; label: string; count: number }[]).map(({ key, label, count }) => (
          <TouchableOpacity
            key={key}
            style={[s.tab, activeTab === key && s.tabActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[s.tabText, activeTab === key && s.tabTextActive]}>
              {label}
              {count > 0 ? ` (${count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {currentLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colorss.primary} />
          <Text style={s.loadingText}>Loading bookings…</Text>
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => {
            const peerId = activeTab === 'booked' ? item.calleeId : item.callerId;
            return (
              <BookingCard
                booking={item}
                role={activeTab}
                peerInfo={getPeerInfo(peerId)}
                viewerCurrency={viewerCurrency}
                onPress={() => openChat(item, activeTab)}
                onPressPeer={() => openHopenityProfile(peerId)}
                isOpening={openingBookingId === item.id}
                isAccepting={acceptingId === item.id}
                isRejecting={rejectingId === item.id}
                isUploading={uploadingBookingId === item.id}
                onAccept={activeTab === 'received' ? () => handleAccept(item) : undefined}
                onReject={activeTab === 'received' ? () => handleReject(item) : undefined}
                onSendVideo={activeTab === 'received' ? () => handleSendVideoResponse(item) : undefined}
              />
            );
          }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colorss.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>
                {activeTab === 'booked' ? '📅' : '📥'}
              </Text>
              <Text style={s.emptyTitle}>
                {activeTab === 'booked' ? 'No bookings yet' : 'No requests yet'}
              </Text>
              <Text style={s.emptySub}>
                {activeTab === 'booked'
                  ? 'When you book a call or Hope Wish, it will appear here.'
                  : 'When someone books a call with you, it will appear here.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorss.background },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colorss.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colorss.border,
  },
  navTitle: { fontSize: 17, fontWeight: '700', color: colorss.textPrimary },

  tabBar: {
    flexDirection: 'row', backgroundColor: colorss.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colorss.border,
  },
  tab:          { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabActive:    { borderBottomWidth: 2.5, borderBottomColor: colorss.primary },
  tabText:      { fontSize: 14, fontWeight: '600', color: colorss.textSecondary },
  tabTextActive:{ color: colorss.primary },

  list:        { paddingTop: 16, paddingBottom: 40 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 14, color: colorss.textSecondary },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingTop: 80, gap: 10,
  },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colorss.textPrimary, textAlign: 'center' },
  emptySub:   { fontSize: 13, color: colorss.textSecondary, textAlign: 'center', lineHeight: 19 },
});
