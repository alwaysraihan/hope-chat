import { useState, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';

// iOS: the *Will* events fire as the animation starts, so the toolbar's padding
// changes in step with the keyboard instead of snapping after it lands (the
// visible jump). Android only has the *Did* events.
const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

const useKeyboardVisible = () => {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(SHOW_EVENT, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(HIDE_EVENT, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return isKeyboardVisible;
};

export default useKeyboardVisible;
