import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React from 'react';
import {
  Archive,
  Bell,
  LucidePin,
  SquareArrowRightExit,
  Trash,
  UserPlus,
} from 'lucide-react-native';
import { colorss } from '../theme';
import Animated from 'react-native-reanimated';

const ConversationActionScreen = () => {
  const actions = [
    {
      id: 1,
      title: 'Pin',
      icon: <LucidePin size={22} color={colorss.primary} />,
    },
    {
      id: 2,
      title: 'Archive',
      icon: <Archive size={22} color={colorss.primary} />,
    },
    {
      id: 3,
      title: 'Mute',
      icon: <Bell size={22} color={colorss.primary} />,
    },
    {
      id: 4,
      title: 'Add members',
      icon: <UserPlus size={22} color={colorss.primary} />,
    },
    // {
    //   id: 5,
    //   title: 'Open chat head',
    //   icon: <Bell size={22} color={colorss.primary} />,
    // },
    {
      id: 6,
      title: 'Leave',
      icon: <SquareArrowRightExit size={22} color={colorss.primary} />,
    },
    {
      id: 7,
      title: 'Delete',
      icon: <Trash size={22} color={colorss.primary} />,
    },
  ];

  return (
    <Animated.View
      style={{
        backgroundColor: colorss.surface,
        paddingVertical: 20,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
      }}
    >
      <View style={styles.handle} />

      <View style={{ gap: 20, padding: 20 }}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.id}
            style={{ flexDirection: 'row', gap: 10 }}
          >
            {action.icon}
            <Text
              style={{
                color: colorss.textPrimary,
                fontSize: 16,
                fontWeight: '500',
              }}
            >
              {action.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
};

export default ConversationActionScreen;

const styles = StyleSheet.create({
  handle: {
    width: 80,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
});
