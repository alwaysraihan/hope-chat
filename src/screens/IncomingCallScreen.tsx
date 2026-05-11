import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Phone, PhoneOff, Video as VideoIcon } from 'lucide-react-native';

import { colorss } from '../theme';
import type { RootStackNavigatorParamList } from '../types/navigators';
import {
  startIncomingCallRingtone,
  stopIncomingCallRingtone,
} from '../services/incomingCall/callRingtone';
import { cancelAndroidIncomingCallNotification } from '../services/incomingCall/androidIncomingCallUi';
import { emitCallOutcome } from '../services/callOutcomeBus';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'IncomingCall'>;

const IncomingCallScreen: React.FC<Props> = ({ navigation, route }) => {
  const { callKind, displayName, liveKitRoom, avatarUrl, conversationId, callerId } =
    route.params;
  const pulse = useRef(new Animated.Value(1)).current;
  const acceptedRef = useRef(false);

  const decline = useCallback(() => {
    acceptedRef.current = true;
    stopIncomingCallRingtone();
    Vibration.cancel();
    void cancelAndroidIncomingCallNotification();
    if (conversationId?.trim() && callerId?.trim()) {
      emitCallOutcome({
        conversationId: conversationId.trim(),
        callKind,
        variant: 'incoming_missed',
        peerUserId: callerId.trim(),
        peerDisplayName: displayName,
      });
    }
    navigation.goBack();
  }, [
    navigation,
    callKind,
    conversationId,
    callerId,
    displayName,
  ]);

  const accept = useCallback(() => {
    acceptedRef.current = true;
    stopIncomingCallRingtone();
    Vibration.cancel();
    void cancelAndroidIncomingCallNotification();
    const params = {
      displayName,
      liveKitRoom,
      avatarUrl: avatarUrl ?? null,
      conversationId,
      peerUserId: callerId,
      callDirection: 'incoming' as const,
    };
    navigation.replace(
      callKind === 'video' ? 'VideoCall' : 'AudioCall',
      params,
    );
  }, [
    navigation,
    displayName,
    liveKitRoom,
    callKind,
    avatarUrl,
    conversationId,
    callerId,
  ]);

  useEffect(() => {
    const startRing = () => {
      void cancelAndroidIncomingCallNotification();
      startIncomingCallRingtone();
      if (Platform.OS === 'android') {
        Vibration.cancel();
        Vibration.vibrate([0, 600, 400, 600, 400, 600], true);
      } else {
        Vibration.vibrate([0, 500, 250, 500, 250, 500]);
      }
    };

    startRing();

    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active' && !acceptedRef.current) {
        startRing();
      }
    });

    return () => {
      appSub.remove();
      stopIncomingCallRingtone();
      Vibration.cancel();
    };
  }, []);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', () => {
      if (acceptedRef.current) return;
      if (conversationId?.trim() && callerId?.trim()) {
        emitCallOutcome({
          conversationId: conversationId.trim(),
          callKind,
          variant: 'incoming_missed',
          peerUserId: callerId.trim(),
          peerDisplayName: displayName,
        });
      }
    });
    return sub;
  }, [navigation, callKind, conversationId, callerId, displayName]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 820,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 820,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const Icon = callKind === 'video' ? VideoIcon : Phone;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Text style={styles.small}>Incoming {callKind} call</Text>
      <Text style={styles.name}>{displayName}</Text>
      <Animated.View
        style={[styles.avatarWrap, { transform: [{ scale: pulse }] }]}
      >
        {avatarUrl ? (
          <FastImage
            source={{ uri: avatarUrl }}
            style={styles.avatarImage}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <Icon size={48} color={colorss.white} />
        )}
      </Animated.View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.circle, styles.reject]}
          onPress={decline}
          accessibilityRole="button"
          accessibilityLabel="Decline call"
        >
          <PhoneOff color={colorss.white} size={30} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.circle, styles.accept]}
          onPress={accept}
          accessibilityRole="button"
          accessibilityLabel="Accept call"
        >
          <Phone color={colorss.white} size={30} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default IncomingCallScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colorss.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  small: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    marginBottom: 8,
  },
  name: {
    color: colorss.white,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 36,
  },
  avatarWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 56,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 72,
  },
  circle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reject: {
    backgroundColor: colorss.error,
  },
  accept: {
    backgroundColor: '#22c55e',
  },
});
