import { SafeAreaView } from 'react-native-safe-area-context';
import BackHeader from '../components/BackHeader';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { colorss } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
type Props = NativeStackScreenProps<
  RootStackNavigatorParamList,
  'NotificationsSounds'
>;

const NotificationsSoundsScreen: React.FC<Props> = ({ navigation }) => {
  const [toggles, setToggles] = useState({
    on: true,
    messages: true,
    reactions: true,
    calls: true,
  });

  const toggle = key => setToggles(prev => ({ ...prev, [key]: !prev[key] }));

  const rows2 = [
    { key: 'messages', label: 'Messages' },
    { key: 'reactions', label: 'Reactions' },
    { key: 'calls', label: 'Calls' },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <BackHeader title="Notifications & sounds" navigation={navigation} />
      <ScrollView>
        <View style={styles.settingsSection}>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsTitle}>On</Text>
            <Switch
              value={toggles.on}
              onValueChange={() => toggle('on')}
              trackColor={{ false: colorss.border, true: colorss.accent }}
              thumbColor={colorss.white}
              ios_backgroundColor={colorss.border}
            />
          </View>
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomWidth: 0 }]}
          >
            <View style={styles.settingsRowContent}>
              <Text style={styles.settingsTitle}>Customise notifications</Text>
              <Text style={styles.settingsSubtitle}>
                Sound and appearance options
              </Text>
            </View>
            <Text style={{ color: colorss.textSecondary, fontSize: 18 }}>
              ›
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingsSection}>
          {rows2.map((item, i) => (
            <View
              key={item.key}
              style={[
                styles.settingsRow,
                i === rows2.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={styles.settingsTitle}>{item.label}</Text>
              <Switch
                value={toggles[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: colorss.border, true: colorss.accent }}
                thumbColor={colorss.white}
                ios_backgroundColor={colorss.border}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationsSoundsScreen;

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
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
    justifyContent: 'space-between',
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
