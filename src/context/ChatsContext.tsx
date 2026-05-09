import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAppSelector } from '../hooks/redux';
import { conversations as mockConversations } from '../data/mockData';
import { remapDefaultMessagesForPeer } from '../data/chatTemplates';
import type { ExtendedMessage } from '../components/types/chat';

export type ConversationSummary = {
  id: string;
  name: string;
  emoji?: string;
  bgFrom?: string;
  bgTo?: string;
  preview: string;
  time: string;
  unreadCount: number;
  isOnline?: boolean;
  isUnread?: boolean;
  isGroup?: boolean;
  isTyping?: boolean;
  avatarUrl?: string | null;
  messages: ExtendedMessage[];
};

type ChatsContextValue = {
  conversations: ConversationSummary[];
  setConversations: React.Dispatch<React.SetStateAction<ConversationSummary[]>>;
  bumpUnread: (conversationId: string, delta?: number) => void;
};

const ChatsContext = createContext<ChatsContextValue | null>(null);

export function useChats(): ChatsContextValue {
  const ctx = useContext(ChatsContext);
  if (!ctx) {
    throw new Error('useChats must be used within ChatsProvider');
  }
  return ctx;
}

function seedFromMocks(
  localUser: { _id: string | number; name: string },
): ConversationSummary[] {
  return mockConversations.map(row => ({
    ...row,
    avatarUrl: null,
    messages: remapDefaultMessagesForPeer(row.id, row.name, localUser),
  }));
}

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const localUser =
    useAppSelector(s => s.auth.giftedChatUser) ?? {
      _id: 'me',
      name: 'You',
    };

  const [conversations, setConversations] = useState<ConversationSummary[]>(
    () => seedFromMocks(localUser),
  );

  useEffect(() => {
    setConversations(seedFromMocks(localUser));
  }, [localUser._id, localUser.name]);

  const bumpUnread = useCallback((conversationId: string, delta = 1) => {
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId
          ? { ...c, unreadCount: Math.max(0, c.unreadCount + delta) }
          : c,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({
      conversations,
      setConversations,
      bumpUnread,
    }),
    [bumpUnread, conversations],
  );

  return (
    <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
  );
}
