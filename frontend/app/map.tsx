import { View, StyleSheet, Pressable, Platform, Alert, ActivityIndicator, Text, ScrollView, Image, AppState, Animated, Dimensions, TextInput } from 'react-native';
import MapView from 'react-native-map-clustering';
import { PROVIDER_GOOGLE } from 'react-native-maps';
import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';

import FloatingButton from '../components/FloatingButton';
import CameraOverlay from '../components/CameraOverlay';
import GeotronStatusModal from '../components/GeotronStatusModal';
import ReportFormModal from '../components/ReportFormModal';
import UploadQueueModal from '../components/UploadQueueModal';
import { UserProfilePanel } from '../components/UserProfilePanel';
import { UserMarkerList } from '../components/UserMarkerList';
import { MapControlsDashboard } from '../components/MapControlsDashboard';

import { ReportMarker } from '../components/ReportMarker';
import { ActiveGeotronMarker } from '../components/ActiveGeotronMarker';
import { useUserLocation } from '../hooks/useUserLocation';
import { useAuth } from '../hooks/useAuth';
import { useGeotronPolling } from '../hooks/useGeotronPolling';
import { reportApi } from '../services/api/reportApi';
import { uploadQueue } from '../services/uploadQueue/queueManager';
import { locationProcessor } from '../services/location/locationProcessor';
import { truncCoord, normalizeGeotronAssignments } from '../utils/formatters';

const DEV_BYPASS_GEOTRON = false;
const DEV_MOCK_GEOTRON_DATA: Record<string, any> = DEV_BYPASS_GEOTRON ? {
    'DEV_MOCK_DEVICE': {
        latitude: 21.2514,
        longitude: 81.6296,
        altitude: 300,
        accuracy: 0.015,
        fix_type: 3,
        satellites_used: 12,
        hdop: 0.8,
        battery_percentage: 100,
    }
} : {};


