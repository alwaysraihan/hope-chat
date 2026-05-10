import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colorss } from '../../theme';

const SectionItem = ({ item }) => {
  const borderBottom = ['Nicknames', 'Create group', 'Block'];
  const hasBorder = !borderBottom.includes(item.title);

  return (
    <TouchableOpacity
      onPress={item.onPress}
      style={[styles.row, hasBorder && styles.rowBorder]}
    >
      <Text style={styles.rowText}>{item.title}</Text>
      {item.image}
    </TouchableOpacity>
  );
};

export default SectionItem;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
  },

  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },

  rowText: {
    fontSize: 16,
    fontWeight: '500',
    color: colorss.textPrimary,
    flex: 1,
  },
});