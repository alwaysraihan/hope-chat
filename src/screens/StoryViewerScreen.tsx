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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import FastImage from '@d11/react-native-fast-image';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import { Send } from 'lucide-react-native';

import { colorss } from '../theme';
import type { RootStackNavigatorParamList } from '../types/navigators';
import { getStoryFeedRings, type StoryRing } from '../data/storyFeedCache';
import { useAppSelector } from '../hooks/redux';
import {
  selectAuthToken,
  selectHopenityProfile,
  selectActivePage,
} from '../redux/features/auth/authSlice';
import { fetchMyFriends } from '../services/friendsService';
import { markStoryViewed, reactToStory } from '../services/story/storyInteractions';
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

  const openAuthorProfile = useCallback(() => {
    if (!ring || ring.isPage) return; // Pages don't have a personal Profile screen.
    const targetId = authorIdOf(ring);
    if (!targetId) return;
    navigation.navigate('Profile', { userId: targetId, peerUserId: targetId });
  }, [navigation, ring]);

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

  return (
    <View style={styles.shell}>
      <StatusBar translucent backgroundColor="transparent" />

      {/* -- Media layer: Video or Image ------------------------- */}
      {isVideo ? (
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
        <FastImage source={{ uri: slide.uri }} style={styles.fullImage} resizeMode={FastImage.resizeMode.cover} />
      )}

      {/* -- Overlay (progress, name, tap zones) ---------------- */}
      <View style={[styles.fullImage, styles.scrim]}>
          <View style={[styles.overlayTop, { paddingTop: insets.top + 6 }]}>
            <View style={styles.progressRow}>{segments}</View>
            <Pressable
              style={styles.userRow}
              onPress={openAuthorProfile}
              disabled={ring.isPage}
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
              <Text style={styles.name}>{ring.name}</Text>
            </Pressable>
          </View>

          <View style={styles.touchRow} pointerEvents="box-none">
            <Pressable style={styles.hitSide} onPress={goPrev} />
            <Pressable style={styles.hitSide} onPress={goNext} />
          </View>

      </View>

      <Pressable
        style={styles.chromeClose}
        hitSlop={12}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Close stories"
      >
        <Text style={styles.chromeCloseTxt}>×</Text>
      </Pressable>

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
});
