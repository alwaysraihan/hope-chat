import { SafeAreaView } from 'react-native-safe-area-context';
import BackHeader from '../components/BackHeader';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useState } from 'react';
import { colorss } from '../theme';

const AutoSavePhotosScreen = ({ navigation }) => {
  const [enabled, setEnabled] = useState(false);

  return (
    <SafeAreaView style={styles.screen}>
      <BackHeader title="Auto-save photos" navigation={navigation} />
      <View style={styles.settingsSection}>
        <View style={styles.settingsRow}>
          <View style={styles.settingsRowContent}>
            <Text style={styles.settingsTitle}>
              Save photos that you receive
            </Text>
            <Text style={styles.settingsSubtitle}>
              Automatically save photos you receive in this chat to your device.
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: colorss.border, true: colorss.accent }}
            thumbColor={colorss.white}
            ios_backgroundColor={colorss.border}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AutoSavePhotosScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colorss.white,
  },

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
  settingsTitle: { fontSize: 17, color: colorss.textPrimary },
  settingsSubtitle: {
    fontSize: 13,
    color: colorss.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
});
