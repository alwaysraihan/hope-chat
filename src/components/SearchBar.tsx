import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

// Simple SVG-free search icon using View shapes
const SearchIcon = () => (
  <View style={styles.iconWrap}>
    <View style={styles.iconCircle} />
    <View style={styles.iconHandle} />
  </View>
);

const SearchBar = ({ onChangeText, value }) => {
  return (
    <View style={styles.container}>
      <SearchIcon />
      <TextInput
        style={styles.input}
        placeholder="Search messages…"
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e30',
    marginHorizontal: spacing.xl,
    marginBottom: 14,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  iconWrap: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  iconCircle: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  iconHandle: {
    width: 1.5,
    height: 5,
    backgroundColor: colors.textMuted,
    position: 'absolute',
    bottom: 0,
    right: 1,
    transform: [{ rotate: '-45deg' }],
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    padding: 0,
  },
});

export default SearchBar;
