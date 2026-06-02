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

export type DonationRequestType = 'blood' | 'food' | 'essential' | 'product' | 'general';

export interface DonationRequestPayload {
  donationId: number;
  postId: string;
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  /** Discriminates blood / food / essential (product) requests for display. */
  requestType?: DonationRequestType;
}

export interface ExtendedMessage extends IMessage {
  /** Synthetic full-width welcome card at top of thread (Hopenity UX). */
  threadIntro?: {
    peerName: string;
    subtitle?: string;
    avatarUrl?: string | null;
  };
  /** Server-originated category — drives timeline styling for calls / voice / donation. */
  messageKind?: 'call_log' | 'voice_note' | 'text' | 'donation_request';
  donationRequest?: DonationRequestPayload;
  /** When the API returns receipts (outgoing messages). */
  delivery?: {
    state: 'sent' | 'delivered' | 'read';
    readAt?: string;
  };
  /** When API provides direction flags (`isOutgoing`, `direction`, …) for bubble alignment. */
  outgoingHint?: boolean;
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
