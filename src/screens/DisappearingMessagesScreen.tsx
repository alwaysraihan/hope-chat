import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { colorss } from '../theme';
import Radio from '../components/Radio';
import BackHeader from '../components/BackHeader';

const DisappearingMessagesScreen = ({ navigation }) => {
  const [selected, setSelected] = useState('off');

  const options = [
    { id: 'off', label: 'Off' },
    { id: '24h', label: '24 hours' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title="Disappearing messages" navigation={navigation} />

      {/* CONTENT */}
      <View style={styles.content}>
        {options.map(opt => {
          const active = selected === opt.id;

          return (
            <TouchableOpacity
              key={opt.id}
              style={styles.optionRow}
              onPress={() => setSelected(opt.id)}
              activeOpacity={0.7}
            >
              <Radio
                key={opt.id}
                selected={active}
                onPress={() => setSelected(opt.id)}
              />
              <Text style={styles.optionLabel}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* HINT */}
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            Set a timer for new messages to disappear from the chat.{' '}
          </Text>
          <Text style={styles.learnMore}>Learn more</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default DisappearingMessagesScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  content: {
    paddingTop: 10,
    paddingHorizontal: 20,
    backgroundColor: colorss.white,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },

  /* HINT */
  hintBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },

  hintText: {
    color: colorss.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },

  learnMore: {
    color: colorss.accent,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  optionLabel: { color: colorss.textPrimary, fontSize: 16 },
});
