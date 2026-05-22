import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bluetooth,
  ChevronLeft,
  Headphones,
  Mic,
  MicOff,
  Phone as PhoneIcon,
  Video as VideoIcon,
  Volume2,
  PhoneOff,
} from 'lucide-react-native';
import { useCallAudio, type AudioOutputKind } from '../hooks/useCallAudio';
import AudioOutputPickerSheet from '../components/AudioOutputPickerSheet';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import { useAppSelector } from '../hooks/redux';
import {
  AudioSession,
  AndroidAudioTypePresets,
  LiveKitRoom,
  useRoomContext,
  useParticipants,
  useLocalParticipant,
  useConnectionState,
  useRemoteParticipants,
} from '@livekit/react-native';
import { ConnectionState } from 'livekit-client';
import { useLiveKitConnectionHints } from '../hooks/useLiveKitConnectionHints';

import { colorss } from '../theme';
import { RootStackNavigatorParamList } from '../types/navigators';
import FastImage from '@d11/react-native-fast-image';
import { IC_PROFILE } from '../assets';
import { selectHopenityProfile } from '../redux/features/auth/authSlice';
import { normalizeChatUserId } from '../utils/chatUserId';
import { CallRoomErrorBoundary } from '../components/CallRoomErrorBoundary';
import {
  LIVEKIT_FALLBACK_ROOM,
  getLiveKitRoomCallOptions,
  liveKitRoomConnectOptions,
} from '../config/livekit';
import { useLiveKitCredentials } from '../hooks/useLiveKitCredentials';
import { useOutgoingCallWithoutConnect } from '../hooks/useOutgoingCallWithoutConnect';
import { useSafeSingleNavigationPop } from '../hooks/useSafeSingleNavigationPop';
import { useGracefulRoomLeave } from '../hooks/useGracefulRoomLeave';
import { useLiveKitSessionEnd } from '../hooks/useLiveKitSessionEnd';
import { useOutgoingCallRingback } from '../hooks/useOutgoingCallRingback';
import { useLiveKitAndroidForeground } from '../hooks/useLiveKitAndroidForeground';
// useOverlayPermissionPrompt removed — SYSTEM_ALERT_WINDOW dropped from manifest.
// Re-add when the floating in-call bubble feature is shipped.
import { registerActiveCall } from '../services/livekit/activeCallRegistry';
import { useCallTimer } from '../hooks/useCallTimer';
import {
  sendCallModeChange,
  subscribeCallModeChanges,
} from '../services/livekit/callModeBus';
import {
  sendCallHangup,
  subscribeCallHangup,
} from '../services/livekit/callHangupBus';
import {
  beginCallTransition,
  isCallTransitioning,
} from '../services/callTransitionGuard';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'AudioCall'>;

