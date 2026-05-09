import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Mic,
  Volume2,
  PhoneOff,
  MessageCircle,
  SwitchCamera,
} from 'lucide-react-native';

import { colorss } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
import { IC_PROFILE } from '../assets';
import FastImage from '@d11/react-native-fast-image';
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
} from 'react-native-agora';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'VideoCall'>;
const appId = 'YOUR_AGORA_APP_ID';
const channelName = 'testChannel';
const token = 'YOUR_TEMP_TOKEN';

const VideoCallScreen: React.FC<Props> = ({ navigation }) => {
  const [remoteUid, setRemoteUid] = useState<number | null>(null);

  useEffect(() => {
    const engine = createAgoraRtcEngine();

    engine.initialize({
      appId,
    });

    engine.enableVideo();

    engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);

    engine.registerEventHandler({
      onUserJoined: (_connection, uid) => {
        setRemoteUid(uid);
      },

      onUserOffline: () => {
        setRemoteUid(null);
      },
    });

    engine.joinChannel(token, channelName, 0, {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    });

    return () => {
      engine.leaveChannel();
      engine.release();
    };
  }, []);

  const profileImage = true;

  const actions = [
    { Icon: Volume2, label: 'Speaker' },
    { Icon: Mic, label: 'Mute' },
    { Icon: PhoneOff, label: 'End' },
  ];

  return (
    <View style={styles.container}>
      {/* Remote Video */}
      {remoteUid !== null && (
        <RtcSurfaceView
          canvas={{ uid: remoteUid }}
          style={styles.remoteVideo}
        />
      )}

      {/* Local Preview */}
      <View style={styles.localPreview}>
        <RtcSurfaceView canvas={{ uid: 0 }} style={{ flex: 1 }} />
      </View>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.containerOverlay}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ChevronLeft size={28} color={colorss.white} />
            </TouchableOpacity>

            <View style={styles.topRight}>
              <TouchableOpacity style={styles.iconBtn}>
                <MessageCircle
                  fill={colorss.white}
                  size={18}
                  color={colorss.white}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}>
                <SwitchCamera size={18} color={colorss.white} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.userInfo}>
            {profileImage ? (
              <FastImage source={IC_PROFILE} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>MD</Text>
              </View>
            )}

            <Text style={styles.name}>MD Emon Hossain</Text>
            <Text style={styles.status}>Calling...</Text>
          </View>

          <View style={styles.actions}>
            {actions.map(({ Icon, label }) => {
              const style = label === 'End' ? styles.endBtn : styles.actionBtn;
              return (
                <View key={label} style={styles.actionItem}>
                  <TouchableOpacity style={style}>
                    <Icon size={22} color={colorss.white} />
                  </TouchableOpacity>
                  <Text style={styles.actionLabel}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default VideoCallScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  localPreview: {
    position: 'absolute',
    top: 80,
    right: 20,
    width: 120,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 20,
  },

  containerOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  topRight: { flexDirection: 'row', gap: 10 },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  userInfo: { alignItems: 'center', marginTop: 32 },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colorss.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    color: colorss.white,
    fontSize: 36,
    fontWeight: '800',
  },

  name: {
    color: colorss.white,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 14,
  },

  status: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 'auto',
    marginBottom: 30,
    marginHorizontal: 20,
  },

  actionItem: { alignItems: 'center', gap: 6 },

  actionBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },

  endWrapper: { alignItems: 'center' },

  endBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colorss.error,
    justifyContent: 'center',
    alignItems: 'center',
  },

  endText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
  },
});
