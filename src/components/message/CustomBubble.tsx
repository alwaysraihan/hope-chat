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
import { colorss } from '../../theme';

//  Types

interface CustomBubbleProps extends BubbleProps<IMessage> {
  onImagePress: (media: ExtendedMessage['media']) => void;
}

//  Component

const CustomBubble: React.FC<CustomBubbleProps> = ({
  onImagePress,
  ...props
}) => {
  const msg = props.currentMessage as ExtendedMessage;
  const isOwn = props.position === 'right';

  const StatusOverlay: React.FC = () => (
    <>
      {msg?.pending && (
        <ActivityIndicator
          size="small"
          color={colorss.primary}
          style={styles.statusIcon}
        />
      )}
      {msg?.failed && (
        <View style={styles.statusIcon}>
          <Text style={styles.failedText}>Failed</Text>
        </View>
      )}
    </>
  );

  //  Voice
  if (msg?.media?.type === 'voice') {
    const audioUri =
      msg.media.url ?? msg.media.remoteUri ?? msg.media.localUri ?? '';
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

  //  Image
  if (msg?.media?.type === 'image') {
    const imageUri =
      msg.media.url ?? msg.media.remoteUri ?? msg.media.localUri ?? '';
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

  //  Text (default)
  return (
    <View style={styles.row}>
      <Bubble {...props} />
      <StatusOverlay />
    </View>
  );
};

export default React.memo(CustomBubble);

//  Styles

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginLeft: 4,
  },
  image: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: colorss.surface,
  },
  failedText: {
    color: colorss.error,
    fontSize: 12,
    fontWeight: '500',
  },
});
