import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { Check, X } from 'lucide-react-native';

import { colorss } from '../../theme';
import { IC_PROFILE } from '../../assets';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  selectAuthToken,
  selectHopenityProfile,
  selectActivePage,
  setActivePage,
} from '../../redux/features/auth/authSlice';
import { fetchMyPages, type OwnedPage } from '../../services/pageService';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function PageSwitcherModal({ visible, onClose }: Props) {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAuthToken);
  const profile = useAppSelector(selectHopenityProfile);
  const activePage = useAppSelector(selectActivePage);

  const [pages, setPages] = useState<OwnedPage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !token) return;
    setLoading(true);
    fetchMyPages(token).then(p => {
      setPages(p);
      setLoading(false);
    });
  }, [visible, token]);

  const select = useCallback(
    (page: OwnedPage | null) => {
      dispatch(setActivePage(page));
      onClose();
    },
    [dispatch, onClose],
  );

  const isPersonal = activePage === null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>Switch Account</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color={colorss.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Personal account row */}
        <TouchableOpacity
          style={[styles.row, isPersonal && styles.rowActive]}
          onPress={() => select(null)}
          activeOpacity={0.7}
        >
          <FastImage
            source={profile?.avatarUrl ? { uri: profile.avatarUrl } : IC_PROFILE}
            style={styles.avatar}
          />
          <View style={styles.info}>
            <Text style={styles.name}>{profile?.displayName ?? 'Personal account'}</Text>
            <Text style={styles.sub}>Personal</Text>
          </View>
          {isPersonal && <Check size={18} color={colorss.primary} />}
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colorss.primary} />
          </View>
        )}

        {pages.map(page => {
          const active = activePage?.id === page.id;
          return (
            <TouchableOpacity
              key={page.id}
              style={[styles.row, active && styles.rowActive]}
              onPress={() => select(page)}
              activeOpacity={0.7}
            >
              <FastImage
                source={page.image ? { uri: page.image } : IC_PROFILE}
                style={styles.avatar}
              />
              <View style={styles.info}>
                <Text style={styles.name}>{page.name}</Text>
                <Text style={styles.sub}>Page</Text>
              </View>
              {active && <Check size={18} color={colorss.primary} />}
            </TouchableOpacity>
          );
        })}

        {!loading && pages.length === 0 && (
          <Text style={styles.empty}>You don't have any pages yet.</Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colorss.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colorss.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colorss.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  rowActive: {
    backgroundColor: `${colorss.primary}10`,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colorss.backgroundDeep,
  },
  info: { flex: 1 },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colorss.textPrimary,
  },
  sub: {
    fontSize: 12,
    color: colorss.textSecondary,
    marginTop: 2,
  },
  loadingRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  empty: {
    color: colorss.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
