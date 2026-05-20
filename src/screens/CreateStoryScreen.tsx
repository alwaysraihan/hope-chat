import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  ChevronDown,
  Globe,
  Image as ImageIcon,
  Music2,
  Type,
  Users,
  X,
} from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import Video from 'react-native-video';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { useT } from '../hooks/useT';
import { selectAuthToken, selectHopenityProfile } from '../redux/features/auth/authSlice';
import { API_BASE_URL } from '../config/env';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'CreateStory'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const BG_OPTIONS: Array<{ bgColor: string; textColor: string }> = [
  { bgColor: '#0084FF', textColor: 'white' },
  { bgColor: '#00C2FF', textColor: 'white' },
  { bgColor: '#74B9FF', textColor: 'white' },
  { bgColor: '#0984E3', textColor: 'white' },
  { bgColor: '#00B894', textColor: 'white' },
  { bgColor: '#00D084', textColor: 'white' },
  { bgColor: '#00CEC9', textColor: 'white' },
  { bgColor: '#81ECEC', textColor: 'black' },
  { bgColor: '#55EFC4', textColor: 'black' },
  { bgColor: '#A8E6CF', textColor: 'black' },
  { bgColor: '#6C5CE7', textColor: 'white' },
  { bgColor: '#A29BFE', textColor: 'white' },
  { bgColor: '#5F27CD', textColor: 'white' },
  { bgColor: '#FD79A8', textColor: 'white' },
  { bgColor: '#E84393', textColor: 'white' },
  { bgColor: '#FF7675', textColor: 'white' },
  { bgColor: '#E17055', textColor: 'white' },
  { bgColor: '#D63031', textColor: 'white' },
  { bgColor: '#FDCB6E', textColor: 'black' },
  { bgColor: '#F39C12', textColor: 'white' },
  { bgColor: '#FFEAA7', textColor: 'black' },
  { bgColor: '#E67E22', textColor: 'white' },
  { bgColor: '#FAB1A0', textColor: 'black' },
  { bgColor: '#2D3436', textColor: 'white' },
  { bgColor: '#2C3E50', textColor: 'white' },
  { bgColor: '#1E272E', textColor: 'white' },
  { bgColor: '#636E72', textColor: 'white' },
  { bgColor: '#B2BEC3', textColor: 'black' },
  { bgColor: '#DFE6E9', textColor: 'black' },
];

type TabType = 'gallery' | 'photo' | 'text';
type Visibility = 'PUBLIC' | 'FRIENDS';

type MediaPick = {
  uri: string;
  type: 'image' | 'video';
  mimeType?: string;
  fileName?: string;
};

type MusicTrack = {
  id: number | string;
  title: string;
  audio: string;
  cover?: string;
  timeFrame?: string;
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchMusicTracks(
  token: string,
  search?: string,
  offset = 0,
  limit = 20,
): Promise<{ tracks: MusicTrack[]; hasMore: boolean }> {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const endpoints = ['/api/v1/music/list', '/api/v1/music/tracks', '/api/v1/music'];
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (search?.trim()) params.set('search', search.trim());

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${base}${ep}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const raw: any[] =
        json?.responseObject?.music ??
        json?.responseObject?.tracks ??
        json?.responseObject ??
        json?.data ??
        [];
      if (!Array.isArray(raw)) continue;
      const tracks: MusicTrack[] = raw
        .filter((m: any) => m?.audio || m?.audio_url)
        .map((m: any) => ({
          id: m.id ?? m._id ?? String(Math.random()),
          title: m.title ?? m.name ?? 'Unknown track',
          audio: m.audio ?? m.audio_url ?? '',
          cover: m.cover ?? m.cover_image ?? m.thumbnail ?? '',
          timeFrame: m.timeFrame ?? m.duration_label ?? '',
        }));
      return { tracks, hasMore: json?.hasMore ?? tracks.length >= limit };
    } catch { continue; }
  }
  return { tracks: [], hasMore: false };
}

