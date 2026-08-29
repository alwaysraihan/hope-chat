import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PARTICLE_COUNT = 14;
const DURATION_MS = 2200;

type Particle = {
  key: string;
  x: number;
  delay: number;
  size: number;
  drift: number;
  rotate: number;
};

function buildParticles(seed: string): Particle[] {
  // Deterministic-ish spread so bursts don't clump in one column.
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    key: `${seed}_${i}`,
    x: (SCREEN_W / PARTICLE_COUNT) * i + Math.random() * 24 - 12,
    delay: Math.random() * 600,
    size: 22 + Math.random() * 18,
    drift: Math.random() * 60 - 30,
    rotate: Math.random() * 60 - 30,
  }));
}

function Particle({ emoji, particle }: { emoji: string; particle: Particle }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      delay: particle.delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress, particle.delay]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_H * 0.55, -80],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, particle.drift],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${particle.rotate}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.75, 1],
    outputRange: [0, 1, 1, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0.4, 1, 0.9],
  });

  return (
    <Animated.Text
      style={[
        styles.particle,
        {
          left: particle.x,
          fontSize: particle.size,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }, { scale }],
        },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

/**
 * Floating-emoji burst played when a message contains a configured word effect.
 * `burstId` changes on every trigger so repeating the same word replays it.
 */
const WordEffectOverlay = ({
  emoji,
  burstId,
}: {
  emoji: string | null;
  burstId: number;
}) => {
  const particles = useMemo(
    () => (emoji ? buildParticles(String(burstId)) : []),
    [emoji, burstId],
  );

  if (!emoji) return null;

  return (
    <Animated.View pointerEvents="none" style={styles.overlay}>
      {particles.map(p => (
        <Particle key={p.key} emoji={emoji} particle={p} />
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  particle: {
    position: 'absolute',
    bottom: 0,
  },
});

export default WordEffectOverlay;
