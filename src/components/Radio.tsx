import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { colorss } from '../theme';

const Radio = ({ selected, onPress = () => {} }) => (
  <TouchableOpacity onPress={onPress}>
    <View style={styles.radioOuter}>
      {selected && <View style={styles.radioInner} />}
    </View>
  </TouchableOpacity>
);

export default Radio;

const styles = StyleSheet.create({
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colorss.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colorss.primary,
  },
});
