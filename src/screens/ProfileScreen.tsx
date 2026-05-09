import { SectionList, StyleSheet, Text, View } from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight,
  CircleSlash2,
  LucideBell,
  LucidePalette,
  LucidePhone,
  LucideVideo,
  Search,
  ThumbsUp,
  User,
  Users,
  UserX,
} from 'lucide-react-native';
import { colorss } from '../theme';

import { RootStackNavigatorParamList } from '../types/navigators';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import OptionModal from '../components/profile/OptionModal';
import ProfileHeader from '../components/profile/ProfileHeader';
import SectionItem from '../components/profile/SectionItem';
import DeleteChat from '../components/profile/DeleteChat';
type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Profile'>;

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [visibleMuteModal, setVisibleMuteModal] = useState(false);
  const [muteIndex, setMuteIndex] = useState<number | null>(null);
  const [muteDurationModal, setMuteDurationModal] = useState(false);
  const [muteDuration, setMuteDuration] = useState<number | null>(null);
  const [visibleDeleteChatModal, setVisibleDeleteChatModal] = useState(false);

  const sectionsData = [
    {
      id: 1,
      title: 'Customization',
      data: [
        {
          id: 1,
          title: 'Color',
          image: <LucidePalette size={24} color={colorss.primary} />,

          onPress: () => {
            navigation.navigate('Theme');
          },
        },
        {
          id: 2,
          title: 'Emoji',
          image: <ThumbsUp size={24} color={colorss.primary} />,

          onPress: () => {},
        },
        {
          id: 3,
          title: 'Nicknames',
          image: <ChevronRight size={24} color={colorss.primary} />,

          onPress: () => {
            navigation.navigate('Nicknames');
          },
        },
        // {
        //   id: 4,
        //   title: 'Word effects',
        //   image: <ALargeSmall size={24} color={colorss.primary} />,
        //
        //   onPress: () => {
        //     navigation.navigate('WordEffects');
        //   },
        // },
      ],
    },
    {
      id: 2,
      title: 'More actions',
      data: [
        {
          id: 6,
          title: 'Search in Conversation',
          image: <Search size={24} color={colorss.primary} />,

          onPress: () => {},
        },
        {
          id: 1,
          title: 'Create group',
          image: <Users size={24} color={colorss.primary} />,

          onPress: () => {
            navigation.navigate('NewGroup');
          },
        },

        // {
        //   id: 2,
        //   title: 'View media, files, and links',
        //   image: <ImageIcon size={24} color={colorss.primary} />,
        //
        //   onPress: () => {
        //     navigation.navigate('MediaTab', { screen: 'Media' });
        //   },
        // },
        // {
        //   id: 3,
        //   title: 'Auto-save photos',
        //   image: <ArrowDownToLine size={24} color={colorss.primary} />,
        //
        //   onPress: () => {
        //     navigation.navigate('AutoSavePhotos');
        //   },
        // },
        // {
        //   id: 4,
        //   title: 'Pinned messages',
        //   image: <Pin size={24} color={colorss.primary} />,
        //
        //   onPress: () => {
        //     navigation.navigate('PinnedMessages');
        //   },
        // },
        // {
        //   id: 5,
        //   title: 'Notification & sounds',
        //   image: <Bell size={24} color={colorss.primary} />,
        //
        //   onPress: () => {
        //     navigation.navigate('NotificationsSounds');
        //   },
        // },
      ],
    },
    {
      id: 3,
      title: 'Privacy',
      data: [
        {
          id: 1,
          title: 'Notifications',
          image: (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 17, color: colorss.textSecondary }}>
                On
              </Text>
              <ChevronRight size={24} color={colorss.border} />
            </View>
          ),
        },
        {
          id: 2,
          title: 'Ignore Messages',
          image: <CircleSlash2 size={24} color={colorss.primary} />,

          onPress: () => {},
        },
        {
          id: 3,
          title: 'Block',
          image: <UserX size={24} color={colorss.primary} />,

          onPress: () => {},
        },
      ],
    },
  ];

  const actionButton = [
    {
      id: 1,
      name: 'Audio',
      icon: <LucidePhone fill={colorss.primary} stroke={colorss.primary} />,
      onPress: () => {
        navigation.navigate('AudioCall');
      },
    },
    {
      id: 2,
      name: 'Video',
      icon: <LucideVideo fill={colorss.primary} stroke={colorss.primary} />,
      onPress: () => {},
    },
    {
      id: 3,
      name: 'Profile',
      icon: <User fill={colorss.primary} stroke={colorss.primary} />,
      onPress: () => {},
    },
    {
      id: 4,
      name: 'Mute',
      icon: <LucideBell fill={colorss.primary} stroke={colorss.primary} />,
      onPress: () => setVisibleMuteModal(true),
    },
  ];

  const muteOptions = [
    {
      id: 1,
      title: 'Mute message notifications',
    },
    {
      id: 2,
      title: 'Mute call notifications',
    },
    {
      id: 3,
      title: 'Mute message and call notifications',
    },
  ];

  const muteDurationData = [
    {
      id: 1,
      title: 'For 15 minutes',
    },
    {
      id: 2,
      title: 'For 1 hour',
    },
    {
      id: 3,
      title: 'For 8 hours',
    },
    {
      id: 4,
      title: 'For 24 hours',
    },
    {
      id: 5,
      title: 'Until I turn it off',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <SectionList
        sections={sectionsData}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={
          <ProfileHeader
            actionButton={actionButton}
            onBackPress={() => navigation.goBack()}
          />
        }
        renderItem={({ item }) => <SectionItem item={item} />}
        renderSectionHeader={({ section }) => {
          if (section.id === 1) return null;
          return <Text style={styles.sectionHeader}>{section.title}</Text>;
        }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Mute type */}
      <OptionModal
        visible={visibleMuteModal}
        title="Mute this chat?"
        data={muteOptions}
        selected={muteIndex}
        onSelect={setMuteIndex}
        onCancel={() => setVisibleMuteModal(false)}
        onConfirm={() => {
          setVisibleMuteModal(false);
          setMuteDurationModal(true);
        }}
      />

      {/* Mute duration */}
      <OptionModal
        visible={muteDurationModal}
        title="Select duration"
        data={muteDurationData}
        selected={muteDuration}
        onSelect={setMuteDuration}
        onCancel={() => setMuteDurationModal(false)}
        onConfirm={() => {
          setMuteDurationModal(false);
        }}
      />
      <DeleteChat
        visible={visibleDeleteChatModal}
        onCancel={() => setVisibleDeleteChatModal(false)}
      />
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorss.white,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 14,
    color: colorss.textSecondary,
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
});
