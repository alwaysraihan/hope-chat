import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Shield, EyeOff, RotateCcw } from 'lucide-react-native';

import { colorss } from '../theme';
import BackHeader from '../components/BackHeader';

const RESTRICT_ITEMS = [
  {
    Icon: Shield,
    title: 'Limit your interactions',
    desc: 'Your chat will be removed and notifications muted.',
  },
  {
    Icon: EyeOff,
    title: 'Hide your activity',
    desc: "They won't see when you're online or read messages.",
  },
  {
    Icon: RotateCcw,
    title: 'Unrestrict anytime',
    desc: 'You can undo this anytime without notifying them.',
  },
];

const RestrictUserScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title="Restrict user" navigation={navigation} />

      <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
        {/* PROFILE */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>HD</Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
        </View>

        {/* TITLE */}
        <Text style={styles.title}>
          See less of Hossain{'\n'}without blocking them
        </Text>

        {/* FEATURES */}
        <View style={styles.featureList}>
          {RESTRICT_ITEMS.map(({ Icon, title, desc }) => (
            <View key={title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Icon size={18} color={colorss.textPrimary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* BUTTON */}
        <TouchableOpacity style={styles.restrictBtn} activeOpacity={0.85}>
          <Text style={styles.restrictBtnText}>Restrict Hossain</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default RestrictUserScreen;
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  container: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  inner: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  /* PROFILE */
  profileSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },

  avatarWrapper: {
    position: 'relative',
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: colorss.white,
    fontSize: 28,
    fontWeight: '700',
  },

  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colorss.success,
    borderWidth: 2,
    borderColor: colorss.white,
  },

  /* TITLE */
  title: {
    color: colorss.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 27,
    marginBottom: 28,
  },

  /* FEATURES */
  featureList: {
    gap: 20,
    marginBottom: 36,
  },

  featureRow: {
    flexDirection: 'row',
    gap: 14,
  },

  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorss.backgroundDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  featureTitle: {
    color: colorss.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },

  featureDesc: {
    color: colorss.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  /* BUTTON */
  restrictBtn: {
    backgroundColor: colorss.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },

  restrictBtnText: {
    color: colorss.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
