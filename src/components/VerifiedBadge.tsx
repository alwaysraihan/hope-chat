import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { IC_VERIFIED_BADGE } from '../assets';

/**
 * Hopenity's verification badge, shown after a verified account's name.
 * Uses the same asset as the Hopenity app so the mark is identical in both.
 */
const VerifiedBadge = ({ size = 14 }: { size?: number }) => (
  <Image
    source={IC_VERIFIED_BADGE}
    style={[styles.badge, { width: size, height: size }]}
    resizeMode="contain"
    accessibilityLabel="Verified account"
  />
);

const styles = StyleSheet.create({
  badge: {
    marginLeft: 4,
  },
});

export default VerifiedBadge;
