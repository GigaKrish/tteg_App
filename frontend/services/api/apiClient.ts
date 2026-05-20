// services/api/apiClient.ts
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS, API_URL } from '../../utils/constants';
import type { ApiError } from '../../types/api.types';

// API_URL is imported from constants.ts which reads from:
// 1. app.json extra.apiBaseUrl (if set)
// 2. __DEV__ ? local IP : production URL (fallback)

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    console.log('[ApiClient] Initialized with URL:', baseURL);
  }

  private async getHeaders(includeAuth: boolean = true): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.USER_TOKEN);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async get<T>(endpoint: string, requiresAuth: boolean = true): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: await this.getHeaders(requiresAuth),
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(
    endpoint: string,
    data: any,
    requiresAuth: boolean = true
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(requiresAuth),
      body: JSON.stringify(data),
    });

    return this.handleResponse<T>(response);
  }

  async postFormData<T>(
    endpoint: string,
    formData: FormData,
    requiresAuth: boolean = true
  ): Promise<T> {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.USER_TOKEN);
    const headers: HeadersInit = {};

    if (requiresAuth && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: await this.getHeaders(true),
    });

    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const body: any = await response.json().catch(() => ({
        error: 'Request failed',
      }));
      // Backend may return { error: "string" } or { error: { message: "string" } }
      const errField = body.error;
      const errMsg = typeof errField === 'string'
        ? errField
        : errField?.message || body.message || `HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(API_URL);

