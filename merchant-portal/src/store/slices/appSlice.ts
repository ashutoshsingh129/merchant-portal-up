import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AppState {
    isLoading: boolean;
    theme: 'light' | 'dark';
    user: {
        name: string;
        email: string;
    } | null;
}

const initialState: AppState = {
    isLoading: false,
    theme: 'light',
    user: null,
};

const appSlice = createSlice({
    name: 'app',
    initialState,
    reducers: {
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
            state.theme = action.payload;
        },
        setUser: (state, action: PayloadAction<AppState['user']>) => {
            state.user = action.payload;
        },
        clearUser: state => {
            state.user = null;
        },
    },
});

export const { setLoading, setTheme, setUser, clearUser } = appSlice.actions;
export default appSlice.reducer;
