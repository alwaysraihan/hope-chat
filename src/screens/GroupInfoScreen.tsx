import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colorss } from '../theme';
import { useColors } from '../hooks/useColors';
import FastImage from '@d11/react-native-fast-image';
import {
  Camera,
  ChevronRight,
  Crown,
  LogOut,
  UserMinus,
  UserPlus,
} from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';


import BackHeader from '../components/BackHeader';
import { IC_PROFILE } from '../assets';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import {
  selectAuthToken,
  selectHopenityProfile,
} from '../redux/features/auth/authSlice';
import {
  fetchGroupInfo,
  GroupInfo,
  GroupMember,
  leaveGroup,
  removeGroupMember,
  setGroupMemberAdmin,
  updateGroupInfo,
  uploadGroupPhoto,
} from '../services/groupService';
import { normalizeChatUserId } from '../utils/chatUserId';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'GroupInfo'>;

const GroupInfoScreen: React.FC<Props> = ({ navigation, route }) => {
  const colorss = useColors();
  const { groupId, conversationId } = route.params;
  const token = useAppSelector(selectAuthToken);
  const profile = useAppSelector(selectHopenityProfile);
  const myUserId = normalizeChatUserId(profile?.userId) ?? '';

  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = groupInfo?.members.some(
    m => normalizeChatUserId(m.userId) === myUserId && m.isAdmin,
  ) ?? false;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const info = await fetchGroupInfo(groupId, token);
    setGroupInfo(info);
    setLoading(false);
  }, [groupId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePickPhoto = async () => {
    if (!isAdmin || !token) return;
    const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (res.didCancel || !res.assets?.[0]?.uri) return;
    const uri = res.assets[0].uri!;
    setSaving(true);
    const uploaded = await uploadGroupPhoto(uri, token);
    if (uploaded) {
      await updateGroupInfo(groupId, { photoUrl: uploaded }, token);
      void load();
    } else {
      Alert.alert('Upload failed', 'Could not upload photo. Try again.');
    }
    setSaving(false);
  };

  const handleSaveName = async () => {
    const name = nameInput.trim();
    if (!name || !token) return;
    setSaving(true);
    const ok = await updateGroupInfo(groupId, { name }, token);
    if (ok) {
      setGroupInfo(prev => (prev ? { ...prev, name } : prev));
      setEditingName(false);
    } else {
      Alert.alert('Error', 'Could not update group name.');
    }
    setSaving(false);
  };

  const handleRemoveMember = (member: GroupMember) => {
    if (!token) return;
    Alert.alert(
      'Remove member',
      `Remove ${member.name ?? member.userId} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const ok = await removeGroupMember(groupId, member.userId, token);
            if (ok) {
              setGroupInfo(prev =>
                prev
                  ? { ...prev, members: prev.members.filter(m => m.userId !== member.userId) }
                  : prev,
              );
            } else {
              Alert.alert('Error', 'Could not remove member.');
            }
          },
        },
      ],
    );
  };

  const handleToggleAdmin = (member: GroupMember) => {
    if (!token) return;
    const action = member.isAdmin ? 'Remove admin' : 'Make admin';
    Alert.alert(
      action,
      `${action} for ${member.name ?? member.userId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          onPress: async () => {
            const ok = await setGroupMemberAdmin(groupId, member.userId, !member.isAdmin, token);
            if (ok) {
              setGroupInfo(prev =>
                prev
                  ? {
                      ...prev,
                      members: prev.members.map(m =>
                        m.userId === member.userId ? { ...m, isAdmin: !m.isAdmin } : m,
                      ),
                    }
                  : prev,
              );
            } else {
              Alert.alert('Error', 'Could not update role.');
            }
          },
        },
      ],
    );
  };

  const handleLeave = () => {
    if (!token) return;
    Alert.alert(
      'Leave group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const ok = await leaveGroup(groupId, token);
            if (ok) {
              navigation.reset({
                index: 0,
                routes: [{ name: 'BottomTab' }],
              });
            } else {
              Alert.alert('Error', 'Could not leave the group.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <BackHeader title="Group Info" navigation={navigation} />
        <View style={styles.center}>
          <ActivityIndicator color={colorss.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!groupInfo) {
    return (
      <SafeAreaView style={styles.safe}>
        <BackHeader title="Group Info" navigation={navigation} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load group info.</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <BackHeader title="Group Info" navigation={navigation} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Group photo + name */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.photoWrap}
            onPress={handlePickPhoto}
            disabled={!isAdmin || saving}
          >
            <FastImage
              source={
                groupInfo.photoUrl ? { uri: groupInfo.photoUrl } : IC_PROFILE
              }
              style={styles.groupPhoto}
              resizeMode={FastImage.resizeMode.cover}
            />
            {isAdmin && (
              <View style={styles.cameraOverlay}>
                <Camera size={18} color={colorss.white} />
              </View>
            )}
          </TouchableOpacity>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                maxLength={60}
                onSubmitEditing={handleSaveName}
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveName}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colorss.white} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingName(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                if (!isAdmin) return;
                setNameInput(groupInfo.name);
                setEditingName(true);
              }}
              disabled={!isAdmin}
            >
              <Text style={styles.groupName}>{groupInfo.name}</Text>
              {isAdmin && (
                <Text style={styles.tapToEdit}>Tap to edit</Text>
              )}
            </TouchableOpacity>
          )}

          <Text style={styles.memberCount}>
            {groupInfo.members.length} member
            {groupInfo.members.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Add members (admin only) */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() =>
              navigation.navigate('AddGroupMembers', {
                groupId,
                existingMemberIds: groupInfo.members.map(m => m.userId),
              })
            }
          >
            <View style={[styles.actionIcon, { backgroundColor: '#e8f4fd' }]}>
              <UserPlus size={20} color={colorss.accent} />
            </View>
            <Text style={styles.actionText}>Add Members</Text>
            <ChevronRight size={18} color={colorss.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Members list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {groupInfo.members.map(member => {
            const isSelf = normalizeChatUserId(member.userId) === myUserId;
            return (
              <View key={member.userId} style={styles.memberRow}>
                <FastImage
                  source={member.image ? { uri: member.image } : IC_PROFILE}
                  style={styles.memberAvatar}
                  resizeMode={FastImage.resizeMode.cover}
                />
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.name ?? member.userId}
                      {isSelf ? ' (You)' : ''}
                    </Text>
                    {member.isAdmin && (
                      <View style={styles.adminBadge}>
                        <Crown size={11} color={colorss.accent} />
                        <Text style={styles.adminBadgeText}>Admin</Text>
                      </View>
                    )}
                  </View>
                </View>
                {isAdmin && !isSelf && (
                  <View style={styles.memberActions}>
                    <TouchableOpacity
                      style={styles.memberActionBtn}
                      onPress={() => handleToggleAdmin(member)}
                    >
                      <Crown
                        size={18}
                        color={member.isAdmin ? colorss.accent : colorss.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.memberActionBtn}
                      onPress={() => handleRemoveMember(member)}
                    >
                      <UserMinus size={18} color={colorss.error} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Leave group */}
        <TouchableOpacity style={styles.leaveRow} onPress={handleLeave}>
          <LogOut size={20} color={colorss.error} />
          <Text style={styles.leaveText}>Leave Group</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default GroupInfoScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  scroll: {
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colorss.textSecondary,
    fontSize: 15,
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colorss.accent,
    borderRadius: 8,
  },
  retryText: {
    color: colorss.white,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
  },
  photoWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 16,
  },
  groupPhoto: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colorss.backgroundDeep,
  },
  cameraOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colorss.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupName: {
    fontSize: 20,
    fontWeight: '700',
    color: colorss.textPrimary,
    textAlign: 'center',
  },
  tapToEdit: {
    color: colorss.accent,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  memberCount: {
    color: colorss.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colorss.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: colorss.accent,
    paddingVertical: 4,
  },
  saveBtn: {
    backgroundColor: colorss.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveBtnText: {
    color: colorss.white,
    fontWeight: '600',
    fontSize: 13,
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cancelBtnText: {
    color: colorss.textSecondary,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
    gap: 14,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colorss.textPrimary,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colorss.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colorss.backgroundDeep,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
    color: colorss.textPrimary,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e8f4fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    color: colorss.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 4,
  },
  memberActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginTop: 20,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: colorss.border,
  },
  leaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: colorss.error,
  },
});
