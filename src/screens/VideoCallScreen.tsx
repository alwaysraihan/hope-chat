import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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
      if (countRef.current > 0) {
        return;
      }
      const state = csRef.current;
      const body =
        state === ConnectionState.Connected
          ? 'The other person isn’t available or didn’t answer. They may be offline.'
          : 'Could not complete the call. Check your network and try again.';
      console.warn('[VideoCall] outgoing call timeout (no remote participant)', {
        connectionState: state,
        remoteCount: countRef.current,
      });
      try {
        Alert.alert('Call ended', body);
      } catch {
        /* */
      }
      void leaveRef.current();
    }, 60_000);
    return () => clearTimeout(t);
  }, [outgoing]);

  if (cs !== ConnectionState.Connected) {
    const label =
      cs === ConnectionState.Connecting
        ? 'Calling…'
        : cs === ConnectionState.Reconnecting
          ? 'Reconnecting…'
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
    />
  ) : (
    <VideoStage
      safePop={safePop}
      displayName={displayName}
      peerAvatarUrl={peerAvatarUrl}
      tryEmitOutgoingWithoutConnect={tryEmitOutgoingWithoutConnect}
      forceEndCallWithAlert={forceEndCallWithAlert}
    />
  );
}

function AndroidConnectedCallStage({
  safePop,
  displayName,
  peerAvatarUrl,
  tryEmitOutgoingWithoutConnect,
}: {
  navigation: Props['navigation'];
  safePop: () => void;
  displayName: string;
  peerAvatarUrl?: string | null;
  tryEmitOutgoingWithoutConnect: () => void;
}) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [speakerOn, setSpeakerOn] = useState(true);
  const { hint, detail } = useLiveKitConnectionHints(room);
  const remotes = useRemoteParticipants();
  const isRinging = remotes.length === 0;

  useEffect(() => {
    const subscribeAudioOnly = () => {
      remotes.forEach(participant => {
        participant.getTrackPublications().forEach(publication => {
          const remotePublication = publication as RemoteTrackPublication;
          remotePublication.setSubscribed(publication.kind === Track.Kind.Audio);
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
    void leaveCall();
  };

  const toggleMic = useCallback(() => {
    localParticipant
      .setMicrophoneEnabled(!isMicrophoneEnabled)
      .catch(err => console.warn('[VideoCall] mic toggle', err));
  }, [localParticipant, isMicrophoneEnabled]);

  const toggleSpeaker = useCallback(async () => {
    try {
      const next = !speakerOn;
      const outs = await AudioSession.getAudioOutputs();
      const target = next
        ? outs.find(o => o === 'speaker') ?? 'speaker'
        : outs.find(o => o === 'earpiece') ?? 'earpiece';
      await AudioSession.selectAudioOutput(target);
      setSpeakerOn(next);
    } catch (e) {
      console.warn('[VideoCall] speaker route', e);
    }
  }, [speakerOn]);

  const showAndroidVideoNotice = useCallback(() => {
    Alert.alert(
      'Video unavailable',
      'Android video rendering is temporarily disabled in this build because the native WebRTC video surface is crashing after join. Audio calls stay connected.',
    );
  }, []);

  return (
    <SafeAreaView style={styles.overlay} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onEnd} accessibilityRole="button">
          <ChevronLeft size={28} color={colorss.white} />
        </TouchableOpacity>
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

      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.ctrlBtn, !speakerOn ? styles.ctrlBtnDim : null]}
          onPress={toggleSpeaker}
        >
          <Volume2 size={22} color={colorss.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctrlBtn, !isMicrophoneEnabled ? styles.ctrlBtnDim : null]}
          onPress={toggleMic}
        >
          {isMicrophoneEnabled ? (
            <Mic size={22} color={colorss.white} />
          ) : (
            <MicOff size={22} color={colorss.white} />
          )}
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
    </SafeAreaView>
  );
}

function VideoStage({
  safePop,
  displayName,
  peerAvatarUrl,
  tryEmitOutgoingWithoutConnect,
  forceEndCallWithAlert,
}: {
  safePop: () => void;
  displayName: string;
  peerAvatarUrl?: string | null;
  tryEmitOutgoingWithoutConnect: () => void;
  forceEndCallWithAlert: (title: string, body: string) => void;
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
  ).filter(
    item => isTrackReference(item) && !item.participant.isLocal,
  );

  const primaryRemoteVisual =
    remoteVisualRefs.find(
      r =>
        isTrackReference(r) && r.publication?.source === Track.Source.Camera,
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

  const [speakerOn, setSpeakerOn] = useState(true);
  const { hint, detail } = useLiveKitConnectionHints(room);
  const remotes = useRemoteParticipants();
  const isRinging = remotes.length === 0;

  const leaveCall = useGracefulRoomLeave({
    safePop,
    beforeLeave: tryEmitOutgoingWithoutConnect,
  });

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'ios') {
          await AudioSession.selectAudioOutput('force_speaker');
        } else {
          await AudioSession.selectAudioOutput('speaker');
        }
      } catch {
        /* route may be unavailable until audio session is ready */
      }
    })().catch(() => undefined);
  }, []);

  const onEnd = () => {
    void leaveCall();
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
    localParticipant
      .setCameraEnabled(!isCameraEnabled)
      .catch(err => {
        console.warn('[VideoCall] camera toggle', err);
        forceEndCallWithAlert(
          'Camera failed',
          'Could not start the camera safely. The call will close so the app stays stable.',
        );
      });
  }, [forceEndCallWithAlert, localParticipant, isCameraEnabled]);

  const toggleScreenShare = useCallback(() => {
    localParticipant
      .setScreenShareEnabled(!isScreenShareEnabled)
      .catch(err => {
        console.warn('[VideoCall] screen share', err);
        Alert.alert(
          'Screen share',
          'Screen sharing could not start. On iOS, ensure Broadcast capability is configured; on Android, grant screen capture permission.',
        );
      });
  }, [localParticipant, isScreenShareEnabled]);

  const toggleSpeaker = useCallback(async () => {
    try {
      const next = !speakerOn;
      if (Platform.OS === 'ios') {
        await AudioSession.selectAudioOutput(
          next ? 'force_speaker' : 'default',
        );
      } else {
        const outs = await AudioSession.getAudioOutputs();
        const target = next
          ? outs.find(o => o === 'speaker') ?? 'speaker'
          : outs.find(o => o === 'earpiece') ?? 'earpiece';
        await AudioSession.selectAudioOutput(target);
      }
      setSpeakerOn(next);
    } catch (e) {
      console.warn('[VideoCall] speaker route', e);
    }
  }, [speakerOn]);

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
        ? `${item.participant.identity}_${item.publication?.trackSid ?? 'pub'}_${item.publication?.source ?? 'src'}_${idx}`
        : `t_${idx}`,
    [],
  );

  const flipCamera = useCallback(async () => {
    if (!isCameraEnabled) {
      return;
    }
    if (Platform.OS === 'android' && !liveKitAndroidPublishVideoEnabled()) {
      return;
    }
    const nextFacing = facingUser ? 'environment' : 'user';
    try {
      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      const mediaTrack = pub?.track;
      if (mediaTrack instanceof LocalVideoTrack) {
        await mediaTrack.restartTrack({ facingMode: nextFacing });
        setFacingUser(v => !v);
        return;
      }
      await localParticipant.setCameraEnabled(false);
      await localParticipant.setCameraEnabled(true, { facingMode: nextFacing });
      setFacingUser(v => !v);
    } catch (e) {
      console.warn('[VideoCall] flip camera', e);
      Alert.alert('Camera', 'Could not switch between front and back camera.');
    }
  }, [
    facingUser,
    isCameraEnabled,
    localParticipant,
  ]);

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
      if (hasLocalVideo && localCameraTrack && isTrackReference(localCameraTrack)) {
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
    if (!mainIsLocal && hasLocalVideo && localCameraTrack && isTrackReference(localCameraTrack)) {
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
          <TouchableOpacity onPress={onEnd} accessibilityRole="button">
            <ChevronLeft size={28} color={colorss.white} />
          </TouchableOpacity>
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
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[styles.ctrlBtn, !speakerOn ? styles.ctrlBtnDim : null]}
              onPress={toggleSpeaker}
            >
              <Volume2 size={22} color={colorss.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctrlBtn, !isMicrophoneEnabled ? styles.ctrlBtnDim : null]}
              onPress={toggleMic}
            >
              {isMicrophoneEnabled ? (
                <Mic size={22} color={colorss.white} />
              ) : (
                <MicOff size={22} color={colorss.white} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctrlBtn, !isCameraEnabled ? styles.ctrlBtnDim : null]}
              onPress={toggleCam}
            >
              {isCameraEnabled ? (
                <Video size={22} color={colorss.white} />
              ) : (
                <VideoOff size={22} color={colorss.white} />
              )}
            </TouchableOpacity>
            {isCameraEnabled &&
            (Platform.OS === 'ios' ||
              (Platform.OS === 'android' && liveKitAndroidPublishVideoEnabled())) ? (
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
                style={[styles.ctrlBtn, isScreenShareEnabled ? styles.ctrlHighlight : null]}
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
    </SafeAreaView>
  );
}

const VideoCallScreen: React.FC<Props> = ({ navigation, route }) => {
  const safePop = useSafeSingleNavigationPop(navigation as never);
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
            preferredOutputList: ['speaker', 'bluetooth', 'headset', 'earpiece'],
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
