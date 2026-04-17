import {
  Image,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BottomTabNavigatorParamList,
  RootStackNavigatorParamList,
} from '../types/navigators';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  LucideArchive,
  LucideMessageCircleMore,
  LucideSettings,
  LucideStore,
  LucideUsers,
} from 'lucide-react-native';
import { IC_PROFILE } from '../assets';
type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabNavigatorParamList, 'Menu'>,
  NativeStackScreenProps<RootStackNavigatorParamList>
>;

const colors = {
  primary: '#FF4E8C',
  primaryLight: '#FF7FA8',
  primaryDark: '#CC3E70',

  background: '#f9fafb',
  surface: '#F8FAFC',

  textPrimary: '#10182B',
  textSecondary: '#4A5568',
  placeholder: '#A0AEC0',

  accent: '#6366F1',
  success: '#22C55E',
  error: '#EF4444',
};

const MenuScreen: React.FC<Props> = ({ navigation }) => {
  const menus = [
    {
      id: 1,
      title: 'hello',
      data: [
        {
          id: 1,
          title: 'Settings',
          icon: (
            <LucideSettings
              size={22}
              color={colors.background}
              fill={colors.textPrimary}
            />
          ),
          onPress: () => {},
        },
      ],
    },
    {
      id: 2,
      title: 'hello',
      data: [
        {
          id: 1,
          title: 'Marketplace',
          icon: (
            <LucideStore
              size={22}
              color={colors.background}
              fill={colors.textPrimary}
            />
          ),
          onPress: () => {},
        },
        {
          id: 2,
          title: 'Communities',
          icon: (
            <LucideUsers
              size={22}
              color={colors.background}
              fill={colors.textPrimary}
            />
          ),
          onPress: () => {},
        },
        {
          id: 3,
          title: 'Message requests',
          icon: (
            <LucideMessageCircleMore
              size={22}
              color={colors.background}
              fill={colors.textPrimary}
            />
          ),
          onPress: () => {
            navigation.navigate('MessageRequests');
          },
        },
        {
          id: 4,
          title: 'Archive',
          icon: (
            <LucideArchive
              size={22}
              color={colors.background}
              fill={colors.textPrimary}
            />
          ),
          onPress: () => navigation.navigate('Archive'),
        },
      ],
    },
    {
      id: 3,
      title: 'hello',
      data: [
        {
          id: 1,
          title: 'Friend requests',
          icon: (
            <LucideUsers
              size={22}
              color={colors.background}
              fill={colors.textPrimary}
            />
          ),
          onPress: () => {},
        },
      ],
    },
  ];

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      <View
        style={{
          justifyContent: 'space-between',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: 'bold',
            color: colors.textPrimary,
          }}
        >
          Menu
        </Text>
        <LucideSettings color={colors.textPrimary} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
          marginVertical: 20,
        }}
      >
        <Image
          source={IC_PROFILE}
          style={{ height: 40, width: 40, borderRadius: 20 }}
        />
        <View>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.textPrimary,
            }}
          >
            Raihan Sorkar
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            @raihan_sorkar
          </Text>
        </View>
      </View>

      <SectionList
        sections={menus}
        renderSectionHeader={({ section }) => (
          <View
            style={{
              marginVertical: 8,
              display: section.id === 1 ? 'none' : 'flex',
              height: 1,
              backgroundColor: colors.textSecondary,
            }}
          />
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={item.onPress}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginVertical: 10,
            }}
          >
            {item.icon}
            <Text
              style={{
                fontSize: 16,
                fontWeight: '500',
                color: colors.textPrimary,
                marginLeft: 10,
              }}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

export default MenuScreen;

const styles = StyleSheet.create({});
