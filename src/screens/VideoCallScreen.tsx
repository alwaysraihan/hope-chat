import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, PhoneOff } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  useTracks,
  isTrackReference,
  useRoomContext,
} from '@livekit/react-native';
import { Track } from 'livekit-client';

import { colorss } from '../theme';
import { RootStackNavigatorParamList } from '../types/navigators';
import { selectHopenityProfile } from '../redux/features/auth/authSlice';
import { LIVEKIT_FALLBACK_ROOM } from '../config/livekit';
import { useLiveKitCredentials } from '../hooks/useLiveKitCredentials';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'VideoCall'>;

function VideoStage({
  navigation,
  displayName,
}: {
  navigation: Props['navigation'];
  displayName: string;
}) {
  const room = useRoomContext();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });

  const onEnd = () => {
    room?.disconnect().catch(() => undefined);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.overlay} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onEnd}>
          <ChevronLeft size={28} color={colorss.white} />
        </TouchableOpacity>
        <Text style={styles.topName}>{displayName}</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={tracks}
        renderItem={({ item }) =>
          isTrackReference(item) ? (
            <VideoTrack trackRef={item} style={styles.remoteVideo} />
          ) : (
            <View style={styles.remoteVideo} />
          )
        }
        keyExtractor={(r, idx) =>
          `${r.publication?.trackSid ?? 'ph'}_${idx}`
        }
        style={{ flex: 1 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Waiting for video…</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.endBtn} onPress={onEnd}>
          <PhoneOff size={26} color={colorss.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const VideoCallScreen: React.FC<Props> = ({ navigation, route }) => {
  const profile = useSelector(selectHopenityProfile);

  useEffect(() => {
    const run = async () => {
      await AudioSession.startAudioSession();
    };
    run();
    return () => {
      AudioSession.stopAudioSession().catch(() => undefined);
    };
  }, []);

  const calleeName =
    route.params?.displayName ??
    route.params?.liveKitRoom ??
    LIVEKIT_FALLBACK_ROOM;

  const { loading, serverUrl, token, error, reload } = useLiveKitCredentials({
    room: route.params?.liveKitRoom,
    identity: profile?.userId ?? undefined,
    displayName: profile?.displayName ?? undefined,
  });

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colorss.white} size="large" />
          <Text style={styles.statusText}>Connecting to LiveKit…</Text>
        </View>
      ) : typeof serverUrl === 'string' &&
        serverUrl.length > 0 &&
        typeof token === 'string' &&
        token.length > 0 ? (
        <LiveKitRoom
          serverUrl={serverUrl}
          token={token}
          connect={true}
          audio={true}
          video={true}
          options={{
            adaptiveStream: { pixelDensity: 'screen' },
          }}
          onDisconnected={() => navigation.goBack()}
        >
          <VideoStage navigation={navigation} displayName={calleeName} />
        </LiveKitRoom>
      ) : (
        <SafeAreaView style={styles.missingWrap}>
          <Text style={styles.missingTitle}>Cannot start video call</Text>
          <Text style={styles.missingBody}>
            {error ??
              'No LiveKit token or signaling URL — check LIVEKIT_* values in `.env`.'}
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
            onPress={() => navigation.goBack()}
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
  remoteVideo: {
    width: '100%',
    minHeight: 240,
    backgroundColor: '#111',
    marginVertical: 4,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topName: {
    color: colorss.white,
    fontSize: 16,
    fontWeight: '700',
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
});
