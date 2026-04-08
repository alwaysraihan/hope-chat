import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const CoverBanner = ({ isOwnProfile }) => {
  return (
    <View style={styles.cover}>
      <LinearGradient
        colors={['#1a1030', '#2d1060', '#1a1030']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.rings}>
        <View style={styles.ring1} />
        <View style={styles.ring2} />
        <View style={styles.ring3} />
        <View style={styles.ring4} />
      </View>
      {isOwnProfile && (
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => Alert.alert('Edit Cover', 'Choose a new cover photo')}
          activeOpacity={0.7}
        >
          <Text style={styles.editText}>Edit cover</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cover: {
    height: 140,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  rings: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ring1: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 0.5, borderColor: 'rgba(255,78,140,0.5)',
    top: 10, left: -20,
  },
  ring2: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    borderWidth: 0.5, borderColor: 'rgba(255,78,140,0.25)',
    top: -20, left: -50,
  },
  ring3: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    borderWidth: 0.5, borderColor: 'rgba(236,72,153,0.4)',
    top: -10, right: 30,
  },
  ring4: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    borderWidth: 0.5, borderColor: 'rgba(236,72,153,0.2)',
    top: -30, right: 5,
  },
  editBtn: {
    position: 'absolute', bottom: 10, right: 14,
    backgroundColor: 'rgba(15,15,26,0.7)',
    borderWidth: 1, borderColor: '#3a3a54',
    borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10,
  },
  editText: { fontSize: 11, color: '#c0c0d8' },
});

export default CoverBanner;
