import { configureStore } from '@reduxjs/toolkit';
import api from './api';
import inboxSlice from './features/inbox/inboxSlice';

export const store = configureStore({
  reducer: {
    inbox: inboxSlice,
    api: api.reducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(api.middleware),
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
