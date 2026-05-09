import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Radio from '../Radio';
import { colorss } from '../../theme';

const OptionModal = ({
  visible,
  title,
  data,
  selected,
  onSelect,
  onCancel,
  onConfirm,
}) => {
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.centerModal}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>{title}</Text>

          <View style={{ gap: 16, marginVertical: 20 }}>
            {data.map(item => (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                style={styles.optionRow}
              >
                <Radio selected={selected === item.id} />
                <Text>{item.title}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.modalActions}>
            <Pressable onPress={onCancel}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>

            <Pressable onPress={onConfirm}>
              <Text style={styles.ok}>OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default OptionModal;

const styles = StyleSheet.create({
  centerModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  modalBox: {
    width: '85%',
    backgroundColor: colorss.background,
    borderRadius: 12,
    padding: 20,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colorss.textPrimary,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },

  cancel: {
    color: colorss.accent,
    fontSize: 14,
    fontWeight: '500',
  },

  ok: {
    color: colorss.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
