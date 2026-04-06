import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-nitro-sound';
import RNFS from 'react-native-fs';

interface AudioPlayerProps {
  audioPath: string;
  duration: number;
  remoteUri?: string | null;
  uploading?: boolean;
  createdAt?: Date | number;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioPath,
  duration,
  remoteUri,
  uploading = false,
  createdAt,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);

  // Use AudioRecorderPlayer object (not class instance)
  const audioRecorderPlayer = useRef(AudioRecorderPlayer);
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // Validate audio path
  const isValidAudioPath = (path: string): boolean => {
    if (!path || path.trim() === '' || path === 'Recorder stopped') {
      return false;
    }
    if (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('file://')
    ) {
      return true;
    }
    if (Platform.OS === 'android' && path.startsWith('/')) {
      return true;
    }
    if (
      Platform.OS === 'ios' &&
      (path.includes('.m4a') ||
        path.includes('.wav') ||
        path.includes('.mp3') ||
        path.includes('.aac'))
    ) {
      return true;
    }
    return false;
  };

  // Improved file existence check
  const checkFileExists = async (filePath: string): Promise<boolean> => {
    try {
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return true;
      }
      if (filePath.startsWith('file://')) {
        return await RNFS.exists(filePath.replace('file://', ''));
      }
      if (Platform.OS === 'android' && filePath.startsWith('/')) {
        return await RNFS.exists(filePath);
      }
      if (
        Platform.OS === 'ios' &&
        (filePath.includes('.m4a') ||
          filePath.includes('.wav') ||
          filePath.includes('.mp3') ||
          filePath.includes('.aac'))
      ) {
        return await RNFS.exists(filePath);
      }
      return false;
    } catch (error) {
      console.warn('Error checking file existence:', error);
      return false;
    }
  };

  // Determine which audio URL to use (local or remote)
  useEffect(() => {
    if (remoteUri && !uploading) {
      setAudioUrl(remoteUri);
      setHasError(false);
    } else if (isValidAudioPath(audioPath)) {
      setAudioUrl(audioPath);
      setHasError(false);
    } else {
      setHasError(true);
      console.warn('Invalid audio path:', audioPath);
    }
  }, [audioPath, remoteUri, uploading]);

  // Download remote audio if needed
  useEffect(() => {
    let isMounted = true;
    const downloadRemoteAudio = async () => {
      if (
        remoteUri &&
        (remoteUri.startsWith('http://') || remoteUri.startsWith('https://'))
      ) {
        try {
          const fileName =
            remoteUri.split('/').pop() || `audio_${Date.now()}.aac`;
          const localPath = `${RNFS.CachesDirectoryPath}/${fileName}`;
          const exists = await RNFS.exists(localPath);
          if (!exists) {
            console.log('Downloading audio to:', localPath);
            const result = await RNFS.downloadFile({
              fromUrl: remoteUri,
              toFile: localPath,
            }).promise;
            console.log('Download result:', result);
            if (result.statusCode !== 200) {
              throw new Error('Download failed');
            }
          } else {
            console.log('Audio already exists at:', localPath);
          }
          if (isMounted)
            setLocalFilePath(
              localPath.startsWith('file://')
                ? localPath
                : `file://${localPath}`,
            );
        } catch (e) {
          console.error('Audio download error:', e);
          if (isMounted) setLocalFilePath(null);
        }
      } else if (audioPath && audioPath.startsWith('file://')) {
        setLocalFilePath(audioPath);
      } else {
        setLocalFilePath(null);
      }
    };
    downloadRemoteAudio();
    return () => {
      isMounted = false;
    };
  }, [remoteUri, audioPath]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopAudio();
    };
  }, []);

  const startAudio = async () => {
    try {
      if (hasError || isPlaying) return;
      const fileToPlay = localFilePath || audioUrl;
      const fileExists = await checkFileExists(fileToPlay);
      if (!fileExists) {
        setHasError(true);
        console.warn('Audio file does not exist at:', fileToPlay);
        return;
      }
      setIsLoading(true);

      // Remove file:// prefix for android if needed, though nitro-sound might handle uri well
      let playUrl = fileToPlay;
      // if (Platform.OS === 'android' && playUrl.startsWith('file://')) {
      //   playUrl = playUrl.replace('file://', '');
      // }

      console.log('Starting playback:', playUrl);

      try {
        await audioRecorderPlayer.current.startPlayer(playUrl);

        audioRecorderPlayer.current.addPlayBackListener(e => {
          setCurrentTime(e.currentPosition / 1000);
          const progress =
            duration > 0 ? e.currentPosition / 1000 / duration : 0;
          Animated.timing(progressAnimation, {
            toValue: Math.min(progress, 1),
            duration: 100,
            useNativeDriver: false,
          }).start();

          if (e.currentPosition >= e.duration) {
            stopAudio();
          }
        });

        setIsLoading(false);
        setIsPlaying(true);
      } catch (err) {
        console.log('startPlayer error', err);
        setIsLoading(false);
        setHasError(true);
      }
    } catch (error) {
      setIsLoading(false);
      setHasError(true);
      console.error('Audio playback error:', error);
    }
  };

  const stopAudio = async () => {
    try {
      if (audioRecorderPlayer.current) {
        await audioRecorderPlayer.current.stopPlayer();
        audioRecorderPlayer.current.removePlayBackListener();
      }
      setIsPlaying(false);
      setCurrentTime(0);
      Animated.timing(progressAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } catch (error) {
      console.log('stopAudio error', error);
    }
  };

  const togglePlayPause = () => {
    if (isLoading) return;
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  // Show upload status if uploading
  if (uploading) {
    return (
      <View style={styles.container}>
        <View style={styles.uploadingContainer}>
          <Text style={styles.uploadingText}>Uploading audio...</Text>
        </View>
      </View>
    );
  }

  // Show error state if audio file is invalid
  if (hasError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Audio file not available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.playButton, isLoading && styles.loadingButton]}
        onPress={togglePlayPause}
        disabled={isLoading}
      >
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      </TouchableOpacity>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* <View style={styles.timeContainer}>
          <Text style={styles.timeText}>
            {formatTime(currentTime)}
          </Text>
          <Text style={styles.timeText}>
            {formatTime(duration)}
          </Text>
        </View> */}
      </View>

      {createdAt && (
        <View style={styles.messageTimeContainer}>
          <Text style={styles.messageTimeText}>
            {formatMessageTime(createdAt)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
    minWidth: 200,
    marginBottom: 20,
  },
  playButton: {
    backgroundColor: '#F72585',
    height: 36,
    width: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#F72585',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingButton: {
    backgroundColor: '#ccc',
  },
  playIcon: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  progressContainer: {
    flex: 1,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F72585',
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  uploadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  uploadingText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#dc3545',
    fontStyle: 'italic',
  },
  messageTimeContainer: {
    position: 'absolute',
    bottom: -20,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  messageTimeText: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '400',
  },
});

export default AudioPlayer;
