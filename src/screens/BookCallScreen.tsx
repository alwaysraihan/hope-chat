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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Users,
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
  createBooking,
  type PremiumCallProfile,
} from '../services/premiumCallService';
import { Toast } from '../components/Toast';
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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

/** Local-calendar ISO date string — the date the viewer SEES on their calendar. */
function localIsoDate(d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

/** "14:30" → "2:30 PM" */
function fmt12(hhmm: string): string {
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

function getMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7).concat(Array(7 - (cells.slice(i, i + 7).length)).fill(null)));
  }
  return rows;
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
  const schedule = profile.weeklySchedule as Record<string, { start: string; end: string }[]>;
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
        // Only include slots that fall inside the viewer's selected day
        if (curMs >= viewerDayStartMs && curMs < viewerDayEndMs) {
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
  const token        = useAppSelector(selectAuthToken);
  const userProfile  = useAppSelector(selectHopenityProfile);

  // Viewer's local currency — derived from their Hopenity country code.
  const viewerCurrency = useMemo(
    () => currencyForCountry(userProfile?.country),
    [userProfile?.country],
  );

  const today = useMemo(() => new Date(), []);
  const [loading, setLoading]         = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking]         = useState(false);
  const [profile, setProfile]         = useState<PremiumCallProfile | null>(null);
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

  // Viewer's device timezone — always the most accurate source.
  const viewerTz = useMemo(() => getDeviceTimezone(), []);

  // Creator's timezone priority:
  //   1. Saved timezone on their premium-calls profile (set when they saved setup)
  //   2. Country-based fallback from their Hopenity profile (covers older accounts
  //      that saved before timezone tracking was added)
  //   3. 'UTC' as the last resort
  const creatorTz = useMemo(() => {
    if (profile?.timezone) return profile.timezone;
    // `route.params` doesn't carry the creator's country, but if it ever does
    // this is where we'd call timezoneFromCountry(creatorCountry).
    // For now, fall back to UTC so nothing is broken for existing profiles.
    return 'UTC';
  }, [profile?.timezone]);

  const sameTimezone = viewerTz === creatorTz;

  const selectedDate = useMemo(() => {
    if (!selectedDay) return null;
    return new Date(calendarYear, calendarMonth, selectedDay);
  }, [calendarYear, calendarMonth, selectedDay]);

  useEffect(() => {
    if (!targetUserId) {
      Alert.alert('Invalid link', 'This booking link is not valid.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    fetchAvailableSlots(targetUserId, isoDate(today))
      .then(data => {
        if (data?.profile) {
          setProfile(data.profile);
        } else {
          Alert.alert(
            'Not available',
            `${targetName} is not currently accepting call bookings.`,
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
        }
        if (data?.existingBookings) setExistingBookings(data.existingBookings);
      })
      .catch(() => Toast.error('Could not load availability. Please try again.'))
      .finally(() => setLoading(false));
  }, [targetUserId, today]);

  useEffect(() => {
    if (!profile || !selectedDate) return;
    setSlotsLoading(true);
    fetchAvailableSlots(targetUserId, isoDate(selectedDate))
      .then(data => { if (data?.existingBookings) setExistingBookings(data.existingBookings); })
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, targetUserId, profile]);

  const monthGrid = useMemo(() =>
    getMonthGrid(calendarYear, calendarMonth), [calendarYear, calendarMonth]);

  const availableSlots = useMemo(() => {
    if (!profile || !selectedDate || !selectedDuration) return [];
    if (profile.anytime) {
      // "Anytime" profile: show standard business hours 8 AM – 8 PM in viewer TZ
      return Array.from({ length: 13 }, (_, i) => {
        const h = (8 + i).toString().padStart(2, '0');
        return `${h}:00`;
      });
    }
    return generateSlots(
      profile, selectedDate, selectedDuration,
      existingBookings, creatorTz, viewerTz,
    );
  }, [profile, selectedDate, selectedDuration, existingBookings, creatorTz, viewerTz]);

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
  const feePrice = totalPriceUSD != null
    ? convertFromUSD(totalPriceUSD * 0.15, viewerCurrency)
    : null;

  const isDateAvailable = useCallback((year: number, month: number, day: number): boolean => {
    const d = new Date(year, month, day);  // midnight, viewer local TZ
    if (d < today) return false;
    if (!profile || profile.anytime) return true;
    // Check in creator's timezone — a day the viewer sees may map to a different
    // creator-day if their timezones differ by a large amount.  We scan -1/0/+1
    // creator-days and mark the viewer-day available if any of them has slots.
    const schedule = profile.weeklySchedule as Record<string, unknown[]>;
    for (let shift = -1; shift <= 1; shift++) {
      const probeMs = getLocalMidnightAsUTC(d, viewerTz) + shift * 24 * 3600_000 + 12 * 3600_000;
      const creatorDayKey = getWeekdayInTimezone(new Date(probeMs), creatorTz);
      if ((schedule[creatorDayKey]?.length ?? 0) > 0) return true;
    }
    return false;
  }, [profile, today, creatorTz, viewerTz]);

  const prevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
    else setCalendarMonth(m => m - 1);
    setSelectedDay(null); setSelectedTime(null);
  };
  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
    else setCalendarMonth(m => m + 1);
    setSelectedDay(null); setSelectedTime(null);
  };

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

    if (!result) {
      Toast.error('Could not complete booking. Please try again.');
      return;
    }

    Alert.alert(
      '📞 Call booked!',
      `Your call with ${targetName} is scheduled for ${formatDate(selectedDate)} at ${fmt12(selectedTime!)} (${formatTimezoneLabel(viewerTz)}).`,
      [{ text: 'OK', onPress: () => navigation.goBack() }],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={colorss.primary} />
        <Text style={s.loadingText}>Loading availability…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
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

        {/* ── Full Month Calendar ── */}
        <Text style={s.fieldLabel}>Select Date & Time</Text>
        <View style={s.calendarCard}>
          {/* Month header */}
          <View style={s.calMonthRow}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <ChevronLeft size={20} color={colorss.textPrimary} />
            </TouchableOpacity>
            <Text style={s.calMonthText}>
              {MONTH_NAMES[calendarMonth]} {calendarYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <ChevronRight size={20} color={colorss.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={s.calDayHeaders}>
            {DAY_HEADERS.map(d => (
              <Text key={d} style={s.calDayHeader}>{d}</Text>
            ))}
          </View>

          {/* Weeks */}
          {monthGrid.map((week, wi) => (
            <View key={wi} style={s.calWeek}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={s.calCell} />;
                const available = isDateAvailable(calendarYear, calendarMonth, day);
                const active = selectedDay === day;
                const isPast = new Date(calendarYear, calendarMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                return (
                  <TouchableOpacity
                    key={di}
                    style={[
                      s.calCell,
                      available && !isPast && s.calCellAvailable,
                      active && s.calCellActive,
                      isPast && s.calCellPast,
                    ]}
                    onPress={() => {
                      if (!available || isPast) return;
                      setSelectedDay(day);
                      setSelectedTime(null);
                    }}
                    disabled={!available || isPast}
                  >
                    <Text style={[
                      s.calDayNum,
                      available && !isPast && s.calDayNumAvailable,
                      active && s.calDayNumActive,
                      isPast && s.calDayNumPast,
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Timezone banner — only when a duration is chosen so it doesn't clutter early */}
        {selectedDuration && !sameTimezone && (
          <View style={s.tzBanner}>
            <Text style={s.tzBannerText}>
              🌐 Times shown in{' '}
              <Text style={s.tzBold}>{formatTimezoneLabel(viewerTz)}</Text>
              {'  ·  '}Expert is in{' '}
              <Text style={s.tzBold}>{formatTimezoneLabel(creatorTz)}</Text>
            </Text>
          </View>
        )}

        {/* Time slots (shown when day is selected) */}
        {selectedDay && selectedDuration && (
          <View style={s.timeSlotsWrap}>
            {slotsLoading ? (
              <ActivityIndicator size="small" color={colorss.primary} />
            ) : availableSlots.length === 0 ? (
              <Text style={s.noSlots}>No available slots on this day. Try another date.</Text>
            ) : (
              <View style={s.timeGrid}>
                {availableSlots.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.timeChip, selectedTime === t && s.timeChipActive]}
                    onPress={() => setSelectedTime(t)}
                  >
                    <Text style={[s.timeText, selectedTime === t && s.timeTextActive]}>
                      {fmt12(t)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Price summary */}
        {totalPrice != null && feePrice != null && (
          <View style={s.priceSummary}>
            <View style={s.priceLine}>
              <Text style={s.priceKey}>Session price</Text>
              <Text style={s.priceVal}>{totalPrice.display}</Text>
            </View>
            <View style={s.priceLine}>
              <Text style={s.priceKey}>Platform fee (15 %)</Text>
              <Text style={s.priceVal}>{feePrice.display}</Text>
            </View>
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
      <View style={s.footer}>
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
    </SafeAreaView>
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
    padding: 16, backgroundColor: colorss.white,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colorss.border,
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colorss.primary, borderRadius: 12, paddingVertical: 15,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
