import React, { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useColors } from '../hooks/useColors';
import BackHeader from '../components/BackHeader';
import { RootStackNavigatorParamList } from '../types/navigators';
import { getTypingIndicator, setTypingIndicator } from '../services/chatPrefs';
import { patchUserSettings } from '../services/userSettingsService';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'TypingIndicator'>;

const TypingIndicatorScreen: React.FC<Props> = ({ navigation }) => {
  const colorss = useColors();
  const token = useAppSelector(selectAuthToken);
  const [enabled, setEnabled] = useState(() => getTypingIndicator());

  const styles = useMemo(() => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colorss.background },
    content: { padding: 20 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
    rowText: { flex: 1 },
    label: { color: colorss.textPrimary, fontSize: 16, fontWeight: '500', marginBottom: 4 },
    subLabel: { color: colorss.textSecondary, fontSize: 13 },
    desc: { color: colorss.textSecondary, fontSize: 13, lineHeight: 20 },
  }), [colorss]);

  const handleToggle = (value: boolean) => {
    setEnabled(value);
    setTypingIndicator(value);
    if (token) patchUserSettings({ typingIndicator: value }, token);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title="Typing indicator" navigation={navigation} />
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Show typing indicator</Text>
            <Text style={styles.subLabel}>
              {enabled ? 'Others can see when you are typing.' : 'Others cannot see when you are typing.'}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: colorss.border, true: colorss.primary }}
            thumbColor={colorss.white}
            ios_backgroundColor={colorss.border}
          />
        </View>
        <Text style={styles.desc}>
          When this is off, you will also not see others' typing indicators.
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default TypingIndicatorScreen;
