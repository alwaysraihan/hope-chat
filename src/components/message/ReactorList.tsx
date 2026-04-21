import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { X } from 'lucide-react-native';

const colorss = {
  surface: '#fff',
  textPrimary: '#111',
  primary: '#4F46E5',
};

const IC_PROFILE = {
  uri: 'https://i.pravatar.cc/100',
};

const DATA = [
  { id: '1', name: 'Emon Hossain', reaction: '❤️' },
  { id: '2', name: 'John Doe', reaction: '😂' },
  { id: '3', name: 'Alex', reaction: '👍' },
  { id: '4', name: 'Sam', reaction: '❤️' },
  { id: '5', name: 'David', reaction: '👍' },
  { id: '6', name: 'Emon Hossain', reaction: '❤️' },
  { id: '7', name: 'John Doe', reaction: '😂' },
  { id: '8', name: 'Alex', reaction: '👍' },
  { id: '9', name: 'Sam', reaction: '❤️' },
];

export default function ReactorList({ onClose }: { onClose?: () => void }) {
  const [activeFilter, setActiveFilter] = useState('ALL');

  const reactionsSummary = [
    { key: 'ALL', label: 'All' },
    { key: '❤️', label: '❤️ 2' },
    { key: '😂', label: '😂 1' },
    { key: '👍', label: '👍 2' },
  ];

  const filteredData =
    activeFilter === 'ALL'
      ? DATA
      : DATA.filter(item => item.reaction === activeFilter);

  return (
    <Animated.View style={styles.overlay}>
      <View style={styles.sheet}>
        {/* HANDLE */}
        <View style={styles.handle} />

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>Reactions</Text>
          <Pressable onPress={onClose}>
            <X size={20} color={colorss.textPrimary} />
          </Pressable>
        </View>

        {/* LIST */}
        <FlatList
          data={filteredData}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.userInfo}>
                <Image source={IC_PROFILE} style={styles.avatar} />
                <Text style={styles.name}>{item.name}</Text>
              </View>
              <Text style={styles.emoji}>{item.reaction}</Text>
            </View>
          )}
        />

        {/* FOOTER */}
        <View style={styles.footer}>
          {reactionsSummary.map(item => {
            const isActive = activeFilter === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() => setActiveFilter(item.key)}
                style={[styles.chip, isActive && styles.activeChip]}
              >
                <Text
                  style={[styles.chipText, isActive && styles.activeChipText]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end', // 🔥 push to bottom
    backgroundColor: 'rgba(0,0,0,0.4)', // backdrop
  },

  sheet: {
    height: '40%', // ✅ fixed height
    backgroundColor: colorss.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },

  handle: {
    width: 80,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },

  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colorss.textPrimary,
  },

  list: {
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  name: {
    fontSize: 14,
    color: colorss.textPrimary,
  },

  emoji: {
    fontSize: 20,
  },

  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#ddd',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  chipText: {
    fontSize: 13,
    color: '#555',
  },

  activeChip: {
    backgroundColor: colorss.primary,
  },

  activeChipText: {
    color: '#fff',
    fontWeight: '600',
  },
});
