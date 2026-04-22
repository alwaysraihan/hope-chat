import { IMessage } from 'react-native-gifted-chat';

export type MediaType = 'voice' | 'image' | 'video';

export interface MediaPayload {
  type: MediaType;
  url?: string;
  localUri?: string;
  remoteUri?: string;
  duration?: number;
  uploading?: boolean;
  error?: boolean;
  thumbnail?: string;
  width?: number;
  height?: number;
}

export interface ReactionItem {
  emoji: string;
  userId: string;
  userName: string;
}

export interface ExtendedMessage extends IMessage {
  media?: MediaPayload;
  pending?: boolean;
  failed?: boolean;
  reactions?: ReactionItem[];
  replyTo?: {
    _id: string | number;
    text?: string;
    media?: MediaPayload;
    user: { _id: string | number; name?: string };
  };
}

export interface Anchor {
  pageX: number;
  pageY: number;
  w: number;
  h: number;
}

export interface ReactionSummary {
  key: string;
  label: string;
  count: number;
}
