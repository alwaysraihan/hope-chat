import React, { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ALargeSmall,
  AlertTriangle,
  ArrowDownToLine,
  Ban,
  Bell,
  CircleSlash,
  ClockFading,
  Eye,
  ImageIcon,
  LucideBell,
  LucidePalette,
  LucidePersonStanding,
  LucidePhone,
  LucideVideo,
  Pin,
  Shield,
  ThumbsUp,
  Trash2,
  TypeIcon,
  Unlock,
  Users,
} from 'lucide-react-native';
import { colorss } from '../theme';
import { RootStackNavigatorParamList } from '../types/navigators';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import OptionModal from '../components/profile/OptionModal';
import ProfileHeader from '../components/profile/ProfileHeader';
import SectionItem from '../components/profile/SectionItem';
import DeleteChat from '../components/profile/DeleteChat';
import { useChats } from '../context/ChatsContext';
import { useAppSelector } from '../hooks/redux';
import {
  selectAuthToken,
  selectHopenityProfile,
} from '../redux/features/auth/authSlice';
import { resolveLiveKitRoomName } from '../utils/livekitRoomId';
import { notifyPeerIncomingHopeChatCall } from '../services/invitePeerToHopeChatCall';
import { fetchHopenityChatDirectory } from '../services/chatService';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Profile'>;

const ProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const chatId = route.params.userId;
  const token = useAppSelector(selectAuthToken);
  const myProfile = useAppSelector(selectHopenityProfile);

  const { conversations } = useChats();
  const conversation = useMemo(
    () => conversations.find(c => c.id === chatId),
    [conversations, chatId],
  );

  const peerName = conversation?.name ?? 'Chat';
  const avatarUrl = conversation?.avatarUrl ?? null;
  const peerUserId = conversation?.peerUserId ?? undefined;

  // Track blocked state — reload from server on focus so it stays fresh.
  const [isBlocked, setIsBlocked] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      fetchHopenityChatDirectory(token, { status: 'blocked', limit: 100 })
        .then(dir => {
          setIsBlocked(dir.chats.some(c => String(c.id) === String(chatId)));
        })
        .catch(() => {});
    }, [token, chatId]),
  );

  const [visibleMuteModal, setVisibleMuteModal] = useState(false);
  const [muteIndex, setMuteIndex] = useState<number | null>(null);
  const [muteDurationModal, setMuteDurationModal] = useState(false);
  const [muteDuration, setMuteDuration] = useState<number | null>(null);
  const [visibleDeleteChatModal, setVisibleDeleteChatModal] = useState(false);

  const audioRoom = useMemo(
    () =>
      resolveLiveKitRoomName({
        conversationId: chatId,
        localUserId: myProfile?.userId,
        peerUserId,
      }),
    [chatId, myProfile?.userId, peerUserId],
  );

  const videoRoom = audioRoom;

  const actionButton = [
    {
      id: 1,
      name: 'Audio',
      icon: <LucidePhone fill="white" stroke="white" />,
      onPress: () => {
        notifyPeerIncomingHopeChatCall({
          token,
          conversationId: chatId,
          liveKitRoom: audioRoom,
          callKind: 'audio',
        });
        navigation.navigate('AudioCall', {
          displayName: peerName,
          liveKitRoom: audioRoom,
          avatarUrl,
          conversationId: chatId,
          peerUserId,
          callDirection: 'outgoing',
        });
      },
    },
    {
      id: 2,
      name: 'Video',
      icon: <LucideVideo fill="white" stroke="white" />,
      onPress: () => {
        notifyPeerIncomingHopeChatCall({
          token,
          conversationId: chatId,
          liveKitRoom: videoRoom,
          callKind: 'video',
        });
        navigation.navigate('VideoCall', {
          displayName: peerName,
          liveKitRoom: videoRoom,
          avatarUrl,
          conversationId: chatId,
          peerUserId,
          callDirection: 'outgoing',
        });
      },
    },
    {
      id: 3,
      name: 'Profile',
      icon: <LucidePersonStanding fill="white" stroke="white" />,
      onPress: () => {},
    },
    {
      id: 4,
      name: 'Mute',
      icon: <LucideBell fill="white" stroke="white" />,
      onPress: () => setVisibleMuteModal(true),
    },
  ];

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
          onPress: () => navigation.navigate('Theme'),
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
          onPress: () => navigation.navigate('Nicknames'),
        },
        {
          id: 4,
          title: 'Word effects',
          image: <ALargeSmall size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => navigation.navigate('WordEffects'),
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
          onPress: () => navigation.navigate('NewGroup'),
        },
        {
          id: 2,
          title: 'View media, files, and links',
          image: <ImageIcon size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => navigation.navigate('MediaTab', { screen: 'Media' }),
        },
        {
          id: 3,
          title: 'Auto-save photos',
          image: <ArrowDownToLine size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => navigation.navigate('AutoSavePhotos'),
        },
        {
          id: 4,
          title: 'Pinned messages',
          image: <Pin size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => navigation.navigate('PinnedMessages'),
        },
        {
          id: 5,
          title: 'Notification & sounds',
          image: <Bell size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => navigation.navigate('NotificationsSounds'),
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
          onPress: () => navigation.navigate('MessagePermissions'),
        },
        {
          id: 2,
          title: 'Read receipts',
          image: <Eye size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => navigation.navigate('ReadReceipts'),
        },
        {
          id: 3,
          title: 'Disappearing messages',
          image: <ClockFading size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () =>
            navigation.navigate('DisappearingMessages', {
              conversationId: chatId,
            }),
        },
        {
          id: 4,
          title: 'Restrict',
          image: <CircleSlash size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => navigation.navigate('RestrictUser'),
        },
        {
          id: 5,
          title: isBlocked ? `Unblock ${peerName}` : `Block ${peerName}`,
          image: isBlocked ? (
            <Unlock size={22} color={colorss.error} />
          ) : (
            <Ban size={22} color={colorss.error} />
          ),
          type: 'switch',
          onPress: () =>
            navigation.navigate('BlockedUser', {
              chatId,
              peerName,
              isBlocked,
            }),
        },
        {
          id: 6,
          title: 'Report a problem',
          image: <AlertTriangle size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => navigation.navigate('ReportProblem'),
        },
        {
          id: 7,
          title: 'Typing indicator',
          image: <TypeIcon size={22} color={colorss.primary} />,
          type: 'switch',
          onPress: () => navigation.navigate('TypingIndicator'),
        },
        {
          id: 8,
          title: 'Delete chat',
          image: <Trash2 size={22} color={colorss.error} />,
          type: 'switch',
          onPress: () => setVisibleDeleteChatModal(true),
        },
      ],
    },
  ];

  const muteOptions = [
    { id: 1, title: 'Mute message notifications' },
    { id: 2, title: 'Mute call notifications' },
    { id: 3, title: 'Mute message and call notifications' },
  ];

  const muteDurationData = [
    { id: 1, title: 'For 15 minutes' },
    { id: 2, title: 'For 1 hour' },
    { id: 3, title: 'For 8 hours' },
    { id: 4, title: 'For 24 hours' },
    { id: 5, title: 'Until I turn it off' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <SectionList
        sections={sectionsData}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={
          <ProfileHeader
            actionButton={actionButton}
            name={peerName}
            avatarUrl={avatarUrl}
            onBack={() => navigation.goBack()}
          />
        }
        renderItem={({ item }) => <SectionItem item={item} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        SectionSeparatorComponent={() => <View style={{ height: 20 }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />

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

      <OptionModal
        visible={muteDurationModal}
        title="Select duration"
        data={muteDurationData}
        selected={muteDuration}
        onSelect={setMuteDuration}
        onCancel={() => setMuteDurationModal(false)}
        onConfirm={() => setMuteDurationModal(false)}
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
    color: colorss.primaryLight,
    marginBottom: 6,
    marginTop: 10,
  },
});
