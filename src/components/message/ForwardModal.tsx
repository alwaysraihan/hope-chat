import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import { X, Check, Send } from 'lucide-react-native';

import { useColors } from '../../hooks/useColors';
import { useChats } from '../../context/ChatsContext';
import type { ConversationSummary } from '../../context/ChatsContext';
import { sendHopenityChatMessage } from '../../services/chatService';
import { useAppSelector } from '../../hooks/redux';
import {
  selectAuthToken,
  selectActivePage,
} from '../../redux/features/auth/authSlice';
import type { ExtendedMessage } from '../types/chat';
import { fonts, spacing, radius } from '../../theme';

const MAX_SELECT = 5;

interface Props {
  message: ExtendedMessage;
  onClose: () => void;
}

const ForwardModal: React.FC<Props> = ({ message, onClose }) => {
  const colorss = useColors();
  const { conversations } = useChats();
  const token = useAppSelector(selectAuthToken);
  const activePage = useAppSelector(selectActivePage);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const forwardText = message.text || '';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.45)',
        },
        sheet: {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '82%',
          paddingTop: 8,
          backgroundColor: colorss.surface,
        },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colorss.border,
          alignSelf: 'center',
          marginBottom: 4,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xl,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colorss.border,
        },
        title: {
          fontSize: 16,
          fontWeight: fonts.semibold,
          color: colorss.textPrimary,
        },
        preview: {
          marginHorizontal: spacing.xl,
          marginTop: 12,
          marginBottom: 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: radius.md,
          borderWidth: 1,
          backgroundColor: colorss.bubbleIn,
          borderColor: colorss.border,
        },
        previewText: {
          fontSize: 13,
          color: colorss.textSecondary,
        },
        limitNote: {
          marginHorizontal: spacing.xl,
          marginTop: 6,
          marginBottom: 2,
          fontSize: 12,
          color: colorss.error,
        },
        item: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm,
          gap: spacing.md,
          borderRadius: radius.md,
          marginHorizontal: 8,
          marginVertical: 2,
        },
        itemSelected: {
          backgroundColor: `${colorss.primary}15`,
        },
        avatar: {
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarFallback: {
          backgroundColor: colorss.primary,
        },
        avatarInitial: {
          color: '#fff',
          fontSize: 18,
          fontWeight: fonts.bold,
        },
        name: {
          flex: 1,
          fontSize: 15,
          fontWeight: fonts.medium,
          color: colorss.textPrimary,
        },
        checkCircle: {
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        checkCircleOff: {
          borderColor: colorss.border,
          backgroundColor: 'transparent',
        },
        checkCircleOn: {
          borderColor: colorss.primary,
          backgroundColor: colorss.primary,
        },
      }),
    [colorss],
  );

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECT) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (selected.size === 0 || !forwardText || sending) return;
    setSending(true);
    const targets = conversations.filter(c => selected.has(c.id));
    await Promise.all(
      targets.map(c =>
        sendHopenityChatMessage(
          c.id,
          forwardText,
          token,
          activePage?.id ?? null,
          c.isGroup,
        ),
      ),
    );
    setSending(false);
    setSent(true);
    setTimeout(onClose, 700);
  }, [selected, forwardText, sending, conversations, token, activePage, onClose]);

  const renderItem = useCallback(
    ({ item }: { item: ConversationSummary }) => {
      const isSelected = selected.has(item.id);
      const initial = (item.name ?? '?').trim().charAt(0).toUpperCase() || '?';
      return (
        <TouchableOpacity
          style={[styles.item, isSelected && styles.itemSelected]}
          onPress={() => toggle(item.id)}
          activeOpacity={0.7}
        >
          {item.avatarUrl ? (
            <FastImage source={{ uri: item.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <View
            style={[
              styles.checkCircle,
              isSelected ? styles.checkCircleOn : styles.checkCircleOff,
            ]}
          >
            {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
          </View>
        </TouchableOpacity>
      );
    },
    [selected, styles, toggle],
  );

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={22} color={colorss.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.title}>Forward to…</Text>
            <TouchableOpacity
              onPress={handleSend}
              disabled={selected.size === 0 || sending || sent}
              hitSlop={8}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colorss.primary} />
              ) : sent ? (
                <Check size={22} color={colorss.success} />
              ) : (
                <Send
                  size={22}
                  color={selected.size > 0 ? colorss.primary : colorss.border}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Message preview */}
          {!!forwardText && (
            <View style={styles.preview}>
              <Text style={styles.previewText} numberOfLines={2}>
                {forwardText}
              </Text>
            </View>
          )}

          {/* Max-selection warning */}
          {selected.size >= MAX_SELECT && (
            <Text style={styles.limitNote}>
              Max {MAX_SELECT} conversations
            </Text>
          )}

          {/* Conversation list */}
          <FlatList
            data={conversations}
            keyExtractor={c => c.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 16, paddingTop: 8 }}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default ForwardModal;
