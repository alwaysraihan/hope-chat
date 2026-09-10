import React, { useMemo } from 'react';
import VerifiedBadge from '../VerifiedBadge';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import {
  LucideVideo,
  Phone,
  ChevronLeft,
  MoreVertical,
  Lock,
} from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import FastImage from '@d11/react-native-fast-image';

interface MessageHeaderProps {
  onProfilePress: () => void;
  onBackPress: () => void;
  /** Pass undefined to hide the audio call button (e.g. REQUESTED chats). */
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  /** Fires when the ⋮ button is pressed — show ConversationAction sheet */
  onMorePress?: () => void;
  name: string;
  /** e.g. "Online" or "last seen …" — omit or empty to hide subtitle */
  status?: string;
  avatarUri?: string | null;
  /** Show a lock badge when E2EE is active for this conversation. */
  isEncrypted?: boolean;
  /** Verified Hopenity account — renders the badge right after the name. */
  isVerified?: boolean;
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
  isVerified,
  status,
  avatarUri,
  isEncrypted = false,
}) => {
  const colors = useColors();
  const styles = useMemo(() => stylesFor(colors), [colors]);

  // Both call actions are hidden when undefined (REQUESTED / unaccepted chats)
  const callActions = [
    ...(onAudioCall
      ? [{ Icon: Phone, label: 'Audio Call', onPress: onAudioCall }]
      : []),
    ...(onVideoCall
      ? [{ Icon: LucideVideo, label: 'Video Call', onPress: onVideoCall }]
      : []),
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onBackPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ChevronLeft color={colors.textPrimary} size={22} />
      </TouchableOpacity>

      <TouchableOpacity onPress={onProfilePress} style={styles.profile}>
        {avatarUri ? (
          <FastImage source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>
              {initialsFromName(name)}
            </Text>
          </View>
        )}
        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, styles.nameText]} numberOfLines={1}>
              {name || 'Chat'}
            </Text>
            {isVerified ? <VerifiedBadge size={14} /> : null}
            {isEncrypted && !isVerified ? (
              <Lock size={11} color={colors.textSecondary} style={styles.lockIcon} />
            ) : null}
          </View>
          {status ? (
            <Text style={styles.status} numberOfLines={1}>
              {status}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        {callActions.map(({ Icon, onPress }, index) => (
          <TouchableOpacity
            key={index}
            onPress={onPress}
            style={styles.actionBtn}
          >
            <Icon size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        ))}
        {onMorePress && (
          <TouchableOpacity onPress={onMorePress} style={styles.actionBtn}>
            <MoreVertical size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default React.memo(MessageHeader);

const stylesFor = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
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
      borderColor: colors.border,
    },
    avatarPlaceholder: {
      height: 38,
      width: 38,
      borderRadius: 19,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.white,
    },
    nameBlock: {
      gap: 1,
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    lockIcon: {
      marginTop: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.1,
      color: colors.textPrimary,
    },
    // Long names shrink around the badge rather than pushing it out of the row.
    nameText: {
      flexShrink: 1,
    },
    status: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    actionBtn: {
      padding: 7,
      backgroundColor: colors.border,
      borderRadius: 20,
    },
  });
