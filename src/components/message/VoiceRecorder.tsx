import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
} from 'react-native-nitro-sound';
import RNFS from 'react-native-fs';
import { IC_MIC, IC_SEND, IC_CLOSE_CIRCLE } from '../../assets';
import { checkMicrophonePermission } from '../../utils/permissions';


interface VoiceRecorderProps {
  onRecordingComplete: (audioPath: string, duration: number) => void;
  onCancel: () => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onCancel,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioPath, setAudioPath] = useState<string>('');
  const [isRecordingInitialized, setIsRecordingInitialized] = useState(false);

  const audioRecorderPlayer = useRef(AudioRecorderPlayer);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // Start pulse animation when recording
  useEffect(() => {
    if (isRecording && !isPaused) {
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => pulse());
      };
      pulse();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [isRecording, isPaused]);

  const getAudioFilePath = () => {
    const timestamp = Date.now();
    if (Platform.OS === 'ios') {
      return `${RNFS.CachesDirectoryPath}/audio_${timestamp}.m4a`;
    } else {
      // For Android, try different paths in order of preference
      const paths = [
        `${RNFS.CachesDirectoryPath}/audio_${timestamp}.m4a`, // Try cache dir first for Android too
        `/storage/emulated/0/Download/audio_${timestamp}.m4a`,
        `/storage/emulated/0/Music/audio_${timestamp}.m4a`,
        `/data/data/com.pathiyedao.manage/files/audio_${timestamp}.m4a`,
      ];

      console.log('🔧 Generated Android paths:', paths);
      return paths[0];
    }
  };

  const startRecording = async () => {
    try {
      // Check microphone permission first
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) {
        console.log('❌ Microphone permission denied');
        return;
      }

      const filePath = getAudioFilePath();
      console.log('🔧 Starting recording with path:', filePath);

      const result = await audioRecorderPlayer.current.startRecorder(filePath, {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: 'aac',
        OutputFormatAndroid: OutputFormatAndroidType.AAC_ADTS,
      });

      console.log('🔧 startRecorder result:', result);

      // Validate the recording result
      if (result && result !== 'Recorder stopped') {
        console.log('✅ Recording started successfully:', result);
        setIsRecording(true);
        setIsPaused(false);
        setRecordingTime(0);
        setAudioPath(result);
        setIsRecordingInitialized(true);

        // Start timer
        recordingTimer.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        console.warn('❌ Recording start failed, result:', result);
        throw new Error('Recording start failed');
      }
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      // Try with a simpler path if the first attempt fails
      try {
        console.log('🔧 Retrying with simple path...');
        const simpleResult = await audioRecorderPlayer.current.startRecorder(
          undefined, // Let the library handle the path
          {
            AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
            AudioSourceAndroid: AudioSourceAndroidType.MIC,
            AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
            AVNumberOfChannelsKeyIOS: 2,
            AVFormatIDKeyIOS: 'aac',
            OutputFormatAndroid: OutputFormatAndroidType.AAC_ADTS,
          },
        );

        console.log('🔧 Retry result:', simpleResult);

        // Validate the retry result
        if (simpleResult && simpleResult !== 'Recorder stopped') {
          console.log('✅ Recording started with simple path:', simpleResult);
          setIsRecording(true);
          setIsPaused(false);
          setRecordingTime(0);
          setAudioPath(simpleResult);
          setIsRecordingInitialized(true);

          // Start timer
          recordingTimer.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
          }, 1000);
        } else {
          console.error('❌ Retry also failed, result:', simpleResult);
          throw new Error('Recording start failed on retry');
        }
      } catch (retryError) {
        console.error('❌ Retry also failed:', retryError);
        // Reset state on complete failure
        setIsRecording(false);
        setIsPaused(false);
        setRecordingTime(0);
        setAudioPath('');
        setIsRecordingInitialized(false);
      }
    }
  };

  const pauseRecording = async () => {
    try {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      await audioRecorderPlayer.current.pauseRecorder();
      setIsPaused(true);
      console.log('Recording paused');
    } catch (error) {
      console.error('Error pausing recording:', error);
    }
  };

  const resumeRecording = async () => {
    try {
      await audioRecorderPlayer.current.resumeRecorder();
      setIsPaused(false);

      // Resume timer
      recordingTimer.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      console.log('Recording resumed');
    } catch (error) {
      console.error('Error resuming recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      console.log('🔧 Stopping recording...');
      console.log('🔧 Current recording time:', recordingTime);
      console.log('🔧 Is recording:', isRecording);
      console.log('🔧 Is paused:', isPaused);

      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      // Check if we're actually recording
      if (!isRecording || !isRecordingInitialized) {
        console.warn(
          '🔧 Not currently recording or not initialized, cannot stop',
        );
        onCancel();
        return;
      }

      // Ensure minimum recording duration (2 seconds)
      if (recordingTime < 2) {
        console.warn('🔧 Recording too short, minimum 2 seconds required');
        setIsRecording(false);
        setIsPaused(false);
        setRecordingTime(0);
        setIsRecordingInitialized(false);
        onCancel();
        return;
      }

      console.log('🔧 Calling stopRecorder...');
      const result = await audioRecorderPlayer.current.stopRecorder();
      const duration = recordingTime;

      console.log('🔧 stopRecorder result:', result);
      console.log('🔧 Recording duration:', duration);

      setIsRecording(false);
      setIsPaused(false);
      setRecordingTime(0);
      setIsRecordingInitialized(false);

      // Validate the recording result before calling onRecordingComplete
      if (result && result !== 'Recorder stopped' && duration >= 2) {
        console.log(
          '✅ Recording completed successfully:',
          result,
          'Duration:',
          duration,
        );
        onRecordingComplete(result, duration);
      } else {
        console.warn('❌ Recording failed or was too short:', {
          result,
          duration,
        });

        // Try to get the file path from the stored audioPath if available
        if (
          audioPath &&
          audioPath !== 'Recorder stopped' &&
          audioPath.trim() !== ''
        ) {
          console.log('🔧 Trying to use stored audioPath:', audioPath);
          onRecordingComplete(audioPath, duration);
        } else {
          console.warn('❌ No valid audio path available');
          onCancel();
        }
      }
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      setIsRecording(false);
      setIsPaused(false);
      setRecordingTime(0);
      setIsRecordingInitialized(false);
      onCancel();
    }
  };

  const cancelRecording = async () => {
    try {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      if (isRecording) {
        await audioRecorderPlayer.current.stopRecorder();
      }

      setIsRecording(false);
      setIsPaused(false);
      setRecordingTime(0);
      setIsRecordingInitialized(false);
      onCancel();
    } catch (error) {
      console.error('Error canceling recording:', error);
    }
  };

  const handleMicPress = () => {
    if (!isRecording) {
      startRecording();
    } else if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  };

  // Auto-start recording when component mounts
  useEffect(() => {
    startRecording();

    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.recordingContainer}>
        <View style={styles.timerContainer}>
          <Text
            style={[
              styles.timerText,
              recordingTime < 2 && styles.timerTextWarning,
            ]}
          >
            {formatTime(recordingTime)}
          </Text>
          <Text
            style={[
              styles.recordingText,
              recordingTime < 2 && styles.recordingTextWarning,
            ]}
          >
            {isPaused
              ? 'Paused'
              : recordingTime < 2
              ? 'Recording (min 2s)...'
              : 'Recording...'}
          </Text>
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelRecording}
            activeOpacity={0.8}
          >
            <Image source={IC_CLOSE_CIRCLE} style={styles.cancelIcon} />
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.micContainer,
              {
                transform: [{ scale: pulseAnimation }],
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.micButton, isPaused && styles.micButtonPaused]}
              onPress={handleMicPress}
              activeOpacity={0.8}
            >
              <Image
                source={IC_MIC}
                style={[styles.micIcon, isPaused && styles.micIconPaused]}
              />
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              recordingTime < 2 && styles.sendButtonDisabled,
            ]}
            onPress={stopRecording}
            activeOpacity={0.8}
            disabled={recordingTime < 2}
          >
            <Image
              source={IC_SEND}
              style={[
                styles.sendIcon,
                recordingTime < 2 && styles.sendIconDisabled,
              ]}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginHorizontal: 5,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordingContainer: {
    alignItems: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F72585',
    marginBottom: 4,
  },
  recordingText: {
    fontSize: 14,
    color: '#666',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#FF4444',
    height: 50,
    width: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF4444',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  cancelIcon: {
    height: 24,
    width: 24,
    tintColor: '#ffffff',
    resizeMode: 'contain',
  },
  micContainer: {
    alignItems: 'center',
  },
  micButton: {
    backgroundColor: '#F72585',
    height: 60,
    width: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F72585',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  micButtonPaused: {
    backgroundColor: '#FFA500',
  },
  micIcon: {
    height: 28,
    width: 28,
    tintColor: '#ffffff',
    resizeMode: 'contain',
  },
  micIconPaused: {
    tintColor: '#ffffff',
  },
  sendButton: {
    backgroundColor: '#25D366',
    height: 50,
    width: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#25D366',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  sendIcon: {
    height: 24,
    width: 24,
    tintColor: '#ffffff',
    resizeMode: 'contain',
  },
  sendIconDisabled: {
    tintColor: '#999',
  },
  timerTextWarning: {
    color: '#FFD700', // Gold color for warning
  },
  recordingTextWarning: {
    color: '#FFD700', // Gold color for warning
  },
});

export default VoiceRecorder;
