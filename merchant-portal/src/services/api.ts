import { User, ApiResponse } from '../types';
import { getEnvironmentConfig } from '../utils';

// Simulated API delay to mimic real API calls
const API_DELAY = 1000; // 1 second

// Simulated users data
const mockUsers: User[] = [
    {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: 'Admin',
        createdAt: '2024-01-15T10:30:00Z',
    },
    {
        id: '2',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        role: 'User',
        createdAt: '2024-01-16T14:20:00Z',
    },
    {
        id: '3',
        name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        role: 'Moderator',
        createdAt: '2024-01-17T09:15:00Z',
    },
    {
        id: '4',
        name: 'Alice Brown',
        email: 'alice.brown@example.com',
        role: 'User',
        createdAt: '2024-01-18T16:45:00Z',
    },
    {
        id: '5',
        name: 'Charlie Wilson',
        email: 'charlie.wilson@example.com',
        role: 'Admin',
        createdAt: '2024-01-19T11:20:00Z',
    },
    {
        id: '6',
        name: 'Diana Davis',
        email: 'diana.davis@example.com',
        role: 'Moderator',
        createdAt: '2024-01-20T13:30:00Z',
    },
];

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulate random API errors (10% chance)
const shouldSimulateError = () => Math.random() < 0.1;

export class ApiService {
    private baseUrl: string;

    constructor() {
        const config = getEnvironmentConfig();
        this.baseUrl = config.API_BASE_URL;
    }

    // Simulate fetching users from API
    async getUsers(): Promise<ApiResponse<User[]>> {
        try {
            // Simulate API delay
            await delay(API_DELAY);

            // Simulate random API errors
            if (shouldSimulateError()) {
                throw new Error('Failed to fetch users. Please try again.');
            }

            // Simulate successful API response
            return {
                data: mockUsers,
                message: 'Users fetched successfully',
                success: true,
            };
        } catch (error) {
            // Simulate API error response
            return {
                data: [],
                message:
                    error instanceof Error
                        ? error.message
                        : 'An unexpected error occurred',
                success: false,
            };
        }
    }

    // Simulate fetching a single user by ID
    async getUserById(id: string): Promise<ApiResponse<User | null>> {
        try {
            await delay(API_DELAY / 2); // Faster for single user

            if (shouldSimulateError()) {
                throw new Error('Failed to fetch user. Please try again.');
            }

            const user = mockUsers.find(u => u.id === id);

            return {
                data: user || null,
                message: user ? 'User fetched successfully' : 'User not found',
                success: !!user,
            };
        } catch (error) {
            return {
                data: null,
                message:
                    error instanceof Error
                        ? error.message
                        : 'An unexpected error occurred',
                success: false,
            };
        }
    }

    // Simulate creating a new user
    async createUser(
        userData: Omit<User, 'id' | 'createdAt'>
    ): Promise<ApiResponse<User>> {
        try {
            await delay(API_DELAY);

            if (shouldSimulateError()) {
                throw new Error('Failed to create user. Please try again.');
            }

            const newUser: User = {
                ...userData,
                id: (mockUsers.length + 1).toString(),
                createdAt: new Date().toISOString(),
            };

            mockUsers.push(newUser);

            return {
                data: newUser,
                message: 'User created successfully',
                success: true,
            };
        } catch (error) {
            return {
                data: {} as User,
                message:
                    error instanceof Error
                        ? error.message
                        : 'An unexpected error occurred',
                success: false,
            };
        }
    }

    // Simulate updating a user
    async updateUser(
        id: string,
        userData: Partial<User>
    ): Promise<ApiResponse<User | null>> {
        try {
            await delay(API_DELAY);

            if (shouldSimulateError()) {
                throw new Error('Failed to update user. Please try again.');
            }

            const userIndex = mockUsers.findIndex(u => u.id === id);

            if (userIndex === -1) {
                return {
                    data: null,
                    message: 'User not found',
                    success: false,
                };
            }

            mockUsers[userIndex] = { ...mockUsers[userIndex], ...userData };

            return {
                data: mockUsers[userIndex],
                message: 'User updated successfully',
                success: true,
            };
        } catch (error) {
            return {
                data: null,
                message:
                    error instanceof Error
                        ? error.message
                        : 'An unexpected error occurred',
                success: false,
            };
        }
    }

    // Simulate deleting a user
    async deleteUser(id: string): Promise<ApiResponse<boolean>> {
        try {
            await delay(API_DELAY);

            if (shouldSimulateError()) {
                throw new Error('Failed to delete user. Please try again.');
            }

            const userIndex = mockUsers.findIndex(u => u.id === id);

            if (userIndex === -1) {
                return {
                    data: false,
                    message: 'User not found',
                    success: false,
                };
            }

            mockUsers.splice(userIndex, 1);

            return {
                data: true,
                message: 'User deleted successfully',
                success: true,
            };
        } catch (error) {
            return {
                data: false,
                message:
                    error instanceof Error
                        ? error.message
                        : 'An unexpected error occurred',
                success: false,
            };
        }
    }
}

// Export singleton instance
export const apiService = new ApiService();
