import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Bluetooth,
  Check,
  Headphones,
  Phone,
  Speaker,
  Volume2,
  X,
} from 'lucide-react-native';
import { colorss } from '../theme';
import type { AudioOutputDevice, AudioOutputKind } from '../hooks/useCallAudio';

type Props = {
  visible: boolean;
  outputs: AudioOutputDevice[];
  onSelect: (device: AudioOutputDevice) => void;
  onClose: () => void;
};

const ICONS: Record<AudioOutputKind, (color: string, size: number) => React.ReactNode> = {
  earpiece: (color, size) => <Phone size={size} color={color} />,
  speaker: (color, size) => <Volume2 size={size} color={color} />,
  wired: (color, size) => <Headphones size={size} color={color} />,
  bluetooth: (color, size) => <Bluetooth size={size} color={color} />,
  route_picker: (color, size) => <Speaker size={size} color={color} />,
};

/**
 * Bottom-sheet picker shown from the in-call "speaker" button. Lists every
 * audio output the device reports (earpiece, loud-speaker, wired headphones,
 * each connected Bluetooth device) plus — on iOS — an "Other devices…" row
 * that opens the native AVRoutePickerView for AirPlay / Hearing Aid choices
 * that LiveKit cannot enumerate by name.
 */
export const AudioOutputPickerSheet: React.FC<Props> = ({
  visible,
  outputs,
  onSelect,
  onClose,
}) => {
  const items = useMemo(
    () => outputs.filter(o => o.id && o.label),
    [outputs],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          // Stop press-through so tapping a row doesn't dismiss the sheet.
          onPress={evt => evt.stopPropagation?.()}
          style={styles.sheet}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Audio output</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close audio output picker"
            >
              <X size={22} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>

          {items.length === 0 ? (
            <Text style={styles.emptyText}>
              No audio outputs detected yet. Connect a Bluetooth or wired device
              and try again.
            </Text>
          ) : (
            items.map(item => {
              const renderIcon = ICONS[item.id];
              const iconColor = item.isActive ? colorss.primary : '#FFFFFF';
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onSelect(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.isActive }}
                  accessibilityLabel={`${item.label}${
                    item.isActive ? ', currently active' : ''
                  }`}
                  style={({ pressed }) => [
                    styles.row,
                    pressed ? styles.rowPressed : null,
                    item.isActive ? styles.rowActive : null,
                  ]}
                >
                  <View style={styles.iconWrap}>
                    {renderIcon ? renderIcon(iconColor, 22) : null}
                  </View>
                  <Text
                    style={[
                      styles.rowLabel,
                      item.isActive ? styles.rowLabelActive : null,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.isActive ? (
                    <Check size={20} color={colorss.primary} />
                  ) : (
                    <View style={styles.checkPlaceholder} />
                  )}
                </Pressable>
              );
            })
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#181826',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowActive: {
    backgroundColor: 'rgba(255,78,140,0.12)',
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  rowLabelActive: {
    color: colorss.primary,
    fontWeight: '700',
  },
  checkPlaceholder: {
    width: 20,
    height: 20,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    paddingVertical: 12,
    textAlign: 'center',
  },
});

export default AudioOutputPickerSheet;
