// TTEG App Types

export interface GeotronAssignment {
  geotronName: string;
  role: string; // 'LEFT' | 'RIGHT' | 'MID'
}

export interface User {
  _id: string;
  fullName: string;
  email: string;
  assignedGeotrons: GeotronAssignment[];
  surveyID?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface Report {
  _id?: string;
  userId?: string;
  photos: string[];
  thumbnails?: string[];
  location: {
    latitude: number;
    longitude: number;
    readableAddress?: string;
  };
  state: string;
  city: string;
  district: string;
  cameraType: string;
  resourceId: string;
  remark?: string;
  accuracy?: number;
  unique_id: string;
  geotronLocations?: GeotronData;
  deviceInfo?: {
    os: string;
    osVersion: string;
    manufacturer: string;
    brand: string;
    modelName: string;
    deviceName: string;
  };
  createdAt: string;
}

export interface GeotronDevice {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  fix_type?: number;
  satellites_used?: number;
  satellites?: number;
  hdop?: number;
  accuracy?: number;
  battery_percentage?: number;
  [key: string]: any;
}

export interface GeotronData {
  [deviceId: string]: GeotronDevice;
}

export interface Marker {
  _id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  photos: string[];
  thumbnails?: string[];
  state: string;
  city: string;
  district: string;
  cameraType: string;
  resourceId: string;
  remark?: string;
  accuracy?: number;
  unique_id: string;
  createdAt: string;
  geotronLocations?: GeotronData;
}
