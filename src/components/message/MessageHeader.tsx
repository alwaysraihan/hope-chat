import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import Profile from '../../assets/raihan-sarkar.webp';
import {
  LucideArrowLeft,
  LucideEllipsisVertical,
  LucideVideo,
  Phone,
} from 'lucide-react-native';
import { colorss, theme } from '../../theme';

//  Types

interface MessageHeaderProps {
  onProfilePress: () => void;
  onBackPress: () => void;
  onAudioCall: () => void;
  onVideoCall?: () => void;
  name?: string;
  status?: string;
}

//  Component

const MessageHeader: React.FC<MessageHeaderProps> = ({
  onProfilePress,
  onBackPress,
  onAudioCall,
  onVideoCall,
  name = 'Raihan Sarkar',
  status = 'Online',
}) => (
  <View style={styles.container}>
    <TouchableOpacity
      onPress={onBackPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <LucideArrowLeft color={theme.textPrimary} size={22} />
    </TouchableOpacity>

    <TouchableOpacity onPress={onProfilePress} style={styles.profile}>
      <Image source={Profile} style={styles.avatar} />
      <View style={styles.nameBlock}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
    </TouchableOpacity>

    <View style={styles.actions}>
      <TouchableOpacity onPress={onVideoCall} style={styles.actionBtn}>
        <LucideVideo size={16} color={theme.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onAudioCall} style={styles.actionBtn}>
        <Phone size={16} color={theme.textPrimary} />
      </TouchableOpacity>
    </View>
  </View>
);

export default React.memo(MessageHeader);

//  Styles

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.white,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  profile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    height: 38,
    width: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  nameBlock: {
    gap: 1,
  },
  name: {
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  status: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 9,
    backgroundColor: theme.secondary,
    borderRadius: 20,
  },
});
