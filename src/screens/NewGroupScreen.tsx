import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';

import { colorss } from '../theme';
import BackHeader from '../components/BackHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IC_PROFILE } from '../assets';
import { Search } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';

const CONTACTS = [
  { id: '1', name: 'John Deo', verified: false },
  { id: '2', name: 'Devide', verified: false },
  { id: '3', name: 'Trump', verified: false },
  { id: '4', name: 'Putin', verified: false },
  { id: '5', name: 'Kim jong un', verified: false },
  { id: '6', name: 'Xi jing ping', verified: false },
  { id: '7', name: 'Kier Starmar', verified: false },
  { id: '8', name: 'Khamini', verified: true },
];

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'NewGroup'>;

export const NewGroupScreen: React.FC<Props> = ({ navigation }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const toggleContact = (name: string) => {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name],
    );
  };

  const filtered = CONTACTS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <BackHeader title="New Group" navigation={navigation} />

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.chipsRow}>
          {selected.map(name => (
            <TouchableOpacity
              key={name}
              style={styles.chip}
              onPress={() => toggleContact(name)}
            >
              <Text style={styles.chipText}>{name}</Text>
              <Text style={styles.chipX}>×</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchBar}>
          <Search size={20} color={colorss.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={colorss.placeholder}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* List */}
        <View>
          <Text style={styles.section}>Suggested</Text>

          {filtered.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.row}
              onPress={() => toggleContact(item.name)}
            >
              <Image
                source={IC_PROFILE}
                style={styles.avatar}
                resizeMode="cover"
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.name}
                  {item.verified && (
                    <Text style={{ color: colorss.accent }}> ✔</Text>
                  )}
                </Text>
              </View>

              <View
                style={[
                  styles.radio,
                  selected.includes(item.name) && styles.radioSelected,
                ]}
              >
                {selected.includes(item.name) && (
                  <Text style={styles.radioCheck}>✓</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  container: {
    flex: 1,
    paddingHorizontal: 16,
  },

  navbar: {
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

  backIcon: {
    fontSize: 28,
    color: colorss.accent,
  },

  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colorss.textPrimary,
    marginLeft: 8,
  },

  create: {
    color: colorss.accent,
    fontWeight: '600',
    fontSize: 15,
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 12,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorss.backgroundDeep,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },

  chipText: {
    color: colorss.textPrimary,
    fontWeight: '500',
  },

  chipX: {
    color: colorss.textSecondary,
    fontSize: 16,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorss.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colorss.border,
    gap: 8,
  },

  searchIcon: {
    fontSize: 14,
  },

  searchInput: {
    flex: 1,
    color: colorss.textPrimary,
    fontSize: 15,
  },

  section: {
    color: colorss.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },

  name: {
    color: colorss.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },

  avatar: {
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  avatarText: {
    color: colorss.white,
    fontWeight: '700',
  },

  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colorss.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    backgroundColor: colorss.accent,
    borderColor: colorss.accent,
  },

  radioCheck: {
    color: colorss.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
