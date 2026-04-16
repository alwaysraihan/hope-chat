import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Plus,
  MoreVertical,
  Camera,
  Mic,
  UserPlus,
  Volume2,
  PhoneOff,
} from 'lucide-react-native';

import { colorss } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'AudioCall'>;

const AudioCallScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color={colorss.white} />
          </TouchableOpacity>

          <View style={styles.topRight}>
            <TouchableOpacity style={styles.iconBtn}>
              <Plus size={18} color={colorss.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <MoreVertical size={18} color={colorss.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>MD</Text>
          </View>

          <Text style={styles.name}>MD Emon Hossain</Text>
          <Text style={styles.status}>Calling...</Text>
        </View>

        <View style={styles.actions}>
          {[
            { Icon: Camera, label: 'Camera' },
            { Icon: Mic, label: 'Mute' },
            { Icon: UserPlus, label: 'Share' },
            { Icon: Volume2, label: 'Speaker' },
          ].map(({ Icon, label }) => (
            <View key={label} style={styles.actionItem}>
              <TouchableOpacity style={styles.actionBtn}>
                <Icon size={22} color={colorss.white} />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.endWrapper}>
          <TouchableOpacity style={styles.endBtn}>
            <PhoneOff size={26} color={colorss.white} />
          </TouchableOpacity>
          <Text style={styles.endText}>End</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AudioCallScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colorss.primaryDark },

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
    justifyContent: 'space-between',
    marginTop: 'auto',
    marginBottom: 20,
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
