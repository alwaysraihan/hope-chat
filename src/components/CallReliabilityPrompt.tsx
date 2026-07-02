import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { BellRing, PhoneIncoming } from 'lucide-react-native';

import { colorss } from '../theme';
import {
  CALL_RELIABILITY_PROMPT_EVENT,
  openCallReliabilitySettings,
  type CallReliabilityPromptPayload,
} from '../services/incomingCall/callReliability';

/**
 * Branded replacement for the system Alert previously shown by
 * ensureCallReliability(). Mounted once (from IncomingCallListener) and shown
 * whenever the reliability check finds a setting that would silence incoming
 * calls in the background — same UX pattern as WhatsApp's battery prompt.
 */
const CallReliabilityPrompt: React.FC = () => {
  const [prompt, setPrompt] = useState<CallReliabilityPromptPayload | null>(
    null,
  );
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      CALL_RELIABILITY_PROMPT_EVENT,
      (payload: CallReliabilityPromptPayload) => setPrompt(payload),
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (prompt) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 90,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [prompt, scaleAnim, opacityAnim]);

  const dismiss = useCallback(() => setPrompt(null), []);

  const openSettings = useCallback(() => {
    const kind = prompt?.kind;
    setPrompt(null);
    if (kind) void openCallReliabilitySettings(kind);
  }, [prompt]);

  if (!prompt) return null;

  const Icon = prompt.kind === 'notifications' ? BellRing : PhoneIncoming;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={dismiss}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.card,
                { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
              ]}
            >
              <View style={styles.iconWrap}>
                <Icon size={34} color={colorss.primary} strokeWidth={2.2} />
              </View>

              <Text style={styles.title}>{prompt.title}</Text>
              <Text style={styles.body}>{prompt.message}</Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={openSettings}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryText}>Open settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={dismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryText}>Not now</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default CallReliabilityPrompt;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: colorss.white,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: `${colorss.primary}14`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: colorss.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: colorss.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: colorss.primary,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: colorss.white, fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {
    color: colorss.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
});
