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

interface MediaMessage extends IMessage {
  media?: any;
  pending?: boolean;
  failed?: boolean;
}

interface CustomBubbleProps extends BubbleProps<IMessage> {
  onImagePress: (media: any) => void;
}

const CustomBubble: React.FC<CustomBubbleProps> = ({
  onImagePress,
  ...props
}) => {
  // @ts-ignore
  const currentMessage: MediaMessage = props.currentMessage;

  const renderStatus = () => (
    <>
      {currentMessage?.pending && (
        <ActivityIndicator
          size="small"
          color="#F72585"
          style={styles.statusIndicator}
        />
      )}
      {currentMessage?.failed && (
        <View style={styles.statusIndicator}>
          <Text style={styles.text}>Failed</Text>
        </View>
      )}
    </>
  );

  // Voice Message
  if (currentMessage?.media && currentMessage.media.type === 'voice') {
    return (
      <View style={styles.bubbleContainer}>
        <AudioPlayer
          audioPath={currentMessage.media.url}
          duration={currentMessage.media.duration || 0}
          remoteUri={currentMessage.media.url}
          uploading={currentMessage.pending}
          createdAt={currentMessage.createdAt}
        />
        {renderStatus()}
      </View>
    );
  }

  // Image Message
  if (currentMessage?.media && currentMessage.media.type === 'image') {
    const imageUrl =
      currentMessage.media.type === 'image' && currentMessage.media.url
        ? currentMessage.media.url
        : currentMessage.media.remoteUri || currentMessage.media.localUri;

    return (
      <TouchableOpacity onPress={() => onImagePress(currentMessage.media)}>
        <View style={styles.bubbleContainer}>
          <FastImage
            source={{ uri: imageUrl }}
            style={styles.imageMessage}
            resizeMode={FastImage.resizeMode.cover}
          />
          {renderStatus()}
        </View>
      </TouchableOpacity>
    );
  }

  // Default Bubble
  return (
    <View style={styles.bubbleContainer}>
      <Bubble {...props} />
      {renderStatus()}
    </View>
  );
};

const styles = StyleSheet.create({
  bubbleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    marginLeft: 4,
  },
  imageMessage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  text: {
    color: '#F72585',
    fontSize: 12,
  },
});

export default React.memo(CustomBubble);
