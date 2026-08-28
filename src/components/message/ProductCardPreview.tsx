import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { ExternalLink } from 'lucide-react-native';

import { fetchProductBySlug, formatHoppiPrice, HoppiProduct, HOPPI_BASE_URL } from '../../services/hoppiService';
import { colorss } from '../../theme';

interface Props {
  slug: string;
  onPress: () => void;
  /** Retained for call-site symmetry; the card no longer tints to the bubble. */
  isOwn?: boolean;
  isDark?: boolean;
}

export const ProductCardPreview: React.FC<Props> = ({ slug, onPress, isDark }) => {
  const [product, setProduct] = useState<HoppiProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProductBySlug(slug)
      .then(p => {
        if (cancelled) return;
        if (p) setProduct(p);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (failed) return null;

  // The card always gets its own neutral surface rather than a tint of the
  // bubble. Inside an outgoing (brand-pink) bubble the translucent overlay left
  // the pink price and pink CTA sitting on pink — unreadable. A solid surface
  // also makes the preview read as a distinct card rather than bubble chrome.
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const cardBorder = isDark ? '#33334A' : '#E6E6EF';
  const titleColor = isDark ? '#F0F0F0' : '#111827';
  const subColor = isDark ? '#9A9AB0' : '#6B7280';

  if (loading) {
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <ActivityIndicator size="small" color={colorss.primary} style={{ padding: 16 }} />
      </TouchableOpacity>
    );
  }

  const imageUrl = product?.images?.[0];
  const title = product?.title ?? product?.name ?? 'View Product';
  const priceStr = product ? formatHoppiPrice(product) : null;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {imageUrl ? (
        <FastImage
          source={{ uri: imageUrl }}
          style={styles.img}
          resizeMode={FastImage.resizeMode.cover}
        />
      ) : (
        <View style={[styles.img, styles.imgPlaceholder]} />
      )}
      <View style={styles.info}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
          {title}
        </Text>
        {priceStr ? (
          <Text style={styles.price}>{priceStr}</Text>
        ) : null}
        <View style={styles.viewBtn}>
          <ExternalLink size={12} color="#fff" />
          <Text style={styles.viewBtnText}>View product</Text>
        </View>
        <Text style={[styles.cta, { color: subColor }]} numberOfLines={1}>
          hoppi.live
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    width: 210,
    borderWidth: StyleSheet.hairlineWidth,
    // Lifts the card off the bubble it sits in.
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  img: { width: '100%', height: 130 },
  imgPlaceholder: { backgroundColor: '#ddd' },
  info: { padding: 10, gap: 3 },
  title: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  price: { fontSize: 14, fontWeight: '700', color: colorss.primary },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colorss.primary,
  },
  viewBtnText: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
  cta: { fontSize: 10.5, textAlign: 'center', marginTop: 4 },
});
