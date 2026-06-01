import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colorss } from '../theme';
import { useColors } from '../hooks/useColors';
import { ArrowLeft, X } from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useT } from '../hooks/useT';
import { RootStackNavigatorParamList } from '../types/navigators';
import { IC_PROFILE } from '../assets';
import {
  clearSearchHistory,
  getSearchHistory,
  removeFromSearchHistory,
  type SearchHistoryEntry,
} from '../services/searchHistoryService';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'EditSearchHistory'>;

const EditSearchHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const colorss = useColors();
  const t = useT();
  const [history, setHistory] = useState<SearchHistoryEntry[]>(() => getSearchHistory());

  const handleRemove = useCallback((userId: string) => {
    removeFromSearchHistory(userId);
    setHistory(getSearchHistory());
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear search history',
      'Remove all recent searches?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: () => {
            clearSearchHistory();
            setHistory([]);
          },
        },
      ],
    );
  }, []);

  const renderItem = ({ item }: { item: SearchHistoryEntry }) => (
    <View style={styles.itemContainer}>
      <View style={styles.left}>
        <FastImage
          source={item.image ? { uri: item.image } : IC_PROFILE}
          style={styles.avatar}
          resizeMode={FastImage.resizeMode.cover}
        />
        <View>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {item.username ? (
            <Text style={styles.subtitle}>@{item.username}</Text>
          ) : (
            <Text style={styles.subtitle}>
              {new Date(item.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => handleRemove(item.userId)}
        accessibilityLabel={`Remove ${item.name} from history`}
      >
        <X size={16} color={colorss.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={colorss.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.edit_search_history}</Text>
      </View>

      <Text style={styles.infoText}>{t.edit_search_note}</Text>

      {history.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.recent_searches}</Text>
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearAll}>{t.clear_all}</Text>
          </TouchableOpacity>
        </View>
      )}

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No recent searches to manage.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.userId}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default EditSearchHistoryScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colorss.surface, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, marginBottom: 16, gap: 14 },
  headerTitle: { fontSize: 19, fontWeight: '600', color: colorss.textPrimary },
  infoText: { fontSize: 13, color: colorss.textSecondary, marginBottom: 16, lineHeight: 19 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colorss.textPrimary },
  clearAll: { fontSize: 14, color: colorss.accent, fontWeight: '600' },
  itemContainer: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colorss.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  name: { fontSize: 15, fontWeight: '500', color: colorss.textPrimary, maxWidth: 220 },
  subtitle: { fontSize: 12, color: colorss.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colorss.backgroundDeep,
    justifyContent: 'center', alignItems: 'center',
  },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: colorss.textSecondary, fontSize: 14 },
});