function AudioCallGate({
  navigation,
  safePop,
  displayName,
  peerAvatarUrl,
  outcomeOpts,
  routeParams,
}: {
  navigation: Props['navigation'];
  safePop: () => void;
  displayName: string;
  peerAvatarUrl?: string | null;
  outcomeOpts: {
    conversationId?: string;
    peerUserId?: string;
    callDirection?: 'outgoing' | 'incoming';
    liveKitRoom?: string;
  };
  routeParams: Props['route']['params'];
}) {
  const room = useRoomContext();
  const cs = useConnectionState(room);
  const { tryEmitOutgoingWithoutConnect } = useOutgoingCallWithoutConnect(
    room,
    navigation as never,
    {
      callDirection: outcomeOpts.callDirection,
      conversationId: outcomeOpts.conversationId,
      peerUserId: outcomeOpts.peerUserId,
      liveKitRoom: outcomeOpts.liveKitRoom,
      callKind: 'audio',
      peerDisplayName: displayName,
    },
  );

  const leaveCall = useGracefulRoomLeave({
    safePop,
    beforeLeave: tryEmitOutgoingWithoutConnect,
  });
  const leaveRef = useRef(leaveCall);
  leaveRef.current = leaveCall;

  /** Android: foreground service + ongoing notification so the call survives minimize. */
  useLiveKitAndroidForeground(room, displayName, 'audio');

  /**
   * Register the current call so a second incoming call (concurrent-call handling) can tear this
   * one down cleanly before joining the new room.
   *
   * NOTE: we register a *silent* disconnect (no safePop) — the IncomingCall accept handler
   * resets the nav stack itself, so calling `navigation.goBack()` here would race with that
   * reset and pop the wrong screen.
   */
  useEffect(() => {
    if (!room?.name) return;
    const silentDisconnect = async () => {
      try {
        // Signal the peer before disconnecting so they end their side without the 30s wait.
        sendCallHangup(room);
        const lp = room?.localParticipant;
        if (lp) {
          await lp.setScreenShareEnabled(false).catch(() => undefined);
          await lp.setCameraEnabled(false).catch(() => undefined);
          await lp.setMicrophoneEnabled(false).catch(() => undefined);
        }
        await room?.disconnect().catch(() => undefined);
      } catch (e) {
        if (__DEV__) console.warn('[AudioCall] silentDisconnect', e);
      }
    };
    const unregister = registerActiveCall({
      liveKitRoom: room.name,
      kind: 'audio',
      leave: silentDisconnect,
    });
    return unregister;
  }, [room]);

  /** Peer sent a hangup signal — end the call immediately without the 30s fallback timer. */
  useEffect(() => {
    if (!room) return;
    return subscribeCallHangup(room, () => {
      void leaveRef.current();
    });
  }, [room]);

  /** Peer flipped their side to video — mirror it so both sides stay in sync. */
  useEffect(() => {
    if (!room) return;
    return subscribeCallModeChanges(room, msg => {
      if (msg.mode !== 'video') return;
      try {
        beginCallTransition();
        navigation.replace('VideoCall', {
          displayName: routeParams?.displayName ?? displayName,
          liveKitRoom: routeParams?.liveKitRoom,
          avatarUrl: routeParams?.avatarUrl ?? peerAvatarUrl ?? null,
          conversationId: routeParams?.conversationId,
          peerUserId: routeParams?.peerUserId,
          callDirection: routeParams?.callDirection,
        });
      } catch (e) {
        if (__DEV__) console.warn('[AudioCall] mirror mode change', e);
      }
    });
  }, [room, navigation, routeParams, displayName, peerAvatarUrl]);

  /** Local "Switch to video" button — publish to peer, then swap screens. */
  const handleSwitchToVideo = useCallback(async () => {
    try {
      sendCallModeChange(room, 'video');
      /** Give the data channel a tick so the peer receives the mode flip before we tear down. */
      await new Promise(resolve => setTimeout(resolve, 120));
    } catch (e) {
      if (__DEV__) console.warn('[AudioCall] sendCallModeChange', e);
    }
    try {
      beginCallTransition();
      navigation.replace('VideoCall', {
        displayName: routeParams?.displayName ?? displayName,
        liveKitRoom: routeParams?.liveKitRoom,
        avatarUrl: routeParams?.avatarUrl ?? peerAvatarUrl ?? null,
        conversationId: routeParams?.conversationId,
        peerUserId: routeParams?.peerUserId,
        callDirection: routeParams?.callDirection,
      });
    } catch (e) {
      if (__DEV__) console.warn('[AudioCall] navigate VideoCall', e);
    }
  }, [room, navigation, routeParams, displayName, peerAvatarUrl]);

  const remotes = useRemoteParticipants();
  const countRef = useRef(0);
  const csRef = useRef(cs);
  countRef.current = remotes.length;
  csRef.current = cs;
  const outgoing = outcomeOpts.callDirection === 'outgoing';

  // If the remote peer drops off mid-call (force-quit, network loss), give them
  // 30 s to reconnect before ending the call on our side too.
  const prevRemoteCountRef = useRef(0);
  useEffect(() => {
    const wasConnected = prevRemoteCountRef.current > 0;
    const nowGone = remotes.length === 0;
    prevRemoteCountRef.current = remotes.length;
    if (!wasConnected || !nowGone || cs !== ConnectionState.Connected) return;
    const t = setTimeout(() => {
      if (countRef.current > 0) return;
      try { Alert.alert('Call ended', 'The other person has left the call.'); } catch { /* */ }
      void leaveRef.current();
    }, 30_000);
    return () => clearTimeout(t);
  }, [remotes.length, cs]);

  const playOutgoingRingback =
    outgoing &&
    cs !== ConnectionState.Disconnected &&
    (cs === ConnectionState.Connecting ||
      cs === ConnectionState.Reconnecting ||
      (cs === ConnectionState.Connected && remotes.length === 0));

  useOutgoingCallRingback(playOutgoingRingback);

  useEffect(() => {
    if (!outgoing) {
      return;
    }
    const t = setTimeout(() => {
      if (countRef.current > 0) return;
      const state = csRef.current;
      try {
        if (state === ConnectionState.Connected) {
          if (Platform.OS === 'android') {
            ToastAndroid.show(displayName + " didn't receive your call", ToastAndroid.LONG);
          } else {
            Alert.alert('No answer', displayName + " didn't receive your call.");
          }
        } else {
          Alert.alert('Call ended', 'Could not complete the call. Check your network and try again.');
        }
      } catch { /* */ }
      void leaveRef.current();
    }, 60_000);
    return () => clearTimeout(t);
  }, [outgoing]);

  // If stuck reconnecting for 25 s, give up and show a clear message.
  useEffect(() => {
    if (cs !== ConnectionState.Reconnecting) return;
    const t = setTimeout(() => {
      try { Alert.alert('Call ended', 'Connection was lost and could not be restored.'); } catch { /* */ }
      void leaveRef.current();
    }, 25_000);
    return () => clearTimeout(t);
  }, [cs]);

  const onMinimize = useCallback(() => {
    navigation.dispatch(StackActions.push('BottomTab'));
  }, [navigation]);

  if (cs !== ConnectionState.Connected) {
    const label =
      cs === ConnectionState.Connecting
        ? 'Calling…'
        : cs === ConnectionState.Reconnecting
        ? 'Reconnecting… call may resume'
        : cs === ConnectionState.Disconnected
        ? 'Call ended'
        : 'Connecting…';

    return (
      <SafeAreaView style={styles.shell} edges={['top']}>
        <View style={styles.connectingFull}>
          {peerAvatarUrl ? (
            <FastImage
              source={{ uri: peerAvatarUrl }}
              style={styles.connectingAvatar}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : null}
          <ActivityIndicator color={colorss.white} size="large" />
          <Text style={styles.connectOverlayText}>{label}</Text>
          <TouchableOpacity
            style={styles.endBtn}
            accessibilityRole="button"
            accessibilityLabel="End call"
            onPress={() => void leaveCall()}
          >
            <PhoneOff size={26} color={colorss.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AudioStage
      safePop={safePop}
      displayName={displayName}
      peerAvatarUrl={peerAvatarUrl}
      tryEmitOutgoingWithoutConnect={tryEmitOutgoingWithoutConnect}
      onSwitchToVideo={handleSwitchToVideo}
      onMinimize={onMinimize}
    />
  );
}

function AudioStage({
  safePop,
  displayName,
  peerAvatarUrl,
  tryEmitOutgoingWithoutConnect,
  onSwitchToVideo,
  onMinimize,
}: {
  safePop: () => void;
  displayName: string;
  peerAvatarUrl?: string | null;
  tryEmitOutgoingWithoutConnect: () => void;
  onSwitchToVideo: () => void;
  onMinimize: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const remotes = useRemoteParticipants();
  const isRinging = remotes.length === 0;
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  // Default voice calls to the earpiece — matches phone-call expectation.
  // The hook also auto-routes to Bluetooth / wired headphones the moment they
  // connect mid-call.
  const audio = useCallAudio({ preferred: 'earpiece' });
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  // Transient in-call banner used as the iOS toast equivalent.
  const [autoSwitchBanner, setAutoSwitchBanner] = useState<string | null>(null);

  const { hint, detail } = useLiveKitConnectionHints(room);
  const timer = useCallTimer(!isRinging);

  const leaveCall = useGracefulRoomLeave({
    safePop,
    beforeLeave: tryEmitOutgoingWithoutConnect,
  });

  // Apply the default route once the audio session is live. The hook will then
  // keep it up to date as devices are plugged in / paired.
  useEffect(() => {
    void audio.select('earpiece');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show + auto-dismiss the auto-switch banner (the hook fires ToastAndroid for
  // Android; we mirror it inline for iOS and as a stronger affordance).
  useEffect(() => {
    if (!audio.autoSwitchMessage) return;
    setAutoSwitchBanner(audio.autoSwitchMessage);
    const t = setTimeout(() => {
      setAutoSwitchBanner(null);
      audio.clearAutoSwitchMessage();
    }, 2400);
    return () => clearTimeout(t);
  }, [audio.autoSwitchMessage, audio]);

  const onEnd = () => {
    leaveCall();
  };

  const toggleMic = useCallback(() => {
    localParticipant
      .setMicrophoneEnabled(!isMicrophoneEnabled)
      .catch(err => console.warn('[AudioCall] mic toggle', err));
  }, [localParticipant, isMicrophoneEnabled]);

  const openAudioPicker = useCallback(() => {
    setAudioPickerOpen(true);
  }, []);
  const closeAudioPicker = useCallback(() => {
    setAudioPickerOpen(false);
  }, []);
  const onPickAudioOutput = useCallback(
    async (device: { id: AudioOutputKind }) => {
      await audio.select(device.id);
      // Keep the sheet open for `route_picker` (iOS) so the user can see the
      // native picker layered on top; close it for the inline options.
      if (device.id !== 'route_picker') setAudioPickerOpen(false);
    },
    [audio],
  );

  const activeKind = audio.activeId;
  const activeIcon =
    activeKind === 'bluetooth' ? (
      <Bluetooth size={22} color={colorss.white} />
    ) : activeKind === 'wired' ? (
      <Headphones size={22} color={colorss.white} />
    ) : activeKind === 'speaker' ? (
      <Volume2 size={22} color={colorss.white} />
    ) : (
      <PhoneIcon size={22} color={colorss.white} />
    );
  const activeLabel =
    activeKind === 'bluetooth'
      ? 'Bluetooth'
      : activeKind === 'wired'
      ? 'Headphones'
      : activeKind === 'speaker'
      ? 'Speaker'
      : 'Phone';

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        {Platform.OS === 'android' ? (
          <TouchableOpacity
            onPress={onMinimize}
            accessibilityRole="button"
            accessibilityLabel="Go to chat list"
          >
            <ChevronLeft size={28} color={colorss.white} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      <View style={styles.userInfo}>
        <FastImage
          source={peerAvatarUrl ? { uri: peerAvatarUrl } : IC_PROFILE}
          style={styles.avatar}
        />
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.status}>
          {hint === 'reconnecting' || hint === 'poor_network'
            ? detail || 'Adjusting for your network…'
            : isRinging
            ? 'Ringing…'
            : timer || 'Connected'}
        </Text>
      </View>

      {autoSwitchBanner ? (
        <View pointerEvents="none" style={styles.autoSwitchBanner}>
          <Text style={styles.autoSwitchBannerText}>{autoSwitchBanner}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.actionItem}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              activeKind === 'speaker' ||
              activeKind === 'bluetooth' ||
              activeKind === 'wired'
                ? styles.actionBtnDim
                : null,
            ]}
            onPress={openAudioPicker}
            accessibilityRole="button"
            accessibilityLabel={`Audio output, currently ${activeLabel}. Tap to choose another.`}
          >
            {activeIcon}
          </TouchableOpacity>
          <Text style={styles.actionLabel} numberOfLines={1}>
            {activeLabel}
          </Text>
        </View>
        <View style={styles.actionItem}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onSwitchToVideo}
            accessibilityRole="button"
            accessibilityLabel="Switch to video call"
            disabled={isRinging}
          >
            <VideoIcon
              size={22}
              color={isRinging ? 'rgba(255,255,255,0.4)' : colorss.white}
            />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Video</Text>
        </View>
        <View style={styles.actionItem}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              !isMicrophoneEnabled ? styles.actionBtnDim : null,
            ]}
            onPress={toggleMic}
          >
            {isMicrophoneEnabled ? (
              <Mic size={22} color={colorss.white} />
            ) : (
              <MicOff size={22} color={colorss.white} />
            )}
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Mute</Text>
        </View>
        <View style={styles.actionItem}>
          <TouchableOpacity style={styles.endBtn} onPress={onEnd}>
            <PhoneOff size={22} color={colorss.white} />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>End</Text>
        </View>
      </View>

      <AudioOutputPickerSheet
        visible={audioPickerOpen}
        outputs={audio.outputs}
        onSelect={onPickAudioOutput}
        onClose={closeAudioPicker}
      />
    </SafeAreaView>
  );
}

const AudioCallScreen: React.FC<Props> = ({ navigation, route }) => {
  const rawSafePop = useSafeSingleNavigationPop(navigation as never);
  // Suppress safePop when we're intentionally swapping call screens (mode switch / call handover).
  const safePop = useCallback(() => {
    if (isCallTransitioning()) return;
    rawSafePop();
  }, [rawSafePop]);

  // Hardware back button navigates to the chat list while keeping the call alive.
  // AudioCallScreen stays mounted (LiveKit connection persists); user can return
  // by pressing back from the chat list or tapping the ongoing notification.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.dispatch(StackActions.push('BottomTab'));
      return true;
    });
    return () => sub.remove();
  }, [navigation]);
  const { onDisconnected, onError, onEncryptionError, forceEndCallWithAlert } =
    useLiveKitSessionEnd({
      callLabel: 'Voice call',
      safePop,
    });
  const profile = useAppSelector(selectHopenityProfile);
  const giftedChatUser = useAppSelector(s => s.auth.giftedChatUser);
  const liveKitIdentity = useMemo(
    () =>
      normalizeChatUserId(giftedChatUser?._id) ||
      normalizeChatUserId(profile?.userId) ||
      undefined,
    [giftedChatUser?._id, profile?.userId],
  );

  useEffect(() => {
    const run = async () => {
      try {
        await AudioSession.configureAudio({
          android: {
            preferredOutputList: [
              'speaker',
              'bluetooth',
              'headset',
              'earpiece',
            ],
            audioTypeOptions: AndroidAudioTypePresets.communication,
          },
          ios: { defaultOutput: 'speaker' },
        });
        await AudioSession.startAudioSession();
      } catch (e) {
        console.error('[AudioCall] AudioSession', e);
        Alert.alert(
          'Audio',
          e instanceof Error
            ? e.message
            : 'Could not start audio session for this call.',
        );
      }
    };
    void run();
    return () => {
      AudioSession.stopAudioSession().catch(() => undefined);
    };
  }, []);

  const calleeName = useMemo(
    () =>
      route.params?.displayName ??
      route.params?.liveKitRoom ??
      LIVEKIT_FALLBACK_ROOM,
    [route.params?.displayName, route.params?.liveKitRoom],
  );

  const { loading, serverUrl, token, error, reload } = useLiveKitCredentials({
    room: route.params?.liveKitRoom,
    identity: liveKitIdentity,
    displayName: profile?.displayName ?? undefined,
  });

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator color={colorss.white} size="large" />
            <Text style={styles.statusText}>Connecting voice…</Text>
          </View>
        ) : typeof serverUrl === 'string' &&
          serverUrl.length > 0 &&
          typeof token === 'string' &&
          token.length > 0 ? (
          <LiveKitRoom
            key={route.params?.liveKitRoom ?? 'audio-call'}
            serverUrl={serverUrl}
            token={token}
            connect={true}
            audio={true}
            video={false}
            options={getLiveKitRoomCallOptions()}
            connectOptions={liveKitRoomConnectOptions}
            onDisconnected={onDisconnected}
            onError={onError}
            onEncryptionError={onEncryptionError}
            onMediaDeviceFailure={failure => {
              console.warn('[AudioCall] media device', failure);
              forceEndCallWithAlert(
                'Microphone',
                typeof failure === 'string'
                  ? failure
                  : 'Could not access microphone — check permissions and try again.',
              );
            }}
          >
            <CallRoomErrorBoundary title="Voice call error" onClose={safePop}>
              <AudioCallGate
                navigation={navigation}
                safePop={safePop}
                displayName={calleeName}
                peerAvatarUrl={route.params?.avatarUrl}
                routeParams={route.params}
                outcomeOpts={{
                  conversationId: route.params?.conversationId,
                  peerUserId: route.params?.peerUserId,
                  callDirection: route.params?.callDirection,
                  liveKitRoom: route.params?.liveKitRoom,
                }}
              />
            </CallRoomErrorBoundary>
          </LiveKitRoom>
        ) : (
          <SafeAreaView style={styles.missingWrap}>
            <Text style={styles.missingTitle}>Cannot start voice call</Text>
            <Text style={styles.missingBody}>
              {error ??
                'No LiveKit token or signaling URL — check LIVEKIT_* entries in `.env` and restart Metro.'}
            </Text>
            <TouchableOpacity style={styles.backGhost} onPress={reload}>
              <Text style={styles.backGhostText}>Retry mint</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backGhost, { marginTop: 12 }]}
              onPress={safePop}
            >
              <Text style={styles.backGhostText}>Close</Text>
            </TouchableOpacity>
          </SafeAreaView>
        )}
      </View>
    </SafeAreaView>
  );
};

export default AudioCallScreen;

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: colorss.primaryDark,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
    backgroundColor: colorss.primaryDark,
  },
  shell: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 8,
  },
  userInfo: {
    alignItems: 'center',
    marginTop: 40,
    flexGrow: 1,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colorss.primary,
  },
  name: {
    color: colorss.white,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  status: {
    color: 'rgba(255,255,255,0.65)',
    marginTop: 6,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
    marginHorizontal: 12,
  },
  actionItem: {
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDim: {
    backgroundColor: 'rgba(255,59,48,0.55)',
  },
  endBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colorss.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  timerText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
  },
  missingWrap: {
    flex: 1,
    padding: 22,
    justifyContent: 'center',
    backgroundColor: colorss.primaryDark,
  },
  missingTitle: {
    color: colorss.white,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  missingBody: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    lineHeight: 22,
  },
  backGhost: {
    marginTop: 28,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  backGhostText: {
    color: colorss.white,
    fontWeight: '700',
  },
  connectingFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 20,
  },
  connectingAvatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  connectOverlayText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
});
