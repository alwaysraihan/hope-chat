import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  fetchMyCart,
  fetchMyPurchases,
  fetchMySellerProfile,
  fetchSellerProducts,
  formatHoppiPrice,
  getHoppiSession,
  HoppiCartItem,
  HoppiProduct,
  HoppiPurchasedProduct,
  HoppiSeller,
  HoppiSession,
  productIdShareUrl,
  productShareUrl,
} from '../../services/hoppiService';
import { colorss } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

type ShopTab = 'cart' | 'purchases' | 'products';

interface Props {
  visible: boolean;
  hopenityToken: string | null;
  onClose: () => void;
  onSelectProduct: (url: string) => void;
}

/**
 * Shop sheet opened from the chat composer's shop icon.
 *
 * Tabs: "My Cart" and "My Purchases" for every user, plus "My Products" when
 * the user has a hoppi.live seller account. Tapping any item shares its
 * product link into the conversation — so anyone (not just sellers) can share
 * products in chat.
 */
export const ShopSheet: React.FC<Props> = ({
  visible,
  hopenityToken,
  onClose,
  onSelectProduct,
}) => {
  const { isDark, colors } = useAppTheme();
  const [activeTab, setActiveTab] = useState<ShopTab>('cart');
  const [session, setSession] = useState<HoppiSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [seller, setSeller] = useState<HoppiSeller | null>(null);

  const [cartItems, setCartItems] = useState<HoppiCartItem[] | null>(null);
  const [purchases, setPurchases] = useState<HoppiPurchasedProduct[] | null>(null);
  const [products, setProducts] = useState<HoppiProduct[] | null>(null);
  const [tabLoading, setTabLoading] = useState(false);

  // Establish the hoppi.live session and seller status each time the sheet
  // opens; per-tab data resets so the sheet always shows fresh content.
  useEffect(() => {
    if (!visible || !hopenityToken) return;
    let cancelled = false;
    setSession(null);
    setSessionError(null);
    setSeller(null);
    setCartItems(null);
    setPurchases(null);
    setProducts(null);
    setActiveTab('cart');

    (async () => {
      const s = await getHoppiSession(hopenityToken);
      if (cancelled) return;
      if (!s) {
        setSessionError('Could not connect to hoppi.live');
        return;
      }
      setSession(s);
      const sellerProfile = await fetchMySellerProfile(s.hoppiToken);
      if (!cancelled) setSeller(sellerProfile);
    })().catch(() => {
      if (!cancelled) setSessionError('Could not connect to hoppi.live');
    });

    return () => { cancelled = true; };
  }, [visible, hopenityToken]);

  // Load the active tab's data lazily, once per sheet-open.
  useEffect(() => {
    if (!visible || !session) return;
    const alreadyLoaded =
      (activeTab === 'cart' && cartItems !== null) ||
      (activeTab === 'purchases' && purchases !== null) ||
      (activeTab === 'products' && products !== null);
    if (alreadyLoaded) return;

    let cancelled = false;
    setTabLoading(true);
    (async () => {
      if (activeTab === 'cart') {
        const items = await fetchMyCart(session);
        if (!cancelled) setCartItems(items);
      } else if (activeTab === 'purchases') {
        const items = await fetchMyPurchases(session);
        if (!cancelled) setPurchases(items);
      } else if (seller) {
        const items = await fetchSellerProducts(session.hoppiToken, seller._id);
        if (!cancelled) setProducts(items);
      }
    })()
      .catch(() => {})
      .finally(() => { if (!cancelled) setTabLoading(false); });

    return () => { cancelled = true; };
  }, [visible, session, seller, activeTab, cartItems, purchases, products]);

  const bg = isDark ? colors.background : '#fff';
  const border = isDark ? '#333' : '#e5e5e5';
  const textColor = isDark ? '#fff' : '#111';
  const subColor = isDark ? '#aaa' : '#666';

  const shareUrl = useCallback((url: string | null) => {
    if (!url) return;
    onSelectProduct(url);
    onClose();
  }, [onSelectProduct, onClose]);

  const renderRow = useCallback(
    (imgUrl: string | undefined, title: string, priceLine: string | null, url: string | null, key: string, subtitle?: string) => (
      <TouchableOpacity
        key={key}
        style={[styles.item, { borderBottomColor: border }, !url && styles.itemDisabled]}
        onPress={() => shareUrl(url)}
        disabled={!url}
        activeOpacity={0.7}
      >
        {imgUrl ? (
          <FastImage source={{ uri: imgUrl }} style={styles.thumb} resizeMode={FastImage.resizeMode.cover} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        <View style={styles.itemInfo}>
          <Text style={[styles.itemTitle, { color: textColor }]} numberOfLines={2}>{title}</Text>
          {priceLine ? <Text style={styles.itemPrice}>{priceLine}</Text> : null}
          {subtitle ? <Text style={[styles.itemSubtitle, { color: subColor }]}>{subtitle}</Text> : null}
        </View>
        <Text style={[styles.shareHint, { color: url ? colorss.primary : subColor }]}>
          {url ? 'Share' : ''}
        </Text>
      </TouchableOpacity>
    ),
    [border, textColor, subColor, shareUrl],
  );

  const tabs = useMemo(() => {
    const base: Array<{ key: ShopTab; label: string }> = [
      { key: 'cart', label: 'My Cart' },
      { key: 'purchases', label: 'My Purchases' },
    ];
    if (seller) base.push({ key: 'products', label: 'My Products' });
    return base;
  }, [seller]);

  const renderTabContent = () => {
    if (sessionError) {
      return <View style={styles.center}><Text style={[styles.errorText, { color: subColor }]}>{sessionError}</Text></View>;
    }
    if (!session || tabLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colorss.primary} />
        </View>
      );
    }

    if (activeTab === 'cart') {
      if (!cartItems?.length) {
        return <View style={styles.center}><Text style={[styles.errorText, { color: subColor }]}>Your cart is empty.</Text></View>;
      }
      return (
        <FlatList
          data={cartItems}
          keyExtractor={(item, index) => `${item.id}:${index}`}
          renderItem={({ item, index }) =>
            renderRow(
              item.icon,
              item.name,
              `৳${item.price} × ${item.quantity}`,
              productIdShareUrl(item.id),
              `${item.id}:${index}`,
              item.variantLabel,
            )
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      );
    }

    if (activeTab === 'purchases') {
      if (!purchases?.length) {
        return <View style={styles.center}><Text style={[styles.errorText, { color: subColor }]}>No purchases yet.</Text></View>;
      }
      return (
        <FlatList
          data={purchases}
          keyExtractor={(item, index) => `${item.productId ?? item.name}:${index}`}
          renderItem={({ item, index }) =>
            renderRow(
              item.imageUrl,
              item.name,
              `৳${item.price} × ${item.quantity}`,
              productIdShareUrl(item.productId),
              `${item.productId ?? item.name}:${index}`,
              item.orderStatus ? `Order ${item.orderStatus}` : undefined,
            )
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      );
    }

    if (!products?.length) {
      return <View style={styles.center}><Text style={[styles.errorText, { color: subColor }]}>No products found in your shop.</Text></View>;
    }
    return (
      <FlatList
        data={products}
        keyExtractor={p => p._id}
        renderItem={({ item }) =>
          renderRow(
            item.images?.[0],
            item.title ?? item.name ?? 'Product',
            formatHoppiPrice(item),
            productShareUrl(item),
            item._id,
          )
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: bg, borderColor: border }]}>
        <View style={[styles.header, { borderBottomColor: border }]}>
          <Text style={[styles.headerTitle, { color: textColor }]}>Shop</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={subColor} />
          </TouchableOpacity>
        </View>

        <View style={[styles.tabBar, { borderBottomColor: border }]}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === tab.key ? colorss.primary : subColor },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {renderTabContent()}
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
    maxHeight: '75%',
    minHeight: 320,
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colorss.primary,
  },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemDisabled: { opacity: 0.55 },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: '#ddd' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  itemPrice: { fontSize: 13, fontWeight: '700', color: colorss.primary, marginTop: 2 },
  itemSubtitle: { fontSize: 11, marginTop: 2 },
  shareHint: { fontSize: 12, fontWeight: '600' },
});
