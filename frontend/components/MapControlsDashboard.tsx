import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

interface MapControlsDashboardProps {
    showMarkerList: boolean;
    setShowMarkerList: (val: boolean) => void;
    setShowStatusModal: (val: boolean) => void;
    setShowQueueModal: (val: boolean) => void;
    pendingUploads: number;
    toggleUserPanel: () => void;
    onGoToUserLocation: () => void;
    mapType: 'standard' | 'satellite';
    setMapType: (type: 'standard' | 'satellite') => void;
    getButtonColor: () => string;
    handleToggleConnection: () => void;
    isConnecting: boolean;
    isGeotronActive: boolean;
}

export const MapControlsDashboard: React.FC<MapControlsDashboardProps> = ({
    showMarkerList,
    setShowMarkerList,
    setShowStatusModal,
    setShowQueueModal,
    pendingUploads,
    toggleUserPanel,
    onGoToUserLocation,
    mapType,
    setMapType,
    getButtonColor,
    handleToggleConnection,
    isConnecting,
    isGeotronActive,
}) => {
    return (
        <>
            {/* --- LEFT BUTTONS --- */}
            <Pressable style={styles.myMarkersBtn} onPress={() => setShowMarkerList(!showMarkerList)}>
                <MaterialIcons name="list" size={18} color="#2196F3" />
                <Text style={styles.myMarkersTxt}>My Markers</Text>
            </Pressable>

            <Pressable style={[styles.myMarkersBtn, { top: 110 }]} onPress={() => setShowStatusModal(true)}>
                <MaterialIcons name="router" size={18} color="#4CD964" />
                <Text style={styles.myMarkersTxt}>Status</Text>
            </Pressable>

            {/* Queue Button with Badge */}
            <Pressable style={[styles.myMarkersBtn, { top: 165 }]} onPress={() => setShowQueueModal(true)}>
                <MaterialIcons name="cloud-queue" size={18} color="#FF9800" />
                <Text style={styles.myMarkersTxt}>Queue</Text>
                {pendingUploads > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{pendingUploads}</Text>
                    </View>
                )}
            </Pressable>

            {/* --- RIGHT CONTROLS --- */}
            <View style={styles.topRightControls}>
                <Pressable style={styles.iconButton} onPress={toggleUserPanel}>
                    <MaterialIcons name="person" size={24} color="#333" />
                </Pressable>
                <View style={styles.spacer} />
                <Pressable style={styles.iconButton} onPress={onGoToUserLocation}>
                    <MaterialIcons name="my-location" size={24} color="#333" />
                </Pressable>
                <View style={styles.spacer} />
                <Pressable style={styles.iconButton} onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}>
                    <Ionicons name={mapType === 'standard' ? "layers-outline" : "layers"} size={24} color="#333" />
                </Pressable>
                <View style={styles.spacer} />
                <Pressable style={[styles.iconButton, { backgroundColor: getButtonColor() }]} onPress={handleToggleConnection}>
                    {isConnecting ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <MaterialIcons name={isGeotronActive ? "wifi" : "wifi-off"} size={24} color="#fff" />
                    )}
                </Pressable>
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    myMarkersBtn: { position: "absolute", top: 50, left: 20, backgroundColor: "#fff", paddingVertical: 12, paddingHorizontal: 15, borderRadius: 25, elevation: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
    myMarkersTxt: { fontWeight: "700", color: "#333", fontSize: 15 },
    badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#F44336', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    topRightControls: { position: 'absolute', top: 50, right: 20, alignItems: "center" },
    iconButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 5 },
    spacer: { height: 12 },
});
