import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import { ArrowLeft, Link, UserPlus, Users } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { IC_PROFILE } from '../assets';
import { colorss } from '../theme';
import type { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';
import {
  getGroupByInviteCode,
  joinGroupByCode,
  type GroupInvitePreview,
} from '../services/groupService';
import { appendGroupSystemMessage } from '../services/offlineCache';
import { useChats } from '../context/ChatsContext';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'JoinGroup'>;

export default function JoinGroupScreen({ navigation, route }: Props) {
  const { inviteCode } = route.params;
  const token = useAppSelector(selectAuthToken);
  const { reloadConversations } = useChats();

  const [preview, setPreview] = useState<GroupInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    getGroupByInviteCode(inviteCode).then(p => {
      setPreview(p);
      setLoading(false);
    });
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!token || !preview) return;
    setJoining(true);
    const result = await joinGroupByCode(inviteCode, token);
    setJoining(false);

    if (!result) {
      Alert.alert('Error', 'Could not join the group. The link may be invalid or expired.');
      return;
    }

    appendGroupSystemMessage(result.groupId, 'You joined via an invite link.');
    await reloadConversations();

    navigation.reset({
      index: 1,
      routes: [
        { name: 'BottomTab' },
        {
          name: 'Inbox',
          params: {
            conversationId: result.groupId,
            displayName: preview.groupName,
            avatarUrl: preview.groupPhotoUrl,
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colorss.primary} />
      </SafeAreaView>
    );
  }

  if (!preview) {
    return (
      <SafeAreaView style={styles.center}>
        <Link size={44} color={colorss.textSecondary} />
        <Text style={styles.errorTitle}>Invalid invite link</Text>
        <Text style={styles.errorSub}>This link may have expired or been revoked.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.navBack} onPress={() => navigation.goBack()}>
        <ArrowLeft size={22} color={colorss.textPrimary} />
      </TouchableOpacity>

      <View style={styles.card}>
        <FastImage
          source={preview.groupPhotoUrl ? { uri: preview.groupPhotoUrl } : IC_PROFILE}
          style={styles.avatar}
          resizeMode={FastImage.resizeMode.cover}
        />
        <Text style={styles.groupName}>{preview.groupName}</Text>
        <View style={styles.metaRow}>
          <Users size={14} color={colorss.textSecondary} />
          <Text style={styles.meta}>{preview.memberCount} members</Text>
        </View>
        <Text style={styles.linkLabel}>You were invited to join this group</Text>
      </View>

      <TouchableOpacity
        style={[styles.joinBtn, joining && styles.joinBtnDisabled]}
        onPress={handleJoin}
        disabled={joining}
        activeOpacity={0.8}
      >
        {joining ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <UserPlus size={18} color="#fff" />
            <Text style={styles.joinBtnText}>Join Group</Text>
          </>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorss.background, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  navBack: { paddingVertical: 14 },

  card: {
    alignItems: 'center',
    backgroundColor: colorss.white,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colorss.backgroundDeep,
    marginBottom: 16,
  },
  groupName: {
    fontSize: 22,
    fontWeight: '700',
    color: colorss.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  meta: { fontSize: 14, color: colorss.textSecondary },
  linkLabel: { fontSize: 13, color: colorss.textSecondary, textAlign: 'center' },

  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colorss.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  joinBtnDisabled: { opacity: 0.65 },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  errorTitle: { fontSize: 18, fontWeight: '700', color: colorss.textPrimary, marginTop: 16, marginBottom: 8 },
  errorSub: { fontSize: 14, color: colorss.textSecondary, textAlign: 'center', marginBottom: 24 },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colorss.backgroundDeep,
    borderRadius: 10,
  },
  backBtnText: { color: colorss.textPrimary, fontWeight: '600' },
});
