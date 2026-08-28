/**
 * Booking / Hope Wish confirmation card.
 *
 * The wire format stays plain multi-line text (see `formatBookingCardMessage`)
 * so web and older clients still render something readable; this component
 * renders the parsed payload as a real card. Status is refreshed from
 * `/premium-calls/bookings` on mount so both ends see the live value rather
 * than the "PENDING" that was baked in when the message was sent.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Sparkles,
  Video,
  Wallet,
} from 'lucide-react-native';

import type { BookingCardPayload, BookingCardStatus } from '../types/chat';
import { useAppSelector } from '../../hooks/redux';
import { selectAuthToken } from '../../redux/features/auth/authSlice';
import { fetchMyBookings } from '../../services/premiumCallService';
import type { RootStackNavigatorParamList } from '../../types/navigators';
import { colorss } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);

// Live status, keyed by bookingId, shared across every card in the session so
// re-mounting a bubble (or the same booking echoed in two threads) doesn't
// re-fetch or flash the stale baked-in value.
const liveStatusCache = new Map<number, BookingCardStatus>();

type StatusMeta = { label: string; fg: string; bg: string };

function getStatusMeta(status: BookingCardStatus): StatusMeta {
  switch (status) {
    case 'CONFIRMED':
      return { label: 'Confirmed', fg: '#047857', bg: '#ECFDF5' };
    case 'IN_CALL':
      return { label: 'In call', fg: '#1D4ED8', bg: '#EFF6FF' };
    case 'COMPLETED':
      return { label: 'Completed', fg: '#047857', bg: '#ECFDF5' };
    case 'CANCELLED':
      return { label: 'Cancelled', fg: '#B91C1C', bg: '#FEF2F2' };
    case 'CLOSED':
      return { label: 'Ended', fg: '#4B5563', bg: '#F3F4F6' };
    case 'NO_SHOW':
      return { label: 'No show', fg: '#B91C1C', bg: '#FEF2F2' };
    default:
      return { label: 'Pending', fg: '#B45309', bg: '#FFFBEB' };
  }
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

type Props = { booking: BookingCardPayload; isOwn: boolean };

export default function BookingCardBubble({ booking, isOwn }: Props) {
  const token = useAppSelector(selectAuthToken);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackNavigatorParamList>>();

  const [status, setStatus] = useState<BookingCardStatus>(
    liveStatusCache.get(booking.bookingId) ?? booking.status,
  );

  // Refresh the real status. The buyer sees it under role=caller, the creator
  // under role=callee, so try the side that matches this bubble first and fall
  // back to the other — a booking card can be forwarded into either thread.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      const roles: ('caller' | 'callee')[] = isOwn
        ? ['caller', 'callee']
        : ['callee', 'caller'];

      for (const role of roles) {
        const rows = await fetchMyBookings(role, token);
        const hit = rows.find(b => b.id === booking.bookingId);
        if (hit) {
          if (!cancelled) {
            liveStatusCache.set(booking.bookingId, hit.status);
            setStatus(hit.status);
          }
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, booking.bookingId, isOwn]);

  const openBookings = useCallback(() => {
    navigation.navigate('MyBookings');
  }, [navigation]);

  const meta = getStatusMeta(status);
  const accent = booking.isHopeWish ? '#7C3AED' : colorss.primary;
  const headerBg = booking.isHopeWish ? '#F5F3FF' : '#FFF0F4';
  const borderColor = booking.isHopeWish ? '#C4B5FD' : '#F0D0DA';

  return (
    <View
      style={[
        styles.card,
        isOwn ? styles.cardRight : styles.cardLeft,
        { borderColor },
      ]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: headerBg, borderBottomColor: borderColor },
        ]}
      >
        {booking.isHopeWish ? (
          <Sparkles size={14} color={accent} />
        ) : (
          <Video size={14} color={accent} />
        )}
        <Text style={[styles.headerText, { color: accent }]} numberOfLines={1}>
          {booking.isHopeWish ? 'Hope Wish' : 'Call Booking'}
        </Text>
        <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
          <Text style={[styles.statusText, { color: meta.fg }]}>
            {meta.label}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {booking.peerName ? (
          <Text style={styles.peerName} numberOfLines={1}>
            {booking.isHopeWish ? booking.peerName : `With ${booking.peerName}`}
          </Text>
        ) : null}

        {booking.whenLabel ? (
          <Row
            icon={<CalendarDays size={13} color="#6B7280" />}
            label={booking.isHopeWish ? 'Deliver by' : 'Date'}
            value={booking.whenLabel}
          />
        ) : null}

        {booking.timeLabel ? (
          <Row
            icon={<Clock size={13} color="#6B7280" />}
            label="Time"
            value={
              booking.durationMinutes
                ? `${booking.timeLabel} · ${booking.durationMinutes} min`
                : booking.timeLabel
            }
          />
        ) : null}

        {booking.amount != null ? (
          <Row
            icon={<Wallet size={13} color="#6B7280" />}
            label={booking.isHopeWish ? 'Paid' : 'Amount'}
            value={`$${booking.amount.toFixed(2)}`}
          />
        ) : null}

        <Text style={styles.note}>
          {booking.isHopeWish
            ? 'The creator will record your personalised video and deliver it by the date above.'
            : "You'll be reminded 24 h, 1 h, and 15 min before the call."}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.footer, { borderTopColor: borderColor }]}
        onPress={openBookings}
        activeOpacity={0.75}
      >
        <Text style={[styles.footerText, { color: accent }]}>
          View details · #{booking.bookingId}
        </Text>
        <ChevronRight size={15} color={accent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
    marginVertical: 2,
    backgroundColor: '#fff',
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardLeft: { alignSelf: 'flex-start', marginLeft: 12 },
  cardRight: { alignSelf: 'flex-end', marginRight: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1, fontSize: 12, fontWeight: '700' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '700' },

  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  peerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },

  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  rowIcon: { width: 20 },
  rowLabel: { fontSize: 12, color: '#6B7280', width: 68 },
  rowValue: { flex: 1, fontSize: 12, fontWeight: '600', color: '#111827' },

  note: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 15,
    color: '#6B7280',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  footerText: { fontSize: 12.5, fontWeight: '700' },
});
