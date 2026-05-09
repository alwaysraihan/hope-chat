import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ban, BellOff, Shield } from 'lucide-react-native';

import { colorss } from '../theme';

const BlockUserScreen = ({ navigation }) => {
  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>Block Emon Hossain?</Text>

      {[
        {
          Icon: Ban,
          title: 'Unfriend them',
          desc: 'Blocking removes them from your friends.',
        },
        {
          Icon: BellOff,
          title: 'Stop contact',
          desc: 'They can’t message or call you.',
        },
        {
          Icon: Shield,
          title: 'Private action',
          desc: 'They won’t be notified.',
        },
      ].map(({ Icon, title, desc }) => (
        <View key={title} style={styles.row}>
          <View style={styles.iconBox}>
            <Icon size={18} color={colorss.textPrimary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{title}</Text>
            <Text style={styles.rowDesc}>{desc}</Text>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.blockBtn}>
        <Text style={styles.blockText}>Block Emon Hossain</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.cancel}>Not ready to block?</Text>
      </TouchableOpacity>
    </View>
  );
};

export default BlockUserScreen;

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colorss.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colorss.textPrimary,
    marginBottom: 20,
  },

  row: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },

  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colorss.backgroundDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },

  rowTitle: {
    color: colorss.textPrimary,
    fontWeight: '600',
  },

  rowDesc: {
    color: colorss.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },

  blockBtn: {
    backgroundColor: colorss.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },

  blockText: {
    color: colorss.white,
    fontWeight: '700',
  },

  cancel: {
    textAlign: 'center',
    color: colorss.accent,
    marginTop: 14,
  },
});
