import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  CheckCircle,
  Clock,
  Info,
  Plus,
  Trash2,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import type { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken, selectHopenityProfile } from '../redux/features/auth/authSlice';
import {
  fetchMyPremiumProfile,
  savePremiumProfile,
  type PremiumCallProfile,
  type DaySlot,
  type WeeklySchedule,
} from '../services/premiumCallService';
import { openHopenityBestEffort } from '../services/hopenityLinking';
import { getDeviceTimezone, formatTimezoneLabel } from '../utils/timezone';
import {
  currencyForCountry,
  symbolForCurrency,
  convertFromUSD,
  convertToUSD,
  rateFromUSD,
} from '../utils/currency';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'PremiumCallSetup'>;
type Tab = 'availability' | 'pricing' | 'about';
type Day = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const DAYS: { key: Day; label: string }[] = [
  { key: 'monday',    label: 'Monday'    },
  { key: 'tuesday',   label: 'Tuesday'   },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday',  label: 'Thursday'  },
  { key: 'friday',    label: 'Friday'    },
  { key: 'saturday',  label: 'Saturday'  },
  { key: 'sunday',    label: 'Sunday'    },
];

// Default for the first slot when a day is first enabled — 1 hour is a
// reasonable starting point; the creator adjusts from there.
const DEFAULT_SLOT: DaySlot = { start: '10:00', end: '11:00' };

function toHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Build a new slot starting right after the latest end time of existing slots. */
function nextSlotAfter(existing: DaySlot[]): DaySlot | null {
  if (!existing.length) return { ...DEFAULT_SLOT };

  const maxEndMin = existing.reduce((max, slot) => {
    const [h, m] = slot.end.split(':').map(Number);
    return Math.max(max, h * 60 + m);
  }, 0);

  // No room after 23:00
  if (maxEndMin >= 23 * 60) return null;

  const newStart = maxEndMin;
  const newEnd   = Math.min(newStart + 60, 24 * 60); // +1 hour, cap at midnight
  return { start: toHHMM(newStart), end: toHHMM(newEnd) };
}

const HOURS   = Array.from({ length: 24 }, (_, i) => i);           // 0–23
const MINUTES = [0, 15, 30, 45];

