import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
} from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';
import { colorss } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';

const data = [
  {
    id: '1',
    name: 'John Doe',
    subtitle: 'Connected',
    avatar: 'https://i.pravatar.cc/150?img=3',
  },
  {
    id: '2',
    name: 'John Doe',
    subtitle: 'Connected',
    avatar: 'https://i.pravatar.cc/150?img=3',
  },
  {
    id: '3',
    name: 'John Doe',
    subtitle: 'Connected',
    avatar: 'https://i.pravatar.cc/150?img=3',
  },
];

type Props = NativeStackScreenProps<
  RootStackNavigatorParamList,
  'EditSearchHistory'
>;

const EditSearchHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <View style={styles.left}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.closeBtn}>
        <X size={18} color={colorss.textPrimary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={colorss.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Edit search history</Text>
      </View>

      {/* Info Text */}
      <Text style={styles.infoText}>
        Changes will only apply to your recent searches list, which is from your
        history on this device.
      </Text>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent searches</Text>

        <TouchableOpacity>
          <Text style={styles.clearAll}>CLEAR ALL</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 10 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default EditSearchHistoryScreen;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorss.surface,
    paddingHorizontal: 16,
    paddingTop: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 15,
    color: colorss.textPrimary,
  },

  infoText: {
    fontSize: 14,
    color: colorss.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colorss.textPrimary,
  },

  clearAll: {
    fontSize: 14,
    color: colorss.accent,
    fontWeight: '600',
  },

  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },

  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 12,
  },

  name: {
    fontSize: 16,
    fontWeight: '500',
    color: colorss.textPrimary,
  },

  subtitle: {
    fontSize: 13,
    color: colorss.textSecondary,
    marginTop: 2,
  },

  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colorss.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
