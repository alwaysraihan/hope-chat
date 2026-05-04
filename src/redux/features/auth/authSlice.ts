import { createSlice } from '@reduxjs/toolkit';

const initialState: { token: string | null } = {
  token: "emon.hossain",
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken: (state, action) => {
      state.token = action.payload;
    },
  },
});

export const selectToken = (state: any) => state.auth.token;
export const { setToken } = authSlice.actions;
export default authSlice.reducer;
