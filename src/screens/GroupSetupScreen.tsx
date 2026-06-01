import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colorss } from '../theme';
import { useColors } from '../hooks/useColors';
import FastImage from '@d11/react-native-fast-image';
import { Camera } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';


import BackHeader from '../components/BackHeader';
import { IC_PROFILE } from '../assets';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';
import { createGroup, uploadGroupPhoto } from '../services/groupService';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'GroupSetup'>;

const GroupSetupScreen: React.FC<Props> = ({ navigation, route }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colorss = useColors(); // dynamic dark/light — shadows the static import above
  const { selectedUserIds, selectedNames } = route.params;
  const token = useAppSelector(selectAuthToken);

  const [groupName, setGroupName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handlePickPhoto = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });
    if (res.didCancel || !res.assets?.[0]?.uri) return;
    setPhotoUri(res.assets[0].uri ?? null);
  };

  const handleCreate = async () => {
    const name = groupName.trim();
    if (!name) {
      Alert.alert('Group name required', 'Please enter a name for the group.');
      return;
    }
    if (!token) return;
    setBusy(true);
    try {
      let resolvedPhotoUrl: string | undefined;
      if (photoUri) {
        const uploaded = await uploadGroupPhoto(photoUri, token);
        resolvedPhotoUrl = uploaded ?? undefined;
      }
      const result = await createGroup(
        name,
        selectedUserIds,
        token,
      );
      if (!result) {
        Alert.alert('Error', 'Could not create the group. Please try again.');
        return;
      }
      // Navigate into the new group chat
      navigation.reset({
        index: 1,
        routes: [
          { name: 'BottomTab' },
          {
            name: 'Inbox',
            params: {
              conversationId: result.conversationId,
              displayName: name,
              avatarUrl: resolvedPhotoUrl ?? null,
            },
          },
        ],
      });
    } finally {
      setBusy(false);
    }
  };

  const preview = selectedNames.slice(0, 3).join(', ') +
    (selectedNames.length > 3 ? ` +${selectedNames.length - 3} more` : '');

  return (
    <SafeAreaView style={styles.safe}>
      <BackHeader title="New Group" navigation={navigation} />

      <View style={styles.content}>
        {/* Photo picker */}
        <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto}>
          <FastImage
            source={photoUri ? { uri: photoUri } : IC_PROFILE}
            style={styles.photoImg}
            resizeMode={FastImage.resizeMode.cover}
          />
          <View style={styles.cameraOverlay}>
            <Camera size={20} color={colorss.white} />
          </View>
        </TouchableOpacity>

        {/* Group name */}
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            placeholder="Group name"
            placeholderTextColor={colorss.placeholder}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={60}
            autoFocus
          />
        </View>

        {/* Members preview */}
        <Text style={styles.memberPreview}>{preview}</Text>

        {/* Create button */}
        <TouchableOpacity
          style={[styles.createBtn, busy && styles.createBtnBusy]}
          onPress={handleCreate}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colorss.white} />
          ) : (
            <Text style={styles.createText}>Create Group</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default GroupSetupScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  photoPicker: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 28,
  },
  photoImg: {
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
  nameRow: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
    marginBottom: 16,
  },
  nameInput: {
    fontSize: 18,
    color: colorss.textPrimary,
    paddingVertical: 10,
    fontWeight: '500',
  },
  memberPreview: {
    color: colorss.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 40,
  },
  createBtn: {
    width: '100%',
    backgroundColor: colorss.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnBusy: {
    opacity: 0.6,
  },
  createText: {
    color: colorss.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
