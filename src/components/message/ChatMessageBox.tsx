import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Text,
  Pressable,
  Alert,
  Linking,
} from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
// import { useSelector } from 'react-redux';
// import { RootState } from '../../../store';

import { IMessage, Message, MessageProps } from 'react-native-gifted-chat';
import AudioPlayer from './AudioPlayer';

// Add these imports for permissions (Android)
import { PermissionsAndroid, Platform } from 'react-native';
// download
import { isSameDay, isSameUser } from 'react-native-gifted-chat/src/utils';
type ChatMessageBoxProps = {
  replyMessage?: IMessage | null;
  highlightedMessageId?: string | number | null;
  refreshTrigger?: number; // Add this prop to trigger refresh from parent
} & MessageProps<IMessage>;

const ChatMessageBox = ({ refreshTrigger, ...props }: ChatMessageBoxProps) => {
  const isNextMyMessage =
    props.currentMessage &&
    props.nextMessage &&
    isSameUser(props.currentMessage, props.nextMessage) &&
    isSameDay(props.currentMessage, props.nextMessage);

  // Get token from Redux
  // const token = useSelector((state: RootState) => state.auth.token);

  // Helper function to format message time
  const formatMessageTime = (date: Date | number) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInHours =
      (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      // Today - show time
      return messageDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } else if (diffInHours < 48) {
      // Yesterday
      return 'Yesterday';
    } else {
      // Show date
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // Enhanced permission request function
  const requestStoragePermission = async () => {
    try {
      if (Platform.OS === 'android') {
        // For Android 13+ (API 33+), we need different approach
        if (Platform.Version >= 33) {
          // Android 13+ uses scoped storage, try to use Media Store API
          try {
            // Check if we can write to external storage using native Android permissions
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
              {
                title: 'Media Access Permission',
                message: 'This app needs access to save images to your gallery',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
              },
            );

            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
              console.log('Media permission granted');
              return true;
            } else {
              console.log('Media permission denied');
              return false;
            }
          } catch (err) {
            console.warn('Android 13+ permission error:', err);
            return true; // Fallback: assume we can save to app directory
          }
        } else {
          // For Android 12 and below
          const permission = PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE;
          const result = await check(permission);

          if (result === RESULTS.GRANTED) {
            return true;
          }

          if (result === RESULTS.DENIED) {
            const requestResult = await request(permission);
            return requestResult === RESULTS.GRANTED;
          }

          if (result === RESULTS.BLOCKED) {
            Alert.alert(
              'Permission Required',
              'Storage permission is required to save images. Please enable it in app settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => Linking.openSettings(),
                },
              ],
            );
            return false;
          }
        }
      } else if (Platform.OS === 'ios') {
        const permission = PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY;
        const result = await check(permission);

        if (result === RESULTS.GRANTED) {
          return true;
        }

        if (result === RESULTS.DENIED) {
          const requestResult = await request(permission);
          return requestResult === RESULTS.GRANTED;
        }

        if (result === RESULTS.BLOCKED) {
          Alert.alert(
            'Permission Required',
            'Photo library permission is required to save images. Please enable it in app settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('Permission error:', error);
      return false;
    }
  };

  // State for modal preview
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMedia, setModalMedia] = useState<{
    uri: string;
    type: 'image';
  } | null>(null);

  // Voice message rendering
  const renderVoiceMessage = () => {
    if (props.currentMessage && (props.currentMessage as any).voiceMessage) {
      const voiceData = (props.currentMessage as any).voiceMessage;
      return (
        <View
          style={[
            styles.voiceMessageContainer,
            props.position === 'right'
              ? styles.voiceMessageRight
              : styles.voiceMessageLeft,
          ]}
        >
          <AudioPlayer
            audioPath={voiceData.audioPath}
            duration={voiceData.duration}
            remoteUri={voiceData.remoteUri}
            uploading={voiceData.uploading}
            createdAt={props.currentMessage.createdAt}
          />
        </View>
      );
    }
    return null;
  };

  // Media message rendering
  const renderMediaMessage = () => {
    const media = (props.currentMessage as any)?.media;
    if (!media) return null;
    if (media.type === 'image' && (media.localUri || media.remoteUri)) {
      return (
        <View
          style={[
            styles.mediaMessageContainer,
            props.position === 'right'
              ? styles.mediaMessageRight
              : styles.mediaMessageLeft,
          ]}
        >
          <Pressable
            onPress={() => {
              setModalMedia({
                uri: media.remoteUri || media.localUri,
                type: 'image',
              });
              setModalVisible(true);
            }}
            style={styles.imageContainer}
          >
            <Image
              source={{ uri: media.remoteUri || media.localUri }}
              style={styles.image}
              resizeMode="cover"
            />
            {media.uploading && (
              <View style={styles.uploadingOverlay}>
                <Text style={styles.uploadingText}>{t('chat.uploading')}</Text>
              </View>
            )}
            {media.error && (
              <View style={styles.errorOverlay}>
                <Text style={styles.errorText}>{t('chat.uploadFailed')}</Text>
              </View>
            )}
          </Pressable>
          {props.currentMessage?.createdAt && (
            <View style={styles.mediaTimeContainer}>
              <Text style={styles.mediaTimeText}>
                {formatMessageTime(props.currentMessage.createdAt)}
              </Text>
            </View>
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <>
      <View style={[styles.messageContainer]}>
        {renderVoiceMessage()}
        {renderMediaMessage()}
        {!renderVoiceMessage() && !renderMediaMessage() && (
          <Message {...props} />
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 40,
  },
  replyImageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyImage: {
    width: 20,
    height: 20,
  },
  defaultBottomOffset: {
    marginBottom: 6,
  },
  bottomOffsetNext: {
    marginBottom: 12,
  },
  leftOffsetValue: {
    marginLeft: 16,
  },
  messageContainer: {
    position: 'relative',
    marginBottom: 8,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Skeleton Styles
  skeletonLine: {
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    marginBottom: 6,
  },

  skeletonSection: {
    padding: 12,
    marginBottom: 12,
  },

  skeletonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  // Error Styles
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },

  errorText: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 12,
  },

  retryButton: {
    backgroundColor: '#F72585',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Existing styles for reply, voice, and media messages
  replyPreview: {
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#25D366',
    maxWidth: '80%',
    zIndex: 1,
  },
  replyPreviewContent: {
    // flex: 1,
  },
  replyPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  replyPreviewName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#25D366',
    flex: 1,
    letterSpacing: 0.2,
  },
  replyIcon: {
    width: 14,
    height: 14,
    tintColor: '#25D366',
  },
  replyPreviewText: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
    opacity: 0.8,
  },
  replyPreviewRight: {
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderRightColor: '#25D366',
    backgroundColor: 'rgba(37, 211, 102, 0.1)',
    alignSelf: 'flex-end',
  },
  replyPreviewLeft: {
    borderLeftWidth: 3,
    borderLeftColor: '#25D366',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignSelf: 'flex-start',
  },
  replyPreviewNameRight: {
    color: '#25D366',
  },
  replyPreviewNameLeft: {
    color: '#25D366',
  },
  replyIconRight: {
    tintColor: '#25D366',
  },
  replyIconLeft: {
    tintColor: '#25D366',
  },
  replyPreviewTextRight: {
    color: '#8E8E93',
  },
  replyPreviewTextLeft: {
    color: '#8E8E93',
  },
  replyingToMessage: {
    backgroundColor: 'rgba(37, 211, 102, 0.1)',
    borderRadius: 8,
    margin: 2,
  },
  highlightedMessage: {
    backgroundColor: 'rgba(255, 43, 133, 0.2)',
    borderRadius: 12,
    margin: 4,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#F72585',
    shadowColor: '#F72585',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  highlightIndicator: {
    position: 'absolute',
    top: -8,
    left: 12,
    backgroundColor: '#F72585',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  highlightText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  voiceMessageContainer: {
    marginHorizontal: 12,
    marginVertical: 4,
    maxWidth: '80%',
  },
  voiceMessageRight: {
    alignSelf: 'flex-end',
  },
  voiceMessageLeft: {
    alignSelf: 'flex-start',
  },
  mediaMessageContainer: {
    marginHorizontal: 12,
    marginVertical: 4,
    maxWidth: '80%',
    position: 'relative',
    marginBottom: 24, // Add space for the time display
  },
  mediaMessageRight: {
    alignSelf: 'flex-end',
  },
  mediaMessageLeft: {
    alignSelf: 'flex-start',
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  image: {
    width: 180,
    height: 180,
    borderRadius: 12,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(220, 53, 69, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTextCustomOrder: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  mediaTimeContainer: {
    position: 'absolute',
    bottom: -20,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  mediaTimeText: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '400',
  },

  // papper additional
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButton: {
    backgroundColor: '#F72585',
  },
  shareButton: {
    backgroundColor: '#007bff',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // paper loading
  captureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  captureOverlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  loadingContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  // papper additional
});

export default ChatMessageBox;
