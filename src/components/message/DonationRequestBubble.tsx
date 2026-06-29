import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Droplets, Heart, Package, UtensilsCrossed } from 'lucide-react-native';

import type { DonationRequestPayload, DonationRequestType, ExtendedMessage } from '../types/chat';
import { API_BASE_URL } from '../../config/env';
import { useAppSelector } from '../../hooks/redux';
import { selectAuthToken } from '../../redux/features/auth/authSlice';
import { openHopenityPost } from '../../services/hopenityLinking';
import { colorss } from '../../theme';

// ── Session-level status cache ─────────────────────────────────────────────────

const sessionStatusCache = new Map<number, 'PENDING' | 'ACCEPTED' | 'REJECTED'>();

// ── Request-type metadata ──────────────────────────────────────────────────────

type RequestMeta = { label: string; accent: string; headerBg: string; borderColor: string };

function getRequestMeta(type: DonationRequestType | undefined): RequestMeta {
  switch (type) {
    case 'blood':
      return { label: 'Blood Donation Request', accent: '#DC2626', headerBg: '#FEF2F2', borderColor: '#FCA5A5' };
    case 'food':
      return { label: 'Food Donation Request', accent: '#EA580C', headerBg: '#FFF7ED', borderColor: '#FDBA74' };
    case 'essential':
    case 'product':
      return { label: 'Essential Request', accent: '#7C3AED', headerBg: '#F5F3FF', borderColor: '#C4B5FD' };
    default:
      return { label: 'Donation Request', accent: colorss.primary, headerBg: '#fff0f4', borderColor: '#f0d0da' };
  }
}

function RequestIcon({ type, size, color }: { type: DonationRequestType | undefined; size: number; color: string }) {
  switch (type) {
    case 'blood':   return <Droplets size={size} color={color} fill={color} />;
    case 'food':    return <UtensilsCrossed size={size} color={color} />;
    case 'essential':
    case 'product': return <Package size={size} color={color} />;
    default:        return <Heart size={size} color={color} fill={color} />;
  }
}

// ── API ────────────────────────────────────────────────────────────────────────

async function patchDonationStatus(
  donationId: number,
  action: 'accept' | 'reject',
  token: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/donations/${donationId}/${action}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: '{}',
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

type Props = { message: ExtendedMessage; isOwn: boolean };
type DonationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);

export default function DonationRequestBubble({ message, isOwn }: Props) {
  const token = useAppSelector(selectAuthToken);
  const dr: DonationRequestPayload = message.donationRequest ?? { donationId: 0, postId: '', status: 'PENDING' };
  const meta = getRequestMeta(dr.requestType);

  const initialStatus: DonationStatus = sessionStatusCache.get(dr.donationId) ?? dr.status ?? 'PENDING';
  const [status, setStatus] = useState<DonationStatus>(initialStatus);
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleAction = useCallback(
    async (action: 'accept' | 'reject') => {
      if (loading || status !== 'PENDING') return;
      setLoading(action);
      const ok = await patchDonationStatus(dr.donationId, action, token);
      if (ok) {
        const next: DonationStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED';
        sessionStatusCache.set(dr.donationId, next);
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true })
          .start(() => setStatus(next));
      }
      setLoading(null);
    },
    [loading, status, dr.donationId, token, fadeAnim],
  );

  const isPending  = status === 'PENDING';
  const isAccepted = status === 'ACCEPTED';

  const handleViewPost = useCallback(() => {
    if (dr.postId) void openHopenityPost(dr.postId);
  }, [dr.postId]);

  return (
    <View style={[styles.card, isOwn ? styles.cardRight : styles.cardLeft, { borderColor: meta.borderColor }]}>
      {/* Header — tap to view post details */}
      <TouchableOpacity
        style={[styles.header, { backgroundColor: meta.headerBg, borderBottomColor: meta.borderColor }]}
        onPress={handleViewPost}
        activeOpacity={0.75}
      >
        <RequestIcon type={dr.requestType} size={14} color={meta.accent} />
        <Text style={[styles.headerText, { color: meta.accent }]}>{meta.label}</Text>
        <Text style={[styles.viewLink, { color: meta.accent }]}>View post ›</Text>
      </TouchableOpacity>

      {/* Interest text */}
      <Text style={styles.body}>{message.text || 'I am interested in this.'}</Text>

      {/* Action area — only for recipient (post owner) */}
      {!isOwn && (
        <View style={styles.actionArea}>
          {isPending ? (
            <Animated.View style={[styles.buttonsRow, { opacity: fadeAnim }]}>
              <TouchableOpacity
                style={[styles.btn, styles.btnReject]}
                onPress={() => handleAction('reject')}
                disabled={loading !== null}
                activeOpacity={0.75}
              >
                {loading === 'reject'
                  ? <ActivityIndicator size="small" color="#DC2626" />
                  : <Text style={styles.btnRejectText}>Reject</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: meta.accent }]}
                onPress={() => handleAction('accept')}
                disabled={loading !== null}
                activeOpacity={0.75}
              >
                {loading === 'accept'
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnAcceptText}>Accept</Text>}
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View style={[styles.statusChip, isAccepted ? styles.chipAccepted : styles.chipRejected]}>
              <Text style={[styles.statusText, isAccepted ? styles.statusTextAccepted : styles.statusTextRejected]}>
                {isAccepted ? '✓ Approved' : '✕ Rejected'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Sender side: status chip only when resolved */}
      {isOwn && !isPending && (
        <View style={[styles.statusChip, styles.statusChipSender, isAccepted ? styles.chipAccepted : styles.chipRejected]}>
          <Text style={[styles.statusText, isAccepted ? styles.statusTextAccepted : styles.statusTextRejected]}>
            {isAccepted ? '✓ Approved' : '✕ Rejected'}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

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
  cardLeft:  { alignSelf: 'flex-start', marginLeft: 12 },
  cardRight: { alignSelf: 'flex-end',   marginRight: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    flex: 1,
  },
  viewLink: {
    fontSize: 11,
    fontWeight: '600',
  },

  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colorss.textPrimary,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },

  actionArea: { paddingHorizontal: 10, paddingBottom: 10 },
  buttonsRow: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnReject: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  btnRejectText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  btnAcceptText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  chipAccepted: { backgroundColor: '#dcfce7' },
  chipRejected: { backgroundColor: '#fee2e2' },
  statusText:         { fontSize: 13, fontWeight: '700' },
  statusTextAccepted: { color: '#16A34A' },
  statusTextRejected: { color: '#DC2626' },
  statusChipSender: { alignSelf: 'flex-end', marginTop: 6, marginBottom: 8, marginRight: 12 },
});
