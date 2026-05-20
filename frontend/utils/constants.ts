// utils/constants.ts

// API Configuration
import Constants from 'expo-constants';

const expoApiBaseUrl = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
  ?.apiBaseUrl;

// Single source of truth: app.json → extra.apiBaseUrl
// In dev mode: falls back to local IP if app.json is empty
// In prod mode: app.json MUST have the URL configured
export const API_URL = (expoApiBaseUrl && expoApiBaseUrl.trim())
  ? expoApiBaseUrl.trim()
  : (__DEV__
    ? 'http://10.66.47.65:3000' // Development (local network via Wi-Fi)
    : (() => { console.error('FATAL: apiBaseUrl not set in app.json for production!'); return ''; })());

// Camera Type Options (TTEG)
export const CAMERA_TYPES = [
  'PTZ Camera',
  'Bullet Camera',
  'UHD Camera',
  'Dome Camera'
] as const;

// App Configuration
export const CONFIG = {
  // Upload limits
  MAX_PHOTOS: 4,
  MAX_FILE_SIZE_MB: 25,

  // Geotron polling
  GEOTRON_POLL_INTERVAL: 1000, // 1 second

  // GPS settings
  GPS_ACCURACY_THRESHOLD: 50, // meters
  GPS_TIMEOUT: 10000, // 10 seconds

  // Retry settings
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// Storage keys
export const STORAGE_KEYS = {
  USER_TOKEN: 'userToken',
  USER_ID: 'userId',
  USER_DATA: 'userData',
  OFFLINE_QUEUE: 'offlineQueue',
} as const;

// Map configuration
export const MAP_CONFIG = {
  DEFAULT_ZOOM: 15,
  MARKER_COLORS: {
    GEOTRON_ACTIVE: '#4CD964', // Green for geotron-tagged
    DEFAULT: '#2196F3', // Blue for default
    GEOTRON_DEVICE: '#FF5722', // Red for active geotron device
  },
} as const;
