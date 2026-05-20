// types/api.types.ts
import type { GeotronAssignment } from './models.types';

export interface ApiError {
  error: string;
  details?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    _id: string;
    email: string;
    fullName: string;
    assignedGeotrons: GeotronAssignment[];
  };
}

// Note: User registration is handled by admin/database directly

export interface UploadReportData {
  photoUris: string[];
  geotronData: string;
  roleMap?: string;  // JSON string of deviceId → role mapping
  surveyData?: string; // JSON string of { state, city, district, cameraType, resourceId, remark }
}
