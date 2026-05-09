import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';

import { colorss } from '../theme';
import BackHeader from '../components/BackHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';

type Props = NativeStackScreenProps<
  RootStackNavigatorParamList,
  'ReadReceipts'
>;

const ReadReceiptsScreen: React.FC<Props> = ({ navigation }) => {
  const [enabled, setEnabled] = useState(true);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title="Read receipts" navigation={navigation} />

      {/* CONTENT */}
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.label}>Show read receipts</Text>

          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{
              false: colorss.border,
              true: colorss.primary,
            }}
            thumbColor={colorss.white}
            ios_backgroundColor={colorss.border}
          />
        </View>

        <Text style={styles.desc}>
          Arif will be able to see when you've read their messages.
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default ReadReceiptsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  /* NAVBAR */
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colorss.white,
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
  },

  backBtn: {
    padding: 6,
  },

  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colorss.textPrimary,
    marginLeft: 6,
  },

  /* CONTENT */
  content: {
    padding: 20,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  label: {
    color: colorss.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },

  desc: {
    color: colorss.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
