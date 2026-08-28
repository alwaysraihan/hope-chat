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

import { colorss } from '../../theme';

//  Types

interface Reactor {
  id: string;
  name: string;
  reaction: string;
  avatar?: string | null;
}

interface ReactorListProps {
  onClose?: () => void;
  reactors?: Reactor[];
}

//  Component

export default function ReactorList({
  onClose,
  reactors = [],
}: ReactorListProps) {
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
    activeFilter === 'ALL'
      ? reactors
      : reactors.filter(r => r.reaction === activeFilter);

  const renderItem: ListRenderItem<Reactor> = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.userInfo}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          // Initials, not a stock photo — the old placeholder pulled a random
          // stranger's face from i.pravatar.cc and showed it as the reactor.
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>
              {item.name.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
      <Text style={styles.emoji}>{item.reaction}</Text>
    </View>
  );

  const isEmpty = reactors.length === 0;

  return (
    <Animated.View entering={FadeInUp.duration(250)} style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>Reactions</Text>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={colorss.textPrimary} />
          </Pressable>
        </View>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {filterOptions.map(opt => (
            <Pressable
              key={opt.key}
              onPress={() => setActiveFilter(opt.key)}
              style={[
                styles.chip,
                activeFilter === opt.key && styles.activeChip,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  activeFilter === opt.key && styles.activeChipText,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={filtered}
          // A person can only hold one reaction, but include the emoji so a
          // malformed payload with duplicates still yields unique keys.
          keyExtractor={item => `${item.id}_${item.reaction}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            isEmpty ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No reactions yet.</Text>
              </View>
            ) : null
          }
        />
      </View>
    </Animated.View>
  );
}

//  Styles

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    height: '45%',
    backgroundColor: colorss.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colorss.border,
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
    color: colorss.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  chip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 999,
    backgroundColor: colorss.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    color: colorss.textSecondary,
    fontWeight: '500',
  },
  activeChip: {
    backgroundColor: colorss.success,
  },
  activeChipText: {
    color: colorss.white,
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
    backgroundColor: colorss.border,
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
  avatarFallback: {
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  name: {
    fontSize: 14,
    color: colorss.textPrimary,
    fontWeight: '500',
  },
  emoji: {
    fontSize: 22,
  },
});