function padZ(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${padZ(m)} ${period}`;
}

// ─── Time Picker ─────────────────────────────────────────────────────────────

const ITEM_H = 44;
const VISIBLE = 5;
const PICKER_H = ITEM_H * VISIBLE;

function ColumnPicker<T extends number>({
  items,
  selected,
  onSelect,
  label,
}: {
  items: T[];
  selected: T;
  onSelect: (v: T) => void;
  label: (v: T) => string;
}) {
  const listRef = useRef<FlatList<T>>(null);
  const selectedIdx = items.indexOf(selected);

  useEffect(() => {
    if (listRef.current && selectedIdx >= 0) {
      listRef.current.scrollToIndex({
        index: selectedIdx,
        animated: false,
        viewPosition: 0.5,
      });
    }
  }, []);

  return (
    <View style={tp.col}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={v => String(v)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        getItemLayout={(_, idx) => ({ length: ITEM_H, offset: ITEM_H * idx, index: idx })}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        style={{ height: PICKER_H }}
        renderItem={({ item }) => {
          const active = item === selected;
          return (
            <TouchableOpacity
              style={[tp.item, active && tp.itemActive]}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <Text style={[tp.itemText, active && tp.itemTextActive]}>
                {label(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
      {/* Selection indicator lines */}
      <View pointerEvents="none" style={tp.overlay}>
        <View style={tp.selectionLine} />
        <View style={[tp.selectionLine, { marginTop: ITEM_H - 1 }]} />
      </View>
    </View>
  );
}

const tp = StyleSheet.create({
  col: { flex: 1, overflow: 'hidden' },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  itemActive: { backgroundColor: `${colorss.primary}15` },
  itemText: { fontSize: 18, color: colorss.textSecondary, fontWeight: '400' },
  itemTextActive: { color: colorss.primary, fontWeight: '700', fontSize: 20 },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  selectionLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colorss.border,
    marginHorizontal: 8,
  },
});

function TimePickerModal({
  visible,
  initialValue,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  initialValue: string;
  onConfirm: (hhmm: string) => void;
  onClose: () => void;
}) {
  const [hStr, mStr] = initialValue.split(':');
  const [hour, setHour] = useState<number>(parseInt(hStr ?? '9', 10));
  const [minute, setMinute] = useState<number>(
    MINUTES.includes(parseInt(mStr ?? '0', 10))
      ? parseInt(mStr ?? '0', 10)
      : 0,
  );

  // Reset when modal opens with a new value
  useEffect(() => {
    if (visible) {
      const [h, m] = initialValue.split(':');
      setHour(parseInt(h ?? '9', 10));
      setMinute(MINUTES.includes(parseInt(m ?? '0', 10)) ? parseInt(m ?? '0', 10) : 0);
    }
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={tpm.backdrop} onPress={onClose} />
      <View style={tpm.sheet}>
        <View style={tpm.handle} />
        <Text style={tpm.title}>
          Select time · {formatTime(`${padZ(hour)}:${padZ(minute)}`)}
        </Text>

        <View style={tpm.columnsWrap}>
          {/* Hour column */}
          <ColumnPicker
            items={HOURS}
            selected={hour}
            onSelect={setHour}
            label={h => {
              const period = h < 12 ? 'AM' : 'PM';
              const h12 = h % 12 === 0 ? 12 : h % 12;
              return `${h12} ${period}`;
            }}
          />

          <Text style={tpm.colon}>:</Text>

          {/* Minute column */}
          <ColumnPicker
            items={MINUTES}
            selected={minute}
            onSelect={setMinute}
            label={m => padZ(m)}
          />
        </View>

        <View style={tpm.actions}>
          <TouchableOpacity style={tpm.cancelBtn} onPress={onClose}>
            <Text style={tpm.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={tpm.confirmBtn}
            onPress={() => {
              onConfirm(`${padZ(hour)}:${padZ(minute)}`);
              onClose();
            }}
          >
            <Text style={tpm.confirmText}>Set time</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const tpm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colorss.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colorss.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  title: {
    fontSize: 16, fontWeight: '700', color: colorss.textPrimary,
    textAlign: 'center', paddingVertical: 12,
  },
  columnsWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 32, gap: 8,
  },
  colon: { fontSize: 24, fontWeight: '700', color: colorss.textPrimary, marginBottom: 4 },
  actions: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingTop: 16,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: colorss.backgroundDeep, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colorss.textSecondary },
  confirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: colorss.primary, alignItems: 'center',
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ─── SlotRow with tap-to-pick times ──────────────────────────────────────────

function SlotRow({
  slot,
  onUpdate,
  onRemove,
}: {
  slot: DaySlot;
  onUpdate: (s: DaySlot) => void;
  onRemove: () => void;
}) {
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  return (
    <>
      <View style={s.slotRow}>
        {/* Start time button */}
        <TouchableOpacity
          style={s.timePill}
          onPress={() => setPickerTarget('start')}
          activeOpacity={0.7}
        >
          <Clock size={13} color={colorss.primary} />
          <Text style={s.timePillText}>{formatTime(slot.start)}</Text>
        </TouchableOpacity>

        <Text style={s.slotDash}>→</Text>

        {/* End time button */}
        <TouchableOpacity
          style={s.timePill}
          onPress={() => setPickerTarget('end')}
          activeOpacity={0.7}
        >
          <Clock size={13} color={colorss.primary} />
          <Text style={s.timePillText}>{formatTime(slot.end)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 size={16} color={colorss.error} />
        </TouchableOpacity>
      </View>

      <TimePickerModal
        visible={pickerTarget === 'start'}
        initialValue={slot.start}
        onConfirm={v => onUpdate({ ...slot, start: v })}
        onClose={() => setPickerTarget(null)}
      />
      <TimePickerModal
        visible={pickerTarget === 'end'}
        initialValue={slot.end}
        onConfirm={v => onUpdate({ ...slot, end: v })}
        onClose={() => setPickerTarget(null)}
      />
    </>
  );
}

// ─── PriceInput ───────────────────────────────────────────────────────────────

function PriceInput({
  label,
  /** Value in LOCAL currency units (already converted for display). */
  value,
  symbol,
  onChange,
}: {
  label: string;
  value: number | null;
  symbol: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <View style={s.priceRow}>
      <View style={s.priceLeft}>
        <Clock size={16} color={colorss.primary} />
        <Text style={s.priceLabel}>{label}</Text>
      </View>
      <View style={s.priceInputWrap}>
        <Text style={s.priceCurrency}>{symbol}</Text>
        <TextInput
          value={value != null ? String(Math.round(value)) : ''}
          onChangeText={t => {
            const n = parseFloat(t.replace(/,/g, ''));
            onChange(Number.isFinite(n) && n >= 0 ? n : null);
          }}
          style={s.priceInputField}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colorss.placeholder}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PremiumCallSetupScreen({ navigation }: Props) {
  const token   = useAppSelector(selectAuthToken);
  const profile = useAppSelector(selectHopenityProfile);

  // Creator's currency — derived from their Hopenity country profile.
  const currency = currencyForCountry(profile?.country);
  const symbol   = symbolForCurrency(currency);
  const rate     = rateFromUSD(currency);

  // Convert a USD value (from DB) to local currency for display/input.
  const toLocal = (usd: number | null): number | null =>
    usd != null ? usd * rate : null;
  // Convert a local-currency input back to USD before saving.
  const toUSD = (local: number | null): number | null =>
    local != null ? convertToUSD(local, currency) : null;

  const [activeTab, setActiveTab] = useState<Tab>('availability');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isEnabled, setIsEnabled] = useState(false);
  const [anytime, setAnytime] = useState(false);
  const [schedule, setSchedule] = useState<WeeklySchedule>({});
  // Price state is stored in LOCAL currency for the input fields.
  const [price5, setPrice5]   = useState<number | null>(null);
  const [price10, setPrice10] = useState<number | null>(null);
  const [price30, setPrice30] = useState<number | null>(null);
  const [price60, setPrice60] = useState<number | null>(null);
  const [wishPrice, setWishPrice] = useState<number | null>(null);
  const [expertise, setExpertise] = useState<string[]>([]);
  const [expertiseInput, setExpertiseInput] = useState('');
  const [bio, setBio] = useState('');

  const [serviceDown, setServiceDown] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetchMyPremiumProfile(token)
      .then(({ profile: p, serverError }) => {
        if (serverError) {
          setServiceDown(true);
          return;
        }
        if (p) {
          setIsEnabled(p.isEnabled);
          setAnytime(p.anytime);
          setSchedule(p.weeklySchedule ?? {});
          // Convert USD prices from DB → local currency for input display
          setPrice5(toLocal(p.price5min));
          setPrice10(toLocal(p.price10min));
          setPrice30(toLocal(p.price30min));
          setPrice60(toLocal(p.price60min));
          setWishPrice(toLocal(p.hopeWishPrice));
          setExpertise(p.expertise ?? []);
          setBio(p.bio ?? '');
        }
      })
      .catch(() => setServiceDown(true))
      .finally(() => setLoading(false));
  // toLocal captures rate at mount; re-run if profile country changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleDay = useCallback((day: Day) => {
    setSchedule(prev => {
      if (prev[day]?.length) {
        const next = { ...prev };
        delete next[day];
        return next;
      }
      return { ...prev, [day]: [{ ...DEFAULT_SLOT }] };
    });
  }, []);

  const addSlot = useCallback((day: Day) => {
    setSchedule(prev => {
      const existing = prev[day] ?? [];
      const next = nextSlotAfter(existing);
      if (!next) return prev; // no room after 23:00 — silently block
      return { ...prev, [day]: [...existing, next] };
    });
  }, []);

  const updateSlot = useCallback((day: Day, idx: number, slot: DaySlot) => {
    setSchedule(prev => {
      const slots = [...(prev[day] ?? [])];
      slots[idx] = slot;
      return { ...prev, [day]: slots };
    });
  }, []);

  const removeSlot = useCallback((day: Day, idx: number) => {
    setSchedule(prev => {
      const slots = (prev[day] ?? []).filter((_, i) => i !== idx);
      if (!slots.length) {
        const next = { ...prev };
        delete next[day];
        return next;
      }
      return { ...prev, [day]: slots };
    });
  }, []);

  const addExpertise = () => {
    const tag = expertiseInput.trim();
    if (tag && !expertise.includes(tag)) setExpertise(prev => [...prev, tag]);
    setExpertiseInput('');
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    // Convert local-currency inputs back to USD before persisting to DB.
    // timezone is deliberately excluded — the premium-calls backend does not
    // have this column yet. Re-add once the server migration is deployed.
    const { ok, message, status } = await savePremiumProfile({
      isEnabled, anytime, weeklySchedule: schedule,
      price5min:    toUSD(price5),
      price10min:   toUSD(price10),
      price30min:   toUSD(price30),
      price60min:   toUSD(price60),
      hopeWishPrice:toUSD(wishPrice),
      expertise, bio,
    }, token);
    setSaving(false);

    if (ok) {
      Alert.alert('Saved', 'Your premium call profile has been updated.');
      navigation.goBack();
      return;
    }

    // 500 = backend service is down or DB migration is pending — not a user error.
    if (status === 500 || status === 0) {
      Alert.alert(
        '⚠️ Service temporarily unavailable',
        'The Premium Calls service is currently experiencing issues on the server. ' +
        'Your changes have not been lost — please try again in a few minutes.',
        [{ text: 'OK' }],
      );
      return;
    }

    // 403 = verification gate.
    const isVerificationError =
      status === 403 ||
      (typeof message === 'string' && message.toLowerCase().includes('verif'));

    if (isVerificationError) {
      Alert.alert(
        '✅ Verification required',
        message ?? 'You must be a verified user to enable premium calls.',
        [
          { text: 'Get Verified', onPress: () => void openHopenityBestEffort().catch(() => undefined) },
          { text: 'OK', style: 'cancel' },
        ],
      );
    } else {
      Alert.alert('Could not save', message ?? 'Something went wrong. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={colorss.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Fixed header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.cancelBtn}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Premium Calls</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || serviceDown}
          style={[s.saveBtn, serviceDown && s.saveBtnDisabled]}
        >
          {saving
            ? <ActivityIndicator size="small" color={colorss.primary} />
            : <Text style={[s.saveText, serviceDown && s.saveTextDisabled]}>Save</Text>}
        </TouchableOpacity>
      </View>

      {/* Service-down banner — shown when backend returns 500 */}
      {serviceDown && (
        <View style={s.serviceDownBanner}>
          <Text style={s.serviceDownText}>
            ⚠️ Premium Calls service is temporarily unavailable. Saving is disabled until the server is restored.
          </Text>
        </View>
      )}

      {/* Fixed enable toggle */}
      <View style={s.enableRow}>
        <View style={s.enableLeft}>
          <CheckCircle size={20} color={isEnabled ? colorss.success : colorss.textSecondary} />
          <Text style={s.enableLabel}>
            {isEnabled ? 'Premium calls enabled' : 'Enable premium calls'}
          </Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={setIsEnabled}
          trackColor={{ false: colorss.border, true: `${colorss.primary}55` }}
          thumbColor={isEnabled ? colorss.primary : '#fff'}
        />
      </View>

      {/* Fixed tab bar */}
      <View style={s.tabBar}>
        {(['availability', 'pricing', 'about'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Keyboard-aware scrollable content */}
      <KeyboardAwareScrollView
        style={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={24}
        extraKeyboardSpace={16}
      >
        {/* ── Availability ── */}
        {activeTab === 'availability' && (
          <View style={s.section}>
            <View style={s.anytimeRow}>
              <View>
                <Text style={s.anytimeLabel}>Available anytime</Text>
                <Text style={s.anytimeSub}>Show as available 24/7</Text>
              </View>
              <Switch
                value={anytime}
                onValueChange={setAnytime}
                trackColor={{ false: colorss.border, true: `${colorss.primary}55` }}
                thumbColor={anytime ? colorss.primary : '#fff'}
              />
            </View>

            {!anytime && (
              <>
                <Text style={s.sectionTitle}>Weekly schedule</Text>
                <Text style={s.sectionSub}>
                  Tap a day to enable it, then set your available hours.{'\n'}
                  🌐 Times are in your timezone:{' '}
                  <Text style={{ fontWeight: '700', color: colorss.primary }}>
                    {formatTimezoneLabel(getDeviceTimezone())}
                  </Text>
                </Text>
                {DAYS.map(({ key, label }) => {
                  const slots = schedule[key] ?? [];
                  const active = slots.length > 0;
                  return (
                    <View key={key} style={s.dayBlock}>
                      <TouchableOpacity style={s.dayHeader} onPress={() => toggleDay(key)}>
                        <View style={[s.dayCheckbox, active && s.dayCheckboxActive]}>
                          {active && <Text style={s.dayCheckmark}>✓</Text>}
                        </View>
                        <Text style={[s.dayLabel, active && s.dayLabelActive]}>{label}</Text>
                        {active && (
                          <TouchableOpacity onPress={() => addSlot(key)} style={s.addSlotBtn}>
                            <Plus size={14} color={colorss.primary} />
                            <Text style={s.addSlotText}>Add slot</Text>
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>

                      {active && slots.map((slot, idx) => (
                        <SlotRow
                          key={idx}
                          slot={slot}
                          onUpdate={s2 => updateSlot(key, idx, s2)}
                          onRemove={() => removeSlot(key, idx)}
                        />
                      ))}

                      {!active && (
                        <Text style={s.dayUnavailable}>Unavailable</Text>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* ── Pricing ── */}
        {activeTab === 'pricing' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Call prices</Text>
            <Text style={s.sectionSub}>
              The platform retains 15 % — you receive 85 % after each completed call.
            </Text>

            <View style={s.pricingCard}>
              <PriceInput label="5 minutes"  symbol={symbol} value={price5}  onChange={setPrice5}  />
              <View style={s.priceDivider} />
              <PriceInput label="10 minutes" symbol={symbol} value={price10} onChange={setPrice10} />
              <View style={s.priceDivider} />
              <PriceInput label="30 minutes" symbol={symbol} value={price30} onChange={setPrice30} />
              <View style={s.priceDivider} />
              <PriceInput label="1 hour"     symbol={symbol} value={price60} onChange={setPrice60} />
            </View>

            <Text style={[s.sectionTitle, { marginTop: 24 }]}>Hope Wish (video message)</Text>
            <Text style={s.sectionSub}>
              Fans can request a personalised video message from you.
            </Text>

            <View style={s.pricingCard}>
              <PriceInput label="Per video wish" symbol={symbol} value={wishPrice} onChange={setWishPrice} />
            </View>

            <View style={s.infoBox}>
              <Info size={14} color={colorss.primary} />
              <Text style={s.infoText}>
                Prices shown in your local currency ({currency}). The platform retains 15 % — you receive 85 %.{'\n'}
                💳 Payments are processed in USD. Callers see prices in their own currency.
              </Text>
            </View>
          </View>
        )}

        {/* ── About ── */}
        {activeTab === 'about' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Expertise</Text>
            <Text style={s.sectionSub}>Tags that describe your skills (tap ✕ to remove).</Text>

            <View style={s.tagsWrap}>
              {expertise.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={s.tag}
                  onPress={() => setExpertise(prev => prev.filter(t => t !== tag))}
                >
                  <Text style={s.tagText}>{tag}</Text>
                  <Text style={s.tagX}> ✕</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.tagInputRow}>
              <TextInput
                value={expertiseInput}
                onChangeText={setExpertiseInput}
                style={s.tagInput}
                placeholder="e.g. Software, Marketing, Design…"
                placeholderTextColor={colorss.placeholder}
                onSubmitEditing={addExpertise}
                returnKeyType="done"
              />
              <TouchableOpacity style={s.tagAddBtn} onPress={addExpertise}>
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={[s.sectionTitle, { marginTop: 24 }]}>About your service</Text>
            <Text style={s.sectionSub}>
              Tell callers what to expect (max 300 characters).
            </Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              style={s.bioInput}
              multiline
              maxLength={300}
              placeholder="e.g. I help founders build their first product. Book a call for hands-on advice on tech, growth, or fundraising."
              placeholderTextColor={colorss.placeholder}
              textAlignVertical="top"
            />
            <Text style={s.charCount}>{bio.length}/300</Text>
          </View>
        )}

        <View style={{ height: 48 }} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colorss.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colorss.border,
    backgroundColor: colorss.white,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colorss.textPrimary },
  cancelBtn:   { padding: 4 },
  cancelText:  { fontSize: 15, color: colorss.textSecondary },
  saveBtn:     { padding: 4, minWidth: 48, alignItems: 'center' },
  saveText:          { fontSize: 15, fontWeight: '700', color: colorss.primary },
  saveBtnDisabled:   { opacity: 0.35 },
  saveTextDisabled:  { color: colorss.textSecondary },
  serviceDownBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F59E0B',
  },
  serviceDownText: { fontSize: 13, color: '#92400E', lineHeight: 18 },

  enableRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colorss.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colorss.border,
  },
  enableLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  enableLabel: { fontSize: 15, fontWeight: '600', color: colorss.textPrimary },

  tabBar: {
    flexDirection: 'row', backgroundColor: colorss.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colorss.border,
  },
  tab:          { flex: 1, alignItems: 'center', paddingVertical: 13 },
  tabActive:    { borderBottomWidth: 2.5, borderBottomColor: colorss.primary },
  tabText:      { fontSize: 13, fontWeight: '600', color: colorss.textSecondary },
  tabTextActive:{ color: colorss.primary },

  scroll:       { flex: 1 },
  section:      { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colorss.textPrimary, marginBottom: 4 },
  sectionSub:   { fontSize: 13, color: colorss.textSecondary, lineHeight: 19, marginBottom: 14 },

  // Availability
  anytimeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colorss.white, borderRadius: 12, padding: 16, marginBottom: 20,
  },
  anytimeLabel: { fontSize: 15, fontWeight: '600', color: colorss.textPrimary },
  anytimeSub:   { fontSize: 12, color: colorss.textSecondary, marginTop: 2 },

  dayBlock: {
    backgroundColor: colorss.white, borderRadius: 12,
    marginBottom: 8, overflow: 'hidden',
  },
  dayHeader:       { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  dayCheckbox:     { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colorss.border, alignItems: 'center', justifyContent: 'center' },
  dayCheckboxActive:{ backgroundColor: colorss.primary, borderColor: colorss.primary },
  dayCheckmark:    { color: '#fff', fontSize: 13, fontWeight: '700' },
  dayLabel:        { flex: 1, fontSize: 15, fontWeight: '500', color: colorss.textSecondary },
  dayLabelActive:  { color: colorss.textPrimary, fontWeight: '600' },
  dayUnavailable:  { paddingHorizontal: 14, paddingBottom: 12, fontSize: 13, color: colorss.textSecondary },
  addSlotBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addSlotText:     { fontSize: 12, color: colorss.primary, fontWeight: '600' },

  slotRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 12, gap: 10,
  },
  timePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1.5, borderColor: colorss.primary, borderRadius: 10,
    paddingVertical: 8, backgroundColor: `${colorss.primary}0D`,
  },
  timePillText: { fontSize: 13, fontWeight: '700', color: colorss.primary },
  slotDash: { color: colorss.textSecondary, fontSize: 16, fontWeight: '600' },

  // Pricing
  pricingCard:   { backgroundColor: colorss.white, borderRadius: 14, overflow: 'hidden' },
  priceRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'space-between' },
  priceLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceLabel:    { fontSize: 14, fontWeight: '500', color: colorss.textPrimary },
  priceInputWrap:{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colorss.border, borderRadius: 8, overflow: 'hidden' },
  priceCurrency: { paddingHorizontal: 10, fontSize: 14, color: colorss.textSecondary, backgroundColor: colorss.backgroundDeep },
  priceInputField:{ width: 80, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14, color: colorss.textPrimary, textAlign: 'right' },
  priceDivider:  { height: StyleSheet.hairlineWidth, backgroundColor: colorss.border, marginHorizontal: 16 },

  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: `${colorss.primary}0D`, borderRadius: 10,
    padding: 12, marginTop: 16,
  },
  infoText: { flex: 1, fontSize: 12, color: colorss.textSecondary, lineHeight: 18 },

  // About
  tagsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tag:         { flexDirection: 'row', alignItems: 'center', backgroundColor: `${colorss.primary}15`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tagText:     { fontSize: 13, color: colorss.primary, fontWeight: '600' },
  tagX:        { fontSize: 12, color: colorss.primary },
  tagInputRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tagInput:    { flex: 1, borderWidth: 1, borderColor: colorss.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colorss.textPrimary, backgroundColor: colorss.white },
  tagAddBtn:   { width: 44, height: 44, borderRadius: 10, backgroundColor: colorss.primary, alignItems: 'center', justifyContent: 'center' },

  bioInput:  { borderWidth: 1, borderColor: colorss.border, borderRadius: 12, padding: 14, fontSize: 14, color: colorss.textPrimary, minHeight: 110, backgroundColor: colorss.white },
  charCount: { fontSize: 12, color: colorss.placeholder, textAlign: 'right', marginTop: 4 },
});
