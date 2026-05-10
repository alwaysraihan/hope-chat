require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: { IOS: {}, ANDROID: {} },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    BLOCKED: 'blocked',
    DENIED: 'denied',
    GRANTED: 'granted',
    LIMITED: 'limited',
  },
  check: jest.fn(() => Promise.resolve('granted')),
  request: jest.fn(() => Promise.resolve('granted')),
  openSettings: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-keyboard-controller', () => {
  const React = require('react');
  const { View, ScrollView } = require('react-native');

  const Box = ({ children, ...props }) =>
    React.createElement(View, props, children);

  return {
    KeyboardProvider: ({ children }) => children,
    KeyboardAvoidingView: Box,
    KeyboardStickyView: Box,
    KeyboardAwareScrollView: ScrollView,
    KeyboardToolbar: Box,
    KeyboardChatScrollView: ScrollView,
    OverKeyboardView: Box,
    KeyboardExtender: Box,
    DefaultKeyboardToolbarTheme: {},
    useKeyboardHandler: jest.fn(),
    KeyboardController: {
      setInputMode: jest.fn(),
      dismiss: jest.fn(),
    },
    KeyboardEvents: {
      emitter: { addListener: jest.fn(() => ({ remove: jest.fn() })) },
    },
    useResizeMode: () => 'native',
  };
});
