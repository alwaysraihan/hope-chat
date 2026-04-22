import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ListRenderItem,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { X } from 'lucide-react-native';

interface Reactor {
  id: string;
  name: string;
  reaction: string;
  avatar?: string;
}

interface ReactorListProps {
  onClose?: () => void;
  reactors?: Reactor[];
}

const DEFAULT_DATA: Reactor[] = [
  { id: '1', name: 'Emon Hossain', reaction: '❤️' },
  { id: '2', name: 'John Doe', reaction: '😂' },
  { id: '3', name: 'Alex', reaction: '👍' },
  { id: '4', name: 'Sam', reaction: '❤️' },
  { id: '5', name: 'David', reaction: '👍' },
];

const AVATAR_PLACEHOLDER = { uri: 'https://i.pravatar.cc/100' };

export default function ReactorList({ onClose, reactors = DEFAULT_DATA }: ReactorListProps) {
  const [activeFilter, setActiveFilter] = useState('ALL');

  const reactionGroups = reactors.reduce<Record<string, number>>((acc, r) => {
    acc[r.reaction] = (acc[r.reaction] ?? 0) + 1;
    return acc;
  }, {});

  const filterOptions = [
    { key: 'ALL', label: `All ${reactors.length}` },
    ...Object.entries(reactionGroups).map(([emoji, count]) => ({
      key: emoji,
      label: `${emoji} ${count}`,
    })),
  ];

  const filtered =
    activeFilter === 'ALL' ? reactors : reactors.filter(r => r.reaction === activeFilter);

  const renderItem: ListRenderItem<Reactor> = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.userInfo}>
        <Image
          source={item.avatar ? { uri: item.avatar } : AVATAR_PLACEHOLDER}
          style={styles.avatar}
        />
        <Text style={styles.name}>{item.name}</Text>
      </View>
      <Text style={styles.emoji}>{item.reaction}</Text>
    </View>
  );

  return (
    <Animated.View entering={FadeInUp.duration(250)} style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>Reactions</Text>
          <Pressable onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} color="#111B21" />
          </Pressable>
        </View>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {filterOptions.map(opt => (
            <Pressable
              key={opt.key}
              onPress={() => setActiveFilter(opt.key)}
              style={[styles.chip, activeFilter === opt.key && styles.activeChip]}
            >
              <Text style={[styles.chipText, activeFilter === opt.key && styles.activeChipText]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    height: '45%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111B21',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E9EDEF',
  },
  chip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#F0F2F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    color: '#667781',
    fontWeight: '500',
  },
  activeChip: {
    backgroundColor: '#00A884',
  },
  activeChipText: {
    color: '#fff',
    fontWeight: '700',
  },
  list: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E9EDEF',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  name: {
    fontSize: 14,
    color: '#111B21',
    fontWeight: '500',
  },
  emoji: {
    fontSize: 22,
  },
});
