import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colorss } from '../theme';
import BackHeader from '../components/BackHeader';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
type Props = NativeStackScreenProps<
  RootStackNavigatorParamList,
  'TypingIndicator'
>;

const TypingIndicatorScreen: React.FC<Props> = ({ navigation }) => {
  const [enabled, setEnabled] = useState(true);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title="Typing indicator" navigation={navigation} />

      <View style={styles.content}>
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={styles.label}>Show typing indicator</Text>
            <Text style={styles.subLabel}>
              Others can see when you're typing.
            </Text>
          </View>

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
      </View>
    </SafeAreaView>
  );
};

export default TypingIndicatorScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.white,
  },

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

  content: {
    padding: 20,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  label: {
    color: colorss.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 3,
  },

  subLabel: {
    color: colorss.textSecondary,
    fontSize: 13,
  },
});
