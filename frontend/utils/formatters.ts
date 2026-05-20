// utils/formatters.ts
import type { GeotronAssignment } from '../types/models.types';

/**
 * Normalize assignedGeotrons from either the legacy string[] format
 * or the new { geotronName, role }[] format into a consistent GeotronAssignment[].
 * Handles cached user sessions from before the schema migration.
 */
export const normalizeGeotronAssignments = (raw: any): GeotronAssignment[] => {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((item: any) => {
    if (typeof item === 'string') {
      // Legacy format: plain device ID string → assign no role
      return { geotronName: item, role: '' };
    }
    if (item && typeof item === 'object' && item.geotronName) {
      return { geotronName: item.geotronName, role: item.role || '' };
    }
    // Unknown format, skip
    return null;
  }).filter(Boolean) as GeotronAssignment[];
};

/**
 * Truncate a coordinate to 7 decimal places WITHOUT rounding.
 * e.g. 21.21322219 → "21.2132221"  (not "21.2132222")
 */
export const truncCoord = (value: number | undefined | null, decimals: number = 7): string => {
  if (value == null) return '--';
  const factor = Math.pow(10, decimals);
  // Math.trunc drops the fractional part after shifting, so no rounding occurs
  return (Math.trunc(value * factor) / factor).toFixed(decimals);
};

export const formatters = {
  date: (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  },

  coordinates: (lat: number, lng: number): string => {
    return `${truncCoord(lat)}, ${truncCoord(lng)}`;
  },

  fileSize: (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  },
};


