import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { colorss, radius, spacing } from '../../theme';
import { LucideSearch } from 'lucide-react-native';

const SearchBar = ({ onSearchPress }) => {
  return (
    <TouchableOpacity onPress={onSearchPress} activeOpacity={0.7}>
      <View style={styles.container}>
        <LucideSearch size={16} color={colorss.textSecondary} />
        <Text style={styles.input}>Search messages…</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorss.background,
    marginHorizontal: spacing.xl,
    marginBottom: 14,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colorss.textSecondary,
    padding: 0,
  },
});

export default SearchBar;
