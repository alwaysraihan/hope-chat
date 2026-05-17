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
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bluetooth,
  ChevronLeft,
  Headphones,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
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
  VideoTrack,
  useTracks,
  isTrackReference,
  useRoomContext,
  useLocalParticipant,
  useConnectionState,
  useRemoteParticipants,
} from '@livekit/react-native';
import {
  ConnectionState,
  LocalVideoTrack,
  RoomEvent,
  Track,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from 'livekit-client';

import FastImage from '@d11/react-native-fast-image';

import { colorss } from '../theme';
import { RootStackNavigatorParamList } from '../types/navigators';
import { selectHopenityProfile } from '../redux/features/auth/authSlice';
import { normalizeChatUserId } from '../utils/chatUserId';
import { CallRoomErrorBoundary } from '../components/CallRoomErrorBoundary';
import { liveKitAndroidPublishVideoEnabled } from '../config/env';
import {
  LIVEKIT_FALLBACK_ROOM,
  getLiveKitVideoCallRoomOptions,
  liveKitRoomConnectOptions,
} from '../config/livekit';
import { useLiveKitCredentials } from '../hooks/useLiveKitCredentials';
import { useLiveKitConnectionHints } from '../hooks/useLiveKitConnectionHints';
import { useOutgoingCallWithoutConnect } from '../hooks/useOutgoingCallWithoutConnect';
import { useSafeSingleNavigationPop } from '../hooks/useSafeSingleNavigationPop';
import { useGracefulRoomLeave } from '../hooks/useGracefulRoomLeave';
import { useLiveKitSessionEnd } from '../hooks/useLiveKitSessionEnd';
import { useOutgoingCallRingback } from '../hooks/useOutgoingCallRingback';
import { useLiveKitAndroidForeground } from '../hooks/useLiveKitAndroidForeground';
import { useOverlayPermissionPrompt } from '../hooks/useOverlayPermissionPrompt';
import { registerActiveCall } from '../services/livekit/activeCallRegistry';
import { useCallTimer } from '../hooks/useCallTimer';
import {
  sendCallModeChange,
  subscribeCallModeChanges,
} from '../services/livekit/callModeBus';
import { mediaDevices } from '@livekit/react-native-webrtc';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'VideoCall'>;

/**
 * Android: default off (OEM WebRTC crashes). Opt in with `LIVEKIT_ANDROID_PUBLISH_VIDEO=true` in `.env`.
 * iOS: normal camera publish on connect.
 */
const PUBLISH_VIDEO_ON_LIVEKIT_CONNECT =
  Platform.OS === 'ios' || liveKitAndroidPublishVideoEnabled();
/** Remote video needs subscription; only disable on Android crash-mitigation path. */
const videoCallConnectOptions =
  Platform.OS === 'android' && !liveKitAndroidPublishVideoEnabled()
    ? { ...liveKitRoomConnectOptions, autoSubscribe: false }
    : liveKitRoomConnectOptions;

/** Avoid mounting track/camera hooks until LiveKit is connected (reduces startup crashes). */
function VideoCallGate({
  navigation,
  safePop,
  displayName,
  peerAvatarUrl,
  outcomeOpts,
  forceEndCallWithAlert,
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
  };
  forceEndCallWithAlert: (title: string, body: string) => void;
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
      callKind: 'video',
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
  useLiveKitAndroidForeground(room, displayName, 'video');

  /**
   * Register this call so a 2nd incoming call can tear it down cleanly. We register a *silent*
   * disconnect — IncomingCallScreen.accept resets the nav stack itself, so calling
   * navigation.goBack() here would race with that reset.
   */
  useEffect(() => {
    if (!room?.name) return;
    const silentDisconnect = async () => {
      try {
        const lp = room?.localParticipant;
        if (lp) {
          await lp.setScreenShareEnabled(false).catch(() => undefined);
          await lp.setCameraEnabled(false).catch(() => undefined);
          await lp.setMicrophoneEnabled(false).catch(() => undefined);
        }
        await room?.disconnect().catch(() => undefined);
      } catch (e) {
        if (__DEV__) console.warn('[VideoCall] silentDisconnect', e);
      }
    };
    const unregister = registerActiveCall({
      liveKitRoom: room.name,
      kind: 'video',
      leave: silentDisconnect,
    });
    return unregister;
  }, [room]);

  /** Peer flipped their side back to audio — mirror by replacing this screen with AudioCall. */
  useEffect(() => {
    if (!room) return;
    return subscribeCallModeChanges(room, msg => {
      if (msg.mode !== 'audio') return;
      try {
        navigation.replace('AudioCall', {
          displayName: routeParams?.displayName ?? displayName,
          liveKitRoom: routeParams?.liveKitRoom,
          avatarUrl: routeParams?.avatarUrl ?? peerAvatarUrl ?? null,
          conversationId: routeParams?.conversationId,
          peerUserId: routeParams?.peerUserId,
          callDirection: routeParams?.callDirection,
        });
      } catch (e) {
        if (__DEV__) console.warn('[VideoCall] mirror mode change', e);
      }
    });
  }, [room, navigation, routeParams, displayName, peerAvatarUrl]);

  const handleSwitchToAudio = useCallback(async () => {
    try {
      sendCallModeChange(room, 'audio');
      await new Promise(resolve => setTimeout(resolve, 120));
    } catch (e) {
      if (__DEV__) console.warn('[VideoCall] sendCallModeChange', e);
    }
    try {
      navigation.replace('AudioCall', {
        displayName: routeParams?.displayName ?? displayName,
        liveKitRoom: routeParams?.liveKitRoom,
        avatarUrl: routeParams?.avatarUrl ?? peerAvatarUrl ?? null,
        conversationId: routeParams?.conversationId,
        peerUserId: routeParams?.peerUserId,
        callDirection: routeParams?.callDirection,
      });
    } catch (e) {
      if (__DEV__) console.warn('[VideoCall] navigate AudioCall', e);
    }
  }, [room, navigation, routeParams, displayName, peerAvatarUrl]);

  useEffect(() => {
    if (!room) {
      return;
    }
    const onTrackSubscriptionFailed = (
      trackSid: string,
      participant: RemoteParticipant,
    ) => {
      console.warn('[VideoCall] TrackSubscriptionFailed', {
        trackSid,
        identity: participant?.identity,
      });
    };
    room.on(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed);
    return () => {
      room.off(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed);
    };
  }, [room]);

  const remotes = useRemoteParticipants();
  const countRef = useRef(0);
  const csRef = useRef(cs);
  countRef.current = remotes.length;
  csRef.current = cs;
  const outgoing = outcomeOpts.callDirection === 'outgoing';

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
      <SafeAreaView style={styles.overlay} edges={['top']}>
        <View style={styles.connectingFull}>
          {peerAvatarUrl ? (
            <FastImage
              source={{ uri: peerAvatarUrl }}
              style={styles.peerAvatarLarge}
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

  return Platform.OS === 'android' && !liveKitAndroidPublishVideoEnabled() ? (
    <AndroidConnectedCallStage
      navigation={navigation}
      safePop={safePop}
      displayName={displayName}
      peerAvatarUrl={peerAvatarUrl}
      tryEmitOutgoingWithoutConnect={tryEmitOutgoingWithoutConnect}
      onSwitchToAudio={handleSwitchToAudio}
      onMinimize={onMinimize}
    />
  ) : (
    <VideoStage
      safePop={safePop}
      displayName={displayName}
      peerAvatarUrl={peerAvatarUrl}
      tryEmitOutgoingWithoutConnect={tryEmitOutgoingWithoutConnect}
      forceEndCallWithAlert={forceEndCallWithAlert}
      onSwitchToAudio={handleSwitchToAudio}
      onMinimize={onMinimize}
    />
  );
}

function AndroidConnectedCallStage({
  safePop,
  displayName,
  peerAvatarUrl,
  tryEmitOutgoingWithoutConnect,
  onSwitchToAudio,
  onMinimize,
}: {
  navigation: Props['navigation'];
  safePop: () => void;
  displayName: string;
  peerAvatarUrl?: string | null;
  tryEmitOutgoingWithoutConnect: () => void;
  onSwitchToAudio: () => void;
  onMinimize: () => void;
}) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  // Video calls default to loud-speaker; the hook auto-routes to Bluetooth /
  // wired headphones whenever one is connected.
  const audio = useCallAudio({ preferred: 'speaker' });
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [autoSwitchBanner, setAutoSwitchBanner] = useState<string | null>(null);
  const { hint, detail } = useLiveKitConnectionHints(room);
  const remotes = useRemoteParticipants();
  const isRinging = remotes.length === 0;
  const timer = useCallTimer(!isRinging);

  useEffect(() => {
    if (!audio.autoSwitchMessage) return;
    setAutoSwitchBanner(audio.autoSwitchMessage);
    const t = setTimeout(() => {
      setAutoSwitchBanner(null);
      audio.clearAutoSwitchMessage();
    }, 2400);
    return () => clearTimeout(t);
  }, [audio.autoSwitchMessage, audio]);

  useEffect(() => {
    const subscribeAudioOnly = () => {
      remotes.forEach(participant => {
        participant.getTrackPublications().forEach(publication => {
          const remotePublication = publication as RemoteTrackPublication;
          remotePublication.setSubscribed(
            publication.kind === Track.Kind.Audio,
          );
        });
      });
    };

    subscribeAudioOnly();
    room.on(RoomEvent.TrackPublished, subscribeAudioOnly);
    room.on(RoomEvent.TrackSubscribed, subscribeAudioOnly);

    return () => {
      room.off(RoomEvent.TrackPublished, subscribeAudioOnly);
      room.off(RoomEvent.TrackSubscribed, subscribeAudioOnly);
    };
  }, [remotes, room]);

  const leaveCall = useGracefulRoomLeave({
    safePop,
    beforeLeave: tryEmitOutgoingWithoutConnect,
  });

  const onEnd = () => {
    leaveCall();
  };

  const toggleMic = useCallback(() => {
    localParticipant
      .setMicrophoneEnabled(!isMicrophoneEnabled)
      .catch(err => console.warn('[VideoCall] mic toggle', err));
  }, [localParticipant, isMicrophoneEnabled]);

  const openAudioPicker = useCallback(() => setAudioPickerOpen(true), []);
  const closeAudioPicker = useCallback(() => setAudioPickerOpen(false), []);
  const onPickAudioOutput = useCallback(
    async (device: { id: AudioOutputKind }) => {
      await audio.select(device.id);
      if (device.id !== 'route_picker') setAudioPickerOpen(false);
    },
    [audio],
  );

  const activeKind = audio.activeId;
  const activeAudioIcon =
    activeKind === 'bluetooth' ? (
      <Bluetooth size={22} color={colorss.white} />
    ) : activeKind === 'wired' ? (
      <Headphones size={22} color={colorss.white} />
    ) : activeKind === 'earpiece' ? (
      <Phone size={22} color={colorss.white} />
    ) : (
      <Volume2 size={22} color={colorss.white} />
    );

  const showAndroidVideoNotice = useCallback(() => {
    Alert.alert(
      'Video unavailable',
      'Android video rendering is temporarily disabled in this build because the native WebRTC video surface is crashing after join. Audio calls stay connected.',
    );
  }, []);

  return (
    <SafeAreaView style={styles.overlay} edges={['top']}>
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
        {peerAvatarUrl ? (
          <FastImage
            source={{ uri: peerAvatarUrl }}
            style={styles.peerAvatarTop}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={styles.peerAvatarTopEmpty} />
        )}
        <View style={styles.titleCol}>
          <Text style={styles.topName}>{displayName}</Text>
          {hint !== 'ok' && hint !== 'disconnected' ? (
            <Text style={styles.netHint} numberOfLines={2}>
              {detail || 'Working on connection...'}
            </Text>
          ) : timer ? (
            <Text style={styles.timerText}>{timer}</Text>
          ) : null}
        </View>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.empty}>
        {peerAvatarUrl ? (
          <FastImage
            source={{ uri: peerAvatarUrl }}
            style={styles.peerAvatarRinging}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : null}
        <Text style={styles.emptyText}>
          {isRinging
            ? 'Ringing... waiting for them to answer'
            : 'Connected on audio'}
        </Text>
        <Text style={styles.netHint}>
          Android video is disabled until the native WebRTC crash is resolved.
        </Text>
      </View>

      {autoSwitchBanner ? (
        <View pointerEvents="none" style={styles.autoSwitchBanner}>
          <Text style={styles.autoSwitchBannerText}>{autoSwitchBanner}</Text>
        </View>
      ) : null}

      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[
            styles.ctrlBtn,
            activeKind === 'earpiece' ? styles.ctrlBtnDim : null,
          ]}
          onPress={openAudioPicker}
          accessibilityRole="button"
          accessibilityLabel="Choose audio output"
        >
          {activeAudioIcon}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.ctrlBtn,
            !isMicrophoneEnabled ? styles.ctrlBtnDim : null,
          ]}
          onPress={toggleMic}
        >
          {isMicrophoneEnabled ? (
            <Mic size={22} color={colorss.white} />
          ) : (
            <MicOff size={22} color={colorss.white} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={onSwitchToAudio}
          accessibilityRole="button"
          accessibilityLabel="Switch to voice call"
        >
          <Phone size={22} color={colorss.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctrlBtn, styles.ctrlBtnDim]}
          onPress={showAndroidVideoNotice}
        >
          <VideoOff size={22} color={colorss.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.endBtn} onPress={onEnd}>
          <PhoneOff size={26} color={colorss.white} />
        </TouchableOpacity>
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

function VideoStage({
  safePop,
  displayName,
  peerAvatarUrl,
  tryEmitOutgoingWithoutConnect,
  forceEndCallWithAlert,
  onSwitchToAudio,
  onMinimize,
}: {
  safePop: () => void;
  displayName: string;
  peerAvatarUrl?: string | null;
  tryEmitOutgoingWithoutConnect: () => void;
  forceEndCallWithAlert: (title: string, body: string) => void;
  onSwitchToAudio: () => void;
  onMinimize: () => void;
}) {
  const room = useRoomContext();
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();

  const remoteVisualRefs = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false },
  ).filter(item => isTrackReference(item) && !item.participant.isLocal);

  const primaryRemoteVisual =
    remoteVisualRefs.find(
      r => isTrackReference(r) && r.publication?.source === Track.Source.Camera,
    ) ??
    remoteVisualRefs.find(
      r =>
        isTrackReference(r) &&
        r.publication?.source === Track.Source.ScreenShare,
    ) ??
    null;

  const remoteVisualShowsLive =
    !!primaryRemoteVisual &&
    isTrackReference(primaryRemoteVisual) &&
    !!primaryRemoteVisual.publication?.track &&
    !(
      primaryRemoteVisual.publication.source === Track.Source.Camera &&
      !!primaryRemoteVisual.publication?.isMuted
    );

  const localCameraTrack = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  }).find(
    item =>
      isTrackReference(item) &&
      item.participant.isLocal &&
      item.publication?.track,
  );

  const audio = useCallAudio({ preferred: 'speaker' });
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [autoSwitchBanner, setAutoSwitchBanner] = useState<string | null>(null);
  const { hint, detail } = useLiveKitConnectionHints(room);
  const remotes = useRemoteParticipants();
  const isRinging = remotes.length === 0;
  const videoTimer = useCallTimer(!isRinging);

  const leaveCall = useGracefulRoomLeave({
    safePop,
    beforeLeave: tryEmitOutgoingWithoutConnect,
  });

  // Default video calls to loud-speaker. The hook keeps re-routing whenever a
  // Bluetooth / wired device pairs mid-call.
  useEffect(() => {
    void audio.select('speaker');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .catch(err => console.warn('[VideoCall] mic toggle', err));
  }, [localParticipant, isMicrophoneEnabled]);

  const toggleCam = useCallback(() => {
    if (Platform.OS === 'android' && !liveKitAndroidPublishVideoEnabled()) {
      forceEndCallWithAlert(
        'Video unavailable',
        'Camera video is off on this Android build unless you enable LIVEKIT_ANDROID_PUBLISH_VIDEO in `.env`.',
      );
      return;
    }
    localParticipant.setCameraEnabled(!isCameraEnabled).catch(err => {
      console.warn('[VideoCall] camera toggle', err);
      forceEndCallWithAlert(
        'Camera failed',
        'Could not start the camera safely. The call will close so the app stays stable.',
      );
    });
  }, [forceEndCallWithAlert, localParticipant, isCameraEnabled]);

  const toggleScreenShare = useCallback(() => {
    localParticipant.setScreenShareEnabled(!isScreenShareEnabled).catch(err => {
      console.warn('[VideoCall] screen share', err);
      Alert.alert(
        'Screen share',
        'Screen sharing could not start. On iOS, ensure Broadcast capability is configured; on Android, grant screen capture permission.',
      );
    });
  }, [localParticipant, isScreenShareEnabled]);

  const openAudioPicker = useCallback(() => setAudioPickerOpen(true), []);
  const closeAudioPicker = useCallback(() => setAudioPickerOpen(false), []);
  const onPickAudioOutput = useCallback(
    async (device: { id: AudioOutputKind }) => {
      await audio.select(device.id);
      if (device.id !== 'route_picker') setAudioPickerOpen(false);
    },
    [audio],
  );
  const videoActiveKind = audio.activeId;
  const videoActiveAudioIcon =
    videoActiveKind === 'bluetooth' ? (
      <Bluetooth size={22} color={colorss.white} />
    ) : videoActiveKind === 'wired' ? (
      <Headphones size={22} color={colorss.white} />
    ) : videoActiveKind === 'earpiece' ? (
      <Phone size={22} color={colorss.white} />
    ) : (
      <Volume2 size={22} color={colorss.white} />
    );

  const [mainIsLocal, setMainIsLocal] = useState(false);
  const [facingUser, setFacingUser] = useState(true);

  const hasLocalVideo =
    !!localCameraTrack &&
    isTrackReference(localCameraTrack) &&
    !!localCameraTrack.publication?.track;

  const showPip =
    (mainIsLocal && (!!primaryRemoteVisual || remotes.length > 0)) ||
    (!mainIsLocal && hasLocalVideo);

  /** Below top bar row; SafeAreaView `edges` already offsets from the status bar. */
  const pipTop = 56;

  const keyForTrack = useCallback(
    (item: NonNullable<typeof primaryRemoteVisual>, idx: number) =>
      isTrackReference(item)
        ? `${item.participant.identity}_${
            item.publication?.trackSid ?? 'pub'
          }_${item.publication?.source ?? 'src'}_${idx}`
        : `t_${idx}`,
    [],
  );

  const flipCamera = async () => {
    // Determine the desired facing mode
    const facingModeStr = facingUser ? 'environment' : 'front';
    setFacingUser(!facingUser);

    // Enumerate all available media devices
    const devices = await mediaDevices.enumerateDevices();
    let newDevice = null;

    // Find the video input device with the target facing mode
    for (const device of devices) {
      if (device.kind === 'videoinput' && device.facing === facingModeStr) {
        newDevice = device;
        break;
      }
    }

    if (newDevice == null) {
      console.warn('No camera found with facing mode:', facingModeStr);
      return;
    }

    // Perform the camera switch
    try {
      await room.switchActiveDevice('videoinput', newDevice.deviceId);
      console.log('Camera switched successfully');
    } catch (error) {
      console.error('Failed to switch camera:', error);
      // Revert the state if the switch fails
      setFacingUser(!facingUser);
    }
  };
  const renderPeerPausedMain = () => (
    <View style={styles.waitingMain}>
      {peerAvatarUrl ? (
        <FastImage
          source={{ uri: peerAvatarUrl }}
          style={styles.peerAvatarVideoPaused}
          resizeMode={FastImage.resizeMode.cover}
        />
      ) : (
        <View style={styles.peerAvatarVideoPausedEmpty} />
      )}
      <Text style={styles.emptyText}>Video paused</Text>
    </View>
  );

  const renderMainLayer = () => {
    if (mainIsLocal) {
      if (
        hasLocalVideo &&
        localCameraTrack &&
        isTrackReference(localCameraTrack)
      ) {
        return (
          <VideoTrack
            key={localCameraTrack.publication?.trackSid ?? 'local-main'}
            trackRef={localCameraTrack}
            style={styles.mainVideoFill}
            mirror
            zOrder={0}
          />
        );
      }
      return (
        <View style={styles.waitingMain}>
          <Text style={styles.emptyText}>Your camera is off</Text>
        </View>
      );
    }

    if (primaryRemoteVisual && remoteVisualShowsLive) {
      return (
        <VideoTrack
          key={keyForTrack(primaryRemoteVisual, 0)}
          trackRef={primaryRemoteVisual}
          style={styles.mainVideoFill}
          zOrder={0}
        />
      );
    }

    if (!isRinging && remotes.length > 0) {
      return renderPeerPausedMain();
    }

    return (
      <View style={styles.waitingMain}>
        {peerAvatarUrl && isRinging ? (
          <FastImage
            source={{ uri: peerAvatarUrl }}
            style={styles.peerAvatarRinging}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : null}
        <Text style={styles.emptyText}>
          {isRinging
            ? 'Ringing… waiting for them to answer'
            : 'Waiting for video…'}
        </Text>
      </View>
    );
  };

  const renderPipLayer = () => {
    if (mainIsLocal && primaryRemoteVisual && remoteVisualShowsLive) {
      return (
        <VideoTrack
          key={keyForTrack(primaryRemoteVisual, 0)}
          trackRef={primaryRemoteVisual}
          style={styles.pipVideo}
          zOrder={1}
        />
      );
    }
    if (mainIsLocal && !isRinging && remotes.length > 0) {
      return peerAvatarUrl ? (
        <FastImage
          source={{ uri: peerAvatarUrl }}
          style={styles.pipVideo}
          resizeMode={FastImage.resizeMode.cover}
        />
      ) : (
        <View style={[styles.pipVideo, styles.pipAvatarPlaceholder]} />
      );
    }
    if (
      !mainIsLocal &&
      hasLocalVideo &&
      localCameraTrack &&
      isTrackReference(localCameraTrack)
    ) {
      return (
        <VideoTrack
          key={localCameraTrack.publication?.trackSid ?? 'local-pip'}
          trackRef={localCameraTrack}
          style={styles.pipVideo}
          mirror
          zOrder={1}
        />
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.videoStageRoot} edges={['top', 'bottom']}>
      <View style={styles.videoStageInner}>
        <View style={styles.mainVideoLayer} collapsable={false}>
          {renderMainLayer()}
        </View>

        <View style={styles.topBarAbs}>
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
          {peerAvatarUrl ? (
            <FastImage
              source={{ uri: peerAvatarUrl }}
              style={styles.peerAvatarTop}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={styles.peerAvatarTopEmpty} />
          )}
          <View style={styles.titleCol}>
            <Text style={styles.topName}>{displayName}</Text>
            {hint !== 'ok' && hint !== 'disconnected' ? (
              <Text style={styles.netHint} numberOfLines={2}>
                {detail || 'Working on connection…'}
              </Text>
            ) : videoTimer ? (
              <Text style={styles.timerText}>{videoTimer}</Text>
            ) : null}
          </View>
          <View style={{ width: 28 }} />
        </View>

        {showPip ? (
          <Pressable
            style={[styles.pipWrap, { top: pipTop }]}
            onPress={() => setMainIsLocal(v => !v)}
            accessibilityRole="button"
            accessibilityLabel="Swap main and picture-in-picture video"
            collapsable={false}
          >
            {renderPipLayer()}
          </Pressable>
        ) : null}

        <View style={styles.bottomStackAbs}>
          {autoSwitchBanner ? (
            <View pointerEvents="none" style={styles.autoSwitchBanner}>
              <Text style={styles.autoSwitchBannerText}>
                {autoSwitchBanner}
              </Text>
            </View>
          ) : null}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[
                styles.ctrlBtn,
                videoActiveKind === 'earpiece' ? styles.ctrlBtnDim : null,
              ]}
              onPress={openAudioPicker}
              accessibilityRole="button"
              accessibilityLabel="Choose audio output"
            >
              {videoActiveAudioIcon}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.ctrlBtn,
                !isMicrophoneEnabled ? styles.ctrlBtnDim : null,
              ]}
              onPress={toggleMic}
            >
              {isMicrophoneEnabled ? (
                <Mic size={22} color={colorss.white} />
              ) : (
                <MicOff size={22} color={colorss.white} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.ctrlBtn,
                !isCameraEnabled ? styles.ctrlBtnDim : null,
              ]}
              onPress={toggleCam}
            >
              {isCameraEnabled ? (
                <Video size={22} color={colorss.white} />
              ) : (
                <VideoOff size={22} color={colorss.white} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctrlBtn}
              onPress={onSwitchToAudio}
              accessibilityRole="button"
              accessibilityLabel="Switch to voice call"
            >
              <Phone size={22} color={colorss.white} />
            </TouchableOpacity>
            {isCameraEnabled &&
            (Platform.OS === 'ios' ||
              (Platform.OS === 'android' &&
                liveKitAndroidPublishVideoEnabled())) ? (
              <TouchableOpacity
                style={styles.ctrlBtn}
                onPress={() => {
                  flipCamera().catch(() => undefined);
                }}
                accessibilityRole="button"
                accessibilityLabel="Switch camera"
              >
                <SwitchCamera size={22} color={colorss.white} />
              </TouchableOpacity>
            ) : null}
            {Platform.OS !== 'android' ? (
              <TouchableOpacity
                style={[
                  styles.ctrlBtn,
                  isScreenShareEnabled ? styles.ctrlHighlight : null,
                ]}
                onPress={toggleScreenShare}
              >
                <MonitorUp size={22} color={colorss.white} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.endBtn} onPress={onEnd}>
              <PhoneOff size={26} color={colorss.white} />
            </TouchableOpacity>
          </View>
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

const VideoCallScreen: React.FC<Props> = ({ navigation, route }) => {
  useOverlayPermissionPrompt();
  const safePop = useSafeSingleNavigationPop(navigation as never);

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
      callLabel: 'Video call',
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
        console.error('[VideoCall] AudioSession', e);
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

  useEffect(() => {
    if (__DEV__ && Platform.OS === 'android') {
      console.log(
        '[VideoCall] Android join: LiveKitRoom video=',
        PUBLISH_VIDEO_ON_LIVEKIT_CONNECT,
        liveKitAndroidPublishVideoEnabled()
          ? '(LIVEKIT_ANDROID_PUBLISH_VIDEO enabled — watch for OEM WebRTC crashes)'
          : '(camera publish off unless LIVEKIT_ANDROID_PUBLISH_VIDEO=true in .env)',
      );
    }
  }, []);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colorss.white} size="large" />
          <Text style={styles.statusText}>Connecting to Hopechat…</Text>
        </View>
      ) : typeof serverUrl === 'string' &&
        serverUrl.length > 0 &&
        typeof token === 'string' &&
        token.length > 0 ? (
        <LiveKitRoom
          key={route.params?.liveKitRoom ?? 'video-call'}
          serverUrl={serverUrl}
          token={token}
          connect={true}
          audio={true}
          video={PUBLISH_VIDEO_ON_LIVEKIT_CONNECT}
          screen={false}
          options={getLiveKitVideoCallRoomOptions()}
          connectOptions={videoCallConnectOptions}
          onDisconnected={onDisconnected}
          onError={onError}
          onEncryptionError={onEncryptionError}
          onMediaDeviceFailure={failure => {
            console.warn('[VideoCall] media device', failure);
            forceEndCallWithAlert(
              'Camera or microphone',
              typeof failure === 'string'
                ? failure
                : 'Could not access camera or mic — check permissions and try again.',
            );
          }}
        >
          <CallRoomErrorBoundary title="Video call error" onClose={safePop}>
            <VideoCallGate
              navigation={navigation}
              safePop={safePop}
              displayName={calleeName}
              peerAvatarUrl={route.params?.avatarUrl}
              forceEndCallWithAlert={forceEndCallWithAlert}
              routeParams={route.params}
              outcomeOpts={{
                conversationId: route.params?.conversationId,
                peerUserId: route.params?.peerUserId,
                callDirection: route.params?.callDirection,
              }}
            />
          </CallRoomErrorBoundary>
        </LiveKitRoom>
      ) : (
        <SafeAreaView style={styles.missingWrap}>
          <Text style={styles.missingTitle}>Cannot start video call</Text>
          <Text style={styles.missingBody}>
            {error ??
              'No LiveKit token or signaling URL — check LIVEKIT_* entries in `.env` and restart Metro.'}
          </Text>
          <Text style={styles.missingTiny}>
            Room hint: {route.params?.liveKitRoom ?? '—'} · Reload after editing
            `.env` clears Metro cache.
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
  );
};

