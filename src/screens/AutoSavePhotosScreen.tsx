import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackHeader from '../components/BackHeader';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { colorss } from '../theme';
import { getAutoSavePhotos, setAutoSavePhotos } from '../services/chatPrefs';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';
import { patchUserSettings } from '../services/userSettingsService';

const AutoSavePhotosScreen = ({ navigation }: { navigation: any }) => {
  const token = useAppSelector(selectAuthToken);
  const [enabled, setEnabled] = useState(() => getAutoSavePhotos());

  const handleToggle = (value: boolean) => {
    setEnabled(value);
    setAutoSavePhotos(value);
    if (token) {
      patchUserSettings({ autoSavePhotos: value }, token);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <BackHeader title="Auto-save photos" navigation={navigation} />
      <View style={styles.settingsSection}>
        <View style={styles.settingsRow}>
          <View style={styles.settingsRowContent}>
            <Text style={styles.settingsTitle}>Save photos that you receive</Text>
            <Text style={styles.settingsSubtitle}>
              {enabled
                ? 'Photos you receive will be automatically saved to your device gallery.'
                : 'Photos are not auto-saved. You can still download them manually by long-pressing an image.'}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: colorss.border, true: colorss.accent }}
            thumbColor={colorss.white}
            ios_backgroundColor={colorss.border}
          />
        </View>
      </View>
      <Text style={styles.hint}>
        You can always download individual photos by long-pressing an image in any chat.
      </Text>
    </SafeAreaView>
  );
};

export default AutoSavePhotosScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colorss.background },
  settingsSection: {
    marginHorizontal: 16,
    backgroundColor: colorss.white,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colorss.border,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsRowContent: { flex: 1, paddingRight: 12 },
  settingsTitle: { fontSize: 16, fontWeight: '500', color: colorss.textPrimary },
  settingsSubtitle: {
    fontSize: 13,
    color: colorss.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  hint: {
    fontSize: 12,
    color: colorss.textSecondary,
    marginHorizontal: 20,
    marginTop: 12,
    lineHeight: 18,
  },
});
