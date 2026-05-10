/**
 * Maps LiveKit {@link import('livekit-client').DisconnectReason} to in-app copy.
 * @see https://docs.livekit.io/home/client/tracks/subscribe/#connection-failures
 */
import { DisconnectReason } from 'livekit-client';

export type DisconnectUiAction = {
  showAlert: boolean;
  title: string;
  body: string;
  logLabel: string;
};

/** Normal hang up — no banner. */
export function describeDisconnectReason(
  reason: DisconnectReason | undefined,
): DisconnectUiAction {
  if (reason === undefined) {
    return {
      showAlert: true,
      title: 'Call ended',
      body: 'The connection closed. If this was unexpected, check your internet and try again.',
      logLabel: 'undefined_reason',
    };
  }

  switch (reason) {
    case DisconnectReason.CLIENT_INITIATED:
      return {
        showAlert: false,
        title: '',
        body: '',
        logLabel: 'CLIENT_INITIATED',
      };

    case DisconnectReason.DUPLICATE_IDENTITY:
      return {
        showAlert: true,
        title: 'Signed in elsewhere',
        body:
          'This account joined the call from another device. Only one session per identity is allowed.',
        logLabel: 'DUPLICATE_IDENTITY',
      };

    case DisconnectReason.SERVER_SHUTDOWN:
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.ROOM_CLOSED:
      return {
        showAlert: true,
        title: 'Call ended',
        body: 'The call room was closed on the server.',
        logLabel: 'ROOM_ENDED',
      };

    case DisconnectReason.PARTICIPANT_REMOVED:
      return {
        showAlert: true,
        title: 'Removed from call',
        body: 'You were removed from this call.',
        logLabel: 'PARTICIPANT_REMOVED',
      };

    case DisconnectReason.USER_REJECTED:
    case DisconnectReason.USER_UNAVAILABLE:
      return {
        showAlert: true,
        title: 'Call ended',
        body: 'The other person was unavailable or declined.',
        logLabel: 'USER_REJECTED_OR_UNAVAILABLE',
      };

    case DisconnectReason.JOIN_FAILURE:
      return {
        showAlert: true,
        title: 'Could not join',
        body:
          'Could not join the call. Check that you are online and try again.',
        logLabel: 'JOIN_FAILURE',
      };

    case DisconnectReason.SIGNAL_CLOSE:
      return {
        showAlert: true,
        title: 'Connection lost',
        body:
          'The connection to the server dropped. Check your network and try again.',
        logLabel: 'SIGNAL_CLOSE',
      };

    case DisconnectReason.CONNECTION_TIMEOUT:
    case DisconnectReason.MEDIA_FAILURE:
      return {
        showAlert: true,
        title: 'Connection issue',
        body:
          'Media or network timed out. Move to better Wi‑Fi or cellular and try again.',
        logLabel: 'TIMEOUT_OR_MEDIA',
      };

    case DisconnectReason.STATE_MISMATCH:
      return {
        showAlert: true,
        title: 'Session expired',
        body: 'Your session could not be resumed. Please start the call again.',
        logLabel: 'STATE_MISMATCH',
      };

    case DisconnectReason.MIGRATION:
      return {
        showAlert: false,
        title: '',
        body: '',
        logLabel: 'MIGRATION',
      };

    case DisconnectReason.SIP_TRUNK_FAILURE:
    case DisconnectReason.AGENT_ERROR:
      return {
        showAlert: true,
        title: 'Call ended',
        body: 'A telephony or server error ended the call.',
        logLabel: 'SIP_OR_AGENT',
      };

    case DisconnectReason.UNKNOWN_REASON:
    default:
      return {
        showAlert: true,
        title: 'Call ended',
        body:
          'The connection ended. Check your internet and try again if the problem continues.',
        logLabel: `UNKNOWN_OR_${String(reason)}`,
      };
  }
}
