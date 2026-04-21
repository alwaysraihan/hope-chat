import { createSlice } from '@reduxjs/toolkit';
import { MediaMessage } from '../../../hooks/useHelpAssistant';

const initialState: { replayTo: MediaMessage | null } = {
  replayTo: null,
};

const inboxSlice = createSlice({
  name: 'inbox',
  initialState,
  reducers: {
    setReplayTo: (state, action) => {
      state.replayTo = action.payload;
    },
    resetReplayTo: state => {
      state.replayTo = null;
    },
  },
});

export const { setReplayTo, resetReplayTo } = inboxSlice.actions;

export default inboxSlice.reducer;
