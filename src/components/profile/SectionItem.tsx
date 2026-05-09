import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colorss } from '../../theme';

const SectionItem = ({ item }) => {
  const borderBottom = ['Nicknames', 'Create group', 'Block'];
  const style = borderBottom.includes(item.title)
    ? {}
    : { borderBottomWidth: 1, borderBottomColor: colorss.border };
  return (
    <TouchableOpacity onPress={item.onPress} style={[styles.row, style]}>
      <Text style={styles.rowText}>{item.title}</Text>
      {item.image}
    </TouchableOpacity>
  );
};

export default SectionItem;

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 14,
    color: colorss.primaryLight,
    marginBottom: 6,
    marginTop: 10,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },

  rowText: {
    fontSize: 17,
    color: colorss.textPrimary,
    fontWeight: '500',
  },
});
