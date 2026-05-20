// File: components/ActiveGeotronMarker.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { truncCoord } from '../utils/formatters';

export const ActiveGeotronMarker = ({ deviceId, data, role }: { deviceId: string, data: any, role?: string }) => {
  // Must start true so Android captures the initial bitmap, then switch off for performance
  const [shouldTrack, setShouldTrack] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShouldTrack(false), 300);
    return () => clearTimeout(timer);
  }, []);

  if (!data?.latitude || !data?.longitude) return null;

  const getMarkerColor = (fixType: number) => {
    if (!fixType || fixType <= 2) return '#FF3B30'; // Red
    if (fixType === 3) return '#2196F3'; // Blue
    if (fixType === 4) return '#4CD964'; // Green
    if (fixType === 5) return '#E91E63'; // Pink
    return '#FF3B30';
  };

  const markerColor = getMarkerColor(data.fix_type);

  return (
    <Marker
      coordinate={{ latitude: data.latitude, longitude: data.longitude }}
      anchor={{ x: 0.5, y: 1.0 }}          // Pin tip at bottom-center = exact lat/long
      calloutAnchor={{ x: 0.5, y: 0.0 }}
      tracksViewChanges={shouldTrack}
      flat={false}
      zIndex={2000}
    >
      <View style={styles.pinContainer}>
        <Text style={styles.emojiPin}>📍</Text>
      </View>

      {/* 2. THE INFO BUBBLE (Data Display)
          tooltip={false} forces the standard white system bubble, which is very reliable.
      */}
      <Callout tooltip={false}>
        <View style={styles.bubble}>
          {/* Hardware ID + Role in Bold */}
          <Text style={styles.title}>{deviceId}{role ? ` (${role})` : ''}</Text>

          <View style={styles.divider} />

          {/* Lat/Long Display */}
          <Text style={styles.coordsLabel}>LOCATION</Text>
          <Text style={styles.coords}>
            {truncCoord(data.latitude)}, {truncCoord(data.longitude)}
          </Text>

          {/* Status Details */}
          <Text style={styles.tinyMeta}>
            Status: 3D Fix | Sats: {data.satellites || 0}
          </Text>
        </View>
      </Callout>
    </Marker>
  );
};

const styles = StyleSheet.create({
  pinContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  emojiPin: {
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  // Ensure the bubble has width so text doesn't wrap weirdly
  bubble: {
    width: 180,
    padding: 5
  },
  title: {
    fontWeight: 'bold',
    fontSize: 14,
    color: 'black',
    marginBottom: 4
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 4
  },
  coordsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a', // Green label
    marginTop: 2
  },
  coords: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2
  },
  tinyMeta: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4
  }
});