/**
 * Call-waiting banner — a second incoming call while one is already active.
 *
 * Sits above the call screen and offers a real choice. Accepting ends the
 * current call on BOTH ends (the registry's silent disconnect signals the peer
 * over the data channel and the server) before joining the new room; declining
 * leaves the current call untouched and tells the new caller to stop ringing.
 *
 * Mounted next to IncomingCallListener so it survives navigation between call
 * screens and is only ever present while signed in.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  DeviceEventEmitter,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Phone, PhoneOff } from 'lucide-react-native';

import { store } from '../redux/store';
import {
  CALL_WAITING_EVENT,
  CALL_WAITING_CLEARED_EVENT,
} from '../services/incomingCall/callWaitingBus';
import type { IncomingCallPayload } from '../services/incomingCall/payload';
import {
  navigateIncomingCall,
  markCallCancelled,
} from '../services/incomingCall/navigateIncomingCall';
import { endActiveCallForReplacement } from '../services/livekit/activeCallRegistry';
import { notifyCallEndedByRoom } from '../services/invitePeerToHopeChatCall';
import { stopIncomingCallRingtone } from '../services/incomingCall/callRingtone';

const CallWaitingBanner: React.FC = () => {
  const [waiting, setWaiting] = useState<IncomingCallPayload | null>(null);

  useEffect(() => {
    const onWaiting = DeviceEventEmitter.addListener(
      CALL_WAITING_EVENT,
      (payload: IncomingCallPayload) => setWaiting(payload),
    );
    const onCleared = DeviceEventEmitter.addListener(
      CALL_WAITING_CLEARED_EVENT,
      ({ liveKitRoom }: { liveKitRoom?: string }) => {
        // Only dismiss if the cancel is for the call being offered — a stale
        // cancel for an older room must not clear a newer offer.
        setWaiting(prev =>
          prev && (!liveKitRoom || prev.liveKitRoom === liveKitRoom) ? null : prev,
        );
      },
    );
    return () => {
      onWaiting.remove();
      onCleared.remove();
    };
  }, []);

  const accept = useCallback(async () => {
    const call = waiting;
    if (!call) return;
    setWaiting(null);
    stopIncomingCallRingtone();
    // Ends the in-progress call on both ends before joining the new room.
    await endActiveCallForReplacement(call.liveKitRoom);
    // Let native WebRTC teardown settle, same budget the listener used.
    await new Promise<void>(resolve => setTimeout(() => resolve(), 150));
    navigateIncomingCall({ ...call, autoAccept: true });
  }, [waiting]);

  const decline = useCallback(() => {
    const call = waiting;
    if (!call) return;
    setWaiting(null);
    stopIncomingCallRingtone();
    // Stop the new caller ringing, and make sure a late push for this room
    // cannot re-open it. The current call is deliberately left alone.
    markCallCancelled(call.liveKitRoom);
    void notifyCallEndedByRoom({
      token: store.getState().auth.token,
      liveKitRoom: call.liveKitRoom,
    });
  }, [waiting]);

  if (!waiting) return null;

  const who = waiting.isGroupCall
    ? waiting.groupName || 'Group call'
    : waiting.displayName || 'Someone';

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {who}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {waiting.callKind === 'video' ? 'Incoming video call' : 'Incoming call'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={decline}
          style={[styles.btn, styles.decline]}
          accessibilityRole="button"
          accessibilityLabel="Decline waiting call">
          <PhoneOff size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={accept}
          style={[styles.btn, styles.accept]}
          accessibilityRole="button"
          accessibilityLabel="Accept waiting call and end current call">
          <Phone size={20} color="#fff" fill="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,22,0.97)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  info: { flex: 1, marginRight: 6 },
  name: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  btn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: { backgroundColor: '#E5484D' },
  accept: { backgroundColor: '#2FA36B' },
});

export default CallWaitingBanner;
