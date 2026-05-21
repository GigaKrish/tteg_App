import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator, StyleSheet, Platform, Modal, StatusBar, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { truncCoord } from '../utils/formatters';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface UserMarkerListProps {
    visible: boolean;
    markersRefreshing: boolean;
    markersLoaded: boolean;
    markers: any[];
    expandedMarkerId: string | null;
    onRefresh: () => void;
    onGoToMarker: (marker: any) => void;
    onSetExpandedMarkerId: (markerId: string | null) => void;
    onDeleteEntry: (markerId: string) => void;
}

export const UserMarkerList: React.FC<UserMarkerListProps> = ({
    visible,
    markersRefreshing,
    markersLoaded,
    markers,
    expandedMarkerId,
    onRefresh,
    onGoToMarker,
    onSetExpandedMarkerId,
    onDeleteEntry,
}) => {
    // Fullscreen photo viewer state
    const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
    const [photoLoading, setPhotoLoading] = useState(false);

    if (!visible && !fullscreenPhoto) return null;

    // ── Fullscreen Photo Viewer ──
    if (fullscreenPhoto) {
        return (
            <Modal visible animationType="fade" statusBarTranslucent>
                <StatusBar hidden />
                <View style={fsStyles.container}>
                    {photoLoading && (
                        <View style={fsStyles.loadingOverlay}>
                            <ActivityIndicator size="large" color="#fff" />
                            <Text style={fsStyles.loadingText}>Loading full photo...</Text>
                        </View>
                    )}
                    <Image
                        source={{ uri: fullscreenPhoto }}
                        style={fsStyles.image}
                        resizeMode="contain"
                        onLoadStart={() => setPhotoLoading(true)}
                        onLoadEnd={() => setPhotoLoading(false)}
                    />
                    <TouchableOpacity style={fsStyles.closeBtn} onPress={() => { setFullscreenPhoto(null); setPhotoLoading(false); }}>
                        <Ionicons name="close-circle" size={36} color="white" />
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    }

    if (!visible) return null;

    return (
        <View style={styles.markerListOverlay}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={styles.listHeader}>Recent Uploads</Text>
                <Pressable
                    onPress={onRefresh}
                    style={{ padding: 4 }}
                    disabled={markersRefreshing}
                >
                    {markersRefreshing ? (
                        <ActivityIndicator size="small" color="#2196F3" />
                    ) : (
                        <Ionicons name="refresh" size={18} color="#2196F3" />
                    )}
                </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
                {!markersLoaded ? (
                    <Pressable onPress={onRefresh} style={{ alignItems: 'center', paddingVertical: 30 }}>
                        <Ionicons name="refresh-circle-outline" size={40} color="#94a3b8" />
                        <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 8, fontWeight: '600' }}>Tap to refresh</Text>
                    </Pressable>
                ) : markers.length === 0 ? (
                    <Text style={{ color: '#999', fontSize: 12 }}>No uploads yet.</Text>
                ) : null}

                {markers.map((m: any, index: number) => {
                    const isExpanded = expandedMarkerId === m._id;
                    const isHardware = m.geotronLocations && Object.keys(m.geotronLocations).length > 0;
                    const themeColor = isHardware ? '#4CD964' : '#2196F3';
                    const serialNum = markers.length - index;

                    // Resolve full photo URLs — prefer photos array over thumbnails for fullscreen
                    const fullPhotos: string[] = m.photos && m.photos.length > 0 ? m.photos : [];

                    return (
                        <View key={m._id} style={styles.markerItemContainer}>
                            <View style={styles.markerItemRow}>
                                <Pressable style={{ flex: 1 }} onPress={() => onGoToMarker(m)}>
                                    <Text numberOfLines={1} style={[styles.markerTitle, { color: themeColor }]}>
                                        ID: {m.unique_id || serialNum}
                                    </Text>
                                </Pressable>

                                <View style={styles.miniTag}>
                                    <Text style={styles.miniTagText}>#{serialNum}</Text>
                                </View>

                                <Pressable style={styles.chevronButton} onPress={() => onSetExpandedMarkerId(expandedMarkerId === m._id ? null : m._id)}>
                                    <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={20} color="#2196F3" />
                                </Pressable>
                            </View>

                            {isExpanded && (
                                <View style={styles.expandedDetailsContainer}>

                                    {/* ── Thumbnails ── */}
                                    <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            {m.thumbnails && m.thumbnails.length > 0 ? (
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                    {m.thumbnails.map((url: string, i: number) => (
                                                        <Pressable key={i} onPress={() => setFullscreenPhoto(fullPhotos[i] || url)}>
                                                            <Image source={{ uri: url }} style={styles.listThumb} />
                                                            <View style={styles.thumbExpandIcon}>
                                                                <Ionicons name="expand" size={10} color="white" />
                                                            </View>
                                                        </Pressable>
                                                    ))}
                                                </ScrollView>
                                            ) : m.photos && m.photos.length > 0 ? (
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                    {m.photos.map((url: string, i: number) => (
                                                        <Pressable key={i} onPress={() => setFullscreenPhoto(url)}>
                                                            <Image source={{ uri: url }} style={styles.listThumb} />
                                                            <View style={styles.thumbExpandIcon}>
                                                                <Ionicons name="expand" size={10} color="white" />
                                                            </View>
                                                        </Pressable>
                                                    ))}
                                                </ScrollView>
                                            ) : (
                                                <View style={styles.noImageBox}><Text style={{ fontSize: 10 }}>No Image</Text></View>
                                            )}
                                        </View>
                                    </View>

                                    {/* ── Metadata ── */}
                                    <View style={{ marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 6 }}>
                                        <Text style={styles.metaDataText}>
                                            <Ionicons name="location-outline" size={10} /> Lat: {truncCoord(m.location.latitude)}, Long: {truncCoord(m.location.longitude)}
                                        </Text>
                                        <Text style={[styles.metaDataText, { marginTop: 2 }]}>
                                            <Ionicons name="navigate-circle-outline" size={10} /> Acc: {m.accuracy != null ? `${(m.accuracy * 100).toFixed(1)}cm` : 'N/A'}
                                        </Text>
                                        <Text style={[styles.metaDataText, { marginTop: 2 }]}>
                                            <Ionicons name="time-outline" size={10} /> {(() => { const d = new Date(m.createdAt); const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; let h = d.getHours(); const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; const time = `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${ampm}`; return `${date} ${time}`; })()}
                                        </Text>
                                        <Text style={[styles.metaDataText, { marginTop: 4, fontWeight: 'bold' }]}>
                                            {m.cameraType}
                                        </Text>
                                        {m.resourceId ? (
                                            <Text style={[styles.metaDataText, { marginTop: 2 }]}>
                                                Resource ID: {m.resourceId}
                                            </Text>
                                        ) : null}
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.propertyText, { color: themeColor }]}>
                                                UID: {m.unique_id}
                                            </Text>
                                        </View>

                                        <Pressable
                                            onPress={() => onDeleteEntry(m._id)}
                                            style={{ padding: 4 }}
                                            hitSlop={10}
                                        >
                                            <MaterialIcons name="delete-outline" size={22} color="#FF3B30" />
                                        </Pressable>
                                    </View>
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
};

// ── Fullscreen photo viewer styles ──
const fsStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    image: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
    closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    loadingOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center', zIndex: 5,
    },
    loadingText: { color: '#ccc', fontSize: 13, marginTop: 10, fontWeight: '500' },
});

const styles = StyleSheet.create({
    markerListOverlay: { position: "absolute", top: 180, left: 20, backgroundColor: "#fff", width: 240, maxHeight: 400, borderRadius: 15, elevation: 10, padding: 15 },
    listHeader: { fontWeight: '800', marginBottom: 10, color: '#1e3a8a', fontSize: 14 },
    markerItemContainer: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingVertical: 10 },
    markerItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    markerTitle: { fontWeight: "600", fontSize: 13, flex: 1 },
    chevronButton: { padding: 5, marginLeft: 5 },
    expandedDetailsContainer: { marginTop: 8, backgroundColor: '#f8fafc', borderRadius: 8, padding: 8 },
    propertyText: { fontSize: 11, fontWeight: '700', marginTop: 4 },
    miniTag: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 5, marginTop: -3 },
    miniTagText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    listThumb: { width: 80, height: 60, borderRadius: 6, marginRight: 5, backgroundColor: '#eee' },
    thumbExpandIcon: {
        position: 'absolute', bottom: 2, right: 7,
        backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4,
        padding: 2,
    },
    noImageBox: { width: '100%', height: 40, backgroundColor: '#f0f0f0', borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    metaDataText: { fontSize: 10, color: '#64748b', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
