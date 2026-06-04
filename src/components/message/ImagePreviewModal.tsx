import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import Video from 'react-native-video';
import { Download, X, CheckCircle } from 'lucide-react-native';

import { colorss } from '../../theme';
import { useMediaDownload } from '../../hooks/useMediaDownload';

const { width: SW, height: SH } = Dimensions.get('window');

interface MediaPreviewModalProps {
  visible: boolean;
  mediaUrl: string | null;
  mediaType?: 'image' | 'video';
  onClose: () => void;
}

const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  visible,
  mediaUrl,
  mediaType = 'image',
  onClose,
}) => {
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const { download, downloadState, progress } = useMediaDownload();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.88, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 30, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, bgOpacity, scale, translateY]);

  if (!mediaUrl) return null;

  const isDownloading = downloadState === 'downloading';
  const isDone = downloadState === 'done';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]}>
          {/* Action buttons */}
          <TouchableWithoutFeedback>
            <View style={styles.actions}>
              {/* Download button — stays open, shows progress inline */}
              <TouchableOpacity
                onPress={() => { if (!isDownloading) download(mediaUrl, mediaType); }}
                hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
                disabled={isDownloading}
              >
                <View style={styles.actionPill}>
                  {isDownloading ? (
                    <ActivityIndicator size="small" color={colorss.white} />
                  ) : isDone ? (
                    <CheckCircle size={18} color="#22c55e" />
                  ) : (
                    <Download size={18} color={colorss.white} />
                  )}
                </View>
              </TouchableOpacity>

              {/* Close button */}
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <View style={styles.actionPill}>
                  <X size={18} color={colorss.white} />
                </View>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>

          {/* Progress bar at top */}
          {isDownloading && (
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
          )}

          {/* Media */}
          <TouchableWithoutFeedback>
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
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default React.memo(MediaPreviewModal);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
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
  actionPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 22,
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 20,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colorss.primary,
    borderRadius: 2,
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
    height: SH * 0.78,
  },
});
