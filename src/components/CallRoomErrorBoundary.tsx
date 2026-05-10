import React, { type ReactNode } from 'react';
import { Alert } from 'react-native';

import { navigationRef } from '../navigation/navigationRef';
import { stringifyUnknownError } from '../utils/liveKitErrorFormat';

type Props = { children: ReactNode; title: string; onClose: () => void };

type State = { hasError: boolean };

/**
 * Catches render errors inside LiveKit room UI so the app can show the cause
 * instead of closing abruptly (native crashes are not catchable here).
 */
export class CallRoomErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const detail = stringifyUnknownError(error);
    console.error(`[CallRoom] ${this.props.title}`, detail);
    try {
      Alert.alert(
        this.props.title,
        error?.message ||
          'Something went wrong in the call screen. Details were logged to the console.',
      );
    } catch {
      /* */
    }
    try {
      this.props.onClose();
    } catch {
      try {
        if (navigationRef.isReady()) {
          navigationRef.navigate('BottomTab', { screen: 'Home' });
        }
      } catch {
        /* */
      }
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
