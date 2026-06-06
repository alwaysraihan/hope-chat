/**
 * Book Call — redesigned to match StarConnect UI with hope-chat's theme.
 *
 * Layout:
 *  • Expert card (avatar, name, bio)
 *  • Call Type: Single Call | Group Call
 *  • Call Topic  (255 chars)
 *  • Write Agenda (3000 chars)
 *  • Session Duration chips
 *  • Full month calendar + time-slot grid
 *  • Collapsible policy sections
 *  • Terms checkbox
 *  • Confirm & Pay button
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { IC_PROFILE } from '../assets';
import { colorss } from '../theme';
import type { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken, selectHopenityProfile } from '../redux/features/auth/authSlice';
import { currencyForCountry, convertFromUSD } from '../utils/currency';
import {
  fetchAvailableSlots,
  fetchUserPremiumProfile,
  createBooking,
  createWalletTopupCheckout,
  type PremiumCallProfile,
} from '../services/premiumCallService';
import {
  formatBookingCardMessage,
  scheduleBookingNotifications,
} from '../services/bookingNotifications';
import {
  getOrCreatePeerChat,
  sendHopenityChatMessage,
} from '../services/chatService';
import { setBookingForChat } from '../services/bookingChatMap';
import { Toast } from '../components/Toast';
import { PaymentWebViewModal } from '../components/PaymentWebViewModal';
import { DatePickerSheet } from '../components/DatePickerSheet';
import {
  getDeviceTimezone,
  getLocalMidnightAsUTC,
  getWeekdayInTimezone,
  formatTimezoneLabel,
} from '../utils/timezone';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'BookCall'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const DURATION_OPTIONS = [
  { minutes: 5,  label: '5 Min',    priceKey: 'price5min'  as const },
  { minutes: 15, label: '15 Min',   priceKey: 'price10min' as const },
  { minutes: 30, label: '30 Min',   priceKey: 'price30min' as const },
  { minutes: 60, label: '1 Hour',   priceKey: 'price60min' as const },
];

const POLICIES: Array<{ key: string; title: string; body: string }> = [
  {
    key: 'scheduling',
    title: 'Scheduling Policy',
    body:
      '• Once you book, the expert must accept within 15 minutes before the scheduled time.\n' +
      '• If they don\'t, your booking expires and you\'re refunded automatically.\n' +
      '• Once confirmed, both you and the expert connect at the scheduled time via HopeChat.\n' +
      '• You\'ll receive reminders at 24 hours, 1 hour, and 15 minutes before your session.',
  },
  {
    key: 'rescheduling',
    title: 'Rescheduling Policy',
    body: '• You may reschedule up to 2 hours before the session at no extra charge.\n• Rescheduling within 2 hours may incur a small fee at the expert\'s discretion.',
  },
  {
    key: 'cancellation',
    title: 'Cancellation Policy',
    body: '• Cancellations more than 24 hours before the session receive a full refund.\n• Cancellations within 24 hours receive a 50 % refund.\n• No-shows are non-refundable.',
  },
  {
    key: 'video',
    title: 'Video Call Policy',
    body: '• Video calls are conducted through HopeChat\'s encrypted platform.\n• Recordings are not permitted without mutual consent.\n• Both parties must be in a private, appropriate location.',
  },
  {
    key: 'noshow',
    title: 'No-Show Policy',
    body: '• If the expert does not show, you\'ll receive a full refund within 48 hours.\n• Repeated no-shows by buyers may result in account restrictions.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** UTC-based ISO date string (used for API calls — API stores in UTC). */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}



