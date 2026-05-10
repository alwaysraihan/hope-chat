/**
 * Full <App /> + navigation + chat need real TurboModules (camera roll, nitro-sound, etc.).
 * Use Detox / a physical device for WhatsApp-style lock-screen and background calling.
 * This file only smoke-tests Redux construction under Jest.
 */
import { store } from '../src/redux/store';

test('redux store initializes with auth and inbox slices', () => {
  const state = store.getState();
  expect(state.auth).toBeDefined();
  expect(state.inbox).toBeDefined();
});
