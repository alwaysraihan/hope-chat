/**
 * Cross-platform in-app toast notification.
 *
 * Usage (imperative, call from anywhere):
 *   Toast.show('Saved to gallery!', 'success')
 *   Toast.show('Download failed', 'error')
 *   Toast.show('Downloading…', 'loading')
 *
 * Render <ToastContainer /> once at the app root (inside NavigationContainer).
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CheckCircle, XCircle, Info, Loader } from 'lucide-react-native';
import { colorss } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'loading';

interface ToastEntry {
  message: string;
  type: ToastType;
  id: number;
}

// ─── Singleton ref ────────────────────────────────────────────────────────────

type ShowFn = (message: string, type?: ToastType, durationMs?: number) => void;
let _show: ShowFn | null = null;

export const Toast = {
  show: (message: string, type: ToastType = 'info', durationMs?: number) => {
    _show?.(message, type, durationMs);
  },
  success: (message: string) => _show?.(message, 'success'),
  error: (message: string) => _show?.(message, 'error'),
  info: (message: string) => _show?.(message, 'info'),
  loading: (message: string) => _show?.(message, 'loading', 30_000),
};

// ─── Icon helper ─────────────────────────────────────────────────────────────

function ToastIcon({ type }: { type: ToastType }) {
  const size = 18;
  switch (type) {
    case 'success':
      return <CheckCircle size={size} color="#22c55e" />;
    case 'error':
      return <XCircle size={size} color="#ef4444" />;
    case 'loading':
      return <Loader size={size} color={colorss.primary} />;
    default:
      return <Info size={size} color="#60a5fa" />;
  }
}

// ─── Container (render at app root) ──────────────────────────────────────────

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);

  const show: ShowFn = useCallback((message, type = 'info', durationMs = 2800) => {
    const id = ++idRef.current;
    setToasts(prev => {
      // When showing a result (success / error / info), remove any lingering
      // "loading" toasts so they don't pile up on top of the result.
      const base = type === 'loading'
        ? prev.slice(-2)                          // loading: keep recent, add this
        : prev.slice(-2).filter(t => t.type !== 'loading'); // result: evict loading first
      return [...base, { message, type, id }];
    });
    // Loading toasts are manually evicted by the next success/error call above.
    // All other types auto-dismiss after durationMs.
    if (type !== 'loading') {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, durationMs);
    }
  }, []);

  useEffect(() => {
    _show = show;
    return () => { _show = null; };
  }, [show]);

  return (
    <View style={styles.stack} pointerEvents="none">
      {toasts.map(t => (
        <ToastItem key={t.id} entry={t} />
      ))}
    </View>
  );
}

// ─── Individual toast item ────────────────────────────────────────────────────

function ToastItem({ entry }: { entry: ToastEntry }) {
  const translateY = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <ToastIcon type={entry.type} />
      <Text style={styles.message} numberOfLines={2}>{entry.message}</Text>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    bottom: 72,
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(22,22,28,0.92)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    flex: 1,
    color: '#f2f2f2',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
