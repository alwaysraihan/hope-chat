import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, colorss, fonts, radius, spacing } from '../theme';
import { useT } from '../hooks/useT';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
import { ArrowLeft, EllipsisVertical, X } from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';
import type { ConversationSummary } from '../context/ChatsContext';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Archive'>;

/** Placeholder until archive folder is wired to the Hopenity API. */
const ArchiveScreen: React.FC<Props> = ({ navigation }) => {
  const t = useT();
  const archived: ConversationSummary[] = useMemo(() => [], []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color={colorss.textPrimary} />
          <Text style={styles.headerTitle}>{t.archive}</Text>
        </TouchableOpacity>

        <TouchableOpacity>
          <EllipsisVertical size={22} color={colorss.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={archived}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{t.no_archived_chats}</Text>
            <Text style={styles.emptyBody}>{t.archived_empty_body}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.container} activeOpacity={0.7}>
            <View style={styles.avatarWrap}>
              {item.avatarUrl ? (
                <FastImage source={{ uri: item.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPh]} />
              )}
              {item.isOnline ? <View style={styles.onlineDot} /> : null}
            </View>

            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>

              <View style={styles.topRow}>
                <Text
                  style={[
                    styles.preview,
                    item.isUnread && styles.previewUnread,
                  ]}
                  numberOfLines={1}
                >
                  {item.isTyping ? (
                    <Text style={styles.typingText}>Typing...</Text>
                  ) : (
                    item.preview
                  )}
                </Text>

                <Text style={styles.time}>{item.time}</Text>
              </View>
            </View>

            <View style={styles.rightAction}>
              <TouchableOpacity style={styles.closeBtn}>
                <X size={18} color={colorss.textPrimary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

export default ArchiveScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.background,
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colorss.textPrimary,
  },

  emptyWrap: {
    paddingTop: 48,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: fonts.semibold,
    color: colorss.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: colorss.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  /* LIST */
  listContent: {
    gap: 10,
    flexGrow: 1,
  },

  /* ITEM */
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatarWrap: {
    position: 'relative',
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
  },
  avatarPh: {
    backgroundColor: colorss.border,
  },

  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: radius.full,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.background,
  },

  body: {
    flex: 1,
    marginHorizontal: spacing.md,
    justifyContent: 'center',
  },

  name: {
    fontSize: 15,
    fontWeight: fonts.semibold,
    color: colorss.textPrimary,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // FIXED alignment
    marginTop: 2,
  },

  preview: {
    flex: 1,
    fontSize: 13,
    color: colorss.textSecondary,
    marginRight: 8,
  },

  previewUnread: {
    color: colorss.textPrimary,
    fontWeight: fonts.medium,
  },

  typingText: {
    color: colors.purpleLight,
    fontStyle: 'italic',
    fontSize: 13,
  },

  time: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 6,
  },

  rightAction: {
    justifyContent: 'center',
  },

  closeBtn: {
    padding: 6,
    backgroundColor: colorss.backgroundDeep,
    borderRadius: 99,
  },
});
