import React from 'react';
import { View, Animated, TouchableOpacity, Image } from 'react-native';
import { InputToolbar } from 'react-native-gifted-chat';
import VoiceRecorder from './VoiceRecorder';
import { IC_LIST } from '../../assets';

interface CustomInputToolbarProps {
    isRecording: boolean;
    onRecordingComplete: (path: string, duration: number) => void;
    onRecordingCancel: () => void;
    inputAnimation: Animated.Value;
    replyMessage: any;
    insets: any;
    onCustomOrderPress: () => void;
    width: number;
    [key: string]: any;
}

const CustomInputToolbar: React.FC<CustomInputToolbarProps> = ({
    isRecording,
    onRecordingComplete,
    onRecordingCancel,
    inputAnimation,
    replyMessage,
    insets,
    onCustomOrderPress,
    width,
    ...props
}) => {
    if (isRecording) {
        return (
            <VoiceRecorder
                onRecordingComplete={onRecordingComplete}
                onCancel={onRecordingCancel}
            />
        );
    }

    const translateY = inputAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [50, 0],
    });

    return (
        <Animated.View
            style={{
                opacity: inputAnimation,
                transform: [{ translateY }],
            }}
        >
            <InputToolbar
                {...props} // This passes through textInputStyle and textInputProps from GiftedChat
                containerStyle={{
                    width: width - 10,
                    backgroundColor: replyMessage ? '#FFF5F8' : '#ffffff',
                    marginBottom: insets.bottom,
                    paddingVertical: 10,
                    marginHorizontal: 5,
                    borderRadius: 20,
                    paddingHorizontal: 5,
                    borderTopWidth: 0,
                    elevation: 0,
                    shadowOpacity: 0,
                }}
                renderActions={() => (
                    <View style={{ height: 44, justifyContent: 'center', alignItems: 'center', left: 5 }}>
                        <TouchableOpacity onPress={onCustomOrderPress}>
                            <Image source={IC_LIST} style={{ height: 40, width: 40, resizeMode: 'contain' }} />
                        </TouchableOpacity>
                    </View>
                )}
            />
        </Animated.View>
    );
};

export default React.memo(CustomInputToolbar);