import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { LucideVideo, Phone, ChevronLeft, MoreVertical } from 'lucide-react-native';
import { colorss } from '../../theme';
import FastImage from '@d11/react-native-fast-image';

interface MessageHeaderProps {
  onProfilePress: () => void;
  onBackPress: () => void;
  onAudioCall: () => void;
  onVideoCall?: () => void;
  /** Fires when the ⋮ button is pressed — show ConversationAction sheet */
  onMorePress?: () => void;
  name: string;
  /** e.g. "Online" or "last seen …" — omit or empty to hide subtitle */
  status?: string;
  avatarUri?: string | null;
}

function initialsFromName(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      (parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')
    ).toUpperCase();
  }
  return t.charAt(0).toUpperCase();
}

const MessageHeader: React.FC<MessageHeaderProps> = ({
  onProfilePress,
  onBackPress,
  onAudioCall,
  onVideoCall,
  onMorePress,
  name,
  status,
  avatarUri,
}) => {
  const callActions = [
    { Icon: Phone, label: 'Audio Call', onPress: onAudioCall },
    ...(onVideoCall ? [{ Icon: LucideVideo, label: 'Video Call', onPress: onVideoCall }] : []),
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
        {avatarUri ? (
          <FastImage source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{initialsFromName(name)}</Text>
          </View>
        )}
        <View style={styles.nameBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {name || 'Chat'}
          </Text>
          {status ? (
            <Text style={styles.status} numberOfLines={1}>
              {status}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        {callActions.map(({ Icon, onPress }, index) => (
          <TouchableOpacity key={index} onPress={onPress} style={styles.actionBtn}>
            <Icon size={18} color={colorss.white} />
          </TouchableOpacity>
        ))}
        {onMorePress && (
          <TouchableOpacity onPress={onMorePress} style={styles.actionBtn}>
            <MoreVertical size={18} color={colorss.white} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default React.memo(MessageHeader);

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
  avatarPlaceholder: {
    height: 38,
    width: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: colorss.white,
    fontSize: 14,
    fontWeight: '700',
  },
  nameBlock: {
    gap: 1,
    flex: 1,
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
