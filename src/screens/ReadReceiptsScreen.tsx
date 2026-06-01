import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useColors } from '../hooks/useColors';
import BackHeader from '../components/BackHeader';
import { RootStackNavigatorParamList } from '../types/navigators';
import { getReadReceipts, setReadReceipts } from '../services/chatPrefs';
import { patchUserSettings } from '../services/userSettingsService';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'ReadReceipts'>;

const ReadReceiptsScreen: React.FC<Props> = ({ navigation }) => {
  const colorss = useColors();
  const token = useAppSelector(selectAuthToken);
  const [enabled, setEnabled] = useState(() => getReadReceipts());

  const styles = useMemo(() => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colorss.background },
    content: { padding: 20 },
    row: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 14, paddingVertical: 4,
    },
    label: { color: colorss.textPrimary, fontSize: 16, fontWeight: '500' },
    desc: { color: colorss.textSecondary, fontSize: 13, lineHeight: 20 },
  }), [colorss]);

  const handleToggle = (value: boolean) => {
    setEnabled(value);
    setReadReceipts(value);
    if (token) patchUserSettings({ readReceipts: value }, token);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title="Read receipts" navigation={navigation} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.label}>Show read receipts</Text>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: colorss.border, true: colorss.primary }}
            thumbColor={colorss.white}
            ios_backgroundColor={colorss.border}
          />
        </View>
        <Text style={styles.desc}>
          {enabled
            ? 'Read receipts are on. Other users will see when you have read their messages.'
            : 'Read receipts are off. Others will not see when you have read their messages, and you will not see theirs.'}
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default ReadReceiptsScreen;
