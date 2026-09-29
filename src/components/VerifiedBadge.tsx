import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { IC_VERIFIED_BADGE, IC_VERIFIED_BADGE_BLACK } from '../assets';

/**
 * Hopenity's verification badge, shown after a verified account's name.
 * Uses the same asset as the Hopenity app so the mark is identical in both.
 */
const VerifiedBadge = ({
  size = 14,
  variant = 'pink',
}: {
  size?: number;
  /**
   * 'black' swaps in a real black/white re-render of the badge for use over
   * colored headers — tinting the pink asset black flattens the white
   * checkmark into the badge, leaving an illegible solid blob.
   */
  variant?: 'pink' | 'black';
}) => (
  <Image
    source={variant === 'black' ? IC_VERIFIED_BADGE_BLACK : IC_VERIFIED_BADGE}
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