export default VideoCallScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  videoStageRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoStageInner: {
    flex: 1,
    position: 'relative',
  },
  mainVideoLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  mainVideoFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111',
  },
  waitingMain: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0a0a0a',
    gap: 12,
  },
  topBarAbs: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bottomStackAbs: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  autoSwitchBanner: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 8,
  },
  autoSwitchBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  pipWrap: {
    position: 'absolute',
    right: 12,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: '#000',
    zIndex: 20,
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  peerAvatarTop: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  peerAvatarTopEmpty: {
    width: 38,
    height: 38,
  },
  peerAvatarLarge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  peerAvatarRinging: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  peerAvatarVideoPaused: {
    width: 168,
    height: 168,
    borderRadius: 84,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  peerAvatarVideoPausedEmpty: {
    width: 168,
    height: 168,
    borderRadius: 84,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pipAvatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  titleCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  topName: {
    color: colorss.white,
    fontSize: 16,
    fontWeight: '700',
  },
  netHint: {
    color: 'rgba(255,230,160,0.95)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  timerText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  ctrlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnDim: {
    backgroundColor: 'rgba(255,59,48,0.55)',
  },
  ctrlHighlight: {
    backgroundColor: 'rgba(59,130,246,0.75)',
  },
  bottomBar: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  endBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colorss.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingTop: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
    backgroundColor: '#0a0a0a',
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
    backgroundColor: '#0a0a0a',
  },
  missingTitle: {
    color: colorss.white,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  missingBody: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    lineHeight: 22,
  },
  missingTiny: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 16,
  },
  backGhost: {
    marginTop: 28,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: '#0a0a0a',
  },
  connectOverlayText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
});
