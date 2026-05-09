import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';

import BackHeader from '../components/BackHeader';
import { colorss } from '../theme';

const REPORT_ITEMS = [
  'Harassment',
  'Suicide or self-injury',
  'Pretending to be someone else',
  'Violence or dangerous organisations',
  'Nudity or sexual activity',
  'Selling or promoting restricted items',
  'Scam or fraud',
  'Other',
];

const ReportProblemScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title="Select a problem to report" navigation={navigation} />

      <ScrollView style={styles.container}>
        {/* INFO TEXT */}
        <Text style={styles.subtitle}>
          We won't let the person know who reported them. If someone is in
          immediate danger, call local emergency services. Don't wait.
        </Text>

        {/* LIST */}
        <View style={styles.list}>
          {REPORT_ITEMS.map((item, index) => (
            <React.Fragment key={item}>
              <TouchableOpacity style={styles.item} activeOpacity={0.6}>
                <Text style={styles.itemText}>{item}</Text>

                <ChevronRight size={18} color={colorss.textSecondary} />
              </TouchableOpacity>

              {index < REPORT_ITEMS.length - 1 && (
                <View style={styles.divider} />
              )}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReportProblemScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  container: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  subtitle: {
    color: colorss.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },

  list: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colorss.border,
    backgroundColor: colorss.white,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },

  itemText: {
    color: colorss.textPrimary,
    fontSize: 15,
  },

  divider: {
    height: 1,
    backgroundColor: colorss.border,
    marginLeft: 20,
  },
});