export default function MapScreen() {
    const mapRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const { location } = useUserLocation();
    const { user, logout, refreshUser } = useAuth();

    // --- STATE ---
    const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
    const [showCamera, setShowCamera] = useState(false);
    const [photos, setPhotos] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const [userMarkers, setUserMarkers] = useState<any[]>([]);
    const [showMarkerList, setShowMarkerList] = useState(false);
    const [expandedMarkerId, setExpandedMarkerId] = useState<string | null>(null);
    const [injectedMarkerIds, setInjectedMarkerIds] = useState<Set<string>>(new Set());
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [activeRegion, setActiveRegion] = useState<any>(null);

    const visibleMarkers = useMemo(() => {
        if (!activeRegion) return userMarkers;

        // Add a 50% buffer zone around the screen so markers don't pop in abruptly
        const latBuffer = activeRegion.latitudeDelta * 0.5;
        const lngBuffer = activeRegion.longitudeDelta * 0.5;

        const latMax = activeRegion.latitude + (activeRegion.latitudeDelta / 2) + latBuffer;
        const latMin = activeRegion.latitude - (activeRegion.latitudeDelta / 2) - latBuffer;
        const lngMax = activeRegion.longitude + (activeRegion.longitudeDelta / 2) + lngBuffer;
        const lngMin = activeRegion.longitude - (activeRegion.longitudeDelta / 2) - lngBuffer;

        return userMarkers.filter(m => {
            const lat = m.location?.latitude;
            const lng = m.location?.longitude;
            if (lat == null || lng == null) return false;

            // Keep it if it's currently injected/selected, regardless of viewport
            if (injectedMarkerIds.has(m._id)) return true;

            return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;
        });
    }, [userMarkers, activeRegion, injectedMarkerIds]);

    const [showQueueModal, setShowQueueModal] = useState(false);
    const [pendingUploads, setPendingUploads] = useState(0);

    // User profile panel
    const [showUserPanel, setShowUserPanel] = useState(false);
    const userPanelAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;

    // Android Delete Flow state
    const [androidDeleteFocus, setAndroidDeleteFocus] = useState<string | null>(null);
    const [androidDeleteReason, setAndroidDeleteReason] = useState<string>('');

    const toggleUserPanel = useCallback(() => {
        const toValue = showUserPanel ? Dimensions.get('window').width : 0;
        setShowUserPanel(!showUserPanel);
        Animated.timing(userPanelAnim, {
            toValue,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [showUserPanel]);

    const isCameraActiveRef = useRef(false);
    const [markersLoaded, setMarkersLoaded] = useState(false);
    const [markersRefreshing, setMarkersRefreshing] = useState(false);

    // Form State
    const [showFormModal, setShowFormModal] = useState(false);

    // Geotron
    const [isGeotronActive, setIsGeotronActive] = useState(false);

    const handleAutoDisconnect = useCallback(() => {
        Alert.alert("Connection Lost", "Device signal lost or offline.");
        setIsGeotronActive(false); // This flips the button back to Slashed Red
    }, []);
    const { multiDeviceData, isConnecting, setIsConnecting, getButtonColor, roleMap } = useGeotronPolling(
        isGeotronActive,
        user,
        handleAutoDisconnect
    );


    // --- EXTENSION: GROUPING LOGIC ---
    const [lockedGeotronData, setLockedGeotronData] = useState<any>(null);

    // Handle soft-delete request with a remark

    useEffect(() => {
        // DON'T auto-load markers — wait for user to tap refresh

        // Subscribe to queue changes
        const unsubscribe = uploadQueue.subscribe((queue) => {
            const pending = queue.filter(
                u => u.status === 'pending' || u.status === 'uploading' || u.status === 'retrying'
            ).length;
            setPendingUploads(pending);
        });

        const unsubscribeSuccess = uploadQueue.onUploadSuccess(() => {
            console.log('[Map] Queue upload succeeded, refreshing markers...');
            loadMarkers();
        });

        return () => {
            unsubscribe();
            unsubscribeSuccess();
        };
    }, []);

    // Initial load: fetch last 20 across all zones
    const loadMarkers = async () => {
        try {
            setMarkersRefreshing(true);
            const result = await reportApi.getUserMarkers({ limit: 30 });
            setUserMarkers(result.data);
            setMarkersLoaded(true);
        } catch {
            console.error('Failed to load markers');
        } finally {
            setMarkersRefreshing(false);
        }
    };

    const handleToggleConnection = () => {
        if (DEV_BYPASS_GEOTRON) {
            setIsGeotronActive(!isGeotronActive);
            return;
        }
        const assignments = normalizeGeotronAssignments(user?.assignedGeotrons);
        if (assignments.length === 0) {
            Alert.alert("No Hardware", "No devices assigned.\n\nPlease contact central command for activation.");
            return;
        }

        // Just toggle the local boolean. The useGeotronPolling hook instantly starts/stops fetching 
        // the hardcoded URL based on this state.
        setIsGeotronActive(!isGeotronActive);
    };

    // --- PHOTO FLOW ---
    // Stable ref for photos — used in callbacks to avoid stale closures and prevent re-renders
    const photosRef = useRef(photos);
    photosRef.current = photos;

    // Fix: accepts compiled property data directly from manual entry path
    const proceedToCamera = (compiledProperty?: any) => {

        // BLOCK: Geotron must be connected with live data at the start of the report
        if (!DEV_BYPASS_GEOTRON && (!isGeotronActive || Object.keys(multiDeviceData).length === 0)) {
            Alert.alert(
                "Geotron Required",
                "You must connect to a Geotron device before starting a report.\n\nPlease turn ON the Geotron switch and wait for a connection."
            );
            return;
        }

        // BLOCK: ALL assigned geotrons must be active before locking
        if (!DEV_BYPASS_GEOTRON) {
            const assignedNames = normalizeGeotronAssignments(user?.assignedGeotrons).map(a => a.geotronName);
            const activeNames = Object.keys(multiDeviceData);
            const missingDevices = assignedNames.filter((name: string) => !activeNames.includes(name));
            if (missingDevices.length > 0) {
                Alert.alert(
                    "All Geotrons Required",
                    `The following assigned geotrons are not active:\n\n${missingDevices.join(', ')}\n\nAll assigned geotrons must be online before starting a report.`
                );
                return;
            }
        }

        // BLOCK: Accuracy gate — check BEFORE locking so the user gets instant feedback
        // Only check on first entry (when data is about to be locked from live polling)
        if (!lockedGeotronData && !DEV_BYPASS_GEOTRON) {
            const ACCURACY_THRESHOLD_M = 0.5; // 50 cm
            const failingDevices: { name: string; accuracy: number }[] = [];

            for (const [deviceId, device] of Object.entries(multiDeviceData) as [string, any][]) {
                if (device?.accuracy != null && device.accuracy > ACCURACY_THRESHOLD_M) {
                    failingDevices.push({ name: deviceId, accuracy: device.accuracy });
                }
            }

            if (failingDevices.length > 0) {
                const details = failingDevices
                    .map(d => `• ${d.name}: ${(d.accuracy * 100).toFixed(1)} cm`)
                    .join('\n');
                Alert.alert(
                    "⚠️ Accuracy Too Low",
                    `The following device(s) exceed the 50 cm accuracy threshold:\n\n${details}\n\nPlease wait for a better satellite fix or reposition the device(s) before starting a report.`
                );
                return;
            }
        }

        // Lock the geotron data for the duration of this survey so we jump off the polling loop 
        // and survive if the hardware disconnects mid-way
        if (!lockedGeotronData) {
            setLockedGeotronData(DEV_BYPASS_GEOTRON ? DEV_MOCK_GEOTRON_DATA : multiDeviceData);
        }

        // Guard against double-mount
        if (isCameraActiveRef.current) return;
        isCameraActiveRef.current = true;
        setShowCamera(true);
    };

    const handleCapture = useCallback((uri: string) => {
        if (photosRef.current.length >= 4) {
            Alert.alert("Photo Limit", "Max 4 photos allowed.");
            isCameraActiveRef.current = false;
            setShowCamera(false);
            return;
        }
        setPhotos(prev => [...prev, uri]);
        isCameraActiveRef.current = false;
        setShowCamera(false);

        // USER LOGIC: "this attribute form is supposed to be filled after photo is taken"
        // If the modal isn't already visible (meaning this was the first photo taken from the floating button), show the form.
        setShowFormModal(true);
    }, []);

    const handleRemovePhoto = (idx: number) => {
        if (idx === 0) {
            Alert.alert(
                "Reset GPS Lock?",
                "Deleting the first photo will reset the entire form and clear your locked GPS coordinates.\n\nAre you sure?",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Reset Form",
                        style: "destructive",
                        onPress: async () => {
                            setShowFormModal(false);
                            // Clean up file storage
                            if (photos && photos.length > 0) {
                                for (const uri of photos) {
                                    try {
                                        await FileSystem.deleteAsync(uri, { idempotent: true });
                                    } catch (e) { }
                                }
                            }
                            setPhotos([]);
                            setLockedGeotronData(null);
                        }
                    }
                ]
            );
        } else {
            setPhotos(photos.filter((_, i) => i !== idx));
        }
    };

    // === Extracted closures for stable references (prevent crash from 1Hz re-renders) ===

    const handleFormCancel = useCallback(async () => {
        setShowFormModal(false);
        // Cleanup abandoned photos to prevent memory leak
        const currentPhotos = photosRef.current;
        if (currentPhotos && currentPhotos.length > 0) {
            for (const uri of currentPhotos) {
                try {
                    await FileSystem.deleteAsync(uri, { idempotent: true });
                } catch (e) {
                    console.log('Failed to purge cache:', e);
                }
            }
        }
        setPhotos([]);
        setShowFormModal(false);
        setLockedGeotronData(null);
    }, []);

    const handleDeviceLocate = useCallback((deviceId: string) => {
        const dev = multiDeviceData[deviceId];
        if (dev && dev.latitude && dev.longitude) {
            mapRef.current?.animateToRegion({
                latitude: dev.latitude,
                longitude: dev.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            });
        } else {
            Alert.alert('Offline', 'Device is not sending location data.');
        }
    }, [multiDeviceData]);

    // Camera close with deferred ref reset — prevents rapid taps from bypassing the double-mount guard
    const handleCameraClose = useCallback(() => {
        setShowCamera(false);
        // Defer the ref reset until after React has committed the unmount
        requestAnimationFrame(() => {
            isCameraActiveRef.current = false;
        });
    }, []);

    // Main Submit Handler — accepts compiled property data from manual entry path
    const handleSubmit = async (compiledProperty?: any) => {
        const prop = compiledProperty;

        const geotronSource = lockedGeotronData || (DEV_BYPASS_GEOTRON ? DEV_MOCK_GEOTRON_DATA : multiDeviceData);

        // BLOCK: Geotron must have been connected at some point to start
        if (!DEV_BYPASS_GEOTRON && (!geotronSource || Object.keys(geotronSource).length === 0)) {
            Alert.alert(
                "Geotron Required",
                "Geotron location data was not captured. Please reconnect and try again."
            );
            return;
        }

        if (photos.length === 0) {
            Alert.alert("No Photos", "Please take at least one photo.");
            return;
        }
        if (!prop) {
            Alert.alert("Missing Data", "Please fill all the required fields.");
            return;
        }

        await processUpload(prop);
    };

    // Helper function to perform the actual upload with queue support
    const processUpload = async (propertyToUpload?: any) => {
        setIsUploading(true);
        const prop = propertyToUpload;

        // Reset controller for a new upload
        abortControllerRef.current = new AbortController();

        try {
            const geotronSource = lockedGeotronData || (DEV_BYPASS_GEOTRON ? DEV_MOCK_GEOTRON_DATA : multiDeviceData);

            // Prepare upload data — location is derived entirely from geotron data
            // in reportApi.uploadReport via locationProcessor
            const uploadData = {
                formData: {
                    geotronData: JSON.stringify(geotronSource),
                    roleMap: JSON.stringify(roleMap),
                    surveyData: prop ? JSON.stringify(prop) : undefined
                },
                photos: photos,
                metadata: {},
            };

            // Try direct upload first, only queue if it fails
            const result = await uploadQueue.tryDirectUploadOrQueue(
                uploadData,
                abortControllerRef.current.signal
            );

            if (result.success) {
                Alert.alert("Success", "Report uploaded successfully!");

                // Refresh markers
                await loadMarkers();

                // Auto-switch: show only the uploaded zone, open panel, expand it
                setShowMarkerList(true);

                // Reset Form
                setPhotos([]);
                setShowFormModal(false);
                setLockedGeotronData(null);

            } else {
                // Check if user manually cancelled
                if (result.error === 'Upload cancelled by user') {
                    // Do not close form or clear data, just let the user stay on the form
                    return;
                }

                // Check if this is an accuracy validation rejection — keep form open so user can retry
                if (result.error?.includes('GPS accuracy too low')) {
                    Alert.alert(
                        "⚠️ Accuracy Too Low",
                        result.error + "\n\nThe report was NOT uploaded. Please improve the satellite fix and tap Submit again.",
                    );
                    // Do NOT reset form or photos — user should retry after accuracy improves
                    return;
                }

                // Upload failed, added to queue for retry
                Alert.alert(
                    "Upload Queued",
                    `Upload failed (${result.error}). Added to queue for automatic retry.`,
                    [
                        {
                            text: "View Queue",
                            onPress: () => setShowQueueModal(true),
                        },
                        {
                            text: "OK",
                            style: "cancel",
                        },
                    ]
                );

                // Reset Form so user can continue
                setPhotos([]);
                setShowFormModal(false);
                setLockedGeotronData(null);

                // Refresh markers after a short delay (in case queue processes quickly)
                setTimeout(() => {
                    loadMarkers();
                }, 2000);
            }

        } catch (e: any) {
            console.error("Upload Error:", e);
            Alert.alert("Error", "Failed to process upload. Please try again.");
        } finally {
            setIsUploading(false);
            abortControllerRef.current = null;
        }
    };

    const handleCancelUpload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsUploading(false);
    };



    // Sync Marker Click to List (useCallback prevents marker re-renders)
    const handleMarkerClickSync = useCallback((report: any) => {
        setShowMarkerList(true);

        // Inject this specific marker ID into the state so it is guaranteed to render in the List
        // even if it originally fell outside the most recent 20 slice.
        setInjectedMarkerIds(prev => {
            const next = new Set(prev);
            next.add(report._id);
            return next;
        });

        setExpandedMarkerId(report._id);
    }, []);

    // Handle soft-delete request with a remark
    const handleDeleteEntry = (reportId: string) => {
        // React Native's Alert.prompt works flawlessly on iOS
        if (Platform.OS === 'ios') {
            Alert.prompt(
                "Request Deletion",
                "Please provide a reason for deleting this report. This request will be reviewed by an admin.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Submit",
                        onPress: async (reason?: string) => {
                            if (!reason || !reason.trim()) {
                                Alert.alert("Error", "A reason is required to request deletion.");
                                return;
                            }
                            try {
                                await reportApi.requestDelete(reportId, reason);
                                Alert.alert("Requested", "Deletion request submitted successfully.");
                                setUserMarkers(prev => prev.filter(m => m._id !== reportId));
                                if (expandedMarkerId === reportId) setExpandedMarkerId(null);
                            } catch (error: any) {
                                Alert.alert("Error", error.message || "Could not submit request.");
                            }
                        }
                    }
                ],
                'plain-text'
            );
        } else {
            // Android fallback for Alert.prompt (it doesn't exist natively on Android)
            // Since building a full bespoke RN Modal right now might bloat this file,
            // we'll trigger a standard alert that warns them to use an Admin dashboard,
            // but ideally this is handled by a custom <TextInputModal />
            // For immediate cross-platform compatibility without huge new component trees:
            setAndroidDeleteFocus(reportId);
        }
    };
    const goToMarker = (m: any) => {
        mapRef.current?.animateToRegion({ latitude: m.location.latitude, longitude: m.location.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 });
        setShowMarkerList(false);
    };

    return (
        <View style={styles.container}>
            <StatusBar hidden />


            {/* Unmount MapView during report flow to free ~120MB native memory (tiles, GL context) */}
            {!showFormModal && !showCamera ? (
                <MapView
                    ref={mapRef as any} provider={PROVIDER_GOOGLE} style={styles.map}
                    showsUserLocation={true} showsMyLocationButton={false} toolbarEnabled={false} mapType={mapType}
                    initialRegion={{ latitude: location?.coords.latitude ?? 28.6139, longitude: location?.coords.longitude ?? 77.209, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                    onRegionChangeComplete={(region) => setActiveRegion(region)}
                    clusterColor="#2196F3"
                    clusterTextColor="#FFFFFF"
                    radius={40} // Clustering pixel radius bounds
                >
                    {visibleMarkers.map(m => {
                        return <ReportMarker key={m._id} report={m} overrideColor={undefined} onPress={handleMarkerClickSync} />
                    })}

                    {Object.entries(multiDeviceData).map(([id, data]) => (
                        <ActiveGeotronMarker key={id} deviceId={id} data={data} role={roleMap[id]} />
                    ))}
                </MapView>
            ) : (
                <View style={[styles.map, { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }]} />
            )}

            {/* --- DASHBOARD CONTROLS --- */}
            <MapControlsDashboard
                showMarkerList={showMarkerList}
                setShowMarkerList={setShowMarkerList}
                setShowStatusModal={setShowStatusModal}
                setShowQueueModal={setShowQueueModal}
                pendingUploads={pendingUploads}
                toggleUserPanel={toggleUserPanel}
                onGoToUserLocation={() => mapRef.current?.animateToRegion({ latitude: location?.coords.latitude || 0, longitude: location?.coords.longitude || 0, latitudeDelta: 0.005, longitudeDelta: 0.005 })}
                mapType={mapType}
                setMapType={setMapType}
                getButtonColor={getButtonColor}
                handleToggleConnection={handleToggleConnection}
                isConnecting={isConnecting}
                isGeotronActive={isGeotronActive}
            />

            <UserProfilePanel
                visible={showUserPanel}
                userAnim={userPanelAnim}
                user={user}
                onClose={toggleUserPanel}
                onLogout={logout}
            />

            {/* --- MODALS & LIST --- */}
            {(() => {
                let previewLocationData: any = null;
                const activeGeotronSource = lockedGeotronData || (DEV_BYPASS_GEOTRON ? DEV_MOCK_GEOTRON_DATA : multiDeviceData);
                if (showFormModal && activeGeotronSource && Object.keys(activeGeotronSource).length > 0) {
                    const proc = locationProcessor.processLocation(JSON.stringify(activeGeotronSource), JSON.stringify(roleMap));
                    if (proc.usedGeotron) {
                        let acc: number | undefined;
                        let alt: number | undefined;
                        const midDevId = Object.entries(roleMap).find(([_, r]) => r === 'MID')?.[0];
                        if (midDevId && activeGeotronSource[midDevId]) {
                            acc = activeGeotronSource[midDevId].accuracy;
                            alt = activeGeotronSource[midDevId].altitude;
                        } else {
                            const firstDev = Object.values(activeGeotronSource)[0] as any;
                            acc = firstDev?.accuracy;
                            alt = firstDev?.altitude;
                        }
                        previewLocationData = {
                            latitude: proc.finalLatitude,
                            longitude: proc.finalLongitude,
                            altitude: alt,
                            accuracy: acc,
                        };
                    }
                }
                return (
                    <ReportFormModal
                        visible={showFormModal && !showCamera}
                        isTemporarilyHidden={showCamera}
                        onCancel={handleFormCancel}
                        onSubmit={handleSubmit}
                        onAddPhoto={proceedToCamera}
                        onRemovePhoto={handleRemovePhoto}
                        photos={photos}
                        loading={isUploading}
                        onCancelUpload={handleCancelUpload}
                        locationData={previewLocationData}
                    />
                );
            })()}

            <UserMarkerList
                visible={showMarkerList}
                markersRefreshing={markersRefreshing}
                markersLoaded={markersLoaded}
                markers={userMarkers}
                expandedMarkerId={expandedMarkerId}
                onRefresh={loadMarkers}
                onGoToMarker={goToMarker}
                onSetExpandedMarkerId={setExpandedMarkerId}
                onDeleteEntry={handleDeleteEntry}
            />

            {showStatusModal && (
                <GeotronStatusModal
                    visible={showStatusModal}
                    onClose={() => setShowStatusModal(false)}
                    data={multiDeviceData}
                    assignedGeotrons={user?.assignedGeotrons || []}
                    roleMap={roleMap}
                    onRefresh={refreshUser}
                    onDeviceLocate={handleDeviceLocate}
                />
            )}
            {showQueueModal && (
                <UploadQueueModal visible={showQueueModal} onClose={() => setShowQueueModal(false)} />
            )}

            {!showFormModal && !isUploading && photos.length === 0 && <FloatingButton label="Start Report" icon="camera" onPress={() => proceedToCamera()} bottom={50} />}
            {isUploading && <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2196F3" /></View>}

            {/* --- CAMERA OVERLAY (Overlays the entire UI to prevent form unmounting) --- */}
            {showCamera && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]}>
                    <CameraOverlay onCapture={handleCapture} onClose={handleCameraClose} />
                </View>
            )}

            {/* --- ANDROID DELETE MODAL --- */}
            {androidDeleteFocus && (
                <View style={StyleSheet.absoluteFill}>
                    <Pressable style={styles.userPanelBackdrop} onPress={() => { setAndroidDeleteFocus(null); setAndroidDeleteReason(''); }} />
                    <View style={styles.androidPromptContainer}>
                        <Text style={styles.androidPromptTitle}>Request Deletion</Text>
                        <Text style={styles.androidPromptSub}>Please provide a reason for deleting this report. This request will be reviewed by an admin.</Text>
                        <TextInput style={styles.androidPromptInput} placeholder="Enter reason..." value={androidDeleteReason} onChangeText={setAndroidDeleteReason} autoFocus />
                        <View style={styles.androidPromptActions}>
                            <Pressable onPress={() => { setAndroidDeleteFocus(null); setAndroidDeleteReason(''); }} style={styles.androidPromptCancel}><Text style={styles.androidPromptCancelTxt}>Cancel</Text></Pressable>
                            <Pressable onPress={async () => {
                                if (!androidDeleteReason.trim()) {
                                    Alert.alert("Error", "A reason is required to request deletion.");
                                    return;
                                }
                                try {
                                    await reportApi.requestDelete(androidDeleteFocus, androidDeleteReason);
                                    Alert.alert("Requested", "Deletion request submitted successfully.");
                                    setUserMarkers(prev => prev.filter(m => m._id !== androidDeleteFocus));
                                    if (expandedMarkerId === androidDeleteFocus) setExpandedMarkerId(null);
                                    setAndroidDeleteFocus(null);
                                    setAndroidDeleteReason('');
                                } catch (error: any) {
                                    Alert.alert("Error", error.message || "Could not submit request.");
                                }
                            }} style={styles.androidPromptSubmit}><Text style={styles.androidPromptSubmitTxt}>Submit</Text></Pressable>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    loadingContainer: { position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'white', padding: 15, borderRadius: 50, elevation: 5 },
    userPanelBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000 },
    androidPromptContainer: { position: 'absolute', top: '30%', left: '10%', right: '10%', backgroundColor: 'white', borderRadius: 12, padding: 20, zIndex: 1001, elevation: 10 },
    androidPromptTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#1e293b' },
    androidPromptSub: { fontSize: 13, color: '#64748b', marginBottom: 15, lineHeight: 18 },
    androidPromptInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#f8fafc', marginBottom: 20 },
    androidPromptActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    androidPromptCancel: { paddingVertical: 10, paddingHorizontal: 16 },
    androidPromptCancelTxt: { color: '#64748b', fontWeight: '600', fontSize: 15 },
    androidPromptSubmit: { backgroundColor: '#ef4444', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    androidPromptSubmitTxt: { color: 'white', fontWeight: '700', fontSize: 15 }
});