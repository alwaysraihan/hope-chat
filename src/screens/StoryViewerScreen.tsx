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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import FastImage from '@d11/react-native-fast-image';

import { colorss } from '../theme';
import type { RootStackNavigatorParamList } from '../types/navigators';
import { getStoryFeedRings } from '../data/storyFeedCache';

type Props = NativeStackScreenProps<
  RootStackNavigatorParamList,
  'StoryViewer'
>;

const { width, height } = Dimensions.get('window');

const StoryViewerScreen: React.FC<Props> = ({ navigation, route }) => {
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

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const killAnim = useCallback(() => {
    animRef.current?.stop();
    animRef.current = null;
  }, []);

  useEffect(() => {
    killAnim();
    if (!slide) return;
    progress.setValue(0);
    const a = Animated.timing(progress, {
      toValue: 1,
      duration: slide.durationMs,
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
    return killAnim;
  }, [slide?.id, ring?.id, slideIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const goPrev = useCallback(() => {
    killAnim();
    progress.setValue(0);
    if (slideIdx > 0) setSlideIdx(slideIdx - 1);
    else if (userIdx > 0) setUserIdx(userIdx - 1);
    else navigation.goBack();
  }, [killAnim, navigation, progress, slideIdx, userIdx]);

  const goNext = useCallback(() => {
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

  return (
    <View style={styles.shell}>
      <StatusBar translucent backgroundColor="transparent" />

      <FastImage source={{ uri: slide.uri }} style={styles.fullImage}>
        <View style={styles.scrim}>
          <SafeAreaView style={styles.overlayTop} edges={['top']}>
            <View style={styles.progressRow}>{segments}</View>
            <View style={styles.userRow}>
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
            </View>
          </SafeAreaView>

          <View style={styles.touchRow} pointerEvents="box-none">
            <Pressable style={styles.hitSide} onPress={goPrev} />
            <Pressable style={styles.hitSide} onPress={goNext} />
          </View>

          <SafeAreaView style={styles.bottomHint} edges={['bottom']}>
            <Text style={styles.hintTxt}>Tap left · previous · Tap right · next</Text>
          </SafeAreaView>
        </View>
      </FastImage>

      <Pressable
        style={styles.chromeClose}
        hitSlop={12}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Close stories"
      >
        <Text style={styles.chromeCloseTxt}>×</Text>
      </Pressable>
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
  },
  close: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  closeTxt: { color: '#fff', fontWeight: '700' },
});
