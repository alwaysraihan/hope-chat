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
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>{title}</Text>

          <View style={styles.optionList}>
            {data.map(item => (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                style={styles.optionRow}
              >
                <Radio selected={selected === item.id} />
                <Text style={styles.optionText}>{item.title}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>

            <Pressable onPress={onConfirm} hitSlop={8}>
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
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 32,
  },

  modalBox: {
    width: '100%',
    backgroundColor: colorss.white,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: colorss.textPrimary,
  },

  optionList: {
    gap: 14,
    marginTop: 20,
    marginBottom: 24,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  optionText: {
    fontSize: 15,
    fontWeight: '400',
    color: colorss.textPrimary,
    flex: 1,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
  },

  cancel: {
    color: colorss.accent,
    fontSize: 15,
    fontWeight: '500',
  },

  ok: {
    color: colorss.accent,
    fontSize: 15,
    fontWeight: '600',
  },
});
