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
  isOwn?: boolean;
  isDark?: boolean;
}

export const ProductCardPreview: React.FC<Props> = ({ slug, onPress, isOwn, isDark }) => {
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

  const cardBg = isOwn
    ? 'rgba(0,0,0,0.18)'
    : isDark ? '#1e1e2e' : '#f5f5fa';
  const titleColor = isOwn ? '#fff' : isDark ? '#f0f0f0' : '#111';
  const subColor = isOwn ? 'rgba(255,255,255,0.7)' : isDark ? '#aaa' : '#666';

  if (loading) {
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg }]}
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
      style={[styles.card, { backgroundColor: cardBg }]}
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
        <View style={styles.ctaRow}>
          <ExternalLink size={11} color={subColor} />
          <Text style={[styles.cta, { color: subColor }]}>View on hoppi.live</Text>
        </View>
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
  },
  img: { width: '100%', height: 130 },
  imgPlaceholder: { backgroundColor: '#ddd' },
  info: { padding: 10, gap: 3 },
  title: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  price: { fontSize: 14, fontWeight: '700', color: colorss.primary },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cta: { fontSize: 11 },
});
