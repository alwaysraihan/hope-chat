import {
  Image,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IC_PROFILE } from '../assets';
import {
  ALargeSmall,
  ArrowDownToLine,
  Bell,
  BlocksIcon,
  Eye,
  ImageIcon,
  LucideArrowLeft,
  LucideBell,
  LucidePalette,
  LucidePersonStanding,
  LucidePhone,
  LucideSettings,
  LucideVideo,
  Pin,
  Shield,
  ThumbsUp,
  TypeIcon,
  Users,
} from 'lucide-react-native';
import { colorss } from '../theme';

import { RootStackNavigatorParamList } from '../types/navigators';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import OptionModal from '../components/profile/OptionModal';
import ProfileHeader from '../components/profile/ProfileHeader';
import SectionItem from '../components/profile/SectionItem';
type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Profile'>;

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [visibleMuteModal, setVisibleMuteModal] = useState(false);
  const [muteIndex, setMuteIndex] = useState<number | null>(null);
  const [muteDurationModal, setMuteDurationModal] = useState(false);
  const [muteDuration, setMuteDuration] = useState<number | null>(null);

  const sectionsData = [
    {
      id: 1,
      title: 'Customization',
      data: [
        {
          id: 1,
          title: 'Theme',
          image: <LucidePalette size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {
            navigation.navigate('Theme');
          },
        },
        {
          id: 2,
          title: 'Quick reaction',
          image: <ThumbsUp size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {},
        },
        {
          id: 3,
          title: 'Nicknames',
          image: <LucidePalette size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {
            navigation.navigate('Nicknames');
          },
        },
        {
          id: 4,
          title: 'Word effects',
          image: <ALargeSmall size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {
            navigation.navigate('WordEffects');
          },
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
          image: <Users size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {
            navigation.navigate('NewGroup');
          },
        },
        {
          id: 2,
          title: 'View media, files, and links',
          image: <ImageIcon size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {
            navigation.navigate('MediaTab', { screen: 'Media' });
          },
        },
        {
          id: 3,
          title: 'Auto-save photos',
          image: <ArrowDownToLine size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {
            navigation.navigate('AutoSavePhotos');
          },
        },
        {
          id: 4,
          title: 'Pinned messages',
          image: <Pin size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {
            navigation.navigate('PinnedMessages');
          },
        },
        {
          id: 5,
          title: 'Notification & sounds',
          image: <Bell size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {
            navigation.navigate('NotificationsSounds');
          },
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
          image: (
            <Shield fill={colorss.primary} size={22} color={colorss.primary} />
          ),
          type: 'switch',
          onPress: () => {},
        },
        {
          id: 4,
          title: 'Blocked users',
          image: <BlocksIcon size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {
            navigation.navigate('BlockedUser');
          },
        },
        {
          id: 5,
          title: 'Read Receipts',
          image: <Eye size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {
            navigation.navigate('ReadReceipts');
          },
        },
        {
          id: 6,
          title: 'Typing indicator',
          image: <TypeIcon size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {
            navigation.navigate('TypingIndicator');
          },
        },
        {
          id: 2,
          title: 'Privacy policy',
          image: <LucidePalette size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {},
        },
        {
          id: 3,
          title: 'Support',
          image: <LucidePalette size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => {},
        },
      ],
    },
  ];

  const actionButton = [
    {
      id: 1,
      name: 'Audio',
      icon: <LucidePhone fill={'white'} stroke={'white'} />,
      onPress: () => {
        navigation.navigate('AudioCall');
      },
    },
    {
      id: 2,
      name: 'Video',
      icon: <LucideVideo fill={'white'} stroke={'white'} />,
      onPress: () => {},
    },
    {
      id: 3,
      name: 'Profile',
      icon: <LucidePersonStanding fill={'white'} stroke={'white'} />,
      onPress: () => {},
    },
    {
      id: 4,
      name: 'Mute',
      icon: <LucideBell fill={'white'} stroke={'white'} />,
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
        ListHeaderComponent={<ProfileHeader actionButton={actionButton} />}
        renderItem={({ item }) => <SectionItem item={item} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        SectionSeparatorComponent={() => <View style={{ height: 20 }} />}
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
    color: colorss.primaryLight,
    marginBottom: 6,
    marginTop: 10,
  },
});
