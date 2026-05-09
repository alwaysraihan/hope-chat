import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import Profile from '../../assets/raihan-sarkar.webp';
import { LucideVideo, Phone, ChevronLeft } from 'lucide-react-native';
import { colorss } from '../../theme';

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
}) => {
  const actions = [
    {
      Icon: Phone,
      label: 'Audio Call',
      onPress: onAudioCall,
    },
    {
      Icon: LucideVideo,
      label: 'Video Call',
      onPress: onVideoCall,
    },
  ];
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onBackPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ChevronLeft color={colorss.white} size={22} />
      </TouchableOpacity>

      <TouchableOpacity onPress={onProfilePress} style={styles.profile}>
        <Image source={Profile} style={styles.avatar} />
        <View style={styles.nameBlock}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.status}>{status}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        {actions.map(({ Icon, onPress }, index) => (
          <TouchableOpacity
            key={index}
            onPress={onPress}
            style={styles.actionBtn}
          >
            <Icon size={18} color={colorss.white} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default React.memo(MessageHeader);

//  Styles

const styles = StyleSheet.create({
  container: {
    backgroundColor: colorss.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    color: colorss.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  status: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 7,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
  },
});
