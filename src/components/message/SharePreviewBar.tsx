/**
 * Pending-share bar — a Hopenity post handed over by the share sheet.
 *
 * Sits directly above the composer showing what is about to be sent, with a
 * Send button and a dismiss (x). The deep link deliberately does NOT send the
 * message: arriving in a conversation to find you have already posted someone's
 * content is the kind of mistake you cannot take back, so the confirm step
 * lives here, where the user can also type a note first.
 */
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Send, X } from 'lucide-react-native';

import { useAppTheme } from '../../context/ThemeContext';

export type PendingShare = {
  url: string;
  postId?: string | null;
  text?: string | null;
  image?: string | null;
};

type Props = {
  share: PendingShare;
  sending?: boolean;
  onSend: () => void;
  onDismiss: () => void;
};

export const SharePreviewBar: React.FC<Props> = ({
  share,
  sending,
  onSend,
  onDismiss,
}) => {
  const { colors } = useAppTheme();

  const caption = (share.text ?? '').trim();

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.cardBg, borderTopColor: colors.border },
      ]}>
      {share.image ? (
        <Image source={{ uri: share.image }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.background }]} />
      )}

      <View style={styles.info}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Sharing a post
        </Text>
        <Text style={[styles.caption, { color: colors.textPrimary }]} numberOfLines={2}>
          {caption || share.url}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onDismiss}
        disabled={sending}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel="Cancel sharing this post">
        <X size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onSend}
        disabled={sending}
        style={[
          styles.sendBtn,
          { backgroundColor: colors.accent, opacity: sending ? 0.6 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Send this post">
        <Send size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  info: { flex: 1 },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  caption: { fontSize: 13, marginTop: 2 },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SharePreviewBar;
