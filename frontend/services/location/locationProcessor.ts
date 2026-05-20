// services/location/locationProcessor.ts
import type { GeotronData, GeotronDevice } from '../../types/models.types';

export interface ProcessedLocation {
  finalLatitude: number;
  finalLongitude: number;
  usedGeotron: boolean;
  geotronDevice?: string;
  /** Role-keyed geotron locations: { MID: {...}, LEFT: {...}, RIGHT: {...} } */
  roleKeyedLocations: Record<string, GeotronDevice>;
}

export const locationProcessor = {
  /**
   * Process location entirely from geotron data.
   * Prioritizes the MID geotron for primary lat/lng, falls back to any valid device.
   * Also builds a role-keyed map of all active geotron data.
   *
   * @param geotronDataString - JSON string of geotron devices (keyed by device ID)
   * @param roleMapString - JSON string of deviceId → role mapping (e.g. { "GEOTRON_01": "MID" })
   * @returns Processed location with priority logic applied
   */
  processLocation(
    geotronDataString: string,
    roleMapString?: string
  ): ProcessedLocation {
    let finalLatitude = 0;
    let finalLongitude = 0;
    let usedGeotron = false;
    let geotronDevice: string | undefined;
    const roleKeyedLocations: Record<string, GeotronDevice> = {};

    try {
      const devices: GeotronData = JSON.parse(geotronDataString || '{}');
      const roleMap: Record<string, string> = roleMapString ? JSON.parse(roleMapString) : {};

      // 1. Build role-keyed locations for ALL active devices
      for (const [deviceId, device] of Object.entries(devices)) {
        if (this.isValidGeotronFix(device)) {
          const role = roleMap[deviceId];
          if (role) {
            roleKeyedLocations[role] = device;
          }
        }
      }

      // 2. Primary location: prefer MID, fall back to any valid device
      if (roleKeyedLocations['MID']) {
        const midDevice = roleKeyedLocations['MID'];
        finalLatitude = midDevice.latitude!;
        finalLongitude = midDevice.longitude!;
        usedGeotron = true;
        geotronDevice = Object.entries(roleMap).find(([_, r]) => r === 'MID')?.[0];
        console.log(`✓ Using MID Geotron GPS from ${geotronDevice}`);
      } else {
        // Fallback: first valid geotron
        for (const [deviceId, device] of Object.entries(devices)) {
          if (this.isValidGeotronFix(device)) {
            finalLatitude = device.latitude!;
            finalLongitude = device.longitude!;
            usedGeotron = true;
            geotronDevice = deviceId;
            console.log(`✓ MID unavailable, using Geotron GPS from ${deviceId} (role: ${roleMap[deviceId] || 'unknown'})`);
            break;
          }
        }
      }

      if (!usedGeotron) {
        console.log('⚠ No valid Geotron fix — location will be 0,0');
      }
    } catch (error) {
      console.warn('Failed to parse geotron data:', error);
    }

    return {
      finalLatitude,
      finalLongitude,
      usedGeotron,
      geotronDevice,
      roleKeyedLocations,
    };
  },

  /**
   * Check if geotron device has valid GPS fix
   */
  isValidGeotronFix(device: GeotronDevice): boolean {
    return !!(
      device &&
      device.latitude !== undefined &&
      device.longitude !== undefined &&
      device.fix_type !== undefined &&
      device.fix_type > 0
    );
  },

  /**
   * Get best available device from geotron data
   */
  getBestDevice(geotronDataString: string): GeotronDevice | null {
    try {
      const devices: GeotronData = JSON.parse(geotronDataString || '{}');
      let bestDevice: GeotronDevice | null = null;
      let bestQuality = 0;

      for (const device of Object.values(devices)) {
        if (this.isValidGeotronFix(device)) {
          // Quality score based on fix_type and satellites
          const quality =
            (device.fix_type || 0) * 10 + (device.satellites_used || 0);

          if (quality > bestQuality) {
            bestQuality = quality;
            bestDevice = device;
          }
        }
      }

      return bestDevice;
    } catch {
      return null;
    }
  },
};

