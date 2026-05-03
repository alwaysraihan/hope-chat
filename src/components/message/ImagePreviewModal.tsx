import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import Video from 'react-native-video';

import { colorss } from '../../theme';
import { Download } from 'lucide-react-native';
import { useMediaDownload } from '../../hooks/useMediaDownload';

//  Constants

const { width: SW, height: SH } = Dimensions.get('window');

//  Types

interface MediaPreviewModalProps {
  visible: boolean;
  mediaUrl: string | null;
  mediaType?: 'image' | 'video';
  onClose: () => void;
}

//  Component

const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  visible,
  mediaUrl,
  mediaType = 'image',
  onClose,
}) => {
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const { download } = useMediaDownload();
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(bgOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 80,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bgOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.88,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 30,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, bgOpacity, scale, translateY]);

  if (!mediaUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]}>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => {
              download(mediaUrl);
              onClose();
            }}
            hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
          >
            <View style={styles.closePill}>
              <Download color={colorss.white} size={18} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <View style={styles.closePill}>
              <Text style={styles.closeIcon}>✕</Text>
            </View>
          </TouchableOpacity>
        </View>
        <Animated.View
          style={[
            styles.mediaContainer,
            { transform: [{ scale }, { translateY }] },
          ]}
        >
          {mediaType === 'video' ? (
            <Video
              source={{ uri: mediaUrl }}
              style={styles.video}
              controls
              resizeMode="contain"
              paused={false}
            />
          ) : (
            <FastImage
              source={{ uri: mediaUrl }}
              style={styles.image}
              resizeMode={FastImage.resizeMode.contain}
            />
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default React.memo(MediaPreviewModal);

//  Styles

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.90)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
  },

  closePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 22,
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  closeIcon: {
    color: colorss.white,
    fontSize: 16,
    fontWeight: '600',
  },
  mediaContainer: {
    width: SW,
    height: SH * 0.78,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SW,
    height: SH * 0.78,
  },
  video: {
    width: SW,
    height: SH * 0.5,
    backgroundColor: '#000',
  },
});
