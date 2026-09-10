import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
  StatusBar,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import FastImage from '@d11/react-native-fast-image';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import { Send, Eye, X, User, Trash2 } from 'lucide-react-native';

import { colorss } from '../theme';
import VerifiedBadge from '../components/VerifiedBadge';
import type { RootStackNavigatorParamList } from '../types/navigators';
import { getStoryFeedRings, setStoryFeedRings, type StoryRing } from '../data/storyFeedCache';
import { useAppSelector } from '../hooks/redux';
import {
  selectAuthToken,
  selectHopenityProfile,
  selectActivePage,
} from '../redux/features/auth/authSlice';
import { fetchMyFriends } from '../services/friendsService';
import {
  markStoryViewed,
  reactToStory,
  deleteStory,
  fetchStoryViewers,
  type StoryViewerRow,
} from '../services/story/storyInteractions';
import { emitStoryDeleted } from '../services/story/storyEvents';
import {
  getOrCreatePeerChatWithVersion,
  sendHopenityChatMessage,
} from '../services/chatService';

type Props = NativeStackScreenProps<
  RootStackNavigatorParamList,
  'StoryViewer'
>;

const { width, height } = Dimensions.get('window');

const REACTIONS = ['👍', '❤️', '🔥', '😂', '😮', '😢', '😡'];

/** Author identity a ring/story resolves to, for profile nav / friend / ownership checks. */
function authorIdOf(ring?: StoryRing): string {
  return ring?.authorPublicId ?? ring?.authorId ?? '';
}

/** Pop-then-settle scale, same feel as Facebook/Instagram's Like bounce. */
function useBounce() {
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = useCallback(() => {
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.35,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 3,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale]);
  return { scale, bounce };
}

/** One reaction-picker emoji — each needs its own animated scale, not a shared one. */
const ReactionButton: React.FC<{
  emoji: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ emoji, onPress, disabled }) => {
  const { scale, bounce } = useBounce();
  return (
    <Pressable
      onPress={() => {
        bounce();
        onPress();
      }}
      disabled={disabled}
      hitSlop={6}
    >
      <Animated.Text style={[styles.reactionEmoji, { transform: [{ scale }] }]}>
        {emoji}
      </Animated.Text>
    </Pressable>
  );
};

const StoryViewerScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const token = useAppSelector(selectAuthToken);
  const profile = useAppSelector(selectHopenityProfile);
  const activePage = useAppSelector(selectActivePage);

  const rings = getStoryFeedRings();
  const parsedIdx = Number(route.params?.ringIndex ?? 0);
  const ringIndex = Number.isFinite(parsedIdx) ? parsedIdx : 0;

  const [userIdx, setUserIdx] = useState(() =>
    rings.length === 0
      ? 0
      : Math.min(Math.max(ringIndex, 0), rings.length - 1),
  );
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    return () => StatusBar.setBarStyle('dark-content');
  }, []);

  useEffect(() => {
    const next = getStoryFeedRings();
    if (next.length === 0) return;
    const r = Number(route.params?.ringIndex ?? 0);
    const idx = Number.isFinite(r) ? r : 0;
    setUserIdx(() => Math.min(Math.max(idx, 0), next.length - 1));
    setSlideIdx(0);
  }, [route.params?.ringIndex]);

  const ring = rings[userIdx];

  useEffect(() => {
    setSlideIdx(0);
  }, [userIdx]);

  const slide = ring?.slides[slideIdx];
  const slideCount = ring?.slides.length ?? 0;

  const isExpired =
    !!slide?.expiresAt && new Date(slide.expiresAt).getTime() < Date.now();

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const killAnim = useCallback(() => {
    animRef.current?.stop();
    animRef.current = null;
  }, []);

  // Pausing while the user is typing a reply / picking a reaction — same
  // behaviour as feusar's StoryViewer (isPaused gates both the timer and
  // autoplay). progress.stopAnimation hands back the exact value it froze
  // at, which lets resume continue from the same point instead of restarting.
  const [interacting, setInteracting] = useState(false);
  const pausedAtRef = useRef(0);

  useEffect(() => {
    if (!slide || isExpired) return;
    if (interacting) {
      progress.stopAnimation(v => {
        pausedAtRef.current = v;
      });
      killAnim();
      return;
    }
    killAnim();
    const remaining = slide.durationMs * (1 - pausedAtRef.current);
    const a = Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(200, remaining),
      useNativeDriver: false,
    });
    animRef.current = a;
    a.start(({ finished }) => {
      pausedAtRef.current = 0;
      const currentRings = getStoryFeedRings();
      if (!finished || !currentRings.length || !ring) return;
      const nextSlide = slideIdx + 1;
      if (nextSlide < slideCount) setSlideIdx(nextSlide);
      else if (userIdx + 1 < currentRings.length) setUserIdx(userIdx + 1);
      else navigation.goBack();
    });
    return killAnim;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide?.id, ring?.id, slideIdx, interacting]);

  useEffect(() => {
    pausedAtRef.current = 0;
  }, [slide?.id]);

  // Mark viewed — fire once per slide shown, same as feusar's
  // markStoryViewed(currentStory.id) on mount/slide-change.
  useEffect(() => {
    if (!slide || isExpired) return;
    void markStoryViewed(slide.id, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide?.id, isExpired, token]);

  const goPrev = useCallback(() => {
    // A reaction picker or focused input left open must not survive a manual
    // skip — otherwise `interacting` stays true forever and the next slide's
    // timer never starts (it stays frozen at 0% with no way to resume).
    setInteracting(false);
    setShowReactions(false);
    killAnim();
    progress.setValue(0);
    if (slideIdx > 0) setSlideIdx(slideIdx - 1);
    else if (userIdx > 0) setUserIdx(userIdx - 1);
    else navigation.goBack();
  }, [killAnim, navigation, progress, slideIdx, userIdx]);

  const goNext = useCallback(() => {
    setInteracting(false);
    setShowReactions(false);
    killAnim();
    progress.setValue(0);
    if (!ring) return;
    if (slideIdx + 1 < slideCount) setSlideIdx(slideIdx + 1);
    else if (userIdx + 1 < rings.length) setUserIdx(userIdx + 1);
    else navigation.goBack();
  }, [
    killAnim,
    navigation,
    progress,
    ring,
    slideCount,
    slideIdx,
    userIdx,
    rings.length,
  ]);

  // ── Ownership / friend gating for the reply+react bar ──────────────────
  const isOwnStory =
    !!ring &&
    (activePage
      ? !!ring.isPage && authorIdOf(ring) === String(activePage.id)
      : !ring.isPage && authorIdOf(ring) === String(profile?.userId ?? ''));

  const [friendIds, setFriendIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!token || !profile?.userId) return;
    let cancelled = false;
    fetchMyFriends(String(profile.userId), token, { limit: 500 }).then(page => {
      if (cancelled) return;
      setFriendIds(new Set(page.friends.map(f => String(f.userId))));
    });
    return () => {
      cancelled = true;
    };
  }, [token, profile?.userId]);

  const authorId = authorIdOf(ring);
  const isFriend = !ring?.isPage && !!friendIds && friendIds.has(authorId);
  const showReplyBar = !!ring && !isOwnStory && isFriend && !isExpired;

  // ── Own story: who viewed / reacted (mirrors feusar's "Story details" sheet) ──
  const [viewers, setViewers] = useState<StoryViewerRow[]>([]);
  const [viewersOpen, setViewersOpen] = useState(false);
  useEffect(() => {
    setViewers([]);
    if (!isOwnStory || !slide || isExpired) return;
    let cancelled = false;
    fetchStoryViewers(slide.id, token).then(rows => {
      if (!cancelled) setViewers(rows);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnStory, slide?.id, isExpired, token]);

  // ── Delete: owner-only, scoped to whichever identity is active — isOwnStory
  // already only matches the ring against the current Page when one is
  // selected, otherwise against the personal profile, so this button and
  // action naturally target the right story in either mode. ──────────────
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmDelete = useCallback(async () => {
    if (!slide || deleting) return;
    setDeleting(true);
    const ok = await deleteStory(slide.id, token);
    setDeleting(false);
    setDeleteConfirmOpen(false);
    if (!ok) return;
    emitStoryDeleted(slide.id);
    const currentRings = getStoryFeedRings();
    const withoutSlide = currentRings
      .map(r =>
        r.id === ring?.id
          ? { ...r, slides: r.slides.filter(s => s.id !== slide.id) }
          : r,
      )
      .filter(r => r.slides.length > 0);
    setStoryFeedRings(withoutSlide);
    if (withoutSlide.length === 0) {
      navigation.goBack();
      return;
    }
    const nextRingIdx = Math.min(userIdx, withoutSlide.length - 1);
    setUserIdx(nextRingIdx);
    setSlideIdx(0);
  }, [slide, deleting, token, ring?.id, userIdx, navigation]);

  const openAuthorChat = useCallback(async () => {
    if (!ring || ring.isPage || isOwnStory) return; // no chat with a Page or yourself
    const targetId = authorIdOf(ring);
    if (!targetId || !token) return;
    const chat = await getOrCreatePeerChatWithVersion(targetId, token);
    if (!chat) return;
    // replace, not navigate/push — pushing left the story mounted underneath
    // the chat screen, so it kept playing/advancing invisibly behind it
    // instead of actually closing. Both routes live on the same RootStack,
    // so replace swaps the story out for the chat in one transition.
    navigation.replace('Inbox', {
      conversationId: chat.chatId,
      displayName: ring.name,
      avatarUrl: ring.avatarUri ?? null,
    });
  }, [navigation, ring, isOwnStory, token]);

  const [message, setMessage] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  const [sending, setSending] = useState(false);
  const { scale: heartScale, bounce: bounceHeart } = useBounce();

  // Floating reaction — flies up over the story itself (Instagram/TikTok
  // double-tap style) so the reaction visibly lands on the content, not just
  // on the toolbar button that triggered it.
  const [floaters, setFloaters] = useState<
    { id: number; emoji: string; anim: Animated.Value; dx: number }[]
  >([]);
  const floaterIdRef = useRef(0);
  const spawnFloater = useCallback((emoji: string) => {
    const id = ++floaterIdRef.current;
    const anim = new Animated.Value(0);
    const dx = (Math.random() - 0.5) * 60;
    setFloaters(prev => [...prev, { id, emoji, anim, dx }]);
    Animated.timing(anim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start(() => {
      setFloaters(prev => prev.filter(f => f.id !== id));
    });
  }, []);

  const sendReaction = useCallback(
    async (emoji: string) => {
      if (!slide || sending) return;
      spawnFloater(emoji);
      setSending(true);
      try {
        await reactToStory(slide.id, emoji, token);
      } finally {
        setSending(false);
        setShowReactions(false);
        setInteracting(false);
      }
    },
    [slide, sending, token, spawnFloater],
  );

  const sendReply = useCallback(async () => {
    const text = message.trim();
    if (!text || !slide || !token || !authorId || sending) return;
    setSending(true);
    try {
      const chat = await getOrCreatePeerChatWithVersion(authorId, token);
      if (chat) {
        // Same generation switch InboxContext uses (useV2Messages = isGroup
        // || !isV1Chat) — guessing v1 here silently wrote the reply to an
        // endpoint the thread's own message-fetch never reads back from,
        // leaving the chat list preview and the open thread both blank.
        const useV2 = !chat.isV1Chat;
        const sent = await sendHopenityChatMessage(chat.chatId, text, token, undefined, useV2, null, slide.id);
        // sendHopenityChatMessage returns null on a failed request (e.g. the
        // backend 400ing a malformed field) — clearing the composer anyway
        // made a send failure look identical to success.
        if (sent) setMessage('');
      }
    } finally {
      setSending(false);
    }
  }, [message, slide, token, authorId, sending]);

  if (!ring || !slide) {
    return (
      <SafeAreaView style={[styles.shell, styles.center]} edges={['top']}>
        <Text style={styles.muted}>No stories to show.</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.close}>
          <Text style={styles.closeTxt}>Close</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isExpired) {
    return (
      <SafeAreaView style={[styles.shell, styles.center]} edges={['top']}>
        <Text style={styles.expiredTitle}>Story unavailable</Text>
        <Text style={styles.muted}>
          This story has expired or is no longer available.
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.close}>
          <Text style={styles.closeTxt}>Close</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const segments = rings[userIdx].slides.map((s, i) => {
    const isPast = i < slideIdx;
    const active = i === slideIdx;
    return (
      <View key={s.id} style={styles.barTrack}>
        <View style={styles.barInner}>
          {isPast ? <View style={styles.barDone} /> : null}
          {active ? (
            <Animated.View
              style={[
                styles.barGrowing,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          ) : null}
        </View>
      </View>
    );
  });

  const isVideo = slide.type === 'video';
  const isText = slide.type === 'text';

  return (
    <View style={styles.shell}>
      <StatusBar translucent backgroundColor="transparent" />

      {/* -- Media layer: Video, Image, or Text ------------------- */}
      {isText ? (
        <View
          style={[
            styles.fullImage,
            styles.textSlide,
            { backgroundColor: slide.backgroundColor ?? '#0084FF' },
          ]}
        >
          <Text style={styles.textSlideTxt}>{slide.text}</Text>
        </View>
      ) : isVideo ? (
        <Video
          source={{ uri: slide.uri }}
          style={styles.fullImage}
          resizeMode="contain"
          repeat
          paused={interacting}
          muted={false}
          // Restart timer from actual video duration once loaded
          onLoad={data => {
            const durMs = Math.max(1000, (data?.duration ?? 5) * 1000);
            killAnim();
            progress.setValue(0);
            const a = Animated.timing(progress, {
              toValue: 1,
              duration: durMs,
              useNativeDriver: false,
            });
            animRef.current = a;
            a.start(({ finished }) => {
              const currentRings = getStoryFeedRings();
              if (!finished || !currentRings.length || !ring) return;
              const nextSlide = slideIdx + 1;
              if (nextSlide < slideCount) setSlideIdx(nextSlide);
              else if (userIdx + 1 < currentRings.length) setUserIdx(userIdx + 1);
              else navigation.goBack();
            });
          }}
          ignoreSilentSwitch="ignore"
        />
      ) : (
        <FastImage source={{ uri: slide.uri }} style={styles.fullImage} resizeMode={FastImage.resizeMode.contain} />
      )}

      {/* -- Overlay (progress, name, tap zones) ---------------- */}
      <View style={[styles.fullImage, styles.scrim]}>
          {/* Rendered BEFORE overlayTop: a later sibling sits on top for touch
              hit-testing, so having this first lets the name/avatar Pressable
              below win taps in its own area instead of these full-screen
              prev/next zones swallowing them first. */}
          <View style={styles.touchRow} pointerEvents="box-none">
            <Pressable style={styles.hitSide} onPress={goPrev} />
            <Pressable style={styles.hitSide} onPress={goNext} />
          </View>

          <View style={[styles.overlayTop, { paddingTop: insets.top + 6 }]}>
            <View style={styles.progressRow}>{segments}</View>
            <Pressable
              style={styles.userRow}
              onPress={openAuthorChat}
              disabled={ring.isPage || isOwnStory}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {ring.avatarUri ? (
                <FastImage
                  source={{ uri: ring.avatarUri }}
                  style={styles.avatarSmall}
                />
              ) : (
                <View style={[styles.avatarSmall, styles.avatarPlace]}>
                  <Text style={styles.avatarInitial}>
                    {(ring.name ?? 'Friend').trim().charAt(0).toUpperCase() ||
                      '?'}
                  </Text>
                </View>
              )}
              <Text style={styles.name} numberOfLines={1}>
                {ring.name}
              </Text>
              {ring.isVerified ? <VerifiedBadge size={14} /> : null}
            </Pressable>
          </View>
      </View>

      {isOwnStory && !isExpired ? (
        <Pressable
          style={styles.chromeDelete}
          hitSlop={12}
          onPress={() => {
            setInteracting(true);
            setDeleteConfirmOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Delete story"
        >
          <Trash2 size={18} color="#fff" />
        </Pressable>
      ) : null}

      <Pressable
        style={styles.chromeClose}
        hitSlop={12}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Close stories"
      >
        <Text style={styles.chromeCloseTxt}>×</Text>
      </Pressable>

      {/* -- Delete confirmation — in-app dialog, not the native Alert ---- */}
      <Modal
        visible={deleteConfirmOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setDeleteConfirmOpen(false);
          setInteracting(false);
        }}
      >
        <View style={styles.confirmBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => {
              setDeleteConfirmOpen(false);
              setInteracting(false);
            }}
          />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete story?</Text>
            <Text style={styles.confirmBody}>
              This story will be removed for everyone. This can't be undone.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmBtn, styles.confirmBtnCancel]}
                onPress={() => {
                  setDeleteConfirmOpen(false);
                  setInteracting(false);
                }}
                disabled={deleting}
              >
                <Text style={styles.confirmBtnCancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, styles.confirmBtnDelete]}
                onPress={confirmDelete}
                disabled={deleting}
              >
                <Text style={styles.confirmBtnDeleteTxt}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* -- Floating reaction: flies up over the story content itself ---- */}
      <View style={styles.floaterLayer} pointerEvents="none">
        {floaters.map(f => (
          <Animated.Text
            key={f.id}
            style={[
              styles.floaterEmoji,
              {
                opacity: f.anim.interpolate({
                  inputRange: [0, 0.12, 0.75, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateY: f.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -height * 0.5],
                    }),
                  },
                  {
                    translateX: f.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, f.dx],
                    }),
                  },
                  {
                    scale: f.anim.interpolate({
                      inputRange: [0, 0.2, 1],
                      outputRange: [0.5, 1.3, 0.9],
                    }),
                  },
                ],
              },
            ]}
          >
            {f.emoji}
          </Animated.Text>
        ))}
      </View>

      {/* -- Reply + react bar: friends only, never on your own story ---- */}
      {showReplyBar ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.replyWrap}
        >
          {/* KeyboardAvoidingView manages its OWN bottom padding internally
              for keyboard-avoidance (0 at rest) and overwrites anything set
              via its `style` prop's paddingBottom — that silently ate every
              previous attempt to pad for the safe area here. Putting the
              safe-area padding on this inner View instead means it stacks
              with KeyboardAvoidingView's own padding rather than being wiped
              by it. */}
          <View
            style={[
              styles.replyInner,
              { paddingBottom: Math.max(insets.bottom, 24) + 12 },
            ]}
          >
            {/* Fills the whole bar INCLUDING the bottom safe-area padding, so the
                inset zone shows the panel's own background instead of the bare
                story image showing through underneath it. */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
              locations={[0, 0.35, 1]}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {showReactions ? (
              <View style={styles.reactionRow}>
                {REACTIONS.map(emoji => (
                  <ReactionButton
                    key={emoji}
                    emoji={emoji}
                    onPress={() => sendReaction(emoji)}
                    disabled={sending}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.replyRow}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                onFocus={() => setInteracting(true)}
                onBlur={() => !showReactions && setInteracting(false)}
                placeholder="Send message…"
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={styles.replyInput}
                onSubmitEditing={sendReply}
                returnKeyType="send"
              />
              {message.trim().length > 0 ? (
                <Pressable
                  style={styles.sendBtn}
                  onPress={sendReply}
                  disabled={sending}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Send reply"
                >
                  <Send size={18} color="#fff" />
                </Pressable>
              ) : (
                // Default state: tap = quick love react, long-press = full picker
                // (same Like-button pattern as Facebook/Hopenity's own reaction UI).
                <Pressable
                  style={[
                    styles.reactToggle,
                    showReactions && styles.reactToggleActive,
                  ]}
                  onPress={() => {
                    bounceHeart();
                    sendReaction('❤️');
                  }}
                  onLongPress={() => {
                    setShowReactions(true);
                    setInteracting(true);
                  }}
                  disabled={sending}
                  delayLongPress={280}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Love this story — hold for more reactions"
                >
                  <Animated.Text
                    style={[styles.reactToggleTxt, { transform: [{ scale: heartScale }] }]}
                  >
                    ❤️
                  </Animated.Text>
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {/* -- Own story: viewer count → tap for the full list with reactions -- */}
      {isOwnStory && !isExpired ? (
        <Pressable
          style={[styles.viewerRow, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}
          onPress={() => {
            setViewersOpen(true);
            setInteracting(true);
          }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <Eye size={18} color="#fff" />
          <Text style={styles.viewerRowTxt}>
            {viewers.length} {viewers.length === 1 ? 'viewer' : 'viewers'}
          </Text>
        </Pressable>
      ) : null}

      <Modal
        visible={viewersOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setViewersOpen(false);
          setInteracting(false);
        }}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => {
              setViewersOpen(false);
              setInteracting(false);
            }}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Story details</Text>
              <Pressable
                onPress={() => {
                  setViewersOpen(false);
                  setInteracting(false);
                }}
                hitSlop={8}
              >
                <X size={20} color={colorss.textPrimary} />
              </Pressable>
            </View>
            <View style={styles.sheetCountRow}>
              <Eye size={16} color={colorss.textSecondary} />
              <Text style={styles.sheetCountTxt}>
                {viewers.length} {viewers.length === 1 ? 'viewer' : 'viewers'}
              </Text>
            </View>
            <FlatList
              data={viewers}
              keyExtractor={v => v.id}
              renderItem={({ item }) => (
                <View style={styles.viewerItem}>
                  {item.avatarUrl ? (
                    <FastImage source={{ uri: item.avatarUrl }} style={styles.viewerAvatar} />
                  ) : (
                    <View style={[styles.viewerAvatar, styles.viewerAvatarFallback]}>
                      <User size={18} color="#9CA3AF" />
                    </View>
                  )}
                  <Text style={styles.viewerName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.reaction ? (
                    <Text style={styles.viewerReaction}>{item.reaction}</Text>
                  ) : null}
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.sheetEmpty}>No one has seen this yet.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default StoryViewerScreen;

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width,
    height,
    position: 'absolute',
  },
  textSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  textSlideTxt: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  overlayTop: {
    paddingHorizontal: 10,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  barTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barInner: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  barDone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
  },
  barGrowing: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarPlace: {
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  name: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
    flexShrink: 1,
  },
  touchRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  hitSide: { flex: 1 },
  bottomHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  hintTxt: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
  chromeClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 40,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chromeDelete: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 40,
    right: 64,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colorss.background,
    borderRadius: 18,
    padding: 20,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colorss.textPrimary,
    marginBottom: 8,
  },
  confirmBody: {
    fontSize: 14,
    color: colorss.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnCancel: {
    backgroundColor: colorss.border,
  },
  confirmBtnCancelTxt: {
    color: colorss.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  confirmBtnDelete: {
    backgroundColor: '#EF4444',
  },
  confirmBtnDeleteTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  chromeCloseTxt: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '300',
    marginTop: -2,
  },
  muted: {
    color: colorss.white,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  expiredTitle: {
    color: colorss.white,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  close: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  closeTxt: { color: '#fff', fontWeight: '700' },
  replyWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  replyInner: {
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(24,24,27,0.95)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  reactionEmoji: {
    fontSize: 24,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colorss.primary,
  },
  floaterLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingRight: 34,
    paddingBottom: 96,
    zIndex: 50,
  },
  floaterEmoji: {
    position: 'absolute',
    fontSize: 34,
  },
  reactToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  reactToggleActive: {
    backgroundColor: colorss.primary,
    borderColor: colorss.primary,
  },
  reactToggleTxt: {
    fontSize: 18,
  },
  viewerRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  viewerRowTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colorss.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingHorizontal: 16,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colorss.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colorss.textPrimary,
  },
  sheetCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
    marginBottom: 4,
  },
  sheetCountTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: colorss.textSecondary,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  viewerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  viewerAvatarFallback: {
    backgroundColor: colorss.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colorss.textPrimary,
  },
  viewerReaction: {
    fontSize: 20,
  },
  sheetEmpty: {
    textAlign: 'center',
    color: colorss.textSecondary,
    paddingVertical: 24,
  },
});
