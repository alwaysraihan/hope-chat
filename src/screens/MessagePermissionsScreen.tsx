import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { colorss } from '../theme';
import BackHeader from '../components/BackHeader';

const MessagePermissionsScreen = ({ navigation }) => {
  const [enabled, setEnabled] = useState(true);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title="Message Permissions" navigation={navigation} />

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.label}>Allow message sharing</Text>

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
          Everyone in this chat can share messages with Meta AI or auto-save
          photos. Messages shared with Meta AI may be used to improve AI at
          Meta. <Text style={styles.link}>Learn more</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default MessagePermissionsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  content: {
    padding: 20,
    backgroundColor: colorss.white,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  label: {
    color: colorss.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },

  desc: {
    color: colorss.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },

  link: {
    color: colorss.accent,
    fontWeight: '500',
  },
});
