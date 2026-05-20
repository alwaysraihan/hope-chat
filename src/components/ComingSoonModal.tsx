import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { colorss } from '../theme';
import { useT } from '../hooks/useT';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const ComingSoonModal: React.FC<Props> = ({ visible, onClose }) => {
  const t = useT();
  const scaleAnim = useRef(new Animated.Value(0.82)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
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
      scaleAnim.setValue(0.82);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.card,
                { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
              ]}
            >
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <X size={18} color={colorss.textSecondary} />
              </TouchableOpacity>

              <View style={styles.emojiWrap}>
                <Text style={styles.emoji}>🍳</Text>
              </View>

              <Text style={styles.title}>{t.coming_soon_title}</Text>
              <Text style={styles.body}>{t.coming_soon_body}</Text>
              <View style={styles.divider} />

              <View style={styles.chipRow}>
                {([t.coming_soon_design, t.coming_soon_build, t.coming_soon_polish] as const).map(
                  (step, i) => (
                    <View
                      key={step}
                      style={[
                        styles.chip,
                        i === 0 && styles.chipDone,
                        i === 1 && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          i === 0 && styles.chipTextDone,
                          i === 1 && styles.chipTextActive,
                        ]}
                      >
                        {i === 0 ? '✓ ' : i === 1 ? '⚡ ' : '⏳ '}
                        {step}
                      </Text>
                    </View>
                  ),
                )}
              </View>

              <TouchableOpacity style={styles.okBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={styles.okText}>{t.got_it}</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default ComingSoonModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: colorss.white,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
    borderRadius: 20,
    backgroundColor: colorss.background,
  },
  emojiWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colorss.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emoji: { fontSize: 40 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colorss.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: colorss.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 20,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colorss.border,
    marginBottom: 18,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colorss.background,
    borderWidth: 1,
    borderColor: colorss.border,
  },
  chipDone: { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
  chipActive: { backgroundColor: `${colorss.primary}15`, borderColor: colorss.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colorss.textSecondary },
  chipTextDone: { color: '#15803d' },
  chipTextActive: { color: colorss.primary },
  okBtn: {
    width: '100%',
    backgroundColor: colorss.primary,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
  },
  okText: { color: colorss.white, fontWeight: '700', fontSize: 16 },
});
