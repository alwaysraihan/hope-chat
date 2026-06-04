/**
 * DatePickerSheet — bottom-sheet calendar with optional time slots.
 *
 * Props:
 *   visible         show/hide the sheet
 *   onClose         dismiss without confirming
 *   onConfirm       called with { date, time? } when the user taps Confirm
 *   isDateAvailable (optional) callback; return false to disable a day
 *   availableSlots  (optional) array of "HH:MM" strings; if provided, a
 *                   time-slot grid is shown after a day is picked
 *   slotsLoading    spinner while slots are fetched
 *   mode            'date' = date only | 'datetime' = date + time slots
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
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colorss } from '../theme';
import { fmt12 } from '../screens/BookCallScreen';   // re-use existing helper

// ─── Month grid builder ───────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_HDRS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function buildGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const slice = cells.slice(i, i + 7);
    while (slice.length < 7) slice.push(null);
    rows.push(slice);
  }
  return rows;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type DatePickerResult = { date: Date; time?: string };

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (result: DatePickerResult) => void;
  /** Return false to disable/grey a date (e.g. days the creator has no slots). */
  isDateAvailable?: (year: number, month: number, day: number) => boolean;
  availableSlots?: string[];
  slotsLoading?: boolean;
  mode?: 'date' | 'datetime';
  title?: string;
  confirmLabel?: string;
  /** Dates strictly after this are greyed out and not tappable. */
  maxDate?: Date;
  /**
   * Fires whenever the user taps a day inside the sheet so the parent can
   * load/compute slots for that date before the user confirms.
   * Parent should update the `availableSlots` prop in response.
   */
  onDayChange?: (date: Date) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DatePickerSheet({
  visible,
  onClose,
  onConfirm,
  isDateAvailable,
  availableSlots = [],
  slotsLoading = false,
  mode = 'date',
  title = 'Select Date',
  confirmLabel = 'Confirm',
  maxDate,
  onDayChange,
}: Props) {
  const slideAnim = useRef(new Animated.Value(600)).current;

  const today = useMemo(() => new Date(), []);
  const todayMidnight = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()), [today]);

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear]   = useState(today.getFullYear());
  const [pickedDay, setPickedDay]   = useState<number | null>(null);
  const [pickedTime, setPickedTime] = useState<string | null>(null);

  // Reset when sheet opens
  useEffect(() => {
    if (visible) {
      setMonth(today.getMonth());
      setYear(today.getFullYear());
      setPickedDay(null);
      setPickedTime(null);
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 260, useNativeDriver: true }).start();
    }
  }, [visible]);

  const prevMonth = useCallback(() => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setPickedDay(null); setPickedTime(null);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setPickedDay(null); setPickedTime(null);
  }, [month]);

  const grid = useMemo(() => buildGrid(year, month), [year, month]);

  const isDayEnabled = useCallback((day: number): boolean => {
    const d = new Date(year, month, day);
    if (d < todayMidnight) return false;
    if (maxDate && d > maxDate) return false;
    if (isDateAvailable) return isDateAvailable(year, month, day);
    return true;
  }, [year, month, todayMidnight, maxDate, isDateAvailable]);

  const canConfirm = mode === 'date'
    ? pickedDay != null
    : pickedDay != null && pickedTime != null;

  const handleConfirm = () => {
    if (!pickedDay) return;
    const date = new Date(year, month, pickedDay);
    onConfirm({ date, time: pickedTime ?? undefined });
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Pressable style={cs.backdrop} onPress={onClose} />
      <Animated.View style={[cs.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle + header */}
        <View style={cs.handle} />
        <Text style={cs.title}>{title}</Text>

        {/* Month navigation */}
        <View style={cs.monthRow}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ChevronLeft size={22} color={colorss.textPrimary} />
          </TouchableOpacity>
          <Text style={cs.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ChevronRight size={22} color={colorss.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Day-of-week headers */}
        <View style={cs.weekHeaders}>
          {DAY_HDRS.map(d => (
            <Text key={d} style={cs.weekHeader}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        {grid.map((week, wi) => (
          <View key={wi} style={cs.week}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={cs.cell} />;
              const enabled = isDayEnabled(day);
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const active  = pickedDay === day;
              const isPast  = new Date(year, month, day) < todayMidnight;
              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    cs.cell,
                    cs.cellTappable,
                    isToday && !active && cs.cellToday,
                    active && cs.cellActive,
                    (!enabled || isPast) && cs.cellDisabled,
                  ]}
                  disabled={!enabled || isPast}
                  onPress={() => {
                    setPickedDay(day);
                    setPickedTime(null);
                    onDayChange?.(new Date(year, month, day));
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    cs.cellText,
                    active && cs.cellTextActive,
                    (!enabled || isPast) && cs.cellTextDisabled,
                    isToday && !active && cs.cellTextToday,
                  ]}>
                    {day}
                  </Text>
                  {enabled && !isPast && !active && (
                    <View style={cs.availableDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Time slots — shown after a day is picked (datetime mode) */}
        {mode === 'datetime' && pickedDay != null && (
          <View style={cs.slotsSection}>
            <Text style={cs.slotsLabel}>Available times</Text>
            {slotsLoading ? (
              <ActivityIndicator size="small" color={colorss.primary} style={{ marginVertical: 12 }} />
            ) : availableSlots.length === 0 ? (
              <Text style={cs.noSlots}>No available slots — try another date.</Text>
            ) : (
              <View style={cs.slotsGrid}>
                {availableSlots.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[cs.slotChip, pickedTime === t && cs.slotChipActive]}
                    onPress={() => setPickedTime(t)}
                    activeOpacity={0.75}
                  >
                    <Text style={[cs.slotText, pickedTime === t && cs.slotTextActive]}>
                      {fmt12(t)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Confirm */}
        <TouchableOpacity
          style={[cs.confirmBtn, !canConfirm && cs.confirmBtnDisabled]}
          disabled={!canConfirm}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Text style={cs.confirmText}>{confirmLabel}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colorss.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colorss.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: '700', color: colorss.textPrimary, textAlign: 'center', marginBottom: 12 },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colorss.textPrimary },

  weekHeaders: { flexDirection: 'row', marginBottom: 4 },
  weekHeader: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colorss.placeholder },

  week: { flexDirection: 'row', marginBottom: 4 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellTappable: { borderRadius: 999 },
  cellToday: { borderWidth: 1.5, borderColor: colorss.primary, borderRadius: 999 },
  cellActive: { backgroundColor: colorss.primary, borderRadius: 999 },
  cellDisabled: { opacity: 0.3 },
  cellText: { fontSize: 14, fontWeight: '500', color: colorss.textPrimary },
  cellTextActive: { color: '#fff', fontWeight: '700' },
  cellTextDisabled: { color: colorss.placeholder },
  cellTextToday: { color: colorss.primary, fontWeight: '700' },
  availableDot: {
    position: 'absolute', bottom: 3,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: colorss.primary, opacity: 0.7,
  },

  slotsSection: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colorss.border, paddingTop: 12 },
  slotsLabel: { fontSize: 13, fontWeight: '700', color: colorss.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  noSlots: { fontSize: 13, color: colorss.textSecondary, textAlign: 'center', paddingVertical: 8 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: colorss.border, backgroundColor: colorss.white },
  slotChipActive: { backgroundColor: colorss.primary, borderColor: colorss.primary },
  slotText: { fontSize: 13, fontWeight: '600', color: colorss.textPrimary },
  slotTextActive: { color: '#fff' },

  confirmBtn: { backgroundColor: colorss.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
