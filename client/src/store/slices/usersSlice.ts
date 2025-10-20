import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, ApiResponse } from '../../types';
import { apiService } from '../../services/api';

// Async thunk for fetching users
export const fetchUsers = createAsyncThunk(
    'users/fetchUsers',
    async (_, { rejectWithValue }) => {
        try {
            const response: ApiResponse<User[]> = await apiService.getUsers();

            if (response.success) {
                return response.data;
            } else {
                return rejectWithValue(response.message);
            }
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to fetch users'
            );
        }
    }
);

// Async thunk for fetching a single user
export const fetchUserById = createAsyncThunk(
    'users/fetchUserById',
    async (id: string, { rejectWithValue }) => {
        try {
            const response: ApiResponse<User | null> =
                await apiService.getUserById(id);

            if (response.success && response.data) {
                return response.data;
            } else {
                return rejectWithValue(response.message);
            }
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to fetch user'
            );
        }
    }
);

// Async thunk for creating a user
export const createUser = createAsyncThunk(
    'users/createUser',
    async (userData: Omit<User, 'id' | 'createdAt'>, { rejectWithValue }) => {
        try {
            const response: ApiResponse<User> =
                await apiService.createUser(userData);

            if (response.success) {
                return response.data;
            } else {
                return rejectWithValue(response.message);
            }
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to create user'
            );
        }
    }
);

// Async thunk for updating a user
export const updateUser = createAsyncThunk(
    'users/updateUser',
    async (
        { id, userData }: { id: string; userData: Partial<User> },
        { rejectWithValue }
    ) => {
        try {
            const response: ApiResponse<User | null> =
                await apiService.updateUser(id, userData);

            if (response.success && response.data) {
                return response.data;
            } else {
                return rejectWithValue(response.message);
            }
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to update user'
            );
        }
    }
);

// Async thunk for deleting a user
export const deleteUser = createAsyncThunk(
    'users/deleteUser',
    async (id: string, { rejectWithValue }) => {
        try {
            const response: ApiResponse<boolean> =
                await apiService.deleteUser(id);

            if (response.success) {
                return id; // Return the ID of the deleted user
            } else {
                return rejectWithValue(response.message);
            }
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to delete user'
            );
        }
    }
);

interface UsersState {
    users: User[];
    selectedUser: User | null;
    loading: boolean;
    error: string | null;
    lastFetch: string | null;
}

const initialState: UsersState = {
    users: [],
    selectedUser: null,
    loading: false,
    error: null,
    lastFetch: null,
};

const usersSlice = createSlice({
    name: 'users',
    initialState,
    reducers: {
        clearError: state => {
            state.error = null;
        },
        clearSelectedUser: state => {
            state.selectedUser = null;
        },
        setSelectedUser: (state, action: PayloadAction<User>) => {
            state.selectedUser = action.payload;
        },
    },
    extraReducers: builder => {
        builder
            // Fetch users
            .addCase(fetchUsers.pending, state => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchUsers.fulfilled, (state, action) => {
                state.loading = false;
                state.users = action.payload;
                state.lastFetch = new Date().toISOString();
                state.error = null;
            })
            .addCase(fetchUsers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch user by ID
            .addCase(fetchUserById.pending, state => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchUserById.fulfilled, (state, action) => {
                state.loading = false;
                state.selectedUser = action.payload;
                state.error = null;
            })
            .addCase(fetchUserById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create user
            .addCase(createUser.pending, state => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createUser.fulfilled, (state, action) => {
                state.loading = false;
                state.users.push(action.payload);
                state.error = null;
            })
            .addCase(createUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Update user
            .addCase(updateUser.pending, state => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateUser.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.users.findIndex(
                    user => user.id === action.payload.id
                );
                if (index !== -1) {
                    state.users[index] = action.payload;
                }
                if (state.selectedUser?.id === action.payload.id) {
                    state.selectedUser = action.payload;
                }
                state.error = null;
            })
            .addCase(updateUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Delete user
            .addCase(deleteUser.pending, state => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteUser.fulfilled, (state, action) => {
                state.loading = false;
                state.users = state.users.filter(
                    user => user.id !== action.payload
                );
                if (state.selectedUser?.id === action.payload) {
                    state.selectedUser = null;
                }
                state.error = null;
            })
            .addCase(deleteUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearError, clearSelectedUser, setSelectedUser } =
    usersSlice.actions;
export default usersSlice.reducer;
