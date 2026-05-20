import { View, StyleSheet, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState, useEffect } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import FloatingButton from './FloatingButton';

interface CameraOverlayProps {
  onCapture: (uri: string) => void;
  onClose: () => void;
}

export default function CameraOverlay({ onCapture, onClose }: CameraOverlayProps) {
  const cameraRef = useRef<CameraView>(null);
  const isMountedRef = useRef(true);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);

  // Fix C: Move permission request to useEffect (not in render body)
  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // Fix D: Track mount status for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Camera permissions are still loading
  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: 'black' }} />;
  }

  const takePhoto = async () => {
    if (!cameraRef.current || isCapturing || !isMountedRef.current) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri && isMountedRef.current) {
        
        // Ensure image width never exceeds 1080p, vastly reducing payload sizes.
        const manipResult = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 1080 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        onCapture(manipResult.uri);
      }
    } catch (e) {
      console.error('Camera capture error:', e);
    } finally {
      if (isMountedRef.current) {
        setIsCapturing(false);
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <StatusBar hidden />
      <CameraView ref={cameraRef} style={{ flex: 1 }} />

      {/* Close Button */}
      <Pressable
        style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
        onPress={onClose}
      >
        <MaterialIcons name="close" size={32} color="#fff" />
      </Pressable>

      <FloatingButton label={isCapturing ? "Saving..." : "Capture"} onPress={takePhoto} bottom={50} />
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 25,
  },
});