import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackHeader from '../components/BackHeader';
import { colorss } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
import React from 'react';

type Props = NativeStackScreenProps<
  RootStackNavigatorParamList,
  'PinnedMessages'
>;

const PinnedMessagesScreen: React.FC<Props> = ({ navigation }) => (
  <SafeAreaView style={styles.screen}>
    <BackHeader title="Pinned messages" navigation={navigation} />
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBox}>
        <Text style={styles.emptyIconText}>📌</Text>
      </View>
      <Text style={styles.emptyTitle}>No pinned messages</Text>
      <Text style={styles.emptySubtitle}>
        Messages pinned from this chat will appear here.
      </Text>
    </View>
  </SafeAreaView>
);

export default PinnedMessagesScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIconBox: {
    width: 110,
    height: 110,
    borderRadius: 26,
    backgroundColor: colorss.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIconText: { fontSize: 48 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colorss.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colorss.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
