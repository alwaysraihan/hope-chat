import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { radius, spacing } from '../../theme';
import { LucideSearch } from 'lucide-react-native';
import { useAppTheme } from '../../context/ThemeContext';

const SearchBar = ({ onSearchPress }) => {
  const { colors } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          // Same token the filter tab pills (All/Unread/Booking/…) already
          // use, so the search field reads as visibly distinct from the
          // page background in both light and dark mode instead of nearly
          // blending into it.
          backgroundColor: colors.bubbleIn,
          marginHorizontal: spacing.xl,
          marginBottom: 8,
          borderRadius: 9999,
          paddingHorizontal: 16,
          paddingVertical: 9,
          gap: 10,
        },
        input: {
          flex: 1,
          fontSize: 17,
          color: colors.textSecondary,
          padding: 0,
        },
      }),
    [colors],
  );

  return (
    <TouchableOpacity onPress={onSearchPress} activeOpacity={0.7}>
      <View style={styles.container}>
        <LucideSearch size={16} color={colors.textSecondary} />
        <Text style={styles.input}>Search People…</Text>
      </View>
    </TouchableOpacity>
  );
};

export default SearchBar;
