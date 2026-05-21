import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,
  Alert, InteractionManager, Modal, Dimensions, StatusBar, Pressable, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseModal } from './ui/BaseModal';
import { FormInput } from './ui/FormInput';
import { FormPicker } from './ui/FormPicker';

const CAMERA_TYPES = ['PTZ Camera', 'Bullet Camera', 'UHD Camera', 'Dome Camera'];
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function clearSessionFormCache() {
  // No-op: session cache removed (state/city/district no longer collected)
}

interface Props {
  visible: boolean;
  isTemporarilyHidden?: boolean;
  onCancel: () => void;
  onSubmit: (compiledProperty?: any) => void;
  onAddPhoto?: () => void;
  onRemovePhoto?: (index: number) => void;
  photos?: string[];
  loading?: boolean;
  onCancelUpload?: () => void;
  locationData?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
  } | null;
}

export default function ReportFormModal({
  visible, isTemporarilyHidden, onCancel, onSubmit, onAddPhoto, onRemovePhoto, photos = [], loading, onCancelUpload, locationData
}: Props) {

  const [cameraType, setCameraType] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [remark, setRemark] = useState('');

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);



  const resetFormFields = () => {
    setCameraType('');
    setResourceId('');
    setRemark('');
  };


  useEffect(() => {
    if (!visible && !isTemporarilyHidden) {
      const handle = InteractionManager.runAfterInteractions(() => {
        resetFormFields();
        setShowPreview(false);
      });
      return () => handle.cancel();
    }
  }, [visible, isTemporarilyHidden]);

  const validate = () => {
    if (!cameraType || !resourceId) {
      Alert.alert("Missing Fields", "Please fill all the required fields.");
      return false;
    }
    if (photos.length === 0) {
      Alert.alert("No Photos", "Please capture at least one photo.");
      return false;
    }
    return true;
  };

  const handlePreview = () => {
    if (validate()) {
      setShowPreview(true);
    }
  };

  const handleFinalSubmit = () => {
    onSubmit({
      cameraType,
      resourceId,
      remark
    });
  };

  // ── Fullscreen Photo Viewer ──
  if (fullscreenPhoto) {
    return (
      <Modal visible animationType="fade" statusBarTranslucent>
        <StatusBar hidden />
        <View style={fs.container}>
          <Image source={{ uri: fullscreenPhoto }} style={fs.image} resizeMode="contain" />
          <TouchableOpacity style={fs.closeBtn} onPress={() => setFullscreenPhoto(null)}>
            <Ionicons name="close-circle" size={36} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // ── Preview Screen ──
  if (showPreview) {
    return (
      <BaseModal visible={visible} onClose={() => setShowPreview(false)} title="Review & Submit">
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Data Summary Card */}
          <View style={pv.card}>
            <Text style={pv.cardTitle}>Asset Details</Text>

            <View style={pv.row}>
              <Ionicons name="videocam" size={16} color="#6366f1" />
              <Text style={pv.label}>Camera Type</Text>
              <Text style={pv.value}>{cameraType}</Text>
            </View>
            <View style={pv.divider} />

            <View style={pv.row}>
              <Ionicons name="barcode" size={16} color="#6366f1" />
              <Text style={pv.label}>Resource ID</Text>
              <Text style={pv.value}>{resourceId}</Text>
            </View>

            {remark ? (
              <>
                <View style={pv.divider} />
                <View style={pv.row}>
                  <Ionicons name="chatbox-ellipses" size={16} color="#6366f1" />
                  <Text style={pv.label}>Remark</Text>
                  <Text style={[pv.value, { fontStyle: 'italic' }]}>{remark}</Text>
                </View>
              </>
            ) : null}
            
            {locationData && (
              <>
                <View style={pv.divider} />
                <View style={pv.row}>
                  <Ionicons name="location" size={16} color="#6366f1" />
                  <Text style={pv.label}>Location</Text>
                  <Text style={pv.value}>{locationData.latitude}, {locationData.longitude}</Text>
                </View>
                <View style={pv.row}>
                  <Ionicons name="analytics" size={16} color="#6366f1" />
                  <Text style={pv.label}>Altitude</Text>
                  <Text style={pv.value}>{locationData.altitude != null ? `${locationData.altitude.toFixed(1)}m` : 'N/A'}</Text>
                </View>
                <View style={pv.row}>
                  <Ionicons name="contract" size={16} color="#6366f1" />
                  <Text style={pv.label}>Control Val</Text>
                  <Text style={pv.value}>{locationData.accuracy != null ? `${(locationData.accuracy * 100).toFixed(1)}cm` : 'N/A'}</Text>
                </View>
              </>
            )}
          </View>

          {/* Photos */}
          <View style={pv.card}>
            <Text style={pv.cardTitle}>Captured Photos ({photos.length}/4)</Text>
            <Text style={pv.photoHint}>Tap a photo to view full size</Text>
            <View style={pv.photoGrid}>
              {photos.map((uri, idx) => (
                <Pressable key={idx} onPress={() => setFullscreenPhoto(uri)} style={pv.photoCard}>
                  <Image source={{ uri }} style={pv.photoImage} />
                  <View style={pv.photoOverlay}>
                    <Ionicons name="expand" size={18} color="white" />
                  </View>
                  <View style={pv.photoBadge}>
                    <Text style={pv.photoBadgeText}>{idx + 1}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPreview(false)}>
            <Ionicons name="arrow-back" size={16} color="#64748b" />
            <Text style={[styles.cancelBtnText, { marginLeft: 4 }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }, { backgroundColor: '#059669' }]}
            onPress={handleFinalSubmit}
            disabled={loading}
          >
            <Ionicons name="cloud-upload" size={16} color="white" />
            <Text style={[styles.submitBtnText, { marginLeft: 6 }]}>{loading ? 'Uploading...' : 'Confirm & Submit'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Upload Progress Overlay ── */}
        {loading && (
          <Modal transparent visible animationType="fade">
            <View style={fs.loadingOverlayContainer}>
              <View style={fs.loadingBox}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={fs.loadingOverlayText}>Uploading Report...</Text>
                <Text style={fs.loadingOverlaySubText}>Please do not close the app.</Text>
                
                {onCancelUpload && (
                  <TouchableOpacity style={fs.cancelUploadBtn} onPress={onCancelUpload}>
                    <Text style={fs.cancelUploadBtnText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Modal>
        )}
      </BaseModal>
    );
  }

  // ── Main Form ──
  return (
    <BaseModal visible={visible} onClose={onCancel} title="New Asset Report">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>


        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Asset Details</Text>

          <FormPicker
            label="Camera Type *"
            selectedValue={cameraType}
            onValueChange={setCameraType}
            placeholder="-- Select Camera Type --"
            items={CAMERA_TYPES.map(i => ({ label: i, value: i }))}
          />

          <FormInput label="Resource ID *" placeholder="Unique identifier" value={resourceId} onChangeText={setResourceId} />
          <FormInput label="Remark" placeholder="Any additional notes" value={remark} onChangeText={setRemark} />
        </View>

        <View style={styles.photoSection}>
          <View style={styles.photoHeader}>
            <Text style={styles.photoTitle}>Captured Photos ({photos.length}/4) *</Text>
            {photos.length < 4 && (
              <TouchableOpacity onPress={onAddPhoto} style={styles.addPhotoBtn}>
                <Ionicons name="camera" size={16} color="white" />
                <Text style={styles.addPhotoText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.photoGrid}>
            {photos.map((uri, idx) => (
              <View key={idx} style={styles.photoCard}>
                <Pressable onPress={() => setFullscreenPhoto(uri)}>
                  <Image source={{ uri }} style={styles.photoImage} />
                </Pressable>
                <TouchableOpacity style={styles.removePhotoBtn} onPress={() => onRemovePhoto?.(idx)}>
                  <Ionicons name="trash" size={16} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, (loading || photos.length === 0) && { opacity: 0.5 }]}
          onPress={handlePreview}
          disabled={loading || photos.length === 0}
        >
          <Ionicons name="eye" size={16} color="white" />
          <Text style={[styles.submitBtnText, { marginLeft: 6 }]}>Preview</Text>
        </TouchableOpacity>
      </View>
    </BaseModal>
  );
}

// ── Fullscreen photo viewer & Loading styles ──
const fs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  image: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  loadingOverlayContainer: { 
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', alignItems: 'center' 
  },
  loadingBox: { 
    backgroundColor: 'white', padding: 24, borderRadius: 16, 
    alignItems: 'center', width: '80%', elevation: 10, shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 
  },
  loadingOverlayText: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginTop: 16 },
  loadingOverlaySubText: { fontSize: 12, color: '#64748b', marginTop: 8, textAlign: 'center' },
  cancelUploadBtn: { 
    marginTop: 20, paddingVertical: 10, paddingHorizontal: 24, 
    borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' 
  },
  cancelUploadBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 14 }
});

// ── Preview styles ──
const pv = StyleSheet.create({
  card: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  label: { fontSize: 13, color: '#64748b', fontWeight: '600', marginLeft: 8, width: 90 },
  value: { fontSize: 14, color: '#1e293b', fontWeight: '500', flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 4 },
  photoHint: { fontSize: 12, color: '#94a3b8', marginBottom: 10 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '31%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoImage: { width: '100%', height: '100%', backgroundColor: '#e2e8f0' },
  photoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  photoBadge: {
    position: 'absolute', top: 4, left: 4, backgroundColor: '#6366f1',
    width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center',
  },
  photoBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
});

// ── Form styles ──
const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepContainer: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1
  },
  stepTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  photoSection: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#e2e8f0'
  },
  photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  photoTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  addPhotoBtn: {
    backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4
  },
  addPhotoText: { color: 'white', fontWeight: '600', fontSize: 13 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '31%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  photoImage: { width: '100%', height: '100%', backgroundColor: '#e2e8f0' },
  removePhotoBtn: {
    position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(239,68,68,0.9)',
    padding: 6, borderRadius: 6
  },
  footer: {
    flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 12
  },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: '700', fontSize: 15 },
  submitBtn: { flex: 2, padding: 14, borderRadius: 10, backgroundColor: '#3b82f6', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
