import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
import { X, Pause, Play, Send, Mic } from 'lucide-react-native';

import { checkMicrophonePermission } from '../../utils/permissions';
import { colorss } from '../../theme';

//  Types 

interface VoiceRecorderProps {
  onRecordingComplete: (audioPath: string, duration: number) => void;
  onCancel: () => void;
}

//  Constants 

const MIN_DURATION = 2;

//  Component 

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onRecordingComplete, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioPath, setAudioPath] = useState('');
  const [initialized, setInitialized] = useState(false);

  const audioRecorderPlayer = useRef(AudioRecorderPlayer);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Mount slide-in
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  // Pulse while active
  useEffect(() => {
    let loop: Animated.CompositeAnimation;
    if (isRecording && !isPaused) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.6, duration: 600, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          ]),
        ]),
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(1);
    }
    return () => loop?.stop();
  }, [isRecording, isPaused, pulseAnim, pulseOpacity]);

  const getFilePath = (): string =>
    `${RNFS.CachesDirectoryPath}/voice_${Date.now()}.m4a`;

  //  Start recording
  const startRecording = useCallback(async () => {
    try {
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) { onCancel(); return; }

      const filePath = getFilePath();
      const result = await audioRecorderPlayer.current.startRecorder(filePath, {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: 'aac',
        OutputFormatAndroid: OutputFormatAndroidType.AAC_ADTS,
      });

      if (!result || result === 'Recorder stopped') { onCancel(); return; }

      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setAudioPath(result);
      setInitialized(true);

      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    startRecording();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  //  Pause / resume
  const pauseRecording = async () => {
    try {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      await audioRecorderPlayer.current.pauseRecorder();
      setIsPaused(true);
    } catch {}
  };

  const resumeRecording = async () => {
    try {
      await audioRecorderPlayer.current.resumeRecorder();
      setIsPaused(false);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {}
  };

  //  Send
  const stopAndSend = async () => {
    if (!isRecording || !initialized || recordingTime < MIN_DURATION) return;
    try {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const result = await audioRecorderPlayer.current.stopRecorder();
      const finalPath = result && result !== 'Recorder stopped' ? result : audioPath;
      setIsRecording(false);
      setInitialized(false);
      finalPath && finalPath !== 'Recorder stopped'
        ? onRecordingComplete(finalPath, recordingTime)
        : onCancel();
    } catch {
      onCancel();
    }
  };

  //  Cancel
  const cancelRecording = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      if (isRecording) await audioRecorderPlayer.current.stopRecorder();
    } catch {}
    onCancel();
  };

  const formatTime = (s: number): string => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const readyToSend = recordingTime >= MIN_DURATION;

  //  Render
  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      {/* Timer + status */}
      <View style={styles.statusRow}>
        <Animated.View
          style={[
            styles.recordDot,
            { transform: [{ scale: pulseAnim }], opacity: isPaused ? 0.4 : pulseOpacity },
          ]}
        />
        <Text style={styles.timer}>{formatTime(recordingTime)}</Text>
        <Text style={[styles.statusLabel, !readyToSend && styles.statusWarning]}>
          {isPaused ? 'Paused' : readyToSend ? 'Recording…' : `Min ${MIN_DURATION}s`}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.cancelBtn} onPress={cancelRecording}>
          <X size={20} color={colorss.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pauseBtn}
          onPress={isPaused ? resumeRecording : pauseRecording}
        >
          {isPaused
            ? <Play size={20} color={colorss.white} fill={colorss.white} />
            : <Pause size={20} color={colorss.white} fill={colorss.white} />}
        </TouchableOpacity>

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.mainBtn, !readyToSend && styles.mainBtnDisabled]}
            onPress={stopAndSend}
            disabled={!readyToSend}
          >
            {readyToSend
              ? <Send size={22} color={colorss.white} />
              : <Mic size={22} color={colorss.white} />}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

export default React.memo(VoiceRecorder);

//  Styles 

const styles = StyleSheet.create({
  container: {
    backgroundColor: colorss.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    gap: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  recordDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colorss.error,
  },
  timer: {
    fontSize: 22,
    fontWeight: '700',
    color: colorss.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statusLabel: {
    fontSize: 13,
    color: colorss.textSecondary,
    marginLeft: 4,
  },
  statusWarning: {
    color: '#F59E0B',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colorss.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colorss.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colorss.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colorss.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  mainBtnDisabled: {
    backgroundColor: colorss.placeholder,
    shadowOpacity: 0,
    elevation: 0,
  },
});
