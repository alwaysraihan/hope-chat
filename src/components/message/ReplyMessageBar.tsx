/* eslint-disable react/self-closing-comp */
import { View, TouchableOpacity, Text, Image } from 'react-native';
import { IMessage } from 'react-native-gifted-chat';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { IC_CLOSE_CIRCLE } from '../../assets';

type ReplyMessageBarProps = {
  clearReply: () => void;
  message: IMessage | null;
  onReplyPress?: (messageId: string | number) => void;
};

const ReplyMessageBar = ({
  clearReply,
  message,
  onReplyPress,
}: ReplyMessageBarProps) => {
  if (!message) return null;

  return (
    <Animated.View
      style={{
        height: 70,
        flexDirection: 'row',
        backgroundColor: '#F8F9FA',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
      }}
      entering={FadeInDown}
      exiting={FadeOutDown}
    >
      <View
        style={{
          height: 44,
          width: 4,
          backgroundColor: '#25D366',
          borderRadius: 2,
          marginRight: 12,
          alignSelf: 'center',
        }}
      />
      <TouchableOpacity
        style={{
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
        }}
        onPress={() => onReplyPress?.(message._id)}
        activeOpacity={0.7}
      >
        <Text
          style={{
            color: '#25D366',
            fontWeight: '700',
            fontSize: 14,
            marginBottom: 4,
            letterSpacing: 0.2,
          }}
        >
          {message?.user.name}
        </Text>
        <Text
          style={{
            color: '#666666',
            fontSize: 15,
            lineHeight: 20,
            opacity: 0.9,
          }}
        >
          {message.text.length > 60
            ? message.text.substring(0, 60) + '...'
            : message.text}
        </Text>
      </TouchableOpacity>
      <View
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          paddingLeft: 8,
        }}
      >
        <TouchableOpacity
          onPress={clearReply}
          style={{
            padding: 6,
            borderRadius: 20,
            backgroundColor: 'rgba(255, 43, 133, 0.1)',
          }}
        >
          <Image
            source={IC_CLOSE_CIRCLE}
            style={{
              tintColor: '#F72585',
              height: 24,
              width: 24,
              resizeMode: 'contain',
            }}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

export default ReplyMessageBar;
