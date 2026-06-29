import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { X } from 'lucide-react-native';

import {
  fetchMySellerProfile,
  fetchSellerProducts,
  formatHoppiPrice,
  getHoppiToken,
  HoppiProduct,
  HoppiSeller,
  productShareUrl,
} from '../../services/hoppiService';
import { colorss } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

interface Props {
  visible: boolean;
  hopenityToken: string | null;
  onClose: () => void;
  onSelectProduct: (url: string) => void;
}

export const SellerProductSheet: React.FC<Props> = ({
  visible,
  hopenityToken,
  onClose,
  onSelectProduct,
}) => {
  const { isDark, colors } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [seller, setSeller] = useState<HoppiSeller | null>(null);
  const [products, setProducts] = useState<HoppiProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !hopenityToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProducts([]);
    setSeller(null);

    (async () => {
      const hoppiToken = await getHoppiToken(hopenityToken);
      if (!hoppiToken) {
        if (!cancelled) setError('Could not connect to hoppi.live');
        return;
      }
      const s = await fetchMySellerProfile(hoppiToken);
      if (!s) {
        if (!cancelled) setError('You don\'t have a seller account on hoppi.live');
        return;
      }
      if (cancelled) return;
      setSeller(s);
      const items = await fetchSellerProducts(hoppiToken, s._id);
      if (!cancelled) setProducts(items);
    })()
      .catch(() => { if (!cancelled) setError('Failed to load products'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [visible, hopenityToken]);

  const bg = isDark ? colors.background : '#fff';
  const border = isDark ? '#333' : '#e5e5e5';
  const textColor = isDark ? '#fff' : '#111';
  const subColor = isDark ? '#aaa' : '#666';

  const renderItem = useCallback(({ item }: { item: HoppiProduct }) => {
    const imgUrl = item.images?.[0];
    const title = item.title ?? item.name ?? 'Product';
    const priceStr = formatHoppiPrice(item);
    const url = productShareUrl(item);
    return (
      <TouchableOpacity
        style={[styles.item, { borderBottomColor: border }]}
        onPress={() => { onSelectProduct(url); onClose(); }}
        activeOpacity={0.7}
      >
        {imgUrl ? (
          <FastImage
            source={{ uri: imgUrl }}
            style={styles.thumb}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        <View style={styles.itemInfo}>
          <Text style={[styles.itemTitle, { color: textColor }]} numberOfLines={2}>
            {title}
          </Text>
          {priceStr ? (
            <Text style={[styles.itemPrice]}>{priceStr}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }, [border, textColor, onSelectProduct, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: bg, borderColor: border }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: border }]}>
          <Text style={[styles.headerTitle, { color: textColor }]}>
            {seller ? (seller.shopName ?? seller.name ?? 'My Products') : 'My Products'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={subColor} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colorss.primary} />
            <Text style={[styles.loadingText, { color: subColor }]}>
              Loading your products…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={[styles.errorText, { color: subColor }]}>{error}</Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.errorText, { color: subColor }]}>
              No products found in your shop.
            </Text>
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={p => p._id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 4 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: '#ddd' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  itemPrice: { fontSize: 13, fontWeight: '700', color: colorss.primary, marginTop: 2 },
});