/** "14:30" → "2:30 PM" */
export function fmt12(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Generates available time slots for the viewer's selected date.
 *
 * Fully UTC-based algorithm — correct for every timezone on Earth:
 *
 *  1.  Compute the viewer's selected day as a UTC window [dayStartMs, dayEndMs).
 *  2.  Check creator-days for the day BEFORE, the SAME day, and the day AFTER
 *      in the creator's timezone.  This handles all cross-midnight cases — e.g.
 *      when the creator is UTC+12 and the viewer is UTC-12, what looks like
 *      "Monday" to the viewer may overlap with two different creator-days.
 *  3.  For each creator-day found, walk through the creator's schedule slots and
 *      compute each candidate slot's absolute UTC timestamp.
 *  4.  Keep only candidates that fall inside the viewer's day window AND are not
 *      already booked (compared in UTC ms, matching API storage format).
 *  5.  Convert the slot start UTC ms → viewer local HH:MM for display.
 */
function generateSlots(
  profile: PremiumCallProfile,
  viewerDate: Date,         // new Date(year, month, day) = midnight in viewer local time
  durationMinutes: number,
  existingBookings: { scheduledAt: string; durationMinutes: number }[],
  creatorTz: string,
  viewerTz: string,
): string[] {
  if (!durationMinutes) return [];

  const slotMs = durationMinutes * 60_000;

  // ── Viewer's day window in absolute UTC ms ────────────────────────────────
  const viewerDayStartMs = getLocalMidnightAsUTC(viewerDate, viewerTz);
  const viewerDayEndMs   = viewerDayStartMs + 24 * 3600_000;  // exclusive

  // ── Existing bookings as UTC ms ranges ────────────────────────────────────
  // Keep only bookings that COULD overlap with the viewer's day (±1 day buffer).
  const windowStart = viewerDayStartMs - 24 * 3600_000;
  const windowEnd   = viewerDayEndMs   + 24 * 3600_000;
  const bookedMs = existingBookings
    .map(b => {
      const startMs = new Date(b.scheduledAt).getTime();
      return { start: startMs, end: startMs + b.durationMinutes * 60_000 };
    })
    .filter(r => r.start < windowEnd && r.end > windowStart);

  const isBooked = (startMs: number): boolean =>
    bookedMs.some(r => startMs < r.end && startMs + slotMs > r.start);

  // ── Check creator-days that overlap the viewer's day ─────────────────────
  // weeklySchedule can be null/undefined on older profiles — treat as empty.
  const schedule = (profile.weeklySchedule ?? {}) as Record<string, { start: string; end: string }[]>;
  const seenKeys = new Set<string>();
  const slots: string[] = [];

  for (let shift = -1; shift <= 1; shift++) {
    // A date in the vicinity — used to determine which creator-day to consult
    const probeMs = viewerDayStartMs + shift * 24 * 3600_000 + 12 * 3600_000;
    const probe   = new Date(probeMs);  // noon UTC in the vicinity

    const dayKey = getWeekdayInTimezone(probe, creatorTz);
    const dedupeKey = `${shift}:${dayKey}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const daySlots = schedule[dayKey] ?? [];
    if (!daySlots.length) continue;

    // True midnight UTC for this creator-day
    const creatorMidnightMs = getLocalMidnightAsUTC(probe, creatorTz);

    for (const slot of daySlots) {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      let curMs = creatorMidnightMs + (sh * 60 + sm) * 60_000;
      const endMs = creatorMidnightMs + (eh * 60 + em) * 60_000;

      while (curMs + slotMs <= endMs) {
        // Only include slots that fall inside the viewer's selected day AND
        // haven't already started (filter past slots for today).
        if (curMs >= viewerDayStartMs && curMs < viewerDayEndMs && curMs > Date.now()) {
          if (!isBooked(curMs)) {
            // Convert UTC ms → viewer local HH:MM
            const viewerMinsFromMidnight =
              Math.round((curMs - viewerDayStartMs) / 60_000);
            const vh = Math.floor(viewerMinsFromMidnight / 60);
            const vm = viewerMinsFromMidnight % 60;
            slots.push(`${String(vh).padStart(2, '0')}:${String(vm).padStart(2, '0')}`);
          }
        }
        curMs += slotMs;
      }
    }
  }

  slots.sort();
  return slots;
}

// ─── PolicySection ────────────────────────────────────────────────────────────

function PolicySection({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(title === 'Scheduling Policy');
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    Animated.timing(anim, { toValue: next ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  };

  return (
    <View style={ps.container}>
      <TouchableOpacity style={ps.header} onPress={toggle} activeOpacity={0.7}>
        <Text style={ps.title}>{title}</Text>
        {open ? (
          <ChevronUp size={18} color={colorss.textSecondary} />
        ) : (
          <ChevronDown size={18} color={colorss.textSecondary} />
        )}
      </TouchableOpacity>
      {open && (
        <View style={ps.body}>
          <Text style={ps.bodyText}>{body}</Text>
        </View>
      )}
    </View>
  );
}

const ps = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colorss.border,
    overflow: 'hidden',
    backgroundColor: colorss.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  title: { fontSize: 14, fontWeight: '600', color: colorss.textPrimary },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
  bodyText: { fontSize: 13, color: colorss.textSecondary, lineHeight: 20 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BookCallScreen({ navigation, route }: Props) {
  const { targetUserId, targetName, targetAvatar } = route.params;
  const insets       = useSafeAreaInsets();
  const token        = useAppSelector(selectAuthToken);
  const userProfile  = useAppSelector(selectHopenityProfile);

  // Viewer's local currency — derived from their Hopenity country code.
  const viewerCurrency = useMemo(
    () => currencyForCountry(userProfile?.country),
    [userProfile?.country],
  );

  const today = useMemo(() => new Date(), []);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking]           = useState(false);
  const [profile, setProfile]           = useState<PremiumCallProfile | null>(null);
  const [existingBookings, setExistingBookings] = useState<
    { scheduledAt: string; durationMinutes: number }[]
  >([]);

  // Form state
  const [callType, setCallType]         = useState<'single' | 'group'>('single');
  const [topic, setTopic]               = useState('');
  const [agenda, setAgenda]             = useState('');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear]   = useState(today.getFullYear());
  const [selectedDay, setSelectedDay]     = useState<number | null>(null);
  const [selectedTime, setSelectedTime]   = useState<string | null>(null);
  const [termsChecked, setTermsChecked]   = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [paymentSheet, setPaymentSheet] = useState<{
    checkoutUrl: string;
    amountDisplay: string;
    returnUrlPrefix: string | null;
  } | null>(null);
  const [topping, setTopping] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [webViewReturnUrlPrefix, setWebViewReturnUrlPrefix] = useState<string | null>(null);
  const autoSelectedRef = useRef(false);
  // Date the user is hovering over inside the DatePickerSheet (not yet confirmed).
  // Drives availableSlots so slots load as soon as a day is tapped in the sheet.
  const [sheetPickedDate, setSheetPickedDate] = useState<Date | null>(null);

  // Viewer's device timezone — always the most accurate source.
  const viewerTz = useMemo(() => getDeviceTimezone(), []);

  // Creator's timezone priority:
  //   1. Saved timezone on their premium-calls profile (set when they saved setup)
  //   2. Country-based fallback from their Hopenity profile (covers older accounts
  //      that saved before timezone tracking was added)
  //   3. 'UTC' as the last resort
  const creatorTz = useMemo(() => {
    if (profile?.timezone) return profile.timezone;
    // When the creator hasn't saved their timezone yet (profile.timezone is null),
    // assume their schedule was entered in the same timezone as the viewer.
    // Falling back to 'UTC' is wrong: it shifts all slot times by the viewer's
    // UTC offset, pushing every slot outside the viewer's selected day window
    // and producing "No available slots" even when slots exist.
    return viewerTz;
  }, [profile?.timezone, viewerTz]);

  const sameTimezone = viewerTz === creatorTz;

  const selectedDate = useMemo(() => {
    if (!selectedDay) return null;
    return new Date(calendarYear, calendarMonth, selectedDay);
  }, [calendarYear, calendarMonth, selectedDay]);

  // ── Load creator profile ──────────────────────────────────────────────────
  // Use the profile endpoint directly — NOT the slots endpoint.  The slots
  // endpoint returns 404 when isEnabled=false, meaning we'd never see the
  // profile.  Fetch profile and existing bookings independently.
  useEffect(() => {
    if (!targetUserId) {
      Alert.alert('Invalid link', 'This booking link is not valid.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    fetchUserPremiumProfile(targetUserId)
      .then(p => {
        if (p && p.isEnabled) {
          setProfile(p);
          setLoadError(null);
        } else {
          setLoadError(
            `${targetName} is not currently accepting call bookings.`,
          );
        }
      })
      .catch(() => {
        setLoadError('Could not load booking details. Please check your connection and try again.');
      })
      .finally(() => setLoading(false));
  }, [targetUserId, targetName, navigation]);

  // ── Reload existing bookings when a date is picked inside the sheet ─────
  // sheetPickedDate is set as soon as the user taps a day in DatePickerSheet
  // (before confirming), so slots appear immediately without a second tap.
  // Falls back to selectedDate once the sheet is closed and a date is confirmed.
  // If the slots endpoint fails or returns 404 we keep existingBookings empty —
  // slots are still generated client-side from the weeklySchedule.
  const activeSlotDate = sheetPickedDate ?? selectedDate;

  useEffect(() => {
    if (!profile || !activeSlotDate) return;
    setSlotsLoading(true);
    fetchAvailableSlots(targetUserId, isoDate(activeSlotDate))
      .then(data => { if (data?.existingBookings) setExistingBookings(data.existingBookings); })
      .catch(() => {})
      .finally(() => setSlotsLoading(false));
  }, [activeSlotDate, targetUserId, profile]);

  const availableSlots = useMemo(() => {
    if (!profile || !activeSlotDate || !selectedDuration) return [];
    if (profile.anytime) {
      // "Anytime" mode — standard hours 8 AM–8 PM, past hours filtered for today.
      const nowMs = Date.now();
      return Array.from({ length: 13 }, (_, i) => {
        const h = 8 + i;
        const slotMs = getLocalMidnightAsUTC(activeSlotDate, viewerTz) + h * 3600_000;
        if (slotMs <= nowMs) return null; // already passed
        return `${String(h).padStart(2, '0')}:00`;
      }).filter((s): s is string => s !== null);
    }
    return generateSlots(
      profile, activeSlotDate, selectedDuration,
      existingBookings, creatorTz, viewerTz,
    );
  }, [profile, activeSlotDate, selectedDuration, existingBookings, creatorTz, viewerTz]);

  const priceForDuration = (minutes: number): number | null => {
    if (!profile) return null;
    const map: Record<number, number | null | undefined> = {
      5:  profile.price5min,
      15: profile.price10min,
      30: profile.price30min,
      60: profile.price60min,
    };
    return map[minutes] ?? null;
  };

  // Prices from the profile are stored in USD.  Convert to viewer's local currency.
  const totalPriceUSD = selectedDuration ? priceForDuration(selectedDuration) : null;
  const totalPrice    = totalPriceUSD != null
    ? convertFromUSD(totalPriceUSD, viewerCurrency)
    : null;

  // Booking window: today through the next 7 days only.
  const maxBookingDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [today]);

  // Midnight of today in the viewer's local timezone — used so today's date
  // is selectable, not compared against the current wall-clock time.
  const todayMidnight = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    [today],
  );

  const isDateAvailable = useCallback((year: number, month: number, day: number): boolean => {
    const d = new Date(year, month, day);
    // Past dates — never bookable.  Compare at day granularity so today is
    // always included (comparing against new Date() would exclude today until
    // it's exactly midnight, which is never in practice).
    if (d < todayMidnight) return false;
    // Beyond the 7-day booking window — disabled.
    if (d > maxBookingDate) return false;
    // No profile yet or anytime mode — every day in the window is available.
    if (!profile) return true;
    if (profile.anytime) return true;
    // Schedule-based check — null-safe.
    const schedule = (profile.weeklySchedule ?? {}) as Record<string, unknown[]>;
    for (let shift = -1; shift <= 1; shift++) {
      const probeMs = getLocalMidnightAsUTC(d, viewerTz) + shift * 24 * 3600_000 + 12 * 3600_000;
      const creatorDayKey = getWeekdayInTimezone(new Date(probeMs), creatorTz);
      if ((schedule[creatorDayKey]?.length ?? 0) > 0) return true;
    }
    return false;
  }, [profile, todayMidnight, maxBookingDate, creatorTz, viewerTz]);

  // ── Auto-select first available duration and date when profile loads ────────
  useEffect(() => {
    if (!profile || autoSelectedRef.current) return;
    autoSelectedRef.current = true;

    // Pick the first duration that has a price configured
    const priceMap: Record<number, number | null | undefined> = {
      5: profile.price5min, 15: profile.price10min,
      30: profile.price30min, 60: profile.price60min,
    };
    const firstOpt = DURATION_OPTIONS.find(opt => (priceMap[opt.minutes] ?? null) != null);
    if (firstOpt) setSelectedDuration(firstOpt.minutes);

    // Pick the first date in the next 7 days that passes isDateAvailable
    const base = new Date();
    for (let i = 0; i <= 7; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      if (isDateAvailable(d.getFullYear(), d.getMonth(), d.getDate())) {
        setCalendarYear(d.getFullYear());
        setCalendarMonth(d.getMonth());
        setSelectedDay(d.getDate());
        break;
      }
    }
  }, [profile, isDateAvailable]);

  const canBook =
    !!selectedDuration &&
    !!selectedDate &&
    !!selectedTime &&
    totalPriceUSD != null &&
    termsChecked;

  const handleBook = async () => {
    if (!token || !profile || !selectedDate || !selectedTime || !selectedDuration) return;
    setBooking(true);
    const d = new Date(selectedDate);
    const [h, m] = selectedTime.split(':').map(Number);
    d.setHours(h, m, 0, 0);

    const result = await createBooking({
      calleeId: targetUserId,
      durationMinutes: selectedDuration,
      scheduledAt: d.toISOString(),
      isHopeWish: false,
      callerNote: agenda.trim() || undefined,
      topic: topic.trim() || undefined,
      callType,
    }, token);

    setBooking(false);

    if (result.ok) {
      const scheduledAtIso = d.toISOString();

      // Schedule pre-meeting reminders (best-effort)
      scheduleBookingNotifications({
        bookingId: result.bookingId,
        isHopeWish: false,
        scheduledAt: scheduledAtIso,
        durationMinutes: selectedDuration,
        peerName: targetName,
      });

      // Open or create the booking chat
      const rawChatId = result.chatThreadId
        ? String(result.chatThreadId)
        : await getOrCreatePeerChat(targetUserId, token);

      if (rawChatId) {
        // Persist chat→booking link so InboxScreen can restore booking context
        // even when the user navigates to the chat from the home screen later.
        setBookingForChat(rawChatId, result.bookingId);

        // Send booking confirmation card to the chat
        const card = formatBookingCardMessage({
          bookingId: result.bookingId,
          isHopeWish: false,
          scheduledAt: scheduledAtIso,
          durationMinutes: selectedDuration,
          totalAmount: result.totalAmount,
          peerName: targetName,
        });
        sendHopenityChatMessage(rawChatId, card, token).catch(() => {});

        navigation.replace('Inbox', {
          conversationId: rawChatId,
          displayName: targetName,
          avatarUrl: targetAvatar ?? null,
          bookingId: result.bookingId,
          messagingEnabled: true,
          isGroupBooking: callType === 'group',
          seedConversation: {
            id: rawChatId,
            name: targetName,
            preview: '',
            time: '',
            unreadCount: 0,
            avatarUrl: targetAvatar ?? null,
            peerUserId: targetUserId,
            messages: [],
          },
        });
      } else {
        navigation.goBack();
      }
      return;
    }

    // ── Insufficient balance — show top-up sheet ──────────────────────────
    if (result.insufficientBalance) {
      setTopping(true);
      const requiredUSD = result.requiredUSD ?? totalPriceUSD ?? 0;
      const amountDisplay = convertFromUSD(requiredUSD, viewerCurrency).display;
      const checkout = await createWalletTopupCheckout(requiredUSD, token);
      setTopping(false);
      if (checkout) {
        setPaymentSheet({ checkoutUrl: checkout.checkoutUrl, amountDisplay, returnUrlPrefix: checkout.returnUrlPrefix });
      } else {
        Toast.error('Could not open payment. Please top up your wallet from the app settings.');
      }
      return;
    }

    // ── Other errors ──────────────────────────────────────────────────────
    Toast.error(result.message ?? 'Could not complete booking. Please try again.');
  };

  if (loading) {
    return (
      <View style={[s.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colorss.primary} />
        <Text style={s.loadingText}>Loading availability…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[s.safe, { paddingTop: insets.top }]}>
        <View style={s.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ArrowLeft size={22} color={colorss.textPrimary} />
          </TouchableOpacity>
          <Text style={s.navTitle}>Book a Call</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={[s.center, { flex: 1 }]}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📅</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colorss.textPrimary, textAlign: 'center', paddingHorizontal: 32 }}>
            Booking Unavailable
          </Text>
          <Text style={{ fontSize: 14, color: colorss.textSecondary, textAlign: 'center', paddingHorizontal: 32, marginTop: 10, lineHeight: 21 }}>
            {loadError}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 24, backgroundColor: colorss.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 28 }}
            onPress={() => {
              setLoading(true);
              setLoadError(null);
              fetchAvailableSlots(targetUserId, isoDate(today))
                .then(data => {
                  if (data?.profile) { setProfile(data.profile); setLoadError(null); }
                  else setLoadError(`${targetName} hasn't set up their availability yet.`);
                  if (data?.existingBookings) setExistingBookings(data.existingBookings);
                })
                .catch(() => setLoadError('Could not load booking details. Please try again.'))
                .finally(() => setLoading(false));
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      {/* Nav bar */}
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={22} color={colorss.textPrimary} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Book a Call</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Expert card */}
        <View style={s.expertCard}>
          <FastImage
            source={targetAvatar ? { uri: targetAvatar } : IC_PROFILE}
            style={s.expertAvatar}
          />
          <View>
            <Text style={s.expertName}>{targetName}</Text>
            {profile?.expertise?.length ? (
              <Text style={s.expertRole}>{profile.expertise.slice(0, 3).join(' | ')}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Call Type ── */}
        <Text style={s.sectionLabel}>Call Type</Text>
        <View style={s.callTypeRow}>
          <TouchableOpacity
            style={[s.callTypeCard, callType === 'single' && s.callTypeCardActive]}
            onPress={() => setCallType('single')}
          >
            <View style={[s.radio, callType === 'single' && s.radioActive]}>
              {callType === 'single' && <View style={s.radioDot} />}
            </View>
            <View>
              <Text style={[s.callTypeTitle, callType === 'single' && s.callTypeTitleActive]}>
                Single Call
              </Text>
              <Text style={s.callTypeSub}>1 Member only</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.callTypeCard, callType === 'group' && s.callTypeCardActive]}
            onPress={() => setCallType('group')}
          >
            <View style={[s.radio, callType === 'group' && s.radioActive]}>
              {callType === 'group' && <View style={s.radioDot} />}
            </View>
            <View>
              <Text style={[s.callTypeTitle, callType === 'group' && s.callTypeTitleActive]}>
                Group Call
              </Text>
              <Text style={s.callTypeSub}>Max. 4 members</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Call Topic ── */}
        <Text style={s.fieldLabel}>Call Topic <Text style={s.required}>*</Text></Text>
        <TextInput
          value={topic}
          onChangeText={t => setTopic(t.slice(0, 255))}
          style={s.input}
          placeholder="Type your call topic"
          placeholderTextColor={colorss.placeholder}
          returnKeyType="next"
        />
        <Text style={s.charHint}>
          Give your topic a short, clear title. ({topic.length}/255)
        </Text>

        {/* ── Write Agenda ── */}
        <Text style={s.fieldLabel}>Write Agenda <Text style={s.required}>*</Text></Text>
        <TextInput
          value={agenda}
          onChangeText={t => setAgenda(t.slice(0, 3000))}
          style={[s.input, s.textArea]}
          multiline
          textAlignVertical="top"
          placeholder="Write call agenda here…"
          placeholderTextColor={colorss.placeholder}
        />
        <Text style={s.charHint}>
          Describe your request clearly. Include details like occasion, tone, or info. ({agenda.length}/3000)
        </Text>

        {/* ── Session Duration ── */}
        <Text style={s.fieldLabel}>Session Duration</Text>
        <View style={s.durationRow}>
          {DURATION_OPTIONS.map(opt => {
            const priceUSD = priceForDuration(opt.minutes);
            if (priceUSD == null) return null;
            const priceLocal = convertFromUSD(priceUSD, viewerCurrency);
            const active = selectedDuration === opt.minutes;
            return (
              <TouchableOpacity
                key={opt.minutes}
                style={[s.durationChip, active && s.durationChipActive]}
                onPress={() => { setSelectedDuration(opt.minutes); setSelectedTime(null); }}
              >
                <Text style={[s.durationLabel, active && s.durationLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[s.durationPrice, active && s.durationPriceActive]}>
                  {priceLocal.display}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Date & Time picker pill ── */}
        <Text style={s.fieldLabel}>Select Date & Time</Text>
        {!sameTimezone && selectedDuration && (
          <View style={[s.tzBanner, { marginBottom: 8 }]}>
            <Text style={s.tzBannerText}>
              🌐 Times in <Text style={s.tzBold}>{formatTimezoneLabel(viewerTz)}</Text>
              {'  ·  '}Expert: <Text style={s.tzBold}>{formatTimezoneLabel(creatorTz)}</Text>
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[
            s.datePill,
            (!selectedDuration) && s.datePillDisabled,
          ]}
          onPress={() => {
            if (!selectedDuration) {
              Toast.info('Please select a duration first.');
              return;
            }
            setDateSheetOpen(true);
          }}
          activeOpacity={0.75}
        >
          <Calendar size={18} color={selectedDay ? colorss.primary : colorss.placeholder} />
          <Text style={[s.datePillText, !!selectedDay && s.datePillTextActive]}>
            {selectedDay && selectedDate
              ? `${selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${selectedTime ? `  ·  ${fmt12(selectedTime)}` : '  — tap to pick time'}`
              : 'Tap to select date & time'}
          </Text>
          {selectedDay && (
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => { setSelectedDay(null); setSelectedTime(null); }}
            >
              <Text style={{ color: colorss.placeholder, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <DatePickerSheet
          visible={dateSheetOpen}
          initialDate={selectedDate}
          onClose={() => { setDateSheetOpen(false); setSheetPickedDate(null); }}
          onConfirm={({ date, time }) => {
            setCalendarYear(date.getFullYear());
            setCalendarMonth(date.getMonth());
            setSelectedDay(date.getDate());
            setSelectedTime(time ?? null);
            setSheetPickedDate(null); // confirmed — fall back to selectedDate
            setDateSheetOpen(false);
          }}
          isDateAvailable={isDateAvailable}
          availableSlots={availableSlots}
          slotsLoading={slotsLoading}
          maxDate={maxBookingDate}
          mode="datetime"
          title="Select Date & Time"
          confirmLabel="Confirm date & time"
          onDayChange={setSheetPickedDate}
        />

        {/* Price summary — show only what the user pays, no platform breakdown */}
        {totalPrice != null && (
          <View style={s.priceSummary}>
            <View style={[s.priceLine, s.priceTotalRow]}>
              <Text style={s.priceTotalKey}>You pay</Text>
              <Text style={s.priceTotalVal}>{totalPrice.display}</Text>
            </View>
            <Text style={s.priceNote}>
              💳 Billed as {totalPriceUSD != null ? `$${totalPriceUSD.toFixed(2)} USD` : ''} · shown in your local currency
            </Text>
          </View>
        )}

        {/* Policies */}
        <View style={{ height: 16 }} />
        {POLICIES.map(p => (
          <PolicySection key={p.key} title={p.title} body={p.body} />
        ))}

        {/* Terms */}
        <TouchableOpacity
          style={s.termsRow}
          onPress={() => setTermsChecked(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[s.checkbox, termsChecked && s.checkboxChecked]}>
            {termsChecked && <Text style={s.checkmark}>✓</Text>}
          </View>
          <Text style={s.termsText}>
            By checking this box, you agree to our{' '}
            <Text style={s.termsLink}>Terms of service.</Text>
          </Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Confirm & Pay */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[s.confirmBtn, (!canBook || booking) && s.confirmBtnDisabled]}
          onPress={handleBook}
          disabled={!canBook || booking}
          activeOpacity={0.85}
        >
          {booking ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <CheckCircle size={18} color="#fff" />
              <Text style={s.confirmBtnText}>
                {totalPrice != null
                  ? `Confirm & Pay · ${totalPrice.display}`
                  : 'Confirm & Pay'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── In-app payment WebView ───────────────────────────────────── */}
      <PaymentWebViewModal
        visible={!!webViewUrl}
        url={webViewUrl}
        title="Top Up Wallet"
        matchUrlPrefix={webViewReturnUrlPrefix}
        onClose={() => { setWebViewUrl(null); setWebViewReturnUrlPrefix(null); }}
        onPaymentComplete={() => {
          setWebViewUrl(null);
          setWebViewReturnUrlPrefix(null);
          Toast.success('Payment complete! You can now retry booking.');
        }}
      />

      {/* ── Insufficient balance — top-up payment sheet ───────────────── */}
      <Modal
        transparent
        animationType="slide"
        visible={!!paymentSheet || topping}
        onRequestClose={() => setPaymentSheet(null)}
      >
        <Pressable style={s.payBackdrop} onPress={() => setPaymentSheet(null)} />
        <View style={[s.paySheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.payHandle} />
          {topping ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={colorss.primary} />
              <Text style={{ marginTop: 14, color: colorss.textSecondary, fontSize: 14 }}>
                Preparing payment…
              </Text>
            </View>
          ) : paymentSheet ? (
            <>
              <Text style={s.payTitle}>Wallet top-up required</Text>
              <Text style={s.paySub}>
                Your wallet doesn't have enough balance to book this call.
              </Text>

              <View style={s.payAmountBox}>
                <Text style={s.payAmountLabel}>Amount needed</Text>
                <Text style={s.payAmount}>{paymentSheet.amountDisplay}</Text>
              </View>

              <Text style={s.payNote}>
                You'll be taken to a secure payment page. Once paid, return to the app and retry booking.
              </Text>

              <TouchableOpacity
                style={s.payBtn}
                onPress={() => {
                  setWebViewUrl(paymentSheet.checkoutUrl);
                  setWebViewReturnUrlPrefix(paymentSheet.returnUrlPrefix);
                  setPaymentSheet(null);
                }}
                activeOpacity={0.85}
              >
                <Text style={s.payBtnText}>Top up wallet & pay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.payCancelBtn}
                onPress={() => setPaymentSheet(null)}
                activeOpacity={0.7}
              >
                <Text style={s.payCancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colorss.background },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colorss.textSecondary, fontSize: 14 },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colorss.white, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  navTitle: { fontSize: 17, fontWeight: '700', color: colorss.textPrimary },

  expertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, margin: 16,
    backgroundColor: `${colorss.primary}12`,
    borderRadius: 16,
  },
  expertAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colorss.backgroundDeep,
  },
  expertName:  { fontSize: 16, fontWeight: '700', color: colorss.textPrimary },
  expertRole:  { fontSize: 13, color: colorss.textSecondary, marginTop: 2 },

  sectionLabel: {
    fontSize: 15, fontWeight: '700', color: colorss.textPrimary,
    paddingHorizontal: 16, marginBottom: 10,
  },

  callTypeRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 20 },
  callTypeCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colorss.border,
    backgroundColor: colorss.white,
  },
  callTypeCardActive: { borderColor: colorss.primary, backgroundColor: `${colorss.primary}08` },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colorss.border,
    justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: colorss.primary },
  radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: colorss.primary },
  callTypeTitle:       { fontSize: 14, fontWeight: '700', color: colorss.textSecondary },
  callTypeTitleActive: { color: colorss.primary },
  callTypeSub:         { fontSize: 11, color: colorss.placeholder, marginTop: 2 },

  fieldLabel: {
    fontSize: 14, fontWeight: '600', color: colorss.textPrimary,
    paddingHorizontal: 16, marginBottom: 8,
  },
  required: { color: colorss.error },

  input: {
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: colorss.white, borderRadius: 10, borderWidth: 1,
    borderColor: colorss.border, padding: 13, fontSize: 14,
    color: colorss.textPrimary,
  },
  textArea:  { minHeight: 110, marginBottom: 4 },
  charHint:  { fontSize: 12, color: colorss.placeholder, paddingHorizontal: 16, marginBottom: 16 },

  durationRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 20 },
  durationChip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1.5, borderColor: colorss.border, backgroundColor: colorss.white,
  },
  durationChipActive: { borderColor: colorss.primary, backgroundColor: `${colorss.primary}12` },
  durationLabel:       { fontSize: 14, fontWeight: '600', color: colorss.textSecondary },
  durationLabelActive: { color: colorss.primary },
  durationPrice:       { fontSize: 11, color: colorss.textSecondary, marginTop: 2 },
  durationPriceActive: { color: colorss.primary, fontWeight: '600' },

  // Calendar
  calendarCard: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: colorss.white, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: colorss.border,
  },
  calMonthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  calMonthText: { fontSize: 15, fontWeight: '700', color: colorss.textPrimary },
  calDayHeaders: { flexDirection: 'row', marginBottom: 4 },
  calDayHeader: {
    flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600',
    color: colorss.placeholder,
  },
  calWeek:     { flexDirection: 'row', marginBottom: 4 },
  calCell:     { flex: 1, aspectRatio: 1, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  calCellAvailable: {},
  calCellActive:    { backgroundColor: colorss.primary },
  calCellPast:      {},
  calDayNum:         { fontSize: 13, color: colorss.textPrimary, fontWeight: '500' },
  calDayNumAvailable:{ color: colorss.textPrimary },
  calDayNumActive:   { color: '#fff', fontWeight: '700' },
  calDayNumPast:     { color: colorss.placeholder },

  tzBanner: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: `${colorss.primary}10`,
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: `${colorss.primary}30`,
  },
  tzBannerText: { fontSize: 12, color: colorss.textSecondary, lineHeight: 18 },
  tzBold:       { fontWeight: '700', color: colorss.primary },

  datePill: {
    marginHorizontal: 16, marginBottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: colorss.primary, borderRadius: 12,
    padding: 14, backgroundColor: `${colorss.primary}08`,
  },
  datePillDisabled: { borderColor: colorss.border, backgroundColor: colorss.white },
  datePillText: { flex: 1, fontSize: 14, color: colorss.placeholder },
  datePillTextActive: { color: colorss.primary, fontWeight: '600' },

  timeSlotsWrap: { paddingHorizontal: 16, marginBottom: 20 },
  noSlots:       { color: colorss.textSecondary, fontSize: 14, paddingVertical: 8 },
  timeGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8,
    backgroundColor: colorss.white, borderWidth: 1.5, borderColor: colorss.border,
  },
  timeChipActive: { backgroundColor: colorss.primary, borderColor: colorss.primary },
  timeText:       { fontSize: 13, fontWeight: '600', color: colorss.textPrimary },
  timeTextActive: { color: '#fff' },

  // Price
  priceSummary: {
    marginHorizontal: 16, marginBottom: 16, borderRadius: 12,
    backgroundColor: colorss.white, borderWidth: 1, borderColor: colorss.border,
    padding: 14, gap: 8,
  },
  priceLine:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceTotalRow:{ borderTopWidth: 1, borderTopColor: colorss.border, paddingTop: 8, marginTop: 4 },
  priceKey:     { fontSize: 13, color: colorss.textSecondary },
  priceVal:     { fontSize: 13, color: colorss.textPrimary, fontWeight: '600' },
  priceTotalKey:{ fontSize: 14, fontWeight: '700', color: colorss.textPrimary },
  priceNote:    { fontSize: 11, color: colorss.placeholder, marginTop: 6, lineHeight: 16 },
  priceTotalVal:{ fontSize: 16, fontWeight: '800', color: colorss.primary },

  // Terms
  termsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 16, marginTop: 12, marginBottom: 4,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
    borderColor: colorss.border, justifyContent: 'center', alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colorss.primary, borderColor: colorss.primary },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  termsText: { flex: 1, fontSize: 13, color: colorss.textSecondary, lineHeight: 19 },
  termsLink: { color: colorss.primary, textDecorationLine: 'underline' },

  footer: {
    paddingTop: 16, paddingHorizontal: 16, backgroundColor: colorss.white,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colorss.border,
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colorss.primary, borderRadius: 12, paddingVertical: 15,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Payment sheet
  payBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  paySheet: {
    backgroundColor: colorss.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
  payHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colorss.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 16,
  },
  payTitle: { fontSize: 20, fontWeight: '700', color: colorss.textPrimary, textAlign: 'center', marginBottom: 8 },
  paySub: { fontSize: 14, color: colorss.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  payAmountBox: {
    backgroundColor: `${colorss.primary}10`,
    borderRadius: 14, padding: 18,
    alignItems: 'center', marginBottom: 16,
  },
  payAmountLabel: { fontSize: 12, fontWeight: '600', color: colorss.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  payAmount: { fontSize: 32, fontWeight: '800', color: colorss.primary, marginTop: 4 },
  payNote: { fontSize: 13, color: colorss.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  payBtn: {
    backgroundColor: colorss.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginBottom: 10,
  },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  payCancelBtn: { paddingVertical: 12, alignItems: 'center' },
  payCancelText: { color: colorss.textSecondary, fontSize: 14, fontWeight: '600' },
});
