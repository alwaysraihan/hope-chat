import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Mic,
  Volume2,
  PhoneOff,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AudioSession,
  LiveKitRoom,
  useRoomContext,
  useParticipants,
} from '@livekit/react-native';

import { colorss } from '../theme';
import { RootStackNavigatorParamList } from '../types/navigators';
import FastImage from '@d11/react-native-fast-image';
import { IC_PROFILE } from '../assets';
import { LIVEKIT_URL, LIVEKIT_DEV_TOKEN } from '../config/livekit';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'AudioCall'>;

function AudioStage({
  navigation,
  displayName,
}: {
  navigation: Props['navigation'];
  displayName: string;
}) {
  const room = useRoomContext();
  const participants = useParticipants();

  const onEnd = () => {
    room?.disconnect().catch(() => undefined);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onEnd}>
          <ChevronLeft size={28} color={colorss.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.userInfo}>
        <FastImage source={IC_PROFILE} style={styles.avatar} />
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.status}>
          Connected · participants {participants.length}
        </Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.actionItem}>
          <TouchableOpacity style={styles.actionBtn}>
            <Volume2 size={22} color={colorss.white} />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Speaker</Text>
        </View>
        <View style={styles.actionItem}>
          <TouchableOpacity style={styles.actionBtn}>
            <Mic size={22} color={colorss.white} />
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
    </SafeAreaView>
  );
}

const AudioCallScreen: React.FC<Props> = ({ navigation, route }) => {
  useEffect(() => {
    const run = async () => {
      await AudioSession.startAudioSession();
    };
    run();
    return () => {
      AudioSession.stopAudioSession().catch(() => undefined);
    };
  }, []);

  const displayName =
    route.params?.displayName ?? route.params?.liveKitRoom ?? 'Voice';
  const token = LIVEKIT_DEV_TOKEN;

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        {typeof token === 'string' && token.length > 0 ? (
          <LiveKitRoom
            serverUrl={LIVEKIT_URL}
            token={token}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={() => navigation.goBack()}
          >
            <AudioStage navigation={navigation} displayName={displayName} />
          </LiveKitRoom>
        ) : (
          <SafeAreaView style={styles.missingWrap}>
            <Text style={styles.missingTitle}>LiveKit audio</Text>
            <Text style={styles.missingBody}>
              Configure LIVEKIT_DEV_TOKEN in src/config/livekit.ts. Run LiveKit OSS
              (see https://github.com/livekit/livekit) or LiveKit Cloud, then connect
              with a room token.
            </Text>
            <TouchableOpacity
              style={styles.backGhost}
              onPress={() => navigation.goBack()}
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
});
