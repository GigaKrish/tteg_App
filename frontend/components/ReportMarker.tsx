import React, { memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { truncCoord } from '../utils/formatters';

const ReportMarkerComponent = ({ report, onPress, overrideColor }: { report: any, onPress?: (report: any) => void, overrideColor?: string }) => {
  const isHardware = report.geotronLocations && Object.keys(report.geotronLocations).length > 0;
  const color = overrideColor || (isHardware ? '#4CD964' : '#2196F3');

  // Start tracking so the custom view renders, then stop for performance
  const [shouldTrack, setShouldTrack] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShouldTrack(false), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: report.location.latitude, longitude: report.location.longitude }}
      anchor={{ x: 0.5, y: 1.0 }}        // Bottom-center of the view = the pin tip
      calloutAnchor={{ x: 0.5, y: 0.0 }}  // Callout appears above the pin
      onPress={() => onPress && onPress(report)}
      tracksViewChanges={shouldTrack}
      flat={false}
    >
      <View style={styles.pinContainer}>
        <Ionicons name="location" size={36} color={color} />
      </View>

      <Callout>
        <View style={styles.bubble}>
          <Text style={styles.title}>{report.cameraType || "Camera"} | {report.city || "Unknown"}</Text>
          <Text style={styles.meta}>ID: {report.unique_id || report.resourceId || 'N/A'}</Text>
          <Text style={styles.meta}>{report.district || "Unknown District"}, {report.state || ""}</Text>
          <Text style={styles.meta}>{new Date(report.createdAt).toLocaleString()}</Text>
          <Text style={styles.coords}>{truncCoord(report.location.latitude)}, {truncCoord(report.location.longitude)}</Text>
        </View>
      </Callout>
    </Marker>
  );
};

const styles = StyleSheet.create({
  // Container sized to exactly wrap the icon; icon tip touches the bottom edge
  pinContainer: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  bubble: { width: 200, padding: 5 },
  title: { fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: 'black' },
  meta: { fontSize: 11, color: '#333', marginBottom: 2 },
  coords: { fontSize: 10, color: '#999', marginTop: 2 }
});

// [OPTIMIZATION] Only re-render if ID or Position changes
export const ReportMarker = memo(ReportMarkerComponent, (prev, next) => {
  return (
    prev.report._id === next.report._id &&
    prev.report.location.latitude === next.report.location.latitude &&
    prev.report.location.longitude === next.report.location.longitude
  );
});