import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { colorss } from '../../theme';
import raihan from '../../assets/raihan-sarkar.webp';

const ChatProfileHeader = ({ friendName = 'Raihan Sarkar' }) => {
  return (
    <View style={styles.container}>
      <FastImage source={raihan} style={styles.mainProfileImage} />
      <Text style={styles.userName}>RAIHAN SARKAR</Text>
      <Text style={styles.subtitle}>You're chatting with {friendName}</Text>
      <View style={styles.bannerContainer}>
        <View style={styles.avatarsWrapper}>
          <View style={[styles.avatarRing, styles.leftAvatar]}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/300?img=3' }}
              style={styles.avatar}
            />
          </View>

          <View style={[styles.avatarRing, styles.rightAvatar]}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/300?img=5' }}
              style={styles.avatar}
            />
          </View>
        </View>

        <Text style={styles.caption}>
          Say hi to your new Hopenity friend,{' '}
          <Text style={styles.friendName}>{friendName}</Text>.
        </Text>
      </View>
    </View>
  );
};

export default ChatProfileHeader;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
  },

  mainProfileImage: {
    width: 100,
    height: 100,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: colorss.primary,
  },

  userName: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 8,
    color: colorss.textPrimary,
  },

  subtitle: {
    fontSize: 14,
    marginTop: 4,
    color: '#666',
  },

  bannerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },

  avatarsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    height: 72,
    width: 120,
    position: 'relative',
  },

  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 34,
    overflow: 'hidden',
    position: 'absolute',
  },

  leftAvatar: {
    left: 12,
    zIndex: 1,
  },

  rightAvatar: {
    left: 50,
    zIndex: 2,
    borderLeftWidth: 2,
    borderLeftColor: '#fff',
  },

  avatar: {
    width: '100%',
    height: '100%',
  },

  caption: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },

  friendName: {
    fontWeight: '600',
    color: '#222',
  },
});
