// services/api/authApi.ts
import { apiClient } from './apiClient';
import type { AuthResponse } from '../../types/api.types';

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    // SecureStore persistence is handled by useAuth hook after this returns
    return apiClient.post<AuthResponse>(
      '/auth/login',
      { email, password },
      false
    );
  },
};

