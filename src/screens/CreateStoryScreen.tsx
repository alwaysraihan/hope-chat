import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Image as ImageIcon, Type, Send } from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken, selectHopenityProfile } from '../redux/features/auth/authSlice';
import { API_BASE_URL } from '../config/env';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'CreateStory'>;

const BG_COLORS = [
  { bg: '#0084FF', text: '#fff' },
  { bg: '#6C5CE7', text: '#fff' },
  { bg: '#00B894', text: '#fff' },
  { bg: '#E84393', text: '#fff' },
  { bg: '#FF7675', text: '#fff' },
  { bg: '#FDCB6E', text: '#000' },
  { bg: '#2D3436', text: '#fff' },
  { bg: '#00CEC9', text: '#fff' },
  { bg: '#D63031', text: '#fff' },
  { bg: '#55EFC4', text: '#000' },
];

type Mode = 'pick' | 'text' | 'preview';

type MediaPick = {
  uri: string;
  type: 'image' | 'video';
  fileName?: string;
  mimeType?: string;
};

async function uploadStory(
  params: { type: 'TEXT'; content: string; backgroundColor: string } | { type: 'PHOTO' | 'VIDEO'; uri: string; mimeType?: string; fileName?: string },
  token: string,
): Promise<boolean> {
  try {
    const base = API_BASE_URL.replace(/\/+$/, '');
    if (params.type === 'TEXT') {
      const res = await fetch(`${base}/api/v1/stories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'TEXT',
          content: params.content,
          backgroundColor: params.backgroundColor,
          visibility: 'PUBLIC',
        }),
      });
      return res.ok;
    } else {
      const form = new FormData();
      form.append('type', params.type);
      form.append('visibility', 'PUBLIC');
      form.append('media', {
        uri: params.uri,
        type: params.mimeType ?? (params.type === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
        name: params.fileName ?? `story_${Date.now()}`,
      } as any);
      const res = await fetch(`${base}/api/v1/stories`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      return res.ok;
    }
  } catch {
    return false;
  }
}

const CreateStoryScreen: React.FC<Props> = ({ navigation }) => {
  const token = useAppSelector(selectAuthToken);
  const profile = useAppSelector(selectHopenityProfile);

  const [mode, setMode] = useState<Mode>('pick');
  const [media, setMedia] = useState<MediaPick | null>(null);
  const [caption, setCaption] = useState('');
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [uploading, setUploading] = useState(false);

  const pickGallery = useCallback(async () => {
    const res = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 1,
      includeExtra: true,
    });
    if (res.didCancel || !res.assets?.[0]?.uri) return;
    const asset = res.assets[0];
    setMedia({
      uri: asset.uri!,
      type: asset.type?.startsWith('video/') ? 'video' : 'image',
      mimeType: asset.type,
      fileName: asset.fileName ?? undefined,
    });
    setMode('preview');
  }, []);

  const pickCamera = useCallback(async () => {
    const res = await launchCamera({ mediaType: 'photo', saveToPhotos: false });
    if (res.didCancel || !res.assets?.[0]?.uri) return;
    const asset = res.assets[0];
    setMedia({ uri: asset.uri!, type: 'image', mimeType: asset.type, fileName: asset.fileName ?? undefined });
    setMode('preview');
  }, []);

  const handleShare = useCallback(async () => {
    if (!token) {
      Alert.alert('Sign in required', 'Please sign in to post a story.');
      return;
    }
    setUploading(true);
    let ok = false;
    if (mode === 'text') {
      if (!caption.trim()) { setUploading(false); return; }
      ok = await uploadStory({ type: 'TEXT', content: caption.trim(), backgroundColor: bgColor.bg }, token);
    } else if (media) {
      ok = await uploadStory({
        type: media.type === 'video' ? 'VIDEO' : 'PHOTO',
        uri: media.uri,
        mimeType: media.mimeType,
        fileName: media.fileName,
      }, token);
    }
    setUploading(false);
    if (ok) {
      Alert.alert('Story posted!', 'Your story has been shared.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Failed', 'Could not post your story. Check your connection and try again.');
    }
  }, [token, mode, caption, bgColor, media, navigation]);

  const canPost = (mode === 'text' && caption.trim().length > 0) || (mode === 'preview' && !!media);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={24} color={colorss.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        {canPost ? (
          <TouchableOpacity
            style={[styles.postBtn, uploading && { opacity: 0.6 }]}
            onPress={handleShare}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colorss.white} />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile row */}
        <View style={styles.profileRow}>
          {profile?.avatarUrl ? (
            <FastImage source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFall]}>
              <Text style={styles.avatarChr}>
                {(profile?.displayName ?? 'Y').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.profileName}>{profile?.displayName ?? 'Your story'}</Text>
            <Text style={styles.profileSub}>Public</Text>
          </View>
        </View>

        {/* Media preview */}
        {mode === 'preview' && media ? (
          <View style={styles.previewBox}>
            <FastImage
              source={{ uri: media.uri }}
              style={styles.previewImg}
              resizeMode={FastImage.resizeMode.cover}
            />
            <TouchableOpacity
              style={styles.removeMediaBtn}
              onPress={() => { setMedia(null); setMode('pick'); }}
            >
              <Text style={styles.removeMediaTxt}>✕ Remove</Text>
            </TouchableOpacity>
          </View>
        ) : mode === 'text' ? (
          <View style={[styles.textStoryBox, { backgroundColor: bgColor.bg }]}>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Write something for your story..."
              placeholderTextColor={bgColor.text + '80'}
              multiline
              style={[styles.textStoryInput, { color: bgColor.text }]}
              autoFocus
            />
          </View>
        ) : null}

        {/* Color strip (for text stories) */}
        {mode === 'text' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorRow}>
            {BG_COLORS.map(opt => (
              <TouchableOpacity
                key={opt.bg}
                style={[
                  styles.colorDot,
                  { backgroundColor: opt.bg },
                  bgColor.bg === opt.bg && styles.colorDotActive,
                ]}
                onPress={() => setBgColor(opt)}
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.divider} />

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionCard} onPress={pickGallery}>
            <View style={styles.actionIcon}>
              <ImageIcon size={28} color={colorss.primary} />
            </View>
            <Text style={styles.actionLabel}>Gallery</Text>
            <Text style={styles.actionSub}>Photo or video</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={pickCamera}>
            <View style={styles.actionIcon}>
              <Send size={28} color={colorss.primary} style={{ transform: [{ rotate: '-45deg' }] }} />
            </View>
            <Text style={styles.actionLabel}>Camera</Text>
            <Text style={styles.actionSub}>Take a photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, mode === 'text' && styles.actionCardActive]}
            onPress={() => setMode(mode === 'text' ? 'pick' : 'text')}
          >
            <View style={[styles.actionIcon, mode === 'text' && { backgroundColor: colorss.primary }]}>
              <Type size={28} color={mode === 'text' ? colorss.white : colorss.primary} />
            </View>
            <Text style={styles.actionLabel}>Text</Text>
            <Text style={styles.actionSub}>Write a story</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CreateStoryScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorss.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colorss.textPrimary },
  postBtn: {
    backgroundColor: colorss.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  postBtnText: { color: colorss.white, fontWeight: '700', fontSize: 14 },
  content: { padding: 16, paddingBottom: 40 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFall: { backgroundColor: colorss.primary, alignItems: 'center', justifyContent: 'center' },
  avatarChr: { color: colorss.white, fontSize: 22, fontWeight: '700' },
  profileName: { fontSize: 16, fontWeight: '700', color: colorss.textPrimary },
  profileSub: { fontSize: 12, color: colorss.textSecondary, marginTop: 2 },
  previewBox: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, height: 300 },
  previewImg: { width: '100%', height: '100%' },
  removeMediaBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeMediaTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  textStoryBox: {
    borderRadius: 16,
    height: 260,
    marginBottom: 16,
    justifyContent: 'center',
    padding: 20,
  },
  textStoryInput: {
    fontSize: 22,
    textAlign: 'center',
    minHeight: 80,
  },
  colorRow: { marginBottom: 16 },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: colorss.textPrimary,
  },
  divider: { height: 1, backgroundColor: colorss.border, marginVertical: 16 },
  actions: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  actionCard: {
    flex: 1,
    backgroundColor: colorss.background,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colorss.border,
  },
  actionCardActive: { borderColor: colorss.primary, backgroundColor: `${colorss.primary}10` },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${colorss.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '700', color: colorss.textPrimary },
  actionSub: { fontSize: 11, color: colorss.textSecondary, textAlign: 'center' },
});
