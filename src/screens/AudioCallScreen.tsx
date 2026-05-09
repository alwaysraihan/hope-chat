import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Mic,
  Volume2,
  PhoneOff,
  MessageCircle,
} from 'lucide-react-native';

import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
} from 'react-native-agora';

import { colorss } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
import { IC_PROFILE } from '../assets';
import FastImage from '@d11/react-native-fast-image';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'AudioCall'>;

const appId = 'YOUR_AGORA_APP_ID';
const channelName = 'audioCallChannel';
const token = 'YOUR_TEMP_TOKEN';

const AudioCallScreen: React.FC<Props> = ({ navigation }) => {
  const profileImage = true;

  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callStatus, setCallStatus] = useState('Calling...');
  const [remoteUid, setRemoteUid] = useState<number | null>(null);

  const actions = [
    {
      Icon: Volume2,
      label: 'Speaker',
      onPress: () => toggleSpeaker(),
    },
    {
      Icon: Mic,
      label: 'Mute',
      onPress: () => toggleMute(),
    },
    {
      Icon: PhoneOff,
      label: 'End',
      onPress: () => endCall(),
    },
  ];

  const engine = createAgoraRtcEngine();

  useEffect(() => {
    initializeAgora();

    return () => {
      engine.leaveChannel();
      engine.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeAgora = async () => {
    engine.initialize({
      appId,
    });

    engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);

    engine.enableAudio();

    engine.disableVideo();

    engine.registerEventHandler({
      onJoinChannelSuccess: () => {
        setCallStatus('Calling...');
      },

      onUserJoined: (_connection, uid) => {
        setRemoteUid(uid);
        setCallStatus('Connected');
      },

      onUserOffline: () => {
        setRemoteUid(null);
        setCallStatus('Call Ended');
      },
    });

    engine.joinChannel(token, channelName, 0, {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    });
  };

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    engine.muteLocalAudioStream(newState);
  };

  const toggleSpeaker = () => {
    const newState = !isSpeakerOn;
    setIsSpeakerOn(newState);
    engine.setEnableSpeakerphone(newState);
  };

  const endCall = () => {
    engine.leaveChannel();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={endCall}>
            <ChevronLeft size={28} color={colorss.white} />
          </TouchableOpacity>

          <View style={styles.topRight}>
            <TouchableOpacity style={styles.iconBtn}>
              <MessageCircle
                size={18}
                fill={colorss.white}
                color={colorss.white}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          {profileImage ? (
            <FastImage source={IC_PROFILE} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>MD</Text>
            </View>
          )}

          <Text style={styles.name}>MD Emon Hossain</Text>

          <Text style={styles.status}>{callStatus}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {actions.map(({ Icon, label, onPress }) => {
            const style = label === 'End' ? styles.endBtn : styles.actionBtn;

            return (
              <View key={label} style={styles.actionItem}>
                <TouchableOpacity style={style} onPress={onPress}>
                  <Icon size={22} color={colorss.white} />
                </TouchableOpacity>

                <Text style={styles.actionLabel}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AudioCallScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.primaryDark,
  },

  container: {
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

  topRight: {
    flexDirection: 'row',
    gap: 10,
  },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  userInfo: {
    alignItems: 'center',
    marginTop: 60,
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
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
    marginTop: 'auto',
    marginBottom: 40,
    marginHorizontal: 20,
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
});
