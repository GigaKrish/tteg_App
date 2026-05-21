// services/api/reportApi.ts
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { apiClient } from './apiClient';
import { locationProcessor } from '../location/locationProcessor';
import { API_URL } from '../../utils/constants';
import type { Report, Marker } from '../../types/models.types';
import type { UploadReportData } from '../../types/api.types';

// Types for user markers pagination
export interface UserMarkersParams {
  page?: number;
  limit?: number;
}

export interface UserMarkersResult {
  data: Marker[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

export const reportApi = {
  /**
   * Get markers for the current user with pagination
   */
  async getUserMarkers(params?: UserMarkersParams): Promise<UserMarkersResult> {
    const queryParts: string[] = [];
    if (params?.page) queryParts.push(`page=${params.page}`);
    if (params?.limit) queryParts.push(`limit=${params.limit}`);
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return apiClient.get<UserMarkersResult>(`/api/upload/my-markers${queryString}`);
  },

  /**
   * Upload a new report with photos
   */
  async uploadReport(data: UploadReportData, signal?: AbortSignal): Promise<{ success: boolean; report: Report }> {
    // 1. Process location entirely from geotron data (MID priority, fallback to any device)
    const processedLocation = locationProcessor.processLocation(
      data.geotronData,
      data.roleMap
    );

    // 2. Determine accuracy from MID geotron, fallback to any active device
    const roleMap: Record<string, string> = data.roleMap ? JSON.parse(data.roleMap) : {};
    const geotronDataParsed = data.geotronData ? JSON.parse(data.geotronData) : {};

    let accuracy: number | null = null;

    // First try MID device for accuracy
    const midDeviceId = Object.entries(roleMap).find(([_, role]) => role === 'MID')?.[0];
    if (midDeviceId && geotronDataParsed[midDeviceId]?.accuracy != null) {
      accuracy = geotronDataParsed[midDeviceId].accuracy;
    } else {
      // Fallback: first device with accuracy
      const deviceValues = Object.values(geotronDataParsed) as any[];
      if (deviceValues.length > 0) {
        const firstDevice = deviceValues[0];
        if (firstDevice && firstDevice.accuracy != null) {
          accuracy = firstDevice.accuracy;
        }
      }
    }

    // 3. Build role-keyed geotronLocations: { MID: {...}, LEFT: {...}, RIGHT: {...} }
    const roleKeyedLocations = processedLocation.roleKeyedLocations;

    // 4. Build FormData
    const formData = new FormData();

    // Add photos
    data.photoUris.forEach((uri, index) => {
      const cleanUri = Platform.OS === 'android' ? uri : uri.replace('file://', '');
      const fileName = `upload_${Date.now()}_${index}.jpg`;

      formData.append('photos', {
        uri: cleanUri,
        name: fileName,
        type: 'image/jpeg',
      } as any);
    });

    // Add location data
    formData.append('latitude', processedLocation.finalLatitude.toString());
    formData.append('longitude', processedLocation.finalLongitude.toString());
    formData.append('readableAddress', '');

    // Add GPS metadata
    if (accuracy != null) {
      formData.append('accuracy', accuracy.toString());
    }

    // Add TTEG-specific fields from surveyData
    if (data.surveyData) {
      const survey = typeof data.surveyData === 'string' ? JSON.parse(data.surveyData) : data.surveyData;

      formData.append('cameraType', survey.cameraType || '');
      formData.append('resourceId', survey.resourceId || '');
      formData.append('remark', survey.remark || '');
    }

    // Add metadata
    formData.append('geotronLocations', JSON.stringify(roleKeyedLocations));

    // Add device info
    formData.append('deviceInfo', JSON.stringify({
      os: Platform.OS === 'ios' ? 'iOS' : 'Android',
      osVersion: Device.osVersion || null,
      manufacturer: Device.manufacturer || null,
      brand: Device.brand || null,
      modelName: Device.modelName || null,
      deviceName: Device.deviceName || null,
    }));

    // 5. Upload to server
    return apiClient.postFormData('/api/upload', formData, true, signal);
  },

  /**
   * Request soft-deletion of a report
   */
  async requestDelete(reportId: string, reason: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post(`/api/upload/${reportId}/request-delete`, { reason });
  },
};
