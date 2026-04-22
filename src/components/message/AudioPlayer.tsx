import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-nitro-sound';
import RNFS from 'react-native-fs';
import { colorss } from '../../theme';

interface AudioPlayerProps {
  audioPath: string;
  duration: number;
  remoteUri?: string | null;
  uploading?: boolean;
  createdAt?: Date | number;
  isOwn?: boolean; // right side = own message
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioPath,
  duration,
  remoteUri,
  uploading = false,
  createdAt,
  isOwn = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);

  const audioRecorderPlayer = useRef(AudioRecorderPlayer);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Waveform bars - static representation
  const BARS = 28;
  const waveHeights = useRef<number[]>(
    Array.from({ length: BARS }, () => 0.2 + Math.random() * 0.8),
  ).current;

  const isValidAudioPath = useCallback((path: string): boolean => {
    if (!path || path.trim() === '' || path === 'Recorder stopped')
      return false;
    if (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('file://')
    )
      return true;
    if (Platform.OS === 'android' && path.startsWith('/')) return true;
    if (
      Platform.OS === 'ios' &&
      (path.includes('.m4a') ||
        path.includes('.wav') ||
        path.includes('.mp3') ||
        path.includes('.aac'))
    )
      return true;
    return false;
  }, []);

  const checkFileExists = useCallback(
    async (filePath: string): Promise<boolean> => {
      try {
        if (filePath.startsWith('http://') || filePath.startsWith('https://'))
          return true;
        const cleanPath = filePath.startsWith('file://')
          ? filePath.replace('file://', '')
          : filePath;
        return await RNFS.exists(cleanPath);
      } catch {
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    if (remoteUri && !uploading) {
      setAudioUrl(remoteUri);
      setHasError(false);
    } else if (isValidAudioPath(audioPath)) {
      setAudioUrl(audioPath);
      setHasError(false);
    } else {
      setHasError(true);
    }
  }, [audioPath, remoteUri, uploading, isValidAudioPath]);

  useEffect(() => {
    let isMounted = true;
    const prepareAudio = async () => {
      if (remoteUri?.startsWith('http')) {
        const fileName =
          remoteUri.split('/').pop() || `audio_${Date.now()}.aac`;
        const localPath = `${RNFS.CachesDirectoryPath}/${fileName}`;
        const exists = await RNFS.exists(localPath);
        if (!exists) {
          try {
            const result = await RNFS.downloadFile({
              fromUrl: remoteUri,
              toFile: localPath,
            }).promise;
            if (result.statusCode !== 200) throw new Error('Download failed');
          } catch {
            if (isMounted) setLocalFilePath(null);
            return;
          }
        }
        if (isMounted)
          setLocalFilePath(
            localPath.startsWith('file://') ? localPath : `file://${localPath}`,
          );
      } else if (audioPath?.startsWith('file://')) {
        if (isMounted) setLocalFilePath(audioPath);
      }
    };
    prepareAudio();
    return () => {
      isMounted = false;
    };
  }, [remoteUri, audioPath]);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const startAudio = async () => {
    if (hasError || isPlaying) return;
    const fileToPlay = localFilePath || audioUrl;
    const fileExists = await checkFileExists(fileToPlay);
    if (!fileExists) {
      setHasError(true);
      return;
    }
    setIsLoading(true);
    try {
      await audioRecorderPlayer.current.startPlayer(fileToPlay);
      audioRecorderPlayer.current.addPlayBackListener(e => {
        setCurrentTime(e.currentPosition / 1000);
        const progress = duration > 0 ? e.currentPosition / 1000 / duration : 0;
        Animated.timing(progressAnimation, {
          toValue: Math.min(progress, 1),
          duration: 100,
          useNativeDriver: false,
        }).start();
        if (e.currentPosition >= e.duration) stopAudio();
      });
      setIsLoading(false);
      setIsPlaying(true);
    } catch {
      setIsLoading(false);
      setHasError(true);
    }
  };

  const stopAudio = async () => {
    try {
      await audioRecorderPlayer.current.stopPlayer();
      audioRecorderPlayer.current.removePlayBackListener();
    } catch {}
    setIsPlaying(false);
    setCurrentTime(0);
    Animated.timing(progressAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const togglePlayPause = () => {
    if (isLoading) return;
    animatePress();
    isPlaying ? stopAudio() : startAudio();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMessageTime = (date: Date | number): string => {
    const messageDate = new Date(date);
    const now = new Date();
    const diffH = (now.getTime() - messageDate.getTime()) / 3600000;
    if (diffH < 24)
      return messageDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    if (diffH < 48) return 'Yesterday';
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const playedBars = Math.floor(progressRatio * BARS);

  const ownColors = {
    bg: '#005C4B',
    bar: 'rgba(255,255,255,0.35)',
    barPlayed: '#FFFFFF',
    btnBg: 'rgba(255,255,255,0.2)',
    btnIcon: '#FFFFFF',
    time: 'rgba(255,255,255,0.7)',
    duration: 'rgba(255,255,255,0.6)',
  };
  const otherColors = {
    bg: '#F0F0F0',
    bar: 'rgba(0,0,0,0.15)',
    barPlayed: '#00A884',
    btnBg: '#00A884',
    btnIcon: '#FFFFFF',
    time: '#667781',
    duration: '#667781',
  };
  const colors = isOwn ? ownColors : otherColors;

  if (uploading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="small" color={colors.barPlayed} />
        <Text style={[styles.uploadText, { color: colors.time }]}>
          Uploading…
        </Text>
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={[styles.errorText, { color: colors.time }]}>
          ⚠ Audio unavailable
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colorss.white }]}>
      {/* Play Button */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: colorss.primary }]}
          onPress={togglePlayPause}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.btnIcon} />
          ) : (
            <Text style={[styles.playIcon, { color: colors.btnIcon }]}>
              {isPlaying ? '⏸' : '▶'}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Waveform */}
      <View style={styles.waveformContainer}>
        <View style={styles.waveform}>
          {waveHeights.map((h, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: 4 + h * 24,
                  backgroundColor:
                    i < playedBars ? colors.barPlayed : otherColors.bar,
                  opacity: isPlaying && i === playedBars ? 1 : 0.85,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.durationText, { color: colors.duration }]}>
            {formatTime(isPlaying ? currentTime : duration)}
          </Text>
          {createdAt && (
            <Text style={[styles.timeText, { color: colors.time }]}>
              {formatMessageTime(createdAt)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 220,
    maxWidth: 280,
    gap: 10,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 15,
    marginLeft: 2,
  },
  waveformContainer: {
    flex: 1,
    gap: 4,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    gap: 2,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 11,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 11,
  },
  uploadText: {
    fontSize: 13,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 13,
    marginLeft: 4,
  },
});

export default React.memo(AudioPlayer);
