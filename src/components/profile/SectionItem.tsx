import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colorss } from '../../theme';

const SectionItem = ({ item }) => {
  return (
    <TouchableOpacity onPress={item.onPress} style={styles.row}>
      {item.image}
      <Text style={styles.rowText}>{item.title}</Text>
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
    gap: 12,
    paddingVertical: 6,
  },

  rowText: {
    fontSize: 15,
    color: colorss.textPrimary,
    fontWeight: '500',
  },
});
