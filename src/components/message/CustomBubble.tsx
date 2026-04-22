import React from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Text,
} from 'react-native';
import { Bubble, IMessage, BubbleProps } from 'react-native-gifted-chat';
import FastImage from '@d11/react-native-fast-image';
import AudioPlayer from './AudioPlayer';
import { ExtendedMessage } from '../types/chat';

interface CustomBubbleProps extends BubbleProps<IMessage> {
  onImagePress: (media: ExtendedMessage['media']) => void;
}

const CustomBubble: React.FC<CustomBubbleProps> = ({ onImagePress, ...props }) => {
  const msg = props.currentMessage as ExtendedMessage;
  const isOwn = props.position === 'right';

  const StatusOverlay: React.FC = () => (
    <>
      {msg?.pending && (
        <ActivityIndicator size="small" color="#F72585" style={styles.status} />
      )}
      {msg?.failed && (
        <View style={styles.status}>
          <Text style={styles.failedText}>Failed</Text>
        </View>
      )}
    </>
  );

  if (msg?.media?.type === 'voice') {
    const audioUri = msg.media.url ?? msg.media.remoteUri ?? msg.media.localUri ?? '';
    return (
      <View style={styles.row}>
        <AudioPlayer
          audioPath={audioUri}
          duration={msg.media.duration ?? 0}
          remoteUri={msg.media.remoteUri}
          uploading={msg.pending}
          createdAt={msg.createdAt as Date}
          isOwn={isOwn}
        />
        <StatusOverlay />
      </View>
    );
  }

  if (msg?.media?.type === 'image') {
    const imageUri = msg.media.url ?? msg.media.remoteUri ?? msg.media.localUri ?? '';
    return (
      <TouchableOpacity
        onPress={() => onImagePress(msg.media)}
        activeOpacity={0.9}
      >
        <View style={styles.row}>
          <FastImage
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode={FastImage.resizeMode.cover}
          />
          <StatusOverlay />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.row}>
      <Bubble {...props} />
      <StatusOverlay />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  status: {
    marginLeft: 4,
  },
  image: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  failedText: {
    color: '#F72585',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default React.memo(CustomBubble);
