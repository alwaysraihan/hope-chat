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
import { IC_PROFILE } from '../assets';
import {
  LucideArrowLeft,
  LucideBell,
  LucidePalette,
  LucidePersonStanding,
  LucidePhone,
  LucideSettings,
  LucideVideo,
} from 'lucide-react-native';

const colors = {
  primary: '#FF4E8C',
  primaryLight: '#FF7FA8',
  primaryDark: '#CC3E70',

  background: '#F4F4F4',
  surface: '#F8FAFC',

  textPrimary: '#10182B',
  textSecondary: '#4A5568',
  placeholder: "#A0AEC0",

  accent: '#6366F1',
  success: '#22C55E',
  error: '#EF4444',
};

const ProfileScreen = () => {
  const sectionsData = [
    {
      id: 1,
      title: 'Customization',
      data: [
        {
          id: 1,
          title: 'Theme',
          image: <LucidePalette size={22} color={colors.primary} />,
          type: 'switch',
          url: '',
        },
        {
          id: 2,
          title: 'Quick reaction',
          image: <LucidePalette size={22} color={colors.primary} />,
          type: 'switch',
          url: '',
        },
        {
          id: 3,
          title: 'Nicknames',
          image: <LucidePalette size={22} color={colors.primary} />,
          type: 'switch',
          url: '',
        },
        {
          id: 4,
          title: 'Word effects',
          image: <LucidePalette size={22} color={colors.primary} />,
          type: 'switch',
          url: '',
        },
      ],
    },
    {
      id: 2,
      title: 'More actions',
      data: [
        {
          id: 1,
          title: 'Create group with',
          image: <LucidePalette size={22} color={colors.primary} />,
          type: 'switch',
          url: '',
        },
        {
          id: 2,
          title: 'View media, files, and links',
          image: <LucidePalette size={22} color={colors.primary} />,
          type: 'switch',
          url: '',
        },
        {
          id: 3,
          title: 'Auto-save photos',
          image: <LucidePalette size={22} color={colors.primary} />,
          type: 'switch',
          url: '',
        },
        {
          id: 4,
          title: 'Pinned messages',
          image: <LucidePalette size={22} color={colors.primary} />,
          type: 'switch',
          url: '',
        },
      ],
    },
    {
      id: 3,
      title: 'Privacy & support',
      data: [
        {
          id: 1,
          title: 'Message permissions',
          image: <LucidePalette size={22} color={colors.primary} />,
          type: 'switch',
          url: '',
        },
        {
          id: 2,
          title: 'Privacy policy',
          image: <LucidePalette size={22} color={colors.primary} />,
          type: 'switch',
          url: '',
        },
        {
          id: 3,
          title: 'Support',
          image: <LucidePalette size={22} color={colors.primary} />,
          type: 'switch',
          url: '',
        },
      ],
    },
  ];

  const actionButton = [
    {
      id: 1,
      name: 'Audio',
      icon: <LucidePhone fill={'white'} stroke={'white'} />,
    },
    {
      id: 2,
      name: 'Video',
      icon: <LucideVideo fill={'white'} stroke={'white'} />,
    },
    {
      id: 3,
      name: 'Profile',
      icon: <LucidePersonStanding fill={'white'} stroke={'white'} />,
    },
    {
      id: 4,
      name: 'Mute',
      icon: <LucideBell fill={'white'} stroke={'white'} />,
    },
  ];

  const listHeader = () => {
    return (
      <>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <TouchableOpacity>
            <LucideArrowLeft />
          </TouchableOpacity>
          <View>
            <LucideSettings />
          </View>
        </View>
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            marginVertical: 20,
          }}
        >
          <Image
            source={IC_PROFILE}
            style={{ height: 100, width: 100, borderRadius: 50 }}
          />
          <Text
            style={{
              fontWeight: 'bold',
              fontSize: 20,
              marginVertical: 10,
              textAlign: 'center',
            }}
          >
            MD Emon Hossain
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              gap: 20,
            }}
          >
            {actionButton.map(item => (
              <TouchableOpacity key={item.id}>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {item.icon}
                </View>
                <Text style={{ textAlign: 'center' }}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <SectionList
        ListHeaderComponent={listHeader}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        sections={sectionsData}
        renderItem={({ item }) => (
          <TouchableOpacity style={{ flexDirection: 'row', gap: 10 }}>
            {item.image}
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: 'semibold',
              }}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
        )}
        renderSectionHeader={({ section }) => (
          <Text
            style={{
              fontSize: 16,
              marginVertical: 4,
              color: colors.primaryLight,
            }}
          >
            {section.title}
          </Text>
        )}
        contentContainerStyle={{
          gap: 12,
        }}
      />
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
