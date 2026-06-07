/**
 * Hope Wish — request a personalised video message from a creator.
 *
 * Form fields (matching demo):
 *  • Recipient Name: Someone else / Myself
 *  • Name (if someone else)
 *  • Pronouns: He/Him · She/Her · They/Them
 *  • Wish Type (chips with emoji)
 *  • Preferred Tone (chips)
 *  • Wish date & time (inline date + time picker)
 *  • Video length (chip selector)
 *  • Instruction for the video (long text, max 3000 chars)
 *  • Video Privacy: Public / Private
 *  • Confirm & Pay button
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import { ArrowLeft, Calendar, CheckCircle, Clock, Globe, Lock } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { IC_PROFILE } from '../assets';
import { colorss } from '../theme';
import type { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken, selectHopenityProfile } from '../redux/features/auth/authSlice';
import {
  formatBookingCardMessage,
  scheduleBookingNotifications,
} from '../services/bookingNotifications';
import {
  getOrCreatePeerChat,
  sendHopenityChatMessage,
} from '../services/chatService';
import { setBookingForChat } from '../services/bookingChatMap';
import {
  submitHopeWishOrder,
  fetchCreatorWishInfo,
  createWalletTopupCheckout,
  WISH_TYPE_LABELS,
  WISH_TYPE_EMOJI,
  TONE_LABELS,
  PRONOUN_LABELS,
  VIDEO_LENGTH_LABELS,
  type WishType,
  type WishTone,
  type WishPronoun,
  type VideoLength,
} from '../services/hopeWishService';
import { Toast } from '../components/Toast';
import { PaymentWebViewModal } from '../components/PaymentWebViewModal';
import { DatePickerSheet } from '../components/DatePickerSheet';
import { currencyForCountry, convertFromUSD } from '../utils/currency';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'HopeWish'>;

const WISH_TYPES: WishType[] = [
  'happy_birthday',
  'anniversary',
  'graduation',
  'congratulations',
  'motivational_message',
  'shoutout',
  'holiday_greeting',
  'get_well_soon',
];

const TONES: WishTone[] = ['formal', 'friendly', 'casual', 'funny'];
const PRONOUNS: WishPronoun[] = ['he_him', 'she_her', 'they_them'];
const VIDEO_LENGTHS: VideoLength[] = [30, 60, 90, 120, 180];

// ─── Date picker helpers (no external lib) ───────────────────────────────────

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(h: number, m: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

// ─── Chip helper ─────────────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onPress,
  leftIcon,
  style,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  leftIcon?: string;
  style?: object;
}) {
  return (
    <TouchableOpacity
      style={[
        chip.base,
        active && chip.active,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {leftIcon ? <Text style={chip.emoji}>{leftIcon}</Text> : null}
      <Text style={[chip.text, active && chip.textActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const chip = StyleSheet.create({
  base: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5, borderColor: colorss.border,
    backgroundColor: colorss.white,
  },
  active: { borderColor: colorss.primary, backgroundColor: `${colorss.primary}12` },
  emoji: { fontSize: 15 },
  text: { fontSize: 13, fontWeight: '600', color: colorss.textSecondary },
  textActive: { color: colorss.primary },
});

// ─── Date time picker modal (minimal inline picker) ───────────────────────────

function DateTimePickerRow({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value ?? new Date());

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => {
    const d = new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0).getDate();
    return Array.from({ length: d }, (_, i) => i + 1);
  }, [tempDate]);

  const confirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  return (
    <>
      <TouchableOpacity style={dtp.row} onPress={() => setShowPicker(true)}>
        <Calendar size={18} color={colorss.textSecondary} />
        <Text style={value ? dtp.valueTxt : dtp.placeholderTxt}>
          {value
            ? `${formatDisplayDate(value)} · ${formatTime(value.getHours(), value.getMinutes())}`
            : 'Select date & time'}
        </Text>
      </TouchableOpacity>

      {showPicker && (
        <View style={dtp.pickerCard}>
          {/* Date selectors */}
          <View style={dtp.pickerRow}>
            {/* Month */}
            <ScrollView style={dtp.pickerCol} showsVerticalScrollIndicator={false}>
              {MONTH_NAMES.map((mn, idx) => (
                <TouchableOpacity
                  key={mn}
                  style={[dtp.pickerItem, tempDate.getMonth() === idx && dtp.pickerItemActive]}
                  onPress={() => setTempDate(d => new Date(d.getFullYear(), idx, Math.min(d.getDate(), new Date(d.getFullYear(), idx + 1, 0).getDate()), d.getHours(), d.getMinutes()))}
                >
                  <Text style={[dtp.pickerTxt, tempDate.getMonth() === idx && dtp.pickerTxtActive]}>{mn}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Day */}
            <ScrollView style={dtp.pickerCol} showsVerticalScrollIndicator={false}>
              {days.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[dtp.pickerItem, tempDate.getDate() === d && dtp.pickerItemActive]}
                  onPress={() => setTempDate(dt => new Date(dt.getFullYear(), dt.getMonth(), d, dt.getHours(), dt.getMinutes()))}
                >
                  <Text style={[dtp.pickerTxt, tempDate.getDate() === d && dtp.pickerTxtActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Hour */}
            <ScrollView style={dtp.pickerCol} showsVerticalScrollIndicator={false}>
              {Array.from({ length: 24 }, (_, h) => h).map(h => (
                <TouchableOpacity
                  key={h}
                  style={[dtp.pickerItem, tempDate.getHours() === h && dtp.pickerItemActive]}
                  onPress={() => setTempDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, d.getMinutes()))}
                >
                  <Text style={[dtp.pickerTxt, tempDate.getHours() === h && dtp.pickerTxtActive]}>{h.toString().padStart(2,'0')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Minute */}
            <ScrollView style={dtp.pickerCol} showsVerticalScrollIndicator={false}>
              {[0, 15, 30, 45].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[dtp.pickerItem, tempDate.getMinutes() === m && dtp.pickerItemActive]}
                  onPress={() => setTempDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), m))}
                >
                  <Text style={[dtp.pickerTxt, tempDate.getMinutes() === m && dtp.pickerTxtActive]}>{m.toString().padStart(2,'0')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={dtp.pickerActions}>
            <TouchableOpacity onPress={() => setShowPicker(false)} style={dtp.cancelBtn}>
              <Text style={dtp.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirm} style={dtp.confirmBtn}>
              <Text style={dtp.confirmTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
}

const dtp = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colorss.border, borderRadius: 10,
    padding: 13, backgroundColor: colorss.white,
    marginHorizontal: 16,
  },
  placeholderTxt: { color: colorss.placeholder, fontSize: 14 },
  valueTxt: { color: colorss.textPrimary, fontSize: 14, fontWeight: '500' },
  pickerCard: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 12, borderWidth: 1,
    borderColor: colorss.border, backgroundColor: colorss.white, overflow: 'hidden',
  },
  pickerRow: { flexDirection: 'row', height: 160 },
  pickerCol: { flex: 1, borderRightWidth: 1, borderRightColor: colorss.border },
  pickerItem: { paddingVertical: 8, alignItems: 'center' },
  pickerItemActive: { backgroundColor: `${colorss.primary}18` },
  pickerTxt: { fontSize: 13, color: colorss.textSecondary },
  pickerTxtActive: { color: colorss.primary, fontWeight: '700' },
  pickerActions: {
    flexDirection: 'row', gap: 0, borderTopWidth: 1, borderTopColor: colorss.border,
  },
  cancelBtn: { flex: 1, padding: 13, alignItems: 'center' },
  cancelTxt: { color: colorss.textSecondary, fontSize: 14 },
  confirmBtn: { flex: 1, padding: 13, alignItems: 'center', backgroundColor: `${colorss.primary}12` },
  confirmTxt: { color: colorss.primary, fontSize: 14, fontWeight: '700' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HopeWishScreen({ navigation, route }: Props) {
  const { targetUserId, targetName, targetAvatar } = route.params;
  const insets  = useSafeAreaInsets();
  const token   = useAppSelector(selectAuthToken);
  const profile = useAppSelector(selectHopenityProfile);

  // Convert USD price from the premium-calls profile to viewer's local currency.
  const viewerCurrency = useMemo(
    () => currencyForCountry(profile?.country),
    [profile?.country],
  );

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [topping, setTopping]       = useState(false);
  const [wishPrice, setWishPrice]   = useState<number | null>(null); // stored as USD
  const [paymentSheet, setPaymentSheet] = useState<{
    checkoutUrl: string;
    amountDisplay: string;
    returnUrlPrefix: string | null;
  } | null>(null);
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [webViewReturnUrlPrefix, setWebViewReturnUrlPrefix] = useState<string | null>(null);

  // Derived local-currency price for display
  const wishPriceLocal = useMemo(
    () => (wishPrice != null ? convertFromUSD(wishPrice, viewerCurrency) : null),
    [wishPrice, viewerCurrency],
  );

  // Form
  const [recipientType, setRecipientType] = useState<'someone_else' | 'myself'>('someone_else');
  const [recipientName, setRecipientName]   = useState('');
  const [pronouns, setPronouns]             = useState<WishPronoun | null>(null);
  const [wishType, setWishType]             = useState<WishType | null>(null);
  const [tone, setTone]                     = useState<WishTone | null>(null);
  const [deliveryAt, setDeliveryAt]         = useState<Date | null>(null);
  const [dateSheetOpen, setDateSheetOpen]   = useState(false);
  const [videoLength, setVideoLength]       = useState<VideoLength | null>(null);
  const [instructions, setInstructions]     = useState('');
  const [isPublic, setIsPublic]             = useState(true);

  useEffect(() => {
    fetchCreatorWishInfo(targetUserId)
      .then(data => {
        if (data) setWishPrice(data.hopeWishPrice);
        if (!data || !data.isEnabled || data.hopeWishPrice == null) {
          Alert.alert(
            'Not available',
            `${targetName} is not currently accepting Hope Wish requests.`,
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
        }
        // Default delivery date to 7 days from now
        setDeliveryAt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      })
      .finally(() => setLoading(false));
  }, [targetUserId, targetName]);

  const myName = useMemo(() => {
    if (recipientType === 'myself') return profile?.displayName ?? 'Me';
    return recipientName.trim();
  }, [recipientType, recipientName, profile?.displayName]);

  const canSubmit =
    myName.length > 0 &&
    !!wishType &&
    !!tone &&
    !!videoLength &&
    instructions.trim().length > 0;

  const handleSubmit = async () => {
    if (!token || !wishType || !tone || !videoLength) return;
    setSubmitting(true);

    const result = await submitHopeWishOrder(
      {
        creatorId: targetUserId,
        recipientType,
        recipientName: myName,
        pronouns: pronouns ?? null,
        wishType,
        tone,
        instructions: instructions.trim(),
        deliveryAt: deliveryAt?.toISOString(),
        videoLengthSeconds: videoLength,
        isPublic,
      },
      token,
    );

    setSubmitting(false);

    if (result.ok) {
      const scheduledAtIso = deliveryAt?.toISOString()
        ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Schedule delivery reminder (best-effort)
      scheduleBookingNotifications({
        bookingId: result.bookingId,
        isHopeWish: true,
        scheduledAt: scheduledAtIso,
        durationMinutes: videoLength ?? 60,
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
          isHopeWish: true,
          scheduledAt: scheduledAtIso,
          durationMinutes: videoLength ?? 60,
          totalAmount: result.totalAmount,
          peerName: targetName,
        });
        sendHopenityChatMessage(rawChatId, card, token).catch(() => {});
      }

      // Land on the bookings list so the user sees their new Hope Wish, instead
      // of dropping them into the chat thread.
      navigation.replace('MyBookings');
      return;
    }

    if (result.insufficientBalance) {
      const requiredUSD = result.requiredUSD ?? wishPrice ?? 0;
      const amountDisplay = convertFromUSD(requiredUSD, viewerCurrency).display;
      setTopping(true);
      const checkout = await createWalletTopupCheckout(requiredUSD, token);
      setTopping(false);
      if (checkout) {
        setPaymentSheet({
          checkoutUrl: checkout.checkoutUrl,
          amountDisplay,
          returnUrlPrefix: checkout.returnUrlPrefix,
        });
      } else {
        Toast.error('Could not load payment page. Please try again.');
      }
      return;
    }

    Toast.error(result.message ?? 'Could not send request. Please try again.');
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
      {/* Nav */}
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={22} color={colorss.textPrimary} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Hope Wish</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Creator card */}
        <View style={s.creatorCard}>
          <FastImage
            source={targetAvatar ? { uri: targetAvatar } : IC_PROFILE}
            style={s.creatorAvatar}
          />
          <View>
            <Text style={s.creatorName}>{targetName}</Text>
            {wishPriceLocal != null && (
              <Text style={s.creatorPrice}>{wishPriceLocal.display} · personalised video</Text>
            )}
          </View>
        </View>

        {/* ── Recipient Name ── */}
        <Text style={s.sectionTitle}>Recipient Name</Text>
        <View style={s.radioRow}>
          {(['someone_else', 'myself'] as const).map(rt => (
            <TouchableOpacity
              key={rt}
              style={s.radioOption}
              onPress={() => setRecipientType(rt)}
            >
              <View style={[s.radio, recipientType === rt && s.radioActive]}>
                {recipientType === rt && <View style={s.radioDot} />}
              </View>
              <Text style={s.radioLabel}>
                {rt === 'someone_else' ? 'Someone else' : 'Myself'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {recipientType === 'someone_else' && (
          <>
            <Text style={s.fieldLabel}>Name <Text style={s.required}>*</Text></Text>
            <TextInput
              value={recipientName}
              onChangeText={setRecipientName}
              style={s.input}
              placeholder="Type recipient name"
              placeholderTextColor={colorss.placeholder}
              returnKeyType="next"
            />
            {/* Pronouns */}
            <View style={s.chipsRow}>
              {PRONOUNS.map(p => (
                <Chip
                  key={p}
                  label={PRONOUN_LABELS[p]}
                  active={pronouns === p}
                  onPress={() => setPronouns(prev => prev === p ? null : p)}
                />
              ))}
            </View>
          </>
        )}

        {/* ── Wish Type ── */}
        <Text style={s.fieldLabel}>Wish Type <Text style={s.required}>*</Text></Text>
        <View style={s.wishTypeGrid}>
          {WISH_TYPES.map(wt => (
            <Chip
              key={wt}
              label={WISH_TYPE_LABELS[wt]}
              leftIcon={WISH_TYPE_EMOJI[wt]}
              active={wishType === wt}
              onPress={() => setWishType(prev => prev === wt ? null : wt)}
              style={s.wishTypeChip}
            />
          ))}
        </View>

        {/* ── Preferred Tone ── */}
        <Text style={s.fieldLabel}>Preferred tone <Text style={s.required}>*</Text></Text>
        <View style={s.chipsRow}>
          {TONES.map(t => (
            <Chip
              key={t}
              label={TONE_LABELS[t]}
              active={tone === t}
              onPress={() => setTone(prev => prev === t ? null : t)}
            />
          ))}
        </View>

        {/* ── Wish delivery date ── */}
        <Text style={s.fieldLabel}>
          Wish date & time <Text style={s.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={[s.input, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
          onPress={() => setDateSheetOpen(true)}
          activeOpacity={0.75}
        >
          <Calendar size={18} color={deliveryAt ? colorss.primary : colorss.placeholder} />
          <Text style={{ flex: 1, fontSize: 14, color: deliveryAt ? colorss.textPrimary : colorss.placeholder, fontWeight: deliveryAt ? '500' : '400' }}>
            {deliveryAt
              ? deliveryAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              : 'Select delivery date'}
          </Text>
          {deliveryAt && (
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setDeliveryAt(null)}>
              <Text style={{ color: colorss.placeholder, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <DatePickerSheet
          visible={dateSheetOpen}
          onClose={() => setDateSheetOpen(false)}
          onConfirm={({ date }) => setDeliveryAt(date)}
          mode="date"
          title="When to deliver the wish?"
          confirmLabel="Set delivery date"
        />

        <Text style={s.hint}>
          They will receive the video on or before this date.
        </Text>

        {/* ── Video length ── */}
        <Text style={s.fieldLabel}>Video length <Text style={s.required}>*</Text></Text>
        <View style={[s.chipsRow, { flexWrap: 'wrap' }]}>
          {VIDEO_LENGTHS.map(vl => (
            <Chip
              key={vl}
              label={VIDEO_LENGTH_LABELS[vl]}
              active={videoLength === vl}
              onPress={() => setVideoLength(prev => prev === vl ? null : vl)}
            />
          ))}
        </View>

        {/* ── Instructions ── */}
        <Text style={s.fieldLabel}>
          Instruction for the video <Text style={s.required}>*</Text>
        </Text>
        <TextInput
          value={instructions}
          onChangeText={t => setInstructions(t.slice(0, 3000))}
          style={[s.input, s.textArea]}
          multiline
          textAlignVertical="top"
          placeholder="Write your instructions here…"
          placeholderTextColor={colorss.placeholder}
        />
        <Text style={s.hint}>
          Describe your request clearly. Include details like occasion, tone, or any important info. ({instructions.length}/3000 characters)
        </Text>

        {/* ── Video Privacy ── */}
        <Text style={s.fieldLabel}>Video Privacy <Text style={s.required}>*</Text></Text>
        <View style={s.radioRow}>
          {[
            { val: true,  label: 'Public',  Icon: Globe },
            { val: false, label: 'Private', Icon: Lock },
          ].map(({ val, label, Icon }) => (
            <TouchableOpacity
              key={label}
              style={s.radioOption}
              onPress={() => setIsPublic(val)}
            >
              <View style={[s.radio, isPublic === val && s.radioActive]}>
                {isPublic === val && <View style={s.radioDot} />}
              </View>
              <Icon size={15} color={isPublic === val ? colorss.primary : colorss.textSecondary} />
              <Text style={[s.radioLabel, isPublic === val && { color: colorss.primary }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Confirm & Pay */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[s.confirmBtn, (!canSubmit || submitting || topping) && s.confirmBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting || topping}
          activeOpacity={0.85}
        >
          {(submitting || topping) ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <CheckCircle size={18} color="#fff" />
              <Text style={s.confirmBtnText}>
                {wishPriceLocal != null ? `Confirm & Pay · ${wishPriceLocal.display}` : 'Send Hope Wish'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── In-app payment WebView ── */}
      <PaymentWebViewModal
        visible={!!webViewUrl}
        url={webViewUrl}
        title="Top Up Wallet"
        matchUrlPrefix={webViewReturnUrlPrefix}
        onClose={() => { setWebViewUrl(null); setWebViewReturnUrlPrefix(null); }}
        onPaymentComplete={() => {
          setWebViewUrl(null);
          setWebViewReturnUrlPrefix(null);
          Toast.success('Payment complete! You can now retry your Hope Wish.');
        }}
      />

      {/* ── Insufficient-balance payment sheet ── */}
      <Modal
        visible={!!paymentSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentSheet(null)}
      >
        <Pressable style={s.payBackdrop} onPress={() => setPaymentSheet(null)} />
        <View style={[s.paySheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.payHandle} />
          <Text style={s.payTitle}>Top Up Wallet</Text>
          <Text style={s.payBody}>
            Your wallet balance is insufficient for this Hope Wish.{'\n'}
            You need at least{' '}
            <Text style={{ fontWeight: '700', color: colorss.primary }}>
              {paymentSheet?.amountDisplay}
            </Text>{' '}
            to complete this order.
          </Text>
          <TouchableOpacity
            style={s.payBtn}
            activeOpacity={0.85}
            onPress={() => {
              if (paymentSheet?.checkoutUrl) {
                setWebViewUrl(paymentSheet.checkoutUrl);
                setWebViewReturnUrlPrefix(paymentSheet.returnUrlPrefix);
              }
              setPaymentSheet(null);
            }}
          >
            <Text style={s.payBtnText}>Recharge Wallet · {paymentSheet?.amountDisplay}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.payCancelBtn}
            activeOpacity={0.7}
            onPress={() => setPaymentSheet(null)}
          >
            <Text style={s.payCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colorss.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colorss.white, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  navTitle: { fontSize: 17, fontWeight: '700', color: colorss.textPrimary },

  creatorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, margin: 16,
    backgroundColor: `${colorss.primary}12`, borderRadius: 16,
  },
  creatorAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colorss.backgroundDeep },
  creatorName:   { fontSize: 16, fontWeight: '700', color: colorss.textPrimary },
  creatorPrice:  { fontSize: 13, color: colorss.primary, fontWeight: '600', marginTop: 2 },

  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: colorss.textPrimary,
    paddingHorizontal: 16, marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 14, fontWeight: '600', color: colorss.textPrimary,
    paddingHorizontal: 16, marginBottom: 8, marginTop: 4,
  },
  required: { color: colorss.error },
  hint: { fontSize: 12, color: colorss.placeholder, paddingHorizontal: 16, marginTop: 4, marginBottom: 8, lineHeight: 17 },

  radioRow: {
    flexDirection: 'row', gap: 24, paddingHorizontal: 16, marginBottom: 14,
    alignItems: 'center',
  },
  radioOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colorss.border,
    justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: colorss.primary },
  radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: colorss.primary },
  radioLabel:  { fontSize: 14, color: colorss.textPrimary },

  input: {
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: colorss.white, borderRadius: 10, borderWidth: 1,
    borderColor: colorss.border, padding: 13, fontSize: 14, color: colorss.textPrimary,
  },
  textArea: { minHeight: 120 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  wishTypeGrid: { paddingHorizontal: 16, marginBottom: 4, gap: 8 },
  wishTypeChip: { alignSelf: 'flex-start' },

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
    paddingHorizontal: 20, paddingTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
  payHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colorss.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 16,
  },
  payTitle: { fontSize: 18, fontWeight: '700', color: colorss.textPrimary, marginBottom: 10 },
  payBody: { fontSize: 14, color: colorss.textSecondary, lineHeight: 21, marginBottom: 24 },
  payBtn: {
    backgroundColor: colorss.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginBottom: 10,
  },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  payCancelBtn: { alignItems: 'center', paddingVertical: 12 },
  payCancelText: { color: colorss.textSecondary, fontSize: 14 },
});
