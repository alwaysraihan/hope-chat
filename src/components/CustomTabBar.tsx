import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import {
  Bell,
  FileText,
  Images,
  Link,
  LucideImages,
  LucideMenu,
  LucideMessageCircle,
} from 'lucide-react-native';

const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const getIcon = (routeName: string, isFocused: boolean) => {
    const iconColor = isFocused ? colors.pink : '#3D3B3B';

    switch (routeName) {
      case 'Home':
        return <LucideMessageCircle color={iconColor} size={20} />;
      case 'Story':
        return <LucideImages color={iconColor} size={20} />;
      case 'Notifications':
        return <Bell color={iconColor} size={20} />;
      case 'Menu':
        return <LucideMenu color={iconColor} size={20} />;
      case 'Media':
        return <Images color={iconColor} size={20} />;
      case 'Files':
        return <FileText color={iconColor} size={20} />;
      case 'Links':
        return <Link color={iconColor} size={20} />;
      default:
        return null;
    }
  };

  const { bottom } = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          backgroundColor: '#fff',
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: Math.max(bottom, 14),
        },
      ]}
    >
      <View style={[styles.container]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ? options.tabBarLabel : route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tab}
              onPress={onPress}
              activeOpacity={0.7}
            >
              {getIcon(route.name, isFocused)}
              <Text
                style={[
                  {
                    color: isFocused ? colors.pink : '#3D3B3B',
                    fontSize: 14,
                    marginTop: 2,
                  },
                ]}
              >
                {typeof label === 'string' ? label : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#efeff6',
    borderTopWidth: 0,
    borderTopColor: '#E5E5EA',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderRadius: 9999,
    padding: 4,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    position: 'relative',
  },
  cartIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#E2186F',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 16,
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
  },
  notificationDot: {
    position: 'absolute',
    top: -5,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#17f631',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#17f631',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 5,
  },
  dotInner: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: '#17f631',
  },
});

export default CustomTabBar;
