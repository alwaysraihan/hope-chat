import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ListRenderItem,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { X } from 'lucide-react-native';

import { colorss } from '../../theme';
import { useAppSelector } from '../../hooks/redux';
import { selectAuthToken } from '../../redux/features/auth/authSlice';
import { fetchMessageReactions } from '../../services/chatService';

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
  /** When given, the list is refreshed from the server so names/avatars are real. */
  chatId?: string;
  messageId?: string;
}

function swapCdnHost(url: string): string {
  if (url.includes('hopenity.nikolacdn.com')) return url.replace('hopenity.nikolacdn.com', 'cdn.hopenity.com');
  if (url.includes('cdn.hopenity.com')) return url.replace('cdn.hopenity.com', 'hopenity.nikolacdn.com');
  return url;
}

//  Component

export default function ReactorList({
  onClose,
  reactors: localReactors = [],
  chatId,
  messageId,
}: ReactorListProps) {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const token = useAppSelector(selectAuthToken);
  const [remote, setRemote] = useState<Reactor[] | null>(null);
  const [failed, setFailed] = useState<Record<string, number>>({});

  // Live reactions only carry userId + emoji, so names/avatars come from the
  // server. Keep showing the live list (so toggles show up) but borrow the
  // fetched profile for each person.
  useEffect(() => {
    if (!chatId || !messageId || !token) return;
    let cancelled = false;
    fetchMessageReactions(chatId, messageId, token).then(rows => {
      if (cancelled) return;
      setRemote(
        rows.map(r => ({
          id: r.userId,
          name: r.userName,
          reaction: r.emoji,
          avatar: r.avatar ?? null,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
    // Refetch when the live count/emoji set changes (someone reacted/unreacted).
  }, [chatId, messageId, token, localReactors.map(r => `${r.id}:${r.reaction}`).join('|')]);

  const reactors = useMemo(() => {
    const profile = new Map((remote ?? []).map(r => [r.id, r]));
    return localReactors.map(r => {
      const p = profile.get(r.id);
      return {
        ...r,
        name: r.name || p?.name || (remote === null && chatId ? '…' : 'Unknown'),
        avatar: r.avatar || p?.avatar || null,
      };
    });
  }, [localReactors, remote]);

  // Swipe the sheet down to dismiss.
  const dragY = useRef(new RNAnimated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) {
          RNAnimated.timing(dragY, { toValue: 600, duration: 160, useNativeDriver: true }).start(
            () => onCloseRef.current?.(),
          );
        } else {
          RNAnimated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

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
        {item.avatar && (failed[item.id] ?? 0) < 2 ? (
          <Image
            source={{ uri: failed[item.id] ? swapCdnHost(item.avatar) : item.avatar }}
            style={styles.avatar}
            // The two CDN hosts serve different users; if one 404s try the other
            // before falling back to the initial.
            onError={() => setFailed(f => ({ ...f, [item.id]: (f[item.id] ?? 0) + 1 }))}
          />
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
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <RNAnimated.View style={[styles.sheet, { transform: [{ translateY: dragY }] }]}>
        <View {...pan.panHandlers} style={styles.grabArea}>
          <View style={styles.handle} />
        </View>

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
      </RNAnimated.View>
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
  },
  grabArea: {
    paddingVertical: 8,
    marginBottom: 6,
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