async function uploadStory(
  payload: {
    type: 'TEXT' | 'PHOTO' | 'VIDEO';
    content?: string;
    backgroundColor?: string;
    uri?: string;
    mimeType?: string;
    fileName?: string;
    musicId?: string | number;
    visibility: Visibility;
  },
  token: string,
): Promise<boolean> {
  try {
    const base = API_BASE_URL.replace(/\/+$/, '');
    const privacy = payload.visibility === 'PUBLIC' ? 'PUBLIC' : 'FRIENDS_ONLY';

    if (payload.type === 'TEXT') {
      const body: Record<string, string> = {
        type: 'TEXT',
        privacy,
        content: payload.content ?? '',
        background_color: payload.backgroundColor ?? '#0084FF',
      };
      if (payload.musicId != null) body.musicId = String(payload.musicId);
      const res = await fetch(`${base}/api/v1/stories`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.ok;
    }

    const form = new FormData();
    form.append('type', payload.type);
    form.append('privacy', privacy);
    if (payload.musicId != null) form.append('musicId', String(payload.musicId));
    form.append('media', {
      uri: payload.uri,
      type: payload.mimeType ?? (payload.type === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
      name: payload.fileName ?? `story_${Date.now()}`,
    } as any);
    const res = await fetch(`${base}/api/v1/stories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Music Sheet Modal ────────────────────────────────────────────────────────

function MusicSheet({
  visible,
  token,
  selected,
  onSelect,
  onRemove,
  onClose,
}: {
  visible: boolean;
  token: string;
  selected: MusicTrack | null;
  onSelect: (track: MusicTrack) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [search, setSearch] = useState('');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
      loadTracks(false, '');
    } else {
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadTracks = useCallback(async (append: boolean, q: string) => {
    if (append && !hasMore) return;
    const offset = append ? offsetRef.current : 0;
    if (append) setLoadingMore(true);
    else setLoading(true);
    const { tracks: t, hasMore: more } = await fetchMusicTracks(token, q, offset);
    setHasMore(more);
    offsetRef.current = append ? offset + t.length : t.length;
    setTracks(prev => append ? [...prev, ...t] : t);
    setLoading(false);
    setLoadingMore(false);
  }, [token, hasMore]);

  useEffect(() => {
    if (!visible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      offsetRef.current = 0;
      setHasMore(true);
      loadTracks(false, search);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, visible]);

  const sheetTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            mStyles.sheet,
            { paddingBottom: insets.bottom + 8, transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          {/* Sheet header */}
          <View style={mStyles.sheetHandle} />
          <View style={mStyles.sheetHeader}>
            <Text style={mStyles.sheetTitle}>{t.select_music}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={colorss.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={mStyles.searchRow}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t.search_music}
              placeholderTextColor={colorss.placeholder}
              style={mStyles.searchInput}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
                <X size={16} color={colorss.placeholder} />
              </TouchableOpacity>
            )}
          </View>

          {/* Track list */}
          {loading ? (
            <View style={mStyles.loadingWrap}>
              <ActivityIndicator color={colorss.primary} />
            </View>
          ) : (
            <FlatList
              data={tracks}
              keyExtractor={item => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              ListEmptyComponent={
                <View style={mStyles.loadingWrap}>
                  <Text style={{ color: colorss.textSecondary }}>{t.no_music}</Text>
                </View>
              }
              ListFooterComponent={
                loadingMore ? <ActivityIndicator color={colorss.primary} style={{ marginVertical: 12 }} /> : null
              }
              onEndReachedThreshold={0.3}
              onEndReached={() => { if (hasMore) loadTracks(true, search); }}
              renderItem={({ item }) => {
                const isSelected = selected?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[mStyles.trackRow, isSelected && mStyles.trackRowSelected]}
                    onPress={() => { onSelect(item); onClose(); }}
                    activeOpacity={0.75}
                  >
                    {item.cover ? (
                      <FastImage source={{ uri: item.cover }} style={mStyles.trackCover} />
                    ) : (
                      <View style={[mStyles.trackCover, mStyles.trackCoverFall]}>
                        <Music2 size={18} color={colorss.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={mStyles.trackTitle} numberOfLines={1}>{item.title}</Text>
                      {item.timeFrame ? (
                        <Text style={mStyles.trackDuration}>{item.timeFrame}</Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <View style={mStyles.selectedDot}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Remove button if something is selected */}
          {selected && (
            <TouchableOpacity style={mStyles.removeMusic} onPress={() => { onRemove(); onClose(); }}>
              <Text style={mStyles.removeMusicText}>{t.remove_music}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const CreateStoryScreen: React.FC<Props> = ({ navigation }) => {
  const t = useT();
  const token = useAppSelector(selectAuthToken);
  const profile = useAppSelector(selectHopenityProfile);

  const [activeTab, setActiveTab] = useState<TabType>('gallery');
  const [media, setMedia] = useState<MediaPick | null>(null);
  const [bgMode, setBgMode] = useState(false);
  const [currentBg, setCurrentBg] = useState(BG_OPTIONS[0]);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [musicSheetOpen, setMusicSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);

  const hasMedia = !!media;
  const canPost =
    hasMedia ||
    (bgMode && caption.trim().length > 0);

  // ── Pickers ──

  const handleGallery = useCallback(async () => {
    const res = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1, includeExtra: true });
    if (res.didCancel || !res.assets?.[0]?.uri) return;
    const asset = res.assets[0];
    setMedia({
      uri: asset.uri!,
      type: asset.type?.startsWith('video/') ? 'video' : 'image',
      mimeType: asset.type,
      fileName: asset.fileName ?? undefined,
    });
    setBgMode(false);
  }, []);

  const handleCamera = useCallback(async () => {
    const res = await launchCamera({ mediaType: 'photo', saveToPhotos: false });
    if (res.didCancel || !res.assets?.[0]?.uri) return;
    const asset = res.assets[0];
    setMedia({ uri: asset.uri!, type: 'image', mimeType: asset.type, fileName: asset.fileName ?? undefined });
    setBgMode(false);
  }, []);

  const handleTabAction = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'gallery') handleGallery();
    else if (tab === 'photo') handleCamera();
    else {
      setBgMode(true);
      setMedia(null);
      if (!currentBg) setCurrentBg(BG_OPTIONS[0]);
    }
  }, [handleGallery, handleCamera, currentBg]);

  const handleRemoveMedia = useCallback(() => {
    setMedia(null);
    setActiveTab('gallery');
  }, []);

  // ── Share ──

  const handleShare = useCallback(async () => {
    if (!token) { Alert.alert('Sign in required'); return; }
    setUploading(true);
    let ok = false;

    if (bgMode && caption.trim()) {
      ok = await uploadStory({
        type: 'TEXT',
        content: caption.trim(),
        backgroundColor: currentBg.bgColor,
        musicId: selectedMusic?.id,
        visibility,
      }, token);
    } else if (media) {
      ok = await uploadStory({
        type: media.type === 'video' ? 'VIDEO' : 'PHOTO',
        uri: media.uri,
        mimeType: media.mimeType,
        fileName: media.fileName,
        musicId: selectedMusic?.id,
        visibility,
      }, token);
    }
    setUploading(false);
    if (ok) {
      Alert.alert(t.story_posted, t.story_live, [
        { text: t.got_it, onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert(t.failed, t.story_failed);
    }
  }, [token, bgMode, caption, currentBg, selectedMusic, visibility, media, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <X size={26} color={colorss.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.create_story}</Text>
        <View style={styles.headerRight}>
          {canPost && (
            <>
              {/* Privacy chip */}
              <TouchableOpacity
                style={styles.privacyChip}
                onPress={() => setVisibility(v => v === 'PUBLIC' ? 'FRIENDS' : 'PUBLIC')}
              >
                {visibility === 'PUBLIC'
                  ? <Globe size={13} color={colorss.primary} />
                  : <Users size={13} color={colorss.primary} />}
                <Text style={styles.privacyChipText}>
                  {visibility === 'PUBLIC' ? t.public : t.friends}
                </Text>
                <ChevronDown size={11} color={colorss.primary} />
              </TouchableOpacity>

              {/* Post button */}
              <TouchableOpacity
                style={[styles.postBtn, uploading && { opacity: 0.6 }]}
                onPress={handleShare}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.postBtnText}>{t.post}</Text>}
              </TouchableOpacity>
            </>
          )}
          {!canPost && <View style={{ width: 80 }} />}
        </View>
      </View>

      {/* ── Main preview area ───────────────────────────────── */}
      <View style={styles.preview}>
        {hasMedia && media ? (
          // Media preview (image or video)
          <View style={StyleSheet.absoluteFill}>
            {media.type === 'video' ? (
              <Video
                source={{ uri: media.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                paused={videoPaused}
                repeat
              />
            ) : (
              <FastImage
                source={{ uri: media.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode={FastImage.resizeMode.contain}
              />
            )}

            {/* Remove media */}
            <TouchableOpacity style={styles.removeBtn} onPress={handleRemoveMedia}>
              <X size={18} color="#fff" />
            </TouchableOpacity>

            {/* Video play/pause */}
            {media.type === 'video' && (
              <TouchableOpacity
                style={styles.playBtn}
                onPress={() => setVideoPaused(p => !p)}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  {videoPaused ? '▶ Play' : '⏸ Pause'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Add music overlay button */}
            <TouchableOpacity
              style={styles.musicOverlay}
              onPress={() => setMusicSheetOpen(true)}
            >
              <Music2 size={18} color="#fff" />
              <Text style={styles.musicOverlayText} numberOfLines={1}>
                {selectedMusic?.title ?? t.select_music}
              </Text>
              {selectedMusic && (
                <TouchableOpacity onPress={() => setSelectedMusic(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        ) : bgMode ? (
          // Text story on background color
          <View style={[StyleSheet.absoluteFill, { backgroundColor: currentBg.bgColor }]}>
            {/* Music overlay for text story */}
            <TouchableOpacity
              style={[styles.musicOverlay, { top: 16, bottom: undefined }]}
              onPress={() => setMusicSheetOpen(true)}
            >
              <Music2 size={18} color="#fff" />
              <Text style={styles.musicOverlayText} numberOfLines={1}>
                {selectedMusic?.title ?? t.select_music}
              </Text>
              {selectedMusic && (
                <TouchableOpacity onPress={() => setSelectedMusic(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Text input centred */}
            <View style={styles.textInputWrap}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder={t.write_something}
                placeholderTextColor={currentBg.textColor + '80'}
                multiline
                style={[styles.textInput, { color: currentBg.textColor }]}
                autoFocus
              />
            </View>

            {/* Color strip */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorStrip}
              style={styles.colorStripScroll}
            >
              {BG_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.bgColor}
                  style={[
                    styles.colorDot,
                    { backgroundColor: opt.bgColor },
                    currentBg.bgColor === opt.bgColor && styles.colorDotActive,
                  ]}
                  onPress={() => setCurrentBg(opt)}
                />
              ))}
            </ScrollView>
          </View>
        ) : (
          // Empty state — profile + prompt
          <View style={styles.emptyPreview}>
            {profile?.avatarUrl ? (
              <FastImage source={{ uri: profile.avatarUrl }} style={styles.profileAvatar} />
            ) : (
              <View style={[styles.profileAvatar, styles.profileAvatarFall]}>
                <Text style={styles.profileAvatarChr}>
                  {(profile?.displayName ?? 'Y').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.profileName}>{profile?.displayName ?? 'Your story'}</Text>
            <Text style={styles.profilePrompt}>{t.get_started_hint}</Text>
          </View>
        )}
      </View>

      {/* ── Bottom tab bar ──────────────────────────────────── */}
      <View style={styles.bottomTabs}>
        <TouchableOpacity
          style={[styles.tabItem, bgMode && styles.tabItemActive]}
          onPress={() => {
            setBgMode(true);
            setMedia(null);
            setActiveTab('text');
          }}
        >
          <View style={[styles.tabIconWrap, bgMode && { backgroundColor: currentBg.bgColor }]}>
            <Text style={[styles.tabAa, bgMode && { color: currentBg.textColor }]}>Aa</Text>
          </View>
          <Text style={[styles.tabLabel, bgMode && { color: colorss.primary }]}>{t.tab_background}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'gallery' && !bgMode && styles.tabItemActive]}
          onPress={() => { setBgMode(false); handleTabAction('gallery'); }}
        >
          <View style={styles.tabIconWrap}>
            <ImageIcon size={22} color={activeTab === 'gallery' && !bgMode ? colorss.primary : colorss.textSecondary} />
          </View>
          <Text style={[styles.tabLabel, activeTab === 'gallery' && !bgMode && { color: colorss.primary }]}>
            {t.tab_gallery}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'photo' && !bgMode && styles.tabItemActive]}
          onPress={() => { setBgMode(false); handleTabAction('photo'); }}
        >
          <View style={styles.tabIconWrap}>
            <Camera size={22} color={activeTab === 'photo' && !bgMode ? colorss.primary : colorss.textSecondary} />
          </View>
          <Text style={[styles.tabLabel, activeTab === 'photo' && !bgMode && { color: colorss.primary }]}>
            {t.tab_photo}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Music sheet ─────────────────────────────────────── */}
      {token && (
        <MusicSheet
          visible={musicSheetOpen}
          token={token}
          selected={selectedMusic}
          onSelect={setSelectedMusic}
          onRemove={() => setSelectedMusic(null)}
          onClose={() => setMusicSheetOpen(false)}
        />
      )}
    </SafeAreaView>
  );
};

export default CreateStoryScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorss.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colorss.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  privacyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colorss.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: `${colorss.primary}10`,
  },
  privacyChipText: { fontSize: 12, fontWeight: '700', color: colorss.primary },

  postBtn: {
    backgroundColor: colorss.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 56,
    alignItems: 'center',
  },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // ── Preview ────────────────────────────────────────────────────────────────
  preview: {
    flex: 1,
    backgroundColor: '#111',
    overflow: 'hidden',
  },

  removeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    position: 'absolute',
    right: 14,
    bottom: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  musicOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: '70%',
  },
  musicOverlayText: {
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },

  // ── Text story ─────────────────────────────────────────────────────────────
  textInputWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  textInput: {
    fontSize: 22,
    textAlign: 'center',
    minHeight: 80,
  },
  colorStripScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  colorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colorss.backgroundDeep,
  },
  profileAvatar: { width: 72, height: 72, borderRadius: 36 },
  profileAvatarFall: {
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarChr: { color: '#fff', fontSize: 28, fontWeight: '700' },
  profileName: { fontSize: 17, fontWeight: '700', color: colorss.textPrimary },
  profilePrompt: { fontSize: 13, color: colorss.textSecondary },

  // ── Bottom tabs ────────────────────────────────────────────────────────────
  bottomTabs: {
    flexDirection: 'row',
    backgroundColor: colorss.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colorss.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    paddingTop: 10,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 4 },
  tabItemActive: {},
  tabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colorss.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabAa: { fontSize: 17, fontWeight: '700', color: colorss.textSecondary },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colorss.textSecondary },
});

// Music sheet styles
const mStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colorss.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingTop: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colorss.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colorss.textPrimary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: colorss.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: colorss.textPrimary,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  trackRowSelected: { backgroundColor: `${colorss.primary}0D` },
  trackCover: { width: 48, height: 48, borderRadius: 8 },
  trackCoverFall: {
    backgroundColor: `${colorss.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTitle: { fontSize: 14, fontWeight: '600', color: colorss.textPrimary },
  trackDuration: { fontSize: 12, color: colorss.textSecondary, marginTop: 2 },
  selectedDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeMusic: {
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colorss.error,
    alignItems: 'center',
  },
  removeMusicText: { color: colorss.error, fontWeight: '700', fontSize: 14 },
});
