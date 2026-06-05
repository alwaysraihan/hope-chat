import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';
import { X } from 'lucide-react-native';
import { colorss } from '../theme';

type Props = {
  visible: boolean;
  url: string | null;
  title?: string;
  onClose: () => void;
  onPaymentComplete?: () => void;
  /** Return URL prefix from the checkout API. When provided, intercepts the
   *  exact return URL (matching Hopenity's flow) instead of relying on generic
   *  pattern matching that may not fire for all payment gateways. */
  matchUrlPrefix?: string | null;
};

export function PaymentWebViewModal({
  visible,
  url,
  title = 'Top Up Wallet',
  onClose,
  onPaymentComplete,
  matchUrlPrefix,
}: Props) {
  const insets = useSafeAreaInsets();
  const [loadingPage, setLoadingPage] = useState(true);
  const completedRef = useRef(false);

  const complete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onPaymentComplete?.();
    onClose();
  };

  // Priority 1: intercept the exact return URL prefix from the checkout API.
  // Blocks the WebView from navigating to the return page (which may be blank).
  const handleShouldStartLoad = (request: ShouldStartLoadRequest): boolean => {
    if (matchUrlPrefix && request.url.startsWith(matchUrlPrefix)) {
      complete();
      return false;
    }
    return true;
  };

  // Priority 2 (fallback): generic pattern matching when no returnUrlPrefix.
  const handleNavigationChange = (nav: WebViewNavigation) => {
    if (matchUrlPrefix) return; // already handled by onShouldStartLoadWithRequest
    const u = nav.url.toLowerCase();
    if (
      u.includes('/success') ||
      u.includes('payment_success') ||
      u.includes('topup/success') ||
      u.includes('return') ||
      u.includes('callback')
    ) {
      complete();
    }
  };

  // Reset completion guard when a new WebView session starts.
  React.useEffect(() => {
    if (visible) completedRef.current = false;
  }, [visible, url]);

  if (!url) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={s.closeBtn}
          >
            <X size={22} color={colorss.textPrimary} />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <View style={s.closeBtn} />
        </View>

        {/* WebView */}
        <View style={s.webviewWrap}>
          <WebView
            source={{ uri: url }}
            style={s.webview}
            onLoadStart={() => setLoadingPage(true)}
            onLoadEnd={() => setLoadingPage(false)}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onNavigationStateChange={handleNavigationChange}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
          />
          {loadingPage && (
            <View style={s.loader}>
              <ActivityIndicator size="large" color={colorss.primary} />
              <Text style={s.loaderText}>Loading secure payment…</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colorss.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
    backgroundColor: colorss.white,
  },
  closeBtn: { width: 32, alignItems: 'center' },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colorss.textPrimary,
    textAlign: 'center',
  },
  webviewWrap: { flex: 1 },
  webview: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colorss.white,
    gap: 12,
  },
  loaderText: { fontSize: 14, color: colorss.textSecondary },
});
