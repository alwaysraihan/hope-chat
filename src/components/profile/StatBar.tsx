import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { spacing, fonts } from '../../theme';

const STAT_LABELS = ['friends', 'followers', 'following', 'groups'];

const StatBar = ({ stats }) => {
  return (
    <View style={styles.container}>
      {STAT_LABELS.map((key, idx) => (
        <React.Fragment key={key}>
          {idx > 0 && <View style={styles.divider} />}
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => Alert.alert(key.charAt(0).toUpperCase() + key.slice(1))}
            activeOpacity={0.7}
          >
            <Text style={styles.statNum}>{stats[key]}</Text>
            <Text style={styles.statLabel}>{key}</Text>
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginTop: 16,
    backgroundColor: '#151525',
    borderRadius: 16,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 3,
  },
  divider: {
    width: 0.5,
    backgroundColor: '#2a2a3d',
  },
  statNum: {
    fontSize: 18,
    fontWeight: fonts.bold,
    color: '#F0F0FF',
  },
  statLabel: {
    fontSize: 10,
    color: '#6a6a8a',
    fontWeight: fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.05 * 10,
  },
});

export default StatBar;
