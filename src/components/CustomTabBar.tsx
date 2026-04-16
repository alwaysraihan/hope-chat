import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import {
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
        return <LucideMessageCircle color={iconColor} size={24} />;
      case 'Story':
        return <LucideImages color={iconColor} size={24} />;
      case 'Discover':
        return <LucideMessageCircle color={iconColor} size={24} />;
      case 'Menu':
        return <LucideMenu color={iconColor} size={24} />;
      case 'Media':
        return <Images color={iconColor} size={24} />;
      case 'Files':
        return <FileText color={iconColor} size={24} />;
      case 'Links':
        return <Link color={iconColor} size={24} />;
      default:
        return null;
    }
  };

  const { bottom } = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottom - 6,
        },
      ]}
    >
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
                styles.label,
                {
                  color: isFocused ? colors.pink : '#3D3B3B',
                  fontSize: 14,
                  marginTop: 3,
                },
              ]}
            >
              {typeof label === 'string' ? label : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    borderTopColor: '#E5E5EA',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 10,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
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
  label: {
    fontSize: 12,
    fontWeight: '500',
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
