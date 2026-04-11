import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, colorss, fonts, radius, spacing } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
import { ArrowLeft, EllipsisVertical, X } from 'lucide-react-native';
import { conversations } from '../data/mockData';
import { IC_PROFILE } from '../assets';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Archive'>;

const ArchiveScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color={colorss.textPrimary} />
          <Text style={styles.headerTitle}>Archive</Text>
        </TouchableOpacity>

        <TouchableOpacity>
          <EllipsisVertical size={22} color={colorss.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* LIST */}
      <FlatList
        data={conversations}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.container} activeOpacity={0.7}>
            {/* AVATAR */}
            <View style={styles.avatarWrap}>
              <Image source={IC_PROFILE} style={styles.avatar} />
              {item.isOnline && <View style={styles.onlineDot} />}
            </View>

            {/* BODY */}
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

            {/* RIGHT ACTION */}
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

  /* LIST */
  listContent: {
    gap: 10,
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
