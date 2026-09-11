/**
 * WhatsApp-style "return to call" bar.
 *
 * The call screens keep running even after the user navigates away
 * (`onMinimize` just pushes BottomTab on top — see VideoCallScreen.tsx /
 * AudioCallScreen.tsx), but until now nothing visible reflected that: the
 * only "is a call still going on" signal was the OS-level ongoing
 * notification (Android only) or the video/audio call screen itself.
 *
 * This subscribes to activeCallStatusBus (emitted by the call screens on
 * every connection-state change) and renders a thin pinned bar above the
 * navigator, tapping which reuses the exact same "reopen the active call"
 * path already built for the ongoing notification (OPEN_ACTIVE_CALL_EVENT).
 *
 * Mounted once in App.tsx, after RootNavigator so it overlays every screen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DeviceEventEmitter,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Mic, MicOff, PhoneOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigationRef } from '../navigation/navigationRef';
import {
  ACTIVE_CALL_STATUS_EVENT,
  ACTIVE_CALL_ENDED_EVENT,
  type ActiveCallStatusPayload,
} from '../services/livekit/activeCallStatusBus';
import { OPEN_ACTIVE_CALL_EVENT } from '../services/livekit/pendingCallScreenOpen';
import { getActiveCall } from '../services/livekit/activeCallRegistry';
import { colorss } from '../theme';

const CALL_SCREEN_NAMES = new Set(['VideoCall', 'AudioCall']);

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function statusLabel(status: ActiveCallStatusPayload['status'], elapsed: string): string {
  switch (status) {
    case 'connecting':
      return 'Calling…';
    case 'ringing':
      return 'Ringing…';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'connected':
      return elapsed || 'Connected';
  }
}

const CallStatusBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [call, setCall] = useState<ActiveCallStatusPayload | null>(null);
  const [onCallScreen, setOnCallScreen] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const onStatus = DeviceEventEmitter.addListener(
      ACTIVE_CALL_STATUS_EVENT,
      (payload: ActiveCallStatusPayload) => setCall(payload),
    );
    const onEnded = DeviceEventEmitter.addListener(
      ACTIVE_CALL_ENDED_EVENT,
      ({ liveKitRoom }: { liveKitRoom?: string }) => {
        setCall(prev =>
          prev && (!liveKitRoom || prev.liveKitRoom === liveKitRoom) ? null : prev,
        );
      },
    );
    return () => {
      onStatus.remove();
      onEnded.remove();
    };
  }, []);

  // Hide while the call screen itself is on top — the banner is only for
  // when the user has navigated away from it.
  useEffect(() => {
    const update = () =>
      setOnCallScreen(
        !!navigationRef.getCurrentRoute() &&
          CALL_SCREEN_NAMES.has(navigationRef.getCurrentRoute()!.name),
      );
    update();
    if (!navigationRef.isReady()) return;
    const unsub = navigationRef.addListener('state', update);
    return unsub;
  }, []);

  const connectedAtMsRef = useRef<number | undefined>(undefined);
  connectedAtMsRef.current = call?.connectedAtMs;
  useEffect(() => {
    if (call?.status !== 'connected' || !call.connectedAtMs) {
      setElapsedSec(0);
      return;
    }
    const tick = () =>
      setElapsedSec(Math.max(0, Math.floor((Date.now() - connectedAtMsRef.current!) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [call?.status, call?.connectedAtMs]);

  const onPress = useCallback(() => {
    const active = getActiveCall();
    DeviceEventEmitter.emit(OPEN_ACTIVE_CALL_EVENT, {
      liveKitRoom: call?.liveKitRoom ?? active?.liveKitRoom ?? '',
      callKind: call?.kind ?? active?.kind ?? 'audio',
      displayName: call?.peerName ?? '',
    });
  }, [call]);

  const onHangup = useCallback(() => {
    const active = getActiveCall();
    void active?.end?.();
  }, []);

  if (!call || onCallScreen) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.bar, { paddingTop: insets.top + 8 }]}
      accessibilityRole="button"
      accessibilityLabel={`Return to call with ${call.peerName}`}
    >
      {call.status === 'connected' ? (
        <Mic size={14} color="#fff" style={styles.icon} />
      ) : (
        <MicOff size={14} color="rgba(255,255,255,0.85)" style={styles.icon} />
      )}
      <Text style={styles.text} numberOfLines={1}>
        {call.peerName} · {statusLabel(call.status, formatElapsed(elapsedSec))}
      </Text>
      <TouchableOpacity
        onPress={onHangup}
        style={styles.hangup}
        accessibilityRole="button"
        accessibilityLabel="End call"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <PhoneOff size={15} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorss.primary,
    paddingBottom: 8,
    paddingHorizontal: 14,
    zIndex: 9998,
    elevation: 9998,
    gap: 8,
  },
  icon: { marginRight: 2 },
  text: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  hangup: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
});

export default CallStatusBanner;
