import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import BackHeader from '../components/BackHeader';
import { useColors } from '../hooks/useColors';
import { RootStackNavigatorParamList } from '../types/navigators';
import { getNotifPrefs, setNotifPrefs } from '../services/chatPrefs';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'NotificationsSounds'>;

const NotificationsSoundsScreen: React.FC<Props> = ({ navigation }) => {
  const colorss = useColors();
  const [prefs, setPrefsState] = useState(() => getNotifPrefs());

  const styles = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: colorss.background },
    section: {
      marginHorizontal: 16, backgroundColor: colorss.cardBg,
      borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: colorss.border,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colorss.border,
      justifyContent: 'space-between',
    },
    lastRow: { borderBottomWidth: 0 },
    labelCol: { flex: 1, paddingRight: 12 },
    label: { fontSize: 16, fontWeight: '500', color: colorss.textPrimary },
    sub: { fontSize: 13, color: colorss.textSecondary, marginTop: 3, lineHeight: 17 },
    hint: { fontSize: 12, color: colorss.placeholder, marginHorizontal: 20, marginTop: 10, lineHeight: 17 },
  }), [colorss]);

  const toggle = (key: keyof typeof prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefsState(next);
    setNotifPrefs(next);
  };

  const rows: { key: keyof typeof prefs; label: string; sub: string }[] = [
    { key: 'messages',  label: 'Messages',  sub: 'New message notifications' },
    { key: 'reactions', label: 'Reactions', sub: 'When someone reacts to your message' },
    { key: 'calls',     label: 'Calls',     sub: 'Incoming audio and video calls' },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <BackHeader title="Notifications & sounds" navigation={navigation} />
      <ScrollView>
        <View style={styles.section}>
          <View style={[styles.row, styles.lastRow]}>
            <View style={styles.labelCol}>
              <Text style={styles.label}>Notifications on</Text>
              <Text style={styles.sub}>
                {prefs.enabled ? 'You will receive all enabled notifications.' : 'All notifications silenced.'}
              </Text>
            </View>
            <Switch
              value={prefs.enabled}
              onValueChange={() => toggle('enabled')}
              trackColor={{ false: colorss.border, true: colorss.accent }}
              thumbColor={colorss.white}
              ios_backgroundColor={colorss.border}
            />
          </View>
        </View>

        <View style={styles.section}>
          {rows.map((r, i) => (
            <View key={r.key} style={[styles.row, i === rows.length - 1 && styles.lastRow]}>
              <View style={styles.labelCol}>
                <Text style={[styles.label, !prefs.enabled && { opacity: 0.4 }]}>{r.label}</Text>
                <Text style={[styles.sub, !prefs.enabled && { opacity: 0.4 }]}>{r.sub}</Text>
              </View>
              <Switch
                value={prefs.enabled && prefs[r.key]}
                onValueChange={() => toggle(r.key)}
                disabled={!prefs.enabled}
                trackColor={{ false: colorss.border, true: colorss.accent }}
                thumbColor={colorss.white}
                ios_backgroundColor={colorss.border}
              />
            </View>
          ))}
        </View>

        <Text style={styles.hint}>
          Per-chat muting is available from the long-press menu on any conversation.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationsSoundsScreen;
